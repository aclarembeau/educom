# Lesson 2 — The Half Adder ➕

> Your first piece of arithmetic. It turns out 1 + 1 is just XOR and AND.

**🧭 Lesson 2 of 8** · [← Previous](01-basic-gates.md) · [Next →](03-adders.md) · [All lessons](README.md)

## 🎯 What you'll build
- **HALFADD** — a circuit that adds two single bits and produces a **sum** and a **carry**.
- Your first reusable *arithmetic* block, made from gates you already have.

## 🤔 Why it matters
Computers don't really "do math" — they don't know what numbers *are*. They just shuffle bits through gates. And yet your calculator adds, your game keeps score, your bank tracks money. How?

It all starts here. A computer adds two big numbers by adding them one bit at a time, exactly the way you add two decimal numbers column by column — writing a digit and carrying the overflow to the next column. The half adder is that single column. Build it once, chain it up, and you can add any numbers at all. This is the moment logic becomes arithmetic. 🤯

## 🧠 The idea
**Where we are:** in Lesson 1 you finished the gate family — AND, OR, XOR, and the mux. This lesson uses just two of them (XOR and AND) to do something that suddenly feels like real *math*: adding numbers.

A quick word on **binary**. Binary is counting with only two digits, `0` and `1`, instead of the ten digits (`0`–`9`) you're used to. Each digit is one **bit**. Just as `10` in normal (decimal) numbers means "one ten and zero ones," `10` in binary means "one two and zero ones" — that is, the number two. We'll lean on that in a moment.

Let's add two bits, `a` and `b`. In binary there are only four cases:

```
  0 + 0 = 0
  0 + 1 = 1
  1 + 0 = 1
  1 + 1 = 2   ... but 2 doesn't fit in one bit!
```

That last case is the interesting one. In binary, `2` is written `10` — two digits. So adding `1 + 1` gives a result of `0` in this column and a `1` that **carries** into the next column. This is exactly the grade-school move you already know: when `5 + 5 = 10`, you write `0` and "carry the `1`" into the next column. A **carry** is just that overflow digit handed to the column on its left.

So a single-bit addition really has **two** outputs:
- **sum** — the digit that stays in this column.
- **carry** — the overflow that moves to the next column (the "carry the 1").

Here's the full truth table:

```
 a  b | carry  sum
------+-----------
 0  0 |   0     0
 0  1 |   0     1
 1  0 |   0     1
 1  1 |   1     0     <- 1 + 1 = binary 10
```

Now look closely at those two output columns — do they seem familiar from Lesson 1?

- The **sum** column is `0, 1, 1, 0`. That's **XOR**! (`1` when the bits differ.)
- The **carry** column is `0, 0, 0, 1`. That's **AND**! (`1` only when both are `1`.)

So:

```
sum   = a XOR b
carry = a AND b
```

That's the whole half adder. Arithmetic, falling straight out of two gates you already built. 🎉

## 🔍 The circuit
Open [`workbench/2-half-adder.compute`](../../workbench/2-half-adder.compute). As always, it starts by importing the previous step:

```
#% import : 1-basic-gates.compute
```

This pulls in everything from Lesson 1 — crucially **XOR** and **AND** — so we don't redefine them. The whole half adder is then just two lines:

```
HALFADD:
	IN [a, b]
	OUT [s, c]
	XOR [a, b], [s]       # sum   = a XOR b
	AND [a, b], [c]       # carry = a AND b
```

- `IN [a, b]` — the two bits to add.
- `OUT [s, c]` — `s` is the sum, `c` is the carry.
- `XOR [a, b], [s]` computes the sum bit.
- `AND [a, b], [c]` computes the carry bit.

Two gate calls, both reused from earlier steps. That's it. `HALFADD` is the first reusable arithmetic block — next lesson you'll chain it into adders that handle real multi-bit numbers.

## ▶️ Try it
**Interactive:**

```bash
npm run serve -- workbench/2-half-adder.compute
```

Open **http://localhost:8080**. You'll see switches **A** and **B** and two lights: **Sum** and **Carry**. Flip both switches **on** — and watch the **Carry** light come up while **Sum** goes dark. You're literally watching `1 + 1 = 10` happen in logic. 🔥

**Non-interactive (truth table):**

```bash
npm run table -- workbench/2-half-adder.compute
```

Expected output:

```
a  b  |  s  c
-------------
0  0  |  0  0
0  1  |  1  0
1  0  |  1  0
1  1  |  0  1
```

Read each row as `a + b`: the last row is `1 + 1`, giving sum `0` and carry `1` — binary `10`, which is `2`. ✅

## 🧪 Your turn
Ordered easy → harder. Each has a hint; #3 has a worked answer.

1. **Read the table as math.** For each of the four rows, say the addition out loud: "one plus zero is one, carry zero." Does every row match what you'd expect? *Hint: read `carry sum` together as a two-bit binary number — the last row is `10`, which is two.*

2. **Why "half"?** A *half* adder can't accept a carry coming *in* from a previous column — it only adds two fresh bits. Think about why that's a problem when adding multi-bit numbers like `11 + 01`. *Hint: when you add the rightmost column you get a carry — but the next column to the left has no way to receive it. (Next lesson fixes this with a* full *adder.)*

3. **Swap the gates.** What would the truth table look like if you accidentally wrote `AND` for the sum and `XOR` for the carry? Predict it first, then edit the file and run `npm run table` to check. *Hint: just swap the two output columns you saw above.*

   <details><summary>Show answer</summary>

   The two columns simply trade places — `s` becomes the AND result and `c` becomes the XOR result:
   ```
   a  b  |  s  c
   -------------
   0  0  |  0  0
   0  1  |  0  1
   1  0  |  0  1
   1  1  |  1  0
   ```
   Now `1 + 1` would report sum `1` and carry `0`, which is wrong — that's why the gate order matters!

   </details>

4. **Stretch:** Could you build the sum bit *without* the `XOR` gate, using only NOT, AND, and OR (all available from earlier lessons)? *Hint: `a XOR b = (a AND NOT b) OR (NOT a AND b)` — true when exactly one input is `1`.*

## 🔗 Going deeper
- [Wikipedia: Adder (electronics)](https://en.wikipedia.org/wiki/Adder_(electronics)) — half adders and full adders with circuit diagrams.
- [Ben Eater: Building an 8-bit breadboard computer](https://www.youtube.com/playlist?list=PLowKtXNTBypGqImE405J2565dvjafglHU) — watch real chips add numbers; the adder episodes make this tangible.
- [Crash Course Computer Science #5 — How Computers Calculate (the ALU)](https://www.youtube.com/watch?v=1I5ZMmrOfnA) — where the adder fits in the bigger picture.

---
**🧭** [← Previous](01-basic-gates.md) · [Next →](03-adders.md) · [All lessons](README.md)
