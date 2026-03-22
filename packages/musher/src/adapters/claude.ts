/**
 * Claude Code adapter — export plugin dirs and install skills to .claude/skills/.
 */

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Bundle } from "../bundle.js";
import type { Selection } from "../selection.js";

/**
 * Export a Claude Code plugin directory structure from a Bundle or Selection.
 *
 * Produces the layout expected by Claude Code's plugin system:
 *
 *   <pluginDir>/.claude-plugin/plugin.json   — plugin metadata
 *   <pluginDir>/skills/<name>/SKILL.md       — skill content
 *
 * Returns the absolute path of the created plugin directory.
 */
export async function exportClaudePlugin(
	source: Bundle | Selection,
	opts: { targetDir: string; name?: string; description?: string },
): Promise<string> {
	const bundle = "bundle" in source ? source.bundle : (source as Bundle);
	const name = opts.name ?? bundle.ref.slug;
	const pluginDir = join(opts.targetDir, name);

	await mkdir(pluginDir, { recursive: true });

	const files = source.files();
	for (const fh of files) {
		const filePath = join(pluginDir, fh.logicalPath);
		await mkdir(join(filePath, ".."), { recursive: true });
		await writeFile(filePath, fh.bytes());
	}

	// Write .claude-plugin/plugin.json (Claude Code plugin metadata)
	const metaDir = join(pluginDir, ".claude-plugin");
	await mkdir(metaDir, { recursive: true });
	const manifest = {
		name,
		description: opts.description ?? "",
		version: bundle.version,
		files: files.map((f) => f.logicalPath),
	};
	await writeFile(join(metaDir, "plugin.json"), JSON.stringify(manifest, null, 2));

	return pluginDir;
}

/**
 * Install skills from a bundle into a .claude/skills/ directory.
 * Returns the list of written absolute paths.
 */
export async function installClaudeSkills(
	bundle: Bundle | Selection,
	dir: string,
	opts?: { prefix?: string },
): Promise<string[]> {
	const source = "bundle" in bundle ? bundle.bundle : (bundle as Bundle);
	const skillsDir = join(dir, ".claude", "skills");
	const prefix = opts?.prefix ?? "";
	const written: string[] = [];

	const skills =
		"skills" in bundle && typeof bundle.skills === "function" ? bundle.skills() : source.skills();

	for (const skill of skills) {
		const skillDir = join(skillsDir, prefix, skill.name);
		await mkdir(skillDir, { recursive: true });

		for (const fh of skill.files()) {
			// Strip the skills/{name}/ prefix from the logical path
			const relativePath = fh.logicalPath.replace(/^skills\/[^/]+\//, "");
			const filePath = join(skillDir, relativePath);
			await mkdir(join(filePath, ".."), { recursive: true });
			await writeFile(filePath, fh.bytes());
			written.push(filePath);
		}
	}

	return written;
}
