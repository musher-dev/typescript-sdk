// -- Client -------------------------------------------------------------------

// -- Adapters -----------------------------------------------------------------
export {
	exportClaudePlugin,
	exportOpenAIInlineSkill,
	exportOpenAILocalSkill,
	installClaudeSkills,
	installVSCodeSkills,
	type OpenAIInlineSkill,
	type OpenAILocalSkill,
} from "./adapters/index.js";
// -- Core classes -------------------------------------------------------------
export { Bundle } from "./bundle.js";
export { MusherClient } from "./client.js";
export type { ClientConfig } from "./config.js";
// -- Convenience functions ----------------------------------------------------
export { configure, getClient, pull, resolve } from "./convenience.js";
// -- Errors -------------------------------------------------------------------
export {
	ApiError,
	AuthenticationError,
	BundleAssetNotFoundError,
	CacheError,
	ForbiddenError,
	IntegrityError,
	MusherError,
	NetworkError,
	NotFoundError,
	type ProblemDetail,
	RateLimitError,
	SchemaError,
	TimeoutError,
	ValidationError,
} from "./errors.js";
// -- Frontmatter --------------------------------------------------------------
export { extractDescription, type FrontmatterResult, parseFrontmatter } from "./frontmatter.js";

// -- Handles ------------------------------------------------------------------
export {
	AgentSpecHandle,
	FileHandle,
	PromptHandle,
	SkillHandle,
	ToolsetHandle,
} from "./handles/index.js";
export type { MusherDirs } from "./paths.js";
// -- Paths --------------------------------------------------------------------
export { resolveMusherDirs } from "./paths.js";
export { BundleRef } from "./ref.js";
// -- Schemas ------------------------------------------------------------------
export {
	AssetDetailOutputSchema,
	AssetSummaryOutputSchema,
	AssetType,
	BundleDetailOutputSchema,
	BundleLayerOutputSchema,
	BundleManifestOutputSchema,
	BundleOutputSchema,
	BundleResolveOutputSchema,
	BundleSourceType,
	BundleVersionDetailOutputSchema,
	BundleVersionState,
	BundleVersionSummaryOutputSchema,
	BundleVisibility,
	ManifestAssetOutputSchema,
	ManifestDetailOutputSchema,
	PaginationMetaSchema,
	PullAssetOutputSchema,
	PullBundleVersionOutputSchema,
	paginatedSchema,
} from "./schemas/index.js";
export { Selection } from "./selection.js";

// -- Types --------------------------------------------------------------------
export type {
	AssetDetailOutput,
	AssetSummaryOutput,
	BundleDetailOutput,
	BundleLayerOutput,
	BundleManifestOutput,
	BundleOutput,
	BundleResolveOutput,
	BundleVersionDetailOutput,
	BundleVersionSummaryOutput,
	CacheEntry,
	CacheManager,
	CacheStats,
	ManifestAssetOutput,
	ManifestDetailOutput,
	Paginated,
	PaginateParams,
	PaginationMeta,
	PullAssetOutput,
	PullBundleVersionOutput,
	SelectionFilter,
	VerifyResult,
} from "./types.js";
