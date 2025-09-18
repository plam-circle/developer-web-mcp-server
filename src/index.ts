import { config } from "dotenv";
import { FastMCP } from "fastmcp";
import { glob } from "glob";
import { readFile, readdir, stat } from "fs/promises";
import { join } from "path";
import { z } from "zod";
import { chdir } from "process";
import { exec } from "child_process";
import { promisify } from "util";

// Load environment variables from .env file
config();

// Promisify exec for async command execution
const execAsync = promisify(exec);

// Change to the developer-web project directory
const projectPath = process.env.PROJECT_ROOT || "/Users/phong.lam/Documents/projects/developer-web";
if (!projectPath) {
  console.error('PROJECT_ROOT environment variable is not set');
  process.exit(1);
}
chdir(projectPath);

const server = new FastMCP({
  name: "developer-web-mcp-server",
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
- Generate pull request descriptions from templates and git diffs

The project structure includes:
- apps/ - Next.js applications
- packages/ - Shared libraries and utilities
- features/ - Feature-specific code and GraphQL schemas
- deploy/ - Terraform infrastructure configurations
- docs/ - Documentation
- .github/ - GitHub templates and workflows
`,
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
      const uniqueFiles = Array.from(new Set(allFiles));
      
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

// Tool: Get git diff between current branch and master
server.addTool({
  name: "get_git_diff",
  description: "Get the git diff between current HEAD and master branch, including changed files and commit messages",
  parameters: z.object({
    branch: z.string().optional().describe("Branch to compare against (default: master)"),
    includeDiff: z.boolean().optional().default(true).describe("Whether to include the actual diff content (default: true)"),
    includeCommits: z.boolean().optional().default(true).describe("Whether to include commit messages (default: true)"),
  }),
  execute: async ({ branch = "master", includeDiff = true, includeCommits = true }) => {
    try {
      const projectRoot = process.cwd();
      
      // Get current branch name
      const { stdout: currentBranch } = await execAsync("git branch --show-current");
      const currentBranchName = currentBranch.trim();

      // Get list of changed files
      const { stdout: filesOutput } = await execAsync(`git diff --name-only ${branch}...HEAD`);
      const changedFiles = filesOutput.trim().split('\n').filter((file: string) => file.length > 0);

      let output = `# Git Diff: ${currentBranchName} → ${branch}\n\n`;
      output += `**Files Changed:** ${changedFiles.length}\n\n`;

      // Add changed files list
      if (changedFiles.length > 0) {
        output += `## Changed Files\n\n`;
        changedFiles.forEach((file: string) => {
          output += `- \`${file}\`\n`;
        });
        output += `\n`;
      }

      // Add commit messages if requested
      if (includeCommits) {
        try {
          const { stdout: commits } = await execAsync(`git log --oneline ${branch}..HEAD`);
          const commitMessages = commits.trim().split('\n').filter((commit: string) => commit.length > 0);
          
          if (commitMessages.length > 0) {
            output += `## Commits\n\n`;
            commitMessages.forEach((commit: string) => {
              output += `- ${commit}\n`;
            });
            output += `\n`;
          }
        } catch (error) {
          // Silently handle error - commit messages are optional
        }
      }

      // Add actual diff if requested
      if (includeDiff) {
        try {
          const { stdout: diff } = await execAsync(`git diff ${branch}...HEAD`);
          if (diff.trim()) {
            output += `## Diff\n\n`;
            output += `\`\`\`diff\n${diff}\n\`\`\`\n`;
          }
        } catch (error) {
          output += `\n**Error getting diff:** ${error instanceof Error ? error.message : String(error)}\n`;
        }
      }

      return {
        content: [
          {
            type: "text",
            text: output,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error getting git diff: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  },
});

server.addTool({
  name: "get_pr_desc_prompt",
  description:
    "Get a clean AI prompt for generating PR descriptions that can be copied to Cursor AI",
  parameters: z.object({
    branch: z
      .string()
      .optional()
      .describe("Branch to compare against (default: master)"),
    includeDiff: z
      .boolean()
      .optional()
      .default(false)
      .describe(
        "Whether to include the actual diff in the AI generation (default: false)"
      ),
    jiraTicket: z
      .string()
      .optional()
      .describe(
        "JIRA ticket ID (e.g., 'DEV-5635') to include as a link in the PR description"
      ),
  }),
  execute: async ({ branch = "master", includeDiff = false, jiraTicket }) => {
    try {
      const projectRoot = process.cwd();

      // Get current branch name
      const { stdout: currentBranch } = await execAsync(
        "git branch --show-current"
      );
      const currentBranchName = currentBranch.trim();

      // Get list of changed files
      const { stdout: filesOutput } = await execAsync(
        `git diff --name-only ${branch}...HEAD`
      );
      const changedFiles = filesOutput
        .trim()
        .split("\n")
        .filter((file: string) => file.length > 0);

      // Get commit messages
      const { stdout: commits } = await execAsync(
        `git log --oneline ${branch}..HEAD`
      );
      const commitMessages = commits
        .trim()
        .split("\n")
        .filter((commit: string) => commit.length > 0);

      // Read PR template
      let prTemplate = "";
      try {
        prTemplate = await readFile(
          join(projectRoot, ".github/pull_request_template.md"),
          "utf-8"
        );
      } catch (error) {
        // Use default template if file not found
        prTemplate = `## Problem
<!-- Describe the problem this PR addresses -->

## Solution
<!-- Describe the solution implemented -->

## Changes
<!-- List the main changes made -->

## Testing
<!-- Describe how this was tested -->`;
      }

      // Get diff if requested
      let diffContent = "";
      if (includeDiff) {
        try {
          const { stdout: diff } = await execAsync(
            `git diff ${branch}...HEAD`
          );
          diffContent = diff;
        } catch (error) {
          // Silently handle error - diff is optional
        }
      }

      // Create clean AI prompt
      const aiPrompt = `You are an expert developer helping to generate a pull request description. 

Based on the following information, generate a comprehensive PR description that follows the provided template structure:

**Branch Information:**
- Current Branch: ${currentBranchName}
- Target Branch: ${branch}
- Files Changed: ${changedFiles.length}
${jiraTicket ? `- JIRA Ticket: ${jiraTicket}` : ""}

**Changed Files:**
${changedFiles.map((file) => `- ${file}`).join("\n")}

**Commit Messages:**
${commitMessages.map((commit) => `- ${commit}`).join("\n")}

${
  diffContent
    ? `**Diff Content:**
\`\`\`diff
${diffContent}
\`\`\``
    : ""
}

**PR Template to Follow:**
${prTemplate}

Please generate a PR description that:
1. Follows the template structure exactly, preserving all markdown headers (##, ###, etc.)
2. Output inside a fenced code block using \`\`\`markdown so I can copy/paste directly into a \`.md\` file.
3. Accurately describes the changes made
4. Is professional and clear
5. Includes specific details about what was changed
6. Mentions any breaking changes if applicable
7. Suggests testing approaches if relevant
8. Maintains the original markdown formatting from the template, including all ## headers, bullet points, and code blocks
9. Preserves the exact markdown syntax from the template (## Problem, ## Solution, etc.)
${
  jiraTicket
    ? `10. Includes the JIRA ticket link: <https://circlepay.atlassian.net/browse/${jiraTicket}>`
    : ""
}

IMPORTANT: Keep the exact markdown formatting from the template. Do not remove or modify the ## headers, bullet points, or any other markdown syntax. Generate the complete PR description now.`;

      return {
        content: [
          {
            type: "text",
            text: aiPrompt,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error getting AI prompt: ${
              error instanceof Error ? error.message : String(error)
            }`,
          },
        ],
      };
    }
  },
});

// Start the server
server.start().catch(console.error);
