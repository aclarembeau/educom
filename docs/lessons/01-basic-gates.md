# Lesson 1 — Basic Gates 🚪

> Meet the rest of the logic family — OR, XOR, and a gate that makes *decisions*: the multiplexer.

**🧭 Lesson 1 of 8** · [← Previous](00-the-nand-gate.md) · [Next →](02-the-half-adder.md) · [All lessons](README.md)

## 🎯 What you'll build
- **OR** and **XOR**, the two remaining everyday two-input gates.
- A few handy helpers: a buffer, and constant `0` / `1`.
- **MUX2** — a 2-to-1 *multiplexer*, a circuit that picks between two inputs. This is your first "decision-maker".

## 🤔 Why it matters
In Lesson 0 you made NOT and AND. With OR and XOR added, you have the complete toolkit that nearly all digital logic is described in. XOR in particular is secretly the heart of arithmetic — you'll add two numbers with it next lesson.

And the multiplexer? It's how a chip *chooses*. "If this control bit is on, send signal B through; otherwise send A." That's an `if` statement made of wires. Every time your CPU decides which value to use, a multiplexer is doing the choosing.

## 🧠 The idea
**Where we are:** in Lesson 0 you built NOT and AND out of pure NAND. Now we round out the family with OR and XOR (still from NAND), then build your first *decision-making* circuit. Every new gate here is made only from gates you already have.

Here are the three classic two-input gates side by side:

```
 a  b | AND  OR  XOR
------+-------------
 0  0 |  0    0    0
 0  1 |  0    1    1
 1  0 |  0    1    1
 1  1 |  1    1    0
```

- **AND** — `1` only when *both* are `1` (you built this last lesson).
- **OR** — `1` when *at least one* is `1`.
- **XOR** ("exclusive or") — `1` when the inputs **differ**. Same inputs → `0`, different inputs → `1`. Remember XOR — it's the star of the next lesson.

**Building OR from NAND.** There's a beautiful rule called **De Morgan's law** that says `a OR b` equals `NAND(NOT a, NOT b)`. In words: flip both inputs, then NAND them. Try it on the table above and you'll see it works.

**The multiplexer (MUX).** A *multiplexer* (mux, for short) is a circuit that **chooses** between inputs. A 2-to-1 mux has three inputs: two data wires `a` and `b`, and a **selector** `s` (the control bit that decides which one gets through). The output is:

```
y = s ? b : a        (read: "if s, then b, else a")
```

If the selector `s` is `0`, the output is `a`. If `s` is `1`, the output is `b`.

Picture a **railroad switch**: two tracks of trains are running, and a lever (the selector) decides which track reaches the station. Or, if you've seen a little code: it's an `if` statement made of wires — `if (s) y = b; else y = a;`. Every time a CPU decides which value to use, a multiplexer is doing the choosing.

## 🔍 The circuit
Open [`workbench/1-basic-gates.compute`](../../workbench/1-basic-gates.compute). The first interesting line is:

```
#% import : 0-simple-and.compute
```

This `#% import` directive pulls in **every gate defined in Lesson 0's file** — so `NOT` and `AND` are already available here without redefining them. This is the core idea of educom: each step `#% import`s the one before it and adds a few new gates on top. You define `AND` *once*, ever, and reuse it forever.

The entry circuit just exposes AND / OR / XOR so you can eyeball them together:

```
gates:
	IN [a, b]
	OUT [g_and, g_or, g_xor]
	AND [a, b], [g_and]
	OR  [a, b], [g_or]
	XOR [a, b], [g_xor]
```

It calls three gates and routes each result to its own output light. Now the new gates themselves:

```
# a OR b = NAND(NOT a, NOT b)   (De Morgan)
OR:
	IN [a, b]
	OUT [c]
	NOT [a], [na]
	NOT [b], [nb]
	NAND [na, nb], [c]

# a XOR b: 1 exactly when the inputs differ.
XOR:
	IN [a, b]
	OUT [c]
	NAND [a, b], [t]
	NAND [a, t], [u]
	NAND [b, t], [v]
	NAND [u, v], [c]
```

