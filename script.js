const C = {
  bg: "#071722", grid: "#102b38", card: "#0e222f",
  green: "#54e3a0", yellow: "#f4c45e", red: "#ff6268",
  cyan: "#66c6e8", blue: "#2088f7"
};

const joints = Array.from({length: 15}, (_, i) => `J-${String(i + 1).padStart(2, "0")}`);
const sections = Array.from({length: 20}, (_, i) => `B-${String(i + 1).padStart(2, "0")}`);

const state = {
  running: false, elapsed: 0, tick: 0, phase: 0,
  mode: "AUTO", fault: "normal", faultAge: 0,
  location: joints[Math.floor(Math.random() * joints.length)],
  targetLocation: "",
  nextEventTick: 16,
  sensor: { vibration: 2.2, temperature: 48, acoustic: 56, load: 61, speed: 2.8, current: 67 },
  base: { vibration: 2.2, temperature: 48, acoustic: 56, load: 61, speed: 2.8, current: 67 },
  health: 97, risk: 3, confidence: 94,
  cameraState: "NORMAL OPERATION", visionConf: 97,
  maintenance: "Routine monitoring", plcStatus: "RUNNING", plcAlarm: "NONE",
  dspFeature: "Stable spectrum", dspFrequency: 48, dspRms: 2.2,
  aiClass: "HEALTHY", remainingWindow: "Continuous operation",
  history: { vibration: [], temperature: [], acoustic: [], load: [] },
  maxHistory: 90,
  events: []
};

const twin = document.getElementById("twinCanvas");
const graph = document.getElementById("graphCanvas");
const tctx = twin.getContext("2d");
const gctx = graph.getContext("2d");

const $ = id => document.getElementById(id);

