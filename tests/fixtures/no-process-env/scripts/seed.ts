// Scripts may hand the environment to app/'s config loader. Exempting app/ alone would
// reject this legal entry-point use.
import { loadConfig } from "../src/app/config.ts";

const config = loadConfig(process.env);

console.log(`seeding against port ${config.listenPort}`);
