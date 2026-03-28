/**
 * Pull a bundle and access its contents via typed handles.
 *
 * Prerequisites:
 *   export MUSHER_API_KEY="mush_..."
 *
 * Run:
 *   npx tsx examples/basics/pull-bundle.ts
 */

import { pull } from "@musher-dev/musher-sdk";

const bundle = await pull("musher-examples/code-review-kit:1.2.0");

// List every file in the bundle
for (const file of bundle.files()) {
	console.log(`${file.logicalPath}  (${file.assetType}, ${file.sizeBytes} bytes)`);
}

// Read a prompt by name
const reviewChecklist = bundle.prompt("review-checklist");
console.log("\n--- review checklist ---");
console.log(reviewChecklist.content());

// Access a skill
const skill = bundle.skill("reviewing-pull-requests");
console.log(`\nSkill "${skill.name}" has ${skill.files().length} file(s)`);

// Raw file access by path
const raw = bundle.file("prompts/severity-guidelines.md");
if (raw) {
	console.log(`\nRaw file text length: ${raw.text().length}`);
}
