/**
 * ToolsetHandle — wraps a single tool_config asset.
 */

import type { FileHandle } from "./file-handle.js";

export class ToolsetHandle {
	readonly name: string;
	private readonly _file: FileHandle;

	constructor(name: string, file: FileHandle) {
		this.name = name;
		this._file = file;
	}

	/** All files belonging to this toolset (single file). */
	files(): FileHandle[] {
		return [this._file];
	}

	/** The toolset content as text. */
	content(): string {
		return this._file.text();
	}

	/** The underlying file handle. */
	file(): FileHandle {
		return this._file;
	}
}
