/**
 * HTTP transport layer — fetch-based with auth, retry, error mapping, and Zod validation.
 */

import type { z } from "zod";
import type { ResolvedConfig } from "./config.js";
import {
	ApiError,
	AuthenticationError,
	ForbiddenError,
	NetworkError,
	NotFoundError,
	type ProblemDetail,
	RateLimitError,
	SchemaError,
	TimeoutError,
	ValidationError,
} from "./errors.js";

export class HttpTransport {
	constructor(private readonly config: ResolvedConfig) {}

	async request<T>(
		method: string,
		path: string,
		schema: z.ZodType<T>,
		options?: {
			body?: unknown;
			params?: Record<string, string | number | boolean | undefined>;
		},
	): Promise<T> {
		const url = this.buildUrl(path, options?.params);
		const headers = this.buildHeaders();

		let lastError: Error | undefined;

		for (let attempt = 0; attempt <= this.config.retries; attempt++) {
			try {
				const response = await this.fetchWithTimeout(url, {
					method,
					headers,
					body: options?.body ? JSON.stringify(options.body) : undefined,
				});

				if (!response.ok) {
					const error = await this.mapError(response);
					// Only retry on 429 or 5xx
					if (response.status === 429 || response.status >= 500) {
						lastError = error;
						if (attempt < this.config.retries) {
							await this.backoff(attempt, error);
							continue;
						}
					}
					throw error;
				}

				const json: unknown = await response.json();
				return this.parse(schema, json);
			} catch (error) {
				if (error instanceof ApiError) throw error;
				if (error instanceof SchemaError) throw error;

				lastError = error instanceof Error ? error : new Error(String(error));

				if (attempt < this.config.retries) {
					await this.backoff(attempt);
				}
			}
		}

		throw lastError ?? new NetworkError("Request failed after retries");
	}

	private buildUrl(
		path: string,
		params?: Record<string, string | number | boolean | undefined>,
	): string {
		const base = this.config.baseUrl.replace(/\/$/, "");
		const url = new URL(`${base}${path}`);

		if (params) {
			for (const [key, value] of Object.entries(params)) {
				if (value !== undefined) {
					url.searchParams.set(key, String(value));
				}
			}
		}

		return url.toString();
	}

	private buildHeaders(): Record<string, string> {
		const headers: Record<string, string> = {
			"Content-Type": "application/json",
			Accept: "application/json",
		};

		if (this.config.apiKey) {
			headers.Authorization = `Bearer ${this.config.apiKey}`;
		}

		return headers;
	}

	private async fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), this.config.timeout);

		try {
			return await fetch(url, { ...init, signal: controller.signal });
		} catch (error) {
			if (error instanceof DOMException && error.name === "AbortError") {
				throw new TimeoutError(`Request timed out after ${this.config.timeout}ms`);
			}
			throw new NetworkError(error instanceof Error ? error.message : "Network request failed", {
				cause: error instanceof Error ? error : undefined,
			});
		} finally {
			clearTimeout(timer);
		}
	}

	private async mapError(response: Response): Promise<ApiError> {
		let problem: ProblemDetail;
		try {
			const body = (await response.json()) as ProblemDetail;
			problem = {
				type: body.type ?? "about:blank",
				title: body.title ?? response.statusText,
				status: response.status,
				detail: body.detail ?? response.statusText,
				instance: body.instance,
				traceId: body.traceId,
			};
		} catch {
			problem = {
				type: "about:blank",
				title: response.statusText,
				status: response.status,
				detail: response.statusText,
			};
		}

		switch (response.status) {
			case 401:
				return new AuthenticationError(problem);
			case 403:
				return new ForbiddenError(problem);
			case 404:
				return new NotFoundError(problem);
			case 422:
				return new ValidationError(
					problem as ProblemDetail & {
						errors?: Array<{ loc: string[]; msg: string; type: string }>;
					},
				);
			case 429: {
				const retryAfter = response.headers.get("Retry-After");
				return new RateLimitError(
					problem,
					retryAfter ? Number.parseInt(retryAfter, 10) : undefined,
				);
			}
			default:
				return new ApiError(problem);
		}
	}

	private parse<T>(schema: z.ZodType<T>, data: unknown): T {
		const result = schema.safeParse(data);
		if (!result.success) {
			throw new SchemaError(`API response validation failed: ${result.error.message}`);
		}
		return result.data;
	}

	private async backoff(attempt: number, error?: Error): Promise<void> {
		let delay = Math.min(1000 * 2 ** attempt, 10_000);

		if (error instanceof RateLimitError && error.retryAfter) {
			delay = error.retryAfter * 1000;
		}

		// Add jitter
		delay += Math.random() * 500;

		await new Promise((resolve) => setTimeout(resolve, delay));
	}
}
