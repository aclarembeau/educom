import type { Bit, GateDef, Program } from "./types.ts";

export class SimError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SimError";
  }
}

/**
 * A flattened netlist: the entire program decomposed into primitive nodes.
 *
 * Every wire is identified by an integer. `nand` gates and `clock` sources are
 * the only primitive nodes; user gates are inlined away during flattening.
 * Wires that are connected (a call argument and the callee's port) are merged
 * via union-find so they share one representative id.
 */
export interface Netlist {
  /** Representative wire ids for the entrypoint's inputs, in declared order. */
  inputs: number[];
  /** Representative wire ids for the entrypoint's outputs, in declared order. */
  outputs: number[];
  /** NAND gates: out = !(a & b). */
  nands: { a: number; b: number; out: number }[];
  /** Clock source wires (driven externally each cycle). */
  clocks: number[];
  /**
   * D flip-flops: on each clock tick, `q` becomes the value `d` had at the end
   * of the previous settle. `q` wires hold state and are never driven by NANDs.
   */
  dffs: { d: number; q: number }[];
  /**
   * Read-only memories: combinational lookup of `data` from `addr`. Contents are
   * supplied at run time (e.g. a program typed into the UI), not baked into the
   * netlist — which is exactly why this must be a native rather than gates.
   */
  roms: { addr: number[]; data: number[] }[];
  /**
   * Screen peripherals: on a tick where `we` is 1, the pixel at `addr` takes the
   * value on `data`. Pure output — the framebuffer is accumulated by the host
   * (server) from these wires, like an LED but pixel-addressed.
   */
  screens: { addr: number[]; data: number; we: number }[];
  /** Keyboard peripherals: `data` wires are driven from the host's current key. */
  keyboards: { data: number[] }[];
  /** Total distinct wire representatives, for sizing evaluation buffers. */
  size: number;
}

class UnionFind {
  private parent: number[] = [];
  fresh(): number {
    const id = this.parent.length;
    this.parent.push(id);
    return id;
  }
  find(x: number): number {
    let root = x;
    while (this.parent[root] !== root) root = this.parent[root]!;
    while (this.parent[x] !== root) {
      const next = this.parent[x]!;
      this.parent[x] = root;
      x = next;
    }
    return root;
  }
  union(a: number, b: number): void {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) this.parent[rb] = ra;
  }
  get count(): number {
    return this.parent.length;
  }
}

const isNative = (name: string, target: string) => name.toLowerCase() === target;

