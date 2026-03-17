import { z } from "zod";
import { TrustTier } from "./common.js";

export const PublisherSummaryOutputSchema = z.object({
	handle: z.string(),
	displayName: z.string(),
	trustTier: TrustTier,
	avatarUrl: z.string().nullable().optional(),
});

export const VersionSummaryOutputSchema = z.object({
	version: z.string(),
	publishedAt: z.string().datetime(),
	isDeprecated: z.boolean(),
	deprecatedMessage: z.string().nullable().optional(),
});

export const ListingSearchOutputSchema = z.object({
	id: z.string().uuid(),
	publisher: PublisherSummaryOutputSchema,
	slug: z.string(),
	displayName: z.string(),
	summary: z.string().nullable().optional(),
	assetTypes: z.array(z.string()),
	tags: z.array(z.string()),
	capabilities: z.array(z.string()),
	license: z.string().nullable().optional(),
	latestVersion: z.string().nullable().optional(),
	starsCount: z.number().int(),
	downloadsTotal: z.number().int(),
	downloads30d: z.number().int(),
	createdAt: z.string().datetime(),
	updatedAt: z.string().datetime().nullable().optional(),
});

export const ListingDetailOutputSchema = ListingSearchOutputSchema.extend({
	description: z.string().nullable().optional(),
	repositoryUrl: z.string().nullable().optional(),
	homepageUrl: z.string().nullable().optional(),
	readmeContent: z.string().nullable().optional(),
	readmeFormat: z.string().nullable().optional(),
	isDeprecated: z.boolean(),
	loadCommand: z.string().nullable().optional(),
	installCommand: z.string().nullable().optional(),
	versions: z.array(VersionSummaryOutputSchema),
});

export const CategoryOutputSchema = z.object({
	slug: z.string(),
	displayName: z.string(),
	description: z.string(),
	bundleCount: z.number().int(),
});
