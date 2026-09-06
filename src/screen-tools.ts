import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { PathPolicy } from "./roots.js";
import { runProcess } from "./process.js";
import { absolutePath, MAX_FILE_BYTES, result, tool, type ToolDefinition } from "./tools.js";

/** Kept public for deterministic cross-platform checks of shell-free arguments. */
export function screenArguments(output: string, seconds?: number, fps = 15): string[] {
  const common = ["-hide_banner", "-loglevel", "error", "-nostdin", "-n",
    "-f", "gdigrab", "-framerate", String(fps), "-i", "desktop"];
  return seconds === undefined
    ? [...common, "-frames:v", "1", "-update", "1", output]
    : [...common, "-t", String(seconds), "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2",
      "-c:v", "libx264", "-pix_fmt", "yuv420p", "-movflags", "+faststart", output];
}

export function createScreenTools(policy: PathPolicy): ToolDefinition[] {
  async function capture(output: string, seconds?: number, fps = 15, signal?: AbortSignal) {
    const target = policy.resolve(output);
    if (process.platform !== "win32") throw new Error("Desktop capture requires Windows and FFmpeg with gdigrab support.");
    const extension = seconds === undefined ? ".png" : ".mp4";
    if (path.extname(target).toLowerCase() !== extension) throw new Error("Output must end with " + extension);
    const cwd = policy.workingDirectory(path.dirname(target));
    const execution = await runProcess(process.env.MCP_FFMPEG_PATH || "ffmpeg", screenArguments(target, seconds, fps), {
      cwd, timeout: (seconds ?? 1) * 1000 + 20000, signal,
    });
    if (execution.exitCode !== 0) throw new Error("FFmpeg capture failed: " + execution.stderr);
    const stats = await fs.stat(policy.resolve(target));
    const response = result(JSON.stringify({ path: target, sizeBytes: stats.size, mimeType: seconds === undefined ? "image/png" : "video/mp4", durationSeconds: seconds }));
    if (seconds === undefined && stats.size <= MAX_FILE_BYTES) {
      response.content.push({ type: "image", mimeType: "image/png", data: (await fs.readFile(policy.resolve(target))).toString("base64") });
    }
    return response;
  }
  return [
    tool("take-screenshot", "Capture the Windows desktop to a new PNG inside an allowed directory. Requires FFmpeg; never overwrites existing files.",
      z.object({ path: absolutePath }).strict(),
      (args, signal) => capture(args.path, undefined, 15, signal),
      { destructiveHint: false, openWorldHint: false }),
    tool("record-screen", "Record the Windows desktop to a new MP4 inside an allowed directory for 1–120 seconds. Requires FFmpeg; never overwrites existing files.",
      z.object({ path: absolutePath, duration: z.number().int().min(1).max(120).default(10), fps: z.number().int().min(1).max(30).default(15) }).strict(),
      (args, signal) => capture(args.path, args.duration, args.fps, signal),
      { destructiveHint: false, openWorldHint: false }),
  ];
}
