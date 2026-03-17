/**
 * MusherClient — main entry point for the SDK.
 *
 * Composes HTTP transport, resource classes, and disk cache
 * into a single facade with high-level pull/load convenience methods.
 */

import { BundleCache } from "./cache.js";
import { type ClientConfig, resolveConfig } from "./config.js";
import { MushError } from "./errors.js";
import { HttpTransport } from "./http.js";
import { BundlesResource } from "./resources/bundles.js";
import { HubResource } from "./resources/hub.js";
import type { CachedBundle, LoadedBundle } from "./types.js";

export class MusherClient {
	readonly hub: HubResource;
	readonly bundles: BundlesResource;

	private readonly _cache: BundleCache;
	private readonly _http: HttpTransport;

	constructor(config?: ClientConfig) {
		const resolved = resolveConfig(config);
		this._http = new HttpTransport(resolved);
		this._cache = new BundleCache(resolved.cacheDir, resolved.cacheTtlSeconds);
		this.hub = new HubResource(this._http);
		this.bundles = new BundlesResource(this._http);
	}

	/**
	 * Resolve a bundle via the API, download all assets, and write to disk cache.
	 *
	 * @param ref - Bundle reference in "namespace/slug" format.
	 * @param version - Optional semver constraint. Defaults to latest.
	 */
	async pull(ref: string, version?: string): Promise<CachedBundle> {
		const { namespace, slug } = parseRef(ref);
		const resolved = await this.bundles.resolve(namespace, slug, version);

		// Download asset contents
		const assets = new Map<string, string>();
		if (resolved.manifest?.layers) {
			for (const layer of resolved.manifest.layers) {
				const asset = await this.bundles.getAsset(namespace, slug, layer.logicalPath);
				if (asset.contentText != null) {
					assets.set(layer.logicalPath, asset.contentText);
				}
			}
		}

		return this._cache.write(resolved, assets);
	}

	/**
	 * Load a bundle into memory. Checks cache first (TTL-aware), pulls if stale.
	 *
	 * @param ref - Bundle reference in "namespace/slug" format.
	 * @param version - Optional semver constraint. Defaults to latest.
	 */
	async load(ref: string, version?: string): Promise<LoadedBundle> {
		const { namespace, slug } = parseRef(ref);

		// If version is specified, check cache first
		if (version) {
			const fresh = await this._cache.isFresh(namespace, slug, version);
			if (fresh) {
				const loaded = await this._cache.load(namespace, slug, version);
				if (loaded) return loaded;
			}
		}

		// Pull (resolve + download + cache)
		const cached = await this.pull(ref, version);
		const loaded = await this._cache.load(namespace, slug, cached.version);

		if (!loaded) {
			throw new MushError("Failed to load bundle from cache after pull");
		}

		return loaded;
	}

	/** Cache management utilities. */
	readonly cache = {
		/** Remove expired cache entries. */
		clean: (): Promise<void> => this._cache.clean(),
		/** Remove all cached data. */
		purge: (): Promise<void> => this._cache.purge(),
	};
}

function parseRef(ref: string): { namespace: string; slug: string } {
	const parts = ref.split("/");
	if (parts.length !== 2 || !parts[0] || !parts[1]) {
		throw new MushError(`Invalid bundle ref "${ref}": expected "namespace/slug" format`);
	}
	return { namespace: parts[0], slug: parts[1] };
}
