# MCP Windows Basic Server

A comprehensive Model Context Protocol (MCP) server for Windows that provides file operations, command execution, and web functionality. This server enables AI assistants to interact with your local file system, execute commands, and perform web-related tasks.

## Features

### File Operations
- **read-file**: Read the contents of a file
- **write-file**: Write content to a file
- **list-directory**: List the contents of a directory
- **write-lines**: Write specific lines to a file
- **append-text**: Append text before or after a file's content
- **search-files**: Search files by name or content using regular expressions

### Command Execution
- **execute-command**: Execute a command in the command prompt
- **execute-powershell**: Execute a PowerShell script

### Web Functionality
- **web-search**: Search the web and return results with title, URL, and description
- **fetch-web-page**: Fetch and display the content of a web page
- **check-website-status**: Check if a website is up and responding

## Prerequisites

- **Node.js**: Version 16.0.0 or higher. [Download Node.js](https://nodejs.org/)
- **npm**: Included with Node.js installation
- **Windows OS**: Designed for Windows environments

## Installation

### Option 1: Clone from GitHub

```bash
# Clone the repository
git clone https://github.com/yourusername/mcp-windows-basic.git
cd mcp-windows-basic

# Install dependencies
npm install

# Build the project
npm run build
```

### Option 2: Install via npm

```bash
# Install globally
npm install -g mcp-windows-basic

# Or install locally
npm install mcp-windows-basic
```

## Configuration

### Environment Variables

This server doesn't require any environment variables by default. All functionality works out of the box.

### Roots Configuration

This server supports the MCP Roots feature, which allows clients to define the boundaries where the server can operate:

- If the client provides roots, the server will only allow access to those specified directories
- If the client doesn't provide any roots, the server will have access to everything

## Usage

### Running the Server Standalone

```bash
# If installed globally
mcp-windows-basic

# If installed locally or cloned from GitHub
npm start
```
### Using with FLUJO
- Click "MCP" at the top
- Click "Add Server"
- Copy and paste this repo's url, click "1) parse", click "2) clone".
- Wait for the next screen, click "1) Install dependencies", "2) Build server", "3) Test Server"
- Click "Update Configuration" on the bottom.

 "https://github.com/mario-andreschak/mcp-essentials-windows"
### Using with Claude Desktop

Add the server to your Claude for Desktop configuration file located at:
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "mcp-essentials-windows": {
      "command": "node",
      "args": ["dist/index.js"]
    }
  }
}
```

**Important**: Use absolute paths and forward slashes in the configuration.

### Using with Cline (VS Code Extension)

Add the server to your Cline MCP settings:

```json
{
  "mcpServers": {
    "windows-basic": {
      "command": "node",
      "args": ["C:/absolute/path/to/mcp-windows-basic/dist/index.js"],
      "disabled": false,
      "autoApprove": []
    }
  }
}
```

## Available Tools

### File Operations

| Tool Name | Description | Parameters | Example Usage |
|-----------|-------------|------------|--------------|
| `read-file` | Read the contents of a file | `path` (string, required): Path to the file to read<br>`line_numbers_included` (boolean, optional): Whether to include line numbers in the output | `@tool read-file path="C:/path/to/file.txt" line_numbers_included=true` |
| `write-file` | Write content to a file | `path` (string, required): Path to the file to write<br>`content` (string, required): Content to write to the file<br>`createDirectories` (boolean, optional): Whether to create parent directories if they don't exist<br>`line_numbers_included` (boolean, optional): Whether the content includes line numbers that should be stripped | `@tool write-file path="C:/path/to/file.txt" content="Hello, world!" createDirectories=true` |
| `list-directory` | List the contents of a directory | `path` (string, required): Path to the directory to list<br>`recursive` (boolean, optional): Whether to list contents recursively | `@tool list-directory path="C:/path/to/directory" recursive=false` |
| `write-lines` | Write specific lines to a file | `path` (string, required): Path to the file to modify<br>`lines` (string, required): Lines to write in format 'lineNumber:content'<br>`createDirectories` (boolean, optional): Whether to create parent directories if they don't exist | `@tool write-lines path="C:/path/to/file.txt" lines="1:First line\n3:Third line"` |
| `append-text` | Append text before or after a file's content | `path` (string, required): Path to the file to modify<br>`text` (string, required): Text to append<br>`position` (string, required): Whether to append the text "before" or "after" the file's content<br>`createDirectories` (boolean, optional): Whether to create parent directories if they don't exist | `@tool append-text path="C:/path/to/file.txt" text="Header text\n" position="before"` |
| `search-files` | Search files by name or content using regular expressions | `basePath` (string, required): Base directory to start the search from<br>`pattern` (string, required): Regular expression pattern to search for<br>`searchType` (string, required): Whether to search in "name", "content", or "both"<br>`recursive` (boolean, optional): Whether to search recursively in subdirectories<br>`maxResults` (number, optional): Maximum number of results to return | `@tool search-files basePath="C:/path/to/directory" pattern="TODO:" searchType="content" recursive=true` |

### Command Execution

| Tool Name | Description | Parameters | Example Usage |
|-----------|-------------|------------|--------------|
| `execute-command` | Execute a command in the command prompt | `command` (string, required): Command to execute<br>`workingDir` (string, optional): Working directory for the command | `@tool execute-command command="dir"` |
| `execute-powershell` | Execute a PowerShell script | `script` (string, required): PowerShell script to execute<br>`workingDir` (string, optional): Working directory for the script | `@tool execute-powershell script="Get-Process"` |

### Web Functionality

| Tool Name | Description | Parameters | Example Usage |
|-----------|-------------|------------|--------------|
| `web-search` | Search the web and return results | `query` (string, required): Search query<br>`numResults` (number, optional): Number of results to return (default: 10, max: 20) | `@tool web-search query="climate change solutions" numResults=5` |
| `fetch-web-page` | Fetch and display the content of a web page | `url` (string, required): URL of the web page to fetch<br>`timeout` (number, optional): Timeout in milliseconds (default: 30000) | `@tool fetch-web-page url="https://example.com" timeout=10000` |
| `check-website-status` | Check if a website is up and responding | `url` (string, required): URL of the website to check<br>`timeout` (number, optional): Timeout in milliseconds (default: 10000) | `@tool check-website-status url="https://example.com" timeout=5000` |

## Security Considerations

- **File Access**: The server implements path validation to prevent access outside of allowed directories
- **Command Execution**: Basic security checks are in place to prevent dangerous command execution
- **Web Functionality**: Web functionality is limited to HTTP and HTTPS protocols
- **Roots Enforcement**: When roots are provided, the server strictly enforces access only to those directories
- **User Approval**: All operations require explicit user approval before execution

## Troubleshooting

### Common Issues

- **Server Not Starting**: Ensure Node.js is properly installed and is version 16.0.0 or higher
- **File Access Denied**: Check if the server has permission to access the specified files/directories
- **Command Execution Fails**: Verify that the command is valid and can be executed in the current environment
- **Web Search Returns No Results**: Check your internet connection and try a different search query
- **Claude for Desktop Not Connecting**: Verify the path in the configuration is correct and uses forward slashes

### Logs

The server logs errors to the console. When using with Claude for Desktop, logs can be found at:
- Windows: `%APPDATA%\Claude\logs\mcp-server-windows-basic.log`
- macOS: `~/Library/Logs/Claude/mcp-server-windows-basic.log`

## Development

### Building from Source

```bash
# Clone the repository
git clone https://github.com/yourusername/mcp-windows-basic.git
cd mcp-windows-basic

# Install dependencies
npm install

# Build the project
npm run build

# Run tests (if available)
npm test
```

### Project Structure

```
mcp-windows-basic/
├── src/
│   ├── index.ts         # Main server entry point
│   ├── file-tools.ts    # File operation tools
│   ├── cmd-tools.ts     # Command execution tools
│   ├── web-tools.ts     # Web functionality tools
│   └── roots.ts         # Roots management
├── dist/               # Compiled JavaScript files
├── package.json         # Project configuration
└── tsconfig.json        # TypeScript configuration
```

## License

MIT
