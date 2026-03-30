import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Bundle } from "../src/bundle.js";
import { BundleAssetNotFoundError } from "../src/errors.js";
import type { BundleResolveOutput } from "../src/types.js";

function sha(text: string): string {
	return createHash("sha256").update(text).digest("hex");
}

const SKILL_CONTENT = "# My Skill";
const PROMPT_CONTENT = "You are a helpful assistant.";
const TOOL_CONTENT = '{"tools": []}';
const AGENT_CONTENT = "name: my-agent";
const REF_CONTENT = "Reference file";

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
					assetId: "asset-001",
					logicalPath: "skills/review/SKILL.md",
					assetType: "skill",
					contentSha256: sha(SKILL_CONTENT),
					sizeBytes: SKILL_CONTENT.length,
				},
				{
					assetId: "asset-002",
					logicalPath: "skills/review/refs/notes.md",
					assetType: "skill",
					contentSha256: sha(REF_CONTENT),
					sizeBytes: REF_CONTENT.length,
				},
				{
					assetId: "asset-003",
					logicalPath: "prompts/system.md",
					assetType: "prompt",
					contentSha256: sha(PROMPT_CONTENT),
					sizeBytes: PROMPT_CONTENT.length,
					mediaType: "text/markdown",
				},
				{
					assetId: "asset-004",
					logicalPath: "config/tools.json",
					assetType: "tool_config",
					contentSha256: sha(TOOL_CONTENT),
					sizeBytes: TOOL_CONTENT.length,
					mediaType: "application/json",
				},
				{
					assetId: "asset-005",
					logicalPath: "agents/main.yaml",
					assetType: "agent_definition",
					contentSha256: sha(AGENT_CONTENT),
					sizeBytes: AGENT_CONTENT.length,
				},
			],
		},
	};
}

function makeContents(): Map<string, Buffer> {
	return new Map([
		["skills/review/SKILL.md", Buffer.from(SKILL_CONTENT)],
		["skills/review/refs/notes.md", Buffer.from(REF_CONTENT)],
		["prompts/system.md", Buffer.from(PROMPT_CONTENT)],
		["config/tools.json", Buffer.from(TOOL_CONTENT)],
		["agents/main.yaml", Buffer.from(AGENT_CONTENT)],
	]);
}

describe("Bundle", () => {
	it("constructs from metadata and contents", () => {
		const bundle = new Bundle(makeManifest(), makeContents());
		expect(bundle.ref.toString()).toBe("acme/test-bundle");
		expect(bundle.version).toBe("1.0.0");
	});

	it("file() and files()", () => {
		const bundle = new Bundle(makeManifest(), makeContents());
		expect(bundle.files()).toHaveLength(5);
		expect(bundle.file("prompts/system.md")?.text()).toBe(PROMPT_CONTENT);
		expect(bundle.file("nonexistent")).toBeUndefined();
	});

	it("groups skills correctly", () => {
		const bundle = new Bundle(makeManifest(), makeContents());
		const skills = bundle.skills();
		expect(skills).toHaveLength(1);
		expect(skills[0]?.name).toBe("review");
		expect(skills[0]?.files()).toHaveLength(2);
		expect(skills[0]?.definition()?.text()).toBe(SKILL_CONTENT);
	});

	it("skill() accessor", () => {
		const bundle = new Bundle(makeManifest(), makeContents());
		expect(bundle.skill("review").name).toBe("review");
		expect(() => bundle.skill("nonexistent")).toThrow(BundleAssetNotFoundError);
	});

	it("groups prompts correctly", () => {
		const bundle = new Bundle(makeManifest(), makeContents());
		expect(bundle.prompts()).toHaveLength(1);
		expect(bundle.prompt("system").content()).toBe(PROMPT_CONTENT);
	});

	it("groups toolsets correctly", () => {
		const bundle = new Bundle(makeManifest(), makeContents());
		expect(bundle.toolsets()).toHaveLength(1);
		expect(bundle.toolset("tools").content()).toBe(TOOL_CONTENT);
	});

	it("groups agent specs correctly", () => {
		const bundle = new Bundle(makeManifest(), makeContents());
		expect(bundle.agentSpecs()).toHaveLength(1);
		expect(bundle.agentSpec("main").content()).toBe(AGENT_CONTENT);
	});

	it("verify() passes with correct content", () => {
		const bundle = new Bundle(makeManifest(), makeContents());
		const result = bundle.verify();
		expect(result.ok).toBe(true);
		expect(result.errors).toHaveLength(0);
	});

	it("verify() detects corruption", () => {
		const contents = makeContents();
		contents.set("prompts/system.md", Buffer.from("CORRUPTED"));
		const bundle = new Bundle(makeManifest(), contents);
		const result = bundle.verify();
		expect(result.ok).toBe(false);
		expect(result.errors).toHaveLength(1);
		expect(result.errors[0]?.path).toBe("prompts/system.md");
	});

	describe("writeLockfile", () => {
		let tempDir: string;

		beforeEach(async () => {
			tempDir = await mkdtemp(join(tmpdir(), "musher-lock-test-"));
		});

		afterEach(async () => {
			await rm(tempDir, { recursive: true, force: true });
		});

		it("writes a lockfile", async () => {
			const bundle = new Bundle(makeManifest(), makeContents());
			const lockPath = join(tempDir, "musher.lock");
			await bundle.writeLockfile(lockPath);

			const raw = await readFile(lockPath, "utf-8");
			const lock = JSON.parse(raw);
			expect(lock.ref).toBe("acme/test-bundle");
			expect(lock.version).toBe("1.0.0");
			expect(lock.files).toHaveLength(5);
		});
	});

	it("select() returns a Selection", () => {
		const bundle = new Bundle(makeManifest(), makeContents());
		const selection = bundle.select({ skills: ["review"] });
		expect(selection.files()).toHaveLength(2);
		expect(selection.skills()).toHaveLength(1);
	});
});
