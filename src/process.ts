import { spawn } from "node:child_process";

export interface ProcessOptions {
  cwd: string;
  timeout: number;
  signal?: AbortSignal;
  shell?: boolean;
}
export interface ProcessResult { stdout: string; stderr: string; exitCode: number; }

export async function runProcess(
  executable: string, args: string[], options: ProcessOptions,
): Promise<ProcessResult> {
  options.signal?.throwIfAborted();
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, {
      cwd: options.cwd, shell: options.shell ?? false, windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"], detached: process.platform !== "win32",
    });
    let stdout = "", stderr = "", bytes = 0, failure: Error | undefined;
    const terminate = (reason: string) => {
      if (failure) return;
      failure = new Error(reason);
      if (child.pid) {
        if (process.platform === "win32") {
          const killer = spawn("taskkill.exe", ["/PID", String(child.pid), "/T", "/F"], {
            windowsHide: true, stdio: "ignore",
          });
          killer.on("error", () => child.kill());
        } else {
          try { process.kill(-child.pid, "SIGKILL"); } catch { child.kill("SIGKILL"); }
        }
      }
    };
    const abort = () => terminate("Operation cancelled.");
    options.signal?.addEventListener("abort", abort, { once: true });
    const timer = setTimeout(() => terminate("Process timed out."), options.timeout);
    const collect = (chunk: Buffer, target: "stdout" | "stderr") => {
      bytes += chunk.length;
      if (bytes > 10 * 1024 * 1024) { terminate("Process output exceeded 10 MiB."); return; }
      if (target === "stdout") stdout += chunk.toString();
      else stderr += chunk.toString();
    };
    child.stdout.on("data", chunk => collect(chunk, "stdout"));
    child.stderr.on("data", chunk => collect(chunk, "stderr"));
    const cleanup = () => {
      clearTimeout(timer);
      options.signal?.removeEventListener("abort", abort);
    };
    child.once("error", error => { cleanup(); reject(error); });
    child.once("close", code => {
      cleanup();
      if (failure) reject(failure);
      else resolve({ stdout, stderr, exitCode: code ?? 1 });
    });
    if (options.signal?.aborted) abort();
  });
}
