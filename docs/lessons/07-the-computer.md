# Lesson 7 — The Computer 🖥️

> A CPU that draws on a screen and reads your keyboard. You built a computer. From one gate.

**🧭 Lesson 7 of 8** · [← Previous](06-the-cpu.md) · [Next →](../references.md "Further reading & inspiration") · [All lessons](README.md)

## 🎯 What you'll build
- A full **computer**: the lesson-6 CPU plus two I/O peripherals.
- A **16×16 pixel screen** your programs can draw on, with the new `PSET` instruction.
- A **keyboard** your programs can read, with the new `INK` instruction.
- A program that draws a line and then echoes your keystrokes — running on gates you built.

## 🤔 Why it matters
A CPU that only talks to itself isn't much fun. What makes a computer a *computer* — the thing you actually use — is that it touches the **outside world**. It shows you pixels. It listens to your keys. That loop between you and the machine is the whole point.

This is the final brick. You started at lesson 0 with a single NAND gate and the question "can a computer really be just *this*, repeated?" Now you'll click a screen, press a key, and watch your own silicon respond. Not a simulation of someone else's computer — *yours*, every gate accounted for, from one primitive all the way up. That's the entire tower, complete. 🏆

## 🧠 The idea

The CPU from lesson 6 is already a complete processor. To make it a computer, we bolt on two **peripherals** — devices at the edge of the machine:

- **SCREEN** — a 16×16 grid of pixels (256 in total). A program turns a pixel on or off by *writing* to it.
- **KEYBOARD** — an 8-bit value holding the code of the key currently pressed. A program *reads* it.

```
   ┌──────────────┐        PSET ──►  ┌─────────┐
   │   your CPU   │ ───────────────► │ SCREEN  │  (16×16 pixels)
   │ (lesson 6)   │                  └─────────┘
   │              │ ◄─── INK ─────── ┌─────────┐
   └──────────────┘                  │KEYBOARD │  (8-bit key code)
                                      └─────────┘
```

To drive them, we add **two new instructions** to the set:

| opcode | instruction | meaning |
|:------:|-------------|---------|
| `1000` | `PSET ra, rb` | set pixel number `ra` to `rb & 1` (on if the low bit is 1) |
| `1001` | `INK rd` | read the keyboard into register `rd` |

So `PSET R0, R1` lights the pixel at index R0 (0–255, scanning the grid) using the low bit of R1. `INK R0` grabs whatever key you're pressing into R0.

**Why are the screen and keyboard natives, not gates?** Same honest reason as the switches and LEDs from the early lessons, and the DFF and ROM before: they're the **boundary to the outside world**, not logic. A pixel you can see and a key you can press aren't things a NAND netlist can *be* — they're where the circuit meets reality. Everything *between* them is still gates you built.

## 🔍 The circuit

Open [`workbench/7-computer.compute`](../../workbench/7-computer.compute). The import brings the entire CPU along:

```
#% import : 6-cpu.compute
```

That's lesson 6's whole processor — register file, ALU, decoder, PC — plus everything it imported all the way down to NAND. This file mostly **reuses the CPU and adds two wires to the outside.** It even declares the peripherals as UI directives:

```
#% screen  : 16 16
#% keyboard : Keyboard
```

The decoder gains two new control signals for the new opcodes:

```
AND4 [op3,nop2,nop1,nop0],[ispset]     # 1000 -> PSET
AND4 [op3,nop2,nop1,op0],[isink]       # 1001 -> INK
```

The keyboard is read and fed into the register write path, so `INK` can land a key code in a register:

```
KEYBOARD [k0,...,k7]
# writeData = INK ? key : (LDI ? imm : alu)
MUX8 [isink, wa..., k0,...,k7], [w0,...,w7]
```

And the screen is wired to fire on `PSET`, using register A's value as the pixel index and register B's low bit as on/off:

```
# SCREEN: PSET ra, rb -> pixel[ra_val] = rb_val[0]
SCREEN [ra0,...,ra7, rb0, ispset], []
```

That's the whole addition. Two peripherals, two instructions, a couple of muxes. **The hard part — the CPU — you already finished.** This lesson just opens windows to the world.

The demo program draws a diagonal line, then loops forever echoing keys:

```asm
; draw a diagonal, then echo the keyboard
  LDI R0, 0       ; pixel index
  LDI R1, 1       ; "on" / step of 1
  LDI R2, 16      ; 16 pixels to draw
  LDI R3, 17      ; diagonal stride (x+1, y+1)
draw:
  PSET R0, R1     ; light pixel[R0]
  ADD R0, R0, R3
  SUB R2, R2, R1
  BEQZ R2, keys
  JMP draw
keys:
  INK R0          ; read a key
  OUT R0          ; show its code
  JMP keys
```

A stride of 17 steps one pixel right *and* one pixel down each time (since the screen is 16 wide), so the dots march down the diagonal. Then it settles into a read-a-key, show-a-key loop.

## ▶️ Try it

This one is best **experienced live** — drawing and typing don't fit in a text dump. Launch it:

```bash
npm run serve -- workbench/7-computer.compute
```

Open **http://localhost:8080** and press **Run**. Here's what to do:
1. Watch the **diagonal line** appear, pixel by pixel, as the draw loop runs.
2. **Click the screen area** to give it focus.
3. **Press number and letter keys** — each keypress shows its code on the **OUT (key)** display, live. Your keyboard is talking to a CPU you built. ⌨️

(Want to peek at the wiring stats instead? `npm run info -- workbench/7-computer.compute` flattens the whole computer to NAND gates, just like every step before it.)

> ⚠️ Note: `npm run serve` starts a web server that keeps running until you stop it (Ctrl-C). That's expected — it's the live UI.

## 🧪 Your turn
1. **Draw a different shape.** Change the stride in R3 (try 16 for a vertical line, or 1 for a horizontal one). Run and watch.
2. **Make a box.** Write a program that lights the four corners of the screen with four `PSET`s.
3. **Echo with math.** In the key loop, `ADD` a constant to the key before `OUT`-ing it, so you transform each press.
4. **Two diagonals.** After the first line finishes, draw a second one going the other way (stride 15 steps right-and-down the opposite slant). Make an X.

## 🔗 Going deeper
- [Memory-mapped I/O — Wikipedia](https://en.wikipedia.org/wiki/Memory-mapped_I/O_and_port-mapped_I/O) — how real CPUs talk to screens and keyboards.
- [nand2tetris](https://www.nand2tetris.org/) — the course that builds a computer (with screen and keyboard!) from a NAND gate, all the way up to an OS.
- [Turing Complete (game)](https://store.steampowered.com/app/1444480/Turing_Complete/) — keep building: design your own architecture and write programs for it.
- 👉 Ready for more? See **[Further reading & inspiration](../references.md)** for where to go from here.

---
**🧭** [← Previous](06-the-cpu.md) · [Next →](../references.md "Further reading & inspiration") · [All lessons](README.md)
