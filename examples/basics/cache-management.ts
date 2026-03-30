/**
 * Inspect and manage the local bundle cache.
 *
 * After pulling bundles, `client.cache` provides methods to list
 * entries, check freshness, view statistics, and clean up stale data.
 *
 * Prerequisites:
 *   export MUSHER_API_KEY="mush_..."
 *
 * Run:
 *   npx tsx examples/basics/cache-management.ts
 */

import { MusherClient } from "@musher-dev/musher-sdk";

const client = new MusherClient();

// Pull a bundle so there is something in the cache
await client.pull("musher-examples/code-review-kit:1.2.0");
console.log("Pulled code-review-kit into cache.\n");

// Check if a specific bundle is cached
const status = await client.cache.has("musher-examples", "code-review-kit", "1.2.0");
console.log("Cache status for code-review-kit:1.2.0:");
console.log(`  cached: ${status.cached}`);
console.log(`  fresh:  ${status.fresh}`);

// List all cached bundles
const entries = await client.cache.list();
console.log(`\nCached bundles (${entries.length}):`);
for (const entry of entries) {
	console.log(
		`  ${entry.namespace}/${entry.slug}:${entry.version}` +
			`  fresh=${entry.fresh}  size=${entry.sizeBytes} bytes`,
	);
}

// Aggregate statistics
const stats = await client.cache.stats();
console.log("\nCache statistics:");
console.log(
	`  entries: ${stats.entryCount} (${stats.freshCount} fresh, ${stats.staleCount} stale)`,
);
console.log(`  blobs:   ${stats.blobCount} (${stats.blobSizeBytes} bytes)`);
console.log(`  refs:    ${stats.refCount}`);

// Mark a bundle as stale (next pull will re-fetch)
const invalidated = await client.cache.invalidate("musher-examples", "code-review-kit", "1.2.0");
console.log(`\nInvalidated ${invalidated} entry (now stale).`);

// Clean up expired entries
await client.cache.clean();
console.log("Cleaned expired entries.");
