/**
 * Filter a bundle to a subset and write it to disk.
 *
 * `bundle.select()` creates a lazy filtered view (Selection) that
 * includes only the named assets. `selection.materialize()` writes
 * those files to a target directory preserving logical paths.
 *
 * Prerequisites:
 *   export MUSHER_API_KEY="mush_..."
 *
 * Run:
 *   npx tsx examples/basics/select-and-materialize.ts
 */

import { pull } from "@musher-dev/musher-sdk";

const bundle = await pull("musher-examples/agent-toolkit:2.0.0");

// Select a subset: one skill, one prompt, and one toolset
const selection = bundle.select({
	skills: ["explaining-architecture"],
	prompts: ["system"],
	toolsets: ["default-tools"],
});

console.log("Selected files:");
for (const file of selection.files()) {
	console.log(`  ${file.logicalPath}  (${file.assetType})`);
}

console.log(
	`\nSkills in selection: ${selection
		.skills()
		.map((s) => s.name)
		.join(", ")}`,
);
console.log(
	`Prompts in selection: ${selection
		.prompts()
		.map((p) => p.name)
		.join(", ")}`,
);
console.log(
	`Toolsets in selection: ${selection
		.toolsets()
		.map((t) => t.name)
		.join(", ")}`,
);

// Write the selected files to disk
const written = await selection.materialize("./agent-toolkit-subset");
console.log(`\nMaterialized ${written.length} file(s) to ./agent-toolkit-subset/`);
for (const path of written) {
	console.log(`  ${path}`);
}
