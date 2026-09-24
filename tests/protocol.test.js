import fs from "node:fs/promises";
import path from "node:path";
import { fixture, wireClient, text } from "./helpers.js";

let state;
beforeEach(async () => { state = await fixture(); });
afterEach(async () => { await state.cleanup(); });

test("modern stdio discovers without initialize and serves truthful tools and cache metadata", async () => {
  const client = wireClient(state.allowed);
  try {
    const discovered = await client.request("server/discover");
    expect(discovered.error).toBeUndefined();
    expect(discovered.result.resultType).toBe("complete");
    expect(discovered.result.capabilities.roots).toBeUndefined();
    expect(discovered.result.capabilities.resources).toBeUndefined();
    const listed = await client.request("tools/list");
    expect(listed.result).toMatchObject({ resultType: "complete", ttlMs: 0, cacheScope: "private" });
    expect(listed.result.tools.map(tool => tool.name)).toContain("take-screenshot");
    expect(listed.result.tools.map(tool => tool.name)).not.toContain("execute-command");
    expect(listed.result.tools.every(tool => tool.handler === undefined)).toBe(true);
    const target = path.join(state.allowed, "wire.txt");
    await fs.writeFile(target, "wire-content");
    const read = await client.request("tools/call", { name: "read-file", arguments: { path: target } });
    expect(read.result.resultType).toBe("complete");
    expect(text(read.result)).toBe("wire-content");
    const denied = await client.request("tools/call", { name: "read-file", arguments: { path: path.join(state.outside, "secret") } });
    expect(denied.result.isError).toBe(true);
    const invalid = await client.request("tools/call", { name: "read-file", arguments: { path: 2 } });
    expect(invalid.result?.isError || invalid.error).toBeTruthy();
    const unknown = await client.request("tools/call", { name: "missing-tool", arguments: {} });
    expect(unknown.error).toBeDefined();
  } finally { await client.close(); }
});
test("legacy clients initialize and receive the same filesystem policy without backwards roots exchange", async () => {
  const client = wireClient(state.allowed, { legacy: true, commands: true });
  try {
    const initialized = await client.request("initialize", {
      protocolVersion: "2025-11-25", capabilities: { roots: { listChanged: true } },
      clientInfo: { name: "legacy-tests", version: "1.0" },
    });
    expect(initialized.result.protocolVersion).toBe("2025-11-25");
    expect(initialized.result.capabilities.roots).toBeUndefined();
    client.notify("notifications/initialized");
    const listed = await client.request("tools/list");
    expect(listed.result.tools.map(tool => tool.name)).toContain("execute-powershell");
    const denied = await client.request("tools/call", { name: "read-file", arguments: { path: path.join(state.outside, "x") } });
    expect(denied.result.isError).toBe(true);
    expect(client.messages.some(message => message.method === "roots/list")).toBe(false);
  } finally { await client.close(); }
});
test("unconfigured roots never allow initial access in modern protocol", async () => {
  const client = wireClient();
  try {
    await client.request("server/discover");
    const denied = await client.request("tools/call", { name: "list-directory", arguments: { path: state.allowed } });
    expect(denied.result.isError).toBe(true);
  } finally { await client.close(); }
});


test("unsupported modern protocol versions receive a protocol error", async () => {
  const client = wireClient(state.allowed, { version: "2099-01-01" });
  try {
    const response = await client.request("server/discover");
    expect(response.error).toBeDefined();
    expect(response.result).toBeUndefined();
  } finally { await client.close(); }
});

test("modern wire cancellation stops command side effects and leaves the connection usable", async () => {
  const client = wireClient(state.allowed, { commands: true });
  try {
    await client.request("server/discover");
    const pending = client.request("tools/call", {
      name: "execute-command",
      arguments: { command: "node -e \"setTimeout(()=>require('fs').writeFileSync('cancelled-marker','bad'),2000)\"" },
    });
    pending.catch(() => {});
    const requestId = client.lastRequestId;
    await new Promise(resolve => setTimeout(resolve, 150));
    client.notify("notifications/cancelled", { requestId, reason: "test cancellation" });
    await new Promise(resolve => setTimeout(resolve, 2200));
    await expect(fs.access(path.join(state.allowed, "cancelled-marker"))).rejects.toThrow();
    expect((await client.request("tools/list")).error).toBeUndefined();
  } finally { await client.close(); }
});
