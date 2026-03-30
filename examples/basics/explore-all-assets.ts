/**
 * Explore every asset type in a bundle.
 *
 * The `musher-examples/agent-toolkit` bundle contains skills, prompts,
 * toolsets, agent specs, configs, and rules — ideal for learning how
 * to enumerate and inspect all asset types via the SDK.
 *
 * Prerequisites:
 *   export MUSHER_API_KEY="mush_..."
 *
 * Run:
 *   npx tsx examples/basics/explore-all-assets.ts
 */

import { pull } from "@musher-dev/musher-sdk";

const bundle = await pull("musher-examples/agent-toolkit:2.0.0");

// --- Skills ---
console.log("Skills:");
for (const skill of bundle.skills()) {
	const meta = skill.metadata();
	console.log(`  ${skill.name} — ${meta?.description ?? "(no description)"}`);
	console.log(`    files: ${skill.files().length}`);
}

// --- Prompts ---
console.log("\nPrompts:");
for (const prompt of bundle.prompts()) {
	console.log(`  ${prompt.name} (${prompt.file().sizeBytes} bytes)`);
}

// --- Toolsets ---
console.log("\nToolsets:");
for (const toolset of bundle.toolsets()) {
	const parsed = JSON.parse(toolset.content());
	console.log(`  ${toolset.name} — ${parsed.description ?? ""}`);
}

// --- Agent Specs ---
console.log("\nAgent Specs:");
for (const spec of bundle.agentSpecs()) {
	const parsed = JSON.parse(spec.content());
	console.log(`  ${spec.name} — model: ${parsed.model}, skills: [${parsed.skills?.join(", ")}]`);
}

// Access a specific toolset by name
const defaultTools = bundle.toolset("default-tools");
console.log(`\nToolset "default-tools" content:\n${defaultTools.content()}`);
