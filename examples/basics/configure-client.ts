/**
 * Configure the module-level client and access binary content.
 *
 * `configure()` sets options for the default client used by the
 * top-level `pull()` and `resolve()` functions. This example also
 * demonstrates `FileHandle.bytes()` and `FileHandle.stream()` for
 * binary-safe content access.
 *
 * Prerequisites:
 *   export MUSHER_API_KEY="mush_..."
 *
 * Run:
 *   npx tsx examples/basics/configure-client.ts
 */

import { configure, getClient, pull } from "@musher-dev/musher-sdk";

// Configure the default client with a custom cache directory
configure({ cacheDir: "/tmp/musher-examples-cache" });

// Verify the configured client is returned by getClient()
const client = getClient();
console.log(`Client configured (cache API available: ${typeof client.cache.list === "function"}).`);

// pull() uses the configured client automatically
const bundle = await pull("musher-examples/prompt-library:1.2.0");

// List all prompts in the bundle
console.log(`\nPrompts in ${bundle.ref.toString()}:`);
for (const prompt of bundle.prompts()) {
	console.log(`  ${prompt.name} (${prompt.file().sizeBytes} bytes)`);
}

// Demonstrate binary access via bytes()
const file = bundle.prompt("system").file();
const bytes = file.bytes();
console.log(`\nBinary access — "system" prompt: ${bytes.byteLength} bytes (Uint8Array)`);

// Demonstrate streaming access via stream()
const stream = file.stream();
const reader = stream.getReader();
let totalStreamBytes = 0;
while (true) {
	const { done, value } = await reader.read();
	if (done) {
		break;
	}
	totalStreamBytes += value.byteLength;
}
console.log(`Stream access  — "system" prompt: ${totalStreamBytes} bytes read`);
