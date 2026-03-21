import { existsSync } from "node:fs";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { BundleCache } from "../src/cache.js";
import { Bundle } from "../src/bundle.js";
import type { BundleResolveOutput } from "../src/types.js";

const REGISTRY_URL = "https://api.musher.dev";

const FIXTURE_MANIFEST: BundleResolveOutput = {
	bundleId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
	versionId: "f1e2d3c4-b5a6-7890-abcd-ef1234567890",
	namespace: "acme",
	slug: "test-bundle",
	ref: "acme/test-bundle",
	version: "1.0.0",
	sourceType: "registry",
	state: "published",
	ociDigest: "sha256:abc123",
	manifest: {
		layers: [
			{
				assetId: "asset-001",
				logicalPath: "hello.txt",
				assetType: "prompt",
				// SHA256 of "Hello, World!"
				contentSha256: "dffd6021bb2bd5b0af676290809ec3a53191dd81c7f70a4b28688a362182986f",
				sizeBytes: 13,
			},
		],
	},
};

describe("BundleCache", () => {
	let tempDir: string;
	let cache: BundleCache;

	beforeEach(async () => {
		tempDir = await mkdtemp(join(tmpdir(), "musher-cache-test-"));
		cache = new BundleCache(tempDir, REGISTRY_URL, 86400, 300);
	});

	afterEach(async () => {
		await rm(tempDir, { recursive: true, force: true });
	});

	it("writes and loads a bundle via content-addressable blobs", async () => {
		const assets = new Map([["hello.txt", Buffer.from("Hello, World!")]]);
		const cached = await cache.write(FIXTURE_MANIFEST, assets);

		expect(cached.ref).toBe("acme/test-bundle");
		expect(cached.version).toBe("1.0.0");

		const loaded = await cache.load("acme", "test-bundle", "1.0.0");
		expect(loaded).not.toBeNull();
		expect(loaded).toBeInstanceOf(Bundle);
		expect(loaded?.ref.toString()).toBe("acme/test-bundle");
		expect(loaded?.version).toBe("1.0.0");
		expect(loaded?.files()).toHaveLength(1);

		const file = loaded?.file("hello.txt");
		expect(file?.text()).toBe("Hello, World!");
		expect(file?.assetType).toBe("prompt");
	});

	it("accepts string values in write() for backwards compat", async () => {
		const assets = new Map<string, Buffer | string>([["hello.txt", "Hello, World!"]]);
		const cached = await cache.write(FIXTURE_MANIFEST, assets);
		expect(cached.ref).toBe("acme/test-bundle");

		const loaded = await cache.load("acme", "test-bundle", "1.0.0");
		expect(loaded?.file("hello.txt")?.text()).toBe("Hello, World!");
	});

	it("returns null for missing cache entry", async () => {
		const loaded = await cache.load("acme", "nonexistent", "1.0.0");
		expect(loaded).toBeNull();
	});

	it("checks freshness correctly", async () => {
		const assets = new Map([["hello.txt", Buffer.from("Hello, World!")]]);
		await cache.write(FIXTURE_MANIFEST, assets);

		const fresh = await cache.isFresh("acme", "test-bundle", "1.0.0");
		expect(fresh).toBe(true);

		const stale = await cache.isFresh("acme", "test-bundle", "2.0.0");
		expect(stale).toBe(false);
	});

	it("deprecated getAssetsByType still works via Bundle", async () => {
		const assets = new Map([["hello.txt", Buffer.from("Hello, World!")]]);
		await cache.write(FIXTURE_MANIFEST, assets);

		const loaded = await cache.load("acme", "test-bundle", "1.0.0");
		const prompts = loaded?.getAssetsByType("prompt");
		expect(prompts).toHaveLength(1);

		const configs = loaded?.getAssetsByType("config");
		expect(configs).toHaveLength(0);
	});

	it("purge removes all cached data", async () => {
		const assets = new Map([["hello.txt", Buffer.from("Hello, World!")]]);
		await cache.write(FIXTURE_MANIFEST, assets);
		await cache.purge();

		const loaded = await cache.load("acme", "test-bundle", "1.0.0");
		expect(loaded).toBeNull();
	});

	it("clean is safe on empty cache", async () => {
		await expect(cache.clean()).resolves.toBeUndefined();
	});

	it("purge is safe on empty cache", async () => {
		await expect(cache.purge()).resolves.toBeUndefined();
	});

	// -- New tests for storage spec alignment --

	describe("CACHEDIR.TAG", () => {
		it("creates CACHEDIR.TAG on first write", async () => {
			const assets = new Map([["hello.txt", Buffer.from("Hello, World!")]]);
			await cache.write(FIXTURE_MANIFEST, assets);

			const tagPath = join(tempDir, "CACHEDIR.TAG");
			expect(existsSync(tagPath)).toBe(true);

			const content = await readFile(tagPath, "utf-8");
			expect(content).toContain("Signature: 8a477f597d28d172789f06886806bc55");
		});
	});

	describe("content-addressable blobs", () => {
		it("stores blobs under blobs/sha256/{prefix}/{digest}", async () => {
			const assets = new Map([["hello.txt", Buffer.from("Hello, World!")]]);
			await cache.write(FIXTURE_MANIFEST, assets);

			const digest = "dffd6021bb2bd5b0af676290809ec3a53191dd81c7f70a4b28688a362182986f";
			const blobPath = join(tempDir, "blobs", "sha256", "df", digest);
			expect(existsSync(blobPath)).toBe(true);

			const content = await readFile(blobPath);
			expect(content.toString("utf-8")).toBe("Hello, World!");
		});

		it("deduplicates blobs with identical content", async () => {
			const assets = new Map([["hello.txt", Buffer.from("Hello, World!")]]);
			await cache.write(FIXTURE_MANIFEST, assets);

			// Write a second bundle with the same asset content
			const manifest2: BundleResolveOutput = {
				...FIXTURE_MANIFEST,
				bundleId: "b2b2c3d4-e5f6-7890-abcd-ef1234567890",
				versionId: "g1e2d3c4-b5a6-7890-abcd-ef1234567890",
				version: "2.0.0",
			};
			await cache.write(manifest2, assets);

			// Should have only one blob file for "df" prefix
			const prefixDir = join(tempDir, "blobs", "sha256", "df");
			const files = await readdir(prefixDir);
			expect(files).toHaveLength(1);
		});
	});

	describe("host-id partitioning", () => {
		it("isolates cache by registry URL", async () => {
			const cache2 = new BundleCache(tempDir, "https://staging.musher.dev", 86400, 300);

			const assets = new Map([["hello.txt", Buffer.from("Hello, World!")]]);
			await cache.write(FIXTURE_MANIFEST, assets);
			await cache2.write(FIXTURE_MANIFEST, assets);

			// Both should have manifests in different host dirs
			const prodManifest = join(
				tempDir,
				"manifests",
				"api.musher.dev",
				"acme",
				"test-bundle",
				"1.0.0.json",
			);
			const stagingManifest = join(
				tempDir,
				"manifests",
				"staging.musher.dev",
				"acme",
				"test-bundle",
				"1.0.0.json",
			);
			expect(existsSync(prodManifest)).toBe(true);
			expect(existsSync(stagingManifest)).toBe(true);
		});

		it("sanitizes host with port", async () => {
			const localCache = new BundleCache(tempDir, "http://localhost:8080", 86400, 300);
			const assets = new Map([["hello.txt", Buffer.from("Hello, World!")]]);
			await localCache.write(FIXTURE_MANIFEST, assets);

			const manifestDir = join(tempDir, "manifests", "localhost_8080");
			expect(existsSync(manifestDir)).toBe(true);
		});
	});

	describe("manifest storage", () => {
		it("stores manifests under manifests/{host-id}/{ns}/{slug}/{version}.json", async () => {
			const assets = new Map([["hello.txt", Buffer.from("Hello, World!")]]);
			await cache.write(FIXTURE_MANIFEST, assets);

			const mPath = join(
				tempDir,
				"manifests",
				"api.musher.dev",
				"acme",
				"test-bundle",
				"1.0.0.json",
			);
			expect(existsSync(mPath)).toBe(true);

			const content = JSON.parse(await readFile(mPath, "utf-8"));
			expect(content.namespace).toBe("acme");
			expect(content.slug).toBe("test-bundle");
		});

		it("preserves ociDigest in meta.json", async () => {
			const assets = new Map([["hello.txt", Buffer.from("Hello, World!")]]);
			await cache.write(FIXTURE_MANIFEST, assets);

			const metaPath = join(
				tempDir,
				"manifests",
				"api.musher.dev",
				"acme",
				"test-bundle",
				"1.0.0.meta.json",
			);
			const meta = JSON.parse(await readFile(metaPath, "utf-8"));
			expect(meta.ociDigest).toBe("sha256:abc123");
			expect(meta.ttlSeconds).toBe(86400);
			expect(meta.fetchedAt).toBeDefined();
		});
	});

	describe("ref caching", () => {
		it("caches and resolves refs", async () => {
			await cache.cacheRef("acme", "test-bundle", "latest", "1.0.0");
			const version = await cache.resolveRef("acme", "test-bundle", "latest");
			expect(version).toBe("1.0.0");
		});

		it("returns null for expired refs", async () => {
			// Create cache with 0-second ref TTL
			const shortCache = new BundleCache(tempDir, REGISTRY_URL, 86400, 0);
			await shortCache.cacheRef("acme", "test-bundle", "latest", "1.0.0");

			// Should be expired immediately
			const version = await shortCache.resolveRef("acme", "test-bundle", "latest");
			expect(version).toBeNull();
		});

		it("returns null for missing refs", async () => {
			const version = await cache.resolveRef("acme", "nonexistent", "latest");
			expect(version).toBeNull();
		});

		it("stores refs under refs/{host-id}/{ns}/{slug}/{ref}.json", async () => {
			await cache.cacheRef("acme", "test-bundle", "latest", "1.0.0");

			const refPath = join(tempDir, "refs", "api.musher.dev", "acme", "test-bundle", "latest.json");
			expect(existsSync(refPath)).toBe(true);
		});
	});

	describe("atomic writes", () => {
		it("uses temp/ subdirectory for staging", async () => {
			const assets = new Map([["hello.txt", Buffer.from("Hello, World!")]]);
			await cache.write(FIXTURE_MANIFEST, assets);

			// temp/ dir should exist (created during atomic writes)
			const tempPath = join(tempDir, "temp");
			expect(existsSync(tempPath)).toBe(true);
		});
	});

	describe("clean with blob GC", () => {
		it("removes expired manifests and garbage-collects orphaned blobs", async () => {
			// Create cache with 0-second TTL so entries expire immediately
			const expiring = new BundleCache(tempDir, REGISTRY_URL, 0, 0);
			const assets = new Map([["hello.txt", Buffer.from("Hello, World!")]]);
			await expiring.write(FIXTURE_MANIFEST, assets);

			// Verify blob exists before clean
			const digest = "dffd6021bb2bd5b0af676290809ec3a53191dd81c7f70a4b28688a362182986f";
			const blobPath = join(tempDir, "blobs", "sha256", "df", digest);
			expect(existsSync(blobPath)).toBe(true);

			await expiring.clean();

			// Manifest should be removed
			const mPath = join(
				tempDir,
				"manifests",
				"api.musher.dev",
				"acme",
				"test-bundle",
				"1.0.0.json",
			);
			expect(existsSync(mPath)).toBe(false);

			// Orphaned blob should be garbage-collected
			expect(existsSync(blobPath)).toBe(false);
		});

		it("preserves blobs referenced by surviving manifests", async () => {
			const assets = new Map([["hello.txt", Buffer.from("Hello, World!")]]);
			// Use long TTL so this survives
			await cache.write(FIXTURE_MANIFEST, assets);

			await cache.clean();

			const digest = "dffd6021bb2bd5b0af676290809ec3a53191dd81c7f70a4b28688a362182986f";
			const blobPath = join(tempDir, "blobs", "sha256", "df", digest);
			expect(existsSync(blobPath)).toBe(true);
		});
	});
});
