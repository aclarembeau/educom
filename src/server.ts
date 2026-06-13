import { createServer, type ServerResponse, type IncomingMessage } from "node:http";
import { readFileSync, watchFile } from "node:fs";
import { loadProgram } from "./loader.ts";
import { evaluate, flatten, tick, initialState, type Netlist } from "./simulator.ts";
import { parseUi, detectEntry, detectCode, type UiSpec } from "./ui.ts";
import { assemble } from "./asm.ts";
import type { Bit, GateDef, Program } from "./types.ts";
import { PAGE } from "./page.ts";

/** Everything derived from the current contents of the `.compute` file. */
interface Build {
  program: Program;
  net: Netlist;
  ui: UiSpec;
  entry: GateDef;
  config: unknown;
  version: number;
  // Live machine state (for sequential circuits) and loaded program (for ROM).
  simState: Int8Array;
  rom: number[];
  code: string;
  // Peripheral state: one accumulated framebuffer per screen, current key code.
  framebuffers: Int8Array[];
  key: number;
}

function build(file: string, entryOverride: string | undefined, version: number): Build {
  const source = readFileSync(file, "utf8");
  const entryName = entryOverride ?? detectEntry(source);
  // loadProgram resolves the file's `#% import` chain; UI/code directives below
  // are still read from this top-level file's source only.
  const program = loadProgram(file, entryName);
  const net = flatten(program);
  const ui = parseUi(source, program);
  const entry = program.gates.get(program.entry)!;
  const code = detectCode(source);
  const rom = net.roms.length ? assemble(code).words : [];
  const config = {
    entry: program.entry,
    title: ui.title,
    inputOrder: entry.inputs,
    ui,
    version,
    sequential: net.dffs.length > 0,
    hasCode: net.roms.length > 0,
    code,
    screens: net.screens.map((s, i) => ({
      pixels: 1 << s.addr.length,
      width: ui.screen?.width ?? 1 << Math.ceil(s.addr.length / 2),
      height: ui.screen?.height ?? 1 << Math.floor(s.addr.length / 2),
      index: i,
    })),
    keyboard: !!ui.keyboard,
  };
  const framebuffers = net.screens.map((s) => new Int8Array(1 << s.addr.length));
  return { program, net, ui, entry, config, version, simState: initialState(net), rom, code, framebuffers, key: 0 };
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let body = "";
    req.on("data", (c) => {
      body += c;
      if (body.length > 2_000_000) req.destroy();
    });
    req.on("end", () => resolve(body));
  });
}

const json = (res: ServerResponse, code: number, obj: unknown) => {
  res.writeHead(code, { "content-type": "application/json" });
  res.end(JSON.stringify(obj));
};

