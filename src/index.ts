import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { 
  CallToolRequestSchema, 
  ListRootsRequestSchema, 
  RootsListChangedNotificationSchema,
  ListToolsRequestSchema
} from "@modelcontextprotocol/sdk/types.js";

import { fileTools } from "./file-tools.js";
import { cmdTools } from "./cmd-tools.js";
import { initRoots, updateRoots, getCurrentRoots } from "./roots.js";

/**
 * Main function to start the MCP server
 */
async function main() {
  try {
    console.error("Starting MCP Windows Basic Server...");

    // Initialize roots
    initRoots();

    // Create the MCP server with proper capabilities
    const server = new Server(
      {
        name: "mcp-windows-basic",
        version: "0.1.0"
      },
      {
        capabilities: {
          tools: {},
          resources: {},
          roots: { listChanged: true }
        }
      }
    );

    // Register tool handlers
    server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          ...fileTools,
          ...cmdTools
        ]
      };
    });

    // Register tool call handler
    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      console.error(`Tool call: ${request.params.name}`);
      
      // Combine all tools
      const allTools = [...fileTools, ...cmdTools];
      
      // Find the requested tool
      const tool = allTools.find(t => t.name === request.params.name);
      if (!tool) {
        return {
          isError: true,
          content: [{ 
            type: "text", 
            text: `Tool not found: ${request.params.name}` 
          }]
        };
      }
      
      // Execute the tool handler
      try {
        return await tool.handler(request.params.arguments);
      } catch (error) {
        return {
          isError: true,
          content: [{ 
            type: "text", 
            text: `Error executing tool: ${error.message}` 
          }]
        };
      }
    });

    // Handle roots list requests
    server.setRequestHandler(ListRootsRequestSchema, async () => {
      console.error("Received roots list request");
      return { roots: getCurrentRoots() };
    });

    // Handle roots list changed notifications
    server.setNotificationHandler(RootsListChangedNotificationSchema, async () => {
      console.error("Received roots list changed notification");
      
      // Request the updated roots list
      try {
        const response = await server.listRoots();
        updateRoots(response.roots);
      } catch (error) {
        console.error(`Error updating roots: ${error}`);
      }
    });

    // Create and connect the transport
    const transport = new StdioServerTransport();
    await server.connect(transport);

    console.error("MCP Windows Basic Server running");
  } catch (error) {
    console.error(`Fatal error: ${error}`);
    process.exit(1);
  }
}

// Start the server
main().catch(error => {
  console.error(`Unhandled error: ${error}`);
  process.exit(1);
});
