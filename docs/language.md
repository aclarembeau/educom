# 📖 The `.compute` language reference

A `.compute` file describes a circuit as a set of **gate definitions**, plus some `#%` **directives** for imports, the UI, and embedded programs. The syntax is deliberately tiny — a gate has inputs, outputs, and a list of calls to other gates. Everything bottoms out at one primitive: `nand`.

This page is the complete reference. For a guided build-up, follow the [lessons](lessons/README.md).

---

## 🔧 Gate definitions

A definition is a `NAME:` header at **column 0**, followed by an **indented body**:

```
HALFADD:
	IN [a, b]
	OUT [s, c]
	XOR [a, b], [s]
	AND [a, b], [c]
```

The body is made of three kinds of statement:

- **`IN [a, b]`** — declares the gate's input wires.
- **`OUT [c]`** — declares the gate's output wires.
- **`GATE [inputs], [outputs]`** — a **call** to another gate. The first bracket group is the inputs you pass, the second is the outputs you bind. The comma between the two groups is **optional** (`AND [a, b] [c]` works too).

Wire names inside a definition are local: any identifier you mention becomes a wire, and wiring the same name into two places connects them.

### Source calls (outputs only)

A call with **one** bracket group is a **source** — it produces outputs but takes no inputs:

```
ONE:
	OUT [v]
	one [v]          # native constant / source
```

This is the form used by natives that generate values rather than transform them (e.g. `rom`, `keyboard`, `clock`).

### Comments

`#` starts a comment and runs to the end of the line. (Lines beginning with `#%` are *directives* — see below — and are read by separate passes, not the gate parser.)

---

## 🚪 The entrypoint

Simulation starts from one gate, the **entrypoint**. It defaults to a gate named **`program`**. Override it with either:

- a directive in the file — `#% entry NAME` (or `#% entry : NAME`), or
- the CLI flag — `--entry NAME` (which wins over the directive).

For example, the half-adder file sets `#% entry : HALFADD`.

---

## 📦 Imports

Files build on each other with imports:

```
#% import : 1-basic-gates.compute
```

This **merges every gate definition** from the named file into the current program. Import paths are resolved **relative to the importing file**, and resolution is **recursive** (imports of imports are pulled in too, depth-first, so dependencies are defined before the file that uses them). A file imported via several paths (a diamond) is parsed only once.

Important boundaries and errors:

- **Only definitions cross the import boundary.** The `#% entry`, UI directives, and `#% code` are read from the **top-level file only** — an imported file's UI and entry are ignored.
- **Redefining an imported gate** (a duplicate name, within a file or across the boundary) is an error.
- A **missing imported file** is an error.
- An **import cycle** is detected and reported, not followed.

---

## 🎛️ `#%` directives

Directives configure the entrypoint, imports, the on-screen UI, and embedded programs. Each is a line beginning with `#%`. (The `:` separator is optional for most of them.)

| Directive | Meaning |
|-----------|---------|
| `#% entry NAME` | Set the entrypoint gate (default `program`). |
| `#% import : file.compute` | Merge all gate definitions from another file (relative path). |
| `#% title : Some Title` | The page heading shown in the web UI. |
| `#% switch <wire> : label` | A **1-bit input toggle** for the named entrypoint input. |
| `#% led <wire> : label` | A **1-bit lamp** for the named entrypoint output. |
| `#% seg7 <wires...> : label` | Render N output bits as a **hex digit**. Wires are listed **most-significant first**. |
| `#% screen : W H` | A **pixel display** of width W and height H. |
| `#% keyboard : label` | A **keyboard** input. |
| `#% rom : name` | The program runs code — shows a **code textarea** in the UI. |
| `#% code : ...` | One line of the embedded program. Use several `#% code` lines for several lines of code. |

Notes:

- A `switch`/`led`/`seg7` wire **must** be a real input/output of the entrypoint, or it's an error.
- **If a file declares no UI directives**, a sensible default is synthesized: **one switch per entrypoint input, one LED per entrypoint output**.

---

## 🧩 The native elements

