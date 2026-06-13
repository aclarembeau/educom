# Lesson 3 — Adders 🧮

> Chain single-bit adders together and the carry *ripples* down the line — now you can add real numbers.

**🧭 Lesson 3 of 8** · [← Previous](02-the-half-adder.md) · [Next →](04-the-alu.md) · [All lessons](README.md)

## 🎯 What you'll build
- **FULLADD** — a single-bit adder that also accepts a carry coming *in*.
- **ADD4** and **ADD8** — ripple-carry adders that add 4- and 8-bit numbers.
- A peek at the vector helpers (**INC8**, **NOT8**, **MUX8**) the calculator and CPU will lean on.

## 🤔 Why it matters
Last lesson's half adder could only add two lone bits. But real numbers have many bits: `5` is `101`, `7` is `111`. To add them you go column by column, **carrying** overflow from one column into the next — exactly like adding `27 + 15` on paper carries a `1` into the tens column.

A half adder can't accept that incoming carry. So we upgrade it to a **full adder**, then line up a row of them — each one's carry-out feeding the next one's carry-in. The carry "ripples" along the chain. With four of them you add any two 4-bit numbers. With eight, any two 8-bit numbers. This *exact* circuit is inside every CPU's arithmetic unit. You're about to build the real thing.

## 🧠 The idea
**Where we are:** in Lesson 2 you built the half adder — it adds two single bits and produces a sum and a carry. The catch: it can't accept a carry coming *in*. This lesson fixes that and chains adders together so you can add real, multi-bit numbers.

**The full adder.** A full adder adds **three** bits: `a`, `b`, and a carry-in `cin` (the carry arriving *from the column on its right*). It still produces a sum and a carry-out (the carry leaving toward the column on its left). Why three inputs? Because when you're partway down a multi-bit addition, each column has the two original bits *plus* whatever carried in from the column to its right.

You build a full adder from **two half adders**: first half-add `a` and `b`, then half-add that result with `cin`. If *either* of those half-adds produced a carry, the carry-out is `1` — so you OR the two carries together.

Here's the full adder's truth table for all eight input combinations (`sum` is `1` when an odd number of inputs are `1`; `cout` is `1` when at least two inputs are `1`):

```
 a  b cin | cout sum
----------+---------
 0  0  0  |  0    0
 0  0  1  |  0    1
 0  1  0  |  0    1
 0  1  1  |  1    0
 1  0  0  |  0    1
 1  0  1  |  1    0
 1  1  0  |  1    0
 1  1  1  |  1    1     <- 1+1+1 = binary 11 = three
```

**Ripple-carry: adding many bits.** Imagine adding two 4-bit numbers, `a` and `b`. We number the bits from the right. Bit `0` is the **least-significant bit** — the rightmost, "ones" digit, the one worth the least. Bit `3` is the **most-significant bit** — the leftmost, worth the most (just like the leftmost digit of `9000` carries the most weight). You add column by column, passing each carry forward:

```
        a3  a2  a1  a0
      +  b3  b2  b1  b0
      -----------------
   carry <--- <--- <--- 0   (carry-in to the first column is 0)
        s3  s2  s1  s0   + a final carry-out
```

The carry from column 0 flows into column 1, its carry flows into column 2, and so on — it **ripples** down the line, the way a single drop sends a wave spreading across a pond. That's why it's called a *ripple-carry adder*. The result needs **5** bits for two 4-bit inputs: four sum bits plus that final carry-out (because `15 + 15 = 30`, which needs a 5th bit).

Worked example: `5 + 7 = 12`.

```
   5 = 0101
   7 = 0111
  ----------
  12 = 1100      (sum bits 1100, no extra carry-out: result fits in 4 bits + 0)
```

You'll confirm this exact sum on the command line below.

## 🔍 The circuit
Open [`workbench/3-adder.compute`](../../workbench/3-adder.compute). It imports the half adder from Lesson 2:

```
#% import : 2-half-adder.compute
```

That gives us `HALFADD` (and, through *its* imports, `OR`, `XOR`, `AND`, `ZERO`, and friends). First, the full adder:

```
# Full adder: s = a^b^cin, cout = majority(a, b, cin).
FULLADD:
	IN [a, b, cin]
	OUT [s, cout]
	HALFADD [a, b], [s1, c1]
	HALFADD [s1, cin], [s, c2]
	OR [c1, c2], [cout]
```

- `HALFADD [a, b], [s1, c1]` adds the two data bits, giving a partial sum `s1` and carry `c1`.
- `HALFADD [s1, cin], [s, c2]` adds the carry-in to that partial sum, giving the final sum `s` and a second carry `c2`.
- `OR [c1, c2], [cout]` — if either half-add overflowed, carry out a `1`.

Now chain four of them into a 4-bit adder:

```
# 4-bit ripple-carry adder.
ADD4:
	IN [a0, a1, a2, a3, b0, b1, b2, b3, cin]
	OUT [s0, s1, s2, s3, cout]
	FULLADD [a0, b0, cin], [s0, k0]
	FULLADD [a1, b1, k0], [s1, k1]
	FULLADD [a2, b2, k1], [s2, k2]
	FULLADD [a3, b3, k2], [s3, cout]
```

Follow the carry wire `k`: the first full adder's carry-out `k0` becomes the second's carry-in, whose carry-out `k1` feeds the third, and so on. That's the ripple, made of wires. The final adder's carry-out becomes `cout`, the 5th result bit.

The entry circuit wires this up for two 4-bit switches, starting the chain with a carry-in of `0`:

