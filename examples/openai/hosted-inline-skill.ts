/**
 * PREVIEW — Export a skill as an inline base64 ZIP for OpenAI hosted agents.
 *
 * This adapter returns `{ name, description, content }` where `content`
 * is a base64-encoded STORE-method ZIP. OpenAI's Responses API may expect
 * `{ type: "inline", name, description, source: { type: "base64",
 * media_type: "application/zip", data } }`. The output shape may change
 * in a future SDK release to match the official format.
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
console.log(`  name:        ${inline.name}`);
console.log(`  description: ${inline.description}`);
console.log(
	`  content:     ${inline.content.slice(0, 40)}... (base64 ZIP, ${inline.content.length} chars)`,
);
