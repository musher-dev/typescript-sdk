/**
 * End-to-end: upload a skill to OpenAI and use it as a skill_reference.
 *
 * This example exports a skill as an inline ZIP, uploads it via the OpenAI
 * API to create a reusable skill reference, then shows how to mount it in
 * a container_auto environment.
 *
 * Prerequisites:
 *   export MUSHER_API_KEY="mush_..."
 *   export OPENAI_API_KEY="sk-..."
 *   npm install openai @openai/agents   # or pnpm add openai @openai/agents
 *
 * Run:
 *   npx tsx examples/openai/container-skill-ref.ts
 */

import OpenAI from "openai";
import { exportOpenAIInlineSkill, pull } from "@musher-dev/musher-sdk";

// The skills API is documented in OpenAI's guides but may require a newer
// version of the `openai` package than is currently published.
const client = new OpenAI() as OpenAI & {
	skills: {
		create(params: {
			name: string;
			description: string;
			source: { type: string; mediaType: string; data: string };
		}): Promise<{ id: string; version: string }>;
	};
};

const bundle = await pull("acme/code-review-kit:1.2.0");
const inline = exportOpenAIInlineSkill(bundle.skill("lint-rules"));

// Upload the skill to OpenAI for reuse across agents
const uploaded = await client.skills.create({
	name: inline.name,
	description: inline.description,
	source: inline.source,
});

console.log(`Created skill reference: ${uploaded.id}`);
console.log("Mount it in an agent with:");
console.log(
	`  { type: "skill_reference", skillId: "${uploaded.id}", version: "${uploaded.version}" }`,
);
