import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { PathPolicy } from "../dist/roots.js";

export async function fixture() {
  const base = await fs.mkdtemp(path.join(os.tmpdir(), "mcp-essentials-test-"));
  const allowed = path.join(base, "allowed");
  const outside = path.join(base, "allowed-secret");
  await fs.mkdir(allowed); await fs.mkdir(outside);
  return { base, allowed, outside, policy: new PathPolicy([allowed]), cleanup: async () => {
    const resolved = await fs.realpath(base);
    const parent = await fs.realpath(os.tmpdir());
    if (path.dirname(resolved) !== parent || !path.basename(resolved).startsWith("mcp-essentials-test-")) throw new Error("Unsafe test cleanup path");
    await fs.rm(resolved, { recursive: true, force: true });
  } };
}
export function text(response) { return response.content.map(item => item.text ?? "").join("\n"); }
export function find(tools, name) { return tools.find(item => item.name === name).handler; }
export const meta = {
  "io.modelcontextprotocol/protocolVersion": "2026-07-28",
  "io.modelcontextprotocol/clientCapabilities": {},
};
export function wireClient(allowed, { legacy = false, commands = false, version = "2026-07-28" } = {}) {
  const args = ["dist/index.js"];
  if (allowed) args.push("--allow-directory", allowed);
  if (commands) args.push("--enable-command-tools");
  const child = spawn(process.execPath, args, { stdio: ["pipe", "pipe", "pipe"], windowsHide: true });
  let buffer = "", nextId = 0, stderr = "";
  const envelope = { ...meta, "io.modelcontextprotocol/protocolVersion": version };
  const pending = new Map();
  const messages = [];
  let invalidLine;
  child.stdout.on("data", chunk => {
    buffer += chunk.toString();
    let newline;
    while ((newline = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, newline); buffer = buffer.slice(newline + 1);
      if (!line.trim()) continue;
      try {
        const message = JSON.parse(line); messages.push(message);
        const waiter = pending.get(message.id);
        if (waiter) { pending.delete(message.id); clearTimeout(waiter.timer); waiter.resolve(message); }
      } catch { invalidLine = line; }
    }
  });
  child.stderr.on("data", chunk => { stderr += chunk; });
  const closed = new Promise(resolve => child.once("close", code => resolve(code)));
  return {
    child, messages,
    get lastRequestId() { return nextId; },
    get stderr() { return stderr; },
    get invalidLine() { return invalidLine; },
    request(method, params = {}) {
      const id = ++nextId;
      const response = new Promise((resolve, reject) => {
        const timer = setTimeout(() => { pending.delete(id); reject(new Error("No response for " + method + "; stderr=" + stderr)); }, 8000);
        pending.set(id, { resolve, timer });
      });
      child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params: legacy ? params : { ...params, _meta: envelope } }) + "\n");
      return response;
    },
    notify(method, params = {}) {
      child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method, params: legacy ? params : { ...params, _meta: envelope } }) + "\n");
    },
    async close() {
      child.stdin.end();
      let timer;
      try {
        const code = await Promise.race([
          closed,
          new Promise((_, reject) => { timer = setTimeout(() => { child.kill(); reject(new Error("Server did not exit on stdin EOF")); }, 3000); }),
        ]);
        if (invalidLine) throw new Error("Non-JSON stdout: " + invalidLine);
        if (code !== 0) throw new Error("Server exited " + code + ": " + stderr);
      } finally {
        clearTimeout(timer);
        for (const waiter of pending.values()) clearTimeout(waiter.timer);
      }
    },
  };
}
