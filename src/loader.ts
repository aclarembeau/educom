import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { parseInto, ParseError } from "./parser.ts";
import { detectImports } from "./ui.ts";
import type { GateDef, Program } from "./types.ts";

/**
 * Load a `.compute` program, resolving its `#% import` chain.
 *
 * Imports let a file build on the gates defined by another instead of repeating
 * them: `1-basic-gates.compute` imports `0-simple-and.compute` to reuse its
 * `AND`/`NOT`, and so on up the workbench progression. Resolution is recursive
 * and depth-first, so by the time a file's own definitions are parsed, every
 * gate it relies on is already in the shared map.
 *
 * Only gate *definitions* cross an import boundary — UI/`#% code`/`#% entry`
 * directives are read from the top-level file alone (see `ui.ts`). A file is
 * parsed at most once even if several files import it (a diamond), and a cycle
 * is reported rather than followed.
 */
export function loadProgram(file: string, entry: string): Program {
  const gates = new Map<string, GateDef>();
  const onStack = new Set<string>(); // files currently being resolved (cycle guard)
  const done = new Set<string>(); // files already merged (diamond guard)

  function loadFile(path: string): void {
    const abs = resolve(path);
    if (done.has(abs)) return;
    if (onStack.has(abs)) {
      throw new ParseError(`circular import involving '${path}'`, 0);
    }
    onStack.add(abs);

    let source: string;
    try {
      source = readFileSync(abs, "utf8");
    } catch {
      throw new ParseError(`cannot read imported file '${path}'`, 0);
    }

    // Resolve dependencies first so their gates are defined before this file's.
    for (const imp of detectImports(source)) {
      loadFile(resolve(dirname(abs), imp));
    }
    parseInto(source, gates);

    onStack.delete(abs);
    done.add(abs);
  }

  loadFile(file);
  if (!gates.has(entry)) {
    throw new ParseError(`entrypoint gate '${entry}' is not defined`, 0);
  }
  return { gates, entry };
}
