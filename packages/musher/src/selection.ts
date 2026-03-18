/**
 * Selection — lazy filtered view over a Bundle.
 */

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import type { Bundle } from "./bundle.js";
import type { AgentSpecHandle } from "./handles/agent-spec-handle.js";
import type { FileHandle } from "./handles/file-handle.js";
import type { PromptHandle } from "./handles/prompt-handle.js";
import type { SkillHandle } from "./handles/skill-handle.js";
import type { ToolsetHandle } from "./handles/toolset-handle.js";
import type { SelectionFilter } from "./types.js";

export class Selection {
	private readonly _bundle: Bundle;
	private readonly _filter: SelectionFilter;

	constructor(bundle: Bundle, filter: SelectionFilter) {
		this._bundle = bundle;
		this._filter = filter;
	}

	/** The underlying bundle. */
	get bundle(): Bundle {
		return this._bundle;
	}

	files(): FileHandle[] {
		const result: FileHandle[] = [];
		const seen = new Set<string>();

		const addFile = (fh: FileHandle) => {
			if (!seen.has(fh.logicalPath)) {
				seen.add(fh.logicalPath);
				result.push(fh);
			}
		};

		if (this._filter.skills) {
			for (const name of this._filter.skills) {
				const skill = this._bundle.skills().find((s) => s.name === name);
				if (skill) {
					for (const f of skill.files()) addFile(f);
				}
			}
		}

		if (this._filter.prompts) {
			for (const name of this._filter.prompts) {
				const prompt = this._bundle.prompts().find((p) => p.name === name);
				if (prompt) {
					for (const f of prompt.files()) addFile(f);
				}
			}
		}

		if (this._filter.toolsets) {
			for (const name of this._filter.toolsets) {
				const toolset = this._bundle.toolsets().find((t) => t.name === name);
				if (toolset) {
					for (const f of toolset.files()) addFile(f);
				}
			}
		}

		if (this._filter.agentSpecs) {
			for (const name of this._filter.agentSpecs) {
				const spec = this._bundle.agentSpecs().find((a) => a.name === name);
				if (spec) {
					for (const f of spec.files()) addFile(f);
				}
			}
		}

		if (this._filter.paths) {
			for (const path of this._filter.paths) {
				const fh = this._bundle.file(path);
				if (fh) addFile(fh);
			}
		}

		return result;
	}

	skills(): SkillHandle[] {
		const names = this._filter.skills;
		if (!names) return [];
		return this._bundle.skills().filter((s) => names.includes(s.name));
	}

	prompts(): PromptHandle[] {
		const names = this._filter.prompts;
		if (!names) return [];
		return this._bundle.prompts().filter((p) => names.includes(p.name));
	}

	toolsets(): ToolsetHandle[] {
		const names = this._filter.toolsets;
		if (!names) return [];
		return this._bundle.toolsets().filter((t) => names.includes(t.name));
	}

	agentSpecs(): AgentSpecHandle[] {
		const names = this._filter.agentSpecs;
		if (!names) return [];
		return this._bundle.agentSpecs().filter((a) => names.includes(a.name));
	}

	/** Write selected files to targetDir preserving logical paths. */
	async materialize(targetDir: string): Promise<string[]> {
		const written: string[] = [];

		for (const fh of this.files()) {
			const absPath = resolve(join(targetDir, fh.logicalPath));
			await mkdir(dirname(absPath), { recursive: true });
			await writeFile(absPath, fh.bytes());
			written.push(absPath);
		}

		return written;
	}

	// -- Export adapter convenience methods --

	async exportClaudePlugin(opts: {
		targetDir: string;
		name?: string;
	}): Promise<string> {
		const { exportClaudePlugin } = await import("./adapters/claude.js");
		return exportClaudePlugin(this, opts);
	}
}
