import { z } from "zod";
import fs from "fs-extra";
import path from "path";
import { isPathAllowed } from "./roots.js";

// Define the tool interface
interface Tool {
  name: string;
  description: string;
  inputSchema: any;
  handler: (args: any) => Promise<any>;
}

// File-related tools
export const fileTools: Tool[] = [
  // Tool to read a file
  {
    name: "read-file",
    description: "Read the contents of a file",
    inputSchema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Path to the file to read"
        },
        line_numbers_included: {
          type: "boolean",
          description: "Whether to include line numbers in the output"
        }
      },
      required: ["path"]
    },
    handler: async (args) => {
      try {
        const filePath = args.path;
        const lineNumbersIncluded = args.line_numbers_included || false;
        
        // Check if the path is allowed
        if (!isPathAllowed(filePath)) {
          return {
            content: [{ 
              type: "text", 
              text: `Access denied: The path '${filePath}' is outside of allowed directories.` 
            }],
            isError: true
          };
        }

        // Check if the file exists
        if (!await fs.pathExists(filePath)) {
          return {
            content: [{ 
              type: "text", 
              text: `File not found: '${filePath}'` 
            }],
            isError: true
          };
        }

        // Read the file
        let content = await fs.readFile(filePath, 'utf-8');
        
        // Add line numbers if requested
        if (lineNumbersIncluded) {
          const lines = content.split('\n');
          content = lines.map((line, index) => `${index + 1}:${line}`).join('\n');
        }
        
        return {
          content: [{ 
            type: "text", 
            text: content 
          }]
        };
      } catch (error) {
        return {
          content: [{ 
            type: "text", 
            text: `Error reading file: ${(error as Error).message}` 
          }],
          isError: true
        };
      }
    }
  },
  
  // Tool to write to a file
  {
    name: "write-file",
    description: "Write content to a file",
    inputSchema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Path to the file to write"
        },
        content: {
          type: "string",
          description: "Content to write to the file"
        },
        createDirectories: {
          type: "boolean",
          description: "Whether to create parent directories if they don't exist"
        },
        line_numbers_included: {
          type: "boolean",
          description: "Whether the content includes line numbers that should be stripped"
        }
      },
      required: ["path", "content"]
    },
    handler: async (args) => {
      try {
        const { path: filePath, content, createDirectories, line_numbers_included } = args;
        
        // Check if the path is allowed
        if (!isPathAllowed(filePath)) {
          return {
            content: [{ 
              type: "text", 
              text: `Access denied: The path '${filePath}' is outside of allowed directories.` 
            }],
            isError: true
          };
        }

        // Create parent directories if requested
        if (createDirectories) {
          await fs.ensureDir(path.dirname(filePath));
        }

        // Process content if line numbers are included
        let processedContent = content;
        if (line_numbers_included) {
          const lines = content.split('\n');
          processedContent = lines.map(line => {
            const match = line.match(/^\d+:(.*)/);
            return match ? match[1] : line;
          }).join('\n');
        }

        // Write the file
        await fs.writeFile(filePath, processedContent);
        return {
          content: [{ 
            type: "text", 
            text: `File successfully written to '${filePath}'` 
          }]
        };
      } catch (error) {
        return {
          content: [{ 
            type: "text", 
            text: `Error writing file: ${(error as Error).message}` 
          }],
          isError: true
        };
      }
    }
  },
  
  // Tool to write specific lines to a file
  {
    name: "write-lines",
    description: "Write specific lines to a file",
    inputSchema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Path to the file to modify"
        },
        lines: {
          type: "string",
          description: "Lines to write in format 'lineNumber:content'"
        },
        createDirectories: {
          type: "boolean",
          description: "Whether to create parent directories if they don't exist"
        }
      },
      required: ["path", "lines"]
    },
    handler: async (args) => {
      try {
        const { path: filePath, lines, createDirectories } = args;
        
        // Check if the path is allowed
        if (!isPathAllowed(filePath)) {
          return {
            content: [{ 
              type: "text", 
              text: `Access denied: The path '${filePath}' is outside of allowed directories.` 
            }],
            isError: true
          };
        }

        // Create parent directories if requested
        if (createDirectories) {
          await fs.ensureDir(path.dirname(filePath));
        }

        // Check if the file exists
        let fileContent: string[] = [];
        if (await fs.pathExists(filePath)) {
          const content = await fs.readFile(filePath, 'utf-8');
          fileContent = content.split('\n');
        }

        // Parse the lines to write
        const lineUpdates = new Map<number, string>();
        const lineEntries = lines.split('\n');
        
        for (const entry of lineEntries) {
          const match = entry.match(/^(\d+):(.*)$/);
          if (match) {
            const lineNumber = parseInt(match[1], 10);
            const lineContent = match[2];
            lineUpdates.set(lineNumber, lineContent);
          }
        }

        // Apply the updates
        for (const [lineNumber, content] of lineUpdates.entries()) {
          // Line numbers are 1-based, array indices are 0-based
          const index = lineNumber - 1;
          
          // Ensure the array is large enough
          while (fileContent.length <= index) {
            fileContent.push('');
          }
          
          fileContent[index] = content;
        }

        // Write the updated content back to the file
        await fs.writeFile(filePath, fileContent.join('\n'));
        
        return {
          content: [{ 
            type: "text", 
            text: `File successfully updated at '${filePath}'` 
          }]
        };
      } catch (error) {
        return {
          content: [{ 
            type: "text", 
            text: `Error updating file: ${(error as Error).message}` 
          }],
          isError: true
        };
      }
    }
  },
  
  // Tool to append text before or after a file
  {
    name: "append-text",
    description: "Append text before or after a file's content",
    inputSchema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Path to the file to modify"
        },
        text: {
          type: "string",
          description: "Text to append"
        },
        position: {
          type: "string",
          enum: ["before", "after"],
          description: "Whether to append the text before or after the file's content"
        },
        createDirectories: {
          type: "boolean",
          description: "Whether to create parent directories if they don't exist"
        }
      },
      required: ["path", "text", "position"]
    },
    handler: async (args) => {
      try {
        const { path: filePath, text, position, createDirectories } = args;
        
        // Check if the path is allowed
        if (!isPathAllowed(filePath)) {
          return {
            content: [{ 
              type: "text", 
              text: `Access denied: The path '${filePath}' is outside of allowed directories.` 
            }],
            isError: true
          };
        }

        // Create parent directories if requested
        if (createDirectories) {
          await fs.ensureDir(path.dirname(filePath));
        }

        // Read existing content or use empty string if file doesn't exist
        let existingContent = '';
        if (await fs.pathExists(filePath)) {
          existingContent = await fs.readFile(filePath, 'utf-8');
        }

        // Append the text in the specified position
        let newContent;
        if (position === 'before') {
          newContent = text + existingContent;
        } else {
          newContent = existingContent + text;
        }

        // Write the updated content
        await fs.writeFile(filePath, newContent);
        
        return {
          content: [{ 
            type: "text", 
            text: `Text successfully appended ${position} the content in '${filePath}'` 
          }]
        };
      } catch (error) {
        return {
          content: [{ 
            type: "text", 
            text: `Error appending text: ${(error as Error).message}` 
          }],
          isError: true
        };
      }
    }
  },
  
  // Tool to search files by name or content using regexp
  {
    name: "search-files",
    description: "Search files by name or content using regular expressions",
    inputSchema: {
      type: "object",
      properties: {
        basePath: {
          type: "string",
          description: "Base directory to start the search from"
        },
        pattern: {
          type: "string",
          description: "Regular expression pattern to search for"
        },
        searchType: {
          type: "string",
          enum: ["name", "content", "both"],
          description: "Whether to search in file names, content, or both"
        },
        recursive: {
          type: "boolean",
          description: "Whether to search recursively in subdirectories"
        },
        maxResults: {
          type: "number",
          description: "Maximum number of results to return"
        }
      },
      required: ["basePath", "pattern", "searchType"]
    },
    handler: async (args) => {
      try {
        const { basePath, pattern, searchType, recursive = true, maxResults = 100 } = args;
        
        // Check if the path is allowed
        if (!isPathAllowed(basePath)) {
          return {
            content: [{ 
              type: "text", 
              text: `Access denied: The path '${basePath}' is outside of allowed directories.` 
            }],
            isError: true
          };
        }

        // Check if the directory exists
        if (!await fs.pathExists(basePath)) {
          return {
            content: [{ 
              type: "text", 
              text: `Directory not found: '${basePath}'` 
            }],
            isError: true
          };
        }

        // Compile the regular expression
        let regex: RegExp;
        try {
          regex = new RegExp(pattern, 'i');
        } catch (error) {
          return {
            content: [{ 
              type: "text", 
              text: `Invalid regular expression: ${(error as Error).message}` 
            }],
            isError: true
          };
        }

        // Find all files
        const files: string[] = [];
        const walk = async (dir: string) => {
          const entries = await fs.readdir(dir, { withFileTypes: true });
          for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            
            if (entry.isDirectory() && recursive) {
              await walk(fullPath);
            } else if (entry.isFile()) {
              files.push(fullPath);
            }
          }
        };
        
        await walk(basePath);
        
        // Search in files
        const results: { path: string; matches: string[] }[] = [];
        let resultCount = 0;
        
        for (const file of files) {
          if (resultCount >= maxResults) break;
          
          const relativePath = path.relative(basePath, file);
          let shouldInclude = false;
          const matches: string[] = [];
          
          // Search in file name
          if (searchType === 'name' || searchType === 'both') {
            if (regex.test(relativePath)) {
              shouldInclude = true;
              matches.push(`File name matches pattern: ${relativePath}`);
            }
          }
          
          // Search in file content
          if ((searchType === 'content' || searchType === 'both') && !shouldInclude) {
            try {
              const content = await fs.readFile(file, 'utf-8');
              const lines = content.split('\n');
              
              for (let i = 0; i < lines.length; i++) {
                if (regex.test(lines[i])) {
                  shouldInclude = true;
                  matches.push(`Line ${i + 1}: ${lines[i].trim()}`);
                  
                  // Limit the number of matches per file
                  if (matches.length >= 5) {
                    matches.push('... more matches found (showing first 5 only)');
                    break;
                  }
                }
              }
            } catch (error) {
              // Skip files that can't be read as text
              continue;
            }
          }
          
          if (shouldInclude) {
            results.push({
              path: relativePath,
              matches
            });
            resultCount++;
          }
        }
        
        // Format the results
        let resultText = `Found ${results.length} matching files in '${basePath}':\n\n`;
        
        for (const result of results) {
          resultText += `File: ${result.path}\n`;
          resultText += result.matches.map(match => `  ${match}`).join('\n');
          resultText += '\n\n';
        }
        
        if (results.length === 0) {
          resultText = `No matches found for pattern '${pattern}' in '${basePath}'`;
        }
        
        return {
          content: [{ 
            type: "text", 
            text: resultText 
          }]
        };
      } catch (error) {
        return {
          content: [{ 
            type: "text", 
            text: `Error searching files: ${(error as Error).message}` 
          }],
          isError: true
        };
      }
    }
  },
  
  // Tool to list directory contents
  {
    name: "list-directory",
    description: "List the contents of a directory",
    inputSchema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Path to the directory to list"
        },
        recursive: {
          type: "boolean",
          description: "Whether to list files recursively"
        }
      },
      required: ["path"]
    },
    handler: async (args) => {
      try {
        const { path: dirPath, recursive = false } = args;
        
        // Check if the path is allowed
        if (!isPathAllowed(dirPath)) {
          return {
            content: [{ 
              type: "text", 
              text: `Access denied: The path '${dirPath}' is outside of allowed directories.` 
            }],
            isError: true
          };
        }

        // Check if the directory exists
        if (!await fs.pathExists(dirPath)) {
          return {
            content: [{ 
              type: "text", 
              text: `Directory not found: '${dirPath}'` 
            }],
            isError: true
          };
        }

        // Get directory stats
        const stats = await fs.stat(dirPath);
        if (!stats.isDirectory()) {
          return {
            content: [{ 
              type: "text", 
              text: `Not a directory: '${dirPath}'` 
            }],
            isError: true
          };
        }

        // List files
        let files: string[];
        if (recursive) {
          // For recursive listing, we need to walk the directory
          const items: string[] = [];
          const walk = async (dir: string, prefix = '') => {
            const entries = await fs.readdir(dir, { withFileTypes: true });
            for (const entry of entries) {
              const relativePath = path.join(prefix, entry.name);
              if (entry.isDirectory()) {
                items.push(`${relativePath}/`);
                await walk(path.join(dir, entry.name), relativePath);
              } else {
                items.push(relativePath);
              }
            }
          };
          await walk(dirPath);
          files = items;
        } else {
          // For non-recursive listing, just read the directory
          const entries = await fs.readdir(dirPath, { withFileTypes: true });
          files = entries.map(entry => 
            entry.isDirectory() ? `${entry.name}/` : entry.name
          );
        }

        return {
          content: [{ 
            type: "text", 
            text: `Contents of '${dirPath}':\n${files.join('\n')}` 
          }]
        };
      } catch (error) {
        return {
          content: [{ 
            type: "text", 
            text: `Error listing directory: ${(error as Error).message}` 
          }],
          isError: true
        };
      }
    }
  }
];
