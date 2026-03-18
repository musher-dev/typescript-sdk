import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { installVSCodeSkills } from "../../src/adapters/vscode.js";
import { Bundle } from "../../src/bundle.js";
import type { BundleResolveOutput } from "../../src/types.js";

function sha(text: string): string {
	return createHash("sha256").update(text).digest("hex");
}

const SKILL_MD = "# Review Skill";

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
			],
		},
	};
	return new Bundle(manifest, new Map([["skills/review/SKILL.md", Buffer.from(SKILL_MD)]]));
}

describe("VS Code adapter", () => {
	let tempDir: string;

	beforeEach(async () => {
		tempDir = await mkdtemp(join(tmpdir(), "musher-vscode-test-"));
	});

	afterEach(async () => {
		await rm(tempDir, { recursive: true, force: true });
	});

	it("installs skills to default .agents/skills/ dir", async () => {
		const bundle = makeBundle();
		const written = await installVSCodeSkills(bundle, tempDir);

		expect(written).toHaveLength(1);
		const content = await readFile(written[0], "utf-8");
		expect(content).toBe(SKILL_MD);
		expect(written[0]).toContain(".agents/skills/review");
	});

	it("accepts custom subdir", async () => {
		const bundle = makeBundle();
		const written = await installVSCodeSkills(bundle, tempDir, {
			subdir: ".github/skills",
		});

		expect(written).toHaveLength(1);
		expect(written[0]).toContain(".github/skills/review");
	});
});
