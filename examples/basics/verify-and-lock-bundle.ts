/**
 * Verify bundle integrity and write a lockfile.
 *
 * After pulling, `verify()` checks SHA-256 hashes for every file.
 * `writeLockfile()` persists the resolved ref, version, and file
 * metadata so future builds can reproduce the exact same bundle.
 *
 * Prerequisites:
 *   export MUSHER_API_KEY="mush_..."
 *
 * Run:
 *   npx tsx examples/basics/verify-and-lock-bundle.ts
 */

import { MusherClient, pull } from "@musher-dev/musher-sdk";

// Pull using the top-level convenience function
const bundle = await pull("acme/code-review-kit:1.2.0");

// Verify integrity — all SHA-256 digests must match
const result = bundle.verify();
if (result.ok) {
	console.log("Integrity check passed.");
} else {
	console.error("Integrity errors:", result.errors);
	process.exit(1);
}

// Write a lockfile for reproducible builds
await bundle.writeLockfile("./musher-lock.json");
console.log("Wrote musher-lock.json");

// Use MusherClient directly when you need custom configuration
const client = new MusherClient({ cacheDir: "/tmp/musher-cache" });
const custom = await client.pull("acme/code-review-kit:1.2.0");
console.log(`Pulled ${custom.ref.toString()} with custom cache dir`);
