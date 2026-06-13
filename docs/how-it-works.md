# ⚙️ How the simulator works

For the curious: this is what happens between writing a `.compute` file and watching gates light up. The whole pipeline is small, deterministic, and has no external dependencies.

A program goes through five stages: **parse → resolve imports → flatten → evaluate → tick**.

---

## 1. 🔤 Parse

`src/parser.ts` turns `.compute` source text into **gate definitions** — a little AST. Each definition records its inputs, outputs, and the list of calls in its body. Directive lines (`#%`) look like comments to the parser and are handled separately.

## 2. 📦 Resolve imports

`src/loader.ts` walks the `#% import` chain, parsing each referenced file and **merging all definitions into one shared map**. Resolution is recursive and depth-first, so every gate a file relies on is defined before the file itself is parsed. A diamond (a file imported twice) is parsed once; a cycle is reported as an error. Only definitions cross the boundary — UI, `#% entry`, and `#% code` come from the top-level file alone.

## 3. 🪢 Flatten

`flatten` in `src/simulator.ts` takes the entrypoint gate and **recursively inlines** it. Every user gate is expanded into its body, over and over, until nothing is left but **primitive nodes**: `nand` gates and the natives (`dff`, `rom`, `screen`, `keyboard`, `clock`).

When a call wires a caller's wire to a callee's port, those two wires are the *same* electrical node. The flattener tracks this with **union-find**: connected wires are merged so they share one representative integer id. The result is a flat **netlist** — a list of NANDs and natives over a compact set of numbered wires.

## 4. ⚖️ Evaluate

Given the input bits, the netlist is settled to a **fixed point**. Every NAND is recomputed (`out = NOT (a AND b)`), and every ROM lookup re-derived (`data = contents[addr]`), in repeated passes — **until no wire changes**. Pure combinational circuits settle in a few passes. Feedback loops (latches built from gates) settle to a stable state when one exists; if the circuit can't settle within a step cap, it's flagged as unstable rather than looping forever. Inputs, clocks, register outputs, ROM data, and keyboard data are *externally driven* and never overwritten by a NAND.

## 5. ⏱️ Tick (clocked circuits)

Sequential circuits add **time** via the `dff` primitive, using the standard delay-free synchronous model:

1. **Hold** every flip-flop's output (`q`) at its current state value.
2. **Settle** the combinational logic around them (stage 4).
3. **Sample** every flip-flop's `D` input **simultaneously** — those values become the *next* state.

Because all flip-flops are sampled at once from a fully-settled circuit, ticking is **completely deterministic**: no races, no metastability. This is exactly why a single clocked `dff` (rather than NAND-built latches) is the right foundation for registers, counters, and CPUs. The host (the web server) commits **screen-pixel writes** on each tick and supplies the **current key** to keyboard peripherals.

---

## 🗂️ Files

| File | Role |
|------|------|
| `src/parser.ts` | Parse `.compute` source into gate definitions (the AST). |
| `src/loader.ts` | Resolve the `#% import` chain, merging files into one program. |
| `src/simulator.ts` | Flatten to a NAND/native netlist; evaluate and tick it. |
| `src/asm.ts` | Assemble the RISC CPU assembly into 16-bit ROM words. |
| `src/ui.ts` | Read `#%` UI directives into a spec (switches, LEDs, seg7, screen, keyboard). |
| `src/server.ts` | The web server: build the program, serve the page, run eval/tick on request. |
| `src/page.ts` | The single-page browser UI (plain HTML/CSS/JS, no build). |
| `src/cli.ts` | The command-line entry point (`run`, `tick`, `table`, `info`, `serve`). |
| `test/run.ts` | The minimal, framework-free unit-test runner. |

---

- ⬅️ Back to the [project README](../README.md)
- 📖 The [`.compute` language reference](language.md)
