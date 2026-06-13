import type { Program } from "./types.ts";

// Native I/O elements ("peripherals") that connect the abstract circuit to a
// human. Declared in a `.compute` file with `#%` directive comments, e.g.:
//
//   #% title : 4-bit Calculator
//   #% switch a0 : A bit 0
//   #% seg7 s3 s2 s1 s0 : Sum          (wires listed most-significant first)
//   #% led carry : Carry
//
// These are the minimal set needed to build an interactive calculator:
//   - switch : a 1-bit input the user toggles on/off
//   - seg7   : an N-bit output rendered as a hex digit (the "7-seg adapter")
//   - led    : a 1-bit output shown as a lamp

export interface SwitchEl {
  kind: "switch";
  wire: string;
  label: string;
}

export interface LedEl {
  kind: "led";
  wire: string;
  label: string;
}

/** A binary-to-7-segment adapter: `wires` are bits, most-significant first. */
export interface Seg7El {
  kind: "seg7";
  wires: string[];
  label: string;
}

export type UiElement = SwitchEl | LedEl | Seg7El;

export interface UiSpec {
  title: string;
  inputs: SwitchEl[];
  outputs: (LedEl | Seg7El)[];
  /** Present if the program declares a `#% screen W H` pixel display. */
  screen?: { width: number; height: number };
  /** True if the program declares a `#% keyboard` input. */
  keyboard?: boolean;
}

/** Read the `#% entry NAME` directive, if present, else fall back. */
export function detectEntry(source: string, fallback = "program"): string {
  for (const line of source.split(/\r?\n/)) {
    const m = line.match(/^\s*#%\s*entry\s*:?\s*([A-Za-z0-9_]+)/i);
    if (m) return m[1]!;
  }
  return fallback;
}

/**
 * Collect `#% import : PATH` directives, in order.
 *
 * Each path is resolved by the loader relative to the file that declares it, so
 * a step like `1-basic-gates.compute` can pull in every gate defined by
 * `0-simple-and.compute` instead of redeclaring the primitives.
 */
export function detectImports(source: string): string[] {
  const out: string[] = [];
  for (const line of source.split(/\r?\n/)) {
    const m = line.match(/^\s*#%\s*import\b\s*:?\s*(.+?)\s*$/i);
    if (m && m[1]) out.push(m[1]);
  }
  return out;
}

/** Collect the program embedded in `#% code` directives, in order. */
export function detectCode(source: string): string {
  const out: string[] = [];
  for (const line of source.split(/\r?\n/)) {
    const m = line.match(/^\s*#%\s*code\b\s*:?\s?(.*)$/i);
    if (m) out.push(m[1] ?? "");
  }
  return out.join("\n");
}

/** True if the program declares a `#% rom` directive (i.e. it runs code). */
export function hasRom(source: string): boolean {
  return /^\s*#%\s*rom\b/im.test(source);
}

/** Split a directive payload into its wire tokens and an optional `: label`. */
function splitLabel(rest: string): { tokens: string[]; label: string } {
  const colon = rest.indexOf(":");
  const head = colon === -1 ? rest : rest.slice(0, colon);
  const label = colon === -1 ? "" : rest.slice(colon + 1).trim();
  const tokens = head.split(/[\s,]+/).filter((t) => t.length > 0);
  return { tokens, label };
}

/**
 * Extract the UI spec from `#%` directive lines in the source.
 *
 * If a program declares no UI directives, a sensible default is synthesised:
 * one switch per entrypoint input, one LED per entrypoint output.
 */
export function parseUi(source: string, program: Program): UiSpec {
  const entry = program.gates.get(program.entry)!;
  const validIn = new Set(entry.inputs);
  const validOut = new Set(entry.outputs);

  const spec: UiSpec = { title: program.entry, inputs: [], outputs: [] };
  let hasDirectives = false;

  const lines = source.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i]!.match(/^\s*#%\s*(.*)$/);
    if (!m) continue;
    const body = m[1]!.trim();
    if (body.length === 0) continue;
    const sp = body.indexOf(" ");
    const verb = (sp === -1 ? body : body.slice(0, sp)).toLowerCase();
    const rest = sp === -1 ? "" : body.slice(sp + 1);
    const { tokens, label } = splitLabel(rest);
    const where = `directive on line ${i + 1}`;

    switch (verb) {
      case "entry":
      case "import":
      case "rom":
      case "code":
        // Consumed elsewhere (detectEntry / detectImports / detectCode); ignored here.
        break;
      case "title":
        spec.title = (label || tokens.join(" ")) || program.entry;
        break;
      case "switch": {
        hasDirectives = true;
        const wire = tokens[0];
        if (!wire) throw new Error(`${where}: switch needs a wire name`);
        if (!validIn.has(wire)) throw new Error(`${where}: '${wire}' is not an input of '${program.entry}'`);
        spec.inputs.push({ kind: "switch", wire, label: label || wire });
        break;
      }
      case "led": {
        hasDirectives = true;
        const wire = tokens[0];
        if (!wire) throw new Error(`${where}: led needs a wire name`);
        if (!validOut.has(wire)) throw new Error(`${where}: '${wire}' is not an output of '${program.entry}'`);
        spec.outputs.push({ kind: "led", wire, label: label || wire });
        break;
      }
      case "seg7": {
        hasDirectives = true;
        if (tokens.length === 0) throw new Error(`${where}: seg7 needs at least one wire`);
        for (const w of tokens) {
          if (!validOut.has(w)) throw new Error(`${where}: '${w}' is not an output of '${program.entry}'`);
        }
        spec.outputs.push({ kind: "seg7", wires: tokens, label: label || "seg7" });
        break;
      }
      case "screen": {
        const w = Number(tokens[0] ?? 16);
        const h = Number(tokens[1] ?? tokens[0] ?? 16);
        spec.screen = { width: w || 16, height: h || 16 };
        break;
      }
      case "keyboard":
        spec.keyboard = true;
        break;
      default:
        throw new Error(`${where}: unknown UI directive '${verb}'`);
    }
  }

  if (!hasDirectives) {
    spec.inputs = entry.inputs.map((wire) => ({ kind: "switch", wire, label: wire }));
    spec.outputs = entry.outputs.map((wire) => ({ kind: "led", wire, label: wire }));
  }
  return spec;
}
