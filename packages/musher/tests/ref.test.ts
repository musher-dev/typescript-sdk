import { describe, expect, it } from "vitest";
import { MushError } from "../src/errors.js";
import { BundleRef } from "../src/ref.js";

describe("BundleRef", () => {
	it("parses namespace/slug", () => {
		const ref = BundleRef.parse("acme/my-bundle");
		expect(ref.namespace).toBe("acme");
		expect(ref.slug).toBe("my-bundle");
		expect(ref.version).toBeUndefined();
		expect(ref.digest).toBeUndefined();
	});

	it("parses namespace/slug:version", () => {
		const ref = BundleRef.parse("acme/my-bundle:1.2.0");
		expect(ref.namespace).toBe("acme");
		expect(ref.slug).toBe("my-bundle");
		expect(ref.version).toBe("1.2.0");
		expect(ref.digest).toBeUndefined();
	});

	it("parses namespace/slug@sha256:digest", () => {
		const ref = BundleRef.parse("acme/my-bundle@sha256:abcdef1234567890");
		expect(ref.namespace).toBe("acme");
		expect(ref.slug).toBe("my-bundle");
		expect(ref.version).toBeUndefined();
		expect(ref.digest).toBe("abcdef1234567890");
	});

	it("toString() round-trips base ref", () => {
		const ref = BundleRef.parse("acme/my-bundle");
		expect(ref.toString()).toBe("acme/my-bundle");
	});

	it("toString() round-trips versioned ref", () => {
		const ref = BundleRef.parse("acme/my-bundle:1.2.0");
		expect(ref.toString()).toBe("acme/my-bundle:1.2.0");
	});

	it("toString() round-trips digest ref", () => {
		const ref = BundleRef.parse("acme/my-bundle@sha256:abcdef");
		expect(ref.toString()).toBe("acme/my-bundle@sha256:abcdef");
	});

	it("toBaseRef() strips version and digest", () => {
		expect(BundleRef.parse("acme/my-bundle:1.0.0").toBaseRef()).toBe("acme/my-bundle");
		expect(BundleRef.parse("acme/my-bundle@sha256:abc").toBaseRef()).toBe("acme/my-bundle");
	});

	it("rejects invalid refs", () => {
		expect(() => BundleRef.parse("invalid")).toThrow(MushError);
		expect(() => BundleRef.parse("too/many/parts")).toThrow(MushError);
		expect(() => BundleRef.parse("/missing")).toThrow(MushError);
		expect(() => BundleRef.parse("")).toThrow(MushError);
	});

	it("allows dots and underscores in slug", () => {
		const ref = BundleRef.parse("acme/my_bundle.v2");
		expect(ref.slug).toBe("my_bundle.v2");
	});
});
