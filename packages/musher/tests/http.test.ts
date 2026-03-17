import { describe, expect, it } from "vitest";
import { resolveConfig } from "../src/config.js";
import { HttpTransport } from "../src/http.js";

describe("HttpTransport", () => {
	it("can be instantiated with resolved config", () => {
		const config = resolveConfig({
			baseUrl: "https://test.api.dev",
			apiKey: "test-key",
		});
		const transport = new HttpTransport(config);
		expect(transport).toBeInstanceOf(HttpTransport);
	});
});

describe("resolveConfig", () => {
	it("applies defaults when no config provided", () => {
		const config = resolveConfig();
		expect(config.baseUrl).toBe("https://api.musher.dev");
		expect(config.cacheTtlSeconds).toBe(3600);
		expect(config.timeout).toBe(30_000);
		expect(config.retries).toBe(2);
	});

	it("overrides defaults with provided values", () => {
		const config = resolveConfig({
			baseUrl: "https://custom.dev",
			cacheTtlSeconds: 7200,
			timeout: 5000,
			retries: 0,
		});
		expect(config.baseUrl).toBe("https://custom.dev");
		expect(config.cacheTtlSeconds).toBe(7200);
		expect(config.timeout).toBe(5000);
		expect(config.retries).toBe(0);
	});
});
