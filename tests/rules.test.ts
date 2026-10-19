import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CONFIG = resolve(ROOT, "presets/dependency-cruiser.mjs");

interface Graph {
	modules: { source: string; dependencies: { resolved: string }[] }[];
	summary: {
		violations: { from: string; to: string; rule: { name: string } }[];
		ruleSetUsed: { forbidden: { name: string }[] };
	};
}

// One deliberate violation tree per rule, with every non-equivalent regex branch represented.
// Fixtures never use test-runner names and are never imported into this TypeScript program.
const CASES = [
	{ name: "lib-not-to-components", edges: [["src/lib/probe/index.ts", "src/components/widget/index.ts"]] },
	{ name: "lib-not-to-app", edges: [["src/lib/probe/index.ts", "src/app/config.ts"]] },
	{ name: "components-not-to-app", edges: [["src/components/widget/index.ts", "src/app/config.ts"]] },
	{ name: "not-to-main", edges: [["src/app/startup.ts", "src/main.ts"]] },
	{ name: "not-to-scripts", edges: [["src/app/startup.ts", "scripts/seed.ts"]] },
	{ name: "not-to-tools", edges: [["src/app/startup.ts", "tools/harness.ts"]] },
	{
		name: "not-to-foreign-internal",
		targets: ["src/**/*.ts", "scripts/**/*.ts"],
		edges: [
			["src/app/config.ts", "src/components/widget/internal/state.ts"],
			["scripts/inspect.ts", "src/components/widget/internal/state.ts"],
		],
	},
	{
		name: "not-to-nested-internal",
		edges: [["src/lib/probe/internal/sibling.ts", "src/lib/probe/internal/sub/internal/deep.ts"]],
	},
	{
		name: "not-to-banned-name",
		edges: [
			["src/app/config.ts", "src/utils.ts"],
			["src/lib/probe/index.ts", "src/lib/probe/internal/utils.ts"],
			["src/app/config.ts", "src/common/thing.ts"],
			["src/app/config.ts", "src/components/widget/shared/vocab.ts"],
			["src/app/config.ts", "src/lib/utils/misc.ts"],
		],
	},
	{
		name: "no-circular",
		edges: [["src/lib/probe/internal/first.ts", "src/lib/probe/internal/second.ts"]],
	},
];

function run(binary: string, args: string[], cwd: string) {
	const result = spawnSync(resolve(ROOT, "node_modules/.bin", binary), args, {
		cwd,
		encoding: "utf8",
		maxBuffer: 32 * 1024 * 1024,
	});
	assert.ifError(result.error);
	assert.ok(result.stdout, `${binary} produced no report: ${result.stderr}`);
	assert.ok(result.status === 0 || result.status === 1, `${binary} failed: ${result.stderr}`);
	return result;
}

function cruise(fixture: string, targets = ["src/**/*.ts"]): Graph {
	return JSON.parse(
		run(
			"depcruise",
			["--config", CONFIG, "--output-type", "json", ...targets],
			resolve(ROOT, "tests/fixtures", fixture),
		).stdout,
	) as Graph;
}

function violations(graph: Graph) {
	return graph.summary.violations.map((v) => `${v.rule.name}: ${v.from} -> ${v.to}`).toSorted();
}

describe("shared architecture rules", () => {
	for (const { name, targets, edges } of CASES) {
		it(`${name} rejects exactly its forbidden edges`, () => {
			assert.deepEqual(
				violations(cruise(name, targets)),
				edges.map(([from, to]) => `${name}: ${from} -> ${to}`).toSorted(),
			);
		});
	}

	it("has regression coverage for every configured rule", () => {
		const graph = cruise("valid");
		assert.deepEqual(
			graph.summary.ruleSetUsed.forbidden.map((r) => r.name).toSorted(),
			CASES.map((c) => c.name).toSorted(),
		);
	});

	it("preserves type-only re-exports, test imports and legal nested surfaces", () => {
		const graph = cruise("valid");
		assert.deepEqual(violations(graph), []);
		const edges = graph.modules.flatMap((m) => m.dependencies.map((d) => `${m.source} -> ${d.resolved}`));
		for (const edge of [
			"src/components/widget/index.ts -> src/components/widget/internal/types.ts",
			"src/components/widget/widget.spec.ts -> src/components/widget/index.ts",
			"src/components/widget/internal/use.ts -> src/components/widget/internal/sub/index.ts",
			"src/components/widget/internal/sub/internal/read.ts -> src/components/widget/internal/types.ts",
		]) {
			assert.ok(edges.includes(edge), `missing edge ${edge}: parser may have silently degraded`);
		}
	});
});

interface LintReport {
	diagnostics: { category: string; location: { path: string } }[];
	summary: { unchanged: number; diagnosticsNotPrinted: number };
}

describe("Biome environment boundary", () => {
	it("rejects component env reads and allows app/script env handoff", () => {
		const report = JSON.parse(
			run("biome", ["lint", "--reporter=json", "."], resolve(ROOT, "tests/fixtures/no-process-env")).stdout,
		) as LintReport;
		assert.ok(report.summary.unchanged >= 4, "fixture sources were not linted");
		assert.equal(report.summary.diagnosticsNotPrinted, 0);
		assert.deepEqual(
			report.diagnostics.map((d) => ({ category: d.category, path: d.location.path })),
			[{ category: "lint/style/noProcessEnv", path: "src/components/widget/index.ts" }],
		);
	});

	it("excludes deliberately invalid fixtures from its own lint", () => {
		const result = run("biome", ["lint", "--reporter=json", "."], ROOT);
		const report = JSON.parse(result.stdout) as LintReport;
		assert.equal(result.status, 0, result.stdout);
		assert.ok(report.summary.unchanged >= 7, "package sources were not linted");
		assert.equal(report.summary.diagnosticsNotPrinted, 0);
		assert.deepEqual(report.diagnostics, []);
	});

	it("keeps coverage out of published presets so each consumer owns it", () => {
		const biome = JSON.parse(readFileSync(resolve(ROOT, "presets/biome-preset.json"), "utf8"));
		const tsconfig = JSON.parse(readFileSync(resolve(ROOT, "presets/tsconfig.json"), "utf8"));
		assert.equal(biome.files, undefined);
		assert.equal(tsconfig.include, undefined);
	});
});
