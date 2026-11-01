/* Tenisová mapa turnajů ČTS – klient (bez build kroku). Data: data/turnaje.json (pipeline/update.py). */
(() => {
"use strict";
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const CTS = "https://cesky-tenis.cz/turnaj/";
const APP_VERSION = "v2.1";
/* adresa pro hlášení problémů – rozdělená kvůli robotům sbírajícím e-maily; prázdné = tlačítko vypnuto */
const REPORT_EMAIL = ["tenisova-mapa", "seznam.cz"].filter(Boolean).join("@");
const CLASS_ORDER = ["MCR", "A", "B", "P", "C", "D", "E", ""];
const CLASS_LABEL = {MCR: "MČR", A: "A", B: "B", P: "P – přebor", C: "C", D: "D", E: "E", "": "bez třídy"};
const CAT_ORDER = ["mladsi-zactvo", "starsi-zactvo", "dorost", "dospeli", "babytenis", "stredni-kurt", "minitenis"];
const CAT_SHORT = {"dospeli": "Dospělí", "dorost": "Dorost", "starsi-zactvo": "Starší žactvo", "mladsi-zactvo": "Mladší žactvo", "babytenis": "Babytenis", "stredni-kurt": "Střední kurt", "minitenis": "Minitenis"};
const CAT_QUICK = {"mladsi-zactvo": "Ml. žactvo", "starsi-zactvo": "St. žactvo", "dorost": "Dorost", "dospeli": "Dospělí", "babytenis": "Babytenis", "stredni-kurt": "Střední kurt", "minitenis": "Minitenis"};
/* povrchy: hlavní skupiny + konkrétní typy (názvy z IS ČTS) */
const SURF_GROUPS = [
  ["Antuka", ["antuka"]],
  ["Koberec", ["koberec", "koberec s granulemi", "koberec s pískem", "court sol", "lano wimbledon"]],
  ["Tvrdý", ["greenset", "decoturf", "decoturf us open", "rebound ace", "nova sports ultracushion u.s.a.", "mapei tns cushion", "plexipave", "ultra cushion", "supreme", "akroten", "grand slam", "beton"]],
  ["Umělá tráva", ["umělá tráva", "grass park"]],
  ["Umělá antuka", ["umělá antuka"]],
  ["Sportovní podlaha", ["taraflex", "regupol", "fatra sporting", "duroflex", "pavitex", "conipur epdm", "bergo"]],
];
function surfGroup(p) {
  const s = (p || "").toLowerCase().trim();
  if (!s) return "Neuvedeno";
  for (const [g, xs] of SURF_GROUPS) if (xs.includes(s)) return g;
  if (/umělá antuka/.test(s)) return "Umělá antuka";
  if (/antuk/.test(s)) return "Antuka";
  if (/kober|carpet/.test(s)) return "Koberec";
  if (/tráv|grass/.test(s)) return "Umělá tráva";
  if (/cushion|turf|acryl|akryl|hard|plexi|beton/.test(s)) return "Tvrdý";
  return "Jiný";
}
const PREC = {areal: ["ok", "Místo ověřeno – tenisový areál v mapě"], rucne: ["ok", "Místo ručně ověřeno"], adresa: ["mid", "Bod adresy (areál v mapě nenalezen)"],
  areal_obec: ["mid", "Tenisový areál v obci – neověřeno"], obec: ["mid", "Jen obec – přesné místo neznámé"],
  odhad: ["bad", "Odhad: místo loňského ročníku"], nezname: ["bad", "Místo neznámé"]};
const DOW = ["Ne", "Po", "Út", "St", "Čt", "Pá", "So"];
const LS = {get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
            set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }};
const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const colorOf = (tr, zr) => zr ? css("--c-zr") : css("--c-" + (CLASS_ORDER.includes(tr) && tr ? tr : "x"));
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c]));
const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const pd = s => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const dShort = s => { const a = pd(s); return `${a.getDate()}. ${a.getMonth() + 1}.`; };
function fmtRange(od, d2, short) {
  if (!od) return "";
  const a = pd(od), b = pd(d2 || od), y = short ? "" : " " + b.getFullYear();
  if (od === d2 || !d2) return `${DOW[a.getDay()]} ${a.getDate()}. ${a.getMonth() + 1}.${y}`;
  if (a.getMonth() === b.getMonth()) return `${DOW[a.getDay()]}–${DOW[b.getDay()]} ${a.getDate()}.–${b.getDate()}. ${b.getMonth() + 1}.${y}`;
  return `${DOW[a.getDay()]} ${a.getDate()}. ${a.getMonth() + 1}. – ${DOW[b.getDay()]} ${b.getDate()}. ${b.getMonth() + 1}.${y}`;
}
function km(a, b) {
  const R = 6371, r = Math.PI / 180, dLa = (b[0] - a[0]) * r, dLo = (b[1] - a[1]) * r;
  const h = Math.sin(dLa / 2) ** 2 + Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin(dLo / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
const nf = n => n.toLocaleString("cs-CZ");
function toast(t) { const el = $("#toast"); el.textContent = t; el.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => el.hidden = true, 2600); }
const isDesk = () => innerWidth >= 900;

/* ---------- stav ---------- */
let DATA, EV = [], VEN = [], byVenue = new Map();
const today = new Date(); today.setHours(0, 0, 0, 0);
const defaults = () => ({from: iso(today), to: "", cat: [], sex: [], cls: [], surf: [], center: null, centerMode: "none", centerLabel: "", radius: 50,
  text: "", free: false, cancelled: true, guess: true, favOnly: false});
let F = Object.assign(defaults(), LS.get("tm.filters", {}));
if (!F.from || F.from < iso(today)) F.from = iso(today);
F.surf = (F.surf || []).filter(s => /^[gr]:/.test(s));
let FAV = new Set(LS.get("tm.fav", []));
let sortMode = "date", pickMode = false, panel = "list", prevPanel = "list", reportFrom = "list";
let ctx = {}, lastVenue = null;   // kontext pro hlášení problému

/* ---------- mapa ---------- */
const CZ = [[48.55, 12.09], [51.06, 18.86]];
const map = L.map("map", {zoomControl: false, attributionControl: true}).fitBounds(CZ);
if (isDesk()) L.control.zoom({position: "bottomright"}).addTo(map);
L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {maxZoom: 19, crossOrigin: true,
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · data <a href="https://cesky-tenis.cz">ČTS</a>'}).addTo(map);
const cluster = L.markerClusterGroup({maxClusterRadius: 42, showCoverageOnHover: false, spiderfyOnMaxZoom: true,
  iconCreateFunction: c => { const n = c.getChildCount(); const s = n < 10 ? 34 : n < 50 ? 40 : 46;
    return L.divIcon({html: `<div class="cluster" style="width:${s}px;height:${s}px">${n}</div>`, className: "", iconSize: [s, s]}); }});
map.addLayer(cluster);
let circle = null, centerMarker = null, focusMarker = null;
const PIN = (color, w = 30, h = 40) => `<svg viewBox="0 0 30 40" width="${w}" height="${h}"><path d="M15 1C7.3 1 1 7.1 1 14.7 1 25 15 39 15 39s14-14 14-24.3C29 7.1 22.7 1 15 1z" fill="${color}"/></svg>`;
function pinIcon(color, n, guess, fav) {
  return L.divIcon({html: `<div class="pin${guess ? " guess" : ""}${fav ? " fav" : ""}">${PIN(color)}<b>${n > 1 ? n : ""}</b></div>`, className: "", iconSize: [30, 40], iconAnchor: [15, 39]});
}

/* viditelná část mapy (bez horní lišty a spodního panelu) */
function visibleRect() {
  const top = isDesk() ? 70 : $(".quick").getBoundingClientRect().bottom + 6;
  const left = isDesk() && !$("#sheet").hidden ? 424 : 0;
  const bottom = isDesk() ? innerHeight : innerHeight - sheetVisible();
  return {top, left, bottom: Math.max(bottom, top + 120), right: innerWidth};
}
function showLatLng(ll, zoom) {
  const z = zoom ?? map.getZoom(), r = visibleRect(), size = map.getSize();
  const cx = (r.left + r.right) / 2, cy = (r.top + r.bottom) / 2;
  const p = map.project(ll, z).add([size.x / 2 - cx, size.y / 2 - cy]);
  map.setView(map.unproject(p, z), z, {animate: true});
}
function fitVisible(bounds) {
  const r = visibleRect();
  map.fitBounds(bounds, {paddingTopLeft: [r.left + 20, r.top + 10], paddingBottomRight: [20, innerHeight - r.bottom + 10]});
}

/* ---------- filtrování ---------- */
function surfMatch(e) {
  if (!F.surf.length) return true;
  const g = surfGroup(e.pov), raw = (e.pov || "").toLowerCase();
  return F.surf.includes("g:" + g) || F.surf.includes("r:" + raw);
}
function evMatches(e, opt = {}) {
  if (e.test && !F.text.toLowerCase().includes("test")) return false;
  if (!F.cancelled && e.st === "zruseno") return false;
  const to = F.to || "9999";
  if (e.od && (e.do || e.od) < F.from) return false;
  if (e.od && e.od > to) return false;
  if (F.cat.length && !F.cat.includes(e.kat)) return false;
  if (F.sex.length && !e.mix && !((F.sex.includes("m") && e.km) || (F.sex.includes("z") && e.kz))) return false;
  if (F.cls.length && !F.cls.includes(e.tr || "")) return false;
  if (!surfMatch(e)) return false;
  if (F.free && !hasFree(e)) return false;
  const v = VEN[e.misto];
  if (!F.guess && v && (v.presnost === "odhad" || v.presnost === "nezname")) return false;
  if (F.text) { const t = F.text.toLowerCase(); if (!(`${e.nz} ${e.por} ${v?.adresa || ""} ${v?.nazev_mista || ""} ${e.km} ${e.kz}`.toLowerCase().includes(t))) return false; }
  if (!opt.ignoreRadius && F.center && F.centerMode !== "none") {
    if (!v || v.lat == null) return false;
    if (km(F.center, [v.lat, v.lon]) > F.radius) return false;
  }
  if (F.favOnly && !FAV.has(e.id)) return false;
  return true;
}
function occOf(e) {
  const xs = [];
  if (e.km) xs.push(e.om || (e.kap ? [e.pm || 0, e.kap] : null));
  if (e.kz) xs.push(e.oz || (e.kap ? [e.pz || 0, e.kap] : null));
  return xs;
}
const hasFree = e => occOf(e).some(o => !o || o[0] < o[1]);
function occText(o, p, kap) {
  if (o) return {t: `${o[0]} / ${o[1]}`, pct: o[1] ? o[0] / o[1] : 0};
  if (p != null && kap) return {t: `${p} / ${kap}`, pct: p / kap};
  return {t: kap ? `– / ${kap}` : "–", pct: 0};
}
const dist = e => { const v = VEN[e.misto]; return F.center && v && v.lat != null ? km(F.center, [v.lat, v.lon]) : 1e9; };

let shown = [];
function render() {
  LS.set("tm.filters", F);
  shown = EV.filter(e => evMatches(e));
  const vmap = new Map();
  for (const e of shown) { const v = VEN[e.misto]; if (!v || v.lat == null) continue; (vmap.get(e.misto) || vmap.set(e.misto, []).get(e.misto)).push(e); }
  cluster.clearLayers();
  const markers = [];
  for (const [vi, evs] of vmap) {
    const v = VEN[vi];
    const active = evs.filter(e => e.st !== "zruseno");
    const best = (active.length ? active : evs).map(e => e.tr || "").sort((a, b) => CLASS_ORDER.indexOf(a) - CLASS_ORDER.indexOf(b))[0];
    const m = L.marker([v.lat, v.lon], {icon: pinIcon(colorOf(best, !active.length), evs.length, ["odhad", "obec", "areal_obec"].includes(v.presnost), evs.some(e => FAV.has(e.id))),
      title: `${v.nazev_mista || v.poradatel} (${evs.length})`});
    m.on("click", () => openVenue(vi, {move: false}));
    markers.push(m);
  }
  cluster.addLayers(markers);
  const noLoc = shown.filter(e => { const v = VEN[e.misto]; return !v || v.lat == null; }).length;
  $("#summary").innerHTML = panel === "detail" ? $("#summary").innerHTML : `${nf(shown.length)} turnajů <small>· ${vmap.size} míst${noLoc ? ` · ${noLoc} bez místa` : ""}</small>`;
  $("#countBadge").textContent = nf(shown.length);
  $("#showCount").textContent = `(${nf(shown.length)})`;
  const nfil = [F.cat.length, F.sex.length, F.cls.length, F.surf.length, F.to, F.centerMode !== "none", F.free, F.favOnly, !F.cancelled, !F.guess].filter(Boolean).length;
  $("#filterBadge").hidden = !nfil; $("#filterBadge").textContent = nfil; $("#filterBadge2").textContent = nfil || "";
  $("#favBadge").textContent = FAV.size || "";
  drawCircle(); renderQuick(); syncFilterUI();
  if (panel === "list") renderList();
  if (panel === "favs") renderFavs();
}
function drawCircle() {
  if (circle) { map.removeLayer(circle); circle = null; }
  if (centerMarker) { map.removeLayer(centerMarker); centerMarker = null; }
  if (F.center && F.centerMode !== "none") {
    circle = L.circle(F.center, {radius: F.radius * 1000, color: css("--accent2"), weight: 2, fillOpacity: .05, dashArray: "6 6", interactive: false}).addTo(map);
    centerMarker = L.marker(F.center, {icon: L.divIcon({html: '<div class="center-dot"></div>', className: "", iconSize: [16, 16], iconAnchor: [8, 8]}), interactive: false}).addTo(map);
  }
}

/* ---------- rychlé volby + filtry ---------- */
function renderQuick() {
  const q = $("#quick");
  const dateTxt = F.to ? `${dShort(F.from)} – ${dShort(F.to)}` : F.from === iso(today) ? "Od dnes" : `Od ${dShort(F.from)}`;
  const counts = {}; for (const e of EV) counts[e.kat] = (counts[e.kat] || 0) + 1;
  q.innerHTML = `<button class="date" data-q="date"><svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>${dateTxt}</button>` +
    CAT_ORDER.filter(k => counts[k]).map(k => `<button data-q="${k}" class="${F.cat.includes(k) ? "on" : ""}">${CAT_QUICK[k]}</button>`).join("") +
    (F.centerMode !== "none" ? `<button class="on" data-q="radius">≤ ${F.radius} km ✕</button>` : "") +
    (F.favOnly ? `<button class="on" data-q="fav">★ Oblíbené ✕</button>` : "");
  q.querySelectorAll("button").forEach(b => b.onclick = () => {
    const k = b.dataset.q;
    if (k === "date") { showPanel("filters"); setSnap("full"); return; }
    if (k === "radius") { F.centerMode = "none"; return render(); }
    if (k === "fav") { F.favOnly = false; return render(); }
    const i = F.cat.indexOf(k); i >= 0 ? F.cat.splice(i, 1) : F.cat.push(k); render();
  });
}
function chip(container, items, key) {
  const el = typeof container === "string" ? $(container) : container; el.innerHTML = "";
  for (const it of items) {
    const b = document.createElement("button");
    b.type = "button"; b.dataset.v = it.v; b.dataset.k = key;
    b.innerHTML = (it.color ? `<i class="dot" style="background:${it.color}"></i>` : "") + esc(it.l) + (it.n != null ? ` <small>${it.n}</small>` : "");
    if (it.n === 0) b.disabled = true;
    b.onclick = () => { const a = F[key]; const i = a.indexOf(it.v); i >= 0 ? a.splice(i, 1) : a.push(it.v); render(); };
    el.appendChild(b);
  }
}
function buildFilterUI() {
  const cnt = f => { const c = {}; for (const e of EV) { const k = f(e); c[k] = (c[k] || 0) + 1; } return c; };
  const cc = cnt(e => e.kat);
  chip("#fCat", CAT_ORDER.map(k => ({v: k, l: CAT_SHORT[k], n: cc[k] || 0})), "cat");
  chip("#fSex", [{v: "m", l: "Chlapci / muži"}, {v: "z", l: "Dívky / ženy"}], "sex");
  const tc = cnt(e => e.tr || "");
  chip("#fClass", CLASS_ORDER.filter(k => tc[k]).map(k => ({v: k, l: CLASS_LABEL[k], n: tc[k], color: colorOf(k)})), "cls");
  const gc = cnt(e => surfGroup(e.pov));
  const groups = Object.keys(gc).sort((a, b) => gc[b] - gc[a]);
  chip("#fSurf", groups.map(g => ({v: "g:" + g, l: g, n: gc[g]})), "surf");
  const rc = cnt(e => (e.pov || "").toLowerCase());
  const disp = {}; for (const e of EV) if (e.pov) disp[e.pov.toLowerCase()] ??= e.pov;
  const box = $("#fSurfRaw"); box.innerHTML = "";
  for (const g of groups) {
    const raws = Object.keys(rc).filter(r => r && surfGroup(r) === g).sort((a, b) => rc[b] - rc[a]);
    if (raws.length < 2) continue;
    const wrap = document.createElement("div"); wrap.className = "subgrp"; wrap.innerHTML = `<h4>${esc(g)}</h4>`;
    const ch = document.createElement("div"); ch.className = "chips"; wrap.appendChild(ch); box.appendChild(wrap);
    chip(ch, raws.map(r => ({v: "r:" + r, l: disp[r] || r, n: rc[r]})), "surf");
  }
  $("#legend").innerHTML = "<b>Třída turnaje</b>" + CLASS_ORDER.filter(k => tc[k]).map(k => `<div><i style="background:${colorOf(k)}"></i>${CLASS_LABEL[k]}</div>`).join("") +
    `<div><i style="background:${css("--c-zr")}"></i>zrušeno</div><div><i class="ring"></i>čárkovaně = místo odhadnuté</div><div>číslo = počet turnajů v místě</div>`;
}
function syncFilterUI() {
  $$(".chips button[data-k]").forEach(b => b.classList.toggle("on", F[b.dataset.k].includes(b.dataset.v)));
  $("#fFrom").value = F.from || ""; $("#fTo").value = F.to || "";
  $("#fRadius").value = F.radius; $("#radiusVal").textContent = F.radius + " km";
  if (document.activeElement !== $("#fText")) $("#fText").value = F.text;
  $("#fFree").checked = F.free; $("#fCancelled").checked = F.cancelled; $("#fGuess").checked = F.guess;
  $$("#fCenterMode button").forEach(b => b.classList.toggle("on", b.dataset.c === F.centerMode));
  $("#rangeBox").classList.toggle("off", F.centerMode === "none");
  $("#centerInfo").textContent = F.centerMode === "none" ? "Zobrazuje se celá ČR." :
    F.center ? `Střed: ${F.centerLabel || F.center.map(x => x.toFixed(4)).join(", ")}` : "";
  $("#btnLocate").classList.toggle("on", F.centerMode === "gps");
  $("#btnPick").classList.toggle("on", pickMode || F.centerMode === "pick");
  $("#btnFavMap").classList.toggle("on", F.favOnly);
}
function presets(p) {
  const d = new Date(today), dow = d.getDay();
  const fri = addDays(d, dow === 6 ? -1 : dow === 0 ? -2 : (5 - dow + 7) % 7), sun = addDays(fri, 2);
  if (p === "weekend") { F.from = iso(fri < d ? d : fri); F.to = iso(sun); }
  if (p === "nextweekend") { F.from = iso(addDays(fri, 7)); F.to = iso(addDays(sun, 7)); }
  if (p === "d14") { F.from = iso(d); F.to = iso(addDays(d, 14)); }
  if (p === "d30") { F.from = iso(d); F.to = iso(addDays(d, 30)); }
  if (p === "all") { F.from = iso(d); F.to = ""; }
  render();
}
function setCenter(ll, mode, label) {
  F.center = [+ll[0].toFixed(5), +ll[1].toFixed(5)]; F.centerMode = mode; F.centerLabel = label || "";
  render();
  if (!isDesk() && panel !== "filters") setSnap("peek");
  fitVisible(L.latLng(F.center).toBounds(F.radius * 2000));
}
function locate() {
  if (!navigator.geolocation) return toast("Prohlížeč neumí zjistit polohu.");
  toast("Zjišťuji polohu…");
  navigator.geolocation.getCurrentPosition(p => setCenter([p.coords.latitude, p.coords.longitude], "gps", "moje poloha"),
    err => toast(err.code === 1 ? "Přístup k poloze je zakázaný – povolte ho v nastavení prohlížeče." : "Polohu se nepodařilo zjistit."),
    {enableHighAccuracy: true, timeout: 15000, maximumAge: 60000});
}
function setPick(on) { pickMode = on; $("#pickHint").hidden = !on; syncFilterUI(); if (on && !isDesk()) setSnap("peek"); }
map.on("click", e => {
  if (pickMode) { setPick(false); return setCenter([e.latlng.lat, e.latlng.lng], "pick", "bod v mapě"); }
  if (!isDesk() && snap !== "peek") setSnap("peek");
});

/* ---------- spodní panel: tah, úchyty peek / half / full ---------- */
const sheet = $("#sheet");
let snap = "peek";
function snapPx(name) {
  const H = sheet.offsetHeight, peek = $("#sheetHead").offsetHeight + 2;
  return name === "peek" ? peek : name === "half" ? Math.max(peek + 140, Math.round(innerHeight * .5)) : H;
}
function sheetVisible() { return isDesk() ? 0 : snapPx(snap); }
function setSnap(name) {
  snap = name; sheet.dataset.snap = name;
  sheet.style.setProperty("--vis", snapPx(name) + "px");
  sheet.style.transform = "";
}
(() => {
  const head = $("#sheetHead");
  let y0 = 0, vis0 = 0, t0 = 0, moved = false, active = false;
  head.addEventListener("pointerdown", e => {
    if (isDesk() || e.button > 0) return;
    active = true; moved = false; y0 = e.clientY; vis0 = snapPx(snap); t0 = performance.now();
  });
  addEventListener("pointermove", e => {
    if (!active) return;
    const dy = e.clientY - y0;
    if (!moved && Math.abs(dy) < 6) return;
    if (!moved) { moved = true; sheet.classList.add("dragging"); head.setPointerCapture?.(e.pointerId); }
    const vis = Math.min(sheet.offsetHeight, Math.max(snapPx("peek"), vis0 - dy));
    sheet.style.transform = `translateY(${sheet.offsetHeight - vis}px)`;
  });
  addEventListener("pointerup", e => {
    if (!active) return; active = false;
    if (!moved) return;
    sheet.classList.remove("dragging");
    const dy = e.clientY - y0, v = dy / Math.max(1, performance.now() - t0);
    const vis = vis0 - dy;
    const order = ["peek", "half", "full"];
    let best = order.reduce((a, b) => Math.abs(snapPx(b) - vis) < Math.abs(snapPx(a) - vis) ? b : a);
    if (Math.abs(v) > .6) best = order[Math.max(0, Math.min(2, order.indexOf(snap) + (v < 0 ? 1 : -1)))];
    setSnap(best);
  });
  head.addEventListener("click", e => {
    if (moved || isDesk() || e.target.closest("button")) return;
    setSnap(snap === "peek" ? "half" : snap === "half" ? "full" : "half");
  });
})();
$("#btnMin").onclick = () => setSnap(snap === "peek" ? (isDesk() ? "full" : "half") : "peek");
addEventListener("resize", () => setSnap(snap));

/* ---------- panely ---------- */
function showPanel(name) {
  if (name === "report") { if (panel !== "report") reportFrom = panel; }
  else if (name !== "detail") { prevPanel = name; clearFocus(); }
  panel = name;
  $$(".panel").forEach(p => p.classList.toggle("on", p.dataset.panel === name));
  $$("#tabs button").forEach(t => t.classList.toggle("on", t.dataset.panel === name));
  sheet.classList.toggle("detail", name === "detail");
  $("#btnBack").hidden = name !== "detail" && name !== "report";
  if (name !== "detail" && name !== "report") render();
  if (name === "report") $("#summary").textContent = "Nahlásit problém";
  $("#sheetBody").scrollTop = 0;
  if (snap === "peek") setSnap(isDesk() ? "full" : "half"); else setSnap(snap);
}

function linkSet(e) {
  const out = [];
  const g = (e.mix ? ["Děti", ""] : e.kat === "dospeli" ? ["Muži", "Ženy"] : ["Chlapci", "Dívky"]).map(x => x ? " – " + x.toLowerCase() : "");
  const s = DATA.meta.sezona;
  if (e.km) out.push(`<a class="pri" href="${CTS}${e.km}?sezona=${s}&tab=seznam" target="_blank" rel="noopener">Přihlášky${g[0]}</a>`);
  if (e.kz) out.push(`<a class="pri" href="${CTS}${e.kz}?sezona=${s}&tab=seznam" target="_blank" rel="noopener">Přihlášky${g[1]}</a>`);
  if (e.km) out.push(`<a href="${CTS}${e.km}?sezona=${s}" target="_blank" rel="noopener">Hrací plány / výsledky${g[0]}</a>`);
  if (e.kz) out.push(`<a href="${CTS}${e.kz}?sezona=${s}" target="_blank" rel="noopener">Hrací plány / výsledky${g[1]}</a>`);
  return out.join("");
}
const STAR = '<svg viewBox="0 0 24 24"><path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/></svg>';
const isNew = e => e.nove && (today - pd(e.nove)) / 864e5 <= 7 && DATA.meta.prvni_beh !== e.nove;

/* kompaktní řádek do seznamu */
function item(e) {
  const v = VEN[e.misto] || {}, zr = e.st === "zruseno";
  const d = F.center && F.centerMode !== "none" && v.lat != null ? ` · ${Math.round(km(F.center, [v.lat, v.lon]))} km` : "";
  const occ = occOf(e).filter(Boolean);
  const full = occ.length && occ.every(o => o[0] >= o[1]);
  const sex = e.mix ? "děti" : [e.km && (e.kat === "dospeli" ? "muži" : "chlapci"), e.kz && (e.kat === "dospeli" ? "ženy" : "dívky")].filter(Boolean).join(" + ");
  return `<div class="item${zr ? " zr" : ""}" data-ev="${esc(e.id)}">
    <i class="bar" style="background:${colorOf(e.tr, zr)}"></i>
    <div class="main"><div class="t">${esc(e.nz || e.por)}</div>
      <div class="s">${esc(fmtRange(e.od, e.do, true))} · ${esc(v.nazev_mista && v.presnost === "areal" ? v.nazev_mista : e.por)}${d}</div>
      <div class="m"><span class="pill cls" style="background:${colorOf(e.tr, zr)}">${e.tr === "MCR" ? "MČR" : e.tr || "–"}</span><span class="pill">${esc(CAT_QUICK[e.kat])}</span><span class="pill">${sex}</span>
      ${e.kap ? `<span class="pill${full ? " full" : ""}">${full ? "plno" : "max " + e.kap}</span>` : ""}${e.pov ? `<span class="pill">${esc(surfGroup(e.pov))}</span>` : ""}
      ${zr ? '<span class="pill zr">ZRUŠENO</span>' : ""}${isNew(e) ? '<span class="pill new">NOVÉ</span>' : ""}</div></div>
    <button class="star${FAV.has(e.id) ? " on" : ""}" data-fav="${esc(e.id)}" aria-label="Oblíbené">${STAR}</button></div>`;
}
/* plná karta v detailu místa */
function card(e) {
  const zr = e.st === "zruseno";
  const g = e.mix ? ["Děti", ""] : e.kat === "dospeli" ? ["Muži", "Ženy"] : ["Chlapci", "Dívky"];
  const occ = [];
  for (const [code, o, p, lab] of [[e.km, e.om, e.pm, g[0]], [e.kz, e.oz, e.pz, g[1]]]) {
    if (!code) continue;
    const t = occText(o, p, e.kap);
    occ.push(`<div><span>${lab} <small class="muted">· kód ${code}</small></span><b>${t.t}</b></div><div class="bar5"><i style="width:${Math.min(100, t.pct * 100)}%"></i></div>`);
  }
  return `<div class="card${zr ? " zr" : ""}" id="c-${esc(e.id)}">
    <div class="top"><span class="badgecls" style="background:${colorOf(e.tr, zr)}">${esc(e.tr === "MCR" ? "MČR" : e.tr || "–")}</span>
      <div style="flex:1;min-width:0"><div class="nm">${esc(e.nz || e.por)}</div><div class="sub">${esc(CAT_SHORT[e.kat] || e.kat)} · ${esc(fmtRange(e.od, e.do))}</div>
      <div class="m" style="display:flex;gap:4px;margin-top:4px">${zr ? '<span class="pill zr">ZRUŠENO</span>' : ""}${isNew(e) ? '<span class="pill new">NOVÉ</span>' : ""}${e.test ? '<span class="pill">TEST</span>' : ""}</div></div>
      <button class="star${FAV.has(e.id) ? " on" : ""}" data-fav="${esc(e.id)}" aria-label="Oblíbené">${STAR}</button></div>
    <div class="occ">${occ.join("")}</div>
    <div class="facts"><div><span>Max. hráčů</span>${e.kap ?? "?"}</div><div><span>Dvorce · povrch</span>${e.dv ?? "?"} · ${esc(e.pov || "neuvedeno")}</div>
      ${e.mic ? `<div><span>Míče</span>${esc(e.mic)}</div>` : ""}${e.vk ? `<div><span>Vklad</span>${e.vk} Kč</div>` : ""}
      ${e.prez ? `<div><span>Prezentace</span>${esc(e.prez)}</div>` : ""}<div><span>Pořadatel</span>${esc(e.por)}</div></div>
    ${zr ? `<div class="note">Turnaj ${e.zrus ? "zmizel z termínové listiny " + esc(fmtRange(e.zrus)) : "je v listině označen jako zrušený"} – ověřte na webu ČTS.</div>` : ""}
    <div class="links">${linkSet(e)}</div>
    <span class="reportlink" data-report-ev="${esc(e.id)}">Nahlásit chybu u tohoto turnaje</span></div>`;
}
function bind(root) {
  root.querySelectorAll("[data-fav]").forEach(b => b.onclick = ev => { ev.stopPropagation(); toggleFav(b.dataset.fav); b.classList.toggle("on", FAV.has(b.dataset.fav)); });
  root.querySelectorAll("[data-report-ev]").forEach(a => a.onclick = ev => { ev.stopPropagation(); openReport({ev: a.dataset.reportEv, venue: lastVenue}); });
  root.querySelectorAll("[data-report-venue]").forEach(a => a.onclick = ev => { ev.stopPropagation(); openReport({venue: +a.dataset.reportVenue}); });
  root.querySelectorAll("[data-ev]").forEach(r => r.onclick = () => { const e = EV.find(x => x.id === r.dataset.ev); if (e) openVenue(e.misto, {focus: e.id}); });
}
function toggleFav(id) {
  FAV.has(id) ? FAV.delete(id) : FAV.add(id); LS.set("tm.fav", [...FAV]);
  $("#favBadge").textContent = FAV.size || "";
  const keep = panel; render(); panel = keep;
}

function clearFocus() { if (focusMarker) { map.removeLayer(focusMarker); focusMarker = null; } }
function setFocus(v) {
  clearFocus();
  if (v.lat == null) return;
  const label = v.nazev_mista || v.poradatel;
  focusMarker = L.marker([v.lat, v.lon], {zIndexOffset: 2000, interactive: false,
    icon: L.divIcon({className: "", iconSize: [44, 58], iconAnchor: [22, 57],
      html: `<div class="focuspin">${PIN(css("--accent"), 44, 58)}<span class="focuslabel">${esc(label)}</span></div>`})}).addTo(map);
}
const SVAZY = /^(praha|středočeský|jihočeský|západočeský|severočeský|východočeský|jihomoravský|severomoravský|čts)$/i;
function venueTitle(v) {
  if (v.nazev_mista && v.presnost === "areal") return v.nazev_mista;
  if (SVAZY.test((v.poradatel || "").trim()) && v.adresa) return v.adresa.split(",").pop().trim();
  return v.poradatel;
}
function openVenue(vi, opt = {}) {
  const v = VEN[vi];
  lastVenue = vi;
  const all = byVenue.get(vi) || [];
  const match = all.filter(e => evMatches(e, {ignoreRadius: true}));
  const other = all.filter(e => !match.includes(e) && (e.do || e.od) >= iso(today));
  const groups = new Map();
  for (const e of match) { const k = e.od + "|" + e.do; (groups.get(k) || groups.set(k, []).get(k)).push(e); }
  let [pc, pt] = PREC[v.presnost] || PREC.nezname;
  if (v.presnost === "adresa") [pc, pt] = v.zdroj === "detail" ? ["ok", "Adresa místa konání podle ČTS"] : ["mid", "Adresa klubu (místo konání zatím neuvedeno)"];
  if (v.presnost === "areal" && v.zdroj === "detail") pt = "Adresa podle ČTS, ověřeno v mapě";
  // Mapy.com URL API: souřadnice v pořadí lon,lat (developer.mapy.com – Mapy.cz URL); start = poloha z GPS, jinak ho doplní aplikace
  const start = F.centerMode === "gps" && F.center ? `start=${F.center[1]},${F.center[0]}&` : "";
  const nav = v.lat != null ? `<div class="links">
    <a class="pri" href="https://mapy.com/fnc/v1/route?${start}end=${v.lon},${v.lat}&routeType=car_fast_traffic&navigate=true" target="_blank" rel="noopener">Navigovat · Mapy.com</a>
    <a href="https://www.google.com/maps/dir/?api=1&destination=${v.lat},${v.lon}&travelmode=driving" target="_blank" rel="noopener">Google Maps</a>
    <a href="https://mapy.com/fnc/v1/showmap?center=${v.lon},${v.lat}&zoom=17&marker=true" target="_blank" rel="noopener">Ukázat v Mapy.com</a></div>` : "";
  let html = `<div class="venue"><h2>${esc(venueTitle(v))}</h2>
    <div class="addr">${SVAZY.test((v.poradatel || "").trim()) ? "Pořadatel: " + esc(v.poradatel) + (v.poradatel === "ČTS" ? "" : " oblastní svaz") : esc(v.poradatel)}${v.adresa ? " · " + esc(v.adresa) : ""}${v.region ? " · " + esc(v.region) : ""}</div>
    <span class="prec ${pc}">${esc(pt)}</span>${v.poznamka ? `<div class="muted">${esc(v.poznamka)}</div>` : ""}${nav}
    <span class="reportlink" data-report-venue="${vi}">Nahlásit špatné místo nebo údaje</span></div>`;
  if (!groups.size) html += `<div class="empty">Žádný turnaj tohoto místa neodpovídá filtrům.</div>`;
  for (const [, evs] of [...groups].sort()) {
    const ncat = new Set(evs.map(e => e.kat)).size, ncomp = evs.reduce((a, e) => a + (e.km ? 1 : 0) + (e.kz ? 1 : 0), 0);
    html += `<div class="group"><h4>${esc(fmtRange(evs[0].od, evs[0].do))}</h4>${ncomp > 1 ? `<div class="concur">Souběh: ${ncomp} soutěží${ncat > 1 ? ` v ${ncat} kategoriích` : ""} ve stejném termínu</div>` : ""}
      ${evs.map(card).join("")}</div>`;
  }
  if (other.length) html += `<details class="group"><summary>Další turnaje v tomto místě mimo filtr (${other.length})</summary>${other.map(card).join("")}</details>`;
  $("#detailBody").innerHTML = html;
  bind($("#detailBody"));
  $("#summary").innerHTML = esc(venueTitle(v));
  showPanel("detail");
  if (!isDesk()) setSnap("half");
  setFocus(v);
  if (v.lat != null && opt.move !== false) showLatLng([v.lat, v.lon], Math.max(map.getZoom(), 15));
  else if (v.lat != null) showLatLng([v.lat, v.lon]);
  if (opt.focus) setTimeout(() => document.getElementById("c-" + opt.focus)?.scrollIntoView({block: "start", behavior: "smooth"}), 60);
}
function renderList() {
  let xs = shown.slice();
  if (sortMode === "dist" && F.center && F.centerMode !== "none") xs.sort((a, b) => dist(a) - dist(b));
  $("#listBody").innerHTML = xs.length ? xs.slice(0, 300).map(item).join("") + (xs.length > 300 ? `<div class="empty">Zobrazeno prvních 300 – zužte filtr.</div>` : "") : `<div class="empty">Filtrům neodpovídá žádný turnaj.</div>`;
  bind($("#listBody"));
}
function renderFavs() {
  const xs = EV.filter(e => FAV.has(e.id)).sort((a, b) => (a.od || "").localeCompare(b.od || ""));
  const gone = [...FAV].filter(id => !EV.some(e => e.id === id));
  $("#favBody").innerHTML = (xs.length ? xs.map(item).join("") : `<div class="empty">Zatím žádné oblíbené – přidáte je hvězdičkou u turnaje.</div>`) +
    (gone.length ? `<div class="muted">${gone.length} oblíbených turnajů už v datech není.</div>` : "");
  bind($("#favBody"));
}
function shareFavs() {
  if (!FAV.size) return toast("Nejdřív přidejte oblíbené turnaje.");
  const url = location.origin + location.pathname + "#obl=" + [...FAV].join(",");
  if (navigator.share) navigator.share({title: "Moje tenisové turnaje", url}).catch(() => {});
  else navigator.clipboard?.writeText(url).then(() => toast("Odkaz zkopírován."), () => prompt("Odkaz:", url));
}
function icsFavs() {
  const xs = EV.filter(e => FAV.has(e.id) && e.od && e.st !== "zruseno");
  if (!xs.length) return toast("Žádné oblíbené turnaje k exportu.");
  const d = s => s.replace(/-/g, ""), esI = s => String(s).replace(/[,;\\]/g, m => "\\" + m).replace(/\n/g, "\\n");
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//TenisMapa//CS", "CALSCALE:GREGORIAN"];
  for (const e of xs) { const v = VEN[e.misto] || {};
    lines.push("BEGIN:VEVENT", `UID:${e.id}@tenismapa`, `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").slice(0, 15)}Z`, `DTSTART;VALUE=DATE:${d(e.od)}`,
      `DTEND;VALUE=DATE:${d(iso(addDays(pd(e.do || e.od), 1)))}`, `SUMMARY:${esI(`${e.tr === "MCR" ? "MČR" : e.tr} ${CAT_SHORT[e.kat]} – ${e.nz || e.por}`)}`,
      `LOCATION:${esI([v.nazev_mista, v.adresa].filter(Boolean).join(", "))}`, `DESCRIPTION:${esI(`${e.por}\n${CTS}${e.km || e.kz}?sezona=${DATA.meta.sezona}&tab=seznam`)}`, "END:VEVENT"); }
  lines.push("END:VCALENDAR");
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([lines.join("\r\n")], {type: "text/calendar"})); a.download = "tenisove-turnaje.ics"; a.click();
}
function importFromHash() {
  const m = location.hash.match(/obl=([^&]+)/); if (!m) return;
  const ids = decodeURIComponent(m[1]).split(",").filter(id => EV.some(e => e.id === id));
  history.replaceState(null, "", location.pathname);
  if (!ids.length) return;
  const box = $("#favImport"); box.hidden = false;
  box.innerHTML = `<div class="card">Sdílený seznam obsahuje <b>${ids.length}</b> turnajů.<div class="links"><a href="#" class="pri" id="impAdd">Přidat do mých oblíbených</a><a href="#" id="impNo">Ne</a></div></div>`;
  $("#impAdd").onclick = ev => { ev.preventDefault(); ids.forEach(i => FAV.add(i)); LS.set("tm.fav", [...FAV]); box.hidden = true; showPanel("favs"); };
  $("#impNo").onclick = ev => { ev.preventDefault(); box.hidden = true; };
  showPanel("favs");
}

/* ---------- nahlášení problému ---------- */
let shot = null, repType = "";
function loadH2C() {
  if (window.html2canvas) return Promise.resolve();
  return loadH2C.p ||= new Promise((ok, err) => { const sc = document.createElement("script"); sc.src = "vendor/html2canvas.min.js"; sc.onload = ok; sc.onerror = err; document.head.appendChild(sc); });
}
async function captureScreen() {
  await loadH2C();
  const canvas = await html2canvas(document.body, {useCORS: true, logging: false, backgroundColor: css("--bg") || "#fff",
    x: 0, y: 0, width: innerWidth, height: innerHeight, windowWidth: innerWidth, windowHeight: innerHeight, scale: Math.min(2, devicePixelRatio || 1),
    ignoreElements: el => el.id === "toast"});
  return new Promise(ok => canvas.toBlob(b => ok(b), "image/jpeg", .82));
}
function setShot(blob) {
  shot = blob;
  $("#repShot").hidden = !blob;
  if (blob) $("#repImg").src = URL.createObjectURL(blob);
  syncReportButtons();
}
function ctxLines() {
  const L1 = [];
  const e = ctx.ev ? EV.find(x => x.id === ctx.ev) : null;
  const vi = e ? e.misto : ctx.venue;
  const v = vi != null ? VEN[vi] : null;
  if (e) L1.push(`Turnaj: ${e.nz || e.por} | ${CAT_SHORT[e.kat]} | ${e.txt} | třída ${e.tr || "-"} | kódy ${[e.km, e.kz].filter(Boolean).join(", ")} | ${e.st === "zruseno" ? "ZRUŠENO" : "aktivní"}`,
    `Odkaz ČTS: ${CTS}${e.km || e.kz}?sezona=${DATA.meta.sezona}&tab=seznam`);
  if (v) L1.push(`Místo: ${v.nazev_mista || "-"} | pořadatel ${v.poradatel} | adresa ${v.adresa || "-"} | přesnost ${v.presnost}/${v.zdroj} | ${v.lat ?? "-"},${v.lon ?? "-"}`);
  const c = map.getCenter();
  L1.push(`Mapa: ${c.lat.toFixed(5)},${c.lng.toFixed(5)} z${map.getZoom()} | panel ${reportFrom}`,
    `Filtry: od ${F.from}${F.to ? " do " + F.to : ""}; kat ${F.cat.join(",") || "vše"}; třída ${F.cls.join(",") || "vše"}; povrch ${F.surf.join(",") || "vše"}; okruh ${F.centerMode === "none" ? "ne" : F.radius + " km"}; text "${F.text}"`,
    `Data: ${DATA.meta.aktualizace} | aplikace ${APP_VERSION} | ${navigator.userAgent.replace(/\s+/g, " ").slice(0, 140)}`);
  return L1;
}
function renderCtx() {
  const e = ctx.ev ? EV.find(x => x.id === ctx.ev) : null;
  const vi = e ? e.misto : ctx.venue, v = vi != null ? VEN[vi] : null;
  $("#repCtx").innerHTML = e ? `<b>${esc(e.nz || e.por)}</b>${esc(CAT_SHORT[e.kat])} · ${esc(fmtRange(e.od, e.do))} · kód ${esc(e.km || e.kz)}<div class="muted">${esc(v ? (v.nazev_mista || v.poradatel) + " · " + (v.adresa || "") : "")}</div>`
    : v ? `<b>${esc(v.nazev_mista && v.presnost === "areal" ? v.nazev_mista : v.poradatel)}</b>${esc(v.adresa || "adresa neuvedena")}<div class="muted">Místo na mapě · přesnost: ${esc((PREC[v.presnost] || PREC.nezname)[1])}</div>`
    : `<b>Obecné hlášení</b>Přiloží se aktuální výřez mapy a nastavené filtry.<div class="muted">Tip: pro konkrétní turnaj otevřete jeho detail a klepněte na „Nahlásit chybu“.</div>`;
}
function syncReportButtons() {
  const canShareFile = shot && navigator.canShare && navigator.canShare({files: [new File([shot], "snimek.jpg", {type: "image/jpeg"})]});
  $("#repSend").textContent = shot && canShareFile ? "Odeslat se snímkem" : "Odeslat e-mailem";
  $("#repSaveShot").hidden = !shot || canShareFile;
  $("#repSend").disabled = !REPORT_EMAIL;
  $("#repNote").textContent = !REPORT_EMAIL ? "Adresa pro hlášení zatím není nastavená." :
    shot && canShareFile ? `Otevře se sdílení – vyberte Poštu (Mail). Adresát: ${REPORT_EMAIL}` :
    shot ? "Snímek se uloží do stažených souborů – přiložte ho prosím k e-mailu." : "";
}
async function openReport(c) {
  ctx = c || {};
  if (!ctx.ev && ctx.venue == null && panel === "detail") ctx.venue = lastVenue;
  const prevSnap = snap;
  setShot(null); repType = ""; $$("#repType button").forEach(b => b.classList.remove("on"));
  // snímek obrazovky v podobě, jakou uživatel právě vidí (před otevřením formuláře)
  try { toast("Pořizuji snímek obrazovky…"); setShot(await captureScreen()); $("#toast").hidden = true; } catch { $("#toast").hidden = true; }
  renderCtx();
  showPanel("report");
  setSnap(isDesk() ? "full" : "full");
  void prevSnap;
}
function reportText() {
  const desc = $("#repText").value.trim();
  return [`Typ: ${repType || "neuvedeno"}`, "", desc || "(bez popisu)", "", "— kontext (vyplněno automaticky) —", ...ctxLines()].join("\n");
}
function reportSubject() {
  const e = ctx.ev ? EV.find(x => x.id === ctx.ev) : null, v = (e ? VEN[e.misto] : ctx.venue != null ? VEN[ctx.venue] : null);
  return `Tenisová mapa – ${repType || "hlášení"}${e ? ": " + (e.nz || e.por) + " " + e.txt : v ? ": " + v.poradatel : ""}`;
}
function openMail(body) {
  const b = body.length > 1800 ? body.slice(0, 1800) + "\n…" : body;
  location.href = `mailto:${REPORT_EMAIL}?subject=${encodeURIComponent(reportSubject())}&body=${encodeURIComponent(b)}`;
}
function downloadShot() {
  const a = document.createElement("a"); a.href = URL.createObjectURL(shot); a.download = `tenisova-mapa-snimek-${iso(new Date())}.jpg`; a.click();
}
$$("#repType button").forEach(b => b.onclick = () => { repType = repType === b.dataset.t ? "" : b.dataset.t; $$("#repType button").forEach(x => x.classList.toggle("on", x.dataset.t === repType)); });
$("#repCapture").onclick = async () => {
  // zachytí mapu bez formuláře: panel se dočasně stáhne
  const keep = snap; if (!isDesk()) setSnap("peek");
  await new Promise(r => setTimeout(r, 450));
  try { setShot(await captureScreen()); } catch { toast("Snímek se nepodařilo pořídit – vyberte obrázek z galerie."); }
  setSnap(keep);
};
$("#repFile").onchange = e => { const f = e.target.files?.[0]; if (f) setShot(f); e.target.value = ""; };
$("#repShotDel").onclick = () => setShot(null);
$("#repSaveShot").onclick = () => shot && downloadShot();
$("#repSend").onclick = async () => {
  if (!REPORT_EMAIL) return;
  if (!$("#repText").value.trim() && !repType) { toast("Vyberte typ problému nebo napište krátký popis."); return; }
  const body = reportText();
  const file = shot ? new File([shot], `tenisova-mapa-${iso(new Date())}.jpg`, {type: shot.type || "image/jpeg"}) : null;
  if (file && navigator.canShare && navigator.canShare({files: [file]})) {
    try { await navigator.share({files: [file], title: reportSubject(), text: `Komu: ${REPORT_EMAIL}\nPředmět: ${reportSubject()}\n\n${body}`}); toast("Děkujeme za hlášení!"); return; }
    catch (err) { if (err && err.name === "AbortError") return; }
  }
  if (file) downloadShot();
  openMail(body);
  toast("Děkujeme za hlášení!");
};

/* ---------- vyhledání místa (Nominatim) ---------- */
$("#placeForm").onsubmit = async ev => {
  ev.preventDefault();
  const q = $("#placeQ").value.trim(); if (!q) return;
  $("#placeRes").innerHTML = '<div class="muted">Hledám…</div>';
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&countrycodes=cz&limit=6&accept-language=cs&q=${encodeURIComponent(q)}`);
    const js = await r.json();
    $("#placeRes").innerHTML = js.length ? "" : '<div class="muted">Nic nenalezeno.</div>';
    for (const x of js) { const b = document.createElement("button"); b.type = "button"; b.textContent = x.display_name;
      b.onclick = () => { $("#placeRes").innerHTML = ""; $("#placeQ").value = ""; setCenter([+x.lat, +x.lon], "pick", x.display_name.split(",").slice(0, 2).join(",")); };
      $("#placeRes").appendChild(b); }
  } catch { $("#placeRes").innerHTML = '<div class="muted">Vyhledávání se nepodařilo.</div>'; }
};

/* ---------- události UI ---------- */
$$("#tabs button").forEach(t => t.onclick = e => { e.stopPropagation(); t.dataset.panel === "report" ? openReport({venue: panel === "detail" ? lastVenue : null}) : showPanel(t.dataset.panel); });
$("#btnBack").onclick = e => {
  e.stopPropagation();
  if (panel === "report" && reportFrom === "detail" && lastVenue != null) return openVenue(lastVenue, {move: false});
  showPanel(panel === "report" ? (reportFrom === "detail" ? prevPanel : reportFrom) : prevPanel);
};
$("#btnFilters").onclick = () => { showPanel("filters"); setSnap("full"); };
$("#fFrom").onchange = e => { F.from = e.target.value || iso(today); render(); };
$("#fTo").onchange = e => { F.to = e.target.value; render(); };
$$("#datePresets button").forEach(b => b.onclick = () => presets(b.dataset.p));
$("#fRadius").oninput = e => { F.radius = +e.target.value; $("#radiusVal").textContent = F.radius + " km"; drawCircle(); clearTimeout(render.t); render.t = setTimeout(render, 150); };
$("#fText").oninput = e => { F.text = e.target.value.trim(); clearTimeout(render.t); render.t = setTimeout(() => { render(); if (panel !== "list" && F.text) showPanel("list"); }, 250); };
$("#fText").onkeydown = e => { if (e.key === "Enter") { e.target.blur(); showPanel("list"); } };
$("#fFree").onchange = e => { F.free = e.target.checked; render(); };
$("#fCancelled").onchange = e => { F.cancelled = e.target.checked; render(); };
$("#fGuess").onchange = e => { F.guess = e.target.checked; render(); };
$$("#fCenterMode button").forEach(b => b.onclick = () => {
  const c = b.dataset.c;
  if (c === "none") { F.centerMode = "none"; render(); }
  if (c === "gps") locate();
  if (c === "pick") setPick(true);
});
$("#btnLocate").onclick = () => F.centerMode === "gps" ? (F.centerMode = "none", render()) : locate();
$("#btnPick").onclick = () => setPick(!pickMode);
$("#btnLegend").onclick = () => $("#legend").hidden = !$("#legend").hidden;
$("#btnReset").onclick = () => { F = defaults(); render(); };
$("#btnShow").onclick = () => { showPanel("list"); if (!isDesk()) setSnap("peek"); };
$$("#listSort button").forEach(b => b.onclick = () => { sortMode = b.dataset.s; if (sortMode === "dist" && (!F.center || F.centerMode === "none")) toast("Nejdřív nastavte okruh – polohu nebo bod v mapě."); $$("#listSort button").forEach(x => x.classList.toggle("on", x === b)); renderList(); });
$("#btnShare").onclick = shareFavs;
$("#btnIcs").onclick = icsFavs;
$("#btnFavMap").onclick = () => { F.favOnly = !F.favOnly; render(); };

/* ---------- start ---------- */
setSnap("peek");
fetch("data/turnaje.json", {cache: "no-cache"}).then(r => r.json()).then(js => {
  DATA = js; EV = js.turnaje; VEN = js.mista;
  for (const e of EV) (byVenue.get(e.misto) || byVenue.set(e.misto, []).get(e.misto)).push(e);
  const upd = new Date(js.meta.aktualizace);
  $("#fText").placeholder = `Hledat turnaj… (data ${upd.getDate()}. ${upd.getMonth() + 1}.)`;
  buildFilterUI(); render(); importFromHash();
  setTimeout(() => loadH2C().catch(() => {}), 4000);
  if (isDesk()) setSnap("full");
  if (F.center && F.centerMode !== "none") fitVisible(L.latLng(F.center).toBounds(F.radius * 2000));
  else fitVisible(L.latLngBounds(CZ));
}).catch(err => { $("#summary").textContent = "Data se nepodařilo načíst: " + err; });
if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => {});
})();
