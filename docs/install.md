# 🌍 Install educom globally

You don't *need* to install anything — cloning the repo and running `npm start`
(see [GETTING_STARTED.md](../GETTING_STARTED.md)) is the simplest path. But if you
want an `educom` command available from any folder, here are your options, from
"try it once" to "install it for keeps".

> **Prerequisite for all methods:** [Node.js](https://nodejs.org/) **>= 22.6.0**
> (educom runs TypeScript natively — there is no build step and zero runtime
> dependencies). Check yours with `node --version`.

The bundled lessons resolve **by name from anywhere** once educom is on your
PATH — so `educom serve 0-simple-and.compute` works in any directory. You can
also pass a path to your own `.compute` file.

---

## ⚡ Try it without installing — `npx`

`npx` downloads and runs educom straight from GitHub, no install:

```bash
# print the help
npx github:aclarembeau/educom --help

# a half adder's truth table, right in your terminal
npx github:aclarembeau/educom table 2-half-adder.compute

# launch the interactive web UI, then open http://localhost:8080
npx github:aclarembeau/educom serve 0-simple-and.compute
```

The first run fetches the repo (a few seconds); later runs are cached.

---

## 🌀 One-line install — `curl`

Clone educom and put the `educom` command on your PATH in one go:

```bash
curl -fsSL https://raw.githubusercontent.com/aclarembeau/educom/main/install.sh | sh
```

What it does (it's a short, readable [`install.sh`](../install.sh) — feel free to
read it first):

- clones educom into `~/.educom`
- links a launcher at `~/.local/bin/educom`
- prints a PATH hint if `~/.local/bin` isn't already on your `PATH`

You can override the locations:

```bash
EDUCOM_HOME=~/code/educom EDUCOM_BIN=~/bin \
  sh -c "$(curl -fsSL https://raw.githubusercontent.com/aclarembeau/educom/main/install.sh)"
```

Then:

```bash
educom serve 0-simple-and.compute     # http://localhost:8080
educom tick  5-counter.compute --ticks 20
```

To **update** later, just run the same curl command again (it fast-forwards).

---

## 📦 Install with `npm -g`

```bash
npm install -g github:aclarembeau/educom
educom --help
```

Uninstall with `npm uninstall -g educom`.

---

## 🛠️ From source (for contributors)

```bash
git clone https://github.com/aclarembeau/educom.git
cd educom
npm install        # dev tooling only (TypeScript types); educom itself needs no deps
npm link           # makes `educom` point at your working copy
```

Now edits to your clone are reflected immediately. See
[CONTRIBUTING.md](../CONTRIBUTING.md).

---

## 🪟 A note on Windows

Global installs (`curl`, `npm -g`, `npx`) rely on a Unix-style shebang to run
educom's native TypeScript, so they work best on **macOS and Linux** (and on
Windows via **WSL**). On plain Windows, the friction-free route is to clone the
repo and use the `npm run …` scripts (`npm start`, `npm run table -- <file>`,
etc.) from [GETTING_STARTED.md](../GETTING_STARTED.md).

---

## ▶️ What you can run

Once `educom` is on your PATH, every subcommand works on a bundled lesson name
or your own file:

```bash
educom serve <file>   # interactive web UI (live-reloads on save)
educom run   <file>   # evaluate the circuit once   (--in a=1,b=0)
educom tick  <file>   # advance a clocked circuit    (--ticks N)
educom table <file>   # full truth table
educom info  <file>   # netlist stats (how many NAND gates?)
educom --help         # all commands and flags
```

Bundled lessons: `0-simple-and.compute`, `1-basic-gates.compute`,
`2-half-adder.compute`, `3-adder.compute`, `4-calculator.compute`,
`5-counter.compute`, `6-cpu.compute`, `7-computer.compute`.

---

## 🧹 Uninstall

- Installed with **curl**: `rm -rf ~/.educom ~/.local/bin/educom` (adjust if you
  set `EDUCOM_HOME` / `EDUCOM_BIN`).
- Installed with **npm**: `npm uninstall -g educom`.

---

**🧭** [← Getting started](../GETTING_STARTED.md) · [Start the course →](lessons/00-the-nand-gate.md) · [Home](../README.md)
