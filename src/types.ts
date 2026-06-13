// AST for the `.compute` language.
//
// A `.compute` file is a list of gate definitions. Each definition declares its
// input wires (`IN`), output wires (`OUT`), and a body of calls to other gates.
// `nand` and `clock` are native primitives; every other gate is user-defined and
// ultimately decomposes into NANDs.

/** A single call inside a gate body, e.g. `AND [a, b], [c]`. */
export interface Call {
  /** Name of the gate being invoked (e.g. `NAND`, `AND`, `3AND`). */
  gate: string;
  /** Wire names passed as inputs, in order. */
  inputs: string[];
  /** Wire names that receive the outputs, in order. */
  outputs: string[];
  /** 1-based source line, for error messages. */
  line: number;
}

/** A named gate definition, e.g. the body following `AND:`. */
export interface GateDef {
  name: string;
  /** Declared input wire names (from `IN [...]`). */
  inputs: string[];
  /** Declared output wire names (from `OUT [...]`). */
  outputs: string[];
  /** Sub-gate invocations forming the body. */
  calls: Call[];
  line: number;
}

/** A fully parsed program: a map of gate name -> definition. */
export interface Program {
  gates: Map<string, GateDef>;
  /** Entrypoint gate name (defaults to `program`). */
  entry: string;
}

export type Bit = 0 | 1;
