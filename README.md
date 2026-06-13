# 🔩 educom

### Build a working computer from a single NAND gate — and watch it run. ⚡

![Node.js >= 22.6.0](https://img.shields.io/badge/Node.js-%3E%3D22.6.0-339933?logo=node.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-native%2C%20no%20build-3178C6?logo=typescript&logoColor=white)
![Zero dependencies](https://img.shields.io/badge/dependencies-zero-brightgreen)
![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)

> One tiny logic gate. Wired cleverly, a few thousand times. That's a CPU.
> In educom you build that tower yourself — one understandable step at a time.

---

## 🤔 Why?

Ever wondered how a chipmaker turns a slab of sand into a CPU that runs **billions of operations a second**?

Ever seen someone build a working calculator — or a *whole computer* — inside Minecraft with redstone, and wondered how that's even possible?

Here's the secret: **a computer is not magic.** It's one ridiculously simple logic gate, the **NAND**, repeated and wired together millions of times. That's it. Everything — arithmetic, memory, the screen you're reading this on, the CPU running your browser — is built out of that single brick.

educom lets you build that tower yourself, from the very first gate up to a real CPU running a real program, and watch every step light up live in your browser. No black boxes. No "trust me, it works." You wire it, you flip the switches, you see the light turn on.

---

## 🚀 Quick start

**Prerequisites:** [Node.js](https://nodejs.org/) **>= 22.6.0** — educom runs on Node's native TypeScript, so there's no compile step and no build to wait for.

```bash
npm install
npm start          # serves lesson 0 at http://localhost:8080
```

`npm start` is the shortcut — it's exactly equivalent to the explicit form `npm run serve -- workbench/0-simple-and.compute`.

Now open **http://localhost:8080** — and there it is: your first gate, an **AND** built from nothing but NAND. Flip the two switches on the page and watch the light turn on only when *both* are on. You just simulated real digital logic. 💡

Want a guided tour from here? Head to **[GETTING_STARTED.md](GETTING_STARTED.md)**.

---

## 🧗 The journey

The `workbench/` folder is a numbered staircase. Each step `#% import`s the one before it, so a gate like `AND` is defined **once** and reused forever — never re-derived. You climb from a single gate all the way to a computer with a screen and keyboard.

| Step | What you'll build | The *aha* moment | Lesson |
|:----:|-------------------|------------------|--------|
| 0️⃣ | [`0-simple-and.compute`](workbench/0-simple-and.compute) — `NOT` & `AND` from `NAND` | "Wait... I can make *any* gate out of just this one?" | [The NAND gate](docs/lessons/00-the-nand-gate.md) |
| 1️⃣ | [`1-basic-gates.compute`](workbench/1-basic-gates.compute) — `OR`, `XOR`, `MUX`, constants | A multiplexer is a circuit that makes a *decision*. | [Basic gates](docs/lessons/01-basic-gates.md) |
| 2️⃣ | [`2-half-adder.compute`](workbench/2-half-adder.compute) — adding two bits | Addition is just XOR + AND. That's arithmetic. | [The half adder](docs/lessons/02-the-half-adder.md) |
| 3️⃣ | [`3-adder.compute`](workbench/3-adder.compute) — multi-bit adders | Chain adders together and carry ripples down the line. | [Adders](docs/lessons/03-adders.md) |
| 4️⃣ | [`4-calculator.compute`](workbench/4-calculator.compute) — a 4-bit ALU (ADD/SUB/MUL/DIV) | A full calculator — **1372 NAND gates**, every one yours. | [The ALU](docs/lessons/04-the-alu.md) |
| 5️⃣ | [`5-counter.compute`](workbench/5-counter.compute) — memory, the DFF, the clock | Gates that *remember*. Your first circuit with time. | [Memory & the clock](docs/lessons/05-memory-and-the-clock.md) |
| 6️⃣ | [`6-cpu.compute`](workbench/6-cpu.compute) — a real single-cycle RISC CPU | Type a program, hit Run, and **the gates execute it**. | [The CPU](docs/lessons/06-the-cpu.md) |
| 7️⃣ | [`7-computer.compute`](workbench/7-computer.compute) — CPU + screen + keyboard | A computer that draws pixels and echoes your keystrokes. | [The computer](docs/lessons/07-the-computer.md) |

---

## 🛠️ What you can do

Every command takes a `.compute` file. Pick any step above and poke at it:

```bash
npm run serve -- workbench/0-simple-and.compute   # interactive web UI, live-reloads on save
npm run run   -- workbench/0-simple-and.compute   # evaluate the circuit once
npm run tick  -- workbench/5-counter.compute      # advance a clocked circuit one tick at a time
npm run table -- workbench/2-half-adder.compute   # print the full truth table
npm run info  -- workbench/4-calculator.compute   # netlist stats (how many gates?)
npm test                                          # run the unit tests
npm run typecheck                                 # type-check the source
```

`serve` watches your file and **live-reloads the page** the moment you save — edit a gate, see it change instantly.

---

## 🧱 The one rule: everything is NAND

The whole project is built from a single logic primitive: **NAND** (`NOT (a AND b)`). Every other gate — NOT, AND, OR, XOR, multiplexers, adders, the ALU, the CPU's logic — decomposes into NANDs and nothing else.

There are a few **honest exceptions**, added only when something genuinely *cannot* be expressed as a fixed gate netlist:

- **`dff`** — an edge-triggered register that needs a real notion of *clock transition* (this is what gives circuits memory and time).
- **`rom`** — its contents are a program you type at runtime, not a fixed circuit.
- **I/O peripherals** — `screen`, `keyboard`, `switch`, `led`, `seg7`: the boundary to the outside world, not logic.

That's the entire list. Everything else, you build.

Curious how the simulator actually flattens and runs all this? Dig into **[docs/how-it-works.md](docs/how-it-works.md)**. Want the full `.compute` language reference? See **[docs/language.md](docs/language.md)**.

---

## 🌱 No prior knowledge needed

You don't need to know electronics, math, or even much programming. **If you can copy-paste a command, you can build a CPU.** Each step explains itself, builds on the last, and shows you the result live. Start at step 0 and just keep climbing.

---

## 📚 More

- **[GETTING_STARTED.md](GETTING_STARTED.md)** — your first guided session
- **[docs/references.md](docs/references.md)** — further reading & inspiration
- **[CONTRIBUTING.md](CONTRIBUTING.md)** — help make educom better

Built with ❤️ and exactly one logic gate. **MIT licensed.**
