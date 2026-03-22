/**
 * Minimal YAML frontmatter parser for SKILL.md files.
 *
 * Extracts `name` and `description` from `---` delimited frontmatter.
 * Only handles single-line scalar values (quoted or unquoted).
 */

import type { SkillHandle } from "./handles/skill-handle.js";

export interface FrontmatterResult {
	name?: string | undefined;
	description?: string | undefined;
	body: string;
}

const FRONTMATTER_RE = /^---[ \t]*\n([\s\S]*?)---[ \t]*\n?([\s\S]*)$/;
const FIELD_RE = /^(name|description)\s*:\s*(.+)$/;

/**
 * Parse YAML frontmatter from a markdown string.
 * Returns extracted `name` and `description` fields plus the remaining body.
 */
export function parseFrontmatter(text: string): FrontmatterResult {
	const match = FRONTMATTER_RE.exec(text);
	if (!match) {
		return { body: text };
	}

	const raw = match[1] as string;
	const body = match[2] as string;
	let name: string | undefined;
	let description: string | undefined;

	for (const line of raw.split("\n")) {
		const fm = FIELD_RE.exec(line.trim());
		if (!fm) {
			continue;
		}
		const value = stripQuotes((fm[2] as string).trim());
		if (fm[1] === "name") {
			name = value;
		} else if (fm[1] === "description") {
			description = value;
		}
	}

	return { name, description, body };
}

/** Strip matching single or double quotes from a value. */
function stripQuotes(s: string): string {
	if (s.length >= 2) {
		const first = s[0];
		const last = s[s.length - 1];
		if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
			return s.slice(1, -1);
		}
	}
	return s;
}

/**
 * Extract a description string from a skill, preferring frontmatter metadata.
 */
export function extractDescription(skill: SkillHandle): string {
	const def = skill.definition();
	if (!def) {
		return `Skill: ${skill.name}`;
	}

	const text = def.text();
	const fm = parseFrontmatter(text);

	if (fm.description) {
		return fm.description;
	}

	// Fall back to first 200 chars of raw text
	return text.slice(0, 200).replace(/\n/g, " ").trim() || `Skill: ${skill.name}`;
}
