import fs from "node:fs/promises";
import { createCommandTools } from "../dist/cmd-tools.js";
import { configuration } from "../dist/index.js";
import { fixture, find, text } from "./helpers.js";

let state, tools;
beforeEach(async () => { state = await fixture(); tools = createCommandTools(state.policy); });
afterEach(async () => { await state.cleanup(); });

test("host command tools require an explicit operator opt-in in configuration", () => {
  expect(configuration([], {}).enableCommands).toBe(false);
  expect(configuration(["--enable-command-tools"], {}).enableCommands).toBe(true);
  expect(() => configuration([], { MCP_ALLOWED_DIRECTORIES: "{}" })).toThrow("JSON array");
});
test("authorized command uses a configured working directory and preserves arbitrary literal text", async () => {
  const response = await find(tools, "execute-command")({ command: "node -e \"console.log(process.cwd()); console.log('rm -rf / is just text')\"" });
  expect(response.isError).toBe(false);
  expect(JSON.parse(text(response)).stdout).toContain(await fs.realpath(state.allowed));
  expect(JSON.parse(text(response)).stdout).toContain("rm -rf / is just text");
});
test("commands cannot start from an unconfigured directory, including omitted cwd with no roots", async () => {
  const response = await find(tools, "execute-command")({ command: "echo harmless", workingDir: state.outside });
  expect(response.isError).toBe(true);
});
test("command failures are tool errors with exit code and output", async () => {
  const response = await find(tools, "execute-command")({ command: "node -e \"console.error('failure detail'); process.exit(7)\"" });
  expect(response.isError).toBe(true);
  expect(JSON.parse(text(response))).toMatchObject({ exitCode: 7, stderr: expect.stringContaining("failure detail") });
});
test("invalid commands and timeouts are rejected", async () => {
  for (const args of [{ command: "" }, { command: "echo\0bad" }, { command: "echo ok", timeout: 0 }]) {
    expect((await find(tools, "execute-command")(args)).isError).toBe(true);
  }
});
test("timeouts and cancellation stop the process group", async () => {
  const execute = find(tools, "execute-command");
  const command = "node -e \"setInterval(()=>{},1000)\"";
  expect(text(await execute({ command, timeout: 150 }))).toContain("timed out");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 150);
  try { expect(text(await execute({ command }, controller.signal))).toContain("cancelled"); }
  finally { clearTimeout(timer); }
});
(process.platform === "win32" ? test : test.skip)("PowerShell preserves quotes, dollars, and semicolons without CMD interpolation", async () => {
  const response = await find(tools, "execute-powershell")({ script: "$value = 'a ''quoted'' $value & ; literal'; Write-Output $value" });
  expect(response.isError).toBe(false);
  expect(JSON.parse(text(response)).stdout).toContain("a 'quoted' $value & ; literal");
});
