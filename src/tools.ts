import { z } from "zod";
import type { CallToolResult, ToolAnnotations } from "@modelcontextprotocol/server";

export interface ToolDefinition {
  name: string;
  description: string;
  schema: z.ZodObject;
  annotations: ToolAnnotations;
  handler: (args: unknown, signal?: AbortSignal) => Promise<CallToolResult>;
}

export function result(text: string, isError = false): CallToolResult {
  return { content: [{ type: "text", text }], isError };
}

export function tool<T extends z.ZodRawShape>(
  name: string,
  description: string,
  schema: z.ZodObject<T>,
  action: (args: z.output<z.ZodObject<T>>, signal?: AbortSignal) => Promise<CallToolResult>,
  annotations: ToolAnnotations = { destructiveHint: true, openWorldHint: false },
): ToolDefinition {
  return {
    name, description, schema, annotations,
    handler: async (args, signal) => {
      try {
        signal?.throwIfAborted();
        return await action(schema.parse(args), signal);
      } catch (error) {
        return result(error instanceof Error ? error.message : String(error), true);
      }
    },
  };
}
export const absolutePath = z.string().min(1).max(32768);
export const MAX_FILE_BYTES = 8 * 1024 * 1024;
export const textInput = z.string().refine(value => Buffer.byteLength(value) <= MAX_FILE_BYTES, "Text exceeds 8 MiB.");
