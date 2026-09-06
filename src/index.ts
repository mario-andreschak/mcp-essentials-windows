#!/usr/bin/env node
import { realpathSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { PathPolicy } from "./roots.js";
import { createFileTools } from "./file-tools.js";
import { createCommandTools } from "./cmd-tools.js";
import { createScreenTools } from "./screen-tools.js";

export interface Configuration { allowedDirectories: string[]; enableCommands: boolean; }

export function configuration(argv = process.argv.slice(2), env = process.env): Configuration {
  const allowedDirectories: string[] = [];
  if (env.MCP_ALLOWED_DIRECTORIES) {
    const configured: unknown = JSON.parse(env.MCP_ALLOWED_DIRECTORIES);
    if (!Array.isArray(configured) || configured.some(value => typeof value !== "string")) {
      throw new Error("MCP_ALLOWED_DIRECTORIES must be a JSON array of absolute directory paths.");
    }
    allowedDirectories.push(...configured);
  }
  let enableCommands = env.MCP_ENABLE_COMMAND_TOOLS === "true";
  for (let index = 0; index < argv.length; index++) {
    if (argv[index] === "--allow-directory" && argv[index + 1]) allowedDirectories.push(argv[++index]);
    else if (argv[index] === "--enable-command-tools") enableCommands = true;
    else throw new Error("Unknown or incomplete option: " + argv[index]);
  }
  return { allowedDirectories, enableCommands };
}

export function createServer(config: Configuration): McpServer {
  const policy = new PathPolicy(config.allowedDirectories);
  const server = new McpServer({ name: "mcp-essentials-windows", version: "0.2.0" });
  const tools = [...createFileTools(policy), ...createScreenTools(policy),
    ...(config.enableCommands ? createCommandTools(policy) : [])];
  for (const definition of tools) {
    server.registerTool(definition.name, {
      description: definition.description, inputSchema: definition.schema,
      annotations: definition.annotations,
    }, (args, context) => definition.handler(args, context.mcpReq.signal));
  }
  return server;
}

export function main(): void {
  const config = configuration();
  // Validate operator configuration before accepting the first protocol message.
  new PathPolicy(config.allowedDirectories);
  const handle = serveStdio(() => createServer(config), {
    legacy: "serve", onerror: error => console.error(error.message),
  });
  process.once("SIGTERM", () => { void handle.close(); });
  process.once("SIGINT", () => { void handle.close(); });
}

if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  try { main(); } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
