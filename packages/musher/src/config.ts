/**
 * Client configuration with env-var resolution.
 */

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

export function resolveConfig(config?: ClientConfig): ResolvedConfig {
	return {
		baseUrl: config?.baseUrl ?? process.env.MUSHER_BASE_URL ?? DEFAULT_BASE_URL,
		apiKey: config?.apiKey ?? process.env.MUSHER_API_KEY,
		token: config?.token ?? process.env.MUSHER_TOKEN,
		cacheDir: config?.cacheDir ?? getDefaultCacheDir(),
		cacheTtlSeconds: config?.cacheTtlSeconds ?? DEFAULT_CACHE_TTL,
		timeout: config?.timeout ?? DEFAULT_TIMEOUT,
		retries: config?.retries ?? DEFAULT_RETRIES,
	};
}
