/**
 * Export a skill as an inline base64 ZIP for OpenAI hosted agents.
 *
 * The adapter returns the official ShellToolInlineSkill shape expected
 * by `@openai/agents`. The result can be passed directly to `shellTool()`.
 *
 * Prerequisites:
 *   export MUSHER_API_KEY="mush_..."
 *
 * Run:
 *   npx tsx examples/openai/hosted-inline-skill.ts
 */

import { exportOpenAIInlineSkill, pull } from "@musher-dev/musher-sdk";

const bundle = await pull("acme/code-review-kit:1.2.0");
const skill = bundle.skill("lint-rules");

const inline = exportOpenAIInlineSkill(skill);

console.log("Exported inline skill:");
console.log(`  type:      ${inline.type}`);
console.log(`  name:      ${inline.name}`);
console.log(`  description: ${inline.description}`);
console.log(`  mediaType: ${inline.source.mediaType}`);
console.log(
	`  data:      ${inline.source.data.slice(0, 40)}... (base64 ZIP, ${inline.source.data.length} chars)`,
);
