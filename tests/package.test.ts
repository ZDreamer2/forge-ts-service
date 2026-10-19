import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { it } from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// Packing into /tmp and installing with an empty HOME/NPM_CONFIG_USERCONFIG prevents either
// the parent checkout's node_modules or developer npm credentials from making this test pass.
// npm installs the exact required tool peers; no global tool or sibling checkout is needed.
it("packs a public-only artifact and checks a clean consumer using all three exports", { timeout: 180_000 }, () => {
	const scratch = mkdtempSync(join(tmpdir(), "forge-ts-service-"));
	const env = {
		...process.env,
		HOME: join(scratch, "home"),
		NPM_CONFIG_USERCONFIG: join(scratch, "empty.npmrc"),
		NPM_CONFIG_REGISTRY: "https://registry.npmjs.org/",
	};
	// Do not let an ambient token participate in the clean installation.
	for (const key of Object.keys(env)) {
		if (/token|password|auth/i.test(key)) Reflect.deleteProperty(env, key);
	}

	function run(command: string, args: string[], cwd: string, expected = 0) {
		const result = spawnSync(command, args, { cwd, env, encoding: "utf8", timeout: 120_000 });
		assert.ifError(result.error);
		assert.equal(result.status, expected, `${command} ${args.join(" ")}\n${result.stdout}\n${result.stderr}`);
		return result.stdout;
	}

	try {
		mkdirSync(env.HOME, { recursive: true });
		writeFileSync(env.NPM_CONFIG_USERCONFIG, "");
		const packed = JSON.parse(
			run("npm", ["pack", "--ignore-scripts", "--json", "--pack-destination", scratch], ROOT),
		) as {
			filename: string;
			files: { path: string }[];
		}[];
		const artifact = packed[0];
		assert.ok(artifact);
		assert.deepEqual(
			artifact.files.map((f) => f.path).toSorted(),
			[
				"LICENSE",
				"README.md",
				"package.json",
				"presets/biome-preset.json",
				"presets/dependency-cruiser.mjs",
				"presets/tsconfig.json",
			].toSorted(),
		);
		const consumer = join(scratch, "consumer");
		mkdirSync(consumer);
		writeFileSync(join(consumer, "package.json"), JSON.stringify({ private: true, type: "module" }));
		run(
			"npm",
			[
				"install",
				"--save-dev",
				"--save-exact",
				"--ignore-scripts",
				"--no-audit",
				"--no-fund",
				join(scratch, artifact.filename),
			],
			consumer,
		);
		const manifest = JSON.parse(readFileSync(join(consumer, "package.json"), "utf8"));
		assert.deepEqual(Object.keys(manifest.devDependencies), ["@zdreamer/forge-ts-service"]);

		function put(path: string, content: string) {
			mkdirSync(dirname(join(consumer, path)), { recursive: true });
			writeFileSync(join(consumer, path), content);
		}
		function tool(name: string, args: string[], expected = 0) {
			return run(join(consumer, "node_modules/.bin", name), args, consumer, expected);
		}

		put("tsconfig.json", JSON.stringify({ extends: "@zdreamer/forge-ts-service/tsconfig", include: ["src"] }));
		put(
			"biome.json",
			JSON.stringify({ extends: ["@zdreamer/forge-ts-service/biome"], files: { includes: ["src/**"] } }),
		);
		put(
			".dependency-cruiser.mjs",
			`import base from "@zdreamer/forge-ts-service/dependency-cruiser";
export default { ...base, forbidden: [...base.forbidden, {
 name: "consumer-component-map", severity: "error",
 from: { path: "^src/components/alpha/" }, to: { path: "^src/components/beta/" }
}] };
`,
		);
		put("src/components/alpha/index.ts", 'export type { Data } from "./internal/types.ts";\n');
		put("src/components/alpha/internal/types.ts", "export interface Data { value: string }\n");
		put("src/app/config.ts", "export const environment = process.env;\n");
		tool("tsc", ["--noEmit"]);
		tool("biome", ["check", "--write", "."]);
		tool("biome", ["check", "."]);
		const graph = JSON.parse(
			tool("depcruise", ["--config", ".dependency-cruiser.mjs", "--output-type", "json", "src/**/*.ts"]),
		);
		assert.deepEqual(graph.summary.violations, []);
		const alpha = graph.modules.find((m: { source: string }) => m.source === "src/components/alpha/index.ts");
		assert.ok(alpha.dependencies.some((d: { resolved: string }) => d.resolved.endsWith("internal/types.ts")));

		put("src/components/alpha/internal/bad.ts", "export const configuration = process.env;\n");
		const lint = JSON.parse(tool("biome", ["lint", "--reporter=json", "."], 1));
		assert.ok(lint.diagnostics.some((d: { category: string }) => d.category === "lint/style/noProcessEnv"));
		put("src/components/alpha/internal/bad.ts", 'export const wrong: number = "not a number";\n');
		assert.match(tool("tsc", ["--noEmit"], 1), /TS2322/);

		put("src/components/beta/index.ts", "export const value = 1;\n");
		put("src/components/alpha/internal/bad.ts", 'export { value } from "../../beta/index.ts";\n');
		const custom = JSON.parse(
			tool("depcruise", ["--config", ".dependency-cruiser.mjs", "--output-type", "json", "src/**/*.ts"]),
		);
		assert.deepEqual(
			custom.summary.violations.map((v: { rule: { name: string } }) => v.rule.name),
			["consumer-component-map"],
		);
		// JSON reporting is informational (exit 0); the ordinary consumer gate must fail too.
		assert.match(
			tool("depcruise", ["--config", ".dependency-cruiser.mjs", "src/**/*.ts"], 1),
			/consumer-component-map/,
		);
	} finally {
		rmSync(scratch, { recursive: true, force: true });
	}
});
