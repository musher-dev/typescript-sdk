/**
 * Error hierarchy for the Musher SDK.
 *
 * All errors extend MusherError so consumers can catch the base class.
 */

export class MusherError extends Error {
	constructor(message: string, options?: ErrorOptions) {
		super(message, options);
		this.name = "MusherError";
	}
}

// -- API errors ---------------------------------------------------------------

export interface ProblemDetail {
	type: string;
	title: string;
	status: number;
	detail: string;
	instance?: string | undefined;
	traceId?: string | undefined;
}

export class ApiError extends MusherError {
	readonly status: number;
	readonly problem: ProblemDetail;

	constructor(problem: ProblemDetail, options?: ErrorOptions) {
		super(problem.detail, options);
		this.name = "ApiError";
		this.status = problem.status;
		this.problem = problem;
	}
}

export class NotFoundError extends ApiError {
	constructor(problem: ProblemDetail, options?: ErrorOptions) {
		super(problem, options);
		this.name = "NotFoundError";
	}
}

export class AuthenticationError extends ApiError {
	constructor(problem: ProblemDetail, options?: ErrorOptions) {
		super(problem, options);
		this.name = "AuthenticationError";
	}
}

export class ForbiddenError extends ApiError {
	constructor(problem: ProblemDetail, options?: ErrorOptions) {
		super(problem, options);
		this.name = "ForbiddenError";
	}
}

export class ValidationError extends ApiError {
	readonly errors?: Array<{ loc: string[]; msg: string; type: string }> | undefined;

	constructor(
		problem: ProblemDetail & { errors?: Array<{ loc: string[]; msg: string; type: string }> },
		options?: ErrorOptions,
	) {
		super(problem, options);
		this.name = "ValidationError";
		this.errors = problem.errors;
	}
}

export class RateLimitError extends ApiError {
	readonly retryAfter: number | undefined;

	constructor(problem: ProblemDetail, retryAfter?: number, options?: ErrorOptions) {
		super(problem, options);
		this.name = "RateLimitError";
		this.retryAfter = retryAfter;
	}
}

// -- Network errors -----------------------------------------------------------

export class NetworkError extends MusherError {
	constructor(message: string, options?: ErrorOptions) {
		super(message, options);
		this.name = "NetworkError";
	}
}

export class TimeoutError extends NetworkError {
	constructor(message: string, options?: ErrorOptions) {
		super(message, options);
		this.name = "TimeoutError";
	}
}

// -- Cache errors -------------------------------------------------------------

export class CacheError extends MusherError {
	constructor(message: string, options?: ErrorOptions) {
		super(message, options);
		this.name = "CacheError";
	}
}

export class IntegrityError extends CacheError {
	constructor(
		readonly expected: string,
		readonly actual: string,
		options?: ErrorOptions,
	) {
		super(`SHA256 mismatch: expected ${expected}, got ${actual}`, options);
		this.name = "IntegrityError";
	}
}

// -- Schema errors ------------------------------------------------------------

export class SchemaError extends MusherError {
	constructor(message: string, options?: ErrorOptions) {
		super(message, options);
		this.name = "SchemaError";
	}
}

// -- Bundle errors ------------------------------------------------------------

export class BundleAssetNotFoundError extends MusherError {
	constructor(
		readonly assetType: string,
		readonly assetName: string,
		options?: ErrorOptions,
	) {
		super(`${assetType} "${assetName}" not found in bundle`, options);
		this.name = "BundleAssetNotFoundError";
	}
}
