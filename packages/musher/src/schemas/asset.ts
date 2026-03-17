import { z } from "zod";

export const AssetSummaryOutputSchema = z.object({
	id: z.string().uuid(),
	bundleId: z.string().uuid(),
	assetType: z.string(),
	logicalPath: z.string(),
	contentSha256: z.string(),
	contentSizeBytes: z.number().int().nullable().optional(),
	mediaType: z.string().nullable().optional(),
	createdAt: z.string().datetime(),
	updatedAt: z.string().datetime().nullable().optional(),
});

export const AssetDetailOutputSchema = AssetSummaryOutputSchema.extend({
	contentText: z.string().nullable().optional(),
});
