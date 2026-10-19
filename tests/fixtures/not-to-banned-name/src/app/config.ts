import type { Thing } from "../common/thing.ts";
import type { Vocab } from "../components/widget/shared/vocab.ts";
import type { Misc } from "../lib/utils/misc.ts";
import type { Loose } from "../utils.ts";

export type Config = { loose: Loose; thing: Thing; vocab: Vocab; misc: Misc };
