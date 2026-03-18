// -- Client -------------------------------------------------------------------
export { MusherClient } from "./client.js";
export type { ClientConfig } from "./config.js";

// -- Core classes -------------------------------------------------------------
export { Bundle } from "./bundle.js";
export { BundleRef } from "./ref.js";
export { Selection } from "./selection.js";

// -- Handles ------------------------------------------------------------------
export {
	AgentSpecHandle,
	FileHandle,
	PromptHandle,
	SkillHandle,
	ToolsetHandle,
} from "./handles/index.js";

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

// -- Convenience functions ----------------------------------------------------
export { configure, getClient, pull, resolve, search } from "./convenience.js";

// -- Errors -------------------------------------------------------------------
export {
	ApiError,
	AuthenticationError,
	CacheError,
	ForbiddenError,
	IntegrityError,
	MushError,
	NetworkError,
	NotFoundError,
	type ProblemDetail,
	RateLimitError,
	SchemaError,
	TimeoutError,
	ValidationError,
} from "./errors.js";

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
	CategoryOutputSchema,
	ListingDetailOutputSchema,
	ListingSearchOutputSchema,
	ManifestAssetOutputSchema,
	ManifestDetailOutputSchema,
	PaginationMetaSchema,
	PublisherSummaryOutputSchema,
	TrustTier,
	VersionSummaryOutputSchema,
	paginatedSchema,
} from "./schemas/index.js";

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
	CachedBundle,
	CategoryOutput,
	ListingDetailOutput,
	ListingSearchOutput,
	LoadedAsset,
	LoadedBundle,
	ManifestAssetOutput,
	ManifestDetailOutput,
	Paginated,
	PaginateParams,
	PaginationMeta,
	PublisherSummaryOutput,
	SearchParams,
	SelectionFilter,
	VerifyResult,
	VersionSummaryOutput,
} from "./types.js";
