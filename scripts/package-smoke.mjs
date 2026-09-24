import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn, execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);
const npm = process.env.npm_execpath;
assert(npm, "Run this check through npm run test:package.");
const temporary = await fs.mkdtemp(path.join(os.tmpdir(), "mcp-essentials-package-"));
try {
  const packed = await run(process.execPath, [npm, "pack", "--json", "--ignore-scripts", "--pack-destination", temporary], { maxBuffer: 2 * 1024 * 1024 });
  const details = JSON.parse(packed.stdout)[0];
  assert(details.files.some(file => file.path === "dist/regex-worker.js"));
  assert(!details.files.some(file => file.path.startsWith("tests/")));
  await fs.writeFile(path.join(temporary, "package.json"), '{"private":true}');
  await run(process.execPath, [npm, "install", "--omit=dev", "--ignore-scripts", "--no-audit", "--no-fund", path.join(temporary, details.filename)], { cwd: temporary, maxBuffer: 2 * 1024 * 1024 });
  const binary = path.join(temporary, "node_modules", ".bin", "mcp-essentials-windows" + (process.platform === "win32" ? ".cmd" : ""));
  await fs.access(binary);
  const entry = process.platform === "win32"
    ? path.join(temporary, "node_modules", "mcp-essentials-windows", "dist", "index.js")
    : binary;
  await fs.writeFile(path.join(temporary, "probe.txt"), "installed package works");
  const processResult = new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [entry, "--allow-directory", temporary], { cwd: temporary, stdio: ["pipe", "pipe", "pipe"], windowsHide: true });
    const meta = { "io.modelcontextprotocol/protocolVersion": "2026-07-28", "io.modelcontextprotocol/clientCapabilities": {} };
    const send = (id, method, params = {}) => child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params: { ...params, _meta: meta } }) + "\n");
    let buffer = "", stderr = "", readVerified = false;
    const timer = setTimeout(() => { child.kill(); reject(new Error("Installed executable smoke timed out: " + stderr)); }, 12000);
    child.stderr.on("data", chunk => { stderr += chunk; });
    child.stdout.on("data", chunk => {
      buffer += chunk;
      let end;
      while ((end = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, end); buffer = buffer.slice(end + 1);
        try {
          const message = JSON.parse(line);
          assert.equal(message.result?.resultType, "complete");
          if (message.id === 1) send(2, "tools/call", { name: "read-file", arguments: { path: path.join(temporary, "probe.txt") } });
          if (message.id === 2) {
            assert.equal(message.result.content[0].text, "installed package works");
            readVerified = true;
            child.stdin.end();
          }
        } catch (error) { child.kill(); reject(error); }
      }
    });
    child.once("error", reject);
    child.once("close", code => {
      clearTimeout(timer);
      if (code === 0 && readVerified) resolve();
      else reject(new Error("Installed package failed: " + code + " " + stderr));
    });
    send(1, "server/discover");
  });
  await processResult;
  console.log("Installed tarball passed modern discovery, real file read, bin existence and clean EOF.");
} finally {
  const resolved = await fs.realpath(temporary);
  const parent = await fs.realpath(os.tmpdir());
  if (path.dirname(resolved) !== parent || !path.basename(resolved).startsWith("mcp-essentials-package-")) {
    throw new Error("Refusing cleanup outside the generated package test directory.");
  }
  await fs.rm(resolved, { recursive: true, force: true });
}
