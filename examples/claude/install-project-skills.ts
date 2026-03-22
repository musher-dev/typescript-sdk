/**
 * Install bundle skills into a project's .claude/skills/ directory.
 *
 * Skills are written to `<root>/.claude/skills/<skill-name>/SKILL.md`,
 * the canonical layout expected by Claude Code. Each skill gets its own
 * directory directly under `.claude/skills/` with no namespace prefix.
 *
 * Commit the `.claude/skills/` directory to version control to share
 * skills with collaborators.
 *
 * Verify discovery by opening the project in Claude Code — installed
 * skills should appear automatically.
 *
 * Prerequisites:
 *   export MUSHER_API_KEY="mush_..."
 *
 * Run:
 *   npx tsx examples/claude/install-project-skills.ts
 */

import { installClaudeSkills, pull } from "@musher-dev/musher-sdk";

const bundle = await pull("acme/code-review-kit:1.2.0");

// Pass the project root — skills are written to <root>/.claude/skills/<skill-name>/
const paths = await installClaudeSkills(bundle, process.cwd());

console.log(`Installed ${paths.length} skill file(s):`);
for (const p of paths) {
	console.log(`  ${p}`);
}
