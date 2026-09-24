# MCP Essentials for Windows

Filesystem tools, optional host command execution, and Windows desktop capture over MCP stdio. Requires Node.js 22 or newer; CI covers Node.js 22 and 24 on Windows and Linux.

## Install from source

    git clone https://github.com/mario-andreschak/mcp-essentials-windows.git
    cd mcp-essentials-windows
    npm ci
    npm run build

Start with existing, absolute directories that the server may access:

    node dist/index.js --allow-directory "C:/Users/YourName/Documents/Workspace"

Repeat --allow-directory to authorize another directory. With no configured directories the server starts for discovery, but filesystem operations are denied immediately. The server does not request or advertise client roots: operator configuration remains authoritative for modern and legacy clients.

The package includes the mcp-essentials-windows executable when installed from a built tarball. This branch must be merged and released before its changes are available from the public npm package.

## MCP host configuration

Use absolute paths in the host's server configuration:

    {
      "mcpServers": {
        "mcp-essentials-windows": {
          "command": "node",
          "args": [
            "C:/tools/mcp-essentials-windows/dist/index.js",
            "--allow-directory",
            "C:/Users/YourName/Documents/Workspace"
          ]
        }
      }
    }

Alternatively, MCP_ALLOWED_DIRECTORIES accepts a JSON array of absolute existing directory paths. CLI directories are added to that list.

## Tools

| Tool | Inputs and behavior |
| --- | --- |
| read-file | path; optional line_numbers_included. Reads a regular UTF-8 file up to 8 MiB. |
| write-file | path, content; optional createDirectories and line_numbers_included. |
| write-lines | path, lines in lineNumber:content format; optional createDirectories. Line numbers are 1–100000. |
| append-text | path, text, position (before or after); optional createDirectories. |
| list-directory | path; optional recursive. Links and junctions are not traversed. |
| search-files | basePath, pattern, searchType (name, content, both); optional recursive and maxResults (1–1000). |
| take-screenshot | path ending in .png. Captures the Windows desktop to a new file. |
| record-screen | path ending in .mp4; duration (1–120 seconds, default 10), fps (1–30, default 15). |

Search uses case-insensitive JavaScript regular expressions in isolated worker threads with a one-second execution limit per match operation. Each search is limited to 30 seconds; recursive operations visit at most 10,000 entries and 64 directory levels. Search skips unreadable, non-regular, or oversized files. Results report at most five matching lines per file.

### Optional host commands

Add --enable-command-tools or set MCP_ENABLE_COMMAND_TOOLS=true to expose:

| Tool | Inputs |
| --- | --- |
| execute-command | command; optional workingDir and timeout in milliseconds (1–300000, default 30000). |
| execute-powershell | script; optional workingDir and timeout with the same limits. |

These tools execute with the server user's full host privileges. Allowed directories constrain their initial working directory only: shell commands and scripts can access other paths, programs, and networks allowed by the operating system. Enable them only when the MCP host and its tool approvals are trusted. There is no command denylist pretending to sandbox arbitrary shell code.

Omitted workingDir uses the first configured directory. Explicit workingDir must resolve to an existing allowed directory. PowerShell uses -EncodedCommand with UTF-16LE encoding and no intermediate command-shell quoting. Windows uses Windows PowerShell; other systems require pwsh for that tool. Process output is limited to 10 MiB. Timeouts and cancellation terminate the launched process tree.

### Desktop capture

Install [FFmpeg](https://ffmpeg.org/download.html) with [Windows gdigrab input](https://ffmpeg.org/ffmpeg-devices.html#gdigrab) and libx264 support. Make ffmpeg available on PATH, or set MCP_FFMPEG_PATH to its executable path.

The output parent directory must already exist and be allowed. Capture never overwrites an existing file. Screenshots return PNG files; recordings return H.264 MP4 files without audio. Tool results contain the output path, byte size, and MIME type. Screenshots up to 8 MiB also include an MCP image content block for the assistant to inspect.

An accessible Windows desktop is required. Locked sessions, service accounts without a usable desktop, and remote desktop policy can affect capture. Windows CI exercises real gdigrab capture; that does not verify a particular user's interactive desktop configuration.

## Filesystem policy

Paths must be absolute. Containment is separator-aware, so a root such as C:/allowed does not authorize C:/allowed-secret. Existing symbolic links and junctions are resolved; writes to new files validate the nearest existing parent. Dangling links fail closed. Windows device paths, reserved device names, alternate data streams, and ambiguous trailing-dot/space components are rejected.

Canonical path checks are application-level access controls, not an operating-system sandbox. They cannot eliminate races with another process replacing filesystem entries between validation and use, or isolate hard links and user-authorized shell commands. Use a restricted operating-system account or sandbox for hostile local processes.

## Protocol and development

The split TypeScript SDK v2 serves the [2026-07-28 protocol](https://modelcontextprotocol.io/specification/2026-07-28) through its modern serveStdio entry point. A modern client can call server/discover without initialize; requests carry protocol metadata and cacheable results carry cache hints. The same factory deliberately supports legacy initialize clients. Only implemented tools are advertised; no resources, roots, HTTP endpoint, or MCP App is claimed.

All stdout is newline-delimited JSON-RPC. Diagnostics use stderr. Invalid arguments and operation failures produce tool errors; unknown tools use the SDK's protocol error handling.

    npm test
    npm run build
    npm pack

The ESM Jest suites use real temporary files and subprocesses instead of ineffective CommonJS mocks. They cover sibling-prefix and junction escapes, fail-closed initial policy, file behavior, regex timeouts, command cancellation, raw modern and legacy stdio exchanges, and clean EOF shutdown.

GitHub Actions additionally checks native PowerShell and FFmpeg screenshot/recording on Windows. Screen capture tests require MCP_TEST_SCREEN_CAPTURE=true and a usable desktop; Linux checks report those native Windows cases as skipped.
