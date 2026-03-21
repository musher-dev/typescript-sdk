/**
 * OS keyring helper — reads API key from the shared musher platform keyring.
 *
 * Uses `node:child_process` to invoke OS-native credential stores.
 * Returns `undefined` silently on any failure (keyring is best-effort).
 */

import { execFileSync } from "node:child_process";

const LEGACY_SERVICE = "dev.musher.musher";
const ACCOUNT = "api-key";

function serviceName(host: string): string {
	return `musher/${host}`;
}

function tryKeyringLookup(service: string): string | undefined {
	try {
		const platform = process.platform;

		if (platform === "darwin") {
			const result = execFileSync(
				"security",
				["find-generic-password", "-s", service, "-a", ACCOUNT, "-w"],
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
				["lookup", "service", service, "username", ACCOUNT],
				{
					stdio: ["ignore", "pipe", "ignore"],
					timeout: 5_000,
				},
			);
			return result.toString("utf-8").trim() || undefined;
		}

		// Windows: not supported
		return undefined;
	} catch {
		return undefined;
	}
}

/**
 * Attempt to read the API key from the OS keyring.
 *
 * Looks up a host-scoped entry first (`musher/<host>`), then falls back
 * to the legacy service name (`dev.musher.musher`) for migration.
 *
 * - **macOS**: `security find-generic-password`
 * - **Linux**: `secret-tool lookup`
 * - **Windows**: not supported (returns `undefined`)
 *
 * @param host - Registry hostname (e.g. "api.musher.dev").
 */
export function readKeyring(host = "api.musher.dev"): string | undefined {
	try {
		// Host-scoped lookup
		const value = tryKeyringLookup(serviceName(host));
		if (value) return value;

		// Legacy fallback for migration
		return tryKeyringLookup(LEGACY_SERVICE);
	} catch {
		return undefined;
	}
}
