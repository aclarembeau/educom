# Lesson 5 — Memory & the Clock ⏱️

> Until now your circuits forgot everything instantly. Time to build a gate that *remembers*.

**🧭 Lesson 5 of 8** · [← Previous](04-the-alu.md) · [Next →](06-the-cpu.md) · [All lessons](README.md)

## 🎯 What you'll build
- A **D flip-flop (DFF)** — the one circuit that can store a bit across time.
- A **4-bit counter** that ticks 0, 1, 2, 3 … 15 and wraps around.
- Your first **sequential** circuit: one whose output depends on the *past*, not just the present.

## 🤔 Why it matters
Everything you've built so far is **combinational**: the output is a pure function of the inputs *right now*. Change the inputs, the output changes instantly; let go, and the circuit forgets. That's great for math — but a computer needs to **remember things**. It needs registers, a program counter, RAM.

The leap from "calculates" to "computes" is the leap into **time**. A CPU does one little step, *remembers the result*, then does the next step. Without memory there's no "next step." This lesson is where your circuit grows a heartbeat — a **clock** — and starts to march forward through time. It's the single most important idea between a calculator and a computer.

## 🧠 The idea

**Where we are:** in lesson 4 you built an ALU — a calculator that produces an answer the instant you set its inputs, then forgets it the moment they change. Every circuit so far has been **combinational**: output is a pure function of the inputs *right now*, with no memory. This lesson adds the missing ingredient — a circuit that can *hold a value over time* — which makes it **sequential**: its output depends on the past, not just the present.

How do you make a gate *remember*? Combinational logic can't — there's nowhere to store the bit. So we introduce exactly **one** new building block, a native primitive called the **DFF** (short for **D flip-flop** — a one-bit memory cell).

A DFF has one input `d` and one output `q`, plus a hidden connection to the **clock** — a signal that "ticks" at a steady beat, like a metronome, telling every memory cell in the machine when to update together. A single beat of that signal is a **clock tick**. The DFF's rule is dead simple:

> On each clock **tick**, `q` becomes whatever `d` was.
> Between ticks, `q` holds steady — it *remembers*.

```
   d ──►┌─────┐
        │ DFF │──► q     "on the tick, copy d into q, then hold"
   clk ►└─────┘
```

Think of a DFF as a light switch wired to a metronome: it only flips to match the wall switch (`d`) on the *beat*, and holds its position in between. You can fiddle with `d` all you like between ticks — `q` ignores you until the next tick.

That hold-and-remember behavior is what storage *is*. A **register** (a small named box that holds one value the machine works with) is just 8 DFFs side by side, holding 8 bits. RAM is millions of them.

