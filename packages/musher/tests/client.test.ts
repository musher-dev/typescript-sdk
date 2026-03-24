import { describe, expect, it } from "vitest";
import { MusherClient } from "../src/client.js";
import { MushError } from "../src/errors.js";

const INVALID_BUNDLE_REF_RE = /Invalid bundle ref/;

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
		await expect(client.pull("invalid-ref")).rejects.toThrow(MushError);
		await expect(client.pull("/missing-namespace")).rejects.toThrow(MushError);
		await expect(client.pull("")).rejects.toThrow(MushError);
	});

	it("rejects invalid ref in load()", async () => {
		const client = new MusherClient();
		await expect(client.load("bad")).rejects.toThrow(MushError);
	});

	it("accepts versioned refs in pull()", async () => {
		const client = new MusherClient();
		// Will fail due to network, but should not throw a ref parse error
		await expect(client.pull("acme/bundle:1.0.0")).rejects.not.toThrow(INVALID_BUNDLE_REF_RE);
	});
});
