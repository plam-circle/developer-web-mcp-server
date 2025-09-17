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
- **Git Integration**: Get git diffs and analyze changes between branches
- **PR Description Generation**: Generate AI-powered pull request descriptions

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

### Environment Variables

The server requires the `PROJECT_ROOT` environment variable to be set to the path of your developer-web project.

Create a `.env` file in the project root:

```bash
# .env
PROJECT_ROOT=/path/to/your/developer-web
```

### MCP Configuration

Add this server to your `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "developer-web-mcp": {
      "command": "node",
      "args": ["/path/to/developer-web-mcp-server/dist/index.js"],
      "env": {
        "PROJECT_ROOT": "/path/to/developer-web"
      }
    }
  }
}
```

Or use the npm script with environment variables:

```json
{
  "mcpServers": {
    "developer-web-mcp": {
      "command": "npm",
      "args": ["run", "start:env"],
      "cwd": "/path/to/developer-web-mcp-server",
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

### `get_git_diff`
Get the git diff between current HEAD and master branch, including changed files and commit messages.

**Parameters:**
- `branch` (string, optional): Branch to compare against (default: master)
- `includeDiff` (boolean, optional): Whether to include the actual diff content (default: true)
- `includeCommits` (boolean, optional): Whether to include commit messages (default: true)

### `generate_pr_description`
Generate a pull request description using AI based on git diff and GitHub PR template.

**Parameters:**
- `branch` (string, optional): Branch to compare against (default: master)
- `includeDiff` (boolean, optional): Whether to include the actual diff in the AI generation (default: false)
- `template` (string, optional): Custom template to use instead of .github/pull_request_template.md
- `jiraTicket` (string, optional): JIRA ticket ID (e.g., 'DEV-5635') to include as a link in the PR description

### `get_pr_ai_prompt`
Get a clean AI prompt for generating PR descriptions that can be copied to Cursor AI.

**Parameters:**
- `branch` (string, optional): Branch to compare against (default: master)
- `includeDiff` (boolean, optional): Whether to include the actual diff in the AI generation (default: false)
- `jiraTicket` (string, optional): JIRA ticket ID (e.g., 'DEV-5635') to include as a link in the PR description

## PR Description Generation

The server includes powerful tools for generating pull request descriptions:

### Using AI Prompts
The `get_pr_ai_prompt` tool generates a clean prompt that you can copy and paste into Cursor's AI chat to generate professional PR descriptions.

### Template Integration
The tools automatically read your `.github/pull_request_template.md` file and use it as a structure for generating descriptions.

### Git Integration
All PR tools analyze your git changes, including:
- Changed files
- Commit messages
- Git diff (optional)
- Branch comparison

### Example Usage

1. **Get AI Prompt for Cursor:**
   ```
   Use get_pr_ai_prompt with your JIRA ticket ID
   ```

2. **Generate PR Description:**
   ```
   Use generate_pr_description with includeDiff=true for detailed analysis
   ```

3. **Get Git Diff:**
   ```
   Use get_git_diff to see what files have changed
   ```

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