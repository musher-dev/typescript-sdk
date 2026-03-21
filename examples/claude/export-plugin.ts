/**
 * PREVIEW — Export a bundle as a Claude plugin directory.
 *
 * This adapter currently writes a `manifest.json` at the plugin root.
 * Anthropic's Claude Desktop expects `.claude-plugin/plugin.json` with
 * skills under `skills/<name>/SKILL.md`. The output shape may change in
 * a future SDK release to match the official plugin spec.
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
	// name: "my-plugin",  // optional — defaults to the bundle slug
});

console.log(`Plugin exported to: ${pluginDir}`);
