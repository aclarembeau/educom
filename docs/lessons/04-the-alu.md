# Lesson 4 — The ALU (a 4-bit Calculator) 🧮

> Wire your adders into a machine that adds, subtracts, multiplies, and divides — on command.

**🧭 Lesson 4 of 8** · [← Previous](03-adders.md) · [Next →](05-memory-and-the-clock.md) · [All lessons](README.md)

## 🎯 What you'll build
- A **4-bit calculator** that takes two numbers (0–15) and a 2-bit operation selector.
- Four operations sharing one circuit: **ADD, SUB, MUL, DIV** — selected at runtime.
- A `flag` light for carry, borrow, and divide-by-zero.
- Your first **ALU** — the Arithmetic Logic Unit, the number-crunching heart of every CPU.

## 🤔 Why it matters
Every time your phone adds two numbers, every frame a game renders, every pixel a spreadsheet sums — an **ALU** is doing the work. It's the part of a processor that actually *computes*. Intel and Apple chips have many of them, running billions of times a second.

And here's the beautiful part: you already built the hard bit. In lesson 3 you made adders. An ALU is mostly **adders plus a way to choose which answer comes out**. That "choosing" trick — the multiplexer — is what turns a pile of math circuits into a calculator that obeys commands. This is the moment your gates start to feel like a machine.

## 🧠 The idea

**Where we are:** in lesson 3 you chained full adders into `ADD8`, a circuit that adds two 8-bit numbers. This lesson takes that adder and surrounds it with a few friends so the same hardware can add, subtract, multiply, *or* divide — whichever you ask for. That bundle is an **ALU** (Arithmetic Logic Unit): the part of a processor that actually does the math.

A calculator needs to do *different things* depending on a button you press. But a circuit can't physically rewire itself. So instead we do something clever:

**Compute every answer at once, then pick the one we want.**

The picker is a **multiplexer** (MUX for short — a circuit that takes several data inputs plus a "selector" input, and passes through only the one the selector chooses; you built a 2-input one, `MUX2`, back in lesson 1). Think of it as a railway switch: all the trains are running, the switch decides which track reaches the station. Here it's a knob with four settings, one per operation.

```
   ADD result ─┐
   SUB result ─┤
   MUL result ─┤──[ MUX ]── result
   DIV result ─┘     ▲
                  op1,op0  (which one?)
```

Our selector is **2 bits**, so it picks one of four operations:

| op1 | op0 | operation | flag means |
|:---:|:---:|-----------|------------|
| 0 | 0 | **ADD** A + B | carry (result > 15) |
| 0 | 1 | **SUB** A − B | borrow (A < B) |
| 1 | 0 | **MUL** A × B | always 0 |
| 1 | 1 | **DIV** A ÷ B | divide-by-zero |

**A neat trick for subtraction.** Computers don't build a separate "subtractor." They reuse the adder using **two's complement** — the standard way computers store negative numbers. To compute `A − B`, they add `A + (NOT B) + 1`. Flipping every bit of B (`NOT B`) and adding 1 produces "negative B," so subtraction becomes plain addition. One adder, two jobs. (If the addition produces a carry-out, then A ≥ B; if not, A < B and we raise the **borrow** flag — a borrow is the subtraction version of a carry, signalling the answer went below zero.)

**MUL** is repeated shifting-and-adding (the same way you do long multiplication by hand, but in binary). **DIV** is restoring division — repeated subtract-and-shift. Both are built entirely from the adders you already have.

## 🔍 The circuit

Open [`workbench/4-calculator.compute`](../../workbench/4-calculator.compute). The very first line is the magic that makes this manageable:

```
#% import : 3-adder.compute
```

That one directive pulls in **every gate you defined in lesson 3** — `ADD8`, `NOT8`, `MUX8`, the constants, all of it. Each step imports the one before, so nothing is ever re-derived. You're standing on everything you've already built.

The top-level `calculator` gate computes all four results, then selects. Here's ADD and SUB:

```
# --- ADD: 8-bit A + B ---
ADD8 [a0, a1, a2, a3, z, z, z, z, b0, b1, b2, b3, z, z, z, z, z], [ad0, ..., ad7, adC]

# --- SUB: 8-bit A - B  (two's complement: A + ~B + 1) ---
NOT8 [b0, b1, b2, b3, z, z, z, z], [nb0, ..., nb7]
ADD8 [a0, a1, a2, a3, z, z, z, z, nb0, ..., nb7, one], [sb0, ..., sb7, subC]
NOT [subC], [subFlag]   # borrow = NOT carry-out
```

