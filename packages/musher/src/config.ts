/**
 * Client configuration with env-var resolution.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { readKeyring } from "./keyring.js";

export interface ClientConfig {
	/** Base URL for the Musher API. Default: https://api.musher.dev */
	baseUrl?: string;
	/** API key authentication. */
	apiKey?: string;
	/** Bearer token authentication. Takes precedence over apiKey. */
	token?: string;
	/** Override XDG cache path. */
	cacheDir?: string;
	/** Cache TTL in seconds. Default: 3600 */
	cacheTtlSeconds?: number;
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
	cacheTtlSeconds: number;
	timeout: number;
	retries: number;
}

const DEFAULT_BASE_URL = "https://api.musher.dev";
const DEFAULT_CACHE_TTL = 3600;
const DEFAULT_TIMEOUT = 30_000;
const DEFAULT_RETRIES = 2;

function getDefaultCacheDir(): string {
	const platform = process.platform;
	if (platform === "win32") {
		return `${process.env.LOCALAPPDATA ?? `${process.env.USERPROFILE}\\AppData\\Local`}\\musher\\cache`;
	}
	const xdg = process.env.XDG_CACHE_HOME;
	if (xdg) return `${xdg}/musher`;
	const home = process.env.HOME ?? "~";
	return `${home}/.cache/musher`;
}

/** Resolve the mush CLI config directory. */
export function getDefaultConfigDir(): string {
	const platform = process.platform;
	if (platform === "win32") {
		return `${process.env.APPDATA ?? `${process.env.USERPROFILE}\\AppData\\Roaming`}\\mush`;
	}
	const xdg = process.env.XDG_CONFIG_HOME;
	if (xdg) return `${xdg}/mush`;
	const home = process.env.HOME ?? "~";
	return `${home}/.config/mush`;
}

/** Read the API key from the mush CLI config file. */
export function readApiKeyFile(configDir?: string): string | undefined {
	try {
		const dir = configDir ?? getDefaultConfigDir();
		const content = readFileSync(join(dir, "api-key"), "utf-8").trim();
		return content || undefined;
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
	return {
		baseUrl: config?.baseUrl ?? env("MUSHER_BASE_URL") ?? env("MUSH_BASE_URL") ?? DEFAULT_BASE_URL,
		apiKey:
			config?.apiKey ??
			env("MUSHER_API_KEY") ??
			env("MUSH_API_KEY") ??
			readKeyring() ??
			readApiKeyFile(),
		token: config?.token ?? env("MUSHER_TOKEN") ?? env("MUSH_TOKEN"),
		cacheDir: config?.cacheDir ?? getDefaultCacheDir(),
		cacheTtlSeconds: config?.cacheTtlSeconds ?? DEFAULT_CACHE_TTL,
		timeout: config?.timeout ?? DEFAULT_TIMEOUT,
		retries: config?.retries ?? DEFAULT_RETRIES,
	};
}
