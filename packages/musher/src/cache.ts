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

import { createHash, randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, rename, rm, stat, unlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { Bundle } from "./bundle.js";
import { CacheError, IntegrityError } from "./errors.js";
import type { BundleResolveOutput, CacheEntry, CacheStats, CachedBundle } from "./types.js";

const JSON_EXT_RE = /\.json$/;

interface CacheMeta {
	fetchedAt: string;
	ttlSeconds: number;
	ociDigest?: string | undefined;
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
		if (existsSync(target)) {
			return digest;
		}

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

	/** Read cache metadata for an entry. Returns null if missing or corrupt. */
	private async readMeta(
		namespace: string,
		slug: string,
		version: string,
	): Promise<CacheMeta | null> {
		try {
			const raw = await readFile(this.metaPath(namespace, slug, version), "utf-8");
			return JSON.parse(raw) as CacheMeta;
		} catch {
			return null;
		}
	}

	/** Check if a cached manifest is still fresh. */
	async isFresh(namespace: string, slug: string, version: string): Promise<boolean> {
		const meta = await this.readMeta(namespace, slug, version);
		if (!meta) {
			return false;
		}
		const fetchedAt = new Date(meta.fetchedAt).getTime();
		const ttl = (meta.ttlSeconds ?? this.manifestTtlSeconds) * 1000;
		return Date.now() - fetchedAt < ttl;
	}

	/** Load only the manifest JSON (no blob content). Returns null if not cached. */
	async loadManifest(
		namespace: string,
		slug: string,
		version: string,
	): Promise<BundleResolveOutput | null> {
		const mPath = this.manifestPath(namespace, slug, version);

		if (!existsSync(mPath)) {
			return null;
		}

		try {
			const raw = await readFile(mPath, "utf-8");
			return JSON.parse(raw) as BundleResolveOutput;
		} catch {
			return null;
		}
	}

	// -- Write --------------------------------------------------------------------

	/** Write only the manifest and metadata to the cache (no blobs). */
	async writeManifest(manifest: BundleResolveOutput): Promise<void> {
		try {
			await this.ensureCacheDirTag();

			const mPath = this.manifestPath(manifest.namespace, manifest.slug, manifest.version);
			await this.atomicWrite(mPath, Buffer.from(JSON.stringify(manifest, null, 2)));

			const meta: CacheMeta = {
				fetchedAt: new Date().toISOString(),
				ttlSeconds: this.manifestTtlSeconds,
				ociDigest: manifest.ociDigest ?? undefined,
			};
			const metPath = this.metaPath(manifest.namespace, manifest.slug, manifest.version);
			await this.atomicWrite(metPath, Buffer.from(JSON.stringify(meta, null, 2)));
		} catch (error) {
			throw new CacheError(
				`Failed to write manifest cache: ${error instanceof Error ? error.message : String(error)}`,
				{ cause: error instanceof Error ? error : undefined },
			);
		}
	}

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

			// Write manifest + metadata
			await this.writeManifest(manifest);

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

		if (!existsSync(mPath)) {
			return null;
		}

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
			if (error instanceof IntegrityError) {
				throw error;
			}
			throw new CacheError(
				`Failed to load cache: ${error instanceof Error ? error.message : String(error)}`,
				{ cause: error instanceof Error ? error : undefined },
			);
		}
	}

	// -- Inspection & management --------------------------------------------------

	/** Build a CacheEntry from a manifest file and its metadata. */
	private async buildCacheEntry(
		namespace: string,
		slug: string,
		version: string,
	): Promise<CacheEntry | null> {
		const meta = await this.readMeta(namespace, slug, version);
		if (!meta) {
			return null;
		}

		const manifest = await this.loadManifest(namespace, slug, version);
		const sizeBytes = manifest?.manifest?.layers?.reduce((sum, l) => sum + l.sizeBytes, 0) ?? 0;

		const fetchedAt = new Date(meta.fetchedAt).getTime();
		const ttl = (meta.ttlSeconds ?? this.manifestTtlSeconds) * 1000;

		return {
			namespace,
			slug,
			version,
			fetchedAt: meta.fetchedAt,
			ttlSeconds: meta.ttlSeconds,
			fresh: Date.now() - fetchedAt < ttl,
			ociDigest: meta.ociDigest,
			sizeBytes,
		};
	}

	/** Collect cache entries from a single slug directory. */
	private async collectSlugEntries(
		namespace: string,
		slug: string,
		slugDir: string,
		entries: CacheEntry[],
	): Promise<void> {
		for (const file of await safeReaddir(slugDir)) {
			if (!isManifestFile(file)) {
				continue;
			}
			const version = file.replace(JSON_EXT_RE, "");
			const entry = await this.buildCacheEntry(namespace, slug, version);
			if (entry) {
				entries.push(entry);
			}
		}
	}

	/** List all cached bundle entries for this registry host. */
	async list(): Promise<CacheEntry[]> {
		try {
			const entries: CacheEntry[] = [];
			const hostManifests = join(this.cacheDir, "manifests", this.hostId);

			if (!existsSync(hostManifests)) {
				return entries;
			}

			for (const ns of await listSubdirs(hostManifests)) {
				for (const slug of await listSubdirs(ns.path)) {
					await this.collectSlugEntries(ns.name, slug.name, slug.path, entries);
				}
			}

			return entries;
		} catch (error) {
			throw new CacheError(
				`Failed to list cache: ${error instanceof Error ? error.message : String(error)}`,
				{ cause: error instanceof Error ? error : undefined },
			);
		}
	}

	/** Check if a bundle is cached and whether it is fresh. */
	async has(
		namespace: string,
		slug: string,
		version?: string,
	): Promise<{ cached: boolean; fresh: boolean }> {
		try {
			if (version) {
				const mPath = this.manifestPath(namespace, slug, version);
				if (!existsSync(mPath)) {
					return { cached: false, fresh: false };
				}
				const fresh = await this.isFresh(namespace, slug, version);
				return { cached: true, fresh };
			}

			const versions = await this.listVersionFiles(namespace, slug);

			if (versions.length === 0) {
				return { cached: false, fresh: false };
			}

			for (const v of versions) {
				if (await this.isFresh(namespace, slug, v)) {
					return { cached: true, fresh: true };
				}
			}
			return { cached: true, fresh: false };
		} catch {
			return { cached: false, fresh: false };
		}
	}

	/** Remove cached data for a specific bundle. Returns count of manifests removed. */
	async remove(namespace: string, slug: string, version?: string): Promise<number> {
		try {
			if (version) {
				return await this.removeVersion(namespace, slug, version);
			}
			return await this.removeAllVersions(namespace, slug);
		} catch (error) {
			throw new CacheError(
				`Failed to remove cache entry: ${error instanceof Error ? error.message : String(error)}`,
				{ cause: error instanceof Error ? error : undefined },
			);
		}
	}

	private async removeVersion(namespace: string, slug: string, version: string): Promise<number> {
		const mPath = this.manifestPath(namespace, slug, version);
		if (!existsSync(mPath)) {
			return 0;
		}
		await safeRm(mPath);
		await safeRm(this.metaPath(namespace, slug, version));
		return 1;
	}

	private async removeAllVersions(namespace: string, slug: string): Promise<number> {
		let removed = 0;
		const dir = this.manifestDir(namespace, slug);
		for (const f of await safeReaddir(dir)) {
			if (isManifestFile(f)) {
				const v = f.replace(JSON_EXT_RE, "");
				await safeRm(join(dir, f));
				await safeRm(join(dir, `${v}.meta.json`));
				removed++;
			}
		}
		// Also remove corresponding refs
		const refDir = join(this.cacheDir, "refs", this.hostId, namespace, slug);
		if (existsSync(refDir)) {
			await rm(refDir, { recursive: true, force: true });
		}
		return removed;
	}

	/** Get aggregate cache statistics (across all hosts). */
	async stats(): Promise<CacheStats> {
		try {
			let entryCount = 0;
			let freshCount = 0;
			let staleCount = 0;
			let refCount = 0;

			await walkCacheTree(join(this.cacheDir, "manifests"), async (ns, slug, _slugDir, file) => {
				if (!isManifestFile(file)) {
					return;
				}
				entryCount++;
				const version = file.replace(JSON_EXT_RE, "");
				if (await this.isFresh(ns, slug, version)) {
					freshCount++;
				} else {
					staleCount++;
				}
			});

			const { blobCount, blobSizeBytes } = await computeBlobStats(this.cacheDir);

			await walkCacheTree(join(this.cacheDir, "refs"), async (_ns, _slug, _slugDir, file) => {
				if (file.endsWith(".json")) {
					refCount++;
				}
			});

			return { entryCount, freshCount, staleCount, blobSizeBytes, blobCount, refCount };
		} catch (error) {
			throw new CacheError(
				`Failed to compute cache stats: ${error instanceof Error ? error.message : String(error)}`,
				{ cause: error instanceof Error ? error : undefined },
			);
		}
	}

	/** Mark entries as stale so the next access re-fetches. Returns count invalidated. */
	async invalidate(namespace: string, slug: string, version?: string): Promise<number> {
		try {
			const versions = version ? [version] : await this.listVersionFiles(namespace, slug);

			let count = 0;
			for (const v of versions) {
				if (await this.invalidateVersion(namespace, slug, v)) {
					count++;
				}
			}

			await this.invalidateRefs(namespace, slug);
			return count;
		} catch (error) {
			throw new CacheError(
				`Failed to invalidate cache: ${error instanceof Error ? error.message : String(error)}`,
				{ cause: error instanceof Error ? error : undefined },
			);
		}
	}

	private async invalidateVersion(
		namespace: string,
		slug: string,
		version: string,
	): Promise<boolean> {
		const meta = await this.readMeta(namespace, slug, version);
		if (!meta) {
			return false;
		}
		const updated: CacheMeta = { ...meta, fetchedAt: "1970-01-01T00:00:00.000Z" };
		const metPath = this.metaPath(namespace, slug, version);
		await this.atomicWrite(metPath, Buffer.from(JSON.stringify(updated, null, 2)));
		return true;
	}

	private async invalidateRefs(namespace: string, slug: string): Promise<void> {
		const refDir = join(this.cacheDir, "refs", this.hostId, namespace, slug);
		for (const f of await safeReaddir(refDir)) {
			if (!f.endsWith(".json")) {
				continue;
			}
			try {
				const raw = await readFile(join(refDir, f), "utf-8");
				const entry: RefEntry = JSON.parse(raw);
				entry.fetchedAt = "1970-01-01T00:00:00.000Z";
				await this.atomicWrite(join(refDir, f), Buffer.from(JSON.stringify(entry, null, 2)));
			} catch {
				/* skip corrupt */
			}
		}
	}

	/** List version strings from manifest files in a slug directory. */
	private async listVersionFiles(namespace: string, slug: string): Promise<string[]> {
		const dir = this.manifestDir(namespace, slug);
		const files = await safeReaddir(dir);
		return files.filter((f) => isManifestFile(f)).map((f) => f.replace(JSON_EXT_RE, ""));
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
		await walkCacheTree(join(this.cacheDir, "manifests"), async (ns, slug, slugDir, file) => {
			if (!file.endsWith(".json") || file.endsWith(".meta.json")) {
				return;
			}

			const version = file.replace(JSON_EXT_RE, "");
			const fresh = await this.isFresh(ns, slug, version);

			if (fresh) {
				await this.collectDigests(join(slugDir, file), referencedDigests);
			} else {
				await safeRm(join(slugDir, file));
				await safeRm(join(slugDir, `${version}.meta.json`));
			}
		});
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
		await walkCacheTree(join(this.cacheDir, "refs"), async (ns, slug, slugDir, file) => {
			if (!file.endsWith(".json")) {
				return;
			}
			const ref = file.replace(JSON_EXT_RE, "");
			const version = await this.resolveRef(ns, slug, ref);
			if (version === null) {
				await safeRm(join(slugDir, file));
			}
		});
	}

	/** Remove blobs not referenced by any surviving manifest. */
	private async gcBlobs(referencedDigests: Set<string>): Promise<void> {
		const blobsRoot = join(this.cacheDir, "blobs", "sha256");
		if (!existsSync(blobsRoot)) {
			return;
		}

		for (const prefix of await safeReaddir(blobsRoot)) {
			const prefixDir = join(blobsRoot, prefix);
			if (!(await isDir(prefixDir))) {
				continue;
			}

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

/** Check if a filename is a manifest JSON (not a .meta.json). */
function isManifestFile(file: string): boolean {
	return file.endsWith(".json") && !file.endsWith(".meta.json");
}

/** Compute total blob count and size on disk. */
async function computeBlobStats(
	cacheDir: string,
): Promise<{ blobCount: number; blobSizeBytes: number }> {
	let blobCount = 0;
	let blobSizeBytes = 0;

	const blobsRoot = join(cacheDir, "blobs", "sha256");
	if (!existsSync(blobsRoot)) {
		return { blobCount, blobSizeBytes };
	}

	for (const prefix of await safeReaddir(blobsRoot)) {
		const prefixDir = join(blobsRoot, prefix);
		if (!(await isDir(prefixDir))) {
			continue;
		}
		for (const digest of await safeReaddir(prefixDir)) {
			blobCount++;
			const s = await stat(join(prefixDir, digest));
			blobSizeBytes += s.size;
		}
	}

	return { blobCount, blobSizeBytes };
}

function computeHostId(registryUrl: string): string {
	try {
		const url = new URL(registryUrl);
		return url.host.replace(/[:/]/g, "_");
	} catch {
		return registryUrl.replace(/[:/]/g, "_");
	}
}

/** List subdirectories of a directory. */
async function listSubdirs(parent: string): Promise<Array<{ name: string; path: string }>> {
	const result: Array<{ name: string; path: string }> = [];
	for (const name of await safeReaddir(parent)) {
		const p = join(parent, name);
		if (await isDir(p)) {
			result.push({ name, path: p });
		}
	}
	return result;
}

/** Walk a host/ns/slug cache directory tree, calling visitor for each file in slug dirs. */
async function walkCacheTree(
	root: string,
	visitor: (ns: string, slug: string, slugDir: string, file: string) => Promise<void>,
): Promise<void> {
	if (!existsSync(root)) {
		return;
	}

	for (const host of await listSubdirs(root)) {
		for (const ns of await listSubdirs(host.path)) {
			for (const slug of await listSubdirs(ns.path)) {
				for (const file of await safeReaddir(slug.path)) {
					await visitor(ns.name, slug.name, slug.path, file);
				}
			}
		}
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
