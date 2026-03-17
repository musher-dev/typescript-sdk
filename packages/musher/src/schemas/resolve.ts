import { z } from "zod";
import { BundleSourceType, BundleVersionState } from "./common.js";

export const BundleLayerOutputSchema = z.object({
	assetId: z.string(),
	logicalPath: z.string(),
	assetType: z.string(),
	contentSha256: z.string(),
	sizeBytes: z.number().int(),
	mediaType: z.string().nullable().optional(),
});

export const BundleManifestOutputSchema = z.object({
	layers: z.array(BundleLayerOutputSchema),
});

export const BundleResolveOutputSchema = z.object({
	bundleId: z.string().uuid(),
	versionId: z.string().uuid(),
	namespace: z.string(),
	slug: z.string(),
	ref: z.string(),
	version: z.string(),
	sourceType: BundleSourceType,
	ociRef: z.string().nullable().optional(),
	ociDigest: z.string().nullable().optional(),
	state: BundleVersionState,
	manifest: BundleManifestOutputSchema.nullable().optional(),
});