function rand(a, b) { return a + Math.random() * (b - a); }
function choice(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function statusColor() {
  return state.risk >= 75 ? C.red : state.risk >= 30 ? C.yellow : C.green;
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `MISSION ${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function logEvent(message, level = "info") {
  const m = Math.floor(state.elapsed / 60);
  const s = Math.floor(state.elapsed % 60);
  state.events.unshift({time: `${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`, message, level});
  state.events = state.events.slice(0, 80);
  renderLog();
}

function renderLog() {
  $("eventLog").innerHTML = state.events.map(e =>
    `<div class="event ${e.level}">[${e.time}] ${e.message}</div>`
  ).join("");
}

function resetBaseline() {
  state.fault = "normal";
  state.faultAge = 0;
  state.sensor = {...state.base};
  state.location = choice(joints);
  state.targetLocation = state.location;
  state.nextEventTick = state.tick + Math.floor(rand(14, 29));
  state.health = 97; state.risk = 3; state.confidence = 94;
  state.cameraState = "NORMAL OPERATION";
  state.visionConf = 97;
  state.maintenance = "Routine monitoring";
  state.plcStatus = "RUNNING"; state.plcAlarm = "NONE";
  state.dspFeature = "Stable spectrum"; state.dspFrequency = 48;
  state.aiClass = "HEALTHY"; state.remainingWindow = "Continuous operation";
  state.phase = 0;
  Object.keys(state.history).forEach(k => {
    state.history[k] = Array.from({length: 40}, () => state.sensor[k]);
  });
}

function startFault(fault) {
  state.fault = fault;
  state.faultAge = 0;
  state.targetLocation = choice(fault === "degradation" ? joints : sections);
  state.location = state.targetLocation;

  const names = {
    misalignment: "Early belt tracking deviation detected.",
    degradation: "Acoustic + vibration anomaly detected near a belt joint.",
    overload: "Load/tension trend exceeded the normal operating band."
  };
  logEvent(names[fault], "warn");
  logEvent(`RFID/encoder → suspicious location ${state.location}.`, "info");
}

function recover() {
  logEvent("Maintenance action accepted. System returning toward baseline.", "info");
  state.fault = "normal";
  state.faultAge = 0;
  state.nextEventTick = state.tick + Math.floor(rand(14, 29));
  state.plcStatus = "RUNNING"; state.plcAlarm = "NONE";
}

function progressFault() {
  const a = state.faultAge;
  const s = state.sensor;

  if (state.fault === "misalignment") {
    s.vibration += 0.055 + a * 0.004; s.temperature += 0.045;
    s.acoustic += 0.11; s.load += 0.16; s.current += 0.12;
    if (a > 25) {
      state.fault = "degradation"; state.faultAge = 0; state.location = choice(joints);
      logEvent("AI fusion: misalignment is progressing into joint degradation.", "warn");
    }
  } else if (state.fault === "degradation") {
    s.vibration += 0.105 + a * 0.008; s.temperature += 0.13;
    s.acoustic += 0.42; s.load += 0.24; s.current += 0.27;
    if (a > 32) {
      if (Math.random() < 0.70) {
        state.fault = "tear"; state.faultAge = 0;
        logEvent("Vision confirmation: belt tear risk has become critical.", "crit");
      } else recover();
    }
  } else if (state.fault === "overload") {
    s.load += 0.28; s.current += 0.38; s.temperature += 0.10; s.vibration += 0.08;
    if (a > 25) {
      if (Math.random() < 0.55) {
        state.fault = "tear"; state.faultAge = 0;
        logEvent("High-tension event escalated to belt damage.", "crit");
      } else recover();
    }
  } else if (state.fault === "tear") {
    s.vibration += 0.17; s.temperature += 0.19; s.acoustic += 0.68;
    s.load += 0.11; s.current += 0.25; s.speed -= 0.018;
    if (a > 19) {
      state.fault = "rupture"; state.faultAge = 0;
      logEvent("CRITICAL: joint/belt rupture condition simulated.", "crit");
    }
  } else if (state.fault === "rupture") {
    s.vibration += 0.22; s.temperature += 0.08; s.acoustic += 0.75;
    s.load -= 0.45; s.speed -= 0.14; s.current += 0.18;
    if (a > 16) {
      logEvent("PLC/SCADA: emergency stop recommendation active.", "crit");
      state.plcStatus = "EMERGENCY STOP";
      state.plcAlarm = "JOINT RUPTURE RISK";
      state.running = false;
      $("runBtn").textContent = "▶ RESUME";
      $("simStatus").textContent = "● CONVEYOR STOPPED";
      $("simStatus").className = "sim-status critical";
    }
  }
}

function clampCompute() {
  const lim = {
    vibration: [1.4,22], temperature:[42,90], acoustic:[48,115],
    load:[40,100], speed:[0,3], current:[50,125]
  };
  for (const k in lim) state.sensor[k] = clamp(state.sensor[k], ...lim[k]);

  if (state.fault === "normal") {
    for (const k in state.sensor) state.sensor[k] += (state.base[k] - state.sensor[k]) * 0.035;
    state.cameraState = "NORMAL OPERATION";
    state.maintenance = "Routine monitoring";
  } else if (state.fault === "misalignment") {
    state.cameraState = "EDGE MISALIGNMENT"; state.maintenance = "Inspect tracking / idlers";
  } else if (state.fault === "degradation") {
    state.cameraState = "JOINT DEGRADATION"; state.maintenance = "Schedule joint inspection";
  } else if (state.fault === "overload") {
    state.cameraState = "OVERLOAD SIGNATURE"; state.maintenance = "Reduce load and inspect belt";
  } else if (state.fault === "tear") {
    state.cameraState = "BELT TEAR"; state.maintenance = "Stop conveyor and isolate section";
  } else if (state.fault === "rupture") {
    state.cameraState = "JOINT RUPTURE"; state.maintenance = "EMERGENCY STOP • Inspect joint";
  }

  const v = Math.max(0, (state.sensor.vibration - 2) / 18);
  const t = Math.max(0, (state.sensor.temperature - 48) / 42);
  const a = Math.max(0, (state.sensor.acoustic - 55) / 60);
  const l = Math.max(0, (state.sensor.load - 60) / 40);
  const c = Math.max(0, (state.sensor.current - 65) / 60);
  const offsets = {misalignment:8, degradation:18, overload:14, tear:25, rupture:42};

  state.risk = clamp(100 * (0.27*v + 0.18*t + 0.22*a + 0.18*l + 0.15*c) + (offsets[state.fault] || 0), 1, 99);
  state.health = Math.max(5, 100 - state.risk * 0.92);
  state.confidence = Math.min(99, 89 + state.risk * 0.10);

  if (state.risk >= 90) { state.plcStatus = "EMERGENCY"; state.plcAlarm = "CRITICAL BELT CONDITION"; }
  else if (state.risk >= 70) { state.plcStatus = "CONTROLLED"; state.plcAlarm = "CRITICAL"; }
  else if (state.risk >= 30) { state.plcStatus = "RUNNING"; state.plcAlarm = "WARNING"; }
  else { state.plcStatus = "RUNNING"; state.plcAlarm = "NONE"; }
}

function updateDSPAI() {
  state.dspRms = state.sensor.vibration;
  state.dspFrequency = 42 + state.sensor.vibration * 2.7 + rand(-1.5,1.5);

  if (state.risk < 20) {
    state.dspFeature="Stable spectrum"; state.aiClass="HEALTHY"; state.visionConf=97; state.remainingWindow="Continuous operation";
  } else if (state.risk < 45) {
    state.dspFeature="Minor spectral deviation"; state.aiClass="EARLY ANOMALY"; state.visionConf=91; state.remainingWindow="Monitor trend";
  } else if (state.risk < 70) {
    state.dspFeature="Joint-frequency anomaly"; state.aiClass="WARNING"; state.visionConf=93; state.remainingWindow="Inspect during next planned stop";
  } else if (state.risk < 90) {
    state.dspFeature="High-energy fault signature"; state.aiClass="CRITICAL"; state.visionConf=95; state.remainingWindow="Immediate controlled intervention";
  } else {
    state.dspFeature="Rupture signature"; state.aiClass="JOINT RUPTURE"; state.visionConf=98; state.remainingWindow="STOP CONVEYOR NOW";
  }
}

function recordHistory() {
  for (const k of Object.keys(state.history)) {
    state.history[k].push(state.sensor[k]);
    if (state.history[k].length > state.maxHistory) state.history[k].shift();
  }
}

function autoEvolve() {
  const s = state.sensor;
  s.vibration += rand(-.12,.12); s.temperature += rand(-.28,.28);
  s.acoustic += rand(-.8,.8); s.load += rand(-1.2,1.2);
  s.speed += rand(-.018,.018); s.current += rand(-1.2,1.2);

  if (state.tick % 5 === 0) state.location = Math.random() < .55 ? choice(joints) : choice(sections);

  if (state.fault === "normal" && state.tick >= state.nextEventTick) {
    const r = Math.random();
    const event = r < .30 ? "misalignment" : r < .65 ? "degradation" : r < .85 ? "overload" : "normal";
    if (event === "normal") state.nextEventTick = state.tick + Math.floor(rand(12,25));
    else startFault(event);
  }
  if (state.fault !== "normal") { state.faultAge++; progressFault(); }
  clampCompute();
}

function manualEvolve() {
  const s = state.sensor;
  s.vibration += rand(-.08,.08); s.temperature += rand(-.18,.18);
  s.acoustic += rand(-.65,.65); s.load += rand(-.9,.9); s.current += rand(-.8,.8);
  if (state.fault !== "normal") { state.faultAge++; progressFault(); }
  clampCompute();
}

function tick() {
  if (!state.running) return;
  state.tick++;
  state.elapsed += .65;

  const factor = state.risk >= 92 ? .08 : state.risk >= 70 ? .42 : 1;
  state.phase = (state.phase + state.sensor.speed * .055 * factor) % 1;

  state.mode === "AUTO" ? autoEvolve() : manualEvolve();
  updateDSPAI(); recordHistory(); refresh(); drawTwin(); drawGraph();

  if (state.tick % 8 === 0) {
    logEvent(
      `Telemetry → VIB ${state.sensor.vibration.toFixed(1)} mm/s | TEMP ${state.sensor.temperature.toFixed(0)}°C | LOAD ${state.sensor.load.toFixed(0)}% | RISK ${state.risk.toFixed(0)}%`,
      state.risk >= 75 ? "crit" : state.risk >= 30 ? "warn" : "info"
    );
  }
}

function refresh() {
  const color = statusColor();
  const stateClass = state.risk >= 75 ? "critical" : state.risk >= 30 ? "warning" : "healthy";

  $("missionClock").textContent = formatTime(state.elapsed);
  $("beltSpeed").textContent = `BELT ${state.sensor.speed.toFixed(1)} m/s`;

  $("healthStatus").textContent = state.risk >= 75 ? "CRITICAL" : state.risk >= 30 ? "WARNING" : "HEALTHY";
  $("healthStatus").className = `state ${stateClass}`;
  $("healthValue").textContent = `${state.health.toFixed(0)}%`;
  $("riskText").textContent = `Failure risk  ${state.risk.toFixed(0)}%`;
  $("aiConfidence").textContent = `AI CONF. ${state.confidence.toFixed(0)}%`;
  $("riskFill").style.width = `${state.risk}%`;
  $("riskFill").style.background = color;

  $("vibration").textContent = state.sensor.vibration.toFixed(1);
  $("temperature").textContent = state.sensor.temperature.toFixed(0);
  $("acoustic").textContent = state.sensor.acoustic.toFixed(0);
  $("load").textContent = state.sensor.load.toFixed(0);

  $("dspFft").textContent = `${state.dspFrequency.toFixed(1)} Hz`;
  $("dspFeature").textContent = state.dspFeature;
  $("dspFeature").style.color = state.risk >= 30 ? C.yellow : C.green;

  $("aiClass").textContent = state.aiClass;
  $("aiClass").className = `ai-class ${stateClass}`;
  $("aiDetail").innerHTML =
    `Vision: ${state.cameraState} • ${state.visionConf.toFixed(0)}% confidence<br>` +
    `Failure risk: ${state.risk.toFixed(0)}% • Prediction: ${state.remainingWindow}`;

  const plcClass = state.plcStatus.includes("EMERGENCY") || state.plcStatus === "EMERGENCY STOP" ? "critical" : state.plcAlarm !== "NONE" ? "warning" : "healthy";
  $("plcStatus").textContent = `● ${state.plcStatus}`;
  $("plcStatus").className = `plc-status ${plcClass}`;
  $("plcAlarm").textContent = `ALARM  ${state.plcAlarm}`;
  $("plcAlarm").style.color = state.plcAlarm === "NONE" ? "#7897a3" : (plcClass === "critical" ? C.red : C.yellow);

  $("passportLocation").textContent = state.location;
  $("passportVision").textContent = state.cameraState;
  $("passportAction").textContent = state.maintenance;

  if (!state.running && state.plcStatus === "EMERGENCY STOP") {
    $("simStatus").textContent = "● CONVEYOR STOPPED";
    $("simStatus").className = "sim-status critical";
  } else if (state.running) {
    $("simStatus").textContent = "● SIMULATION RUNNING";
    $("simStatus").className = "sim-status healthy";
  } else {
    $("simStatus").textContent = "● SIMULATION PAUSED";
    $("simStatus").className = "sim-status warning";
  }
}

function resizeCanvas(canvas) {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const w = Math.max(300, rect.width), h = Math.max(120, rect.height);
  if (canvas.width !== Math.floor(w*dpr) || canvas.height !== Math.floor(h*dpr)) {
    canvas.width = Math.floor(w*dpr); canvas.height = Math.floor(h*dpr);
  }
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr,0,0,dpr,0,0);
  return {ctx,w,h};
}

function drawTwin() {
  const {ctx:c,w,h} = resizeCanvas(twin);
  c.clearRect(0,0,w,h);
  c.fillStyle = "#091923"; c.fillRect(0,0,w,h);

  c.strokeStyle = C.grid; c.lineWidth = 1;
  for (let x=0;x<w;x+=42) { c.beginPath(); c.moveTo(x,0); c.lineTo(x,h); c.stroke(); }
  for (let y=0;y<h;y+=42) { c.beginPath(); c.moveTo(0,y); c.lineTo(w,y); c.stroke(); }

  c.fillStyle="#d8edf5"; c.font="bold 18px Segoe UI"; c.fillText("CONVEYOR CV-04",22,24);
  c.fillStyle="#6d96a6"; c.font="bold 11px Segoe UI"; c.fillText("ONE RGB INSPECTION CAMERA  +  SENSOR FUSION",22,45);

  const hx=38, hy=h*.29;
  c.fillStyle="#51636d"; c.strokeStyle="#7e929b"; c.lineWidth=1;
  c.beginPath(); c.moveTo(hx,hy); c.lineTo(hx+120,hy); c.lineTo(hx+96,hy+72); c.lineTo(hx+24,hy+72); c.closePath(); c.fill(); c.stroke();
  c.fillStyle="#d8e5e9"; c.font="bold 11px Segoe UI"; c.fillText("IRON ORE",hx+32,hy+30);

  const x1=120,x2=w-105,y1=h*.51,y2=h*.66, bw=x2-x1;
  c.fillStyle="#263942"; c.strokeStyle="#6c8189"; c.lineWidth=4;
  c.fillRect(x1,y1,bw,y2-y1); c.strokeRect(x1,y1,bw,y2-y1);
  c.fillStyle="#202d33"; c.fillRect(x1+10,y1+9,bw-20,y2-y1-18);

  const phasePx=state.phase*52;
  c.strokeStyle="#344850"; c.lineWidth=2;
  for(let base=-52;base<bw+52;base+=52){
    let xx=x1+base+phasePx; while(xx>x2+20) xx-=bw+52;
    c.beginPath(); c.moveTo(xx,y1+10); c.lineTo(xx,y2-10); c.stroke();
  }

  for(let i=0;i<5;i++){
    const xx=x1+(state.phase*bw*1.8+i*bw/5)%bw;
    c.strokeStyle="#49626b"; c.lineWidth=2; c.beginPath(); c.moveTo(xx,y1+15); c.lineTo(xx+30,y1+15); c.stroke();
  }

  const ore=[[.08,12],[.21,10],[.36,13],[.52,11],[.68,12],[.84,10]];
  for(const [frac,rr] of ore){
    const moving=(frac+state.phase*.72)%1, xx=x1+bw*moving, yy=y1+(y2-y1)*(.55+.06*Math.sin(moving*20));
    c.fillStyle="#7f898d"; c.strokeStyle="#a4adb0"; c.lineWidth=1;
    c.beginPath(); c.ellipse(xx,yy,rr,rr*.65,0,0,Math.PI*2); c.fill(); c.stroke();
  }

  for(const frac of [.18,.34,.50,.66,.82,.94]){
    const xx=x1+bw*frac, cy=y2+20;
    c.fillStyle="#6f8188"; c.strokeStyle="#9cacb2"; c.lineWidth=3;
    c.beginPath(); c.arc(xx,cy,18,0,Math.PI*2); c.fill(); c.stroke();
    c.fillStyle="#2a3d46"; c.beginPath(); c.arc(xx,cy,7,0,Math.PI*2); c.fill();
    c.strokeStyle="#c0cdd1"; c.lineWidth=2;
    const angle=state.phase*Math.PI*2;
    for(let sp=0;sp<3;sp++){ const a=angle+sp*Math.PI*2/3; c.beginPath(); c.moveTo(xx,cy); c.lineTo(xx+Math.cos(a)*12,cy+Math.sin(a)*12); c.stroke(); }
  }

  const gx=x1+bw*.46, top=y1-138;
  c.strokeStyle="#718690"; c.lineWidth=7;
  [[gx,top+18,gx,y1+5],[gx+160,top+18,gx+160,y1+5],[gx,top+18,gx+160,top+18]].forEach(p=>{c.beginPath();c.moveTo(p[0],p[1]);c.lineTo(p[2],p[3]);c.stroke();});

  const cx=gx+80;
  c.fillStyle="#18374a"; c.strokeStyle="#6c9caf"; c.lineWidth=2; c.fillRect(cx-30,top-25,60,37); c.strokeRect(cx-30,top-25,60,37);
  c.fillStyle="#07151e"; c.strokeStyle="#55a9ca"; c.lineWidth=4; c.beginPath();c.arc(cx,top-5,11,0,Math.PI*2);c.fill();c.stroke();
  c.fillStyle="#87bdd0"; c.font="bold 12px Segoe UI"; c.textAlign="center"; c.fillText("RGB CAMERA",cx,top-42); c.textAlign="left";

  const beam=statusColor();
  c.fillStyle=beam+"66"; c.beginPath(); c.moveTo(cx-50,top+12); c.lineTo(cx+50,top+12); c.lineTo(cx+92,y1+18); c.lineTo(cx-92,y1+18); c.closePath(); c.fill();

  const sensorY=y2+52;
  const specs=[[.17,"VIBRATION",`${state.sensor.vibration.toFixed(1)} mm/s`],[.37,"ACOUSTIC",`${state.sensor.acoustic.toFixed(0)} dB`],[.61,"TEMPERATURE",`${state.sensor.temperature.toFixed(0)} °C`],[.82,"LOAD / TENSION",`${state.sensor.load.toFixed(0)}%`]];
  c.textAlign="center";
  for(const [f,n,v] of specs){c.fillStyle="#668f9e";c.font="bold 13px Segoe UI";c.fillText(n,x1+bw*f,sensorY);c.fillStyle="#d7edf4";c.font="bold 11px Consolas";c.fillText(v,x1+bw*f,sensorY+16);}
  c.textAlign="left";

  const mx=x2+10,my=y1+5;
  c.fillStyle="#137abb";c.strokeStyle="#56a8d3";c.lineWidth=2;c.fillRect(mx,my+10,56,55);c.strokeRect(mx,my+10,56,55);
  c.fillStyle="#778d96";c.fillRect(mx-20,my+30,20,16);
  c.fillStyle="#6e9dad";c.font="bold 11px Segoe UI";c.textAlign="center";c.fillText("DRIVE",mx+28,my+80);c.textAlign="left";

  let markerFrac;
  if(joints.includes(state.location)){const idx=joints.indexOf(state.location);markerFrac=.12+(idx/14)*.76;}
  else {const idx=sections.indexOf(state.location);markerFrac=.08+(idx/19)*.82;}
  const fx=x1+bw*markerFrac;
  c.strokeStyle=beam;c.lineWidth=3;c.beginPath();c.moveTo(fx,y1-15);c.lineTo(fx,y2+30);c.stroke();
  c.fillStyle=beam;c.fillRect(fx-30,y1-45,60,28);
  c.fillStyle="#07151e";c.font="bold 11px Segoe UI";c.textAlign="center";c.fillText(state.location,fx,y1-27);c.textAlign="left";

  const beltRunning=state.running && state.risk<92 && state.sensor.speed>.1;
  c.fillStyle=beltRunning?C.green:C.red;c.font="bold 12px Segoe UI";c.textAlign="right";c.fillText(beltRunning?"● BELT RUNNING":"● BELT STOP / SLOW",x2-8,y1-14);c.textAlign="left";

  const boxY=h-91;
  c.fillStyle="#07131b";c.strokeStyle="#254653";c.lineWidth=1;c.fillRect(20,boxY,w-40,73);c.strokeRect(20,boxY,w-40,73);
  c.fillStyle="#6f99a9";c.font="bold 11px Segoe UI";c.fillText("VISION MODEL",36,boxY+17);
  c.fillStyle=beam;c.font="bold 15px Consolas";c.fillText(state.cameraState,36,boxY+40);
  c.fillStyle="#a7c2cc";c.font="bold 11px Consolas";c.fillText(`RFID/ENCODER ${state.location}   •   VISION ${state.visionConf.toFixed(0)}%   •   RISK ${state.risk.toFixed(0)}%   •   HEALTH ${state.health.toFixed(0)}%`,36,boxY+62);

  if(state.risk>=30){c.fillStyle=beam;c.font="bold 13px Segoe UI";c.textAlign="right";c.fillText(state.risk<75?"PREDICTIVE ALERT":"CRITICAL ALERT",w-30,25);c.textAlign="left";}
}

function drawGraph() {
  const {ctx:c,w,h}=resizeCanvas(graph);
  c.clearRect(0,0,w,h); c.fillStyle="#07131b";c.fillRect(0,0,w,h);
  c.strokeStyle="#102b38";c.lineWidth=1;
  for(let x=0;x<w;x+=45){c.beginPath();c.moveTo(x,0);c.lineTo(x,h);c.stroke();}
  for(let y=0;y<h;y+=35){c.beginPath();c.moveTo(0,y);c.lineTo(w,y);c.stroke();}

  const key=$("graphSelector").value, values=state.history[key];
  const ranges={vibration:[0,12],temperature:[35,90],acoustic:[45,110],load:[35,100]};
  const thresholds={vibration:4.5,temperature:65,acoustic:72,load:80};
  const [lo,hi]=ranges[key];
  let ty=h-((thresholds[key]-lo)/(hi-lo))*(h-18);ty=clamp(ty,8,h-8);
  c.strokeStyle="#7d5a2d";c.setLineDash([5,4]);c.beginPath();c.moveTo(0,ty);c.lineTo(w,ty);c.stroke();c.setLineDash([]);
  c.fillStyle="#a77f46";c.font="10px Segoe UI";c.fillText("warning threshold",8,ty-3);

  if(values.length<2)return;
  const pts=[];
  values.forEach((v,i)=>{const x=8+i/(values.length-1)*(w-16), norm=clamp((v-lo)/(hi-lo),0,1), y=h-10-norm*(h-20);pts.push([x,y]);});
  c.strokeStyle=statusColor();c.lineWidth=2;c.beginPath();pts.forEach((p,i)=>i?c.lineTo(...p):c.moveTo(...p));c.stroke();
  c.fillStyle="#9bc1ce";c.font="bold 11px Segoe UI";c.fillText(key.toUpperCase(),10,13);
  c.fillStyle="#d8edf5";c.font="bold 12px Consolas";c.textAlign="right";c.fillText(values.at(-1).toFixed(1),w-8,13);c.textAlign="left";
}

function modeChanged() {
  state.mode=$("scenario").value;
  const map={AUTO:"normal",NORMAL:"normal",MISALIGNMENT:"misalignment","JOINT DEGRADATION":"degradation","BELT TEAR":"tear","JOINT RUPTURE":"rupture",OVERLOAD:"overload"};
  const target=map[state.mode];

  if(target==="normal"){
    recover(); resetBaseline();
    logEvent("Manual mode: NORMAL operating condition selected.","info");
  } else {
    state.fault=target; state.faultAge=0;
    state.location=choice(target==="degradation"?joints:sections);
    state.plcStatus="RUNNING"; state.plcAlarm="WARNING";
    logEvent(`Manual mode: ${state.mode} selected at ${state.location}.`, target==="tear"||target==="rupture"?"crit":"warn");
  }
  clampCompute();updateDSPAI();refresh();drawTwin();drawGraph();
}

function reset() {
  state.running=false; state.elapsed=0; state.tick=0; state.mode="AUTO"; $("scenario").value="AUTO";
  resetBaseline(); $("runBtn").textContent="▶ START";
  $("simStatus").textContent="● SIMULATION READY"; $("simStatus").className="sim-status healthy";
  state.events=[]; logEvent("System reset. Auto-random simulation is ready.","info");
  refresh();drawTwin();drawGraph();
}

$("runBtn").addEventListener("click",()=>{
  if(state.running){
    state.running=false; $("runBtn").textContent="▶ RESUME";
    $("simStatus").textContent="● SIMULATION PAUSED"; $("simStatus").className="sim-status warning";
    logEvent("Simulation paused.","warn");
  } else {
    state.running=true; $("runBtn").textContent="Ⅱ PAUSE";
    $("simStatus").textContent="● SIMULATION RUNNING"; $("simStatus").className="sim-status healthy";
    logEvent("Simulation started. Sensor streams are live.","info");
  }
});
$("resetBtn").addEventListener("click",reset);
$("scenario").addEventListener("change",modeChanged);
$("graphSelector").addEventListener("change",drawGraph);

const fullscreenBtn = document.getElementById("fullscreenBtn");
const simulatorShell = document.querySelector(".simulator-shell");

function updateFullscreenButton() {
  if (document.fullscreenElement === simulatorShell) {
    fullscreenBtn.textContent = "⛶ EXIT FULL SCREEN";
  } else {
    fullscreenBtn.textContent = "⛶ FULL SCREEN SIMULATOR";
  }
}

fullscreenBtn.addEventListener("click", async () => {
  try {
    if (document.fullscreenElement === simulatorShell) {
      await document.exitFullscreen();
    } else {
      await simulatorShell.requestFullscreen();
    }
    setTimeout(() => { drawTwin(); drawGraph(); }, 100);
  } catch (err) {
    console.warn("Fullscreen request was not available:", err);
  }
});

document.addEventListener("fullscreenchange", () => {
  updateFullscreenButton();
  setTimeout(() => { drawTwin(); drawGraph(); }, 100);
});

window.addEventListener("resize",()=>{drawTwin();drawGraph();});

resetBaseline();
logEvent("System initialized. Auto-random simulation is ready.","info");
refresh();drawTwin();drawGraph();

setInterval(tick,650);
