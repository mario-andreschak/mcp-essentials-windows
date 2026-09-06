import fs from "node:fs/promises";
import path from "node:path";
import { PathPolicy, isContained } from "../dist/roots.js";
import { fixture } from "./helpers.js";

let state;
beforeEach(async () => { state = await fixture(); });
afterEach(async () => { await state.cleanup(); });

test("empty operator configuration denies access immediately", () => {
  expect(new PathPolicy().allows(state.allowed)).toBe(false);
});
test("separator-aware containment rejects the reproduced sibling prefix", () => {
  expect(state.policy.allows(path.join(state.allowed, "new.txt"))).toBe(true);
  expect(state.policy.allows(path.join(state.outside, "secret.txt"))).toBe(false);
  expect(state.policy.allows(path.join(state.allowed, "..", "allowed-secret", "x"))).toBe(false);
});
test("Windows comparisons handle drive, case, separators and siblings on every platform", () => {
  expect(isContained("C:\\Allowed", "c:\\allowed\\inside.txt", path.win32)).toBe(true);
  expect(isContained("C:\\Allowed", "C:\\Allowed-secret\\x", path.win32)).toBe(false);
  expect(isContained("C:\\Allowed", "D:\\Allowed\\x", path.win32)).toBe(false);
});
test("canonical junction or symlink targets outside policy are denied for reads and new writes", async () => {
  const junction = path.join(state.allowed, "linked");
  await fs.symlink(state.outside, junction, process.platform === "win32" ? "junction" : "dir");
  expect(state.policy.allows(path.join(junction, "new.txt"))).toBe(false);
  await fs.writeFile(path.join(state.outside, "existing.txt"), "secret");
  expect(state.policy.allows(path.join(junction, "existing.txt"))).toBe(false);
});
test("dangling links cannot masquerade as a safe new file", async () => {
  const target = path.join(state.outside, "missing");
  await fs.symlink(target, path.join(state.allowed, "dangling"), process.platform === "win32" ? "junction" : "dir");
  expect(state.policy.allows(path.join(state.allowed, "dangling", "new.txt"))).toBe(false);
});
test("invalid, relative, NUL and file roots fail closed", async () => {
  expect(state.policy.allows("relative.txt")).toBe(false);
  expect(state.policy.allows(state.allowed + "\0")).toBe(false);
  await fs.writeFile(path.join(state.allowed, "file"), "");
  expect(() => new PathPolicy([path.join(state.allowed, "file")])).toThrow("directories");
  expect(() => new PathPolicy([path.join(state.base, "missing")])).toThrow();
});
(process.platform === "win32" ? test : test.skip)("Windows ADS and device-name paths are rejected", () => {
  for (const name of ["file.txt:stream", "NUL", "COM1.txt", "trailing."]) {
    expect(state.policy.allows(path.join(state.allowed, name))).toBe(false);
  }
});
