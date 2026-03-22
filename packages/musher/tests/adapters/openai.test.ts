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

const SKILL_MD_PLAIN = "# Code Review\nA skill for reviewing code.";
const ABSOLUTE_PATH_RE = /^\//;
const REVIEW_PREFIX_RE = /^review\//;

const SKILL_MD_FRONTMATTER = [
	"---",
	"name: review",
	"description: Reviews code for quality and style issues",
	"---",
	"# Code Review",
	"Body content.",
].join("\n");

function makeSkill(skillMd = SKILL_MD_PLAIN): SkillHandle {
	const defFile = new FileHandle(
		"skills/review/SKILL.md",
		"skill",
		sha(skillMd),
		skillMd.length,
		Buffer.from(skillMd),
		"text/markdown",
	);
	return new SkillHandle("review", [defFile]);
}

/** Extract file names from a STORE-method ZIP buffer. */
function zipFileNames(buf: Buffer): string[] {
	const names: string[] = [];
	let offset = 0;
	while (offset + 30 <= buf.length) {
		const sig = buf.readUInt32LE(offset);
		if (sig !== 0x04034b50) {
			break;
		}
		const nameLen = buf.readUInt16LE(offset + 26);
		const extraLen = buf.readUInt16LE(offset + 28);
		const compressedSize = buf.readUInt32LE(offset + 18);
		const name = buf.subarray(offset + 30, offset + 30 + nameLen).toString("utf-8");
		names.push(name);
		offset += 30 + nameLen + extraLen + compressedSize;
	}
	return names;
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
			expect(content).toBe(SKILL_MD_PLAIN);
		});

		it("prefers frontmatter description over raw text", async () => {
			const skill = makeSkill(SKILL_MD_FRONTMATTER);
			const result = await exportOpenAILocalSkill(skill, tempDir);

			expect(result.description).toBe("Reviews code for quality and style issues");
		});

		it("returns an absolute path", async () => {
			const skill = makeSkill();
			const result = await exportOpenAILocalSkill(skill, tempDir);

			expect(result.path).toMatch(ABSOLUTE_PATH_RE);
		});
	});

	describe("exportOpenAIInlineSkill", () => {
		it("returns the official ShellToolInlineSkill shape", () => {
			const skill = makeSkill();
			const result = exportOpenAIInlineSkill(skill);

			expect(result.type).toBe("inline");
			expect(result.name).toBe("review");
			expect(result.description).toContain("Code Review");
			expect(result.source.type).toBe("base64");
			expect(result.source.mediaType).toBe("application/zip");
			expect(result.source.data).toBeTruthy();
		});

		it("produces a valid ZIP with top-level skill folder", () => {
			const skill = makeSkill();
			const result = exportOpenAIInlineSkill(skill);

			const buf = Buffer.from(result.source.data, "base64");
			// ZIP magic bytes
			expect(buf[0]).toBe(0x50);
			expect(buf[1]).toBe(0x4b);

			const names = zipFileNames(buf);
			expect(names.length).toBeGreaterThan(0);
			for (const name of names) {
				expect(name).toMatch(REVIEW_PREFIX_RE);
			}
		});

		it("prefers frontmatter description over raw text", () => {
			const skill = makeSkill(SKILL_MD_FRONTMATTER);
			const result = exportOpenAIInlineSkill(skill);

			expect(result.description).toBe("Reviews code for quality and style issues");
		});
	});
});
