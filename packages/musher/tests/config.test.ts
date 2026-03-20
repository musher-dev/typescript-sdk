import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock keyring to isolate config tests
vi.mock("../src/keyring.js", () => ({
	readKeyring: vi.fn(() => undefined),
}));

const { resolveConfig, getDefaultConfigDir, readApiKeyFile } = await import("../src/config.js");
const { readKeyring } = await import("../src/keyring.js");
const mockedReadKeyring = vi.mocked(readKeyring);

describe("resolveConfig", () => {
	const envBackup: Record<string, string | undefined> = {};

	beforeEach(() => {
		for (const key of [
			"MUSHER_BASE_URL",
			"MUSHER_API_KEY",
			"MUSHER_TOKEN",
			"MUSH_BASE_URL",
			"MUSH_API_KEY",
			"MUSH_TOKEN",
		]) {
			envBackup[key] = process.env[key];
			process.env[key] = "";
		}
		mockedReadKeyring.mockReturnValue(undefined);
	});

	afterEach(() => {
		for (const [key, value] of Object.entries(envBackup)) {
			process.env[key] = value ?? "";
		}
	});

	it("applies defaults when no config provided", () => {
		const config = resolveConfig();
		expect(config.baseUrl).toBe("https://api.musher.dev");
		expect(config.cacheTtlSeconds).toBe(3600);
		expect(config.timeout).toBe(30_000);
		expect(config.retries).toBe(2);
	});

	it("overrides defaults with provided values", () => {
		const config = resolveConfig({
			baseUrl: "https://custom.dev",
			cacheTtlSeconds: 7200,
			timeout: 5000,
			retries: 0,
		});
		expect(config.baseUrl).toBe("https://custom.dev");
		expect(config.cacheTtlSeconds).toBe(7200);
		expect(config.timeout).toBe(5000);
		expect(config.retries).toBe(0);
	});

	it("MUSHER_API_KEY takes precedence over MUSH_API_KEY", () => {
		process.env.MUSHER_API_KEY = "musher-key";
		process.env.MUSH_API_KEY = "mush-key";
		const config = resolveConfig();
		expect(config.apiKey).toBe("musher-key");
	});

	it("falls back to MUSH_API_KEY when MUSHER_API_KEY is not set", () => {
		process.env.MUSH_API_KEY = "mush-key";
		const config = resolveConfig();
		expect(config.apiKey).toBe("mush-key");
	});

	it("MUSHER_TOKEN takes precedence over MUSH_TOKEN", () => {
		process.env.MUSHER_TOKEN = "musher-token";
		process.env.MUSH_TOKEN = "mush-token";
		const config = resolveConfig();
		expect(config.token).toBe("musher-token");
	});

	it("falls back to MUSH_TOKEN when MUSHER_TOKEN is not set", () => {
		process.env.MUSH_TOKEN = "mush-token";
		const config = resolveConfig();
		expect(config.token).toBe("mush-token");
	});

	it("MUSHER_BASE_URL takes precedence over MUSH_BASE_URL", () => {
		process.env.MUSHER_BASE_URL = "https://musher.example.com";
		process.env.MUSH_BASE_URL = "https://mush.example.com";
		const config = resolveConfig();
		expect(config.baseUrl).toBe("https://musher.example.com");
	});

	it("falls back to MUSH_BASE_URL when MUSHER_BASE_URL is not set", () => {
		process.env.MUSH_BASE_URL = "https://mush.example.com";
		const config = resolveConfig();
		expect(config.baseUrl).toBe("https://mush.example.com");
	});

	it("constructor values take precedence over all env vars", () => {
		process.env.MUSHER_API_KEY = "env-key";
		process.env.MUSH_API_KEY = "mush-key";
		const config = resolveConfig({ apiKey: "constructor-key" });
		expect(config.apiKey).toBe("constructor-key");
	});

	it("uses keyring when env vars are not set", () => {
		mockedReadKeyring.mockReturnValue("keyring-key");
		const config = resolveConfig();
		expect(config.apiKey).toBe("keyring-key");
	});

	it("env vars take precedence over keyring", () => {
		process.env.MUSH_API_KEY = "env-key";
		mockedReadKeyring.mockReturnValue("keyring-key");
		const config = resolveConfig();
		expect(config.apiKey).toBe("env-key");
	});
});

describe("getDefaultConfigDir", () => {
	it("uses XDG_CONFIG_HOME when set", () => {
		const original = process.env.XDG_CONFIG_HOME;
		process.env.XDG_CONFIG_HOME = "/custom/config";
		const dir = getDefaultConfigDir();
		expect(dir).toBe("/custom/config/mush");
		process.env.XDG_CONFIG_HOME = original ?? "";
	});

	it("falls back to ~/.config/mush on unix", () => {
		const originalXdg = process.env.XDG_CONFIG_HOME;
		const originalHome = process.env.HOME;
		const originalPlatform = process.platform;

		// Setting to empty string effectively unsets (empty string is falsy)
		process.env.XDG_CONFIG_HOME = "";
		process.env.HOME = "/home/testuser";
		Object.defineProperty(process, "platform", { value: "linux" });

		const dir = getDefaultConfigDir();
		expect(dir).toBe("/home/testuser/.config/mush");

		Object.defineProperty(process, "platform", { value: originalPlatform });
		process.env.HOME = originalHome;
		process.env.XDG_CONFIG_HOME = originalXdg;
	});
});

describe("readApiKeyFile", () => {
	let tempDir: string;

	beforeEach(() => {
		tempDir = mkdtempSync(join(tmpdir(), "musher-config-test-"));
	});

	afterEach(() => {
		rmSync(tempDir, { recursive: true, force: true });
	});

	it("reads api-key file from config dir", () => {
		writeFileSync(join(tempDir, "api-key"), "  file-api-key  \n");
		const result = readApiKeyFile(tempDir);
		expect(result).toBe("file-api-key");
	});

	it("returns undefined when file does not exist", () => {
		const result = readApiKeyFile(tempDir);
		expect(result).toBeUndefined();
	});

	it("returns undefined when file is empty", () => {
		writeFileSync(join(tempDir, "api-key"), "   \n");
		const result = readApiKeyFile(tempDir);
		expect(result).toBeUndefined();
	});
});
