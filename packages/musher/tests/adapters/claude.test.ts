import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { exportClaudePlugin, installClaudeSkills } from "../../src/adapters/claude.js";
import { Bundle } from "../../src/bundle.js";
import type { BundleResolveOutput } from "../../src/types.js";

function sha(text: string): string {
	return createHash("sha256").update(text).digest("hex");
}

const SKILL_MD = "# Review Skill";
const REF_MD = "Reference content";

function makeBundle(): Bundle {
	const manifest: BundleResolveOutput = {
		bundleId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
		versionId: "f1e2d3c4-b5a6-7890-abcd-ef1234567890",
		namespace: "acme",
		slug: "test-bundle",
		ref: "acme/test-bundle",
		version: "1.0.0",
		sourceType: "registry",
		state: "published",
		manifest: {
			layers: [
				{
					assetId: "a1",
					logicalPath: "skills/review/SKILL.md",
					assetType: "skill",
					contentSha256: sha(SKILL_MD),
					sizeBytes: SKILL_MD.length,
				},
				{
					assetId: "a2",
					logicalPath: "skills/review/refs/notes.md",
					assetType: "skill",
					contentSha256: sha(REF_MD),
					sizeBytes: REF_MD.length,
				},
			],
		},
	};
	return new Bundle(
		manifest,
		new Map([
			["skills/review/SKILL.md", Buffer.from(SKILL_MD)],
			["skills/review/refs/notes.md", Buffer.from(REF_MD)],
		]),
	);
}

describe("Claude adapter", () => {
	let tempDir: string;

	beforeEach(async () => {
		tempDir = await mkdtemp(join(tmpdir(), "musher-claude-test-"));
	});

	afterEach(async () => {
		await rm(tempDir, { recursive: true, force: true });
	});

	it("exportClaudePlugin creates plugin dir", async () => {
		const bundle = makeBundle();
		const pluginDir = await exportClaudePlugin(bundle, { targetDir: tempDir });

		expect(pluginDir).toContain("test-bundle");
		const manifest = JSON.parse(await readFile(join(pluginDir, "manifest.json"), "utf-8"));
		expect(manifest.name).toBe("test-bundle");
		expect(manifest.files).toHaveLength(2);
	});

	it("exportClaudePlugin accepts custom name", async () => {
		const bundle = makeBundle();
		const pluginDir = await exportClaudePlugin(bundle, {
			targetDir: tempDir,
			name: "custom-name",
		});
		expect(pluginDir).toContain("custom-name");
	});

	it("installClaudeSkills writes to .claude/skills/", async () => {
		const bundle = makeBundle();
		const written = await installClaudeSkills(bundle, tempDir);

		expect(written.length).toBeGreaterThan(0);
		const skillContent = await readFile(written[0]!, "utf-8");
		expect(skillContent.length).toBeGreaterThan(0);
	});
});
