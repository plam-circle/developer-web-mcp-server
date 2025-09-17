# Developer Web MCP Server

An MCP (Model Context Protocol) server for Circle's developer-web project management and code analysis.

## Features

This MCP server provides tools for:

- **File Search**: Search for files by pattern across the monorepo
- **Component Discovery**: Find React components by name or directory
- **GraphQL Schema Analysis**: Get and analyze GraphQL schemas
- **Project Structure**: Visualize the project structure and file organization
- **Test File Discovery**: Find unit, integration, and e2e test files
- **Package Management**: Analyze dependencies and package relationships

## Installation

1. Clone this repository:
```bash
git clone https://github.com/plam-circle/developer-web-mcp-server.git
cd developer-web-mcp-server
```

2. Install dependencies:
```bash
npm install
```

3. Build the project:
```bash
npm run build
```

## Usage

### Development Mode

Run the server in development mode with hot reloading:

```bash
npm run dev
```

### Production Mode

Build and run the server:

```bash
npm run build
npm start
```

### Testing with MCP Inspector

Use the MCP Inspector to test your server:

```bash
npm run inspect
```

## Configuration

Add this server to your `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "developer-web-mcp": {
      "command": "npx",
      "args": ["tsx", "/path/to/developer-web-mcp-server/src/index.ts"],
      "env": {
        "PROJECT_ROOT": "/path/to/developer-web"
      }
    }
  }
}
```

## Available Tools

### `search_files`
Search for files matching a pattern in the developer-web project.

**Parameters:**
- `pattern` (string): Glob pattern to search for files
- `directory` (string, optional): Directory to search in (default: project root)

### `find_components`
Find React components in the project.

**Parameters:**
- `name` (string, optional): Component name to search for
- `directory` (string, optional): Directory to search in (default: 'apps,packages')

### `get_graphql_schemas`
Get all GraphQL schema files in the project.

**Parameters:**
- `feature` (string, optional): Specific feature to get schemas for

### `get_project_structure`
Get the project structure and file counts.

**Parameters:**
- `directory` (string, optional): Directory to analyze (default: project root)
- `maxDepth` (number, optional): Maximum depth to traverse (default: 3)

### `find_test_files`
Find test files in the project.

**Parameters:**
- `type` (string, optional): Type of test files ('unit', 'integration', 'e2e', 'all')

### `get_package_info`
Get information about packages in the project.

**Parameters:**
- `package` (string, optional): Specific package name to get info for

## Development

### Project Structure

```
src/
├── index.ts          # Main server implementation
├── tools/            # Individual tool implementations (future)
└── utils/            # Utility functions (future)
```

### Adding New Tools

1. Create a new tool in `src/index.ts` using the `server.tool()` method
2. Define the tool's parameters and handler
3. Test with `npm run dev` or `npm run inspect`

## License

MIT