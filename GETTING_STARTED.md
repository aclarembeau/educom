# 🚀 Getting started with educom

Welcome! This is a friendly walkthrough of your first session with **educom** — a no-build TypeScript simulator where you build a working computer up from a single **NAND** gate and watch it run live in your browser.

By the end of this page you'll have the project running, your first gate lit up, and a map of where to go next.

---

## ⏱️ 60-second quick start

```bash
git clone https://github.com/aclarembeau/educom.git
cd educom
npm install
npm start          # opens an interactive circuit at http://localhost:8080
```

Open **http://localhost:8080**, flip the two switches, and watch the light turn on only when *both* are on. That's it — you're running real digital logic. The rest of this page explains what you're looking at and where to go next.

---

## 🧰 Prerequisites

You need three things:

- **[Node.js](https://nodejs.org/) >= 22.6.0** — educom runs on Node's native TypeScript support, so there's **no build step and no dependencies to compile**. Older versions of Node don't understand the TypeScript syntax and will fail.
- **A terminal** — to run a handful of `npm` commands.
- **A browser** — to see the interactive circuits.

Check your Node version:

```bash
node --version
```

If it prints `v22.6.0` or higher, you're good. If not, upgrade from [nodejs.org](https://nodejs.org/).

> 💡 **Using [nvm](https://github.com/nvm-sh/nvm)?** The repo ships an `.nvmrc`, so just run `nvm use` in the project folder to switch to the right Node version (or `nvm install 22 && nvm use` the first time).

---

## ⚡ Install

Clone the repo and install:

```bash
git clone git@github.com:aclarembeau/educom.git
# or over HTTPS:
git clone https://github.com/aclarembeau/educom.git

cd educom
npm install
```

`npm install` only pulls dev tooling (the TypeScript type-checker) — there's nothing to compile and no build to wait for.

---

## 🚀 Your first 5 minutes

Start the very first circuit:

```bash
npm start
```

`npm start` is a shortcut that serves lesson 0 — it's exactly the same as the explicit `npm run serve -- workbench/0-simple-and.compute`.

Now open **http://localhost:8080** in your browser.

You'll see two **switches** and one **light**. This circuit is an **AND** gate — but it's built from nothing but a single **NAND** gate (`AND` is just `NOT (NAND a b)`). Try it:

- Flip **one** switch on → the light stays **off**.
- Flip **both** switches on → the light turns **on**. 💡

That's real digital logic. The light only comes on when *both* inputs are on — the definition of AND — and every bit of it decomposes to NANDs underneath.

When you're done, **stop the server with `Ctrl+C`** in the terminal.

**Want a different lesson?** Stop the server and serve any other workbench file by name, for example:

```bash
npm run serve -- workbench/2-half-adder.compute
```

---

## 🖥️ How to read the interactive page

Each `.compute` file declares some on-screen controls. You'll meet:

- **Switches** — click to toggle a 1-bit input on/off.
- **LEDs** — lamps that show a 1-bit output.
- **7-segment displays** — show a group of bits as a single **hex digit** (great for reading a 4-bit number at a glance).
- **The code box** — a textarea for typing the CPU's program (appears on the later, program-running steps).
- **Clock controls** — **Step / Run / Reset** buttons for clocked circuits (counters, the CPU) that advance the clock and carry state forward.

The page **live-reloads when you save the file** — edit a gate, hit save, and the page updates instantly. Keep `serve` running while you experiment.

---

## 🛠️ The commands

Every command takes a `.compute` file. They all come straight from `package.json`:

| Command | What it does | Example |
|---------|--------------|---------|
| `npm start` | Shortcut: serve lesson 0 in the interactive web UI. | `npm start` |
| `npm run serve` | Launch the interactive web UI on any file (live-reloads on save). | `npm run serve -- workbench/0-simple-and.compute` |
| `npm run run` | Evaluate the circuit once. Set inputs with `--in`. | `npm run run -- workbench/2-half-adder.compute --in a=1,b=0` |
| `npm run tick` | Advance a clocked circuit; `--ticks N` for N ticks (default 16). | `npm run tick -- workbench/5-counter.compute --ticks 8` |
| `npm run table` | Print the full truth table over every input combination. | `npm run table -- workbench/2-half-adder.compute` |
| `npm run info` | Show ports and netlist stats (how many NAND gates). | `npm run info -- workbench/4-calculator.compute` |
| `npm test` | Run the unit tests. | `npm test` |
| `npm run typecheck` | Type-check the source with `tsc`. | `npm run typecheck` |

> 💡 The `--` before the file is needed so `npm` passes the rest of the arguments through to the tool.

---

## 🧗 Where to go next

The `workbench/` folder is a numbered staircase, and there's a lesson for every step. **Start at Lesson 0 and climb** — each step builds on the one before it.

▶️ **Start the course → [Lesson 0: The NAND Gate](docs/lessons/00-the-nand-gate.md)**

- 📚 **[The lessons index](docs/lessons/README.md)** — all 8 lessons at a glance.

Want the full language reference or to peek under the hood?

- 📖 **[The `.compute` language reference](docs/language.md)**
- ⚙️ **[How the simulator works](docs/how-it-works.md)**

---

## 🆘 Troubleshooting

**"command not found: npm"**
Node (which ships with `npm`) isn't installed yet. Install it from [nodejs.org](https://nodejs.org/) — make sure you get **>= 22.6.0** — then re-run the commands.

**"Unknown / unsupported TypeScript syntax" or strip-types errors**
Your Node is too old. educom needs **Node >= 22.6.0** for native TypeScript. Check with `node --version` and upgrade from [nodejs.org](https://nodejs.org/). With nvm, the quickest fix is:

```bash
nvm install 22 && nvm use
```

**"Port already in use" / `EADDRINUSE`**
Something is already on port 8080. Pick another one:

```bash
npm run serve -- workbench/0-simple-and.compute --port 8081
```

**The page isn't updating**
Make sure you actually **saved** the file, and that `serve` is still running in your terminal (no `Ctrl+C`). The page reloads on save — if `serve` has stopped, restart it.

Happy building! 🔩
