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
	isSigned: z.boolean().optional(),
	signerType: z.string().nullable().optional(),
	signedAt: z.string().datetime().nullable().optional(),
});

// -- Pull endpoint schemas ----------------------------------------------------

export const PullAssetOutputSchema = z.object({
	logicalPath: z.string(),
	assetType: z.string(),
	contentText: z.string(),
	mediaType: z.string().nullable().optional(),
});

export const PullBundleVersionOutputSchema = z.object({
	namespace: z.string(),
	slug: z.string(),
	version: z.string(),
	name: z.string(),
	description: z.string().nullable().optional(),
	manifest: z.array(PullAssetOutputSchema),
});
