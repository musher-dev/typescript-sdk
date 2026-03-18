import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { exportOpenAIInlineSkill, exportOpenAILocalSkill } from "../../src/adapters/openai.js";
import { FileHandle } from "../../src/handles/file-handle.js";
import { SkillHandle } from "../../src/handles/skill-handle.js";

function sha(text: string): string {
	return createHash("sha256").update(text).digest("hex");
}

const SKILL_MD = "# Code Review\nA skill for reviewing code.";

function makeSkill(): SkillHandle {
	const defFile = new FileHandle(
		"skills/review/SKILL.md",
		"skill",
		sha(SKILL_MD),
		SKILL_MD.length,
		Buffer.from(SKILL_MD),
		"text/markdown",
	);
	return new SkillHandle("review", [defFile]);
}

describe("OpenAI adapter", () => {
	describe("exportOpenAILocalSkill", () => {
		let tempDir: string;

		beforeEach(async () => {
			tempDir = await mkdtemp(join(tmpdir(), "musher-openai-test-"));
		});

		afterEach(async () => {
			await rm(tempDir, { recursive: true, force: true });
		});

		it("writes skill files and returns metadata", async () => {
			const skill = makeSkill();
			const result = await exportOpenAILocalSkill(skill, tempDir);

			expect(result.name).toBe("review");
			expect(result.description).toContain("Code Review");
			expect(result.path).toContain("review");

			const content = await readFile(join(result.path, "SKILL.md"), "utf-8");
			expect(content).toBe(SKILL_MD);
		});
	});

	describe("exportOpenAIInlineSkill", () => {
		it("returns base64 zip content", () => {
			const skill = makeSkill();
			const result = exportOpenAIInlineSkill(skill);

			expect(result.name).toBe("review");
			expect(result.description).toContain("Code Review");
			expect(result.content).toBeTruthy();

			// Verify it's valid base64
			const buf = Buffer.from(result.content, "base64");
			// ZIP files start with PK (0x504b)
			expect(buf[0]).toBe(0x50);
			expect(buf[1]).toBe(0x4b);
		});
	});
});
