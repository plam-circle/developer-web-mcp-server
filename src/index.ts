import { config } from "dotenv";
import { FastMCP } from "fastmcp";
import { glob } from "glob";
import { readFile, readdir, stat } from "fs/promises";
import { join } from "path";
import { z } from "zod";
import { chdir } from "process";

// Load environment variables from .env file
config();

// Change to the developer-web project directory
const projectPath = process.env.PROJECT_ROOT;
if (!projectPath) {
  console.error('PROJECT_ROOT environment variable is not set');
  process.exit(1);
}
chdir(projectPath);

const server = new FastMCP({
  name: "developer-web-mcp",
  version: "1.0.0",
  instructions: `
This MCP server provides tools for managing the developer-web project, a Circle Web3 developer platform.

Available capabilities:
- Search and analyze code across the monorepo
- Find components, features, and GraphQL schemas
- Get project structure and file information
- Analyze dependencies and package relationships
- Find test files and coverage information
- Get deployment and infrastructure information

The project structure includes:
- apps/ - Next.js applications
- packages/ - Shared libraries and utilities
- features/ - Feature-specific code and GraphQL schemas
- deploy/ - Terraform infrastructure configurations
- docs/ - Documentation
`,
});

// Tool: Search for files by pattern
server.addTool({
  name: "search_files",
  description: "Search for files matching a pattern in the developer-web project",
  parameters: z.object({
    pattern: z.string().describe("Glob pattern to search for files (e.g., '*.tsx', '**/components/**')"),
    directory: z.string().optional().default(".").describe("Directory to search in (default: project root)"),
  }),
  execute: async ({ pattern, directory = "." }) => {
    try {
      const projectRoot = process.cwd();
      const searchPath = join(projectRoot, directory);
      const files = await glob(pattern, { cwd: searchPath });
      
      return {
        content: [
          {
            type: "text",
            text: `Found ${files.length} files matching pattern "${pattern}":\n\n${files
              .map((file) => `- ${file}`)
              .join("\n")}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error searching files: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  },
});

// Tool: Find React components
server.addTool({
  name: "find_components",
  description: "Find React components in the project",
  parameters: z.object({
    name: z.string().optional().describe("Component name to search for (optional)"),
    directory: z.string().optional().default("apps,packages").describe("Directory to search in (default: 'apps' and 'packages')"),
  }),
  execute: async ({ name, directory = "apps,packages" }) => {
    try {
      const projectRoot = process.cwd();
      const dirs = directory.split(",");
      const results: string[] = [];
      
      for (const dir of dirs) {
        const searchPath = join(projectRoot, dir.trim());
        const pattern = name 
          ? `**/*${name}*.tsx` 
          : "**/*.tsx";
        
        const files = await glob(pattern, { cwd: searchPath });
        results.push(...files.map(file => `${dir}/${file}`));
      }
      
      return {
        content: [
          {
            type: "text",
            text: `Found ${results.length} React components:\n\n${results
              .map((file) => `- ${file}`)
              .join("\n")}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error finding components: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  },
});

// Tool: Get GraphQL schemas
server.addTool({
  name: "get_graphql_schemas",
  description: "Get all GraphQL schema files in the project",
  parameters: z.object({
    feature: z.string().optional().describe("Specific feature to get schemas for (optional)"),
  }),
  execute: async ({ feature }) => {
    try {
      const projectRoot = process.cwd();
      const pattern = feature 
        ? `features/${feature}/**/*.gql`
        : "features/**/*.gql";
      
      const files = await glob(pattern, { cwd: projectRoot });
      const schemas: { file: string; content: string }[] = [];
      
      for (const file of files) {
        const content = await readFile(join(projectRoot, file), "utf-8");
        schemas.push({ file, content });
      }
      
      return {
        content: [
          {
            type: "text",
            text: `Found ${schemas.length} GraphQL schema files:\n\n${schemas
              .map(({ file, content }) => `## ${file}\n\`\`\`graphql\n${content.slice(0, 500)}${content.length > 500 ? "\n...\n```" : "\n```"}`)
              .join("\n\n")}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error getting GraphQL schemas: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  },
});

// Tool: Get project structure
server.addTool({
  name: "get_project_structure",
  description: "Get the project structure and file counts",
  parameters: z.object({
    directory: z.string().optional().default(".").describe("Directory to analyze (default: project root)"),
    maxDepth: z.number().optional().default(3).describe("Maximum depth to traverse (default: 3)"),
  }),
  execute: async ({ directory = ".", maxDepth = 3 }) => {
    try {
      const projectRoot = process.cwd();
      const analyzeDir = async (dir: string, currentDepth = 0): Promise<string> => {
        if (currentDepth >= maxDepth) return "";
        
        const items = await readdir(join(projectRoot, dir));
        let result = "";
        
        for (const item of items) {
          if (item.startsWith(".") || item === "node_modules") continue;
          
          const itemPath = join(dir, item);
          const stats = await stat(join(projectRoot, itemPath));
          
          if (stats.isDirectory()) {
            result += `${"  ".repeat(currentDepth)}📁 ${item}/\n`;
            result += await analyzeDir(itemPath, currentDepth + 1);
          } else {
            result += `${"  ".repeat(currentDepth)}📄 ${item}\n`;
          }
        }
        
        return result;
      };
      
      const structure = await analyzeDir(directory);
      
      return {
        content: [
          {
            type: "text",
            text: `Project structure for ${directory}:\n\n${structure}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error getting project structure: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  },
});

// Tool: Find test files
server.addTool({
  name: "find_test_files",
  description: "Find test files in the project",
  parameters: z.object({
    type: z.enum(["unit", "integration", "e2e", "all"]).optional().default("all").describe("Type of test files to find (unit, integration, e2e, all)"),
  }),
  execute: async ({ type = "all" }) => {
    try {
      const projectRoot = process.cwd();
      let patterns: string[] = [];
      
      switch (type) {
        case "unit":
          patterns = ["**/*.test.ts", "**/*.test.tsx", "**/*.spec.ts", "**/*.spec.tsx"];
          break;
        case "integration":
          patterns = ["**/*.integration.test.ts", "**/*.integration.test.tsx"];
          break;
        case "e2e":
          patterns = ["**/*.e2e.test.ts", "**/*.e2e.test.tsx", "**/e2e/**/*.ts"];
          break;
        case "all":
          patterns = ["**/*.test.*", "**/*.spec.*", "**/e2e/**/*"];
          break;
      }
      
      const allFiles: string[] = [];
      for (const pattern of patterns) {
        const files = await glob(pattern, { cwd: projectRoot });
        allFiles.push(...files);
      }
      
      // Remove duplicates
      const uniqueFiles = [...new Set(allFiles)];
      
      return {
        content: [
          {
            type: "text",
            text: `Found ${uniqueFiles.length} ${type} test files:\n\n${uniqueFiles
              .map((file) => `- ${file}`)
              .join("\n")}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error finding test files: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  },
});

// Tool: Get package information
server.addTool({
  name: "get_package_info",
  description: "Get information about packages in the project",
  parameters: z.object({
    package: z.string().optional().describe("Specific package name to get info for (optional)"),
  }),
  execute: async ({ package: packageName }) => {
    try {
      const projectRoot = process.cwd();
      const packageFiles = await glob("**/package.json", { cwd: projectRoot });
      const packages: any[] = [];
      
      for (const file of packageFiles) {
        const content = await readFile(join(projectRoot, file), "utf-8");
        const pkg = JSON.parse(content);
        
        if (!packageName || pkg.name === packageName) {
          packages.push({
            file,
            name: pkg.name,
            version: pkg.version,
            dependencies: Object.keys(pkg.dependencies || {}),
            devDependencies: Object.keys(pkg.devDependencies || {}),
          });
        }
      }
      
      return {
        content: [
          {
            type: "text",
            text: `Found ${packages.length} packages:\n\n${packages
              .map((pkg) => `## ${pkg.name} v${pkg.version}\n**File:** ${pkg.file}\n**Dependencies:** ${pkg.dependencies.length}\n**Dev Dependencies:** ${pkg.devDependencies.length}\n`)
              .join("\n")}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error getting package info: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  },
});

// Start the server
server.start().catch(console.error);
