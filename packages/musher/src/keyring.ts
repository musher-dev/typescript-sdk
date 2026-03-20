/**
 * OS keyring helper — reads API key from the same keyring used by the `mush` CLI.
 *
 * Uses `node:child_process` to invoke OS-native credential stores.
 * Returns `undefined` silently on any failure (keyring is best-effort).
 */

import { execFileSync } from "node:child_process";

const SERVICE = "dev.musher.mush";
const ACCOUNT = "api-key";

/**
 * Attempt to read the API key from the OS keyring.
 *
 * - **macOS**: `security find-generic-password`
 * - **Linux**: `secret-tool lookup`
 * - **Windows**: not supported (returns `undefined`)
 */
export function readKeyring(): string | undefined {
	try {
		const platform = process.platform;

		if (platform === "darwin") {
			const result = execFileSync(
				"security",
				["find-generic-password", "-s", SERVICE, "-a", ACCOUNT, "-w"],
				{
					stdio: ["ignore", "pipe", "ignore"],
					timeout: 5_000,
				},
			);
			return result.toString("utf-8").trim() || undefined;
		}

		if (platform === "linux") {
			const result = execFileSync(
				"secret-tool",
				["lookup", "service", SERVICE, "username", ACCOUNT],
				{
					stdio: ["ignore", "pipe", "ignore"],
					timeout: 5_000,
				},
			);
			return result.toString("utf-8").trim() || undefined;
		}

		// Windows: not supported, fall through to file-based resolution
		return undefined;
	} catch {
		return undefined;
	}
}
