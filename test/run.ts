// Minimal test runner — no framework. Run with `npm test`.
//
// These are unit tests, not whole programs: each one builds the smallest
// circuit that exercises one behaviour (a single gate's truth table, one DFF
// ticking, a 4-word ROM lookup, the loader resolving an import) and checks it.
// The full demo machines live in workbench/ and are exercised by the CLI.
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { parse, parseInto } from "../src/parser.ts";
import { loadProgram } from "../src/loader.ts";
import { flatten, evaluate, tick, initialState, type Netlist } from "../src/simulator.ts";
import { assemble } from "../src/asm.ts";
import type { Bit, GateDef } from "../src/types.ts";

const here = dirname(fileURLToPath(import.meta.url));
let passed = 0;
let failed = 0;

function check(name: string, got: unknown, want: unknown): void {
  if (JSON.stringify(got) === JSON.stringify(want)) {
    passed++;
  } else {
    failed++;
    console.error(`  FAIL ${name}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
  }
}

/** Assert that `fn` throws, optionally that the message contains `needle`. */
function throws(name: string, fn: () => unknown, needle?: string): void {
  try {
    fn();
  } catch (e) {
    const msg = (e as Error).message;
    if (needle && !msg.includes(needle)) {
      failed++;
      console.error(`  FAIL ${name}: threw "${msg}", expected to contain "${needle}"`);
      return;
    }
    passed++;
    return;
  }
  failed++;
  console.error(`  FAIL ${name}: expected a throw, but it returned normally`);
}

const compile = (src: string, entry: string): Netlist => flatten(parse(src, entry));

/** Evaluate `net` for the given input bits and return its output bits in order. */
function out(net: Netlist, inputs: number[]): Bit[] {
  const { values } = evaluate(net, inputs as Bit[]);
  return net.outputs.map((o) => values[o]!) as Bit[];
}

// A reusable inline gate library (the same NAND derivations the workbench uses).
const LIB = `
NOT:
  IN [a]
  OUT [b]
  NAND [a, a], [b]
AND:
  IN [a, b]
  OUT [c]
  NAND [a, b], [t]
  NAND [t, t], [c]
OR:
  IN [a, b]
  OUT [c]
  NOT [a], [na]
  NOT [b], [nb]
  NAND [na, nb], [c]
XOR:
  IN [a, b]
  OUT [c]
  NAND [a, b], [t]
  NAND [a, t], [u]
  NAND [b, t], [v]
  NAND [u, v], [c]
HALFADD:
  IN [a, b]
  OUT [s, c]
  XOR [a, b], [s]
  AND [a, b], [c]
FULLADD:
  IN [a, b, cin]
  OUT [s, cout]
  HALFADD [a, b], [s1, c1]
  HALFADD [s1, cin], [s, c2]
  OR [c1, c2], [cout]
MUX2:
  IN [s, a, b]
  OUT [y]
  NOT [s], [ns]
  AND [ns, a], [t0]
  AND [s, b], [t1]
  OR [t0, t1], [y]
`;

// --- Parser ------------------------------------------------------------------
{
  const gates = new Map<string, GateDef>();
  parseInto(
    `# a comment line
AND:
  IN [a, b]      # inline comment
  OUT [c]
  NAND [a, b], [t]
  NAND [t, t], [c]`,
    gates,
  );
  const and = gates.get("AND")!;
  check("parse: gate name", and?.name, "AND");
  check("parse: inputs", and?.inputs, ["a", "b"]);
  check("parse: outputs", and?.outputs, ["c"]);
  check("parse: call count (comments ignored)", and?.calls.length, 2);
  check("parse: call shape", and?.calls[0], { gate: "NAND", inputs: ["a", "b"], outputs: ["t"], line: 5 });

  throws("parse: duplicate gate", () => parse("X:\n IN [a]\n OUT [a]\nX:\n IN [a]\n OUT [a]", "X"), "duplicate");
  throws("parse: missing entry", () => parse("X:\n IN [a]\n OUT [a]", "nope"), "not defined");
  throws("parse: statement outside a gate", () => parse("NAND [a, b], [c]", "X"), "outside");
}

// --- Native NAND + the gates derived from it ---------------------------------
{
  const nand = compile("g:\n IN [a, b]\n OUT [c]\n NAND [a, b], [c]", "g");
  const table = [0, 1].flatMap((a) => [0, 1].map((b) => out(nand, [a, b])[0]));
  check("NAND truth table", table, [1, 1, 1, 0]);

  const gate = (entry: string) => compile(`${LIB}\nentry:\n IN [a, b]\n OUT [c]\n ${entry} [a, b], [c]`, "entry");
  const t2 = (net: Netlist) => [0, 1].flatMap((a) => [0, 1].map((b) => out(net, [a, b])[0]));
  check("NOT(a) ignores b", t2(compile(`${LIB}\nentry:\n IN [a, b]\n OUT [c]\n NOT [a], [c]`, "entry")), [1, 1, 0, 0]);
  check("AND truth table", t2(gate("AND")), [0, 0, 0, 1]);
  check("OR truth table", t2(gate("OR")), [0, 1, 1, 1]);
  check("XOR truth table", t2(gate("XOR")), [0, 1, 1, 0]);

  // MUX2: y = s ? b : a, over all 8 input combinations.
  const mux = compile(`${LIB}\nentry:\n IN [s, a, b]\n OUT [y]\n MUX2 [s, a, b], [y]`, "entry");
  for (const s of [0, 1]) for (const a of [0, 1]) for (const b of [0, 1]) {
    check(`MUX2 s=${s} a=${a} b=${b}`, out(mux, [s, a, b])[0], (s ? b : a) as Bit);
  }
}

// --- Composite combinational: full adder + a 2-bit ripple adder --------------
{
  const fa = compile(`${LIB}\nentry:\n IN [a, b, cin]\n OUT [s, cout]\n FULLADD [a, b, cin], [s, cout]`, "entry");
  for (const a of [0, 1]) for (const b of [0, 1]) for (const cin of [0, 1]) {
    const total = a + b + cin;
    check(`FULLADD ${a}+${b}+${cin}`, out(fa, [a, b, cin]), [(total & 1) as Bit, ((total >> 1) & 1) as Bit]);
  }

  // 2-bit adder: half-add the low bits, full-add the high bits with the carry.
  const add2 = compile(
    `${LIB}\nadd2:\n IN [a0, a1, b0, b1]\n OUT [s0, s1, s2]\n HALFADD [a0, b0], [s0, k]\n FULLADD [a1, b1, k], [s1, s2]`,
    "add2",
  );
  for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) {
    const bits = out(add2, [a & 1, (a >> 1) & 1, b & 1, (b >> 1) & 1]);
    const got = bits[0]! | (bits[1]! << 1) | (bits[2]! << 2);
    check(`add2 ${a}+${b}`, got, a + b);
  }
}

// --- Sequential: the DFF native -----------------------------------------------
{
  // A T flip-flop: d = NOT q, so q toggles every tick.
  const toggle = compile("t:\n IN []\n OUT [q]\n NAND [q, q], [d]\n DFF [d], [q]", "t");
  let state = initialState(toggle);
  for (let i = 0; i < 6; i++) {
    const r = tick(toggle, [], state);
    check(`toggle tick ${i}`, r.values[toggle.outputs[0]!], (i % 2) as Bit);
    state = r.next;
  }

  // A 2-bit counter: next = count + 1.  (outputs are q1, q0 — MSB first.)
  const counter = compile(
    `${LIB}\ncount2:\n IN []\n OUT [q1, q0]\n DFF [d0], [q0]\n DFF [d1], [q1]\n NOT [q0], [d0]\n XOR [q1, q0], [d1]`,
    "count2",
  );
  state = initialState(counter);
  for (let i = 0; i < 9; i++) {
    const r = tick(counter, [], state);
    const v = (r.values[counter.outputs[1]!]! ) | (r.values[counter.outputs[0]!]! << 1);
    check(`count2 tick ${i}`, v, i % 4);
    state = r.next;
  }
}

// --- Native ROM: combinational address -> word lookup ------------------------
{
  const mem = compile("m:\n IN [a0, a1]\n OUT [d0, d1, d2, d3]\n ROM [a0, a1], [d0, d1, d2, d3]", "m");
  const rom = [0b0001, 0b0010, 0b0100, 0b1000]; // word[i] = 1 << i
  for (let addr = 0; addr < 4; addr++) {
    const { values } = evaluate(mem, [addr & 1, (addr >> 1) & 1] as Bit[], { rom });
    const word = mem.outputs.reduce((acc, o, i) => acc | (values[o]! << i), 0);
    check(`ROM[${addr}]`, word, rom[addr]);
  }
}

// --- Assembler ----------------------------------------------------------------
{
  const { words, errors } = assemble("LDI R1, 5\nOUT R1\nHLT");
  check("asm: no errors", errors.length, 0);
  check("asm: word count", words.length, 3);
  check("asm: LDI R1,5 encoding", words[0], (0b0100 << 12) | (1 << 10) | 5);
  check("asm: OUT R1 encoding", words[1], (0b0111 << 12) | (1 << 8));
  check("asm: HLT encoding", words[2], 0b1111 << 12);

  // Labels resolve to instruction addresses; jumps target them.
  const looped = assemble("start:\n JMP start");
  check("asm: label/jump", looped.words[0], (0b0101 << 12) | 0);

  check("asm: reports a bad instruction", assemble("FOO R0").errors[0]?.message, "unknown instruction 'FOO'");
}

// --- Loader: #% import resolution --------------------------------------------
{
  const fx = (name: string) => join(here, "fixtures", name);

  // use-and.compute imports and-lib.compute and uses its AND in a 3-input AND.
  const and3 = flatten(loadProgram(fx("use-and.compute"), "and3"));
  for (let n = 0; n < 8; n++) {
    const [a, b, c] = [n & 1, (n >> 1) & 1, (n >> 2) & 1];
    check(`import: and3(${a},${b},${c})`, out(and3, [a, b, c])[0], (a & b & c) as Bit);
  }

  throws("import: redefining an imported gate is rejected", () => loadProgram(fx("dup-and.compute"), "AND"), "duplicate");
  throws("import: a cycle is detected", () => loadProgram(fx("cycle-a.compute"), "A"), "circular");
  throws("import: a missing file is reported", () => loadProgram(fx("use-and.compute"), "nope"), "not defined");
  throws("import: unreadable import path", () => loadProgram(join(here, "fixtures", "does-not-exist.compute"), "x"), "cannot read");
}

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
