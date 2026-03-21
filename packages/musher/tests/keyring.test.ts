import { describe, expect, it, vi } from "vitest";
import * as childProcess from "node:child_process";

vi.mock("node:child_process", () => ({
	execFileSync: vi.fn(),
}));

// Import after mocking
const { readKeyring } = await import("../src/keyring.js");

describe("readKeyring", () => {
	const mockedExecFileSync = vi.mocked(childProcess.execFileSync);

	it("reads from macOS keychain on darwin", () => {
		const originalPlatform = process.platform;
		Object.defineProperty(process, "platform", { value: "darwin" });

		mockedExecFileSync.mockReturnValue(Buffer.from("my-secret-key\n"));

		const result = readKeyring();
		expect(result).toBe("my-secret-key");
		expect(mockedExecFileSync).toHaveBeenCalledWith(
			"security",
			["find-generic-password", "-s", "dev.musher.musher", "-a", "api-key", "-w"],
			expect.objectContaining({ timeout: 5_000 }),
		);

		Object.defineProperty(process, "platform", { value: originalPlatform });
	});

	it("reads from secret-tool on linux", () => {
		const originalPlatform = process.platform;
		Object.defineProperty(process, "platform", { value: "linux" });

		mockedExecFileSync.mockReturnValue(Buffer.from("linux-key\n"));

		const result = readKeyring();
		expect(result).toBe("linux-key");
		expect(mockedExecFileSync).toHaveBeenCalledWith(
			"secret-tool",
			["lookup", "service", "dev.musher.musher", "username", "api-key"],
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

	it("returns undefined when command fails", () => {
		const originalPlatform = process.platform;
		Object.defineProperty(process, "platform", { value: "darwin" });

		mockedExecFileSync.mockImplementation(() => {
			throw new Error("security: SecKeychainSearchCopyNext: The specified item could not be found");
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
