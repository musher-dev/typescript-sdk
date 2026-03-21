/**
 * Platform-aware directory resolution for the Musher SDK.
 *
 * Follows the shared cross-platform storage spec:
 *   - Linux:   XDG Base Directory spec
 *   - macOS:   ~/Library/{Caches,Application Support}/musher
 *   - Windows: %LOCALAPPDATA%\musher\{cache,config,data,state}
 *
 * Resolution order per directory:
 *   1. MUSHER_<TYPE>_HOME  (e.g. MUSHER_CACHE_HOME)
 *   2. MUSHER_HOME/<type>  (umbrella override)
 *   3. Platform default
 *
 * Relative override/XDG paths are rejected (per XDG spec).
 */

import { homedir, tmpdir } from "node:os";
import { isAbsolute, join } from "node:path";

export interface MusherDirs {
	cache: string;
	config: string;
	data: string;
	state: string;
	runtime: string;
}

const APP_NAME = "musher";

/** Read an env var, treating empty strings as unset. */
function env(name: string): string | undefined {
	const value = process.env[name];
	return value || undefined;
}

/** Return the env var value only if it is an absolute path. */
function absEnv(name: string): string | undefined {
	const value = env(name);
	if (value && isAbsolute(value)) return value;
	return undefined;
}

/** Resolve a single directory following the standard precedence chain. */
function resolveDir(envKey: string, subdir: string, platformDefault: () => string): string {
	// 1. Per-directory override: MUSHER_<TYPE>_HOME
	const perDir = absEnv(envKey);
	if (perDir) return perDir;

	// 2. Umbrella override: MUSHER_HOME/<subdir>
	const umbrella = absEnv("MUSHER_HOME");
	if (umbrella) return join(umbrella, subdir);

	// 3. Platform default
	return platformDefault();
}

/** XDG-aware default — returns the XDG path if set and absolute, otherwise the fallback. */
function xdgDefault(xdgVar: string, fallbackSuffix: string): string {
	const xdg = absEnv(xdgVar);
	if (xdg) return join(xdg, APP_NAME);
	return join(homedir(), fallbackSuffix, APP_NAME);
}

function linuxDirs(): MusherDirs {
	return {
		cache: resolveDir("MUSHER_CACHE_HOME", "cache", () => xdgDefault("XDG_CACHE_HOME", ".cache")),
		config: resolveDir("MUSHER_CONFIG_HOME", "config", () =>
			xdgDefault("XDG_CONFIG_HOME", ".config"),
		),
		data: resolveDir("MUSHER_DATA_HOME", "data", () =>
			xdgDefault("XDG_DATA_HOME", join(".local", "share")),
		),
		state: resolveDir("MUSHER_STATE_HOME", "state", () =>
			xdgDefault("XDG_STATE_HOME", join(".local", "state")),
		),
		runtime: resolveDir("MUSHER_RUNTIME_DIR", "runtime", () => {
			const xdg = absEnv("XDG_RUNTIME_DIR");
			if (xdg) return join(xdg, APP_NAME);
			return join(tmpdir(), APP_NAME, "run");
		}),
	};
}

function darwinDirs(): MusherDirs {
	const home = homedir();
	const appSupport = join(home, "Library", "Application Support", APP_NAME);

	return {
		cache: resolveDir("MUSHER_CACHE_HOME", "cache", () =>
			join(home, "Library", "Caches", APP_NAME),
		),
		config: resolveDir("MUSHER_CONFIG_HOME", "config", () => join(appSupport, "config")),
		data: resolveDir("MUSHER_DATA_HOME", "data", () => join(appSupport, "data")),
		state: resolveDir("MUSHER_STATE_HOME", "state", () => join(appSupport, "state")),
		runtime: resolveDir("MUSHER_RUNTIME_DIR", "runtime", () => join(tmpdir(), APP_NAME, "run")),
	};
}

function win32Dirs(): MusherDirs {
	const localAppData = env("LOCALAPPDATA") ?? join(homedir(), "AppData", "Local");
	const base = join(localAppData, APP_NAME);

	return {
		cache: resolveDir("MUSHER_CACHE_HOME", "cache", () => join(base, "cache")),
		config: resolveDir("MUSHER_CONFIG_HOME", "config", () => join(base, "config")),
		data: resolveDir("MUSHER_DATA_HOME", "data", () => join(base, "data")),
		state: resolveDir("MUSHER_STATE_HOME", "state", () => join(base, "state")),
		runtime: resolveDir("MUSHER_RUNTIME_DIR", "runtime", () => join(tmpdir(), APP_NAME, "run")),
	};
}

/** Resolve all Musher directory paths for the current platform. */
export function resolveMusherDirs(): MusherDirs {
	switch (process.platform) {
		case "darwin":
			return darwinDirs();
		case "win32":
			return win32Dirs();
		default:
			return linuxDirs();
	}
}
