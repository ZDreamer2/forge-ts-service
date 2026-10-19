import type { Deep } from "./sub/internal/deep.ts";

export function deepId(deep: Deep): string {
	return deep.id;
}
