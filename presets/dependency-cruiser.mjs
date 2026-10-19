// Paths are relative to the service's cwd, not to this installed package. Consumers own cruise
// targets, component edges and library confinement; this preset only enforces the zone/unit model.
export default {
	forbidden: [
		{
			name: "lib-not-to-components",
			comment: "Domain-free lib units cannot depend on domain components.",
			severity: "error",
			from: { path: "^src/lib/" },
			to: { path: "^src/components/" },
		},
		{
			name: "lib-not-to-app",
			comment: "Configuration arrives through deps, never by importing the composition root.",
			severity: "error",
			from: { path: "^src/lib/" },
			to: { path: "^src/app/" },
		},
		{
			name: "components-not-to-app",
			severity: "error",
			from: { path: "^src/components/" },
			to: { path: "^src/app/" },
		},
		{
			name: "not-to-main",
			severity: "error",
			from: {},
			to: { path: "^src/main\\.ts$" },
		},
		{
			name: "not-to-scripts",
			comment: "Scripts are external callers, not shared implementation modules.",
			severity: "error",
			from: {},
			to: { path: "^scripts/" },
		},
		{
			name: "not-to-tools",
			comment: "Support tooling and deliberately invalid fixtures are outside the service graph.",
			severity: "error",
			from: {},
			to: { path: "^tools/" },
		},
		// Capture substitution is from -> to. The non-greedy branch captures the outermost unit:
		// sub-units may read parent vocabulary, but callers outside that unit cannot bypass it.
		{
			name: "not-to-foreign-internal",
			severity: "error",
			from: { path: "^(.+?)/internal/|^(.+)/[^/]+\\.ts$" },
			to: { path: "^src/.*/internal/", pathNot: "^$1/internal/" },
		},
		// The deepest unit root lets this catch downward bypasses of nested surfaces separately.
		{
			name: "not-to-nested-internal",
			severity: "error",
			from: { path: "^(.+)/index\\.ts$|^(.+)/internal/[^/]+\\.ts$|^(.+)/[^/]+\\.ts$" },
			to: { path: "^$1/internal/.*/internal/" },
		},
		{
			name: "not-to-banned-name",
			comment: "Only imported modules are checked: unimported vague names remain a review concern.",
			severity: "error",
			from: {},
			to: {
				path: "^(?:src|scripts)/(?:utils|helpers)\\.ts$|^(?:src|scripts)/.*/(?:utils|helpers)\\.ts$|^(?:src|scripts)/(?:shared|common)/|^(?:src|scripts)/.*/(?:shared|common)/|^src/lib/utils/",
			},
		},
		{
			name: "no-circular",
			comment: "Type-only imports also form edges and cycles.",
			severity: "error",
			from: {},
			to: { circular: true },
		},
	],
	options: {
		// Native TypeScript 7 has no classic compiler API. dependency-cruiser's silent acorn
		// fallback loses type re-export edges; SWC plus fidelity tests guards against false greens.
		parser: "swc",
		enhancedResolveOptions: {
			conditionNames: ["import", "require", "node", "default"],
			exportsFields: ["exports"],
			mainFields: ["module", "main", "types"],
			extensions: [".ts", ".mts", ".cts", ".js", ".mjs", ".cjs", ".json"],
		},
		doNotFollow: { path: "node_modules" },
	},
};
