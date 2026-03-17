/**
 * XDG-compliant disk cache for resolved bundles.
 *
 * Layout:
 *   {cacheDir}/bundles/{namespace}/{slug}/{version}/
 *     manifest.json
 *     assets/{logicalPath}
 *     .meta.json
 */

import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { CacheError, IntegrityError } from "./errors.js";
import type { BundleResolveOutput, CachedBundle, LoadedAsset, LoadedBundle } from "./types.js";

interface CacheMeta {
	fetchedAt: string;
	ttlSeconds: number;
	ociDigest?: string;
}

export class BundleCache {
	constructor(
		private readonly cacheDir: string,
		private readonly ttlSeconds: number,
	) {}

	/** Get the cache directory for a specific bundle version. */
	private bundlePath(namespace: string, slug: string, version: string): string {
		return join(this.cacheDir, "bundles", namespace, slug, version);
	}

	/** Check if a cached bundle is still fresh. */
	async isFresh(namespace: string, slug: string, version: string): Promise<boolean> {
		const metaPath = join(this.bundlePath(namespace, slug, version), ".meta.json");
		try {
			const raw = await readFile(metaPath, "utf-8");
			const meta: CacheMeta = JSON.parse(raw);
			const fetchedAt = new Date(meta.fetchedAt).getTime();
			const ttl = (meta.ttlSeconds ?? this.ttlSeconds) * 1000;
			return Date.now() - fetchedAt < ttl;
		} catch {
			return false;
		}
	}

	/** Write a resolved bundle and its assets to the cache. */
	async write(manifest: BundleResolveOutput, assets: Map<string, string>): Promise<CachedBundle> {
		const dir = this.bundlePath(manifest.namespace, manifest.slug, manifest.version);

		try {
			await mkdir(join(dir, "assets"), { recursive: true });

			// Write manifest
			await writeFile(join(dir, "manifest.json"), JSON.stringify(manifest, null, 2));

			// Write assets
			for (const [logicalPath, content] of assets) {
				const assetPath = join(dir, "assets", logicalPath);
				await mkdir(dirname(assetPath), { recursive: true });
				await writeFile(assetPath, content);
			}

			// Write metadata
			const meta: CacheMeta = {
				fetchedAt: new Date().toISOString(),
				ttlSeconds: this.ttlSeconds,
				ociDigest: manifest.ociDigest ?? undefined,
			};
			await writeFile(join(dir, ".meta.json"), JSON.stringify(meta, null, 2));

			return {
				ref: manifest.ref,
				version: manifest.version,
				cacheDir: dir,
				manifest,
			};
		} catch (error) {
			throw new CacheError(
				`Failed to write cache: ${error instanceof Error ? error.message : String(error)}`,
				{ cause: error instanceof Error ? error : undefined },
			);
		}
	}

	/** Load a cached bundle from disk into memory, verifying SHA256 integrity. */
	async load(namespace: string, slug: string, version: string): Promise<LoadedBundle | null> {
		const dir = this.bundlePath(namespace, slug, version);
		const manifestPath = join(dir, "manifest.json");

		if (!existsSync(manifestPath)) return null;

		try {
			const raw = await readFile(manifestPath, "utf-8");
			const manifest: BundleResolveOutput = JSON.parse(raw);

			const assets = new Map<string, LoadedAsset>();

			if (manifest.manifest?.layers) {
				for (const layer of manifest.manifest.layers) {
					const assetPath = join(dir, "assets", layer.logicalPath);
					const content = await readFile(assetPath, "utf-8");

					// Verify integrity
					const hash = createHash("sha256").update(content).digest("hex");
					if (hash !== layer.contentSha256) {
						throw new IntegrityError(layer.contentSha256, hash);
					}

					assets.set(layer.logicalPath, {
						logicalPath: layer.logicalPath,
						assetType: layer.assetType,
						content,
						sha256: layer.contentSha256,
						mediaType: layer.mediaType ?? undefined,
					});
				}
			}

			const ref = `${namespace}/${slug}`;
			return {
				ref,
				version: manifest.version,
				assets,
				getAsset(path: string) {
					return assets.get(path);
				},
				getAssetsByType(type: string) {
					return [...assets.values()].filter((a) => a.assetType === type);
				},
			};
		} catch (error) {
			if (error instanceof IntegrityError) throw error;
			throw new CacheError(
				`Failed to load cache: ${error instanceof Error ? error.message : String(error)}`,
				{ cause: error instanceof Error ? error : undefined },
			);
		}
	}

	/** Remove expired cache entries. */
	async clean(): Promise<void> {
		const bundlesDir = join(this.cacheDir, "bundles");
		if (!existsSync(bundlesDir)) return;

		try {
			for (const ns of await readdir(bundlesDir)) {
				const nsDir = join(bundlesDir, ns);
				if (!(await stat(nsDir)).isDirectory()) continue;

				for (const slug of await readdir(nsDir)) {
					const slugDir = join(nsDir, slug);
					if (!(await stat(slugDir)).isDirectory()) continue;

					for (const version of await readdir(slugDir)) {
						const versionDir = join(slugDir, version);
						if (!(await stat(versionDir)).isDirectory()) continue;

						const isFresh = await this.isFresh(ns, slug, version);
						if (!isFresh) {
							await rm(versionDir, { recursive: true, force: true });
						}
					}
				}
			}
		} catch (error) {
			throw new CacheError(
				`Failed to clean cache: ${error instanceof Error ? error.message : String(error)}`,
				{ cause: error instanceof Error ? error : undefined },
			);
		}
	}

	/** Remove all cached data. */
	async purge(): Promise<void> {
		const bundlesDir = join(this.cacheDir, "bundles");
		if (!existsSync(bundlesDir)) return;

		try {
			await rm(bundlesDir, { recursive: true, force: true });
		} catch (error) {
			throw new CacheError(
				`Failed to purge cache: ${error instanceof Error ? error.message : String(error)}`,
				{ cause: error instanceof Error ? error : undefined },
			);
		}
	}
}
