import { describe, expect, it } from "vitest";
import { parseFrontmatter } from "../src/frontmatter.js";

describe("parseFrontmatter", () => {
	it("returns full text as body when no frontmatter is present", () => {
		const text = "# My Skill\nDoes something useful.";
		const result = parseFrontmatter(text);
		expect(result.name).toBeUndefined();
		expect(result.description).toBeUndefined();
		expect(result.body).toBe(text);
	});

	it("extracts name and description from frontmatter", () => {
		const text = [
			"---",
			"name: lint-rules",
			"description: A skill for linting code",
			"---",
			"# Lint Rules",
			"Body content here.",
		].join("\n");
		const result = parseFrontmatter(text);
		expect(result.name).toBe("lint-rules");
		expect(result.description).toBe("A skill for linting code");
		expect(result.body).toBe("# Lint Rules\nBody content here.");
	});

	it("handles double-quoted values", () => {
		const text = '---\nname: "my-skill"\ndescription: "A quoted description"\n---\nBody';
		const result = parseFrontmatter(text);
		expect(result.name).toBe("my-skill");
		expect(result.description).toBe("A quoted description");
	});

	it("handles single-quoted values", () => {
		const text = "---\nname: 'my-skill'\ndescription: 'Single quoted'\n---\nBody";
		const result = parseFrontmatter(text);
		expect(result.name).toBe("my-skill");
		expect(result.description).toBe("Single quoted");
	});

	it("ignores extra fields gracefully", () => {
		const text = "---\nname: foo\nversion: 1.0\nauthor: someone\ndescription: bar\n---\nBody";
		const result = parseFrontmatter(text);
		expect(result.name).toBe("foo");
		expect(result.description).toBe("bar");
		expect(result.body).toBe("Body");
	});

	it("handles empty frontmatter block", () => {
		const text = "---\n---\nBody content";
		const result = parseFrontmatter(text);
		expect(result.name).toBeUndefined();
		expect(result.description).toBeUndefined();
		expect(result.body).toBe("Body content");
	});

	it("handles frontmatter with only name", () => {
		const text = "---\nname: solo\n---\nRest";
		const result = parseFrontmatter(text);
		expect(result.name).toBe("solo");
		expect(result.description).toBeUndefined();
		expect(result.body).toBe("Rest");
	});
});
