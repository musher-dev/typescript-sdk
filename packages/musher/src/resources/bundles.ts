/**
 * Bundles resource — namespace-scoped bundle operations.
 */

import type { HttpTransport } from "../http.js";
import { AssetDetailOutputSchema, AssetSummaryOutputSchema } from "../schemas/asset.js";
import { BundleDetailOutputSchema, BundleOutputSchema } from "../schemas/bundle.js";
import { paginatedSchema } from "../schemas/common.js";
import { BundleResolveOutputSchema, PullBundleVersionOutputSchema } from "../schemas/resolve.js";
import {
	BundleVersionDetailOutputSchema,
	BundleVersionSummaryOutputSchema,
} from "../schemas/version.js";
import type {
	AssetDetailOutput,
	AssetSummaryOutput,
	BundleDetailOutput,
	BundleOutput,
	BundleResolveOutput,
	BundleVersionDetailOutput,
	BundleVersionSummaryOutput,
	PaginateParams,
	Paginated,
	PullBundleVersionOutput,
} from "../types.js";

export class BundlesResource {
	constructor(private readonly http: HttpTransport) {}

	async get(namespace: string, bundle: string): Promise<BundleDetailOutput> {
		return this.http.request(
			"GET",
			`/v1/namespaces/${enc(namespace)}/bundles/${enc(bundle)}`,
			BundleDetailOutputSchema,
		);
	}

	async list(namespace: string, params?: PaginateParams): Promise<Paginated<BundleOutput>> {
		return this.http.request(
			"GET",
			`/v1/namespaces/${enc(namespace)}/bundles`,
			paginatedSchema(BundleOutputSchema),
			{
				params: {
					cursor: params?.cursor,
					limit: params?.limit,
				},
			},
		);
	}

	async resolve(
		namespace: string,
		bundle: string,
		version?: string,
		digest?: string,
	): Promise<BundleResolveOutput> {
		const params: Record<string, string> = {};
		if (version) {
			params["version"] = version;
		}
		if (digest) {
			params["digest"] = digest;
		}

		const hasParams = Object.keys(params).length > 0;
		return this.http.request(
			"GET",
			`/v1/namespaces/${enc(namespace)}/bundles/${enc(bundle)}:resolve`,
			BundleResolveOutputSchema,
			hasParams ? { params } : undefined,
		);
	}

	async listVersions(
		namespace: string,
		bundle: string,
		params?: PaginateParams,
	): Promise<Paginated<BundleVersionSummaryOutput>> {
		return this.http.request(
			"GET",
			`/v1/namespaces/${enc(namespace)}/bundles/${enc(bundle)}/versions`,
			paginatedSchema(BundleVersionSummaryOutputSchema),
			{
				params: {
					cursor: params?.cursor,
					limit: params?.limit,
				},
			},
		);
	}

	async getVersion(
		namespace: string,
		bundle: string,
		version: string,
	): Promise<BundleVersionDetailOutput> {
		return this.http.request(
			"GET",
			`/v1/namespaces/${enc(namespace)}/bundles/${enc(bundle)}/versions/${enc(version)}`,
			BundleVersionDetailOutputSchema,
		);
	}

	async listAssets(
		namespace: string,
		bundle: string,
		params?: PaginateParams,
	): Promise<Paginated<AssetSummaryOutput>> {
		return this.http.request(
			"GET",
			`/v1/namespaces/${enc(namespace)}/bundles/${enc(bundle)}/assets`,
			paginatedSchema(AssetSummaryOutputSchema),
			{
				params: {
					cursor: params?.cursor,
					limit: params?.limit,
				},
			},
		);
	}

	async getAsset(
		namespace: string,
		bundle: string,
		logicalPath: string,
		version: string,
	): Promise<AssetDetailOutput> {
		const encodedPath = logicalPath.split("/").map(encodeURIComponent).join("/");
		return this.http.request(
			"GET",
			`/v1/namespaces/${enc(namespace)}/bundles/${enc(bundle)}/assets/${encodedPath}`,
			AssetDetailOutputSchema,
			{ params: { version } },
		);
	}

	async pullVersion(
		namespace: string,
		bundle: string,
		version: string,
	): Promise<PullBundleVersionOutput> {
		return this.http.request(
			"GET",
			`/v1/namespaces/${enc(namespace)}/bundles/${enc(bundle)}/versions/${enc(version)}:pull`,
			PullBundleVersionOutputSchema,
		);
	}

	async pullHubVersion(
		publisherHandle: string,
		bundleSlug: string,
		version: string,
	): Promise<PullBundleVersionOutput> {
		return this.http.request(
			"GET",
			`/v1/hub/bundles/${enc(publisherHandle)}/${enc(bundleSlug)}/versions/${enc(version)}:pull`,
			PullBundleVersionOutputSchema,
		);
	}
}

function enc(value: string): string {
	return encodeURIComponent(value);
}