/** Flatten a program's entrypoint into a primitive NAND/clock netlist. */
export function flatten(program: Program): Netlist {
  const uf = new UnionFind();
  const nands: { a: number; b: number; out: number }[] = [];
  const clocks: number[] = [];
  const dffs: { d: number; q: number }[] = [];
  const roms: { addr: number[]; data: number[] }[] = [];
  const screens: { addr: number[]; data: number; we: number }[] = [];
  const keyboards: { data: number[] }[] = [];
  let depth = 0;

  // Instantiate `gateName`, wiring the given parent-scope input/output wire ids
  // to the gate's ports.
  function instantiate(gateName: string, argIn: number[], argOut: number[], at: number): void {
    if (depth++ > 10_000) {
      throw new SimError(`recursion limit exceeded instantiating '${gateName}' (cyclic gate definition?)`);
    }

    if (isNative(gateName, "nand")) {
      if (argIn.length !== 2 || argOut.length !== 1) {
        throw new SimError(`nand expects 2 inputs and 1 output (line ${at})`);
      }
      nands.push({ a: argIn[0]!, b: argIn[1]!, out: argOut[0]! });
      depth--;
      return;
    }
    if (isNative(gateName, "clock")) {
      if (argOut.length !== 1) throw new SimError(`clock expects 1 output (line ${at})`);
      clocks.push(argOut[0]!);
      depth--;
      return;
    }
    if (isNative(gateName, "dff")) {
      // A 1-bit D flip-flop: DFF [d], [q]. The single sequential primitive.
      if (argIn.length !== 1 || argOut.length !== 1) {
        throw new SimError(`dff expects 1 input and 1 output (line ${at})`);
      }
      dffs.push({ d: argIn[0]!, q: argOut[0]! });
      depth--;
      return;
    }
    if (isNative(gateName, "rom")) {
      // ROM [addr...] [data...]: combinational, contents loaded at run time.
      if (argIn.length === 0 || argOut.length === 0) {
        throw new SimError(`rom expects at least 1 address and 1 data wire (line ${at})`);
      }
      roms.push({ addr: argIn.slice(), data: argOut.slice() });
      depth--;
      return;
    }
    if (isNative(gateName, "screen")) {
      // SCREEN [addr..., data, we], []  — last two inputs are data then we.
      if (argIn.length < 3) {
        throw new SimError(`screen expects addr.., data, we inputs (line ${at})`);
      }
      const we = argIn[argIn.length - 1]!;
      const data = argIn[argIn.length - 2]!;
      screens.push({ addr: argIn.slice(0, -2), data, we });
      depth--;
      return;
    }
    if (isNative(gateName, "keyboard")) {
      // KEYBOARD [d...]: outputs driven by the host's current key code.
      if (argOut.length === 0) throw new SimError(`keyboard expects data outputs (line ${at})`);
      keyboards.push({ data: argOut.slice() });
      depth--;
      return;
    }

    const def = program.gates.get(gateName);
    if (!def) throw new SimError(`unknown gate '${gateName}' (line ${at})`);
    checkArity(def, argIn.length, argOut.length, at);

    // Allocate a fresh wire for every local identifier in this instance.
    const local = new Map<string, number>();
    const wireOf = (name: string): number => {
      let id = local.get(name);
      if (id === undefined) {
        id = uf.fresh();
        local.set(name, id);
      }
      return id;
    };

    // Connect this instance's ports to the caller's argument wires.
    def.inputs.forEach((port, idx) => uf.union(argIn[idx]!, wireOf(port)));
    def.outputs.forEach((port, idx) => uf.union(argOut[idx]!, wireOf(port)));

    // Recurse into the body.
    for (const call of def.calls) {
      const ci = call.inputs.map(wireOf);
      const co = call.outputs.map(wireOf);
      instantiate(call.gate, ci, co, call.line);
    }
    depth--;
  }

  const entry = program.gates.get(program.entry)!;
  const inputs = entry.inputs.map(() => uf.fresh());
  const outputs = entry.outputs.map(() => uf.fresh());
  instantiate(program.entry, inputs, outputs, entry.line);

  // Collapse everything to representatives and compact ids into [0, size).
  const remap = new Map<number, number>();
  const rep = (id: number): number => {
    const r = uf.find(id);
    let compact = remap.get(r);
    if (compact === undefined) {
      compact = remap.size;
      remap.set(r, compact);
    }
    return compact;
  };

  return {
    inputs: inputs.map(rep),
    outputs: outputs.map(rep),
    nands: nands.map((n) => ({ a: rep(n.a), b: rep(n.b), out: rep(n.out) })),
    clocks: clocks.map(rep),
    dffs: dffs.map((f) => ({ d: rep(f.d), q: rep(f.q) })),
    roms: roms.map((m) => ({ addr: m.addr.map(rep), data: m.data.map(rep) })),
    screens: screens.map((s) => ({ addr: s.addr.map(rep), data: rep(s.data), we: rep(s.we) })),
    keyboards: keyboards.map((k) => ({ data: k.data.map(rep) })),
    size: remap.size,
  };
}

function checkArity(def: GateDef, nin: number, nout: number, at: number): void {
  if (def.inputs.length !== nin) {
    throw new SimError(
      `gate '${def.name}' expects ${def.inputs.length} input(s) but got ${nin} (line ${at})`,
    );
  }
  if (def.outputs.length !== nout) {
    throw new SimError(
      `gate '${def.name}' expects ${def.outputs.length} output(s) but got ${nout} (line ${at})`,
    );
  }
}

/**
 * Evaluate the netlist to a stable state, given values for the primary inputs
 * and (optionally) the clock wires.
 *
 * Settling is iterative: NANDs are recomputed until no wire changes, or until a
 * step cap is hit. Pure combinational circuits settle in a few passes;
 * feedback loops (latches) settle to a fixed point when one exists.
 */
