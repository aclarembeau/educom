# Lesson 6 — The CPU 🧠

> Type a program. Press Run. Watch your gates execute it. This is the one.

**🧭 Lesson 6 of 8** · [← Previous](05-memory-and-the-clock.md) · [Next →](07-the-computer.md) · [All lessons](README.md)

## 🎯 What you'll build
- A complete **single-cycle RISC CPU**: registers, an ALU, an instruction decoder, and a program counter.
- A tiny **instruction set** (ADD, SUB, LDI, JMP, BEQZ, OUT, HLT…) you can program in.
- A machine that **fetches, decodes, and executes** one instruction per clock tick.
- The realization that a CPU is just everything you already built, wired together.

## 🤔 Why it matters
This is it. The summit. A **CPU** is the brain inside every computer, phone, console, and smart toaster on Earth. And you're about to build one — not a toy diagram, a *working* processor that runs actual programs you type.

People build CPUs inside Minecraft with redstone. Hobbyists build them on breadboards with a fistful of chips. They look like magic. After this lesson, you'll know the trick: a CPU is a **register file** (memory from lesson 5) + an **ALU** (math from lesson 4) + a little **decoder** that reads instructions and flips the right switches. That's the whole machine. The mystery dissolves, and what's left is something you understand completely — because you wired every gate.

## 🧠 The idea

**Where we are:** lesson 4 gave you an ALU (the math), lesson 5 gave you registers and a clock (the memory). A **CPU** (Central Processing Unit — the part that runs programs) is essentially those two things plus a small "decoder" that reads instructions and tells everything what to do. You already built the hard parts; this lesson wires them together.