Almost everything in educom is built from gates. A small set of elements are **native** — the simulator implements them directly — because each one genuinely *cannot* be expressed as a fixed gate netlist:

| Native | Why it must be native |
|--------|------------------------|
| `nand` | The one logic primitive. `out = NOT (a AND b)`. Everything else decomposes into these. |
| `dff` | An **edge-triggered register** (`DFF [d], [q]`). It needs a real notion of *clock transition* — timing a delay-free, fixed-point simulator can't derive from gates. This is what gives circuits **memory and time**. |
| `rom` | `ROM [addr...], [data...]`. Its **contents are loaded at runtime** (a program you type), not baked into a circuit. |
| `screen` | A pixel display — an output peripheral, the boundary to the outside world. |
| `keyboard` | A key-code input peripheral. |
| `switch` / `led` / `seg7` | The UI input/output adapters. |

A `clock` source also exists (`clock [out]`) — it's driven externally each cycle.

Everything else — `NOT`, `AND`, `OR`, `XOR`, multiplexers, adders, the ALU, the CPU's logic — you build from `nand`.

---

## 🖥️ The RISC CPU assembly

The CPU steps run a program supplied through `#% rom` / `#% code` (or the UI textarea), assembled by `src/asm.ts`.

**Instruction encoding** (one 16-bit word):

```
op[15:12]  rd[11:10]  ra[9:8]  rb[7:6]  imm/addr[7:0]
```

**Registers** are `R0`..`R3`. **Labels** are written `name:`. A `;` or `#` starts a comment.

**Opcodes:**

| Bits | Mnemonic | Form | Meaning |
|------|----------|------|---------|
| `0000` | `ADD` | `ADD rd, ra, rb` | `rd = ra + rb` |
| `0001` | `SUB` | `SUB rd, ra, rb` | `rd = ra - rb` |
| `0010` | `AND` | `AND rd, ra, rb` | `rd = ra & rb` |
| `0011` | `OR` | `OR rd, ra, rb` | `rd = ra | rb` |
| `0100` | `LDI` | `LDI rd, imm8` | load immediate into `rd` |
| `0101` | `JMP` | `JMP addr/label` | jump |
| `0110` | `BEQZ` | `BEQZ ra, addr/label` | branch if `ra == 0` |
| `0111` | `OUT` | `OUT ra` | output `ra` |
| `1000` | `PSET` | `PSET ra, rb` | set pixel: `pixel[ra] = rb & 1` |
| `1001` | `INK` | `INK rd` | read keyboard into `rd` |
| `1111` | `HLT` | `HLT` | halt |

Example program:

```
	LDI R0, 5
	LDI R1, 3
	ADD R2, R0, R1   ; R2 = 8
	OUT R2
	HLT
```

---

## 📝 A complete example

Here is the whole half-adder file (`workbench/2-half-adder.compute`):

```
#% import : 1-basic-gates.compute

#% entry  : HALFADD
#% title  : Step 2 — Half Adder
#% switch a : A
#% switch b : B
#% led s : Sum
#% led c : Carry

HALFADD:
	IN [a, b]
	OUT [s, c]
	XOR [a, b], [s]       # sum   = a XOR b
	AND [a, b], [c]       # carry = a AND b
```

Reading it top to bottom:

- **`#% import`** pulls in `1-basic-gates.compute`, so `XOR` and `AND` are already defined (and *those* decompose to `nand` via the gates imported transitively).
- **`#% entry : HALFADD`** makes `HALFADD` the simulated gate.
- The **`#% switch` / `#% led`** directives give us two input toggles and two lamps, labelled.
- **`HALFADD`** takes two bits, emits `s` (sum) and `c` (carry): the sum is `a XOR b` (1 when the bits differ), the carry is `a AND b` (1 only when both are set).

Run it:

```bash
npm run table -- workbench/2-half-adder.compute   # truth table
npm run serve -- workbench/2-half-adder.compute   # flip the switches live
```

---

- ⬅️ Back to the [project README](../README.md)
- ⚙️ Curious how it all runs? See [how it works](how-it-works.md).
