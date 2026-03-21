/**
 * Client configuration with env-var resolution.
 */

import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { readKeyring } from "./keyring.js";
import { resolveMusherDirs } from "./paths.js";

export interface ClientConfig {
	/** Base URL for the Musher API. Default: https://api.musher.dev */
	baseUrl?: string;
	/** API key authentication. */
	apiKey?: string;
	/** Bearer token authentication. Takes precedence over apiKey. */
	token?: string;
	/** Override cache directory path. */
	cacheDir?: string;
	/** Override config directory path. */
	configDir?: string;
	/** Manifest cache TTL in seconds. Default: 86400 (24 hours) */
	manifestTtlSeconds?: number;
	/** Ref cache TTL in seconds. Default: 300 (5 minutes) */
	refTtlSeconds?: number;
	/** Request timeout in milliseconds. Default: 30000 */
	timeout?: number;
	/** Number of retries on transient failures. Default: 2 */
	retries?: number;
}

export interface ResolvedConfig {
	baseUrl: string;
	apiKey: string | undefined;
	token: string | undefined;
	cacheDir: string;
	configDir: string;
	manifestTtlSeconds: number;
	refTtlSeconds: number;
	timeout: number;
	retries: number;
}

const DEFAULT_BASE_URL = "https://api.musher.dev";
const DEFAULT_MANIFEST_TTL = 86_400;
const DEFAULT_REF_TTL = 300;
const DEFAULT_TIMEOUT = 30_000;
const DEFAULT_RETRIES = 2;

/** Read the API key from the musher config directory. */
export function readApiKeyFile(configDir?: string): string | undefined {
	try {
		const dir = configDir ?? resolveMusherDirs().config;
		const filePath = join(dir, "api-key");
		const content = readFileSync(filePath, "utf-8").trim();
		if (!content) return undefined;

		// On Unix, reject files readable by group or others
		if (process.platform !== "win32") {
			const mode = statSync(filePath).mode;
			if (mode & 0o077) {
				process.emitWarning(
					`Ignoring ${filePath}: file permissions are too open (must not be readable by group or others). Run: chmod 600 ${filePath}`,
					"MusherSecurityWarning",
				);
				return undefined;
			}
		}

		return content;
	} catch {
		return undefined;
	}
}

/** Read an env var, treating empty strings as unset. */
function env(name: string): string | undefined {
	const value = process.env[name];
	return value || undefined;
}

export function resolveConfig(config?: ClientConfig): ResolvedConfig {
	const dirs = resolveMusherDirs();
	const configDir = config?.configDir ?? dirs.config;
	const baseUrl =
		config?.baseUrl ?? env("MUSHER_API_URL") ?? env("MUSHER_BASE_URL") ?? DEFAULT_BASE_URL;

	let keyringHost: string;
	try {
		keyringHost = new URL(baseUrl).host;
	} catch {
		keyringHost = "api.musher.dev";
	}

	return {
		baseUrl,
		apiKey:
			config?.apiKey ??
			env("MUSHER_API_KEY") ??
			readKeyring(keyringHost) ??
			readApiKeyFile(configDir),
		token: config?.token ?? env("MUSHER_TOKEN"),
		cacheDir: config?.cacheDir ?? dirs.cache,
		configDir,
		manifestTtlSeconds: config?.manifestTtlSeconds ?? DEFAULT_MANIFEST_TTL,
		refTtlSeconds: config?.refTtlSeconds ?? DEFAULT_REF_TTL,
		timeout: config?.timeout ?? DEFAULT_TIMEOUT,
		retries: config?.retries ?? DEFAULT_RETRIES,
	};
}
