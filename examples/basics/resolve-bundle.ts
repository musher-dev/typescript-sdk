/**
 * Resolve bundle metadata without downloading content.
 *
 * Useful for checking the latest version or inspecting a manifest
 * before committing to a full download.
 *
 * Prerequisites:
 *   export MUSHER_API_KEY="mush_..."
 *
 * Run:
 *   npx tsx examples/basics/resolve-bundle.ts
 */

import { resolve } from "@musher-dev/musher-sdk";

const meta = await resolve("musher-examples/code-review-kit:1.2.0");

console.log("ref:    ", meta.ref);
console.log("version:", meta.version);

if (meta.manifest) {
	const layers = meta.manifest.layers;
	console.log(`assets:  ${layers.length}`);
	for (const asset of layers) {
		console.log(`  - ${asset.logicalPath}  (${asset.assetType}, ${asset.sizeBytes} bytes)`);
	}
}
