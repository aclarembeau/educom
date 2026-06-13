// Assembler for the small RISC CPU (workbench/cpu.compute).
//
// Encoding (16-bit word):  op[15:12] rd[11:10] ra[9:8] rb[7:6] imm/addr[7:0]
//
//   ADD/SUB/AND/OR rd, ra, rb     LDI rd, imm8       JMP addr/label
//   OUT ra                        BEQZ ra, addr/label    HLT
//
// Registers are R0..R3. Labels are `name:`. `;` or `#` starts a comment.

const OPS: Record<string, number> = {
  ADD: 0b0000, SUB: 0b0001, AND: 0b0010, OR: 0b0011,
  LDI: 0b0100, JMP: 0b0101, BEQZ: 0b0110, OUT: 0b0111,
  PSET: 0b1000, INK: 0b1001, HLT: 0b1111,
};

export interface AsmError {
  line: number;
  message: string;
}

export interface AsmResult {
  words: number[];
  errors: AsmError[];
}

function reg(tok: string): number {
  const m = /^[rR]([0-3])$/.exec(tok.trim());
  if (!m) throw new Error(`expected register R0..R3, got '${tok}'`);
  return Number(m[1]);
}

function imm(tok: string, labels: Map<string, number>): number {
  const t = tok.trim();
  if (labels.has(t)) return labels.get(t)!;
  const n = t.startsWith("0x") ? parseInt(t, 16) : parseInt(t, 10);
  if (Number.isNaN(n)) throw new Error(`expected a number or label, got '${tok}'`);
  return n & 0xff;
}

interface Line {
  line: number;
  label?: string;
  mnem?: string;
  args: string[];
}

function lex(src: string): Line[] {
  const out: Line[] = [];
  const raw = src.split(/\r?\n/);
  for (let i = 0; i < raw.length; i++) {
    let text = raw[i]!.replace(/[;#].*$/, "").trim();
    if (!text) continue;
    let label: string | undefined;
    const lm = /^([A-Za-z_][A-Za-z0-9_]*)\s*:(.*)$/.exec(text);
    if (lm) {
      label = lm[1]!;
      text = lm[2]!.trim();
    }
    let mnem: string | undefined;
    let args: string[] = [];
    if (text) {
      const sp = text.search(/\s/);
      mnem = (sp === -1 ? text : text.slice(0, sp)).toUpperCase();
      const rest = sp === -1 ? "" : text.slice(sp + 1);
      args = rest.split(",").map((s) => s.trim()).filter(Boolean);
    }
    out.push({ line: i + 1, label, mnem, args });
  }
  return out;
}

/** Assemble RISC assembly into 16-bit ROM words. */
export function assemble(src: string): AsmResult {
  const lines = lex(src);
  const errors: AsmError[] = [];

  // Pass 1: resolve label addresses (each instruction is one word).
  const labels = new Map<string, number>();
  let pc = 0;
  for (const l of lines) {
    if (l.label) labels.set(l.label, pc);
    if (l.mnem) pc++;
  }

  // Pass 2: encode.
  const words: number[] = [];
  const word = (op: number, rd = 0, ra = 0, rb = 0, im = 0) =>
    ((op << 12) | (rd << 10) | (ra << 8) | (rb << 6) | (im & 0xff)) & 0xffff;

  for (const l of lines) {
    if (!l.mnem) continue;
    const op = OPS[l.mnem];
    if (op === undefined) {
      errors.push({ line: l.line, message: `unknown instruction '${l.mnem}'` });
      words.push(0);
      continue;
    }
    try {
      switch (l.mnem) {
        case "ADD": case "SUB": case "AND": case "OR":
          words.push(word(op, reg(l.args[0]!), reg(l.args[1]!), reg(l.args[2]!)));
          break;
        case "LDI":
          words.push(word(op, reg(l.args[0]!), 0, 0, imm(l.args[1]!, labels)));
          break;
        case "JMP":
          words.push(word(op, 0, 0, 0, imm(l.args[0]!, labels)));
          break;
        case "BEQZ":
          words.push(word(op, 0, reg(l.args[0]!), 0, imm(l.args[1]!, labels)));
          break;
        case "OUT":
          words.push(word(op, 0, reg(l.args[0]!)));
          break;
        case "PSET": // PSET ra, rb : pixel[ra] = rb & 1
          words.push(word(op, 0, reg(l.args[0]!), reg(l.args[1]!)));
          break;
        case "INK": // INK rd : rd = keyboard
          words.push(word(op, reg(l.args[0]!)));
          break;
        case "HLT":
          words.push(word(op));
          break;
        default:
          errors.push({ line: l.line, message: `unhandled '${l.mnem}'` });
          words.push(0);
      }
    } catch (e) {
      errors.push({ line: l.line, message: (e as Error).message });
      words.push(0);
    }
  }
  return { words, errors };
}
