import type { WidgetState } from "../src/components/widget/internal/state.ts";

export function isOpen(state: WidgetState): boolean {
	return state.open;
}
