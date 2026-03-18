/**
 * VS Code / IDE adapter — install skill directories.
 */

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { Bundle } from "../bundle.js";
import type { Selection } from "../selection.js";

/**
 * Install skills from a bundle into an IDE skill tree directory.
 * Default subdir is ".agents/skills".
 * Mode is always "copy" (real files, not symlinks).
 * Returns list of written absolute paths.
 */
export async function installVSCodeSkills(
	source: Bundle | Selection,
	dir: string,
	opts?: { subdir?: string },
): Promise<string[]> {
	const bundle = "bundle" in source ? source.bundle : (source as Bundle);
	const subdir = opts?.subdir ?? ".agents/skills";
	const skillsDir = join(dir, subdir);
	const written: string[] = [];

	const skills =
		"skills" in source && typeof source.skills === "function" ? source.skills() : bundle.skills();

	for (const skill of skills) {
		const skillDir = join(skillsDir, skill.name);
		await mkdir(skillDir, { recursive: true });

		for (const fh of skill.files()) {
			const relativePath = fh.logicalPath.replace(/^skills\/[^/]+\//, "");
			const filePath = join(skillDir, relativePath);
			await mkdir(dirname(filePath), { recursive: true });
			await writeFile(filePath, fh.bytes());
			written.push(filePath);
		}
	}

	return written;
}
