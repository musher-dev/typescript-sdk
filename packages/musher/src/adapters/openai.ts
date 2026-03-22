/**
 * OpenAI adapter — export skills as local files or inline base64 ZIP.
 */

import { extractDescription } from "../frontmatter.js";
import type { SkillHandle } from "../handles/skill-handle.js";

const SKILL_PREFIX_RE = /^skills\/[^/]+\//;

export interface OpenAILocalSkill {
	name: string;
	description: string;
	path: string;
}

export interface OpenAIInlineSkill {
	type: "inline";
	name: string;
	description: string;
	source: {
		type: "base64";
		mediaType: "application/zip";
		data: string;
	};
}

/**
 * Export a skill as a local file directory structure.
 */
export async function exportOpenAILocalSkill(
	skill: SkillHandle,
	targetDir: string,
): Promise<OpenAILocalSkill> {
	const { mkdir, writeFile } = await import("node:fs/promises");
	const { join, resolve, dirname } = await import("node:path");

	const skillDir = resolve(targetDir, skill.name);
	await mkdir(skillDir, { recursive: true });

	for (const fh of skill.files()) {
		const relativePath = fh.logicalPath.replace(SKILL_PREFIX_RE, "");
		const filePath = join(skillDir, relativePath);
		await mkdir(dirname(filePath), { recursive: true });
		await writeFile(filePath, fh.bytes());
	}

	const description = extractDescription(skill);

	return { name: skill.name, description, path: skillDir };
}

/**
 * Export a skill as an inline base64 ZIP matching OpenAI's ShellToolInlineSkill shape.
 */
export function exportOpenAIInlineSkill(skill: SkillHandle): OpenAIInlineSkill {
	const description = extractDescription(skill);
	const zipBuffer = buildStoreZip(skill);
	const data = zipBuffer.toString("base64");

	return {
		type: "inline",
		name: skill.name,
		description,
		source: { type: "base64", mediaType: "application/zip", data },
	};
}

/**
 * Minimal STORE-method ZIP builder (no compression).
 * Produces a valid ZIP archive with a top-level skill directory.
 */
function buildStoreZip(skill: SkillHandle): Buffer {
	const files = skill.files().map((fh) => {
		const relativePath = fh.logicalPath.replace(SKILL_PREFIX_RE, "");
		const name = `${skill.name}/${relativePath}`;
		return { name, data: Buffer.from(fh.bytes()) };
	});

	const parts: Buffer[] = [];
	const centralParts: Buffer[] = [];
	let offset = 0;

	for (const file of files) {
		const nameBuffer = Buffer.from(file.name, "utf-8");

		// Local file header
		const local = Buffer.alloc(30 + nameBuffer.length);
		local.writeUInt32LE(0x04034b50, 0); // signature
		local.writeUInt16LE(20, 4); // version needed
		local.writeUInt16LE(0, 6); // flags
		local.writeUInt16LE(0, 8); // compression: STORE
		local.writeUInt16LE(0, 10); // mod time
		local.writeUInt16LE(0, 12); // mod date
		local.writeUInt32LE(crc32(file.data), 14); // crc-32
		local.writeUInt32LE(file.data.length, 18); // compressed size
		local.writeUInt32LE(file.data.length, 22); // uncompressed size
		local.writeUInt16LE(nameBuffer.length, 26); // filename length
		local.writeUInt16LE(0, 28); // extra field length
		nameBuffer.copy(local, 30);

		// Central directory header
		const central = Buffer.alloc(46 + nameBuffer.length);
		central.writeUInt32LE(0x02014b50, 0); // signature
		central.writeUInt16LE(20, 4); // version made by
		central.writeUInt16LE(20, 6); // version needed
		central.writeUInt16LE(0, 8); // flags
		central.writeUInt16LE(0, 10); // compression: STORE
		central.writeUInt16LE(0, 12); // mod time
		central.writeUInt16LE(0, 14); // mod date
		central.writeUInt32LE(crc32(file.data), 16); // crc-32
		central.writeUInt32LE(file.data.length, 20); // compressed size
		central.writeUInt32LE(file.data.length, 24); // uncompressed size
		central.writeUInt16LE(nameBuffer.length, 28); // filename length
		central.writeUInt16LE(0, 30); // extra field length
		central.writeUInt16LE(0, 32); // comment length
		central.writeUInt16LE(0, 34); // disk number start
		central.writeUInt16LE(0, 36); // internal attrs
		central.writeUInt32LE(0, 38); // external attrs
		central.writeUInt32LE(offset, 42); // local header offset
		nameBuffer.copy(central, 46);

		parts.push(local, file.data);
		centralParts.push(central);
		offset += local.length + file.data.length;
	}

	const centralDirOffset = offset;
	let centralDirSize = 0;
	for (const c of centralParts) {
		centralDirSize += c.length;
	}

	// End of central directory
	const eocd = Buffer.alloc(22);
	eocd.writeUInt32LE(0x06054b50, 0); // signature
	eocd.writeUInt16LE(0, 4); // disk number
	eocd.writeUInt16LE(0, 6); // central dir disk
	eocd.writeUInt16LE(files.length, 8); // entries on disk
	eocd.writeUInt16LE(files.length, 10); // total entries
	eocd.writeUInt32LE(centralDirSize, 12); // central dir size
	eocd.writeUInt32LE(centralDirOffset, 16); // central dir offset
	eocd.writeUInt16LE(0, 20); // comment length

	return Buffer.concat([...parts, ...centralParts, eocd]);
}

/** CRC-32 calculation. */
function crc32(data: Buffer): number {
	let crc = 0xffffffff;
	for (let i = 0; i < data.length; i++) {
		crc ^= data[i] as number;
		for (let j = 0; j < 8; j++) {
			crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
		}
	}
	return (crc ^ 0xffffffff) >>> 0;
}
