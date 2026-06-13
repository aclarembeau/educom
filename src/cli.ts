#!/usr/bin/env node --experimental-strip-types
import { readFileSync } from "node:fs";
import { ParseError } from "./parser.ts";
import { loadProgram } from "./loader.ts";
import { evaluate, flatten, tick, initialState, SimError, type Netlist } from "./simulator.ts";
import { serve } from "./server.ts";
import { detectEntry, detectCode } from "./ui.ts";
import { assemble } from "./asm.ts";
import type { Bit, Program } from "./types.ts";

const USAGE = `compute — a NAND-gate computer simulator

Usage:
  compute run   <file> [--entry NAME] [--in a=1,b=0,...] [--cycles N]
  compute tick  <file> [--entry NAME] [--in a=1,b=0,...] [--ticks N]
  compute table <file> [--entry NAME]
  compute info  <file> [--entry NAME]
  compute serve <file> [--port N]

Commands:
  run     Evaluate the circuit once for a given set of input bits.
  tick    Advance a sequential (flip-flop) circuit N clock ticks.
  table   Print the full truth table over every input combination.
  info    Show gate ports and the size of the flattened NAND netlist.
  serve   Launch an interactive web UI (switches, 7-seg displays, LEDs).

Options:
  --entry NAME   Entrypoint gate (default: program).
  --in  LIST     Comma-separated wire=bit assignments, e.g. --in a=1,b=0.
                 Unspecified inputs default to 0.
  --cycles N     Run N clock cycles, toggling the clock each cycle (default 1).
  --ticks N      Number of clock ticks for 'tick' (default 16).
  --port N       Port for the web server (default 8080).

Examples:
  compute run   program.compute --in a=1,b=1,c=1
  compute table program.compute
  compute info  program.compute`;

interface Args {
  command: string;
  file?: string;
  entry: string;
  /** True when --entry was passed explicitly (overrides the `#% entry` directive). */
  entryExplicit: boolean;
  inputs: Map<string, Bit>;
  cycles: number;
  ticks: number;
  port: number;
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    command: argv[0] ?? "",
    entry: "program",
    entryExplicit: false,
    inputs: new Map(),
    cycles: 1,
    ticks: 16,
    port: 8080,
  };
  let i = 1;
  if (argv[1] && !argv[1].startsWith("--")) {
    args.file = argv[1];
    i = 2;
  }
  for (; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "--entry") {
      args.entry = req(argv, ++i, "--entry");
      args.entryExplicit = true;
    }
    else if (a === "--port") args.port = parseInt(req(argv, ++i, "--port"), 10) || 8080;
    else if (a === "--cycles") args.cycles = Math.max(1, parseInt(req(argv, ++i, "--cycles"), 10) || 1);
    else if (a === "--ticks") args.ticks = Math.max(1, parseInt(req(argv, ++i, "--ticks"), 10) || 1);
    else if (a === "--in") {
      for (const pair of req(argv, ++i, "--in").split(",")) {
        const [k, v] = pair.split("=").map((s) => s.trim());
        if (!k) continue;
        args.inputs.set(k, v === "1" ? 1 : 0);
      }
    } else if (a === "--help" || a === "-h") {
      console.log(USAGE);
      process.exit(0);
    } else if (!args.file && !a.startsWith("--")) {
      args.file = a;
    } else {
      fail(`unknown option '${a}'`);
    }
  }
  return args;
}

function req(argv: string[], i: number, name: string): string {
  const v = argv[i];
  if (v === undefined) fail(`${name} requires a value`);
  return v!;
}

function fail(msg: string): never {
  console.error(`error: ${msg}`);
  process.exit(1);
}

function load(args: Args): { program: Program; net: Netlist; source: string } {
  if (!args.file) fail("no input file given (try --help)");
  let source: string;
  try {
    source = readFileSync(args.file!, "utf8");
  } catch {
    fail(`cannot read file '${args.file}'`);
  }
  // An explicit --entry wins; otherwise honour the file's `#% entry` directive.
  const entry = args.entryExplicit ? args.entry : detectEntry(source!);
  try {
    // loadProgram resolves any `#% import` chain before flattening.
    const program = loadProgram(args.file!, entry);
    return { program, net: flatten(program), source: source! };
  } catch (e) {
    if (e instanceof ParseError || e instanceof SimError) fail(e.message);
    throw e;
  }
}

function bits(n: number, width: number): Bit[] {
  const out: Bit[] = [];
  for (let i = width - 1; i >= 0; i--) out.push(((n >> i) & 1) as Bit);
  return out;
}