**Why is the DFF a native, when everything else is built from NAND?** Because an edge-triggered register depends on the *moment the clock flips* — the transition from low to high. Our simulator has no notion of time passing; it just settles every wire to a stable value. There's no "instant" for it to detect an edge. So the DFF is one of the project's [honest exceptions](../../README.md#-the-one-rule-everything-is-nand): a primitive we provide because it genuinely cannot be a fixed gate netlist.

> 🤓 **Subtle but true:** a *level-sensitive latch* (which follows its input whenever a control line is high) **can** be built from cross-coupled NANDs — the feedback loop settles to a stored value. But a clean, *clocked, edge-triggered* register can't, because edges need real time. That's the precise reason the DFF earns native status and the latch doesn't.

**Feedback makes a counter.** Put the count in DFFs, compute `count + 1` with combinational logic, and wire that answer *back* into the DFFs' inputs. Each tick, the stored count gets replaced by count+1. It counts up forever.

```
   ┌─────────────── q (current count) ───────────────┐
   │                                                  ▼
 [DFFs] ◄── d ── [ +1 adder ] ◄────────────────── (count)
   ▲                                                  
   └── on each tick: q ← count+1, which feeds the adder again
```

## 🔍 The circuit

Open [`workbench/5-counter.compute`](../../workbench/5-counter.compute). As always:

```
#% import : 4-calculator.compute
```

Step 5 imports step 4 (which imported step 3, and so on) — so every adder is already in hand, *and* the `DFF` native is available. The counter itself is strikingly short:

```
counter:
	IN []
	OUT [q3, q2, q1, q0]
	# State: four flip-flops holding the current count.
	DFF [d0], [q0]
	DFF [d1], [q1]
	DFF [d2], [q2]
	DFF [d3], [q3]
	# Next state = count + 1.
	INC4 [q0, q1, q2, q3], [d0, d1, d2, d3]
```

Read it as a loop frozen in silicon:
- The four `DFF`s hold the current count on `q0..q3`.
- `INC4` (a tiny adder that adds 1) reads that count and produces count+1 on `d0..d3`.
- Those `d` wires feed straight back into the DFFs.

On every tick, the stored value advances by one. That's the entire counter. `INC4` is just half-adders chained together — combinational logic you already understand. The only new ingredient is the DFFs giving it *memory*.

## ▶️ Try it

Combinational circuits ran with `run`. Sequential ones need **`tick`** — it advances the clock one beat at a time so you can watch state evolve:

```bash
npm run tick -- workbench/5-counter.compute --ticks 20
```

Real output (abridged):

```
counter  in[ (none) ]   (4 flip-flops)
  tick   1:  q3=0 q2=0 q1=0 q0=0
  tick   2:  q3=0 q2=0 q1=0 q0=1
  tick   3:  q3=0 q2=0 q1=1 q0=0
  tick   4:  q3=0 q2=0 q1=1 q0=1
  ...
  tick  16:  q3=1 q2=1 q1=1 q0=1
  tick  17:  q3=0 q2=0 q1=0 q0=0     ← wrapped around!
  tick  18:  q3=0 q2=0 q1=0 q0=1
```

Read the bits as a binary number: `0000` → `0001` → `0010` … all the way to `1111` (15), then it **wraps back to 0**. Four bits can only count to 15, so on the next tick the carry falls off the end and it starts over. Your circuit is counting in time. ⏱️

**Watch it live:**

```bash
npm run serve -- workbench/5-counter.compute
```

Open **http://localhost:8080** and press the **Tick** / clock control. The 7-segment "Count" display climbs 0…F and rolls over.

## 🧪 Your turn
Ordered easiest first. Each has a hint; one has a worked answer.

1. **Spot the feedback (warm-up).** In the file, trace `q0` from the DFF output, through `INC4`, back to `d0`. That loop *is* the memory. *Hint: `q0` is an output of a DFF and also an input to `INC4`; `INC4`'s output `d0` feeds back into the same DFF.*
2. **Predict the wrap.** Before running, write down which tick a 5-bit counter would wrap on. *Hint: 5 bits count 0…31, so it wraps after 32 values.*

   <details><summary>Show answer</summary>

   A 5-bit counter counts `0` through `31` (that's 32 distinct values). Starting from tick 1 showing `0`, value `31` appears on tick 32, and it wraps back to `0` on **tick 33** — exactly the 4-bit pattern (wrapped on tick 17 = after 16 values) scaled up.

   </details>
3. **Count by 2.** What would you change so the counter skips odd numbers (0, 2, 4, …)? *Hint: feed `INC4` a step of 2 instead of 1 — or simply ignore the lowest bit `q0` and read `q3 q2 q1` as the value.*
4. **Make it 3 bits.** Drop one DFF (say `d3`/`q3`) and adjust `INC4` to a 3-bit increment. Now it counts 0–7 and wraps at 8. *Hint: remove the last `HALFADD` chain link; verify with `npm run tick -- workbench/5-counter.compute --ticks 10`.*

## 🔗 Going deeper
- [Flip-flop (electronics) — Wikipedia](https://en.wikipedia.org/wiki/Flip-flop_(electronics)) — the real component, and why edge-triggering matters.
- [Sequential logic — Wikipedia](https://en.wikipedia.org/wiki/Sequential_logic) — combinational vs. sequential, formalized.
- [Ben Eater — Building an 8-bit breadboard computer](https://eater.net/8bit) — watch a real clock, registers, and a CPU built by hand on breadboards.

---
**🧭** [← Previous](04-the-alu.md) · [Next →](06-the-cpu.md) · [All lessons](README.md)
