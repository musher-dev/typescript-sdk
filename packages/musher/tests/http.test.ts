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
		expect(config.manifestTtlSeconds).toBe(86_400);
		expect(config.refTtlSeconds).toBe(300);
		expect(config.timeout).toBe(60_000);
		expect(config.retries).toBe(3);
	});

	it("overrides defaults with provided values", () => {
		const config = resolveConfig({
			baseUrl: "https://custom.dev",
			manifestTtlSeconds: 7200,
			refTtlSeconds: 60,
			timeout: 5000,
			retries: 0,
		});
		expect(config.baseUrl).toBe("https://custom.dev");
		expect(config.manifestTtlSeconds).toBe(7200);
		expect(config.refTtlSeconds).toBe(60);
		expect(config.timeout).toBe(5000);
		expect(config.retries).toBe(0);
	});
});
