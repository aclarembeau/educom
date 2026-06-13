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

A calculator needs to do *different things* depending on a button you press. But a circuit can't physically rewire itself. So instead we do something clever:

**Compute every answer at once, then pick the one we want.**

The picker is a **multiplexer** (MUX) — a circuit that takes several inputs and one selector, and passes through just the selected one. Think of it as a railway switch: all the trains are running, the switch decides which track reaches the station.

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

**A neat trick for subtraction.** Computers don't build a separate "subtractor." They reuse the adder using **two's complement**: to compute `A − B`, they add `A + (NOT B) + 1`. Flipping every bit of B and adding 1 gives you "negative B," so subtraction becomes addition. One adder, two jobs. (If the addition produces a carry-out, then A ≥ B; if not, A < B and we raise the **borrow** flag.)

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

Real output:

```
entrypoint:  calculator
inputs:      [a3, a2, a1, a0, b3, b2, b1, b0, op1, op0]  (10)
outputs:     [ea3, ..., r0, flag]  (17)
flattened:   1372 NAND gate(s), 1382 wire(s), 0 clock(s)
```

**1372 NAND gates.** Every single one decomposed from the one primitive you started with in lesson 0. That's a full four-function calculator made of nothing but NAND. (Notice `0 clock(s)` — this circuit has no memory yet. That changes next lesson.)

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
1. **Find a carry.** Pick A and B in ADD mode whose sum is greater than 15. Watch the Flag light — that's the carry bit saying "the answer didn't fit."
2. **Force a borrow.** In SUB mode, set A < B (say A=2, B=7). The Flag turns on, and the result is the *two's-complement* wrap-around. Can you predict the displayed value?
3. **Predict before you peek.** Set A=7, B=6 and work out all four results on paper, then switch op1/op0 to check yourself.
4. **Read the code.** Find the `MUL4` gate in the file. Count how many `ADD8` calls it uses to multiply. (Hint: one per partial product.)

## 🔗 Going deeper
- [Arithmetic logic unit — Wikipedia](https://en.wikipedia.org/wiki/Arithmetic_logic_unit) — the real-world component you just built.
- [Two's complement — Wikipedia](https://en.wikipedia.org/wiki/Two%27s_complement) — why "add the negative" works.
- [nand2tetris](https://www.nand2tetris.org/) — the course that inspired this whole journey; their Chapter 2 builds an ALU just like this.

---
**🧭** [← Previous](03-adders.md) · [Next →](05-memory-and-the-clock.md) · [All lessons](README.md)
