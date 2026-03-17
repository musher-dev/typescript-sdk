/**
 * Hub resource — public registry discovery endpoints.
 */

import type { HttpTransport } from "../http.js";
import { paginatedSchema } from "../schemas/common.js";
import { ListingDetailOutputSchema, ListingSearchOutputSchema } from "../schemas/hub.js";
import type {
	ListingDetailOutput,
	ListingSearchOutput,
	Paginated,
	SearchParams,
} from "../types.js";

export class HubResource {
	constructor(private readonly http: HttpTransport) {}

	async search(params?: SearchParams): Promise<Paginated<ListingSearchOutput>> {
		const schema = paginatedSchema(ListingSearchOutputSchema);
		return this.http.request("GET", "/v1/hub/listings", schema, {
			params: {
				cursor: params?.cursor,
				limit: params?.limit,
				query: params?.query,
				tags: params?.tags?.join(","),
				assetTypes: params?.assetTypes?.join(","),
				category: params?.category,
			},
		});
	}

	async getDetail(publisher: string, slug: string): Promise<ListingDetailOutput> {
		return this.http.request(
			"GET",
			`/v1/hub/publishers/${encodeURIComponent(publisher)}/listings/${encodeURIComponent(slug)}`,
			ListingDetailOutputSchema,
		);
	}
}
