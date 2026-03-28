/**
 * End-to-end: create an OpenAI agent with an inline skill in container_auto.
 *
 * This example exports a skill as a base64 ZIP and passes it into shellTool
 * with a container_auto environment, matching the official ShellToolInlineSkill
 * shape from @openai/agents.
 *
 * Prerequisites:
 *   export MUSHER_API_KEY="mush_..."
 *   export OPENAI_API_KEY="sk-..."
 *   npm install @openai/agents   # or pnpm add @openai/agents
 *
 * Run:
 *   npx tsx examples/openai/container-inline-agent.ts
 */

import { exportOpenAIInlineSkill, pull } from "@musher-dev/musher-sdk";
import { Agent, run, shellTool } from "@openai/agents";

const bundle = await pull("musher-examples/code-review-kit:1.2.0");
const inline = exportOpenAIInlineSkill(bundle.skill("reviewing-pull-requests"));

console.log(`Exported inline skill "${inline.name}" (${inline.source.data.length} base64 chars)`);

const agent = new Agent({
	name: "Containerized Reviewer",
	instructions: "You review code using the provided skill inside a sandboxed container.",
	tools: [
		shellTool({
			name: inline.name,
			description: inline.description,
			shell: "bash",
			environment: {
				type: "container_auto",
				skills: [inline],
			},
		}),
	],
});

const result = await run(agent, "Review the code");
console.log(result.finalOutput);