export function evaluate(
  net: Netlist,
  inputs: Bit[],
  opts: {
    clock?: Bit;
    maxSteps?: number;
    seed?: Int8Array;
    state?: Int8Array;
    rom?: number[];
    key?: number;
  } = {},
): { values: Int8Array; settled: boolean; steps: number } {
  if (inputs.length !== net.inputs.length) {
    throw new SimError(`expected ${net.inputs.length} input bit(s), got ${inputs.length}`);
  }

  const values = opts.seed ? opts.seed.slice() : new Int8Array(net.size); // defaults to all 0
  for (let i = 0; i < net.inputs.length; i++) values[net.inputs[i]!] = inputs[i]!;
  const clockBit: Bit = opts.clock ?? 0;
  for (const c of net.clocks) values[c] = clockBit;

  // Keyboard peripherals present the host's current key code on their data wires.
  const key = opts.key ?? 0;
  for (const k of net.keyboards) {
    for (let i = 0; i < k.data.length; i++) values[k.data[i]!] = ((key >> i) & 1) as Bit;
  }

  // DFF outputs hold the current register state during the combinational settle;
  // they are driven by the flip-flop, never by NANDs.
  if (opts.state) {
    for (let i = 0; i < net.dffs.length; i++) values[net.dffs[i]!.q] = opts.state[i]!;
  }

  const rom = opts.rom ?? [];
  const driven = new Set<number>([
    ...net.inputs,
    ...net.clocks,
    ...net.dffs.map((f) => f.q),
    ...net.roms.flatMap((m) => m.data),
    ...net.keyboards.flatMap((k) => k.data),
  ]);
  const maxSteps = opts.maxSteps ?? net.nands.length * net.nands.length + 16;

  let steps = 0;
  let changed = true;
  while (changed) {
    if (steps++ > maxSteps) return { values, settled: false, steps };
    changed = false;
    for (const g of net.nands) {
      const next: Bit = values[g.a]! && values[g.b]! ? 0 : 1;
      if (values[g.out] !== next) {
        // Inputs/clocks/registers are externally driven and must not be overwritten.
        if (driven.has(g.out)) {
          throw new SimError(`NAND output drives a driven wire (input/clock/register/rom, id ${g.out})`);
        }
        values[g.out] = next;
        changed = true;
      }
    }
    // ROM is combinational: data = contents[address]. Re-derive each pass so it
    // tracks any change in the address wires.
    for (const m of net.roms) {
      let addr = 0;
      for (let i = 0; i < m.addr.length; i++) addr |= values[m.addr[i]!]! << i;
      const word = rom[addr] ?? 0;
      for (let i = 0; i < m.data.length; i++) {
        const bit: Bit = ((word >> i) & 1) as Bit;
        if (values[m.data[i]!] !== bit) {
          values[m.data[i]!] = bit;
          changed = true;
        }
      }
    }
  }
  return { values, settled: true, steps };
}

/**
 * Advance a sequential circuit by one clock tick.
 *
 * The model is the standard delay-free synchronous one: with register outputs
 * held at the current `state`, settle the combinational logic, then sample every
 * flip-flop's D input *simultaneously* to form the next state. This is fully
 * deterministic — no races, no metastability — which is why a single clocked
 * `dff` primitive (rather than NAND-built latches) is the right foundation for
 * registers, counters, and CPUs in a fixed-point simulator.
 */
export function tick(
  net: Netlist,
  inputs: Bit[],
  state: Int8Array,
  opts: { clock?: Bit; rom?: number[]; key?: number } = {},
): { values: Int8Array; next: Int8Array; settled: boolean } {
  const { values, settled } = evaluate(net, inputs, {
    state,
    clock: opts.clock,
    rom: opts.rom,
    key: opts.key,
  });
  const next = new Int8Array(net.dffs.length);
  for (let i = 0; i < net.dffs.length; i++) next[i] = values[net.dffs[i]!.d]!;
  return { values, next, settled };
}

/** A zeroed initial register state for a netlist. */
export function initialState(net: Netlist): Int8Array {
  return new Int8Array(net.dffs.length);
}
