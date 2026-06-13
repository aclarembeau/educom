#!/usr/bin/env node
// educom launcher (plain JS so it runs anywhere — including under node_modules).
//
// educom's CLI is native TypeScript (src/cli.ts), run with Node's
// --experimental-strip-types. Node refuses to strip types for files under
// node_modules, so `npx`/`npm -g` can't execute src/cli.ts directly. This tiny
// launcher bridges that: when it's running from a real checkout it execs the
// sibling src/cli.ts; when it's running from under node_modules (npx / global
// install) it makes a one-time clone into ~/.educom and execs the CLI there.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve, sep } from "node:path";
import { homedir } from "node:os";

const REPO = process.env.EDUCOM_REPO || "https://github.com/aclarembeau/educom.git";
const root = resolve(dirname(fileURLToPath(import.meta.url)), ".."); // package root (…/bin/..)

function runCli(cliPath) {
  if (!existsSync(cliPath)) {
    console.error(`educom: cannot find the CLI at ${cliPath}`);
    process.exit(1);
  }
  const r = spawnSync(
    process.execPath,
    ["--experimental-strip-types", cliPath, ...process.argv.slice(2)],
    { stdio: "inherit" },
  );
  if (r.error) {
    console.error(`educom: failed to launch — ${r.error.message}`);
    process.exit(1);
  }
  process.exit(r.status ?? 0);
}

const underNodeModules = root.split(sep).includes("node_modules");

if (!underNodeModules) {
  // A real checkout (clone, curl install, npm link, source): run it in place.
  runCli(join(root, "src", "cli.ts"));
} else {
  // npx / global install: Node won't strip types here. Bootstrap a clone.
  const home = process.env.EDUCOM_HOME || join(homedir(), ".educom");
  if (!existsSync(join(home, "src", "cli.ts"))) {
    console.error(`educom: first run — fetching the lessons into ${home} …`);
    const clone = spawnSync("git", ["clone", "--depth", "1", REPO, home], { stdio: "inherit" });
    if (clone.status !== 0) {
      console.error("educom: clone failed. Is git installed? You can also install via:");
      console.error("  curl -fsSL https://raw.githubusercontent.com/aclarembeau/educom/main/install.sh | sh");
      process.exit(1);
    }
  }
  runCli(join(home, "src", "cli.ts"));
}