See the SUB trick in the flesh: `NOT8` flips B, then `ADD8` adds it with a carry-in of `one`. That's `A + ~B + 1`. No subtractor needed.

Then MUL and DIV run in their own sub-gates, and finally the **selector** picks the winner per bit:

```
# res = op1 ? (op0?div:mul) : (op0?sub:add)
SEL8 [op1, op0, ...add..., ...sub..., ...mul..., ...div...], [r0, ..., r7]
SEL1 [op1, op0, addFlag, subFlag, z, divFlag], [flag]
```

`SEL8` is just a little tree of multiplexers (look further down the file — it's three `MUX8` calls). The 2-bit op walks down the tree to the chosen branch.

The whole thing — four operations, all the adders, multipliers, dividers — flattens down to raw NAND gates. How many? Let's find out.

## ▶️ Try it

**See how big your calculator really is:**

```bash
npm run info -- workbench/4-calculator.compute
```

Real output (the `defined:` line is abbreviated here):

```
entrypoint:  calculator
inputs:      [a3, a2, a1, a0, b3, b2, b1, b0, op1, op0]  (10)
outputs:     [ea3, ea2, ea1, ea0, eb3, eb2, eb1, eb0, r7, r6, r5, r4, r3, r2, r1, r0, flag]  (17)
defined:     NOT, AND, ... , MUL4, DIV4, DIVSTEP, ADD5, AND4B, NOT5, NOR4
flattened:   1372 NAND gate(s), 1382 wire(s), 0 clock(s)
```

**1372 NAND gates.** Every single one decomposed from the one primitive you started with in lesson 0. That's a full four-function calculator made of nothing but NAND. (Notice `0 clock(s)` — a **clock** is the heartbeat that drives memory, which we add next lesson; this circuit has no memory yet, so zero.)

**Play with it live:**

```bash
npm run serve -- workbench/4-calculator.compute
```

Open **http://localhost:8080**. Set A and B with the switches, pick an operation with `op1`/`op0`, and watch the hex display. Try `A=12, B=3`:
- ADD → `0F` (15)
- SUB → `09` (9)
- MUL → `24` (36 in hex)
- DIV → quotient 4, remainder 0

Then try a divide-by-zero (set B=0, op=DIV) and watch the **Flag** light up. 🚩

## 🧪 Your turn
Ordered easiest first. Each has a hint; one has a worked answer.

1. **Predict before you peek (warm-up).** Set A=7, B=6 and work out all four results on paper, then switch `op1`/`op0` to check yourself. *Hint: ADD=13, SUB=1, MUL=42, DIV=1 remainder 1.*
2. **Find a carry.** Pick A and B in ADD mode whose sum is greater than 15. Watch the Flag light — that's the carry bit saying "the answer didn't fit in 4 bits." *Hint: the smallest such pair is 8 + 8 = 16.*
3. **Force a borrow.** In SUB mode set A < B (say A=2, B=7). The Flag turns on, and the result is the two's-complement wrap-around. Can you predict the displayed byte? *Hint: `2 − 7` wraps the same way a car odometer does — count backwards from 0. The 8-bit result is `256 − 5 = 251`.*

   <details><summary>Show answer</summary>

   `2 − 7` computes as `2 + (~7) + 1`. As an unsigned 8-bit value the answer wraps to `251` (binary `11111011`, hex `FB`). The Flag (borrow) lights because there was no carry-out, which is the circuit's way of saying "A was smaller than B."

   </details>
4. **Read the code.** Find the `MUL4` gate in the file. Count how many `ADD8` calls it uses to multiply, and why. *Hint: one per partial product — there are four bits in B, so four partial products, but the first is just copied, leaving three adds.*

## 🔗 Going deeper
- [Arithmetic logic unit — Wikipedia](https://en.wikipedia.org/wiki/Arithmetic_logic_unit) — the real-world component you just built.
- [Two's complement — Wikipedia](https://en.wikipedia.org/wiki/Two%27s_complement) — why "add the negative" works.
- [nand2tetris](https://www.nand2tetris.org/) — the course that inspired this whole journey; their Chapter 2 builds an ALU just like this.

---
**🧭** [← Previous](03-adders.md) · [Next →](05-memory-and-the-clock.md) · [All lessons](README.md)
