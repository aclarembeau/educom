# Lesson 0 — The NAND Gate 🔩

> One tiny logic gate. Wire it cleverly and you can build *anything* — starting with NOT and AND.

**🧭 Lesson 0 of 8** · [← Home](../../README.md) · [Next →](01-basic-gates.md) · [All lessons](README.md)

## 🎯 What you'll build
- Your very first gate, built from the one and only primitive: **NAND**.
- **NOT** — a gate that flips a bit.
- **AND** — a gate that's on only when *both* inputs are on.

## 🤔 Why it matters
Every computer chip on Earth — the one in your phone, your laptop, a game console — is built from billions of tiny switches wired into logic gates. Here's the secret almost nobody tells you: you don't need billions of *different* parts. You need **one**. A single gate called NAND, repeated and wired together, can build every other gate, all of arithmetic, memory, and eventually a whole CPU.

People build working calculators (and even computers!) inside Minecraft using redstone. It feels like magic. It isn't. It's just NAND, over and over. In this lesson you take the very first brick out of the box.

## 🧠 The idea
**Where we are:** you just installed educom. This is the very first brick. Everything in the lessons that follow grows out of what you build right here.

A **bit** is the smallest piece of information: it's either `0` (off) or `1` (on). Think of a single light switch. A **wire** carries one bit from one place to another. A **logic gate** is a tiny device that takes one or more bits in and produces a bit out, following a fixed rule — like a rule-following light switch that watches other switches.

**NAND** stands for "**N**ot **AND**". It looks at two input bits and outputs `0` *only* when both inputs are `1` — otherwise it outputs `1`. Here's its **truth table** — a chart that simply lists the output for every possible combination of inputs (with two inputs there are only four combinations, so four rows):

```
 a  b | NAND
------+-----
 0  0 |  1
 0  1 |  1
 1  0 |  1
 1  1 |  0     <- the only time NAND is 0
```

Here's a helpful way to picture it: NAND is like a single shape of LEGO brick. You might think you need a whole box of different shapes to build something interesting — but it turns out this *one* brick, snapped together in clever ways, can make every other shape you'll ever need. That single rule is enough to build everything. Watch:

**NOT (flip a bit).** If you feed the *same* wire into both inputs of a NAND, you get the inverse:

```
NOT a = NAND(a, a)

 a | NAND(a,a)
---+----------
 0 |    1
 1 |    0
```

When `a` is `0`, "both inputs are 1" is false, so NAND outputs `1`. When `a` is `1`, both inputs are `1`, so NAND outputs `0`. That's exactly a NOT gate. 🎉

**AND (on when both are on).** NAND is already "not AND". So if we just flip its output with a NOT, we get a plain AND:

```
a AND b = NOT( NAND(a, b) )
```

Two NANDs, and you've got AND. This trick — *building a gate by combining simpler ones* — is the whole game.

## 🔍 The circuit
Open [`workbench/0-simple-and.compute`](../../workbench/0-simple-and.compute). Here's how circuits are written in educom's little `.compute` language:

- A line like `NAME:` starts a **gate definition**. The indented lines below it are its body.
- `IN [..]` declares the **input wires**, `OUT [..]` declares the **output wires**.
- `GATE [inputs], [outputs]` **calls** another gate, naming the wires going in and the wires coming out.
- `#` starts a comment. Lines starting with `#%` are **directives** that tell the interactive UI what to show.

Here's the actual code:

```
#% entry  : AND
#% title  : Step 0 — AND from NAND
#% switch a : A
#% switch b : B
#% led c    : A AND B

# NOT a = NAND(a, a): feeding the same wire to both inputs gives the inverse.
NOT:
	IN [a]
	OUT [b]
	NAND [a, a], [b]

# a AND b = NOT(NAND(a, b)): NAND already is "not and", so invert it once more.
AND:
	IN [a, b]
	OUT [c]
	NAND [a, b], [t]       # t = NOT(a AND b)
	NAND [t, t], [c]       # c = NOT t = a AND b
```

Reading it line by line:

- `NOT:` defines a gate with one input `a` and one output `b`. `NAND [a, a], [b]` wires `a` into *both* NAND inputs and sends the result to `b`. That's our bit-flipper.
- `AND:` takes inputs `a` and `b`. The first `NAND [a, b], [t]` computes "not (a and b)" onto a temporary wire `t`. The second `NAND [t, t], [c]` flips `t` (the NOT trick again!) onto output `c`. So `c = a AND b`.
- The `#% entry : AND` directive tells educom that `AND` is the circuit to show when you open the page. The `#% switch` and `#% led` lines label the two input switches and the output light.

> Notice we built `AND` using only `NAND` calls — no built-in AND anywhere. That's the rule for the whole project: **everything is NAND.**

## ▶️ Try it
**Interactive (recommended):**

```bash
npm run serve -- workbench/0-simple-and.compute
```

Now open **http://localhost:8080**. You'll see two switches (**A** and **B**) and a light (**A AND B**). Flip the switches and watch: the light turns on **only when both A and B are on**. You just ran real digital logic in your browser. 💡

**Non-interactive (prints the full truth table):**

```bash
npm run table -- workbench/0-simple-and.compute
```

Expected output:

```
a  b  |  c
----------
0  0  |  0
0  1  |  0
1  0  |  0
1  1  |  1
```

The output `c` is `1` on exactly one row — when both `a` and `b` are `1`. That's AND. ✅

## 🧪 Your turn
Ordered easy → harder. Each has a hint; the first has a worked answer you can peek at.

1. **Predict, then check.** Before running `npm run table`, cover the output column with your hand and predict the value of `c` on each of the four rows. Then run it and compare. *Hint: AND is `1` only when both inputs are `1`.*

   <details><summary>Show answer</summary>

   ```
   a  b  |  c
   ----------
   0  0  |  0
   0  1  |  0
   1  0  |  0
   1  1  |  1
   ```
   Only the last row (`1` and `1`) gives `c = 1`. Every other row has at least one `0`, so AND is `0`.

   </details>

2. **Test your NOT.** Change `#% entry : AND` to `#% entry : NOT` at the top of the file, then run `npm run table -- workbench/0-simple-and.compute`. You should see `a=0 → 1` and `a=1 → 0` (the input flipped). *Hint: a NOT gate has only one input, so its table has just two rows. Put the directive back to `AND` when you're done.*

3. **Build a NAND-only NOR gate (stretch).** NOR is "not OR" — it outputs `1` only when *both* inputs are `0`. On paper, sketch how you'd wire it from NANDs. *Hint: OR can be built from NANDs too (you'll see exactly how in the next lesson), and NOR is just OR followed by a NOT — and you already know NOT is `NAND(x, x)`.*

## 🔗 Going deeper
- [Wikipedia: NAND logic](https://en.wikipedia.org/wiki/NAND_logic) — how every gate reduces to NAND, with diagrams.
- [nand2tetris.org](https://www.nand2tetris.org/) — the famous course this project is inspired by: build a computer from NAND up.
- [Crash Course Computer Science #3 — Boolean Logic](https://www.youtube.com/watch?v=gI-qXk7XojA) — a friendly 12-minute intro to gates.

---
**🧭** [← Home](../../README.md) · [Next →](01-basic-gates.md) · [All lessons](README.md)
