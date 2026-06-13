# compute

A **computer simulator** in TypeScript. You describe hardware in a `.compute`
file as a hierarchy of gates built from one primitive — `NAND` — plus a handful
of clearly-justified native elements. `compute` flattens it to a netlist,
simulates it (combinational *and* clocked), and serves an interactive web UI.

No build step, no runtime dependencies — it runs on Node 22's native TypeScript.

```bash
npm install
npm run serve -- workbench/0-simple-and.compute   # AND from NAND (start here)
npm run serve -- workbench/4-calculator.compute    # add / sub / mul / div
npm run serve -- workbench/6-cpu.compute           # a RISC CPU (type code, Step/Run)
npm run serve -- workbench/7-computer.compute       # CPU + screen + keyboard
npm test                                            # unit tests
```

`.compute` programs live in `workbench/` as a numbered progression: each step
`#% import`s the one before it (so a primitive like `AND` is defined once and
reused, never re-derived). The test suite has its own small fixtures in `test/`.

## What's inside

The workbench builds up one gate at a time. Every file imports its predecessor,
so each adds only what's new on top of the gates already defined:

| Step (`workbench/…`)      | Adds | Verified |
|---------------------------|------|----------|
| `0-simple-and.compute`    | `NOT`, `AND` from the `NAND` native | truth table |
| `1-basic-gates.compute`   | `OR`, `XOR`, `BUF`, `MUX2`, constants | truth tables |
| `2-half-adder.compute`    | `HALFADD` — the getting-started circuit | truth table |
| `3-adder.compute`         | full adder, 4/8-bit adders, `MUX8` | a 4-bit adder demo |
| `4-calculator.compute`    | 4-bit ADD/SUB/MUL/DIV ALU (1372 NAND gates) | all 4×16×16 cases |
| `5-counter.compute`       | 4-bit counter (introduces the `dff` native) | 20 ticks |
| `6-cpu.compute`           | single-cycle RISC CPU, 9 instructions | runs sum(1..5)=15 |
| `7-computer.compute`      | CPU + 16×16 screen + keyboard | draws + echoes keys |

## Native elements — and the reasoning for each

The whole point is to build from `NAND`. A native is only added when something
**genuinely cannot be expressed as a fixed gate netlist**:

| Native | Why it can't just be gates |
|--------|----------------------------|
| `nand` | the one logic primitive everything else is built from |
| `dff`  | an edge-triggered register depends on the *clock transition*; a delay-free fixed-point simulator has no notion of time, so it can't derive edge-timing from gates. (A level-sensitive **RS latch** *can* be built from two cross-coupled NANDs — the simulator settles the feedback to a fixed point — so it is **not** native.) |
| `rom`  | its contents are runtime input (a program typed into the UI), not a fixed circuit |
| `screen`, `keyboard`, `switch`, `seg7`, `led` | I/O peripherals — the boundary to the outside world, not logic |

`dff` is the standard nand2tetris choice, and the simulator's clock model is the
delay-free synchronous one: hold register outputs, settle the combinational
logic, then sample every flip-flop's D input at once. Fully deterministic — no
races, no metastability.

## The language

```
AND:
	IN [a, b]            # input wires
	OUT [c]             # output wires
	NAND [a, b], [t]    # call NAND(a,b) -> t  (comma between groups optional)
	NAND [t, t], [c]    # c = NOT t = a AND b
```

`#` starts a comment. The entrypoint defaults to `program` (override with
`--entry` or `#% entry NAME`).

### Importing gates from another file

```
#% import : 0-simple-and.compute     # reuse NOT and AND instead of redefining them
```

`#% import` pulls in every gate **definition** from another `.compute` file,
resolved relative to the importing file. Imports are recursive, so a step deep
in the chain transitively sees everything its ancestors defined. Only gate
definitions cross the boundary — `#% entry`, UI and `#% code` directives are
read from the top-level file alone. A redefined gate, a missing file, or an
import cycle is reported as an error.

### `#%` directives (read by `serve`)

```
#% entry  : cpu
#% import : 6-cpu.compute
#% title  : My Machine
#% switch a0 : A bit 0          # 1-bit input toggle
#% seg7 s3 s2 s1 s0 : Result    # N bits (MSB first) -> hex display
#% led carry : Carry            # 1-bit lamp
#% rom : program                # ROM present -> show a code textarea
#% screen : 16 16               # pixel display, W x H
#% keyboard : Keyboard          # capture key presses
#% code : LDI R0, 5             # initial program (one line per directive)
```

## CLI

```bash
npm run serve -- <file> [--port N]     # interactive web UI (default :8080)
npm run run   -- <file> [--in a=1,b=0] # evaluate combinational once
npm run tick  -- <file> [--ticks N]    # advance a clocked circuit N ticks
npm run table -- <file>                # full truth table
npm run info  -- <file>                # netlist stats
npm run typecheck
npm test
```

`serve` watches the file and live-reloads the page on save (Server-Sent Events).

## The RISC CPU

8-bit data, 16-bit instructions, registers R0–R3, 8-bit PC. One instruction per
clock tick. Registers are built from `dff`; the ALU/decoder from NAND; the
program lives in a `rom` you type into the UI (assembled by `src/asm.ts`).

```
op   mnemonic        effect
0000 ADD  rd,ra,rb   rd = ra + rb
0001 SUB  rd,ra,rb   rd = ra - rb
0010 AND  rd,ra,rb   rd = ra & rb
0011 OR   rd,ra,rb   rd = ra | rb
0100 LDI  rd,imm8    rd = imm
0101 JMP  addr8      pc = addr
0110 BEQZ ra,addr8   if ra==0: pc = addr
0111 OUT  ra         output <- ra
1000 PSET ra,rb      pixel[ra] = rb&1     (7-computer.compute)
1001 INK  rd         rd = keyboard        (7-computer.compute)
1111 HLT             halt
```

Encoding: `op[15:12] rd[11:10] ra[9:8] rb[7:6] imm/addr[7:0]`.

## How simulation works

1. **Parse** → gate definitions (`src/parser.ts`).
2. **Flatten** → recursively inline the entrypoint to primitive nodes; wires
   joined across a call are merged with union-find (`src/simulator.ts:flatten`).
3. **Evaluate** → iteratively recompute every NAND (and ROM lookup) until stable.
4. **Tick** → hold register state, evaluate, sample all DFF inputs at once to
   form the next state; the host commits screen-pixel writes and supplies the key.

## Files

| File | What |
|------|------|
| `src/parser.ts`    | `.compute` → AST (`parse` one file, `parseInto` to merge several) |
| `src/loader.ts`    | resolve the `#% import` chain into one merged program |
| `src/simulator.ts` | flatten + evaluate + clocked tick; natives nand/dff/rom/screen/keyboard/clock |
| `src/asm.ts`       | RISC assembler (assembly → 16-bit ROM words) |
| `src/ui.ts`        | `#%` directive parsing (entry/import/code/UI) |
| `src/server.ts`    | no-dep HTTP server + JSON API (config/eval/tick/reset/program/key) + live reload |
| `src/page.ts`      | the browser UI (switches, 7-seg, LEDs, screen canvas, code box, clock controls) |
| `src/cli.ts`       | command-line entrypoint |
| `test/run.ts`      | unit tests (parser, gates, sequential, ROM, assembler, import loader) |
