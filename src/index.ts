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
    console.log(`get_git_diff called with branch=${branch}, includeDiff=${includeDiff}, includeCommits=${includeCommits}`);
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
          console.warn("Could not get commit messages:", error);
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

console.log("get_git_diff tool registered successfully");

// Tool: Generate PR description using AI
server.addTool({
  name: "generate_pr_description",
  description: "Generate a pull request description using AI based on git diff and GitHub PR template",
  parameters: z.object({
    branch: z.string().optional().describe("Branch to compare against (default: master)"),
    includeDiff: z.boolean().optional().default(false).describe("Whether to include the actual diff in the AI generation (default: false)"),
    template: z.string().optional().describe("Custom template to use instead of .github/pull_request_template.md"),
  }),
  execute: async ({ branch = "master", includeDiff = false, template }) => {
    console.log(`generate_pr_description called with branch=${branch}, includeDiff=${includeDiff}`);
    try {
      const projectRoot = process.cwd();
      
      // Get current branch name
      const { stdout: currentBranch } = await execAsync("git branch --show-current");
      const currentBranchName = currentBranch.trim();

      // Get list of changed files
      const { stdout: filesOutput } = await execAsync(`git diff --name-only ${branch}...HEAD`);
      const changedFiles = filesOutput.trim().split('\n').filter((file: string) => file.length > 0);

      // Get commit messages
      const { stdout: commits } = await execAsync(`git log --oneline ${branch}..HEAD`);
      const commitMessages = commits.trim().split('\n').filter((commit: string) => commit.length > 0);

      // Read PR template
      let prTemplate = "";
      if (template) {
        prTemplate = template;
      } else {
        try {
          prTemplate = await readFile(join(projectRoot, ".github/pull_request_template.md"), "utf-8");
        } catch (error) {
          console.warn("Could not read PR template, using default");
          prTemplate = `## Problem
<!-- Describe the problem this PR solves -->

## Solution
<!-- Describe the solution implemented -->

## Changes
<!-- List the main changes made -->

## Testing
<!-- Describe how this was tested -->

## Screenshots (if applicable)
<!-- Add screenshots if UI changes were made -->`;
        }
      }

      // Get diff if requested
      let diffContent = "";
      if (includeDiff) {
        try {
          const { stdout: diff } = await execAsync(`git diff ${branch}...HEAD`);
          diffContent = diff;
        } catch (error) {
          console.warn("Could not get diff:", error);
        }
      }

      // Prepare context for AI
      const context = {
        branch: currentBranchName,
        targetBranch: branch,
        changedFiles: changedFiles,
        commitMessages: commitMessages,
        fileCount: changedFiles.length,
        diffContent: diffContent,
        prTemplate: prTemplate
      };

      // Create AI prompt
      const aiPrompt = `You are an expert developer helping to generate a pull request description. 

Based on the following information, generate a comprehensive PR description that follows the provided template structure:

**Branch Information:**
- Current Branch: ${context.branch}
- Target Branch: ${context.targetBranch}
- Files Changed: ${context.fileCount}

**Changed Files:**
${context.changedFiles.map(file => `- ${file}`).join('\n')}

**Commit Messages:**
${context.commitMessages.map(commit => `- ${commit}`).join('\n')}

${context.diffContent ? `**Diff Content:**
\`\`\`diff
${context.diffContent}
\`\`\`` : ''}

**PR Template to Follow:**
${context.prTemplate}

Please generate a PR description that:
1. Follows the template structure exactly
2. Accurately describes the changes made
3. Is professional and clear
4. Includes specific details about what was changed
5. Mentions any breaking changes if applicable
6. Suggests testing approaches if relevant

Generate the complete PR description now:`;

      // For now, we'll return the prompt and context since we don't have AI integration
      // In a real implementation, you would call an AI service here
      const output = `# AI-Generated PR Description

**Note:** This is a template-based generation. In a real implementation, this would call an AI service.

## Context for AI Generation:

**Branch:** ${context.branch} → ${context.targetBranch}
**Files Changed:** ${context.fileCount}

**Changed Files:**
${context.changedFiles.map(file => `- ${file}`).join('\n')}

**Commits:**
${context.commitMessages.map(commit => `- ${commit}`).join('\n')}

**PR Template:**
${context.prTemplate}

**AI Prompt:**
${aiPrompt}

---

**To complete this implementation, you would need to:**
1. Add an AI service integration (OpenAI, Anthropic, etc.)
2. Replace this template output with actual AI-generated content
3. Handle API errors and rate limiting
4. Add configuration for AI model selection`;

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
            text: `Error generating PR description: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  },
});

