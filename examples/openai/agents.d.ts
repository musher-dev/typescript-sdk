/**
 * Ambient type augmentations for OpenAI Agents SDK shell tool APIs.
 *
 * These APIs are documented in OpenAI's Agents SDK guides but may not yet
 * be published in the installed @openai/agents version. This file provides
 * type stubs so that the integration examples compile.
 *
 * Remove this file once @openai/agents ships shellTool natively.
 */

declare module "@openai/agents" {
	export { Agent, run } from "@openai/agents";

	export interface ShellToolLocalSkill {
		name: string;
		description: string;
		path: string;
	}

	export interface ShellToolInlineSkill {
		type: "inline";
		name: string;
		description: string;
		source: {
			type: "base64";
			mediaType: "application/zip";
			data: string;
		};
	}

	export interface ShellToolOptions {
		name: string;
		description?: string;
		shell?: string;
		environment?: {
			type: "local" | "container_auto" | "container_reference";
			skills?: Array<ShellToolLocalSkill | ShellToolInlineSkill>;
		};
	}

	export function shellTool(options: ShellToolOptions): unknown;
}
