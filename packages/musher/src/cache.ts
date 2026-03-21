/**
 * Content-addressable, host-partitioned disk cache for resolved bundles.
 *
 * Layout:
 *   {cacheDir}/
 *     CACHEDIR.TAG
 *     blobs/sha256/{prefix}/{digest}
 *     manifests/{host-id}/{ns}/{slug}/{version}.json
 *     manifests/{host-id}/{ns}/{slug}/{version}.meta.json
 *     refs/{host-id}/{ns}/{slug}/{ref}.json
 *     temp/
 */

import { randomUUID, createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, rename, rm, stat, unlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { Bundle } from "./bundle.js";
import { CacheError, IntegrityError } from "./errors.js";
import type { BundleResolveOutput, CachedBundle } from "./types.js";

interface CacheMeta {
	fetchedAt: string;
	ttlSeconds: number;
	ociDigest?: string;
}

interface RefEntry {
	version: string;
	fetchedAt: string;
	ttlSeconds: number;
}

const CACHEDIR_TAG_CONTENT = `Signature: 8a477f597d28d172789f06886806bc55
# This file is a cache directory tag created by musher.
# For information, see https://bford.info/cachedir/spec.html
`;

export class BundleCache {
	private readonly hostId: string;

	constructor(
		private readonly cacheDir: string,
		registryUrl: string,
		private readonly manifestTtlSeconds: number,
		private readonly refTtlSeconds: number,
	) {
		this.hostId = computeHostId(registryUrl);
	}

	// -- Blob storage -------------------------------------------------------------

	private blobPath(digest: string): string {
		const prefix = digest.slice(0, 2);
		return join(this.cacheDir, "blobs", "sha256", prefix, digest);
	}

	private async writeBlob(content: Buffer): Promise<string> {
		const digest = createHash("sha256").update(content).digest("hex");
		const target = this.blobPath(digest);

		// Dedup: skip if blob already exists
		if (existsSync(target)) return digest;

		await this.atomicWrite(target, content);
		return digest;
	}

	// -- Manifest storage ---------------------------------------------------------

	private manifestDir(namespace: string, slug: string): string {
		return join(this.cacheDir, "manifests", this.hostId, namespace, slug);
	}

	private manifestPath(namespace: string, slug: string, version: string): string {
		return join(this.manifestDir(namespace, slug), `${version}.json`);
	}

	private metaPath(namespace: string, slug: string, version: string): string {
		return join(this.manifestDir(namespace, slug), `${version}.meta.json`);
	}

	// -- Ref storage --------------------------------------------------------------

	private refPath(namespace: string, slug: string, ref: string): string {
		return join(this.cacheDir, "refs", this.hostId, namespace, slug, `${ref}.json`);
	}

	/** Cache a ref → version mapping with TTL. */
	async cacheRef(namespace: string, slug: string, ref: string, version: string): Promise<void> {
		const entry: RefEntry = {
			version,
			fetchedAt: new Date().toISOString(),
			ttlSeconds: this.refTtlSeconds,
		};
		const target = this.refPath(namespace, slug, ref);
		await this.atomicWrite(target, Buffer.from(JSON.stringify(entry, null, 2)));
	}

	/** Resolve a cached ref → version if still fresh. Returns null if expired or missing. */
	async resolveRef(namespace: string, slug: string, ref: string): Promise<string | null> {
		try {
			const raw = await readFile(this.refPath(namespace, slug, ref), "utf-8");
			const entry: RefEntry = JSON.parse(raw);
			const fetchedAt = new Date(entry.fetchedAt).getTime();
			const ttl = (entry.ttlSeconds ?? this.refTtlSeconds) * 1000;
			if (Date.now() - fetchedAt < ttl) {
				return entry.version;
			}
			return null;
		} catch {
			return null;
		}
	}

	// -- Freshness ----------------------------------------------------------------

	/** Check if a cached manifest is still fresh. */
	async isFresh(namespace: string, slug: string, version: string): Promise<boolean> {
		try {
			const raw = await readFile(this.metaPath(namespace, slug, version), "utf-8");
			const meta: CacheMeta = JSON.parse(raw);
			const fetchedAt = new Date(meta.fetchedAt).getTime();
			const ttl = (meta.ttlSeconds ?? this.manifestTtlSeconds) * 1000;
			return Date.now() - fetchedAt < ttl;
		} catch {
			return false;
		}
	}

	// -- Write --------------------------------------------------------------------

	/** Write a resolved bundle and its assets to the cache. */
	async write(
		manifest: BundleResolveOutput,
		assets: Map<string, Buffer | string>,
	): Promise<CachedBundle> {
		try {
			await this.ensureCacheDirTag();

			// Write blobs (content-addressable)
			for (const [, content] of assets) {
				const buf = typeof content === "string" ? Buffer.from(content, "utf-8") : content;
				await this.writeBlob(buf);
			}

			// Write manifest
			const mPath = this.manifestPath(manifest.namespace, manifest.slug, manifest.version);
			await this.atomicWrite(mPath, Buffer.from(JSON.stringify(manifest, null, 2)));

			// Write metadata (with ociDigest preserved)
			const meta: CacheMeta = {
				fetchedAt: new Date().toISOString(),
				ttlSeconds: this.manifestTtlSeconds,
				ociDigest: manifest.ociDigest ?? undefined,
			};
			const metPath = this.metaPath(manifest.namespace, manifest.slug, manifest.version);
			await this.atomicWrite(metPath, Buffer.from(JSON.stringify(meta, null, 2)));

			return {
				ref: manifest.ref,
				version: manifest.version,
				cacheDir: this.manifestDir(manifest.namespace, manifest.slug),
				manifest,
			};
		} catch (error) {
			throw new CacheError(
				`Failed to write cache: ${error instanceof Error ? error.message : String(error)}`,
				{ cause: error instanceof Error ? error : undefined },
			);
		}
	}

	// -- Load ---------------------------------------------------------------------

	/** Load a cached bundle from disk, verifying SHA256 integrity. Returns a Bundle. */
	async load(namespace: string, slug: string, version: string): Promise<Bundle | null> {
		const mPath = this.manifestPath(namespace, slug, version);

		if (!existsSync(mPath)) return null;

		try {
			const raw = await readFile(mPath, "utf-8");
			const manifest: BundleResolveOutput = JSON.parse(raw);

			const contents = new Map<string, Buffer>();

			if (manifest.manifest?.layers) {
				for (const layer of manifest.manifest.layers) {
					const buf = await readFile(this.blobPath(layer.contentSha256));

					// Verify integrity using raw bytes
					const hash = createHash("sha256").update(buf).digest("hex");
					if (hash !== layer.contentSha256) {
						throw new IntegrityError(layer.contentSha256, hash);
					}

					contents.set(layer.logicalPath, buf);
				}
			}

			return new Bundle(manifest, contents);
		} catch (error) {
			if (error instanceof IntegrityError) throw error;
			throw new CacheError(
				`Failed to load cache: ${error instanceof Error ? error.message : String(error)}`,
				{ cause: error instanceof Error ? error : undefined },
			);
		}
	}

	// -- Cleanup ------------------------------------------------------------------

	/** Remove expired cache entries and garbage-collect unreferenced blobs. */
	async clean(): Promise<void> {
		try {
			const referencedDigests = new Set<string>();

			// Clean manifests and collect referenced digests from surviving ones
			await this.cleanManifests(referencedDigests);

			// Clean expired refs
			await this.cleanRefs();

			// Garbage-collect unreferenced blobs
			await this.gcBlobs(referencedDigests);

			// Remove legacy bundles/ directory if present
			await this.removeLegacy();
		} catch (error) {
			throw new CacheError(
				`Failed to clean cache: ${error instanceof Error ? error.message : String(error)}`,
				{ cause: error instanceof Error ? error : undefined },
			);
		}
	}

	/** Remove all cached data. */
	async purge(): Promise<void> {
		try {
			const dirs = ["manifests", "refs", "blobs", "temp", "bundles"];
			for (const dir of dirs) {
				const p = join(this.cacheDir, dir);
				if (existsSync(p)) {
					await rm(p, { recursive: true, force: true });
				}
			}
		} catch (error) {
			throw new CacheError(
				`Failed to purge cache: ${error instanceof Error ? error.message : String(error)}`,
				{ cause: error instanceof Error ? error : undefined },
			);
		}
	}

	// -- Internals ----------------------------------------------------------------

	/** Atomic write via temp file + rename. */
	private async atomicWrite(targetPath: string, data: Buffer): Promise<void> {
		const tempDir = join(this.cacheDir, "temp");
		await mkdir(tempDir, { recursive: true });

		const tempPath = join(tempDir, `${randomUUID()}.tmp`);

		try {
			await writeFile(tempPath, data);
			await mkdir(dirname(targetPath), { recursive: true });

			try {
				await rename(tempPath, targetPath);
			} catch {
				// Windows: rename fails if target exists — unlink then retry
				try {
					await unlink(targetPath);
				} catch {
					// Target may not exist, ignore
				}
				await rename(tempPath, targetPath);
			}
		} finally {
			// Clean up temp file if it still exists
			try {
				await unlink(tempPath);
			} catch {
				// Already moved or cleaned up
			}
		}
	}

	/** Write CACHEDIR.TAG if it doesn't exist. */
	private async ensureCacheDirTag(): Promise<void> {
		const tagPath = join(this.cacheDir, "CACHEDIR.TAG");
		if (!existsSync(tagPath)) {
			await mkdir(this.cacheDir, { recursive: true });
			await writeFile(tagPath, CACHEDIR_TAG_CONTENT);
		}
	}

	/** Walk manifests, remove expired, collect digests from surviving ones. */
	private async cleanManifests(referencedDigests: Set<string>): Promise<void> {
		const manifestsRoot = join(this.cacheDir, "manifests");
		if (!existsSync(manifestsRoot)) return;

		for (const hostId of await safeReaddir(manifestsRoot)) {
			const hostDir = join(manifestsRoot, hostId);
			if (!(await isDir(hostDir))) continue;

			for (const ns of await safeReaddir(hostDir)) {
				const nsDir = join(hostDir, ns);
				if (!(await isDir(nsDir))) continue;

				for (const slug of await safeReaddir(nsDir)) {
					const slugDir = join(nsDir, slug);
					if (!(await isDir(slugDir))) continue;

					for (const file of await safeReaddir(slugDir)) {
						if (!file.endsWith(".json") || file.endsWith(".meta.json")) continue;

						const version = file.replace(/\.json$/, "");
						const fresh = await this.isFresh(ns, slug, version);

						if (fresh) {
							// Collect blob digests from surviving manifest
							await this.collectDigests(join(slugDir, file), referencedDigests);
						} else {
							// Remove expired manifest + meta
							await safeRm(join(slugDir, file));
							await safeRm(join(slugDir, `${version}.meta.json`));
						}
					}
				}
			}
		}
	}

	/** Collect blob digests referenced by a manifest file. */
	private async collectDigests(manifestFile: string, digests: Set<string>): Promise<void> {
		try {
			const raw = await readFile(manifestFile, "utf-8");
			const manifest: BundleResolveOutput = JSON.parse(raw);
			if (manifest.manifest?.layers) {
				for (const layer of manifest.manifest.layers) {
					digests.add(layer.contentSha256);
				}
			}
		} catch {
			// Corrupt manifest — skip
		}
	}

	/** Walk refs and remove expired entries. */
	private async cleanRefs(): Promise<void> {
		const refsRoot = join(this.cacheDir, "refs");
		if (!existsSync(refsRoot)) return;

		for (const hostId of await safeReaddir(refsRoot)) {
			const hostDir = join(refsRoot, hostId);
			if (!(await isDir(hostDir))) continue;

			for (const ns of await safeReaddir(hostDir)) {
				const nsDir = join(hostDir, ns);
				if (!(await isDir(nsDir))) continue;

				for (const slug of await safeReaddir(nsDir)) {
					const slugDir = join(nsDir, slug);
					if (!(await isDir(slugDir))) continue;

					for (const file of await safeReaddir(slugDir)) {
						if (!file.endsWith(".json")) continue;
						const ref = file.replace(/\.json$/, "");
						const version = await this.resolveRef(ns, slug, ref);
						if (version === null) {
							await safeRm(join(slugDir, file));
						}
					}
				}
			}
		}
	}

	/** Remove blobs not referenced by any surviving manifest. */
	private async gcBlobs(referencedDigests: Set<string>): Promise<void> {
		const blobsRoot = join(this.cacheDir, "blobs", "sha256");
		if (!existsSync(blobsRoot)) return;

		for (const prefix of await safeReaddir(blobsRoot)) {
			const prefixDir = join(blobsRoot, prefix);
			if (!(await isDir(prefixDir))) continue;

			for (const digest of await safeReaddir(prefixDir)) {
				if (!referencedDigests.has(digest)) {
					await safeRm(join(prefixDir, digest));
				}
			}
		}
	}

	/** Remove legacy bundles/ directory if present. */
	private async removeLegacy(): Promise<void> {
		const legacyDir = join(this.cacheDir, "bundles");
		if (existsSync(legacyDir)) {
			await rm(legacyDir, { recursive: true, force: true });
		}
	}
}

// -- Helpers ------------------------------------------------------------------

function computeHostId(registryUrl: string): string {
	try {
		const url = new URL(registryUrl);
		return url.host.replace(/[:/]/g, "_");
	} catch {
		return registryUrl.replace(/[:/]/g, "_");
	}
}

async function isDir(path: string): Promise<boolean> {
	try {
		return (await stat(path)).isDirectory();
	} catch {
		return false;
	}
}

async function safeReaddir(path: string): Promise<string[]> {
	try {
		return await readdir(path);
	} catch {
		return [];
	}
}

async function safeRm(path: string): Promise<void> {
	try {
		await unlink(path);
	} catch {
		// Already removed or inaccessible
	}
}
