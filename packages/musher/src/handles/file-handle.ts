/**
 * FileHandle — binary-safe content wrapper for bundle assets.
 */

export class FileHandle {
	readonly logicalPath: string;
	readonly assetType: string;
	readonly sha256: string;
	readonly mediaType: string | undefined;
	readonly sizeBytes: number;
	private readonly _content: Buffer;

	constructor(
		logicalPath: string,
		assetType: string,
		sha256: string,
		sizeBytes: number,
		content: Buffer,
		mediaType?: string | undefined,
	) {
		this.logicalPath = logicalPath;
		this.assetType = assetType;
		this.sha256 = sha256;
		this.sizeBytes = sizeBytes;
		this._content = content;
		this.mediaType = mediaType;
	}

	/** Return content as a UTF-8 string. */
	text(): string {
		return this._content.toString("utf-8");
	}

	/** Return content as a Uint8Array. */
	bytes(): Uint8Array {
		return new Uint8Array(this._content.buffer, this._content.byteOffset, this._content.byteLength);
	}

	/** Return content as a ReadableStream. */
	stream(): ReadableStream<Uint8Array> {
		const bytes = this.bytes();
		return new ReadableStream({
			start(controller) {
				controller.enqueue(bytes);
				controller.close();
			},
		});
	}
}
