/**
 * Inferred TypeScript types from Zod schemas.
 *
 * Use these for type annotations — the Zod schemas are used at runtime.
 */

import type { z } from "zod";
import type { AssetDetailOutputSchema, AssetSummaryOutputSchema } from "./schemas/asset.js";
import type { BundleDetailOutputSchema, BundleOutputSchema } from "./schemas/bundle.js";
import type { PaginationMetaSchema } from "./schemas/common.js";
import type {
	BundleLayerOutputSchema,
	BundleManifestOutputSchema,
	BundleResolveOutputSchema,
	PullAssetOutputSchema,
	PullBundleVersionOutputSchema,
} from "./schemas/resolve.js";
import type {
	BundleVersionDetailOutputSchema,
	BundleVersionSummaryOutputSchema,
	ManifestAssetOutputSchema,
	ManifestDetailOutputSchema,
} from "./schemas/version.js";

// -- Pagination ---------------------------------------------------------------

export type PaginationMeta = z.infer<typeof PaginationMetaSchema>;

export interface Paginated<T> {
	data: T[];
	meta: PaginationMeta;
}

export interface PaginateParams {
	cursor?: string;
	limit?: number;
}

// -- Bundle -------------------------------------------------------------------

export type BundleOutput = z.infer<typeof BundleOutputSchema>;
export type BundleDetailOutput = z.infer<typeof BundleDetailOutputSchema>;

// -- Asset --------------------------------------------------------------------

export type AssetSummaryOutput = z.infer<typeof AssetSummaryOutputSchema>;
export type AssetDetailOutput = z.infer<typeof AssetDetailOutputSchema>;

// -- Version ------------------------------------------------------------------

export type BundleVersionSummaryOutput = z.infer<typeof BundleVersionSummaryOutputSchema>;
export type BundleVersionDetailOutput = z.infer<typeof BundleVersionDetailOutputSchema>;
export type ManifestAssetOutput = z.infer<typeof ManifestAssetOutputSchema>;
export type ManifestDetailOutput = z.infer<typeof ManifestDetailOutputSchema>;

// -- Resolve ------------------------------------------------------------------

export type BundleResolveOutput = z.infer<typeof BundleResolveOutputSchema>;
export type BundleLayerOutput = z.infer<typeof BundleLayerOutputSchema>;
export type BundleManifestOutput = z.infer<typeof BundleManifestOutputSchema>;
export type PullAssetOutput = z.infer<typeof PullAssetOutputSchema>;
export type PullBundleVersionOutput = z.infer<typeof PullBundleVersionOutputSchema>;

// -- High-level types ---------------------------------------------------------

/**
 * @deprecated Use `FileHandle` instead.
 */
export interface LoadedAsset {
	logicalPath: string;
	assetType: string;
	content: string;
	sha256: string;
	mediaType?: string | undefined;
}

/**
 * @deprecated Use `Bundle` class instead.
 */
export interface LoadedBundle {
	ref: string;
	version: string;
	assets: Map<string, LoadedAsset>;
	getAsset(path: string): LoadedAsset | undefined;
	getAssetsByType(type: string): LoadedAsset[];
}

/** @deprecated Use `Bundle` class instead. */
export interface CachedBundle {
	ref: string;
	version: string;
	cacheDir: string;
	manifest: BundleResolveOutput;
}

// -- New types ----------------------------------------------------------------

export interface VerifyResult {
	ok: boolean;
	errors: Array<{ path: string; expected: string; actual: string }>;
}

export interface SelectionFilter {
	skills?: string[];
	prompts?: string[];
	toolsets?: string[];
	agentSpecs?: string[];
	paths?: string[];
}
