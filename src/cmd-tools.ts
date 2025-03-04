import { z } from "zod";
import { exec } from "child_process";
import { promisify } from "util";
import path from "path";
import { isPathAllowed } from "./roots.js";

// Promisify the exec function
const execAsync = promisify(exec);

// Define the tool interface
interface Tool {
  name: string;
  description: string;
  inputSchema: any;
  handler: (args: any) => Promise<any>;
}

// Command execution tools
export const cmdTools: Tool[] = [
  // Tool to execute a command
  {
    name: "execute-command",
    description: "Execute a command in the command prompt",
    inputSchema: {
      type: "object",
      properties: {
        command: {
          type: "string",
          description: "The command to execute"
        },
        workingDir: {
          type: "string",
          description: "Working directory for the command"
        },
        timeout: {
          type: "number",
          description: "Timeout in milliseconds"
        }
      },
      required: ["command"]
    },
    handler: async (args) => {
      try {
        const { command, workingDir, timeout = 30000 } = args;
        
        // Basic security check - prevent certain dangerous commands
        const dangerousCommands = [
          /rm\s+-rf\s+[\/\\]/i,  // rm -rf /
          /format\s+[a-z]:/i,     // format c:
          /deltree\s+[\/\\]/i,    // deltree /
          /rd\s+\/s\s+\/q\s+[a-z]:/i  // rd /s /q c:
        ];

        for (const pattern of dangerousCommands) {
          if (pattern.test(command)) {
            return {
              content: [{ 
                type: "text", 
                text: `Command rejected: The command appears to be potentially destructive.` 
              }],
              isError: true
            };
          }
        }

        // Check if working directory is allowed if specified
        if (workingDir && !isPathAllowed(workingDir)) {
          return {
            content: [{ 
              type: "text", 
              text: `Access denied: The working directory '${workingDir}' is outside of allowed directories.` 
            }],
            isError: true
          };
        }

        // Execute the command
        const options = {
          timeout,
          cwd: workingDir,
          maxBuffer: 1024 * 1024 * 10 // 10MB buffer
        };

        const { stdout, stderr } = await execAsync(command, options);
        
        // Format the result
        let result = '';
        if (stdout) {
          result += `STDOUT:\n${stdout}\n`;
        }
        if (stderr) {
          result += `STDERR:\n${stderr}\n`;
        }

        return {
          content: [{ 
            type: "text", 
            text: result || "Command executed successfully with no output." 
          }]
        };
      } catch (error) {
        const err = error as { message: string; code?: number; signal?: string; stdout?: string; stderr?: string };
        
        let errorMessage = `Error executing command: ${err.message}`;
        if (err.code !== undefined) {
          errorMessage += `\nExit code: ${err.code}`;
        }
        if (err.signal) {
          errorMessage += `\nSignal: ${err.signal}`;
        }
        if (err.stdout) {
          errorMessage += `\nSTDOUT:\n${err.stdout}`;
        }
        if (err.stderr) {
          errorMessage += `\nSTDERR:\n${err.stderr}`;
        }

        return {
          content: [{ 
            type: "text", 
            text: errorMessage 
          }],
          isError: true
        };
      }
    }
  },
  
  // Tool to execute a PowerShell command
  {
    name: "execute-powershell",
    description: "Execute a PowerShell script",
    inputSchema: {
      type: "object",
      properties: {
        script: {
          type: "string",
          description: "The PowerShell script to execute"
        },
        workingDir: {
          type: "string",
          description: "Working directory for the script"
        },
        timeout: {
          type: "number",
          description: "Timeout in milliseconds"
        }
      },
      required: ["script"]
    },
    handler: async (args) => {
      try {
        const { script, workingDir, timeout = 30000 } = args;
        
        // Check if working directory is allowed if specified
        if (workingDir && !isPathAllowed(workingDir)) {
          return {
            content: [{ 
              type: "text", 
              text: `Access denied: The working directory '${workingDir}' is outside of allowed directories.` 
            }],
            isError: true
          };
        }

        // Escape single quotes in the script
        const escapedScript = script.replace(/'/g, "''");
        
        // Build the PowerShell command
        const command = `powershell -NoProfile -ExecutionPolicy Bypass -Command "${escapedScript}"`;

        // Execute the command
        const options = {
          timeout,
          cwd: workingDir,
          maxBuffer: 1024 * 1024 * 10 // 10MB buffer
        };

        const { stdout, stderr } = await execAsync(command, options);
        
        // Format the result
        let result = '';
        if (stdout) {
          result += `STDOUT:\n${stdout}\n`;
        }
        if (stderr) {
          result += `STDERR:\n${stderr}\n`;
        }

        return {
          content: [{ 
            type: "text", 
            text: result || "PowerShell script executed successfully with no output." 
          }]
        };
      } catch (error) {
        const err = error as { message: string; code?: number; signal?: string; stdout?: string; stderr?: string };
        
        let errorMessage = `Error executing PowerShell script: ${err.message}`;
        if (err.code !== undefined) {
          errorMessage += `\nExit code: ${err.code}`;
        }
        if (err.signal) {
          errorMessage += `\nSignal: ${err.signal}`;
        }
        if (err.stdout) {
          errorMessage += `\nSTDOUT:\n${err.stdout}`;
        }
        if (err.stderr) {
          errorMessage += `\nSTDERR:\n${err.stderr}`;
        }

        return {
          content: [{ 
            type: "text", 
            text: errorMessage 
          }],
          isError: true
        };
      }
    }
  }
];
