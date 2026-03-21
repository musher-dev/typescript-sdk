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

const bundle = await pull("acme/code-review-kit:1.2.0");

// List every file in the bundle
for (const file of bundle.files()) {
	console.log(`${file.logicalPath}  (${file.assetType}, ${file.sizeBytes} bytes)`);
}

// Read a prompt by name
const systemPrompt = bundle.prompt("system");
console.log("\n--- system prompt ---");
console.log(systemPrompt.content());

// Access a skill
const skill = bundle.skill("lint-rules");
console.log(`\nSkill "${skill.name}" has ${skill.files().length} file(s)`);

// Raw file access by path
const raw = bundle.file("prompts/system.md");
if (raw) {
	console.log(`\nRaw file text length: ${raw.text().length}`);
}
