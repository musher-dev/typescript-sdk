/**
 * Install bundle skills into a project's .claude/skills/ directory.
 *
 * Pass the **project root** — the adapter appends `.claude/skills/`
 * automatically, matching Claude's expected filesystem layout.
 *
 * Prerequisites:
 *   export MUSHER_API_KEY="mush_..."
 *
 * Run:
 *   npx tsx examples/claude/install-project-skills.ts
 */

import { installClaudeSkills, pull } from "@musher-dev/musher-sdk";

const bundle = await pull("acme/code-review-kit:1.2.0");

// Pass the project root — skills are written to <root>/.claude/skills/<slug>/
const paths = await installClaudeSkills(bundle, process.cwd());

console.log(`Installed ${paths.length} skill file(s):`);
for (const p of paths) {
	console.log(`  ${p}`);
}