console.log("generate_pr_description tool registered successfully");

// Tool: Get AI prompt for PR description
server.addTool({
  name: "get_pr_ai_prompt",
  description: "Get a clean AI prompt for generating PR descriptions that can be copied to Cursor AI",
  parameters: z.object({
    branch: z.string().optional().describe("Branch to compare against (default: master)"),
    includeDiff: z.boolean().optional().default(false).describe("Whether to include the actual diff in the AI generation (default: false)"),
  }),
  execute: async ({ branch = "master", includeDiff = false }) => {
    console.log(`get_pr_ai_prompt called with branch=${branch}, includeDiff=${includeDiff}`);
    try {
      const projectRoot = process.cwd();
      
      // Get current branch name
      const { stdout: currentBranch } = await execAsync("git branch --show-current");
      const currentBranchName = currentBranch.trim();

      // Get list of changed files
      const { stdout: filesOutput } = await execAsync(`git diff --name-only ${branch}...HEAD`);
      const changedFiles = filesOutput.trim().split('\n').filter((file: string) => file.length > 0);

      // Get commit messages
      const { stdout: commits } = await execAsync(`git log --oneline ${branch}..HEAD`);
      const commitMessages = commits.trim().split('\n').filter((commit: string) => commit.length > 0);

      // Read PR template
      let prTemplate = "";
      try {
        prTemplate = await readFile(join(projectRoot, ".github/pull_request_template.md"), "utf-8");
      } catch (error) {
        console.warn("Could not read PR template, using default");
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
          const { stdout: diff } = await execAsync(`git diff ${branch}...HEAD`);
          diffContent = diff;
        } catch (error) {
          console.warn("Could not get diff:", error);
        }
      }

      // Create clean AI prompt
      const aiPrompt = `You are an expert developer helping to generate a pull request description. 

Based on the following information, generate a comprehensive PR description that follows the provided template structure:

**Branch Information:**
- Current Branch: ${currentBranchName}
- Target Branch: ${branch}
- Files Changed: ${changedFiles.length}

**Changed Files:**
${changedFiles.map(file => `- ${file}`).join('\n')}

**Commit Messages:**
${commitMessages.map(commit => `- ${commit}`).join('\n')}

${diffContent ? `**Diff Content:**
\`\`\`diff
${diffContent}
\`\`\`` : ''}

**PR Template to Follow:**
${prTemplate}

Please generate a PR description that:
1. Follows the template structure exactly
2. Accurately describes the changes made
3. Is professional and clear
4. Includes specific details about what was changed
5. Mentions any breaking changes if applicable
6. Suggests testing approaches if relevant

Generate the complete PR description now:`;

      return {
        content: [
          {
            type: "text",
            text: `# AI Prompt for PR Description Generation

Copy the following prompt and paste it into Cursor's AI chat:

---

${aiPrompt}

---

**Instructions:**
1. Copy the prompt above
2. Paste it into Cursor's AI chat
3. The AI will generate a complete PR description following your template`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error getting AI prompt: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  },
});

console.log("get_pr_ai_prompt tool registered successfully");

// Start the server
server.start().catch(console.error);
