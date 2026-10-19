import type { Widget } from "../../components/widget/index.ts";

export function describeWidget(widget: Widget): string {
	return widget.id;
}
