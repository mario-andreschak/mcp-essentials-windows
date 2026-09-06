import fs from "node:fs/promises";
import path from "node:path";
import { createFileTools } from "../dist/file-tools.js";
import { fixture, find, text } from "./helpers.js";

let state, tools, target;
beforeEach(async () => { state = await fixture(); tools = createFileTools(state.policy); target = path.join(state.allowed, "file.txt"); });
afterEach(async () => { await state.cleanup(); });

test("write, numbered read, line update, and append perform real filesystem operations", async () => {
  expect((await find(tools, "write-file")({ path: target, content: "1:one\n2:two", line_numbers_included: true })).isError).toBe(false);
  expect(text(await find(tools, "read-file")({ path: target, line_numbers_included: true }))).toBe("1:one\n2:two");
  await find(tools, "write-lines")({ path: target, lines: "2:changed\n4:four" });
  await find(tools, "append-text")({ path: target, text: "HEADER\n", position: "before" });
  expect(await fs.readFile(target, "utf8")).toBe("HEADER\none\nchanged\n\nfour");
});
test("creation under a missing parent remains inside the configured root", async () => {
  const nested = path.join(state.allowed, "nested", "child.txt");
  expect((await find(tools, "write-file")({ path: nested, content: "ok", createDirectories: true })).isError).toBe(false);
  expect(await fs.readFile(nested, "utf8")).toBe("ok");
});
test("file tools deny sibling paths and never change outside data", async () => {
  const secret = path.join(state.outside, "secret.txt");
  await fs.writeFile(secret, "private");
  for (const [name, args] of [
    ["read-file", { path: secret }],
    ["write-file", { path: secret, content: "changed" }],
    ["write-lines", { path: secret, lines: "1:changed" }],
    ["append-text", { path: secret, text: "changed", position: "after" }],
    ["list-directory", { path: state.outside }],
    ["search-files", { basePath: state.outside, pattern: ".", searchType: "both" }],
  ]) expect((await find(tools, name)(args)).isError).toBe(true);
  expect(await fs.readFile(secret, "utf8")).toBe("private");
});
test("recursive listing and search skip links/junctions outside the root", async () => {
  await fs.writeFile(target, "TODO allowed");
  await fs.writeFile(path.join(state.outside, "secret.txt"), "TODO private");
  await fs.symlink(state.outside, path.join(state.allowed, "linked"), process.platform === "win32" ? "junction" : "dir");
  expect(text(await find(tools, "list-directory")({ path: state.allowed, recursive: true }))).not.toContain("secret");
  const searched = await find(tools, "search-files")({ basePath: state.allowed, pattern: "TODO", searchType: "content" });
  expect(searched.isError).toBe(false);
  expect(JSON.parse(text(searched)).matches.map(item => item.path)).toEqual(["file.txt"]);
});
test("invalid arguments, line indices and append positions do not mutate files", async () => {
  await fs.writeFile(target, "original");
  for (const args of [{ path: target, lines: "0:bad" }, { path: target, lines: "100001:bad" }, { path: target, lines: "not numbered" }]) {
    expect((await find(tools, "write-lines")(args)).isError).toBe(true);
  }
  expect((await find(tools, "append-text")({ path: target, text: "bad", position: "middle" })).isError).toBe(true);
  expect((await find(tools, "read-file")({ path: 7 })).isError).toBe(true);
  expect(await fs.readFile(target, "utf8")).toBe("original");
});
test("regular-file and text-size limits are enforced", async () => {
  expect((await find(tools, "read-file")({ path: state.allowed })).isError).toBe(true);
  await fs.writeFile(target, Buffer.alloc(8 * 1024 * 1024 + 1));
  expect(text(await find(tools, "read-file")({ path: target }))).toContain("8 MiB");
});
test("invalid and pathological regexes return errors without freezing the server", async () => {
  await fs.writeFile(target, "a".repeat(200) + "!");
  const search = find(tools, "search-files");
  expect((await search({ basePath: state.allowed, pattern: "[", searchType: "content" })).isError).toBe(true);
  const response = await search({ basePath: state.allowed, pattern: "(a+)+$", searchType: "content" });
  expect(response.isError).toBe(true);
  expect(text(response)).toContain("execution limit");
  expect(text(await find(tools, "read-file")({ path: target }))).toContain("!");
});