function cmdRun(args: Args): void {
  const { program, net } = load(args);
  const entry = program.gates.get(program.entry)!;
  const input = entry.inputs.map((name) => args.inputs.get(name) ?? 0);

  // Run `cycles` clock ticks, carrying state forward (relevant for sequential
  // circuits using `clock`). The clock toggles each tick.
  let seed: Int8Array | undefined;
  let result!: ReturnType<typeof evaluate>;
  for (let c = 0; c < args.cycles; c++) {
    result = evaluate(net, input, { clock: (c % 2) as Bit, seed });
    seed = result.values;
  }
  if (!result.settled) {
    console.error("warning: circuit did not settle (unstable feedback?)");
  }

  const inStr = entry.inputs.map((n, i) => `${n}=${input[i]}`).join(" ") || "(none)";
  const outStr =
    entry.outputs.map((n, i) => `${n}=${result.values[net.outputs[i]!]}`).join(" ") || "(none)";
  console.log(`${program.entry}:  in[ ${inStr} ]  ->  out[ ${outStr} ]`);
}

function cmdTick(args: Args): void {
  const { program, net, source } = load(args);
  const entry = program.gates.get(program.entry)!;
  const input = entry.inputs.map((name) => args.inputs.get(name) ?? 0);

  if (net.dffs.length === 0) {
    console.error("note: this circuit has no flip-flops; tick behaves like run");
  }

  // Assemble any embedded program for the ROM (CPU programs live in `#% code`).
  let rom: number[] = [];
  if (net.roms.length > 0) {
    const { words, errors } = assemble(detectCode(source));
    if (errors.length) {
      for (const e of errors) console.error(`asm error (code line ${e.line}): ${e.message}`);
      fail("program failed to assemble");
    }
    rom = words;
    console.log(`loaded ${words.length}-instruction program into ROM`);
  }

  let state = initialState(net);
  const fmtOut = (values: Int8Array) =>
    entry.outputs.map((n, i) => `${n}=${values[net.outputs[i]!]}`).join(" ") || "(none)";

  const inStr = entry.inputs.map((n, i) => `${n}=${input[i]}`).join(" ") || "(none)";
  console.log(`${program.entry}  in[ ${inStr} ]   (${net.dffs.length} flip-flops)`);
  for (let t = 0; t < args.ticks; t++) {
    const r = tick(net, input, state, { rom });
    state = r.next;
    const warn = r.settled ? "" : "  [unstable]";
    console.log(`  tick ${String(t + 1).padStart(3)}:  ${fmtOut(r.values)}${warn}`);
  }
}

function cmdTable(args: Args): void {
  const { program, net } = load(args);
  const entry = program.gates.get(program.entry)!;
  const w = entry.inputs.length;
  if (w > 16) fail(`truth table over ${w} inputs is too large (max 16)`);

  const head = [...entry.inputs, "|", ...entry.outputs];
  console.log(head.join("  "));
  console.log("-".repeat(head.join("  ").length));
  for (let n = 0; n < 1 << w; n++) {
    const input = bits(n, w);
    const { values } = evaluate(net, input);
    const row = [
      ...input.map(String),
      "|",
      ...net.outputs.map((o) => String(values[o])),
    ];
    console.log(row.join("  "));
  }
}

function cmdInfo(args: Args): void {
  const { program, net } = load(args);
  const entry = program.gates.get(program.entry)!;
  console.log(`entrypoint:  ${program.entry}`);
  console.log(`inputs:      [${entry.inputs.join(", ")}]  (${entry.inputs.length})`);
  console.log(`outputs:     [${entry.outputs.join(", ")}]  (${entry.outputs.length})`);
  console.log(`defined:     ${[...program.gates.keys()].join(", ")}`);
  console.log(`flattened:   ${net.nands.length} NAND gate(s), ${net.size} wire(s), ${net.clocks.length} clock(s)`);
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  switch (args.command) {
    case "run":
      return cmdRun(args);
    case "tick":
      return cmdTick(args);
    case "table":
      return cmdTable(args);
    case "info":
      return cmdInfo(args);
    case "serve": {
      if (!args.file) fail("no input file given (try --help)");
      // Only override the entry if the user passed --entry explicitly; otherwise
      // let the server read the `#% entry` directive from the file.
      const override = args.entryExplicit ? args.entry : undefined;
      return serve(args.file!, args.port, override);
    }
    case "":
    case "help":
    case "--help":
    case "-h":
      console.log(USAGE);
      return;
    default:
      fail(`unknown command '${args.command}' (try --help)`);
  }
}

main();
