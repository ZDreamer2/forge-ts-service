// An exempt site: app/ is the composition root, the layer that owns the environment.
export type Config = { listenPort: number };

export function loadConfig(env: Record<string, string | undefined>): Config {
	return { listenPort: Number(env.SERVICE_LISTEN_PORT ?? 8457) };
}

export function readConfigOrExit(): Config {
	return loadConfig(process.env);
}
