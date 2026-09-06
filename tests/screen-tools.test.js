import fs from "node:fs/promises";
import path from "node:path";
import { createScreenTools, screenArguments } from "../dist/screen-tools.js";
import { fixture, find, text } from "./helpers.js";

let state, tools;
beforeEach(async () => { state = await fixture(); tools = createScreenTools(state.policy); });
afterEach(async () => { await state.cleanup(); });
test("capture uses argument arrays, no overwrite, bounded duration and even video dimensions", () => {
  const output = path.join(state.allowed, "quoted & name.mp4");
  const args = screenArguments(output, 2, 15);
  expect(args.at(-1)).toBe(output);
  expect(args).toContain("-n");
  expect(args).toContain("gdigrab");
  expect(args).toContain("scale=trunc(iw/2)*2:trunc(ih/2)*2");
  expect(args[args.indexOf("-t") + 1]).toBe("2");
});
test("capture output policy and duration constraints reject before execution", async () => {
  expect((await find(tools, "take-screenshot")({ path: path.join(state.outside, "x.png") })).isError).toBe(true);
  expect((await find(tools, "record-screen")({ path: path.join(state.allowed, "x.mp4"), duration: 121 })).isError).toBe(true);
});
(process.platform !== "win32" ? test : test.skip)("non-Windows capture reports its platform prerequisite", async () => {
  expect(text(await find(tools, "take-screenshot")({ path: path.join(state.allowed, "x.png") }))).toContain("requires Windows");
});
(process.platform === "win32" && process.env.MCP_TEST_SCREEN_CAPTURE === "true" ? test : test.skip)(
  "Windows runner captures PNG and a one-second MP4 using real FFmpeg gdigrab", async () => {
    const screenshot = path.join(state.allowed, "screen.png");
    const video = path.join(state.allowed, "recording.mp4");
    const captured = await find(tools, "take-screenshot")({ path: screenshot });
    expect(text(captured)).not.toContain("failed");
    expect(captured.isError).toBe(false);
    expect(captured.content.find(item => item.type === "image")?.mimeType).toBe("image/png");
    expect((await fs.readFile(screenshot)).subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
    const recorded = await find(tools, "record-screen")({ path: video, duration: 1, fps: 5 });
    expect(recorded.isError).toBe(false);
    expect((await fs.readFile(video)).subarray(4, 8).toString()).toBe("ftyp");
    expect((await find(tools, "take-screenshot")({ path: screenshot })).isError).toBe(true);
  }, 60000);
