#!/usr/bin/env sh
# educom installer — clones educom and puts the `educom` command on your PATH.
#
#   curl -fsSL https://raw.githubusercontent.com/aclarembeau/educom/main/install.sh | sh
#
# Honours these environment variables (all optional):
#   EDUCOM_HOME   where to clone educom         (default: ~/.educom)
#   EDUCOM_BIN    where to link the launcher    (default: ~/.local/bin)
#   EDUCOM_REPO   git URL to clone from         (default: the public GitHub repo)
set -eu

REPO_URL="${EDUCOM_REPO:-https://github.com/aclarembeau/educom.git}"
EDUCOM_HOME="${EDUCOM_HOME:-$HOME/.educom}"
BIN_DIR="${EDUCOM_BIN:-$HOME/.local/bin}"

info() { printf '\033[1;36m==>\033[0m %s\n' "$1"; }
warn() { printf '\033[1;33mwarning:\033[0m %s\n' "$1" >&2; }
die()  { printf '\033[1;31merror:\033[0m %s\n' "$1" >&2; exit 1; }

command -v git >/dev/null 2>&1 || die "git is required but was not found. Install git, then re-run."

# educom needs Node >= 22.6.0 (it runs TypeScript natively). Warn, don't block.
if command -v node >/dev/null 2>&1; then
  NODE_V="$(node -v | sed 's/^v//')"
  MAJ="$(printf '%s' "$NODE_V" | cut -d. -f1)"
  MIN="$(printf '%s' "$NODE_V" | cut -d. -f2)"
  if [ "$MAJ" -lt 22 ] || { [ "$MAJ" -eq 22 ] && [ "$MIN" -lt 6 ]; }; then
    warn "Node $NODE_V found; educom needs >= 22.6.0. Upgrade at https://nodejs.org/"
  fi
else
  warn "Node.js not found. Install Node >= 22.6.0 (https://nodejs.org/) before running educom."
fi

# Clone fresh, or fast-forward an existing install.
if [ -d "$EDUCOM_HOME/.git" ]; then
  info "Updating educom in $EDUCOM_HOME"
  git -C "$EDUCOM_HOME" pull --ff-only --quiet
else
  info "Cloning educom into $EDUCOM_HOME"
  git clone --depth 1 --quiet "$REPO_URL" "$EDUCOM_HOME"
fi

# educom has zero runtime dependencies — nothing to npm-install. Just link it.
chmod +x "$EDUCOM_HOME/src/cli.ts"
mkdir -p "$BIN_DIR"
ln -sf "$EDUCOM_HOME/src/cli.ts" "$BIN_DIR/educom"
info "Linked $BIN_DIR/educom -> $EDUCOM_HOME/src/cli.ts"

# Make sure the launcher is reachable.
case ":${PATH}:" in
  *":$BIN_DIR:"*) : ;;
  *) warn "$BIN_DIR is not on your PATH. Add it to your shell profile, e.g.:
    export PATH=\"$BIN_DIR:\$PATH\"" ;;
esac

printf '\n'
info "Installed! 🎉  Build a computer from a single NAND gate:"
printf '    educom serve 0-simple-and.compute     # then open http://localhost:8080\n'
printf '    educom table 2-half-adder.compute      # a half adder, in your terminal\n'
printf '\n'
info "Start the course: $EDUCOM_HOME/docs/lessons/00-the-nand-gate.md"
