/**
 * Install bundle skills into a VS Code / IDE skill tree.
 *
 * Pass the **project root** — the adapter appends the subdir
 * (default: `.agents/skills`). VS Code also recognizes
 * `.github/skills/` and `.claude/skills/`.
 *
 * Prerequisites:
 *   export MUSHER_API_KEY="mush_..."
 *
 * Run:
 *   npx tsx examples/ide/install-vscode-skills.ts
 */

import { installVSCodeSkills, pull } from "@musher-dev/musher-sdk";

const bundle = await pull("acme/code-review-kit:1.2.0");

// Explicitly pass the subdir for clarity (this is the default)
const paths = await installVSCodeSkills(bundle, process.cwd(), {
	subdir: ".agents/skills",
});

console.log(`Installed ${paths.length} skill file(s):`);
for (const p of paths) {
	console.log(`  ${p}`);
}
