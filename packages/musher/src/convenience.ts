/**
 * Module-level convenience functions matching the Python SDK.
 */

import type { Bundle } from "./bundle.js";
import { MusherClient } from "./client.js";
import type { ClientConfig } from "./config.js";
import type { BundleResolveOutput, ListingSearchOutput, Paginated, SearchParams } from "./types.js";

let _config: ClientConfig | undefined;
let _client: MusherClient | undefined;

/** Configure the default client used by module-level convenience functions. */
export function configure(config: ClientConfig): void {
	_config = config;
	_client = undefined; // Reset so next getClient() picks up new config
}

/** Get or create the default MusherClient. */
export function getClient(): MusherClient {
	if (!_client) {
		_client = new MusherClient(_config);
	}
	return _client;
}

/** Pull a bundle (resolve + download + cache). */
export async function pull(ref: string, version?: string): Promise<Bundle> {
	return getClient().pull(ref, version);
}

/** Resolve bundle metadata without downloading content. */
export async function resolve(ref: string, version?: string): Promise<BundleResolveOutput> {
	return getClient().resolve(ref, version);
}

/** Search the hub for bundles. */
export async function search(params?: SearchParams): Promise<Paginated<ListingSearchOutput>> {
	return getClient().search(params);
}