A program is a list of **instructions** — single commands like "add these two registers" — each encoded as a 16-bit number. They live in a **ROM** (Read-Only Memory: a lookup table that, given an address, hands back the value stored there; "read-only" because the running program doesn't change it). The CPU runs a relentless three-step cycle, one full cycle per clock tick:

1. **Fetch** — read the instruction the **program counter (PC)** points at. (The PC is just a register holding an address — think of it as a finger pointing at the current line of a recipe.)
2. **Decode** — look at the **opcode** (the few bits at the top of the instruction that say *which* command this is) and figure out what to do.
3. **Execute** — do the math, store the result, and advance the finger to the next line (or jump it elsewhere).

This fetch → decode → execute loop is exactly like reading and following a recipe one step at a time: read the current line, understand it, do it, move your finger down. The clock tick is what moves the finger.

```
   ┌──► [PC] ──► [ROM] ──► instruction
   │                          │
   │                       [Decode]  → "ADD R1, R1, R0"
   │                          │
   │                  [Read regs]→[ALU]→[Write reg]
   │                          │
   └──── PC+1 (or jump target) ◄┘     ...then tick, repeat
```

**The instruction format.** Each 16-bit instruction packs several fields:

```
  op[15:12]  rd[11:10]  ra[9:8]  rb[7:6]  imm/addr[7:0]
  └ opcode ┘ └ dest ┘  └ srcA ┘ └ srcB ┘ └ number/address ┘
```

The top 4 bits (the **opcode**) say *what* to do; the rest say *which registers* and *what number*. Here's the full instruction set:

| opcode | instruction | meaning |
|:------:|-------------|---------|
| `0000` | `ADD rd,ra,rb` | rd = ra + rb |
| `0001` | `SUB rd,ra,rb` | rd = ra − rb |
| `0010` | `AND rd,ra,rb` | rd = ra & rb |
| `0011` | `OR rd,ra,rb` | rd = ra \| rb |
| `0100` | `LDI rd,imm8` | rd = a constant |
| `0101` | `JMP addr8` | go to address |
| `0110` | `BEQZ ra,addr8` | if ra == 0, jump |
| `0111` | `OUT ra` | show ra on the OUT display |
| `1111` | `HLT` | stop |

(Two more — `PSET` and `INK` — arrive in lesson 7, when we add a screen and keyboard.) There are 4 registers: **R0, R1, R2, R3**. An *immediate* (`imm8`) just means "a constant number written right in the instruction," and an *address* (`addr8`) is a line number in the program to jump to.

You write in **assembly** — a human-readable form of machine code, using short mnemonics (`ADD`, `LDI`…) plus labels and comments instead of raw bits. The **assembler** ([`src/asm.ts`](../../src/asm.ts)) is the small program that translates each assembly line into one 16-bit machine word. For example, `LDI R0, 5` becomes opcode `0100`, rd `00`, immediate `00000101`.

Here's one instruction traced through fetch → decode → execute, so the loop feels concrete:

```
  program line:  ADD R1, R1, R0          ; R1 = R1 + R0
  ───────────────────────────────────────────────────────
  fetch    PC points at this line; ROM hands back its 16 bits:
           0000  01    01    00     0000
           op    rd    ra    rb   (low imm bits, unused here)
  decode   opcode 0000 = "ADD" -> tell the ALU to add,
           read registers ra=R1 and rb=R0, write result to rd=R1
  execute  ALU computes R1+R0, that value is stored into R1,
           PC advances to the next line
```

## 🔍 The circuit

Open [`workbench/6-cpu.compute`](../../workbench/6-cpu.compute). The import is doing heavy lifting now:

```
#% import : 5-counter.compute
```

That single line brings in **everything**: the adders, the ALU pieces, `MUX8`, the constants, *and* the `DFF` native via lesson 5. The CPU file mostly just wires those together.

**The program counter** is four-plus DFFs (memory!) feeding a ROM:

```
DFF [pn0],[pc0]
... (8 PC flip-flops) ...
ROM [pc0,...,pc7], [i0,...,i15]   # fetch the instruction at address PC
```

**Decode** is pure combinational logic — pull out the opcode bits and turn them into "is this an ALU op? is this a jump?" control signals:

```
BUF [i12],[op0] ... BUF [i15],[op3]      # the 4 opcode bits
AND [nop3,nop2],[isalu]                  # 00xx -> ALU op
AND4 [nop3,op2,nop1,nop0],[isldi]        # 0100 -> load immediate
AND4 [nop3,op2,nop1,op0],[isjmp]         # 0101 -> jump
... etc ...
```

**The ALU** is the same idea as your lesson-4 calculator, computing all results and selecting one:

```
ALU8 [op0,op1, ra..., rb...], [al0,...,al7]
# writeData = LDI ? imm8 : aluResult
MUX8 [isldi, al..., i0..i7], [w0,...,w7]
```

**The register file** is built from `REG8` blocks — which are just enable-able DFFs (`EDFF`). A decoder (`WDEC`) figures out which register to write, gated by whether this instruction writes at all. And the **next PC** logic picks between PC+1, a jump target, or holding still if halted:

```
INC8 [pc...], [p1...]                    # PC + 1
MUX8 [dojump, p1..., i0..i7], [u...]     # or the jump target
MUX8 [halt, u..., pc...], [pn...]        # or freeze if halted
```

Look closely and you'll recognize *every piece*: DFFs from lesson 5, the ALU and MUXes from lesson 4, adders from lesson 3. **A CPU is composition, not invention.** The genius is in how it's wired, and that wiring is right here in front of you.

The built-in demo program sums 1 through 5:

```asm
; sum 1..5 into R1, then OUT and halt
  LDI R0, 5        ; counter
  LDI R1, 0        ; accumulator
  LDI R2, 1        ; constant 1
loop:
  ADD R1, R1, R0   ; acc += counter
  SUB R0, R0, R2   ; counter -= 1
  BEQZ R0, done
  JMP loop
done:
  OUT R1           ; -> 15
  HLT
```

5 + 4 + 3 + 2 + 1 = **15**. Let's watch the gates do it.

## ▶️ Try it

**See the CPU's true size:**

```bash
npm run info -- workbench/6-cpu.compute
```

Real output (the long `defined:` line abbreviated):

```
entrypoint:  cpu
inputs:      []  (0)
outputs:     [pc0, pc1, ..., d7, halt]  (49)
defined:     NOT, AND, ... , REG8, EDFF, ALU8, AND8, OR8, NOR8
flattened:   1527 NAND gate(s), 1592 wire(s), 0 clock(s)
```

**1527 NAND gates** — a whole CPU, still made of nothing but your one primitive.

**Run the program tick by tick:**

```bash
npm run tick -- workbench/6-cpu.compute --ticks 30
```

Each tick prints every flip-flop: the PC bits `pc0..pc7`, the OUT register `o0..o7`, registers R0–R3 as `a0..a7` / `b0..b7` / `c0..c7` / `d0..d7`, and `halt`. The bits are listed **least-significant first** (`o0` is the 1s place). Here are the key ticks from the real run:

```
loaded 9-instruction program into ROM
cpu  in[ (none) ]   (49 flip-flops)
  tick   2:  pc0=1 ... a0=1 a1=0 a2=1 a3=0 ... halt=0   (R0=5 loaded: 0101 = 5)
  ...
  tick  24:  ... o0=1 o1=1 o2=1 o3=1 o4=0 ... b0=1 b1=1 b2=1 b3=1 ... halt=0
  tick  25:  ...                                                     halt=1
```

Read the OUT bits at tick 24 least-significant first: `o0 o1 o2 o3 = 1 1 1 1` = binary `1111` = **15**. (R1, shown as `b0..b3 = 1111`, also holds 15 — the accumulated sum.) On tick 25 `halt=1` latches and the PC freezes — the program is done and stays done. **Your gates just ran a loop, added five numbers, and printed the answer.** 🧠

**Run it in the browser:**

```bash
npm run serve -- workbench/6-cpu.compute
```

Open **http://localhost:8080**. The program is already in the code box. Press **Step** to advance one instruction at a time (watch R0 count down, R1 climb), or **Run** to let it rip. The PC, OUT, and all four registers light up live.

## 🧪 Your turn
Type each program into the code box in the browser (`npm run serve -- workbench/6-cpu.compute`) and press **Run**. Ordered easiest first; one has a full worked answer.

1. **Use the logic ops (warm-up).** `LDI` two values into two registers, then `AND` or `OR` them into a third register and `OUT` it. Predict the bits first. *Hint: `LDI R0, 12` and `LDI R1, 10`, then `AND R2, R0, R1` gives `12 & 10 = 8` (1100 & 1010 = 1000).*
2. **Count down to launch.** Load R0 = 9, then loop: `OUT R0`, subtract 1, `BEQZ` to a `done` label, else `JMP` back. Watch the countdown on OUT. *Hint: you need a register holding the constant 1 to subtract; remember `BEQZ R0, done` jumps only when R0 has reached 0.*
3. **Multiply by adding.** Write a program that computes 3 × 4 using a loop of repeated addition, then `OUT` the result (12) and `HLT`. *Hint: add 4 to an accumulator, three times — almost exactly the demo program's shape.*

   <details><summary>Show answer</summary>

   ```asm
   ; 3 x 4 by repeated addition -> 12
     LDI R0, 4        ; value to add each pass
     LDI R1, 0        ; accumulator (the running total)
     LDI R2, 3        ; how many times to add
     LDI R3, 1        ; constant 1, to decrement the counter
   loop:
     ADD R1, R1, R0   ; total += 4
     SUB R2, R2, R3   ; counter -= 1
     BEQZ R2, done    ; counter hit 0? stop looping
     JMP loop
   done:
     OUT R1           ; -> 12
     HLT
   ```

   R1 ends at `4 + 4 + 4 = 12`, which appears on the OUT display, then the CPU halts.

   </details>
4. **Break it on purpose.** Remove the `HLT`. What does the PC do when it runs off the end of your program? *Hint: the PC just keeps incrementing and fetching whatever bits happen to sit in ROM past your last line — usually all zeros, which decode as `ADD R0,R0,R0`.*

## 🔗 Going deeper
- [Von Neumann architecture — Wikipedia](https://en.wikipedia.org/wiki/Von_Neumann_architecture) — the fetch-decode-execute design your CPU follows.
- [Ben Eater — Building an 8-bit breadboard computer](https://eater.net/8bit) — the same machine, built by hand with real chips. The best companion to this lesson.
- [Turing Complete (game)](https://store.steampowered.com/app/1444480/Turing_Complete/) — a game where you build a CPU from gates, much like you just did.

---
**🧭** [← Previous](05-memory-and-the-clock.md) · [Next →](07-the-computer.md) · [All lessons](README.md)
