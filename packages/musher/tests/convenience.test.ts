import { describe, expect, it } from "vitest";
import { configure, getClient } from "../src/convenience.js";
import { MusherClient } from "../src/client.js";

describe("convenience functions", () => {
	it("getClient() returns a MusherClient", () => {
		const client = getClient();
		expect(client).toBeInstanceOf(MusherClient);
	});

	it("configure() resets the default client", () => {
		const c1 = getClient();
		configure({ baseUrl: "https://custom.api.dev" });
		const c2 = getClient();
		// Should be a new instance after configure()
		expect(c2).not.toBe(c1);
	});

	it("getClient() returns the same instance when not reconfigured", () => {
		configure({});
		const c1 = getClient();
		const c2 = getClient();
		expect(c1).toBe(c2);
	});
});
