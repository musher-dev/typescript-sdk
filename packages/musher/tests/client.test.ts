import { describe, expect, it } from "vitest";
import { MusherClient } from "../src/client.js";
import { MushError } from "../src/errors.js";

describe("MusherClient", () => {
	it("creates with default config", () => {
		const client = new MusherClient();
		expect(client.hub).toBeDefined();
		expect(client.bundles).toBeDefined();
		expect(client.cache).toBeDefined();
	});

	it("creates with custom config", () => {
		const client = new MusherClient({
			baseUrl: "https://custom.api.dev",
			apiKey: "test-key",
			cacheTtlSeconds: 7200,
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
		await expect(client.pull("too/many/parts")).rejects.toThrow(MushError);
		await expect(client.pull("/missing-namespace")).rejects.toThrow(MushError);
	});

	it("rejects invalid ref in load()", async () => {
		const client = new MusherClient();
		await expect(client.load("bad")).rejects.toThrow(MushError);
	});
});
