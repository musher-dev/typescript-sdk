/**
 * Export a single skill as a local file directory for OpenAI Agents.
 *
 * Local shell skills are mounted by name, description, and filesystem
 * path. Each skill directory must contain exactly one SKILL.md.
 *
 * Prerequisites:
 *   export MUSHER_API_KEY="mush_..."
 *
 * Run:
 *   npx tsx examples/openai/local-shell-skill.ts
 */

import { exportOpenAILocalSkill, pull } from "@musher-dev/musher-sdk";

const bundle = await pull("acme/code-review-kit:1.2.0");
const skill = bundle.skill("lint-rules");

const exported = await exportOpenAILocalSkill(skill, "./openai-skills");

console.log("Exported local skill:");
console.log(`  name:        ${exported.name}`);
console.log(`  description: ${exported.description}`);
console.log(`  path:        ${exported.path}`);
