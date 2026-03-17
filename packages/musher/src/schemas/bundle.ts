import { z } from "zod";
import { BundleSourceType, BundleVisibility } from "./common.js";

export const BundleOutputSchema = z.object({
	id: z.string().uuid(),
	namespace: z.string(),
	slug: z.string(),
	ref: z.string(),
	name: z.string(),
	description: z.string().nullable().optional(),
	visibility: BundleVisibility,
	sourceType: BundleSourceType,
	readmeFormat: z.string().nullable().optional(),
	createdAt: z.string().datetime(),
	updatedAt: z.string().datetime().nullable().optional(),
});

export const BundleDetailOutputSchema = BundleOutputSchema.extend({
	readmeContent: z.string().nullable().optional(),
	latestVersion: z.string().nullable().optional(),
	versionCount: z.number().int(),
	assetCount: z.number().int(),
});
