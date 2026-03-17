import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { BundleCache } from "../src/cache.js";
import type { BundleResolveOutput } from "../src/types.js";

const FIXTURE_MANIFEST: BundleResolveOutput = {
	bundleId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
	versionId: "f1e2d3c4-b5a6-7890-abcd-ef1234567890",
	namespace: "acme",
	slug: "test-bundle",
	ref: "acme/test-bundle",
	version: "1.0.0",
	sourceType: "registry",
	state: "published",
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
		cache = new BundleCache(tempDir, 3600);
	});

	afterEach(async () => {
		await rm(tempDir, { recursive: true, force: true });
	});

	it("writes and loads a bundle", async () => {
		const assets = new Map([["hello.txt", "Hello, World!"]]);
		const cached = await cache.write(FIXTURE_MANIFEST, assets);

		expect(cached.ref).toBe("acme/test-bundle");
		expect(cached.version).toBe("1.0.0");

		const loaded = await cache.load("acme", "test-bundle", "1.0.0");
		expect(loaded).not.toBeNull();
		expect(loaded?.ref).toBe("acme/test-bundle");
		expect(loaded?.version).toBe("1.0.0");
		expect(loaded?.assets.size).toBe(1);

		const asset = loaded?.getAsset("hello.txt");
		expect(asset?.content).toBe("Hello, World!");
		expect(asset?.assetType).toBe("prompt");
	});

	it("returns null for missing cache entry", async () => {
		const loaded = await cache.load("acme", "nonexistent", "1.0.0");
		expect(loaded).toBeNull();
	});

	it("checks freshness correctly", async () => {
		const assets = new Map([["hello.txt", "Hello, World!"]]);
		await cache.write(FIXTURE_MANIFEST, assets);

		const fresh = await cache.isFresh("acme", "test-bundle", "1.0.0");
		expect(fresh).toBe(true);

		const stale = await cache.isFresh("acme", "test-bundle", "2.0.0");
		expect(stale).toBe(false);
	});

	it("getAssetsByType filters correctly", async () => {
		const assets = new Map([["hello.txt", "Hello, World!"]]);
		await cache.write(FIXTURE_MANIFEST, assets);

		const loaded = await cache.load("acme", "test-bundle", "1.0.0");
		const prompts = loaded?.getAssetsByType("prompt");
		expect(prompts).toHaveLength(1);

		const configs = loaded?.getAssetsByType("config");
		expect(configs).toHaveLength(0);
	});

	it("purge removes all cached data", async () => {
		const assets = new Map([["hello.txt", "Hello, World!"]]);
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
});
