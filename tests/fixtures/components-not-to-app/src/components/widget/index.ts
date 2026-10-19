import type { Config } from "../../app/config.ts";

export function describePort(config: Config): number {
	return config.listenPort;
}
