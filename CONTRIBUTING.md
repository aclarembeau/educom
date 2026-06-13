# Contributing to educom

First off — thank you for taking the time to contribute! 🎉 educom is an
educational project, and that means contributions of every size are valuable,
whether you're fixing a typo, clarifying a lesson, or adding a whole new chunk
of hardware.

**New to open source? You're especially welcome here.** This project is a great
place to make your first contribution. If anything below is unclear, open an
issue and ask — friendly questions are always fine.

## 🛠️ Setting up locally

educom has **no build step** and **no runtime dependencies**. It runs directly
on Node.js 22's native TypeScript stripping, so setup is quick:

```bash
# 1. Make sure you have Node.js 22.6.0 or newer
node --version

# 2. Install dev dependencies (just TypeScript + type definitions)
npm install

# 3. Run the test suite
npm test

# 4. Type-check the project
npm run typecheck
```

If `npm test` and `npm run typecheck` both pass, you're ready to go.

## 🗂️ Project layout

A quick map of the repository so you know where things live:

- **`src/`** — the simulator engine: the code that parses `.compute` files,
  wires gates together, and ticks the simulation.
- **`workbench/`** — the `.compute` hardware lessons: the gates and components
  that learners build up, from a single NAND gate all the way to a CPU.
- **`test/`** — unit tests for the engine.
- **`docs/`** — written lessons and explanations: the [lessons](docs/lessons/README.md),
  the [`.compute` language reference](docs/language.md), and a [how-it-works](docs/how-it-works.md) tour.

## 📚 Adding or improving a lesson

Lessons are the heart of educom. To work on one:

1. Hardware components live in `workbench/` as `.compute` files. To add a new
   component, create a new `.compute` file describing it, and (where it makes
   sense) build it out of the simpler gates that already exist — that's the
   spirit of the project.
2. Written explanations go in `docs/`. Keep them clear and beginner-friendly:
   assume the reader knows the previous lesson but nothing beyond it.
3. Test your component before submitting. Use the CLI to inspect and run it,
   for example:

   ```bash
   npm run info -- workbench/your-component.compute
   npm run table -- workbench/your-component.compute
   ```

If you're improving an existing lesson, small clarity fixes are hugely
appreciated — confusing wording is a real bug in an educational project.

## ✨ Code style

- **Match the existing code.** Follow the conventions you see in the
  surrounding files for naming, formatting, and structure.
- **No new dependencies.** A core goal of educom is to stay dependency-free and
  build-free. Please don't add runtime or build dependencies. If you think a new
  dependency is truly necessary, open an issue to discuss it first.
- Keep changes focused — one logical change per pull request is easiest to
  review.

## 🔀 Proposing changes

We use the standard fork-and-pull-request workflow:

1. **Fork** the repository to your own GitHub account.
2. **Create a branch** for your change:
   ```bash
   git checkout -b my-improvement
   ```
3. Make your change, then make sure `npm test` and `npm run typecheck` pass.
4. **Commit** with a clear message describing what and why.
5. **Open a pull request** against the main repository. Describe what you
   changed and, if it's a lesson, what a learner gets out of it.

Don't worry about getting everything perfect on the first try — that's what
review is for. We're happy to help you polish your contribution.

## 💛 A warm welcome

Beginners and first-time contributors are explicitly welcome. If you've never
opened a pull request before, this is a friendly place to start. Be kind, be
curious, and have fun building a computer from a single NAND gate up.

Happy hacking! 🚀
