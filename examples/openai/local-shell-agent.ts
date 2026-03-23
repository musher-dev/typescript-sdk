/**
 * End-to-end: create an OpenAI agent with a Musher-exported local skill.
 *
 * This example pulls a bundle, exports a skill to a local directory, then
 * creates an Agent that mounts the skill via shellTool with a local
 * environment.
 *
 * Prerequisites:
 *   export MUSHER_API_KEY="mush_..."
 *   export OPENAI_API_KEY="sk-..."
 *   npm install @openai/agents   # or pnpm add @openai/agents
 *
 * Run:
 *   npx tsx examples/openai/local-shell-agent.ts
 */

import { exportOpenAILocalSkill, pull } from "@musher-dev/musher-sdk";
import { Agent, run, shellTool } from "@openai/agents";

const bundle = await pull("acme/code-review-kit:1.2.0");
const skill = bundle.skill("lint-rules");
const exported = await exportOpenAILocalSkill(skill, "./openai-skills");

console.log(`Exported local skill "${exported.name}" → ${exported.path}`);

const agent = new Agent({
	name: "Code Reviewer",
	instructions: "You review code using the provided skill.",
	tools: [
		shellTool({
			name: exported.name,
			description: exported.description,
			shell: "bash",
			environment: {
				type: "local",
				skills: [{ name: exported.name, description: exported.description, path: exported.path }],
			},
		}),
	],
});

const result = await run(agent, "Review the code in ./src");
console.log(result.finalOutput);
