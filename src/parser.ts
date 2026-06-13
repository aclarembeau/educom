import type { Call, GateDef, Program } from "./types.ts";

export class ParseError extends Error {
  line: number;
  constructor(message: string, line: number) {
    super(`line ${line}: ${message}`);
    this.name = "ParseError";
    this.line = line;
  }
}

/** Strip a `#` comment from a line, respecting nothing fancy (no strings exist). */
function stripComment(line: string): string {
  const i = line.indexOf("#");
  return i === -1 ? line : line.slice(0, i);
}

/** Parse a comma/space separated identifier list from a `[...]` group body. */
function parseIdList(body: string): string[] {
  return body
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** Extract every `[...]` group on a line, in order. */
function bracketGroups(text: string): string[][] {
  const groups: string[][] = [];
  const re = /\[([^\]]*)\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    groups.push(parseIdList(m[1]!));
  }
  return groups;
}

/**
 * Parse `.compute` source, adding every gate definition it contains to `gates`.
 *
 * This is the reusable core of {@link parse}: the loader calls it once per file
 * to merge the definitions from an import chain into a single shared map. A gate
 * whose name already exists in `gates` is a duplicate (within a file or across
 * an import boundary) and is rejected.
 *
 * Grammar (whitespace-insensitive beyond line breaks):
 *   definition := NAME ':'
 *   statement  := 'IN'  '[' idlist ']'
 *              |  'OUT' '[' idlist ']'
 *              |  NAME '[' idlist ']' [','] '[' idlist ']'   // call: inputs, outputs
 *              |  NAME '[' idlist ']'                         // source call: outputs only
 *
 * `#%` directive lines (entry, import, UI, code) start with `#` and so are
 * stripped as comments here — they are read separately by `ui.ts`/`loader.ts`.
 */
export function parseInto(source: string, gates: Map<string, GateDef>): void {
  let current: GateDef | null = null;

  const lines = source.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]!;
    const lineNo = i + 1;
    const text = stripComment(raw).trimEnd();
    if (text.trim().length === 0) continue;

    // A definition header sits at column 0 and ends in ':'.
    const header = text.match(/^([A-Za-z0-9_]+)\s*:\s*$/);
    if (header && !/^\s/.test(raw)) {
      const name = header[1]!;
      if (gates.has(name)) throw new ParseError(`duplicate gate '${name}'`, lineNo);
      current = { name, inputs: [], outputs: [], calls: [], line: lineNo };
      gates.set(name, current);
      continue;
    }

    if (!current) {
      throw new ParseError(`statement outside of any gate definition: '${text.trim()}'`, lineNo);
    }

    const stmt = text.trim();
    const keyword = stmt.slice(0, stmt.indexOf("[")).replace(/,\s*$/, "").trim();
    if (keyword.length === 0) {
      throw new ParseError(`could not parse statement: '${stmt}'`, lineNo);
    }
    const groups = bracketGroups(stmt);
    if (groups.length === 0) {
      throw new ParseError(`statement '${keyword}' has no [..] wire list`, lineNo);
    }

    if (keyword === "IN") {
      current.inputs.push(...groups[0]!);
    } else if (keyword === "OUT") {
      current.outputs.push(...groups[0]!);
    } else {
      // A call. Two groups => inputs, outputs. One group => outputs-only source.
      const call: Call =
        groups.length >= 2
          ? { gate: keyword, inputs: groups[0]!, outputs: groups[1]!, line: lineNo }
          : { gate: keyword, inputs: [], outputs: groups[0]!, line: lineNo };
      current.calls.push(call);
    }
  }
}

/**
 * Parse a single `.compute` source into a Program with the given entrypoint.
 *
 * For multi-file programs (those using `#% import`), use `loadProgram` from
 * `loader.ts` instead — it resolves the import chain before parsing.
 */
export function parse(source: string, entry = "program"): Program {
  const gates = new Map<string, GateDef>();
  parseInto(source, gates);
  if (!gates.has(entry)) {
    throw new ParseError(`entrypoint gate '${entry}' is not defined`, 0);
  }
  return { gates, entry };
}
