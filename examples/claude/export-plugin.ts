/**
 * Export a bundle as a Claude Code plugin directory.
 *
 * The adapter writes plugin metadata to `.claude-plugin/plugin.json` and
 * skill content under `skills/<name>/SKILL.md`, matching Claude Code's
 * current plugin layout. The exported plugin works in Claude Code, Claude
 * Desktop's Code tab, and the VS Code extension (all share Claude Code
 * configuration). Note: this is NOT a Claude Desktop Extension (.mcpb).
 *
 * Validate and test locally:
 *   claude --plugin-dir ./plugins/<name>
 *   claude plugin validate ./plugins/<name>
 *   claude --debug   # for troubleshooting
 *
 * Prerequisites:
 *   export MUSHER_API_KEY="mush_..."
 *
 * Run:
 *   npx tsx examples/claude/export-plugin.ts
 */

import { exportClaudePlugin, pull } from "@musher-dev/musher-sdk";

const bundle = await pull("acme/code-review-kit:1.2.0");

const pluginDir = await exportClaudePlugin(bundle, {
	targetDir: "./plugins",
	// name: "my-plugin",        // optional — defaults to the bundle slug
	// description: "Review kit", // optional — populates plugin.json description
});

console.log(`Plugin exported to: ${pluginDir}`);
