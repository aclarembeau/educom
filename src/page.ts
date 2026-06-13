// The single-page UI served at `/`. Plain HTML/CSS/JS — no build step, no deps.
// It fetches `/api/config`, renders the native I/O elements (switches, 7-seg
// displays, LEDs) declared by the program, and POSTs switch state to
// `/api/eval` on every change, updating outputs from the server's response.

export const PAGE = String.raw`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>compute</title>
<style>
  :root { --bg:#0e1116; --panel:#161b22; --edge:#2b333d; --txt:#d6dee8; --dim:#7d8896;
          --accent:#4cc2ff; --on:#ff5b4a; --led:#36e06a; }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--bg); color:var(--txt);
         font:15px/1.5 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace; }
  header { padding:22px 28px; border-bottom:1px solid var(--edge); }
  header h1 { margin:0; font-size:20px; letter-spacing:.5px; }
  header .sub { color:var(--dim); font-size:13px; margin-top:4px; }
  main { display:flex; flex-wrap:wrap; gap:24px; padding:28px; align-items:flex-start; }
  .panel { background:var(--panel); border:1px solid var(--edge); border-radius:12px; padding:20px 22px; }
  .panel h2 { margin:0 0 16px; font-size:12px; text-transform:uppercase; letter-spacing:1.5px; color:var(--dim); }
  .row { display:flex; flex-wrap:wrap; gap:14px; }
  /* switch */
  .sw { display:flex; flex-direction:column; align-items:center; gap:8px; width:70px; }
  .sw .track { width:46px; height:74px; border-radius:10px; background:#0a0d12;
               border:1px solid var(--edge); position:relative; cursor:pointer; transition:.12s; }
  .sw .knob { position:absolute; left:5px; right:5px; height:32px; border-radius:7px;
              background:#3a4350; top:37px; transition:top .12s, background .12s; }
  .sw.on .track { border-color:var(--accent); box-shadow:0 0 0 1px var(--accent) inset; }
  .sw.on .knob { top:5px; background:var(--accent); }
  .sw .lbl { font-size:12px; color:var(--dim); text-align:center; }
  .sw .bit { font-size:12px; color:var(--txt); }
  /* led */
  .led { display:flex; flex-direction:column; align-items:center; gap:8px; width:70px; }
  .led .lamp { width:30px; height:30px; border-radius:50%; background:#10241a;
               border:1px solid var(--edge); transition:.1s; }
  .led.on .lamp { background:var(--led); box-shadow:0 0 14px var(--led); }
  .led .lbl { font-size:12px; color:var(--dim); text-align:center; }
  /* seg7 */
  .display { display:flex; flex-direction:column; align-items:center; gap:8px; }
  .digits { display:flex; gap:8px; padding:14px 16px; background:#07090d;
            border:1px solid var(--edge); border-radius:10px; }
  .seg { fill:#1a1f27; transition:fill .08s; }
  .seg.on { fill:var(--on); filter:drop-shadow(0 0 4px rgba(255,91,74,.6)); }
  .display .val { font-size:13px; color:var(--dim); }
  .display .lbl { font-size:12px; color:var(--dim); }
  footer { padding:14px 28px; color:var(--dim); font-size:12px; border-top:1px solid var(--edge); }
  .warn { color:#ffb454; }
  .err  { color:#ff6b6b; }
  /* machine controls */
  .ctl { display:flex; gap:10px; align-items:center; flex-wrap:wrap; }
  button { font:inherit; font-size:13px; color:var(--txt); background:#212a35; cursor:pointer;
           border:1px solid var(--edge); border-radius:8px; padding:8px 14px; transition:.1s; }
  button:hover { border-color:var(--accent); }
  button.primary { background:var(--accent); color:#05121b; border-color:var(--accent); font-weight:600; }
  button.run.active { background:var(--on); border-color:var(--on); color:#1a0603; }
  .meta { color:var(--dim); font-size:12px; }
  .meta b { color:var(--txt); }
  /* code panel */
  #codePanel { flex:1 1 320px; min-width:300px; }
  textarea { width:100%; min-height:230px; resize:vertical; tab-size:2;
             font:13px/1.5 ui-monospace,Menlo,Consolas,monospace; color:var(--txt);
             background:#07090d; border:1px solid var(--edge); border-radius:8px; padding:12px; }
  #asmStatus { margin-top:8px; font-size:12px; white-space:pre-wrap; }
  .hidden { display:none; }
  /* screen + keyboard */
  #screenCanvas { image-rendering:pixelated; background:#04140a; border:1px solid var(--edge);
                  border-radius:6px; display:block; }
  #kbd { margin-top:12px; font-size:12px; color:var(--dim); }
  #kbd.live { color:var(--led); }
  #kbd b { color:var(--txt); }
</style>
</head>
<body>
<header>
  <h1 id="title">compute</h1>
  <div class="sub" id="sub"></div>
</header>
<main>
  <div class="panel hidden" id="clockPanel">
    <h2>Clock</h2>
    <div class="ctl">
      <button id="btnReset">Reset</button>
      <button id="btnStep" class="primary">Step ▸</button>
      <button id="btnStep8">Step ×8</button>
      <button id="btnRun" class="run">Run ▶</button>
      <span class="meta">tick <b id="tickCount">0</b></span>
    </div>
  </div>
  <div class="panel hidden" id="codePanel">
    <h2>Program</h2>
    <textarea id="code" spellcheck="false"></textarea>
    <div class="ctl" style="margin-top:10px">
      <button id="btnLoad" class="primary">Assemble &amp; Load</button>
      <span class="meta">edits load into the ROM, then Reset/Step to run</span>
    </div>
    <div id="asmStatus"></div>
  </div>
  <div class="panel hidden" id="screenPanel">
    <h2>Screen</h2>
    <canvas id="screenCanvas" width="256" height="256"></canvas>
    <div id="kbd" class="hidden">keyboard: click here / the screen, then press a key — <b id="kbdKey">—</b></div>
  </div>
  <div class="panel hidden" id="inputs"><h2>Inputs</h2><div class="row" id="switches"></div></div>
  <div class="panel" id="outputs"><h2>Outputs</h2><div class="row" id="devices"></div></div>
</main>
<footer id="status">loading…</footer>

<script>
// Hex digit -> lit segments. Segment ids: a top, b top-right, c bottom-right,
// d bottom, e bottom-left, f top-left, g middle.
const SEGMAP = {
  0:"abcdef",1:"bc",2:"abdeg",3:"abcdg",4:"bcfg",5:"acdfg",6:"acdefg",7:"abc",
  8:"abcdefg",9:"abcdfg",10:"abcefg",11:"cdefg",12:"adef",13:"bcdeg",14:"adefg",15:"aefg"
};
// Rectangle geometry for each segment in a 100x160 viewBox.
const SEGPOS = {
  a:[20,8,60,12], g:[20,74,60,12], d:[20,140,60,12],
  f:[12,16,12,60], b:[76,16,12,60], e:[12,82,12,60], c:[76,82,12,60]
};

function digitSvg() {
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", "0 0 100 160");
  svg.setAttribute("width", "44"); svg.setAttribute("height", "70");
  const segs = {};
  for (const [id, [x,y,w,h]] of Object.entries(SEGPOS)) {
    const r = document.createElementNS(ns, "rect");
    r.setAttribute("x",x); r.setAttribute("y",y); r.setAttribute("width",w);
    r.setAttribute("height",h); r.setAttribute("rx",3);
    r.setAttribute("class","seg"); svg.appendChild(r); segs[id]=r;
  }
  return { svg, segs };
}

function setDigit(segs, value) {
  const lit = (value >= 0 && value <= 15) ? SEGMAP[value] : "";
  for (const [id, rect] of Object.entries(segs))
    rect.classList.toggle("on", lit.includes(id));
}

let CONFIG, state = {}, devices = [];

function makeSwitch(el) {
  state[el.wire] = 0;
  const box = document.createElement("div");
  box.className = "sw";
  box.innerHTML =
    '<div class="track"><div class="knob"></div></div>' +
    '<div class="lbl">'+el.label+'</div><div class="bit">0</div>';
  const bit = box.querySelector(".bit");
  box.querySelector(".track").addEventListener("click", () => {
    state[el.wire] = state[el.wire] ? 0 : 1;
    box.classList.toggle("on", !!state[el.wire]);
    bit.textContent = state[el.wire];
    evaluate();
  });
  return box;
}

function makeLed(el) {
  const box = document.createElement("div");
  box.className = "led";
  box.innerHTML = '<div class="lamp"></div><div class="lbl">'+el.label+'</div>';
  devices.push({ el, apply: (out) => box.classList.toggle("on", out[el.wire] === 1) });
  return box;
}

function makeSeg7(el) {
  const box = document.createElement("div");
  box.className = "display";
  const digits = document.createElement("div");
  digits.className = "digits";
  const nDigits = Math.max(1, Math.ceil(el.wires.length / 4));
  const ds = [];
  for (let i = 0; i < nDigits; i++) { const d = digitSvg(); digits.appendChild(d.svg); ds.push(d.segs); }
  const val = document.createElement("div"); val.className = "val"; val.textContent = "0";
  const lbl = document.createElement("div"); lbl.className = "lbl"; lbl.textContent = el.label;
  box.append(digits, val, lbl);
  devices.push({ el, apply: (out) => {
    // wires are most-significant bit first.
    let n = 0;
    for (const w of el.wires) n = (n << 1) | (out[w] === 1 ? 1 : 0);
    val.textContent = n + " (0x" + n.toString(16).toUpperCase() + ")";
    for (let i = 0; i < nDigits; i++) {
      const nibble = (n >> ((nDigits - 1 - i) * 4)) & 0xF;
      setDigit(ds[i], nibble);
    }
  }});
  return box;
}

let tickN = 0;
let screenCtx = null, screenInfo = null;

function renderScreen(frames) {
  if (!screenCtx || !screenInfo || !frames || !frames[0]) return;
  const { width, height } = screenInfo;
  const scale = Math.floor(256 / Math.max(width, height));
  const fb = frames[0];
  screenCtx.fillStyle = "#04140a";
  screenCtx.fillRect(0, 0, 256, 256);
  screenCtx.fillStyle = "#36e06a";
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++)
      if (fb[y * width + x]) screenCtx.fillRect(x * scale, y * scale, scale - 1, scale - 1);
}

function applyResult(data) {
  if (data.error) { status.innerHTML = '<span class="err">error: '+data.error+'</span>'; return false; }
  for (const d of devices) d.apply(data.outputs);
  if (data.screen) renderScreen(data.screen);
  const bits = Object.entries(state).map(([k,v]) => k+"="+v).join(" ");
  status.innerHTML = (data.settled === false ? '<span class="warn">unstable</span>' : "settled")
    + " &nbsp; tick " + tickN + (bits ? " &nbsp; inputs: " + bits : "");
  return true;
}

async function post(path, body) {
  const r = await fetch(path, { method:"POST", headers:{"content-type":"application/json"},
    body: JSON.stringify(body||{}) });
  return r.json();
}

// Settle and show current outputs WITHOUT advancing the clock.
async function evaluate() { applyResult(await post("/api/eval", { inputs: state })); }

async function doStep(n) {
  const data = await post("/api/tick", { inputs: state, ticks: n||1 });
  tickN += n||1; document.getElementById("tickCount").textContent = tickN;
  applyResult(data);
}

async function doReset() {
  stopRun();
  const data = await post("/api/reset", {});
  tickN = 0; document.getElementById("tickCount").textContent = 0;
  applyResult(data);
}

let runTimer = null;
function stopRun() {
  if (runTimer) { clearInterval(runTimer); runTimer = null; }
  const b = document.getElementById("btnRun");
  if (b) { b.classList.remove("active"); b.textContent = "Run ▶"; }
}
function toggleRun() {
  if (runTimer) { stopRun(); return; }
  const b = document.getElementById("btnRun");
  b.classList.add("active"); b.textContent = "Stop ■";
  runTimer = setInterval(() => doStep(1), 90);
}

async function loadProgram() {
  stopRun();
  const code = document.getElementById("code").value;
  const st = document.getElementById("asmStatus");
  const data = await post("/api/program", { code });
  if (!data.ok) {
    st.className = "err";
    st.textContent = (data.errors||[]).map(e => "line "+e.line+": "+e.message).join("\n") || "assembly failed";
    return;
  }
  st.className = "meta";
  st.textContent = "loaded " + data.instructions + " instructions";
  await doReset();
}

// Live reload: the server pushes a "reload" event whenever the .compute file
// changes (or an "error" event if it no longer parses).
function liveReload() {
  const es = new EventSource("/api/events");
  let known = null;
  es.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.type === "hello") { if (known === null) known = m.version; else if (m.version !== known) location.reload(); }
    else if (m.type === "reload") location.reload();
    else if (m.type === "error") {
      status.innerHTML = '<span class="warn">file error: ' + m.message + ' (fix it; the page will refresh)</span>';
    }
  };
  // If the connection drops (server restart), reconnect and reload on recovery.
  es.onerror = () => {};
}

const status = document.getElementById("status");
(async function init() {
  CONFIG = await (await fetch("/api/config")).json();
  document.getElementById("title").textContent = CONFIG.title;
  document.title = CONFIG.title;

  // Inputs (switches) — only shown when the circuit has any.
  const sw = document.getElementById("switches");
  for (const el of CONFIG.ui.inputs) sw.appendChild(makeSwitch(el));
  if (CONFIG.ui.inputs.length) document.getElementById("inputs").classList.remove("hidden");

  // Output devices.
  const dev = document.getElementById("devices");
  for (const el of CONFIG.ui.outputs)
    dev.appendChild(el.kind === "seg7" ? makeSeg7(el) : makeLed(el));

  // Sequential circuits get clock controls.
  let hint = "toggle switches to drive the circuit";
  if (CONFIG.sequential) {
    document.getElementById("clockPanel").classList.remove("hidden");
    document.getElementById("btnReset").onclick = doReset;
    document.getElementById("btnStep").onclick = () => doStep(1);
    document.getElementById("btnStep8").onclick = () => doStep(8);
    document.getElementById("btnRun").onclick = toggleRun;
    hint = "Step / Run the clock to advance the machine";
  }

  // Programs (ROM) get a code textarea + assembler.
  if (CONFIG.hasCode) {
    document.getElementById("codePanel").classList.remove("hidden");
    document.getElementById("code").value = CONFIG.code || "";
    document.getElementById("btnLoad").onclick = loadProgram;
    hint = "edit the program, Assemble &amp; Load, then Step / Run";
  }

  // Screen (pixel display) + keyboard capture.
  if (CONFIG.screens && CONFIG.screens.length) {
    document.getElementById("screenPanel").classList.remove("hidden");
    screenInfo = CONFIG.screens[0];
    screenCtx = document.getElementById("screenCanvas").getContext("2d");
    renderScreen([new Array(screenInfo.pixels).fill(0)]);
  }
  if (CONFIG.keyboard) {
    const kbd = document.getElementById("kbd");
    kbd.classList.remove("hidden");
    const keyEl = document.getElementById("kbdKey");
    const sendKey = (key, label) => {
      fetch("/api/key", { method:"POST", headers:{"content-type":"application/json"},
        body: JSON.stringify({ key }) });
      keyEl.textContent = label;
      kbd.classList.toggle("live", key !== 0);
    };
    window.addEventListener("keydown", (e) => {
      if (e.target && e.target.tagName === "TEXTAREA") return; // don't steal code edits
      const code = e.key.length === 1 ? e.key.charCodeAt(0) : 0;
      if (code) { sendKey(code & 0xff, e.key + " (" + code + ")"); e.preventDefault(); }
    });
    window.addEventListener("keyup", (e) => {
      if (e.target && e.target.tagName === "TEXTAREA") return;
      sendKey(0, "—");
    });
    hint = "Run the machine; click here then press keys (INK reads them)";
  }
  document.getElementById("sub").innerHTML = "entry: " + CONFIG.entry + " — " + hint;

  evaluate();
  liveReload();
})();
</script>
</body>
</html>`;
