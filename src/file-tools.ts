import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { PathPolicy } from "./roots.js";
import { matchPattern } from "./regex.js";
import { absolutePath, MAX_FILE_BYTES, result, textInput, tool, type ToolDefinition } from "./tools.js";

const readOnly = { readOnlyHint: true, destructiveHint: false, openWorldHint: false };

async function readText(policy: PathPolicy, value: string): Promise<string> {
  const file = await fs.open(policy.resolve(value), "r");
  try {
    const stat = await file.stat();
    if (!stat.isFile()) throw new Error("Path must refer to a regular file.");
    if (stat.size > MAX_FILE_BYTES) throw new Error("File exceeds the 8 MiB text limit.");
    const buffer = Buffer.alloc(MAX_FILE_BYTES + 1);
    let total = 0;
    while (total < buffer.length) {
      const { bytesRead } = await file.read(buffer, total, buffer.length - total, total);
      if (bytesRead === 0) break;
      total += bytesRead;
    }
    if (total > MAX_FILE_BYTES) throw new Error("File exceeds the 8 MiB text limit.");
    return buffer.subarray(0, total).toString("utf8");
  } finally { await file.close(); }
}

async function exists(value: string): Promise<boolean> {
  try { await fs.stat(value); return true; }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return false; throw error; }
}

async function writeText(policy: PathPolicy, value: string, content: string, createDirectories = false) {
  const target = policy.resolve(value);
  if (Buffer.byteLength(content) > MAX_FILE_BYTES) throw new Error("Result exceeds the 8 MiB text limit.");
  if (createDirectories) await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(policy.resolve(target), content);
  return result("File successfully written to " + target);
}

async function* walk(policy: PathPolicy, base: string, recursive: boolean, signal?: AbortSignal) {
  const pending = [{ path: policy.workingDirectory(base), depth: 0 }];
  let visited = 0;
  while (pending.length) {
    signal?.throwIfAborted();
    const directory = pending.pop()!;
    const entries = (await fs.readdir(policy.resolve(directory.path), { withFileTypes: true }))
      .sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      signal?.throwIfAborted();
      if (++visited > 10000) throw new Error("Traversal exceeds the 10,000-entry limit; choose a narrower directory.");
      const fullPath = path.join(directory.path, entry.name);
      if (!policy.allows(fullPath) || entry.isSymbolicLink()) continue;
      yield { path: fullPath, relative: path.relative(base, fullPath), directory: entry.isDirectory() };
      if (entry.isDirectory() && recursive) {
        if (directory.depth >= 64) throw new Error("Traversal exceeds the 64-directory depth limit.");
        pending.push({ path: fullPath, depth: directory.depth + 1 });
      }
    }
  }
}

export function createFileTools(policy: PathPolicy): ToolDefinition[] {
  return [
    tool("read-file", "Read UTF-8 text from an allowed regular file, up to 8 MiB.",
      z.object({ path: absolutePath, line_numbers_included: z.boolean().default(false) }).strict(),
      async args => {
        let content = await readText(policy, args.path);
        if (args.line_numbers_included) content = content.split("\n").map((line, index) => String(index + 1) + ":" + line).join("\n");
        return result(content);
      }, readOnly),
    tool("write-file", "Write UTF-8 text to a file inside a configured allowed directory.",
      z.object({ path: absolutePath, content: textInput, createDirectories: z.boolean().default(false), line_numbers_included: z.boolean().default(false) }).strict(),
      args => writeText(policy, args.path, args.line_numbers_included ? args.content.replace(/^\d+:/gm, "") : args.content, args.createDirectories)),
    tool("write-lines", "Update 1-based lines using lineNumber:content entries (maximum line 100000).",
      z.object({ path: absolutePath, lines: textInput.min(1), createDirectories: z.boolean().default(false) }).strict(),
      async args => {
        const target = policy.resolve(args.path);
        const content = await exists(target) ? (await readText(policy, target)).split("\n") : [];
        for (const entry of args.lines.split("\n")) {
          const match = /^([1-9]\d*):(.*)$/.exec(entry);
          if (!match || Number(match[1]) > 100000) throw new Error("Each update must contain a line number from 1 to 100000 followed by ':' and text.");
          const index = Number(match[1]) - 1;
          while (content.length <= index) content.push("");
          content[index] = match[2];
        }
        return writeText(policy, target, content.join("\n"), args.createDirectories);
      }),
    tool("append-text", "Add UTF-8 text before or after an allowed file's contents.",
      z.object({ path: absolutePath, text: textInput, position: z.enum(["before", "after"]), createDirectories: z.boolean().default(false) }).strict(),
      async args => {
        const target = policy.resolve(args.path);
        const content = await exists(target) ? await readText(policy, target) : "";
        return writeText(policy, target, args.position === "before" ? args.text + content : content + args.text, args.createDirectories);
      }),
    tool("list-directory", "List allowed directory entries, optionally recursively; symlinks/junctions are not traversed.",
      z.object({ path: absolutePath, recursive: z.boolean().default(false) }).strict(),
      async (args, signal) => {
        const base = policy.workingDirectory(args.path);
        const entries: string[] = [];
        for await (const entry of walk(policy, base, args.recursive, signal)) entries.push(entry.relative + (entry.directory ? "/" : ""));
        return result("Contents of " + base + ":\n" + entries.join("\n"));
      }, readOnly),
    tool("search-files", "Search allowed file names or UTF-8 contents with a regular expression; regex execution and traversal are bounded.",
      z.object({ basePath: absolutePath, pattern: z.string().min(1).max(4096), searchType: z.enum(["name", "content", "both"]), recursive: z.boolean().default(true), maxResults: z.number().int().min(1).max(1000).default(100) }).strict(),
      async (args, signal) => {
        const base = policy.workingDirectory(args.basePath);
        const boundedSignal = signal ? AbortSignal.any([signal, AbortSignal.timeout(30000)]) : AbortSignal.timeout(30000);
        const matches: { path: string; matches: string[] }[] = [];
        for await (const entry of walk(policy, base, args.recursive, boundedSignal)) {
          if (entry.directory) continue;
          const matched: string[] = [];
          if (args.searchType !== "content" && (await matchPattern(args.pattern, [entry.relative], boundedSignal)).length) {
            matched.push("File name matches: " + entry.relative);
          }
          if (args.searchType !== "name") {
            let content: string;
            try { content = await readText(policy, entry.path); } catch { continue; }
            const lines = content.split("\n");
            for (const index of await matchPattern(args.pattern, lines, boundedSignal)) {
              matched.push("Line " + String(index + 1) + ": " + lines[index].slice(0, 2000));
            }
          }
          if (matched.length) matches.push({ path: entry.relative, matches: matched });
          if (matches.length >= args.maxResults) break;
        }
        return result(JSON.stringify({ matches, maxResults: args.maxResults }));
      }, readOnly),
  ];
}
