/**
 * BundleRef — parse and represent bundle references.
 *
 * Supported formats:
 *   namespace/slug
 *   namespace/slug:version
 *   namespace/slug@sha256:digest
 */

import { MusherError } from "./errors.js";

const REF_PATTERN = /^([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_.-]+)(?::(.+)|@sha256:([a-fA-F0-9]+))?$/;

export class BundleRef {
	readonly namespace: string;
	readonly slug: string;
	readonly version: string | undefined;
	readonly digest: string | undefined;

	private constructor(namespace: string, slug: string, version?: string, digest?: string) {
		this.namespace = namespace;
		this.slug = slug;
		this.version = version;
		this.digest = digest;
	}

	/** Parse a ref string into a BundleRef. */
	static parse(ref: string): BundleRef {
		const match = ref.match(REF_PATTERN);
		if (!match) {
			throw new MusherError(
				`Invalid bundle ref "${ref}": expected "namespace/slug", "namespace/slug:version", or "namespace/slug@sha256:digest"`,
			);
		}
		const [, namespace, slug, version, digest] = match;
		return new BundleRef(namespace as string, slug as string, version, digest);
	}

	/** Return the base ref without version or digest: "namespace/slug". */
	toBaseRef(): string {
		return `${this.namespace}/${this.slug}`;
	}

	/** Return the full ref string. */
	toString(): string {
		if (this.digest) {
			return `${this.namespace}/${this.slug}@sha256:${this.digest}`;
		}
		if (this.version) {
			return `${this.namespace}/${this.slug}:${this.version}`;
		}
		return `${this.namespace}/${this.slug}`;
	}
}