```
adder4:
	IN [a0, a1, a2, a3, b0, b1, b2, b3]
	OUT [s0, s1, s2, s3, carry]
	ZERO [a0], [z]                                  # carry-in = 0
	ADD4 [a0, a1, a2, a3, b0, b1, b2, b3, z], [s0, s1, s2, s3, carry]
```

`ZERO [a0], [z]` produces a constant `0` wire `z` (the value of `a0` doesn't matter — `ZERO` is always `0`), used as the carry-in for the very first column.

The file also defines blocks the later steps reuse:
- **ADD8** — the same idea, eight full adders deep, for 8-bit numbers.
- **INC8** — adds `1` to an 8-bit number (the CPU's program counter uses it to step forward).
- **NOT8** — flips all 8 bits at once.
- **MUX8** — an 8-bit-wide 2-to-1 selector (the `MUX2` from Lesson 1, applied bit by bit).

> Everything here is still, ultimately, NAND gates. Run `npm run info` below and you'll see exactly how many.

## ▶️ Try it
**Interactive:**

```bash
npm run serve -- workbench/3-adder.compute
```

Open **http://localhost:8080**. You'll see two banks of switches (**A.0–A.3** and **B.0–B.3**) and a 7-segment display showing **A + B**. Set A to `5` (flip A.0 and A.2 on → binary `0101`) and B to `7` (flip B.0, B.1, B.2 on → binary `0111`). The display reads **12**. Try `15 + 15` (all switches on) and watch the 5th bit (the carry) light up to make `30`.

**Non-interactive (compute one sum directly):**

```bash
npm run run -- workbench/3-adder.compute --in a0=1,a2=1,b0=1,b1=1,b2=1
```

Here `a = 0101 = 5` and `b = 0111 = 7`. Expected output:

```
adder4:  in[ a0=1 a1=0 a2=1 a3=0 b0=1 b1=1 b2=1 b3=0 ]  ->  out[ s0=0 s1=0 s2=1 s3=1 carry=0 ]
```

Read the result bits **most-significant first**: `carry s3 s2 s1 s0` = `0 1 1 0 0` = binary `1100` = **12**. `5 + 7 = 12`. ✅

**Count the gates:**

```bash
npm run info -- workbench/3-adder.compute
```

Expected output:

```
entrypoint:  adder4
inputs:      [a0, a1, a2, a3, b0, b1, b2, b3]  (8)
outputs:     [s0, s1, s2, s3, carry]  (5)
defined:     NOT, AND, gates, OR, XOR, BUF, ZERO, ONE, MUX2, AND4, HALFADD, adder4, FULLADD, ADD4, ADD8, INC8, NOT8, MUX8
flattened:   63 NAND gate(s), 71 wire(s), 0 clock(s)
```

A 4-bit adder is **63 NAND gates** — every one of them traceable back to the single primitive you started with in Lesson 0. 🔩

## 🧪 Your turn
Ordered easy → harder. Each has a hint; #3 has a worked answer.

1. **Predict before you run.** What's `3 + 6`? Work out the switch settings (`a = 0011`, `b = 0110`), then run:
   ```bash
   npm run run -- workbench/3-adder.compute --in a0=1,a1=1,b1=1,b2=1
   ```
   Check the result is `9`. *Hint: read the output bits most-significant first — `carry s3 s2 s1 s0` should be `0 1 0 0 1` = binary `1001` = 9.*

2. **Make the carry fire.** Find an A and B whose sum is `16` or more, so the `carry` output (the 5th bit) turns on. The smallest example is `8 + 8`:
   ```bash
   npm run run -- workbench/3-adder.compute --in a3=1,b3=1
   ```
   *Hint: `8` is `1000` in binary, so only bit 3 is set. Confirm `carry=1` and all four sum bits are `0` — that's `10000` = 16.*

3. **Trace the ripple.** For `7 + 1` (`0111 + 0001`), follow the carry by hand through all four full adders. Which columns produce a carry, and where does the ripple stop? Then verify with `npm run run -- workbench/3-adder.compute --in a0=1,a1=1,a2=1,b0=1`. *Hint: start at column 0 (`1 + 1`).*

   <details><summary>Show answer</summary>

   - Column 0: `1 + 1 = 10` → sum `0`, **carry out 1**.
   - Column 1: `1 + 0` plus carry-in `1` = `10` → sum `0`, **carry out 1**.
   - Column 2: `1 + 0` plus carry-in `1` = `10` → sum `0`, **carry out 1**.
   - Column 3: `0 + 0` plus carry-in `1` = `1` → sum `1`, carry out `0`. The ripple **stops here**.

   Result bits (`carry s3 s2 s1 s0`) = `0 1 0 0 0` = binary `1000` = **8**, and `7 + 1 = 8`. ✅ The run confirms `s3=1`, everything else `0`.

   </details>

4. **Stretch:** Skim `ADD8` in the file. How many `FULLADD` calls does it have, and what changes versus `ADD4`? Could you sketch an `ADD16` the same way? *Hint: count the `FULLADD` lines in `ADD8` — there's one per bit — and notice the carry wire `k` threading through each one.*

## 🔗 Going deeper
- [Wikipedia: Adder (electronics) — ripple-carry adder](https://en.wikipedia.org/wiki/Adder_(electronics)#Ripple-carry_adder) — the chain you just built, with timing notes on *why* the ripple has a speed cost.
- [Ben Eater: ALU / adder build](https://www.youtube.com/playlist?list=PLowKtXNTBypGqImE405J2565dvjafglHU) — see a real ripple-carry adder wired on a breadboard.
- [nand2tetris.org](https://www.nand2tetris.org/) — Project 2 builds these exact adders on the path to a full CPU.

---
**🧭** [← Previous](02-the-half-adder.md) · [Next →](04-the-alu.md) · [All lessons](README.md)
