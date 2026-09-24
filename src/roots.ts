import path from "node:path";
import fs from "node:fs";

export function isContained(root: string, target: string, flavor = path): boolean {
  const relative = flavor.relative(root, target);
  return relative === "" || (
    relative !== ".." && !relative.startsWith(".." + flavor.sep) &&
    !flavor.isAbsolute(relative)
  );
}

function validatePath(value: string): void {
  if (typeof value !== "string" || !value || value.includes("\0") || !path.isAbsolute(value)) {
    throw new Error("An absolute filesystem path without NUL characters is required.");
  }
  if (process.platform === "win32") {
    if (/^\\\\[?.]\\/.test(value)) throw new Error("Windows device paths are not supported.");
    const components = value.replace(/^[a-z]:/i, "").split(/[\\/]/).filter(Boolean);
    if (components.some(part =>
      part.includes(":") || /[. ]$/.test(part) ||
      /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\.|$)/i.test(part)
    )) throw new Error("Windows device names, alternate streams, and ambiguous path components are not supported.");
  }
}

/** Resolve existing links/junctions, including the nearest parent of a new file. */
function canonicalPath(value: string): string {
  let cursor = value;
  const missing: string[] = [];
  while (true) {
    try {
      fs.lstatSync(cursor);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      const parent = path.dirname(cursor);
      if (parent === cursor) throw error;
      missing.unshift(path.basename(cursor));
      cursor = parent;
      continue;
    }
    // Do not treat a dangling symlink as a new ordinary path.
    return path.join(fs.realpathSync.native(cursor), ...missing);
  }
}

/** Operator configuration is authoritative in both MCP protocol eras. */
export class PathPolicy {
  readonly roots: readonly string[];

  constructor(allowedDirectories: readonly string[] = []) {
    this.roots = Object.freeze(allowedDirectories.map(directory => {
      validatePath(directory);
      const resolved = fs.realpathSync.native(directory);
      if (!fs.statSync(resolved).isDirectory()) throw new Error("Allowed roots must be existing directories.");
      return resolved;
    }));
  }

  resolve(value: string): string {
    validatePath(value);
    const resolved = canonicalPath(path.normalize(value));
    if (!this.roots.some(root => isContained(root, resolved))) {
      throw new Error("Access denied: path is outside configured allowed directories.");
    }
    return resolved;
  }

  allows(value: string): boolean {
    try { this.resolve(value); return true; } catch { return false; }
  }

  workingDirectory(value?: string): string {
    const resolved = this.resolve(value ?? this.roots[0] ?? "");
    if (!fs.statSync(resolved).isDirectory()) throw new Error("Working directory must be an existing directory.");
    return resolved;
  }
}
