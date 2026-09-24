import { z } from "zod";
import { PathPolicy } from "./roots.js";
import { runProcess } from "./process.js";
import { absolutePath, result, tool, type ToolDefinition } from "./tools.js";

const workingDir = absolutePath.optional();
const timeout = z.number().int().min(1).max(300000).default(30000);
const command = z.string().min(1).max(1024 * 1024).refine(value => !value.includes("\0"), "Commands cannot contain NUL.");
const annotations = { destructiveHint: true, openWorldHint: true, readOnlyHint: false };

export function createCommandTools(policy: PathPolicy): ToolDefinition[] {
  return [
    tool("execute-command",
      "Run an operator-authorized shell command with full host-user privileges. Allowed directories constrain only the initial working directory, not command effects.",
      z.object({ command, workingDir, timeout }).strict(),
      async (args, signal) => {
        const output = await runProcess(args.command, [], {
          cwd: policy.workingDirectory(args.workingDir), timeout: args.timeout,
          signal, shell: true,
        });
        return result(JSON.stringify(output), output.exitCode !== 0);
      }, annotations),
    tool("execute-powershell",
      "Run PowerShell with full host-user privileges. Uses an encoded script without shell interpolation; filesystem roots do not sandbox the script.",
      z.object({ script: command, workingDir, timeout }).strict(),
      async (args, signal) => {
        const executable = process.platform === "win32" ? "powershell.exe" : "pwsh";
        const output = await runProcess(executable, [
          "-NoLogo", "-NoProfile", "-NonInteractive", "-EncodedCommand",
          Buffer.from(args.script, "utf16le").toString("base64"),
        ], { cwd: policy.workingDirectory(args.workingDir), timeout: args.timeout, signal });
        return result(JSON.stringify(output), output.exitCode !== 0);
      }, annotations),
  ];
}
