/**
 * MusherClient — main entry point for the SDK.
 *
 * Composes HTTP transport, resource classes, and disk cache
 * into a single facade with high-level pull/load convenience methods.
 */

import { Bundle } from "./bundle.js";
import { BundleCache } from "./cache.js";
import { type ClientConfig, resolveConfig } from "./config.js";
import { HttpTransport } from "./http.js";
import { BundleRef } from "./ref.js";
import { BundlesResource } from "./resources/bundles.js";
import { HubResource } from "./resources/hub.js";
import type { BundleResolveOutput, ListingSearchOutput, Paginated, SearchParams } from "./types.js";

let _loadDeprecationWarned = false;

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

	/** Alias for `hub`. */
	get catalog(): HubResource {
		return this.hub;
	}

	/**
	 * Resolve a bundle via the API, download all assets, and write to disk cache.
	 * Returns a Bundle object.
	 *
	 * @param ref - Bundle reference (e.g. "namespace/slug", "namespace/slug:version").
	 * @param version - Optional semver constraint. Defaults to latest.
	 */
	async pull(ref: string, version?: string): Promise<Bundle> {
		const parsed = BundleRef.parse(ref);
		const resolvedVersion = version ?? parsed.version;
		const resolved = await this.bundles.resolve(parsed.namespace, parsed.slug, resolvedVersion);

		// Download asset contents as Buffers
		const assets = new Map<string, Buffer>();
		if (resolved.manifest?.layers) {
			for (const layer of resolved.manifest.layers) {
				const asset = await this.bundles.getAsset(parsed.namespace, parsed.slug, layer.logicalPath);
				if (asset.contentText != null) {
					assets.set(layer.logicalPath, Buffer.from(asset.contentText, "utf-8"));
				}
			}
		}

		await this._cache.write(resolved, assets);
		return new Bundle(resolved, assets);
	}

	/**
	 * Resolve bundle metadata without downloading content.
	 *
	 * @param ref - Bundle reference.
	 * @param version - Optional semver constraint.
	 */
	async resolve(ref: string, version?: string): Promise<BundleResolveOutput> {
		const parsed = BundleRef.parse(ref);
		const resolvedVersion = version ?? parsed.version;
		return this.bundles.resolve(parsed.namespace, parsed.slug, resolvedVersion);
	}

	/** Search the hub for bundles. Shortcut for `hub.search()`. */
	async search(params?: SearchParams): Promise<Paginated<ListingSearchOutput>> {
		return this.hub.search(params);
	}

	/**
	 * @deprecated Use `pull()` instead. This method will be removed in a future version.
	 *
	 * Load a bundle into memory. Checks cache first (TTL-aware), pulls if stale.
	 */
	async load(ref: string, version?: string): Promise<Bundle> {
		if (!_loadDeprecationWarned) {
			_loadDeprecationWarned = true;
			process.emitWarning(
				"MusherClient.load() is deprecated. Use pull() instead.",
				"DeprecationWarning",
			);
		}

		const parsed = BundleRef.parse(ref);
		const resolvedVersion = version ?? parsed.version;

		// If version is specified, check cache first
		if (resolvedVersion) {
			const fresh = await this._cache.isFresh(parsed.namespace, parsed.slug, resolvedVersion);
			if (fresh) {
				const loaded = await this._cache.load(parsed.namespace, parsed.slug, resolvedVersion);
				if (loaded) return loaded;
			}
		}

		// Pull (resolve + download + cache)
		return this.pull(ref, version);
	}

	/** Cache management utilities. */
	readonly cache = {
		/** Remove expired cache entries. */
		clean: (): Promise<void> => this._cache.clean(),
		/** Remove all cached data. */
		purge: (): Promise<void> => this._cache.purge(),
	};
}
