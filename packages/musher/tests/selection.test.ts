import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Bundle } from "../src/bundle.js";
import { Selection } from "../src/selection.js";
import type { BundleResolveOutput } from "../src/types.js";

function sha(text: string): string {
	return createHash("sha256").update(text).digest("hex");
}

const SKILL_A = "# Skill A";
const SKILL_B = "# Skill B";
const PROMPT = "You are helpful.";

function makeManifest(): BundleResolveOutput {
	return {
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
					logicalPath: "skills/alpha/SKILL.md",
					assetType: "skill",
					contentSha256: sha(SKILL_A),
					sizeBytes: SKILL_A.length,
				},
				{
					assetId: "a2",
					logicalPath: "skills/beta/SKILL.md",
					assetType: "skill",
					contentSha256: sha(SKILL_B),
					sizeBytes: SKILL_B.length,
				},
				{
					assetId: "a3",
					logicalPath: "prompts/main.md",
					assetType: "prompt",
					contentSha256: sha(PROMPT),
					sizeBytes: PROMPT.length,
				},
			],
		},
	};
}

function makeContents(): Map<string, Buffer> {
	return new Map([
		["skills/alpha/SKILL.md", Buffer.from(SKILL_A)],
		["skills/beta/SKILL.md", Buffer.from(SKILL_B)],
		["prompts/main.md", Buffer.from(PROMPT)],
	]);
}

describe("Selection", () => {
	it("filters by skill name", () => {
		const bundle = new Bundle(makeManifest(), makeContents());
		const sel = new Selection(bundle, { skills: ["alpha"] });
		expect(sel.files()).toHaveLength(1);
		expect(sel.skills()).toHaveLength(1);
		expect(sel.skills()[0]!.name).toBe("alpha");
	});

	it("filters by prompt name", () => {
		const bundle = new Bundle(makeManifest(), makeContents());
		const sel = new Selection(bundle, { prompts: ["main"] });
		expect(sel.files()).toHaveLength(1);
		expect(sel.prompts()).toHaveLength(1);
	});

	it("filters by path", () => {
		const bundle = new Bundle(makeManifest(), makeContents());
		const sel = new Selection(bundle, { paths: ["prompts/main.md"] });
		expect(sel.files()).toHaveLength(1);
	});

	it("combines multiple filters", () => {
		const bundle = new Bundle(makeManifest(), makeContents());
		const sel = new Selection(bundle, {
			skills: ["alpha"],
			prompts: ["main"],
		});
		expect(sel.files()).toHaveLength(2);
	});

	it("deduplicates files across filter types", () => {
		const bundle = new Bundle(makeManifest(), makeContents());
		const sel = new Selection(bundle, {
			skills: ["alpha"],
			paths: ["skills/alpha/SKILL.md"],
		});
		expect(sel.files()).toHaveLength(1);
	});

	it("returns empty for non-matching filters", () => {
		const bundle = new Bundle(makeManifest(), makeContents());
		const sel = new Selection(bundle, { skills: ["nonexistent"] });
		expect(sel.files()).toHaveLength(0);
		expect(sel.skills()).toHaveLength(0);
	});

	describe("materialize", () => {
		let tempDir: string;

		beforeEach(async () => {
			tempDir = await mkdtemp(join(tmpdir(), "musher-sel-test-"));
		});

		afterEach(async () => {
			await rm(tempDir, { recursive: true, force: true });
		});

		it("writes selected files to target dir", async () => {
			const bundle = new Bundle(makeManifest(), makeContents());
			const sel = new Selection(bundle, { skills: ["alpha"] });
			const written = await sel.materialize(tempDir);

			expect(written).toHaveLength(1);
			const content = await readFile(written[0]!, "utf-8");
			expect(content).toBe(SKILL_A);
		});
	});
});
