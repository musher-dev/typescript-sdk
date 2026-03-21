/**
 * OS keyring helper — reads API key from the shared musher platform keyring.
 *
 * Uses `node:child_process` to invoke OS-native credential stores.
 * Returns `undefined` silently on any failure (keyring is best-effort).
 */

import { execFileSync } from "node:child_process";

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

		if (platform === "win32") {
			const result = execFileSync(
				"powershell.exe",
				[
					"-NoProfile",
					"-NonInteractive",
					"-Command",
					`$cred = Get-StoredCredential -Target '${service.replace(/'/g, "''")}'; if ($cred) { $cred.GetNetworkCredential().Password }`,
				],
				{
					stdio: ["ignore", "pipe", "ignore"],
					timeout: 5_000,
				},
			);
			return result.toString("utf-8").trim() || undefined;
		}

		return undefined;
	} catch {
		return undefined;
	}
}

/**
 * Attempt to read the API key from the OS keyring.
 *
 * Looks up the host-scoped entry (`musher/<host>`).
 *
 * - **macOS**: `security find-generic-password`
 * - **Linux**: `secret-tool lookup`
 * - **Windows**: `Get-StoredCredential` (requires CredentialManager module, best-effort)
 *
 * @param host - Registry hostname (e.g. "api.musher.dev").
 */
export function readKeyring(host = "api.musher.dev"): string | undefined {
	return tryKeyringLookup(serviceName(host));
}
