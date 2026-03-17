import { z } from "zod";

// -- Enums (mirror Python StrEnums) -------------------------------------------

export const BundleVisibility = z.enum(["private", "public"]);

export const BundleVersionState = z.enum(["published", "yanked"]);

export const AssetType = z.enum([
	"agent_definition",
	"skill",
	"tool_config",
	"prompt",
	"config",
	"other",
]);

export const BundleSourceType = z.enum(["console", "registry"]);

export const TrustTier = z.enum(["unverified", "community", "verified"]);

// -- Pagination ---------------------------------------------------------------

export const PaginationMetaSchema = z.object({
	nextCursor: z.string().nullable(),
	hasMore: z.boolean(),
});

/** Paginated response envelope. */
export function paginatedSchema<T extends z.ZodTypeAny>(itemSchema: T) {
	return z.object({
		data: z.array(itemSchema),
		meta: PaginationMetaSchema,
	});
}
