import { describe, expect, it } from "vitest";
import { FileHandle } from "../src/handles/file-handle.js";
import { PromptHandle } from "../src/handles/prompt-handle.js";
import { SkillHandle } from "../src/handles/skill-handle.js";
import { ToolsetHandle } from "../src/handles/toolset-handle.js";
import { AgentSpecHandle } from "../src/handles/agent-spec-handle.js";

describe("FileHandle", () => {
	const content = Buffer.from("Hello, World!");
	const fh = new FileHandle("hello.txt", "prompt", "abc123", 13, content, "text/plain");

	it("returns text()", () => {
		expect(fh.text()).toBe("Hello, World!");
	});

	it("returns bytes() as Uint8Array", () => {
		const bytes = fh.bytes();
		expect(bytes).toBeInstanceOf(Uint8Array);
		expect(bytes.length).toBe(13);
	});

	it("returns stream()", async () => {
		const stream = fh.stream();
		const reader = stream.getReader();
		const { value, done } = await reader.read();
		expect(done).toBe(false);
		expect(value).toBeInstanceOf(Uint8Array);
		expect(value?.length).toBe(13);

		const { done: done2 } = await reader.read();
		expect(done2).toBe(true);
	});

	it("exposes metadata", () => {
		expect(fh.logicalPath).toBe("hello.txt");
		expect(fh.assetType).toBe("prompt");
		expect(fh.sha256).toBe("abc123");
		expect(fh.mediaType).toBe("text/plain");
		expect(fh.sizeBytes).toBe(13);
	});

	it("handles binary content", () => {
		const binary = Buffer.from([0x00, 0xff, 0x80]);
		const bfh = new FileHandle("bin.dat", "other", "def", 3, binary);
		expect(bfh.bytes().length).toBe(3);
		expect(bfh.mediaType).toBeUndefined();
	});
});

describe("SkillHandle", () => {
	it("groups files and finds definition", () => {
		const defFile = new FileHandle("skills/foo/SKILL.md", "skill", "a", 10, Buffer.from("# Skill"));
		const refFile = new FileHandle("skills/foo/refs/bar.md", "skill", "b", 5, Buffer.from("ref"));
		const skill = new SkillHandle("foo", [defFile, refFile]);

		expect(skill.name).toBe("foo");
		expect(skill.files()).toHaveLength(2);
		expect(skill.definition()).toBe(defFile);
	});

	it("returns undefined when no definition file", () => {
		const file = new FileHandle("skills/bar/data.json", "skill", "c", 3, Buffer.from("{}"));
		const skill = new SkillHandle("bar", [file]);
		expect(skill.definition()).toBeUndefined();
	});
});

describe("PromptHandle", () => {
	it("wraps a single file", () => {
		const fh = new FileHandle("prompts/system.md", "prompt", "x", 5, Buffer.from("hello"));
		const prompt = new PromptHandle("system", fh);

		expect(prompt.name).toBe("system");
		expect(prompt.content()).toBe("hello");
		expect(prompt.files()).toHaveLength(1);
		expect(prompt.file()).toBe(fh);
	});
});

describe("ToolsetHandle", () => {
	it("wraps a single file", () => {
		const fh = new FileHandle("tools.json", "tool_config", "x", 2, Buffer.from("{}"));
		const ts = new ToolsetHandle("tools", fh);

		expect(ts.name).toBe("tools");
		expect(ts.content()).toBe("{}");
		expect(ts.files()).toHaveLength(1);
	});
});

describe("AgentSpecHandle", () => {
	it("wraps a single file", () => {
		const fh = new FileHandle("agent.yaml", "agent_definition", "x", 4, Buffer.from("name"));
		const spec = new AgentSpecHandle("agent", fh);

		expect(spec.name).toBe("agent");
		expect(spec.content()).toBe("name");
		expect(spec.files()).toHaveLength(1);
	});
});
