/**
 * Bundle — high-level object returned by pull().
 *
 * Groups files into domain handles (skills, prompts, toolsets, agent specs)
 * by reading assetType + parsing logical path conventions from manifest layers.
 */

import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { BundleAssetNotFoundError } from "./errors.js";
import {
	AgentSpecHandle,
	FileHandle,
	PromptHandle,
	SkillHandle,
	ToolsetHandle,
} from "./handles/index.js";
import { BundleRef } from "./ref.js";
import { Selection } from "./selection.js";
import type { BundleResolveOutput, SelectionFilter, VerifyResult } from "./types.js";

export class Bundle {
	readonly ref: BundleRef;
	readonly version: string;
	readonly metadata: BundleResolveOutput;

	private readonly _files: Map<string, FileHandle>;
	private readonly _skills: Map<string, SkillHandle>;
	private readonly _prompts: Map<string, PromptHandle>;
	private readonly _toolsets: Map<string, ToolsetHandle>;
	private readonly _agentSpecs: Map<string, AgentSpecHandle>;

	constructor(metadata: BundleResolveOutput, contents: Map<string, Buffer>) {
		this.metadata = metadata;
		this.version = metadata.version;
		this.ref = BundleRef.parse(metadata.ref);

		// Build FileHandle map from manifest layers + content buffers
		this._files = new Map();
		if (metadata.manifest?.layers) {
			for (const layer of metadata.manifest.layers) {
				const buf = contents.get(layer.logicalPath);
				if (buf) {
					const fh = new FileHandle(
						layer.logicalPath,
						layer.assetType,
						layer.contentSha256,
						layer.sizeBytes,
						buf,
						layer.mediaType ?? undefined,
					);
					this._files.set(layer.logicalPath, fh);
				}
			}
		}

		// Group into domain handles
		this._skills = new Map();
		this._prompts = new Map();
		this._toolsets = new Map();
		this._agentSpecs = new Map();

		const skillGroups = new Map<string, FileHandle[]>();

		for (const fh of this._files.values()) {
			switch (fh.assetType) {
				case "skill": {
					// Group by first directory segment under skills/ prefix
					const skillName = extractSkillName(fh.logicalPath);
					if (skillName) {
						let group = skillGroups.get(skillName);
						if (!group) {
							group = [];
							skillGroups.set(skillName, group);
						}
						group.push(fh);
					}
					break;
				}
				case "prompt": {
					const name = baseFileName(fh.logicalPath);
					this._prompts.set(name, new PromptHandle(name, fh));
					break;
				}
				case "tool_config": {
					const name = baseFileName(fh.logicalPath);
					this._toolsets.set(name, new ToolsetHandle(name, fh));
					break;
				}
				case "agent_definition": {
					const name = baseFileName(fh.logicalPath);
					this._agentSpecs.set(name, new AgentSpecHandle(name, fh));
					break;
				}
			}
		}

		for (const [name, files] of skillGroups) {
			this._skills.set(name, new SkillHandle(name, files));
		}
	}

	// -- File access --

	file(path: string): FileHandle | undefined {
		return this._files.get(path);
	}

	files(): FileHandle[] {
		return [...this._files.values()];
	}

	// -- Domain handles --

	skills(): SkillHandle[] {
		return [...this._skills.values()];
	}

	skill(name: string): SkillHandle {
		const h = this._skills.get(name);
		if (!h) {
			throw new BundleAssetNotFoundError("Skill", name);
		}
		return h;
	}

	prompts(): PromptHandle[] {
		return [...this._prompts.values()];
	}

	prompt(name: string): PromptHandle {
		const h = this._prompts.get(name);
		if (!h) {
			throw new BundleAssetNotFoundError("Prompt", name);
		}
		return h;
	}

	toolsets(): ToolsetHandle[] {
		return [...this._toolsets.values()];
	}

	toolset(name: string): ToolsetHandle {
		const h = this._toolsets.get(name);
		if (!h) {
			throw new BundleAssetNotFoundError("Toolset", name);
		}
		return h;
	}

	agentSpecs(): AgentSpecHandle[] {
		return [...this._agentSpecs.values()];
	}

	agentSpec(name: string): AgentSpecHandle {
		const h = this._agentSpecs.get(name);
		if (!h) {
			throw new BundleAssetNotFoundError("AgentSpec", name);
		}
		return h;
	}

	// -- Filtering --

	select(filter: SelectionFilter): Selection {
		return new Selection(this, filter);
	}

	// -- Integrity --

	verify(): VerifyResult {
		const errors: Array<{ path: string; expected: string; actual: string }> = [];

		for (const fh of this._files.values()) {
			const actual = createHash("sha256").update(fh.bytes()).digest("hex");
			if (actual !== fh.sha256) {
				errors.push({ path: fh.logicalPath, expected: fh.sha256, actual });
			}
		}

		return { ok: errors.length === 0, errors };
	}

	// -- Lockfile --

	async writeLockfile(path: string): Promise<void> {
		const lock = {
			ref: this.ref.toString(),
			version: this.version,
			files: [...this._files.values()].map((f) => ({
				logicalPath: f.logicalPath,
				sha256: f.sha256,
				sizeBytes: f.sizeBytes,
			})),
		};
		await mkdir(dirname(path), { recursive: true });
		await writeFile(path, JSON.stringify(lock, null, 2));
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

/** Extract skill name from logical path: "skills/foo/SKILL.md" → "foo" */
function extractSkillName(logicalPath: string): string | undefined {
	if (!logicalPath.startsWith("skills/")) {
		return undefined;
	}
	const rest = logicalPath.slice("skills/".length);
	const slashIdx = rest.indexOf("/");
	if (slashIdx === -1) {
		return undefined;
	}
	const name = rest.slice(0, slashIdx);
	return name || undefined;
}

/** Extract a base file name from a logical path for use as handle name. */
function baseFileName(logicalPath: string): string {
	const parts = logicalPath.split("/");
	const last = parts[parts.length - 1] ?? logicalPath;
	// Strip extension
	const dotIdx = last.lastIndexOf(".");
	return dotIdx > 0 ? last.slice(0, dotIdx) : last;
}
