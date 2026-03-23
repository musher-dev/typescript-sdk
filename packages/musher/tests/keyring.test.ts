import * as childProcess from "node:child_process";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("node:child_process", () => ({
	execFileSync: vi.fn(),
}));

// Import after mocking
const { readKeyring } = await import("../src/keyring.js");

describe("readKeyring", () => {
	const mockedExecFileSync = vi.mocked(childProcess.execFileSync);

	beforeEach(() => {
		mockedExecFileSync.mockReset();
	});

	it("reads host-scoped entry from macOS keychain on darwin", () => {
		const originalPlatform = process.platform;
		Object.defineProperty(process, "platform", { value: "darwin" });

		mockedExecFileSync.mockReturnValue(Buffer.from("my-secret-key\n"));

		const result = readKeyring("api.musher.dev");
		expect(result).toBe("my-secret-key");
		expect(mockedExecFileSync).toHaveBeenCalledWith(
			"security",
			["find-generic-password", "-s", "musher/api.musher.dev", "-a", "api-key", "-w"],
			expect.objectContaining({ timeout: 5_000 }),
		);

		Object.defineProperty(process, "platform", { value: originalPlatform });
	});

	it("reads host-scoped entry from secret-tool on linux", () => {
		const originalPlatform = process.platform;
		Object.defineProperty(process, "platform", { value: "linux" });

		mockedExecFileSync.mockReturnValue(Buffer.from("linux-key\n"));

		const result = readKeyring("api.musher.dev");
		expect(result).toBe("linux-key");
		expect(mockedExecFileSync).toHaveBeenCalledWith(
			"secret-tool",
			["lookup", "service", "musher/api.musher.dev", "username", "api-key"],
			expect.objectContaining({ timeout: 5_000 }),
		);

		Object.defineProperty(process, "platform", { value: originalPlatform });
	});

	it("uses custom host for service name", () => {
		const originalPlatform = process.platform;
		Object.defineProperty(process, "platform", { value: "darwin" });

		mockedExecFileSync.mockReturnValue(Buffer.from("staging-key\n"));

		const result = readKeyring("staging.musher.dev");
		expect(result).toBe("staging-key");
		expect(mockedExecFileSync).toHaveBeenCalledWith(
			"security",
			["find-generic-password", "-s", "musher/staging.musher.dev", "-a", "api-key", "-w"],
			expect.objectContaining({ timeout: 5_000 }),
		);

		Object.defineProperty(process, "platform", { value: originalPlatform });
	});

	it("defaults to api.musher.dev when no host is provided", () => {
		const originalPlatform = process.platform;
		Object.defineProperty(process, "platform", { value: "darwin" });

		mockedExecFileSync.mockReturnValue(Buffer.from("default-key\n"));

		const result = readKeyring();
		expect(result).toBe("default-key");
		expect(mockedExecFileSync).toHaveBeenCalledWith(
			"security",
			["find-generic-password", "-s", "musher/api.musher.dev", "-a", "api-key", "-w"],
			expect.objectContaining({ timeout: 5_000 }),
		);

		Object.defineProperty(process, "platform", { value: originalPlatform });
	});

	it("returns undefined on windows", () => {
		const originalPlatform = process.platform;
		Object.defineProperty(process, "platform", { value: "win32" });

		const result = readKeyring();
		expect(result).toBeUndefined();

		Object.defineProperty(process, "platform", { value: originalPlatform });
	});

	it("returns undefined when lookup fails", () => {
		const originalPlatform = process.platform;
		Object.defineProperty(process, "platform", { value: "darwin" });

		mockedExecFileSync.mockImplementation(() => {
			throw new Error("not found");
		});

		const result = readKeyring();
		expect(result).toBeUndefined();

		Object.defineProperty(process, "platform", { value: originalPlatform });
	});

	it("returns undefined when result is empty", () => {
		const originalPlatform = process.platform;
		Object.defineProperty(process, "platform", { value: "darwin" });

		mockedExecFileSync.mockReturnValue(Buffer.from(""));

		const result = readKeyring();
		expect(result).toBeUndefined();

		Object.defineProperty(process, "platform", { value: originalPlatform });
	});
});