export function serve(file: string, port: number, entryOverride?: string): void {
  let state = build(file, entryOverride, 1);

  const clients = new Set<ServerResponse>();
  const broadcast = (event: object) => {
    const line = `data: ${JSON.stringify(event)}\n\n`;
    for (const res of clients) res.write(line);
  };

  // Read all current outputs into a {name: bit} map from a settled value buffer.
  const readOutputs = (values: Int8Array): Record<string, Bit> => {
    const out: Record<string, Bit> = {};
    state.entry.outputs.forEach((name, i) => {
      out[name] = values[state.net.outputs[i]!] as Bit;
    });
    return out;
  };

  // After a tick, commit any screen pixel writes (we==1) to the framebuffers.
  const commitScreens = (values: Int8Array) => {
    state.net.screens.forEach((s, si) => {
      if (values[s.we] !== 1) return;
      let addr = 0;
      for (let i = 0; i < s.addr.length; i++) addr |= values[s.addr[i]!]! << i;
      state.framebuffers[si]![addr] = values[s.data]! as Bit;
    });
  };
  const screenPayload = () => state.framebuffers.map((fb) => Array.from(fb));

  // Rebuild on file change; reset live state and reload open pages.
  watchFile(file, { interval: 200 }, () => {
    try {
      state = build(file, entryOverride, state.version + 1);
      console.log(`compute: reloaded '${file}' (v${state.version}, ${state.net.nands.length} NAND gates)`);
      broadcast({ type: "reload", version: state.version });
    } catch (e) {
      const message = (e as Error).message;
      console.error(`compute: reload failed — ${message}`);
      broadcast({ type: "error", message });
    }
  });

  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    const path = url.pathname;

    if (req.method === "GET" && path === "/") {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(PAGE);
      return;
    }

    if (req.method === "GET" && path === "/api/config") {
      json(res, 200, state.config);
      return;
    }

    if (req.method === "GET" && path === "/api/events") {
      res.writeHead(200, {
        "content-type": "text/event-stream",
        "cache-control": "no-cache",
        connection: "keep-alive",
      });
      res.write(`data: ${JSON.stringify({ type: "hello", version: state.version })}\n\n`);
      clients.add(res);
      req.on("close", () => clients.delete(res));
      return;
    }

    // Combinational evaluation: settle once with the given switch inputs and the
    // current register state (so a sequential circuit's outputs still display).
    if (req.method === "POST" && path === "/api/eval") {
      const { inputs = {} } = JSON.parse((await readBody(req)) || "{}") as { inputs?: Record<string, number> };
      try {
        const bits: Bit[] = state.entry.inputs.map((n) => (inputs[n] === 1 ? 1 : 0));
        const { values, settled } = evaluate(state.net, bits, {
          state: state.simState,
          rom: state.rom,
          key: state.key,
        });
        json(res, 200, { outputs: readOutputs(values), settled, screen: screenPayload(), version: state.version });
      } catch (e) {
        json(res, 400, { error: (e as Error).message });
      }
      return;
    }

    // Advance the clock by `ticks` steps; return outputs after the last tick.
    if (req.method === "POST" && path === "/api/tick") {
      const { inputs = {}, ticks = 1 } = JSON.parse((await readBody(req)) || "{}") as {
        inputs?: Record<string, number>;
        ticks?: number;
      };
      try {
        const bits: Bit[] = state.entry.inputs.map((n) => (inputs[n] === 1 ? 1 : 0));
        let values!: Int8Array;
        let settled = true;
        const n = Math.min(Math.max(1, ticks | 0), 100000);
        for (let i = 0; i < n; i++) {
          const r = tick(state.net, bits, state.simState, { rom: state.rom, key: state.key });
          state.simState = r.next;
          values = r.values;
          settled = r.settled;
          commitScreens(values);
        }
        json(res, 200, { outputs: readOutputs(values), settled, screen: screenPayload(), version: state.version });
      } catch (e) {
        json(res, 400, { error: (e as Error).message });
      }
      return;
    }

    // Set the current keyboard key code.
    if (req.method === "POST" && path === "/api/key") {
      const { key = 0 } = JSON.parse((await readBody(req)) || "{}") as { key?: number };
      state.key = key & 0xff;
      json(res, 200, { ok: true });
      return;
    }

    // Reset register state and screens to zero.
    if (req.method === "POST" && path === "/api/reset") {
      state.simState = initialState(state.net);
      state.framebuffers = state.net.screens.map((s) => new Int8Array(1 << s.addr.length));
      const bits: Bit[] = state.entry.inputs.map(() => 0);
      const { values } = evaluate(state.net, bits, { state: state.simState, rom: state.rom, key: state.key });
      json(res, 200, { outputs: readOutputs(values), screen: screenPayload(), version: state.version });
      return;
    }

    // Assemble a new program into the ROM and reset.
    if (req.method === "POST" && path === "/api/program") {
      const { code = "" } = JSON.parse((await readBody(req)) || "{}") as { code?: string };
      const { words, errors } = assemble(code);
      if (errors.length) {
        json(res, 200, { ok: false, errors });
        return;
      }
      state.rom = words;
      state.code = code;
      state.simState = initialState(state.net);
      console.log(`compute: loaded ${words.length}-instruction program`);
      json(res, 200, { ok: true, instructions: words.length });
      return;
    }

    res.writeHead(404, { "content-type": "text/plain" });
    res.end("not found");
  });

  server.listen(port, () => {
    const seq = state.net.dffs.length > 0 ? ` ${state.net.dffs.length} flip-flops` : "";
    const mem = state.net.roms.length > 0 ? ` ${state.net.roms.length} rom` : "";
    console.log(`compute: serving '${file}' (entry: ${state.program.entry})`);
    console.log(`  ${state.net.nands.length} NAND gates${seq}${mem}`);
    console.log(`  live-reload on; edit the file and the page refreshes`);
    console.log(`  open  http://localhost:${port}`);
  });
}
