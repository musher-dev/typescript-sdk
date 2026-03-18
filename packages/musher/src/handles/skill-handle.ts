/**
 * SkillHandle — groups files belonging to a single skill directory.
 */

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
}
