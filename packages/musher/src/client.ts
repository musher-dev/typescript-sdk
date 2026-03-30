/**
 * MusherClient — main entry point for the SDK.
 *
 * Composes HTTP transport, resource classes, and disk cache
 * into a single facade with high-level pull/load convenience methods.
 */

import { createHash } from "node:crypto";
import { Bundle } from "./bundle.js";
import { BundleCache } from "./cache.js";
import { type ClientConfig, resolveConfig } from "./config.js";
import { ApiError, ForbiddenError, IntegrityError, NotFoundError } from "./errors.js";
import { HttpTransport } from "./http.js";
import { BundleRef } from "./ref.js";
import { BundlesResource } from "./resources/bundles.js";
import type {
	BundleResolveOutput,
	CacheEntry,
	CacheManager,
	CacheStats,
	PullBundleVersionOutput,
} from "./types.js";

export class MusherClient {
	readonly bundles: BundlesResource;

	private readonly _cache: BundleCache;
	private readonly _http: HttpTransport;

	constructor(config?: ClientConfig) {
		const resolved = resolveConfig(config);
		this._http = new HttpTransport(resolved);
		this._cache = new BundleCache(
			resolved.cacheDir,
			resolved.baseUrl,
			resolved.manifestTtlSeconds,
			resolved.refTtlSeconds,
		);
		this.bundles = new BundlesResource(this._http);
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

		// Resolve metadata first (needed for manifest hashes and cache keys)
		const resolved = await this.bundles.resolve(
			parsed.namespace,
			parsed.slug,
			resolvedVersion,
			parsed.digest,
		);

		// Pull asset content — try :pull endpoint (single request), fall back to
		// individual asset fetches if the caller lacks namespace access.
		const pulled = await this.pullContent(parsed.namespace, parsed.slug, resolved);

		// Build asset map, verifying integrity against the resolve manifest
		const hashByPath = new Map<string, string>();
		if (resolved.manifest?.layers) {
			for (const layer of resolved.manifest.layers) {
				hashByPath.set(layer.logicalPath, layer.contentSha256);
			}
		}

		const assets = new Map<string, Buffer>();
		for (const asset of pulled.manifest) {
			const buf = Buffer.from(asset.contentText, "utf-8");
			const expectedHash = hashByPath.get(asset.logicalPath);
			if (expectedHash) {
				const hash = createHash("sha256").update(buf).digest("hex");
				if (hash !== expectedHash) {
					throw new IntegrityError(expectedHash, hash);
				}
			}
			assets.set(asset.logicalPath, buf);
		}

		await this._cache.write(resolved, assets);

		// Cache the ref → version mapping, but NEVER for digest-based lookups
		// (digest refs must not overwrite aliases like "latest")
		if (!parsed.digest) {
			const refAlias = resolvedVersion ?? "latest";
			await this._cache.cacheRef(parsed.namespace, parsed.slug, refAlias, resolved.version);
		}

		return new Bundle(resolved, assets);
	}

	/**
	 * Resolve bundle metadata without downloading content.
	 * Checks the manifest cache (with TTL) before calling the API.
	 *
	 * @param ref - Bundle reference.
	 * @param version - Optional semver constraint.
	 */
	async resolve(ref: string, version?: string): Promise<BundleResolveOutput> {
		const parsed = BundleRef.parse(ref);
		let resolvedVersion = version ?? parsed.version;

		// For unversioned, non-digest refs, try the ref cache first
		if (!(resolvedVersion || parsed.digest)) {
			const cachedVersion = await this._cache.resolveRef(parsed.namespace, parsed.slug, "latest");
			if (cachedVersion) {
				resolvedVersion = cachedVersion;
			}
		}

		// If version is known, check manifest cache freshness
		if (resolvedVersion) {
			const fresh = await this._cache.isFresh(parsed.namespace, parsed.slug, resolvedVersion);
			if (fresh) {
				const manifest = await this._cache.loadManifest(
					parsed.namespace,
					parsed.slug,
					resolvedVersion,
				);
				if (manifest) {
					return manifest;
				}
			}
		}

		// Cache miss or stale — call the API
		const resolved = await this.bundles.resolve(
			parsed.namespace,
			parsed.slug,
			resolvedVersion,
			parsed.digest,
		);

		// Persist resolved manifest to disk cache
		await this._cache.writeManifest(resolved);

		// Cache the ref → version mapping for future lookups
		if (!parsed.digest) {
			const refAlias = resolvedVersion ?? "latest";
			await this._cache.cacheRef(parsed.namespace, parsed.slug, refAlias, resolved.version);
		}

		return resolved;
	}

	/**
	 * Pull content via the :pull endpoint with automatic fallback.
	 *
	 * 1. Try namespace :pull (works when caller owns the namespace)
	 * 2. Fall back to hub :pull (works for any public bundle)
	 * 3. Fall back to individual asset fetches via getAsset
	 */
	private async pullContent(
		namespace: string,
		slug: string,
		resolved: BundleResolveOutput,
	): Promise<PullBundleVersionOutput> {
		// Try namespace :pull first
		try {
			return await this.bundles.pullVersion(namespace, slug, resolved.version);
		} catch (error) {
			if (!(error instanceof ForbiddenError || error instanceof NotFoundError)) {
				throw error;
			}
		}

		// Fall back to hub :pull (public bundles)
		try {
			return await this.bundles.pullHubVersion(namespace, slug, resolved.version);
		} catch (error) {
			if (!(error instanceof ApiError)) {
				throw error;
			}
		}

		// Final fallback: individual asset fetches
		if (resolved.manifest?.layers?.length === 0 || !resolved.manifest?.layers) {
			return { namespace, slug, version: resolved.version, name: resolved.ref, manifest: [] };
		}

		const manifest = await Promise.all(
			resolved.manifest.layers.map(async (layer) => {
				const asset = await this.bundles.getAsset(
					namespace,
					slug,
					layer.logicalPath,
					resolved.version,
				);
				return {
					logicalPath: layer.logicalPath,
					assetType: layer.assetType,
					contentText: asset.contentText ?? "",
					mediaType: layer.mediaType ?? null,
				};
			}),
		);

		return { namespace, slug, version: resolved.version, name: resolved.ref, manifest };
	}

	/** Cache management utilities. */
	readonly cache: CacheManager = {
		/** List all cached bundle entries for this registry. */
		list: (): Promise<CacheEntry[]> => this._cache.list(),
		/** Check if a bundle is cached (and fresh). */
		has: (
			namespace: string,
			slug: string,
			version?: string,
		): Promise<{ cached: boolean; fresh: boolean }> => this._cache.has(namespace, slug, version),
		/** Remove a specific bundle from the cache. Returns count of entries removed. */
		remove: (namespace: string, slug: string, version?: string): Promise<number> =>
			this._cache.remove(namespace, slug, version),
		/** Get aggregate cache statistics. */
		stats: (): Promise<CacheStats> => this._cache.stats(),
		/** Mark entries as stale so the next access re-fetches. Returns count invalidated. */
		invalidate: (namespace: string, slug: string, version?: string): Promise<number> =>
			this._cache.invalidate(namespace, slug, version),
		/** Remove expired cache entries and garbage-collect unreferenced blobs. */
		clean: (): Promise<void> => this._cache.clean(),
		/** Remove all cached data. */
		purge: (): Promise<void> => this._cache.purge(),
	};
}
