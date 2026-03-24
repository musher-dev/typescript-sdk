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

		this.collectFromCategory(this._bundle.skills(), this._filter.skills, addFile);
		this.collectFromCategory(this._bundle.prompts(), this._filter.prompts, addFile);
		this.collectFromCategory(this._bundle.toolsets(), this._filter.toolsets, addFile);
		this.collectFromCategory(this._bundle.agentSpecs(), this._filter.agentSpecs, addFile);

		if (this._filter.paths) {
			for (const path of this._filter.paths) {
				const fh = this._bundle.file(path);
				if (fh) {
					addFile(fh);
				}
			}
		}

		return result;
	}

	private collectFromCategory<T extends { name: string; files(): FileHandle[] }>(
		items: T[],
		names: string[] | undefined,
		addFile: (fh: FileHandle) => void,
	): void {
		if (!names) {
			return;
		}
		for (const name of names) {
			const item = items.find((i) => i.name === name);
			if (item) {
				for (const f of item.files()) {
					addFile(f);
				}
			}
		}
	}

	skills(): SkillHandle[] {
		const names = this._filter.skills;
		if (!names) {
			return [];
		}
		return this._bundle.skills().filter((s) => names.includes(s.name));
	}

	prompts(): PromptHandle[] {
		const names = this._filter.prompts;
		if (!names) {
			return [];
		}
		return this._bundle.prompts().filter((p) => names.includes(p.name));
	}

	toolsets(): ToolsetHandle[] {
		const names = this._filter.toolsets;
		if (!names) {
			return [];
		}
		return this._bundle.toolsets().filter((t) => names.includes(t.name));
	}

	agentSpecs(): AgentSpecHandle[] {
		const names = this._filter.agentSpecs;
		if (!names) {
			return [];
		}
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
		description?: string;
	}): Promise<string> {
		const { exportClaudePlugin } = await import("./adapters/claude.js");
		return exportClaudePlugin(this, opts);
	}

	async installClaudeSkills(dir: string, opts?: { prefix?: string }): Promise<string[]> {
		const { installClaudeSkills } = await import("./adapters/claude.js");
		return installClaudeSkills(this, dir, opts);
	}

	async installVSCodeSkills(dir: string, opts?: { subdir?: string }): Promise<string[]> {
		const { installVSCodeSkills } = await import("./adapters/vscode.js");
		return installVSCodeSkills(this, dir, opts);
	}
}
