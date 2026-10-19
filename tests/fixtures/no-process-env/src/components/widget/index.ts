// The violation: a component reading the environment directly instead of receiving
// configuration as plain data through deps.
//
// The rule is a syntactic matcher, so it also catches bare `process.env` passed as an argument,
// destructuring, `process["env"]` and `globalThis.process.env`; what it does not catch is aliasing
// `process` itself first (`const p = process; p.env.X`). That dodge is deliberate, not a hole to
// plug with a second rule.
export function widgetLabel(): string {
	return process.env.SERVICE_WIDGET_LABEL ?? "widget";
}
