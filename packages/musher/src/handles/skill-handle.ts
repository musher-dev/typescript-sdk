/**
 * SkillHandle — groups files belonging to a single skill directory.
 */

import type { FrontmatterResult } from "../frontmatter.js";
import { parseFrontmatter } from "../frontmatter.js";
import type { FileHandle } from "./file-handle.js";

export class SkillHandle {
	readonly name: string;
	private readonly _files: FileHandle[];

	constructor(name: string, files: FileHandle[]) {
		this.name = name;
		this._files = files;
	}

	/** All files belonging to this skill. */
	files(): FileHandle[] {
		return [...this._files];
	}

	/** The SKILL.md definition file, if present. */
	definition(): FileHandle | undefined {
		return this._files.find(
			(f) =>
				f.logicalPath.toLowerCase().endsWith("/skill.md") ||
				f.logicalPath.toLowerCase() === "skill.md",
		);
	}

	/** Parsed frontmatter from SKILL.md, if present. */
	metadata(): FrontmatterResult | undefined {
		const def = this.definition();
		if (!def) {
			return undefined;
		}
		return parseFrontmatter(def.text());
	}

	/** Export as an OpenAI local skill directory. */
	async exportOpenAILocal(
		targetDir: string,
	): Promise<import("../adapters/openai.js").OpenAILocalSkill> {
		const { exportOpenAILocalSkill } = await import("../adapters/openai.js");
		return exportOpenAILocalSkill(this, targetDir);
	}

	/** Export as an OpenAI inline base64 ZIP skill. */
	async exportOpenAIInline(): Promise<import("../adapters/openai.js").OpenAIInlineSkill> {
		const { exportOpenAIInlineSkill } = await import("../adapters/openai.js");
		return exportOpenAIInlineSkill(this);
	}
}
