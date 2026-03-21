import { mkdtempSync, mkdirSync, writeFileSync, rmSync, chmodSync } from "node:fs";
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
		for (const key of ["MUSHER_API_URL", "MUSHER_API_KEY"]) {
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
		expect(config.timeout).toBe(60_000);
		expect(config.retries).toBe(3);
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

	it("reads base URL from MUSHER_API_URL env var", () => {
		process.env.MUSHER_API_URL = "https://api-url.dev";
		const config = resolveConfig();
		expect(config.baseUrl).toBe("https://api-url.dev");
	});

	it("reads MUSHER_API_KEY from env", () => {
		process.env.MUSHER_API_KEY = "musher-key";
		const config = resolveConfig();
		expect(config.apiKey).toBe("musher-key");
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

	const hostId = "api.musher.dev";

	function credentialDir(): string {
		const dir = join(tempDir, "credentials", hostId);
		mkdirSync(dir, { recursive: true });
		return dir;
	}

	it("reads api-key file from host-scoped credentials dir", () => {
		const dir = credentialDir();
		writeFileSync(join(dir, "api-key"), "  file-api-key  \n", { mode: 0o600 });
		const result = readApiKeyFile(tempDir, hostId);
		expect(result).toBe("file-api-key");
	});

	it("returns undefined when file does not exist", () => {
		const result = readApiKeyFile(tempDir, hostId);
		expect(result).toBeUndefined();
	});

	it("returns undefined when file is empty", () => {
		const dir = credentialDir();
		writeFileSync(join(dir, "api-key"), "   \n");
		const result = readApiKeyFile(tempDir, hostId);
		expect(result).toBeUndefined();
	});

	it("scopes credentials by host", () => {
		const dir1 = join(tempDir, "credentials", "api.musher.dev");
		const dir2 = join(tempDir, "credentials", "localhost_8080");
		mkdirSync(dir1, { recursive: true });
		mkdirSync(dir2, { recursive: true });
		writeFileSync(join(dir1, "api-key"), "prod-key", { mode: 0o600 });
		writeFileSync(join(dir2, "api-key"), "local-key", { mode: 0o600 });
		expect(readApiKeyFile(tempDir, "api.musher.dev")).toBe("prod-key");
		expect(readApiKeyFile(tempDir, "localhost:8080")).toBe("local-key");
	});

	it.skipIf(process.platform === "win32")(
		"returns undefined when file is readable by group or others",
		() => {
			const dir = credentialDir();
			const filePath = join(dir, "api-key");
			writeFileSync(filePath, "secret-key");
			chmodSync(filePath, 0o644);
			const result = readApiKeyFile(tempDir, hostId);
			expect(result).toBeUndefined();
		},
	);

	it.skipIf(process.platform === "win32")("reads file when permissions are owner-only", () => {
		const dir = credentialDir();
		const filePath = join(dir, "api-key");
		writeFileSync(filePath, "secret-key");
		chmodSync(filePath, 0o600);
		const result = readApiKeyFile(tempDir, hostId);
		expect(result).toBe("secret-key");
	});
});
