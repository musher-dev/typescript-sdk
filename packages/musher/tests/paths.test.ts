import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resolveMusherDirs } from "../src/paths.js";

describe("resolveMusherDirs", () => {
	const envBackup: Record<string, string | undefined> = {};
	const envKeys = [
		"MUSHER_HOME",
		"MUSHER_CACHE_HOME",
		"MUSHER_CONFIG_HOME",
		"MUSHER_DATA_HOME",
		"MUSHER_STATE_HOME",
		"MUSHER_RUNTIME_DIR",
		"XDG_CACHE_HOME",
		"XDG_CONFIG_HOME",
		"XDG_DATA_HOME",
		"XDG_STATE_HOME",
		"XDG_RUNTIME_DIR",
		"LOCALAPPDATA",
	];

	let originalPlatform: string;

	beforeEach(() => {
		originalPlatform = process.platform;
		for (const key of envKeys) {
			envBackup[key] = process.env[key];
			delete process.env[key];
		}
	});

	afterEach(() => {
		Object.defineProperty(process, "platform", { value: originalPlatform });
		for (const key of envKeys) {
			if (envBackup[key] !== undefined) {
				process.env[key] = envBackup[key];
			} else {
				delete process.env[key];
			}
		}
	});

	describe("Linux defaults", () => {
		it("uses XDG defaults when XDG vars are not set", () => {
			Object.defineProperty(process, "platform", { value: "linux" });
			const dirs = resolveMusherDirs();
			const home = homedir();

			expect(dirs.cache).toBe(join(home, ".cache", "musher"));
			expect(dirs.config).toBe(join(home, ".config", "musher"));
			expect(dirs.data).toBe(join(home, ".local", "share", "musher"));
			expect(dirs.state).toBe(join(home, ".local", "state", "musher"));
		});

		it("uses XDG env vars when set", () => {
			Object.defineProperty(process, "platform", { value: "linux" });
			process.env["XDG_CACHE_HOME"] = "/custom/cache";
			process.env["XDG_CONFIG_HOME"] = "/custom/config";
			process.env["XDG_DATA_HOME"] = "/custom/data";
			process.env["XDG_STATE_HOME"] = "/custom/state";
			process.env["XDG_RUNTIME_DIR"] = "/run/user/1000";

			const dirs = resolveMusherDirs();
			expect(dirs.cache).toBe("/custom/cache/musher");
			expect(dirs.config).toBe("/custom/config/musher");
			expect(dirs.data).toBe("/custom/data/musher");
			expect(dirs.state).toBe("/custom/state/musher");
			expect(dirs.runtime).toBe("/run/user/1000/musher");
		});

		it("rejects relative XDG paths and falls back to default", () => {
			Object.defineProperty(process, "platform", { value: "linux" });
			process.env["XDG_CACHE_HOME"] = "relative/path";

			const dirs = resolveMusherDirs();
			const home = homedir();
			expect(dirs.cache).toBe(join(home, ".cache", "musher"));
		});
	});

	describe("macOS defaults", () => {
		it("uses ~/Library paths, NOT XDG", () => {
			Object.defineProperty(process, "platform", { value: "darwin" });
			const home = homedir();

			const dirs = resolveMusherDirs();
			expect(dirs.cache).toBe(join(home, "Library", "Caches", "musher"));
			expect(dirs.config).toBe(join(home, "Library", "Application Support", "musher", "config"));
			expect(dirs.data).toBe(join(home, "Library", "Application Support", "musher", "data"));
			expect(dirs.state).toBe(join(home, "Library", "Application Support", "musher", "state"));
			expect(dirs.runtime).toBe(join(tmpdir(), "musher", "run"));
		});
	});

	describe("Windows defaults", () => {
		it("uses %LOCALAPPDATA% flat layout", () => {
			Object.defineProperty(process, "platform", { value: "win32" });
			process.env["LOCALAPPDATA"] = "/mock/local";

			const dirs = resolveMusherDirs();
			expect(dirs.cache).toBe(join("/mock/local", "musher", "cache"));
			expect(dirs.config).toBe(join("/mock/local", "musher", "config"));
			expect(dirs.data).toBe(join("/mock/local", "musher", "data"));
			expect(dirs.state).toBe(join("/mock/local", "musher", "state"));
			expect(dirs.runtime).toBe(join(tmpdir(), "musher", "run"));
		});
	});

	describe("MUSHER_* overrides", () => {
		it("MUSHER_CACHE_HOME takes precedence", () => {
			Object.defineProperty(process, "platform", { value: "linux" });
			process.env["MUSHER_CACHE_HOME"] = "/override/cache";

			const dirs = resolveMusherDirs();
			expect(dirs.cache).toBe("/override/cache");
		});

		it("MUSHER_HOME provides umbrella override", () => {
			Object.defineProperty(process, "platform", { value: "linux" });
			process.env["MUSHER_HOME"] = "/umbrella";

			const dirs = resolveMusherDirs();
			expect(dirs.cache).toBe(join("/umbrella", "cache"));
			expect(dirs.config).toBe(join("/umbrella", "config"));
			expect(dirs.data).toBe(join("/umbrella", "data"));
			expect(dirs.state).toBe(join("/umbrella", "state"));
			expect(dirs.runtime).toBe(join("/umbrella", "runtime"));
		});

		it("per-dir override takes precedence over MUSHER_HOME", () => {
			Object.defineProperty(process, "platform", { value: "linux" });
			process.env["MUSHER_HOME"] = "/umbrella";
			process.env["MUSHER_CACHE_HOME"] = "/specific/cache";

			const dirs = resolveMusherDirs();
			expect(dirs.cache).toBe("/specific/cache");
			expect(dirs.config).toBe(join("/umbrella", "config"));
		});

		it("rejects relative MUSHER_CACHE_HOME and falls back", () => {
			Object.defineProperty(process, "platform", { value: "linux" });
			process.env["MUSHER_CACHE_HOME"] = "relative/cache";

			const dirs = resolveMusherDirs();
			const home = homedir();
			expect(dirs.cache).toBe(join(home, ".cache", "musher"));
		});

		it("rejects relative MUSHER_HOME and falls back", () => {
			Object.defineProperty(process, "platform", { value: "linux" });
			process.env["MUSHER_HOME"] = "relative/home";

			const dirs = resolveMusherDirs();
			const home = homedir();
			expect(dirs.cache).toBe(join(home, ".cache", "musher"));
		});
	});

	describe("no literal tilde", () => {
		it("never produces paths with literal ~", () => {
			Object.defineProperty(process, "platform", { value: "linux" });
			const dirs = resolveMusherDirs();

			expect(dirs.cache).not.toContain("~");
			expect(dirs.config).not.toContain("~");
			expect(dirs.data).not.toContain("~");
			expect(dirs.state).not.toContain("~");
		});
	});
});