- **OR** is De Morgan's law made literal: invert `a` into `na`, invert `b` into `nb`, then `NAND` them. Three gates, and you've got OR.
- **XOR** takes four NANDs cleverly arranged. You don't need to memorize the wiring — just trust the truth table (and verify it below!). XOR is "`1` when the bits differ".

And the decision-maker:

```
# 2:1 multiplexer:  y = s ? b : a.
MUX2:
	IN [s, a, b]
	OUT [y]
	NOT [s], [ns]
	AND [ns, a], [t0]
	AND [s, b], [t1]
	OR [t0, t1], [y]
```

Read it as: "let `a` through when `s` is `0` (`ns AND a`), let `b` through when `s` is `1` (`s AND b`), then OR the two paths together." Exactly one path is ever active, so `y` is whichever input the selector chose.

Here's the mux in a compact truth table — notice the output `y` always equals one of the inputs, picked by `s`:

```
 s  a  b | y
---------+---
 0  0  1 | 0   <- s=0, so y = a (=0)
 0  1  0 | 1   <- s=0, so y = a (=1)
 1  0  1 | 1   <- s=1, so y = b (=1)
 1  1  0 | 0   <- s=1, so y = b (=0)
```

The file also defines a `BUF` (clean copy of a wire), `ZERO` and `ONE` (constants derived from any wire), and `AND4` (a 4-input AND). You'll meet these again in later steps.

## ▶️ Try it
**Interactive:**

```bash
npm run serve -- workbench/1-basic-gates.compute
```

Open **http://localhost:8080**. You'll see switches **A** and **B** and three lights: **A AND B**, **A OR B**, **A XOR B**. Flip the switches through all four combinations and watch the three lights respond. Notice XOR is lit only when the switches *disagree*.

**Non-interactive (truth table):**

```bash
npm run table -- workbench/1-basic-gates.compute
```

Expected output:

```
a  b  |  g_and  g_or  g_xor
---------------------------
0  0  |  0  0  0
0  1  |  0  1  1
1  0  |  0  1  1
1  1  |  1  1  0
```

Look at the `g_xor` column: `0, 1, 1, 0`. Lit when the inputs differ, dark when they match. That's XOR. ✅

## 🧪 Your turn
Ordered easy → harder. Each has a hint; #2 has a worked answer.

1. **Predict the OR column** before you run `npm run table`. *Hint: OR is `1` whenever at least one input is `1`.* Easy warm-up.

2. **Spot the difference.** Compare the `g_and` and `g_xor` columns in the table. They agree on three rows and differ on exactly one — which row, and why? *Hint: think about `1 AND 1` versus `1 XOR 1`.*

   <details><summary>Show answer</summary>

   They differ on the last row, `a=1, b=1`. There, `AND` is `1` (both inputs are on) but `XOR` is `0` (the inputs are the *same*, and XOR is only `1` when inputs *differ*). On the other three rows the inputs are not both `1`, so both gates give the same value.

   </details>

3. **Build a NOR gate.** NOR is "not OR". Add a `NOR:` gate that calls `OR` then `NOT` — both are already defined, so you can just reuse them! Point `#% entry` at a small test gate that calls `NOR`, run `npm run table`, and check that the output is `1` only on the `0 0` row. *Hint: a NOR body is two lines: `OR [a, b], [t]` then `NOT [t], [c]`.*

4. **Stretch: a 4-to-1 mux.** Using three `MUX2` calls, can you sketch a circuit that picks between *four* inputs using two selector bits? *Hint: use the low selector bit to mux the first pair and the second pair, then use the high selector bit to mux those two results — a little tree of muxes.*

## 🔗 Going deeper
- [Wikipedia: Logic gate](https://en.wikipedia.org/wiki/Logic_gate) — the full gate family with symbols and tables.
- [Wikipedia: Multiplexer](https://en.wikipedia.org/wiki/Multiplexer) — why "choosing" is such a fundamental operation.
- [Crash Course Computer Science #3 — Boolean Logic](https://www.youtube.com/watch?v=gI-qXk7XojA) — gates explained in plain English.

---
**🧭** [← Previous](00-the-nand-gate.md) · [Next →](02-the-half-adder.md) · [All lessons](README.md)
