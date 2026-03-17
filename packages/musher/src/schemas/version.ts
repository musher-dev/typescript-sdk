import { z } from "zod";
import { BundleVersionState } from "./common.js";

export const BundleVersionSummaryOutputSchema = z.object({
	id: z.string().uuid(),
	bundleId: z.string().uuid(),
	version: z.string(),
	state: BundleVersionState,
	ociRef: z.string().nullable().optional(),
	ociDigest: z.string().nullable().optional(),
	publishedBy: z.string().nullable().optional(),
	yankedBy: z.string().nullable().optional(),
	yankedAt: z.string().datetime().nullable().optional(),
	yankReason: z.string().nullable().optional(),
	createdAt: z.string().datetime(),
});

export const ManifestAssetOutputSchema = z.object({
	assetId: z.string(),
	logicalPath: z.string(),
	assetType: z.string(),
	contentSha256: z.string(),
	sizeBytes: z.number().int(),
	mediaType: z.string().nullable().optional(),
});

export const ManifestDetailOutputSchema = z.object({
	namespace: z.string(),
	bundleSlug: z.string(),
	version: z.string(),
	assets: z.array(ManifestAssetOutputSchema),
});

export const BundleVersionDetailOutputSchema = z.object({
	id: z.string().uuid(),
	bundleId: z.string().uuid(),
	version: z.string(),
	state: BundleVersionState,
	ociRef: z.string().nullable().optional(),
	ociDigest: z.string().nullable().optional(),
	manifest: ManifestDetailOutputSchema.nullable().optional(),
	publishedBy: z.string().nullable().optional(),
	yankedBy: z.string().nullable().optional(),
	yankedAt: z.string().datetime().nullable().optional(),
	yankReason: z.string().nullable().optional(),
	createdAt: z.string().datetime(),
});
