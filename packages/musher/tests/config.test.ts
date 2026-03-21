import { mkdtempSync, writeFileSync, rmSync, chmodSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock keyring to isolate config tests
vi.mock("../src/keyring.js", () => ({
	readKeyring: vi.fn(() => undefined),
}));

const { resolveConfig, readApiKeyFile } = await import("../src/config.js");
const { readKeyring } = await import("../src/keyring.js");
const mockedReadKeyring = vi.mocked(readKeyring);

describe("resolveConfig", () => {
	const envBackup: Record<string, string | undefined> = {};

	beforeEach(() => {
		for (const key of ["MUSHER_API_URL", "MUSHER_BASE_URL", "MUSHER_API_KEY", "MUSHER_TOKEN"]) {
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
		expect(config.manifestTtlSeconds).toBe(86_400);
		expect(config.refTtlSeconds).toBe(300);
		expect(config.timeout).toBe(30_000);
		expect(config.retries).toBe(2);
	});

	it("includes configDir in resolved config", () => {
		const config = resolveConfig();
		expect(config.configDir).toBeDefined();
		expect(typeof config.configDir).toBe("string");
	});

	it("overrides defaults with provided values", () => {
		const config = resolveConfig({
			baseUrl: "https://custom.dev",
			manifestTtlSeconds: 7200,
			refTtlSeconds: 60,
			timeout: 5000,
			retries: 0,
		});
		expect(config.baseUrl).toBe("https://custom.dev");
		expect(config.manifestTtlSeconds).toBe(7200);
		expect(config.refTtlSeconds).toBe(60);
		expect(config.timeout).toBe(5000);
		expect(config.retries).toBe(0);
	});

	it("MUSHER_API_URL takes precedence over MUSHER_BASE_URL", () => {
		process.env.MUSHER_API_URL = "https://api-url.dev";
		process.env.MUSHER_BASE_URL = "https://base-url.dev";
		const config = resolveConfig();
		expect(config.baseUrl).toBe("https://api-url.dev");
	});

	it("falls back to MUSHER_BASE_URL when MUSHER_API_URL is not set", () => {
		process.env.MUSHER_BASE_URL = "https://base-url.dev";
		const config = resolveConfig();
		expect(config.baseUrl).toBe("https://base-url.dev");
	});

	it("reads MUSHER_API_KEY from env", () => {
		process.env.MUSHER_API_KEY = "musher-key";
		const config = resolveConfig();
		expect(config.apiKey).toBe("musher-key");
	});

	it("reads MUSHER_TOKEN from env", () => {
		process.env.MUSHER_TOKEN = "musher-token";
		const config = resolveConfig();
		expect(config.token).toBe("musher-token");
	});

	it("constructor values take precedence over env vars", () => {
		process.env.MUSHER_API_KEY = "env-key";
		const config = resolveConfig({ apiKey: "constructor-key" });
		expect(config.apiKey).toBe("constructor-key");
	});

	it("uses keyring when env vars are not set", () => {
		mockedReadKeyring.mockReturnValue("keyring-key");
		const config = resolveConfig();
		expect(config.apiKey).toBe("keyring-key");
	});

	it("env vars take precedence over keyring", () => {
		process.env.MUSHER_API_KEY = "env-key";
		mockedReadKeyring.mockReturnValue("keyring-key");
		const config = resolveConfig();
		expect(config.apiKey).toBe("env-key");
	});

	it("auto-discovers auth when only non-auth fields are configured", () => {
		mockedReadKeyring.mockReturnValue("keyring-key");
		const config = resolveConfig({ baseUrl: "https://custom.dev" });
		expect(config.baseUrl).toBe("https://custom.dev");
		expect(config.apiKey).toBe("keyring-key");
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
		const filePath = join(tempDir, "api-key");
		writeFileSync(filePath, "  file-api-key  \n", { mode: 0o600 });
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

	it.skipIf(process.platform === "win32")(
		"returns undefined when file is readable by group or others",
		() => {
			const filePath = join(tempDir, "api-key");
			writeFileSync(filePath, "secret-key");
			chmodSync(filePath, 0o644);
			const result = readApiKeyFile(tempDir);
			expect(result).toBeUndefined();
		},
	);

	it.skipIf(process.platform === "win32")("reads file when permissions are owner-only", () => {
		const filePath = join(tempDir, "api-key");
		writeFileSync(filePath, "secret-key");
		chmodSync(filePath, 0o600);
		const result = readApiKeyFile(tempDir);
		expect(result).toBe("secret-key");
	});
});
