/**
 * Export a single skill as a local file directory for OpenAI Agents.
 *
 * Local shell skills are mounted by name, description, and filesystem
 * path. Each skill directory must contain exactly one SKILL.md.
 *
 * Prerequisites:
 *   export MUSHER_API_KEY="mush_..."
 *   export OPENAI_API_KEY="sk-..."   # required if wiring into an agent
 *
 * Run:
 *   npx tsx examples/openai/local-shell-skill.ts
 */

import { exportOpenAILocalSkill, pull } from "@musher-dev/musher-sdk";

const bundle = await pull("musher-examples/code-review-kit:1.2.0");
const skill = bundle.skill("reviewing-pull-requests");

const exported = await exportOpenAILocalSkill(skill, "./openai-skills");

console.log("Exported local skill:");
console.log(`  name:        ${exported.name}`);
console.log(`  description: ${exported.description}`);
console.log(`  path:        ${exported.path}`);
