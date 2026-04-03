import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { MusherClient } from "../src/client.js";
import { AuthenticationError, ForbiddenError, MusherError } from "../src/errors.js";

const INVALID_BUNDLE_REF_RE = /Invalid bundle ref/;

function makeProblem(status: number, title: string) {
	return { type: "about:blank", title, status, detail: title };
}

function makePullOutput(ns: string, slug: string, version: string) {
	return {
		namespace: ns,
		slug,
		version,
		name: `${ns}/${slug}`,
		description: null,
		manifest: [
			{
				logicalPath: "skills/greet/SKILL.md",
				assetType: "skill",
				contentText: "# Greet\nSay hello",
				mediaType: "text/markdown",
			},
		],
	};
}

function makeResolveOutput(ns: string, slug: string, version: string) {
	return {
		bundleId: "00000000-0000-0000-0000-000000000001",
		versionId: "00000000-0000-0000-0000-000000000002",
		namespace: ns,
		slug,
		ref: `${ns}/${slug}`,
		version,
		sourceType: "registry" as const,
		state: "published" as const,
		manifest: { layers: [] },
	};
}

async function makeTempClient() {
	const cacheDir = await mkdtemp(join(tmpdir(), "musher-test-"));
	return new MusherClient({ cacheDir });
}

describe("MusherClient", () => {
	it("creates with default config", () => {
		const client = new MusherClient();
		expect(client.bundles).toBeDefined();
		expect(client.cache).toBeDefined();
	});

	it("creates with custom config", () => {
		const client = new MusherClient({
			baseUrl: "https://custom.api.dev",
			apiKey: "test-key",
			manifestTtlSeconds: 7200,
			refTtlSeconds: 120,
			timeout: 5000,
			retries: 1,
		});
		expect(client).toBeInstanceOf(MusherClient);
	});

	it("exposes cache.clean and cache.purge methods", () => {
		const client = new MusherClient();
		expect(typeof client.cache.clean).toBe("function");
		expect(typeof client.cache.purge).toBe("function");
	});

	it("rejects invalid ref in pull()", async () => {
		const client = new MusherClient();
		await expect(client.pull("invalid-ref")).rejects.toThrow(MusherError);
		await expect(client.pull("/missing-namespace")).rejects.toThrow(MusherError);
		await expect(client.pull("")).rejects.toThrow(MusherError);
	});

	it("accepts versioned refs in pull()", async () => {
		const client = new MusherClient();
		// Will fail due to network, but should not throw a ref parse error
		await expect(client.pull("acme/bundle:1.0.0")).rejects.not.toThrow(INVALID_BUNDLE_REF_RE);
	});

	describe("pullContent fallback", () => {
		it("falls back to hub pull when namespace :pull returns 401", async () => {
			const client = await makeTempClient();
			const pullOutput = makePullOutput("acme", "bundle", "1.0.0");

			vi.spyOn(client.bundles, "resolve").mockResolvedValue(
				makeResolveOutput("acme", "bundle", "1.0.0"),
			);
			vi.spyOn(client.bundles, "pullVersion").mockRejectedValue(
				new AuthenticationError(makeProblem(401, "Unauthorized")),
			);
			vi.spyOn(client.bundles, "pullHubVersion").mockResolvedValue(pullOutput);

			const bundle = await client.pull("acme/bundle:1.0.0");
			expect(bundle).toBeDefined();
			expect(client.bundles.pullHubVersion).toHaveBeenCalledWith("acme", "bundle", "1.0.0");
		});

		it("falls back to hub pull when namespace :pull returns 403", async () => {
			const client = await makeTempClient();
			const pullOutput = makePullOutput("acme", "bundle", "1.0.0");

			vi.spyOn(client.bundles, "resolve").mockResolvedValue(
				makeResolveOutput("acme", "bundle", "1.0.0"),
			);
			vi.spyOn(client.bundles, "pullVersion").mockRejectedValue(
				new ForbiddenError(makeProblem(403, "Forbidden")),
			);
			vi.spyOn(client.bundles, "pullHubVersion").mockResolvedValue(pullOutput);

			const bundle = await client.pull("acme/bundle:1.0.0");
			expect(bundle).toBeDefined();
			expect(client.bundles.pullHubVersion).toHaveBeenCalledWith("acme", "bundle", "1.0.0");
		});
	});

	describe("resolve fallback to hub", () => {
		it("pull() falls back to hub-only flow when resolve returns 401", async () => {
			const client = await makeTempClient();
			const pullOutput = makePullOutput("acme", "bundle", "1.0.0");

			vi.spyOn(client.bundles, "resolve").mockRejectedValue(
				new AuthenticationError(makeProblem(401, "Unauthorized")),
			);
			vi.spyOn(client.bundles, "pullHubVersion").mockResolvedValue(pullOutput);

			const bundle = await client.pull("acme/bundle:1.0.0");
			expect(bundle).toBeDefined();
			expect(bundle.files().length).toBe(1);
			expect(client.bundles.pullHubVersion).toHaveBeenCalledWith("acme", "bundle", "1.0.0");
		});

		it("resolve() falls back to hub pull for metadata when namespace resolve returns 401", async () => {
			const client = await makeTempClient();
			const pullOutput = makePullOutput("acme", "bundle", "1.0.0");

			vi.spyOn(client.bundles, "resolve").mockRejectedValue(
				new AuthenticationError(makeProblem(401, "Unauthorized")),
			);
			vi.spyOn(client.bundles, "pullHubVersion").mockResolvedValue(pullOutput);

			const resolved = await client.resolve("acme/bundle:1.0.0");
			expect(resolved).toBeDefined();
			expect(resolved.namespace).toBe("acme");
			expect(resolved.slug).toBe("bundle");
			expect(resolved.version).toBe("1.0.0");
			expect(resolved.manifest?.layers?.length).toBe(1);
			expect(client.bundles.pullHubVersion).toHaveBeenCalledWith("acme", "bundle", "1.0.0");
		});
	});
});
