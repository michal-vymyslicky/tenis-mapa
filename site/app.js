/* Tenisová mapa turnajů ČTS – klient (bez build kroku). Data: data/turnaje.json (pipeline/update.py). */
(() => {
"use strict";
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const CTS = "https://cesky-tenis.cz/turnaj/";
const APP_VERSION = "v2.9";
const TEURL = "https://te.tournamentsoftware.com/sport/tournament?id=";
const T = window.I18N ? I18N.t : (s, v) => v ? s.replace(/\{(\w+)\}/g, (m, k) => v[k] ?? m) : s;
const EN = !!(window.I18N && I18N.en);
if (window.I18N) I18N.applyDOM();
/* adresa pro hlášení problémů – rozdělená kvůli robotům sbírajícím e-maily; prázdné = tlačítko vypnuto */
const REPORT_EMAIL = ["tenisova-mapa", "seznam.cz"].filter(Boolean).join("@");
/* FormSubmit (formsubmit.co): po první zprávě přijde na REPORT_EMAIL aktivační e-mail; pak lze adresu nahradit aliasem, který FormSubmit pošle */
const REPORT_FORM = REPORT_EMAIL;
const CLASS_ORDER = ["MCR", "A", "B", "P", "C", "D", "E", "", "TS", "TEC", "TM", "T1", "T2", "T3", "TF", "TI", "TSS", "TX"];
const TE_CLS = new Set(["TS", "TEC", "TM", "T1", "T2", "T3", "TF", "TI", "TSS", "TX"]);
/* písmeno ve špendlíku / štítek třídy */
const PIN_LAB = {MCR: "MČR", TS: "S", TEC: "EC", TM: "M", T1: "1", T2: "2", T3: "3", TF: "F", TI: "I", TSS: "SS", TX: "TE"};
const clsShort = tr => TE_CLS.has(tr) ? "TE " + PIN_LAB[tr] : tr === "MCR" ? "MČR" : tr || "–";
const flag = cc => cc && cc.length === 2 ? String.fromCodePoint(...[...cc.toUpperCase()].map(c => 127397 + c.charCodeAt(0))) : "";
const CLASS_LABEL = {MCR: T("MČR"), A: "A", B: "B", P: T("P – přebor"), C: "C", D: "D", E: "E", "": T("bez třídy"),
  TS: "TE Super Category", TEC: T("TE mistrovství Evropy"), TM: "TE Masters", T1: T("TE kategorie 1"), T2: T("TE kategorie 2"), T3: T("TE kategorie 3"),
  TF: "TE Festival", TI: "TE Invitational", TSS: "TE Small States", TX: T("TE ostatní")};
const CAT_ORDER = ["mladsi-zactvo", "starsi-zactvo", "dorost", "dospeli", "babytenis", "stredni-kurt", "minitenis"];
const CAT_SHORT = Object.fromEntries(Object.entries({"dospeli": "Dospělí", "dorost": "Dorost", "starsi-zactvo": "Starší žactvo", "mladsi-zactvo": "Mladší žactvo", "babytenis": "Babytenis", "stredni-kurt": "Střední kurt", "minitenis": "Minitenis"}).map(([k, v]) => [k, T(v)]));
const CAT_QUICK = EN ? {"mladsi-zactvo": "U12", "starsi-zactvo": "U14", "dorost": "U18", "dospeli": "Adults", "babytenis": "Babytennis", "stredni-kurt": "Midcourt", "minitenis": "Minitennis"}
  : {"mladsi-zactvo": "Ml. žactvo", "starsi-zactvo": "St. žactvo", "dorost": "Dorost", "dospeli": "Dospělí", "babytenis": "Babytenis", "stredni-kurt": "Střední kurt", "minitenis": "Minitenis"};
/* zobrazení povrchu v jazyce aplikace (klíče filtrů zůstávají české) */
const surfLabel = g => T(g);
const rawSurf = r => { if (!EN || !r) return r; const k = r.toLowerCase(), t = T(k); return t === k ? r : t; };
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
  if (/umělá antuka|artificial clay/.test(s)) return "Umělá antuka";
  if (/^clay$|red clay|green clay/.test(s)) return "Antuka";
  if (/acryl|asphalt|concrete|hard|resin/.test(s)) return "Tvrdý";
  if (/antuk/.test(s)) return "Antuka";
  if (/kober|carpet/.test(s)) return "Koberec";
  if (/tráv|grass/.test(s)) return "Umělá tráva";
  if (/cushion|turf|acryl|akryl|hard|plexi|beton/.test(s)) return "Tvrdý";
  return "Jiný";
}
const PREC = {areal: ["ok", T("Místo ověřeno – tenisový areál v mapě")], rucne: ["ok", T("Místo ručně ověřeno")], adresa: ["mid", T("Bod adresy (areál v mapě nenalezen)")],
  areal_obec: ["mid", T("Tenisový areál v obci – neověřeno")], obec: ["mid", T("Jen obec – přesné místo neznámé")],
  odhad: ["bad", T("Odhad: místo loňského ročníku")], nezname: ["bad", T("Místo neznámé")]};
const DOW = EN ? ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] : ["Ne", "Po", "Út", "St", "Čt", "Pá", "So"];
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const LS = {get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
            set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }};
const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const colorOf = (tr, zr) => zr ? css("--c-zr") : css("--c-" + (CLASS_ORDER.includes(tr) && tr ? tr : "x"));
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c]));
const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const pd = s => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const dShort = s => { const a = pd(s); return EN ? `${a.getDate()} ${MON[a.getMonth()]}` : `${a.getDate()}. ${a.getMonth() + 1}.`; };
function fmtRange(od, d2, short) {
  if (!od) return "";
  if (EN) {
    const a = pd(od), b = pd(d2 || od), y = short ? "" : " " + b.getFullYear();
    if (od === d2 || !d2) return `${DOW[a.getDay()]} ${a.getDate()} ${MON[a.getMonth()]}${y}`;
    if (a.getMonth() === b.getMonth()) return `${DOW[a.getDay()]}–${DOW[b.getDay()]} ${a.getDate()}–${b.getDate()} ${MON[b.getMonth()]}${y}`;
    return `${DOW[a.getDay()]} ${a.getDate()} ${MON[a.getMonth()]} – ${DOW[b.getDay()]} ${b.getDate()} ${MON[b.getMonth()]}${y}`;
  }
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
const nf = n => n.toLocaleString(EN ? "en-GB" : "cs-CZ");
/* čas prezentace z ČTS („Pá do 18:00 hod.“) */
const DOW_CS = {Po: "Mon", Út: "Tue", St: "Wed", Čt: "Thu", Pá: "Fri", So: "Sat", Ne: "Sun"};
const prezText = s => !EN || !s ? s : s.replace(/(^|[\s,(])(Po|Út|St|Čt|Pá|So|Ne)(?=[\s.,]|$)/g, (m, a, d) => a + DOW_CS[d]).replace(/\bdo\b/g, "until").replace(/\s*hod\.?/g, "").trim();
/* poznámka k místu z pipeline (česky) */
const noteText = s => !EN || !s ? s : s.replace("místo podle ověřeného areálu klubu", T("místo podle ověřeného areálu klubu")).replace("místo podle rozpisu svazu", T("místo podle rozpisu svazu")).replace("ročník", T("ročník"));
function toast(t) { const el = $("#toast"); el.textContent = t; el.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => el.hidden = true, 2600); }
const isDesk = () => innerWidth >= 900;

/* ---------- stav ---------- */
let DATA, EV = [], VEN = [], byVenue = new Map();
const today = new Date(); today.setHours(0, 0, 0, 0);
const defaults = () => ({from: iso(today), to: "", cat: [], sex: [], cls: [], surf: [],
  text: "", free: false, cancelled: true, guess: true, favOnly: false, players: [], pmode: "entries", src: "cts"});
let F = Object.assign(defaults(), LS.get("tm.filters", {}));
// v2.8: okruh vzdálenosti zrušen; Tennis Europe je doplněk – výchozí zobrazení jen ČTS
for (const k of ["center", "centerMode", "centerLabel", "radius"]) delete F[k];
if (LS.get("tm.ui", 0) < 28) { F.src = "cts"; LS.set("tm.ui", 28); }
let MYPOS = null, myMarker = null, myCircle = null;   // poloha uživatele – jen zobrazení v mapě a vzdálenost v seznamu
let SEZ = null, SEZONY = [];          // vybraná sezóna a přehled sezón (data/sezony.json)
const sezInfo = () => SEZONY.find(x => x.id === SEZ) || {od: iso(today), do: "9999-12-31"};
const isArchive = () => sezInfo().do < iso(today);
const sezLabel = (x, short) => { let n = x.nazev || x.id; if (short) n = n.replace(/^zima (\d{2})(\d{2})\/(\d{2})/, "zima $2/$3"); if (EN) n = n.replace(/^zima/, "winter").replace(/^léto/, "summer"); return n[0].toUpperCase() + n.slice(1); };
const sezName = x => sezLabel(x || {});
const sezIcon = id => id[0] === "Z" ? "❄" : "☀";
F.surf = (F.surf || []).filter(s => /^[gr]:/.test(s));
F.players = F.players || []; F.pmode = F.pmode || "entries"; F.src = F.src || "cts";
let TEDATA = null;   // turnaje Tennis Europe (data/TE/turnaje.json) – přimíchají se do sezóny podle termínu
// oblíbené: ID turnaje obsahuje sezónu (od v2.4); starší ID bez sezóny patří k Z2627
let FAV = new Set(LS.get("tm.fav", []).map(id => /^([ZL]\d{2}|TE-)/.test(id) ? id : "Z2627-" + id));
let panel = "list", stack = [], popping = false;
const SUB = new Set(["detail", "report", "about", "player"]);
let ctx = {}, lastVenue = null;   // kontext pro hlášení problému

/* ---------- mapa ---------- */
const CZ = [[48.55, 12.09], [51.06, 18.86]];
const map = L.map("map", {zoomControl: false, attributionControl: true}).fitBounds(CZ);
if (isDesk()) L.control.zoom({position: "bottomright"}).addTo(map);
/* mapové podklady: automaticky (OSM v ČR, latinka v zahraničí), základní OSM, latinka (Esri), turistická (OpenTopoMap), letecká (Esri) */
const DATA_ATTR = ' · data <a href="https://cesky-tenis.cz">ČTS</a>, <a href="https://www.tenniseurope.org">Tennis Europe</a>';
const OSM_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
const ESRI = "https://server.arcgisonline.com/ArcGIS/rest/services/";
const BASES = {
  osm: () => L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {maxZoom: 19, crossOrigin: true, attribution: OSM_ATTR + DATA_ATTR}),
  latin: () => L.tileLayer(ESRI + "World_Street_Map/MapServer/tile/{z}/{y}/{x}", {maxZoom: 19, crossOrigin: true,
    attribution: "Tiles &copy; Esri – Esri, HERE, Garmin, " + OSM_ATTR + DATA_ATTR}),
  topo: () => L.tileLayer("https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png", {maxZoom: 17, subdomains: "abc", crossOrigin: true,
    attribution: OSM_ATTR + ', SRTM · styl <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)' + DATA_ATTR}),
  aerial: () => L.layerGroup([
    L.tileLayer(ESRI + "World_Imagery/MapServer/tile/{z}/{y}/{x}", {maxZoom: 19, crossOrigin: true,
      attribution: "Tiles &copy; Esri – Esri, Maxar, Earthstar Geographics" + DATA_ATTR}),
    L.tileLayer(ESRI + "Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}", {maxZoom: 19, crossOrigin: true})]),
};
const BASE_LABEL = {auto: "Automaticky", osm: "Základní", latin: "Latinka", topo: "Turistická", aerial: "Letecká"};
const BASE_HINT = {auto: "OpenStreetMap v ČR, v zahraničí popisky latinkou", osm: "OpenStreetMap – místní písmo (v Srbsku azbuka)",
  latin: "Esri – všechny názvy latinkou", topo: "OpenTopoMap – vrstevnice, turistické trasy", aerial: "Esri – satelitní snímky s popisky"};
let baseMode = LS.get("tm.map", "auto"), baseKey = null, baseLayer = null;
const inCZ = c => c.lat > 48.4 && c.lat < 51.2 && c.lng > 11.9 && c.lng < 19.0;
function applyBase() {
  let c = map.getCenter();
  try { const r = visibleRect(); c = map.containerPointToLatLng([(r.left + r.right) / 2, (r.top + r.bottom) / 2]); } catch {}
  const want = baseMode === "auto" ? (inCZ(c) ? "osm" : "latin") : baseMode;
  if (want === baseKey) return;
  const nl = BASES[want]();
  nl.addTo(map);
  if (baseLayer) map.removeLayer(baseLayer);
  baseLayer = nl; baseKey = want;
  document.body.classList.toggle("map-photo", want === "topo" || want === "aerial");
}
applyBase();
map.on("moveend", () => { if (baseMode === "auto") applyBase(); });
const cluster = L.markerClusterGroup({maxClusterRadius: 42, showCoverageOnHover: false, spiderfyOnMaxZoom: true,
  iconCreateFunction: c => { const n = c.getChildCount(); const s = n < 10 ? 34 : n < 50 ? 40 : 46;
    return L.divIcon({html: `<div class="cluster" style="width:${s}px;height:${s}px">${n}</div>`, className: "", iconSize: [s, s]}); }});
map.addLayer(cluster);
let focusMarker = null;
const PIN = (color, w = 30, h = 40) => `<svg viewBox="0 0 30 40" width="${w}" height="${h}"><path d="M15 1C7.3 1 1 7.1 1 14.7 1 25 15 39 15 39s14-14 14-24.3C29 7.1 22.7 1 15 1z" fill="${color}"/></svg>`;
/* špendlík: barva i písmeno = nejvyšší třída v místě (MČR, A, B, P, C, D, E), bublina = počet turnajů */
function pinIcon(color, n, guess, fav, cls) {
  const lab = PIN_LAB[cls] || cls || "–";
  return L.divIcon({html: `<div class="pin${guess ? " guess" : ""}${fav ? " fav" : ""}${TE_CLS.has(cls) ? " te" : ""}">${PIN(color)}<b class="${lab.length > 1 ? "long" : ""}">${lab}</b>${n > 1 ? `<i class="cnt">${n}</i>` : ""}</div>`,
    className: "", iconSize: [30, 40], iconAnchor: [15, 39]});
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
  if (F.src !== "all" && (e.src === "te") !== (F.src === "te")) return false;
  if (F.cat.length && !(e.kats || [e.kat]).some(k => F.cat.includes(k))) return false;
  if (F.sex.length && !e.mix && !((F.sex.includes("m") && e.km) || (F.sex.includes("z") && e.kz))) return false;
  if (F.cls.length && !F.cls.includes(e.tr || "")) return false;
  if (!surfMatch(e)) return false;
  if (F.free && !hasFree(e)) return false;
  const v = VEN[e.misto];
  if (!F.guess && v && (v.presnost === "odhad" || v.presnost === "nezname")) return false;
  if (F.text) { const t = F.text.toLowerCase(); if (!(`${e.nz} ${e.por} ${v?.adresa || ""} ${v?.nazev_mista || ""} ${e.km} ${e.kz}`.toLowerCase().includes(t))) return false; }
  if (F.favOnly && !FAV.has(e.id)) return false;
  if (F.players.length && HR) {
    if (F.pmode === "entries" || isArchive()) { if (!F.players.some(pid => entrySet(pid).has(e.id))) return false; }
    else if (!F.players.some(pid => eligible(pid, e))) return false;
  }
  return true;
}
function occOf(e) {
  const xs = [];
  if (e.km) xs.push(e.om || (e.kap ? [e.pm || 0, e.kap] : null));
  if (e.kz) xs.push(e.oz || (e.kap ? [e.pz || 0, e.kap] : null));
  return xs;
}
const hasFree = e => e.src === "te" || occOf(e).some(o => !o || o[0] < o[1]);
function occText(o, p, kap) {
  if (o) return {t: `${o[0]} / ${o[1]}`, pct: o[1] ? o[0] / o[1] : 0};
  if (p != null && kap) return {t: `${p} / ${kap}`, pct: p / kap};
  return {t: kap ? `– / ${kap}` : "–", pct: 0};
}

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
    const m = L.marker([v.lat, v.lon], {icon: pinIcon(colorOf(best, !active.length), evs.length, ["odhad", "obec", "areal_obec"].includes(v.presnost), evs.some(e => FAV.has(e.id)), best),
      title: `${v.nazev_mista || v.poradatel} (${evs.length})`});
    m.on("click", () => openVenue(vi, {move: false}));
    markers.push(m);
  }
  cluster.addLayers(markers);
  const noLoc = shown.filter(e => { const v = VEN[e.misto]; return !v || v.lat == null; }).length;
  $("#summary").innerHTML = panel === "detail" ? $("#summary").innerHTML : `${nf(shown.length)} ${T("turnajů")} <small>· ${vmap.size} ${T("míst")}${noLoc ? ` · ${noLoc} ${T("bez místa")}` : ""}</small>`;
  $("#countBadge").textContent = nf(shown.length);
  $("#showCount").textContent = `(${nf(shown.length)})`;
  const nfil = [F.cat.length, F.sex.length, F.cls.length, F.surf.length, F.to, F.free, F.favOnly, !F.cancelled, !F.guess, F.src !== "cts"].filter(Boolean).length;
  $("#filterBadge").hidden = !nfil; $("#filterBadge").textContent = nfil; $("#filterBadge2").textContent = nfil || "";
  $("#favBadge").textContent = FAV.size || "";
  renderQuick(); syncFilterUI();
  if (panel === "list") renderList();
  if (panel === "favs") renderFavs();
}
/* moje poloha: modrá tečka + kruh přesnosti, bez filtrování */
function drawMyPos(acc) {
  if (myMarker) { map.removeLayer(myMarker); myMarker = null; }
  if (myCircle) { map.removeLayer(myCircle); myCircle = null; }
  if (!MYPOS) return;
  if (acc) myCircle = L.circle(MYPOS, {radius: Math.min(acc, 3000), color: css("--accent2"), weight: 1, fillOpacity: .08, interactive: false}).addTo(map);
  myMarker = L.marker(MYPOS, {icon: L.divIcon({html: '<div class="center-dot"></div>', className: "", iconSize: [16, 16], iconAnchor: [8, 8]}), interactive: false, zIndexOffset: 1500}).addTo(map);
}

/* ---------- rychlé volby + filtry ---------- */
function renderQuick() {
  const q = $("#quick");
  const dateTxt = F.to ? `${dShort(F.from)} – ${dShort(F.to)}` : F.from === iso(today) ? T("Od dnes") : F.from <= sezInfo().od ? T("Celá sezóna") : `${T("Od")} ${dShort(F.from)}`;
  const counts = {}; for (const e of EV) counts[e.kat] = (counts[e.kat] || 0) + 1;
  q.innerHTML = (SEZONY.length > 1 ? `<button class="season${isArchive() ? " arch" : ""}" data-q="season">${sezIcon(SEZ)} ${esc(sezLabel(sezInfo(), true))} ▾</button>` : "") + `<button class="date" data-q="date"><svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>${dateTxt}</button>` +
    CAT_ORDER.filter(k => counts[k]).map(k => `<button data-q="${k}" class="${F.cat.includes(k) ? "on" : ""}">${CAT_QUICK[k]}</button>`).join("") +
    (TEDATA && TEDATA.turnaje.length ? `<button class="te${F.src !== "cts" ? " on" : ""}" data-q="te">🇪🇺 ${F.src === "te" ? T("Jen Tennis Europe") + " ✕" : F.src === "all" ? "+ Tennis Europe ✕" : "+ Tennis Europe"}</button>` : "") +
    (F.favOnly ? `<button class="on" data-q="fav">★ ${T("Oblíbené")} ✕</button>` : "");
  q.insertAdjacentHTML("afterbegin", F.players.map(pid => `<button class="on player" data-q="pl:${esc(pid)}">${PERSON}${esc(shortName(pid))}<span class="x" data-x="${esc(pid)}">✕</span></button>`).join(""));
  q.querySelectorAll(".x").forEach(x => x.onclick = ev => { ev.stopPropagation(); togglePlayer(x.dataset.x, false); });
  q.querySelectorAll("button").forEach(b => b.onclick = () => {
    const k = b.dataset.q;
    if (k === "date") { showPanel("filters"); setSnap("full"); return; }
    if (k === "season") return toggleSeasonMenu();
    if (k === "fav") { F.favOnly = false; return render(); }
    if (k === "te") { const on = F.src === "cts"; F.src = on ? "all" : "cts"; render(); if (on) { toast(T("Přidány mezinárodní turnaje Tennis Europe")); fitShown(); } else fitVisible(L.latLngBounds(CZ)); return; }
    if (k.startsWith("pl:")) return openPlayer(k.slice(3));
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
  chip("#fSex", [{v: "m", l: T("Chlapci / muži")}, {v: "z", l: T("Dívky / ženy")}], "sex");
  const tc = cnt(e => e.tr || "");
  chip("#fClass", CLASS_ORDER.filter(k => tc[k] && !TE_CLS.has(k)).map(k => ({v: k, l: CLASS_LABEL[k], n: tc[k], color: colorOf(k)})), "cls");
  chip("#fClassTE", CLASS_ORDER.filter(k => tc[k] && TE_CLS.has(k)).map(k => ({v: k, l: CLASS_LABEL[k], n: tc[k], color: colorOf(k)})), "cls");
  $$("#fClass button, #fClassTE button").forEach(b => b.style.setProperty("--c", colorOf(b.dataset.v)));
  const gc = cnt(e => surfGroup(e.pov));
  const groups = Object.keys(gc).sort((a, b) => gc[b] - gc[a]);
  chip("#fSurf", groups.map(g => ({v: "g:" + g, l: surfLabel(g), n: gc[g]})), "surf");
  const rc = cnt(e => (e.pov || "").toLowerCase());
  const disp = {}; for (const e of EV) if (e.pov) disp[e.pov.toLowerCase()] ??= e.pov;
  const box = $("#fSurfRaw"); box.innerHTML = "";
  for (const g of groups) {
    const raws = Object.keys(rc).filter(r => r && surfGroup(r) === g).sort((a, b) => rc[b] - rc[a]);
    if (raws.length < 2) continue;
    const wrap = document.createElement("div"); wrap.className = "subgrp"; wrap.innerHTML = `<h4>${esc(surfLabel(g))}</h4>`;
    const ch = document.createElement("div"); ch.className = "chips"; wrap.appendChild(ch); box.appendChild(wrap);
    chip(ch, raws.map(r => ({v: "r:" + r, l: rawSurf(disp[r] || r), n: rc[r]})), "surf");
  }
  $("#legend").innerHTML = `<b>${T("Třída turnaje <small>(klepnutím filtrujete)</small>")}</b>` + CLASS_ORDER.filter(k => tc[k] && (F.src !== "cts" || !TE_CLS.has(k))).map(k => `<button class="lg" data-k="cls" data-v="${k}" style="--c:${colorOf(k)}"><i style="background:${colorOf(k)}">${k === "MCR" ? "M" : PIN_LAB[k] || k || "–"}</i>${CLASS_LABEL[k]} <small>${tc[k]}</small></button>`).join("") +
    (F.src !== "cts" && CLASS_ORDER.some(k => TE_CLS.has(k) && tc[k]) ? `<div class="sep">🇪🇺 ${T("Tennis Europe – žlutý okraj špendlíku")}</div>` : "") + `<div><i style="background:${css("--c-zr")}"></i>${T("zrušeno")}</div><div><i class="ring"></i>${T("čárkovaně = místo odhadnuté")}</div><div>${T("písmeno ve špendlíku = nejvyšší třída v místě, bublina = počet turnajů")}</div>`;
}
function syncFilterUI() {
  $$(".chips button[data-k], #legend button.lg").forEach(b => b.classList.toggle("on", F[b.dataset.k].includes(b.dataset.v)));
  $("#fFrom").value = F.from || ""; $("#fTo").value = F.to || "";
  if (document.activeElement !== $("#fText")) $("#fText").value = F.text;
  $("#fFree").checked = F.free; $("#fCancelled").checked = F.cancelled; $("#fGuess").checked = F.guess;
  $$("#fSrc button").forEach(b => b.classList.toggle("on", b.dataset.src === F.src));
  $("#teClassBox").hidden = F.src === "cts" || !$("#fClassTE").children.length;
  $("#btnLocate").classList.toggle("on", !!MYPOS);
  $("#btnFavMap").classList.toggle("on", F.favOnly);
}
function presets(p) {
  const d = new Date(today), dow = d.getDay();
  const fri = addDays(d, dow === 6 ? -1 : dow === 0 ? -2 : (5 - dow + 7) % 7), sun = addDays(fri, 2);
  if (p === "weekend") { F.from = iso(fri < d ? d : fri); F.to = iso(sun); }
  if (p === "nextweekend") { F.from = iso(addDays(fri, 7)); F.to = iso(addDays(sun, 7)); }
  if (p === "d14") { F.from = iso(d); F.to = iso(addDays(d, 14)); }
  if (p === "d30") { F.from = iso(d); F.to = iso(addDays(d, 30)); }
  if (p === "all") { F.from = isArchive() ? sezInfo().od : iso(d); F.to = ""; }
  render();
}
function locate() {
  if (!navigator.geolocation) return toast(T("Prohlížeč neumí zjistit polohu."));
  toast(T("Zjišťuji polohu…"));
  navigator.geolocation.getCurrentPosition(p => {
      MYPOS = [p.coords.latitude, p.coords.longitude]; drawMyPos(p.coords.accuracy); $("#toast").hidden = true;
      if (!isDesk()) setSnap("peek");
      showLatLng(MYPOS, Math.max(map.getZoom(), 10)); render();
    },
    err => toast(err.code === 1 ? T("Přístup k poloze je zakázaný – povolte ho v nastavení prohlížeče.") : T("Polohu se nepodařilo zjistit.")),
    {enableHighAccuracy: true, timeout: 15000, maximumAge: 60000});
}
map.on("click", () => {
  if (!isDesk() && snap !== "peek") setSnap("peek");
});

/* ---------- spodní panel: tah, úchyty peek / half / full ---------- */
const sheet = $("#sheet");
let snap = "peek";
const fullH = () => innerHeight - $(".topbar").getBoundingClientRect().top - 8;
function snapPx(name) {
  const H = fullH(), peek = $("#sheetHead").offsetHeight + 2;
  return name === "peek" ? peek : name === "half" ? Math.max(peek + 140, Math.round(innerHeight * .5)) : H;
}
function sheetVisible() { return isDesk() ? 0 : snapPx(snap); }
function setSnap(name) {
  snap = name; sheet.dataset.snap = name;
  sheet.style.setProperty("--vis", snapPx(name) + "px");
  sheet.style.height = "";
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
    const vis = Math.min(fullH(), Math.max(snapPx("peek"), vis0 - dy));
    sheet.style.height = vis + "px";
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
  if (SUB.has(name)) { if (panel !== name && !popping) stack.push(panel); }
  else { stack = []; clearFocus(); }
  if (name === "about" || name === "player") clearFocus();
  panel = name;
  $$(".panel").forEach(p => p.classList.toggle("on", p.dataset.panel === name));
  $$("#tabs button").forEach(t => t.classList.toggle("on", t.dataset.panel === name));
  sheet.classList.toggle("detail", SUB.has(name) && name !== "report");
  $("#btnBack").hidden = !SUB.has(name);
  if (!SUB.has(name)) render();
  if (name === "report") $("#summary").textContent = T("Nahlásit problém");
  if (name === "about") $("#summary").textContent = T("O aplikaci");
  $("#sheetBody").scrollTop = 0;
  if (snap === "peek") setSnap(isDesk() ? "full" : "half"); else setSnap(snap);
}

function linkSet(e) {
  const out = [];
  const g = (e.mix ? ["Děti", ""] : e.kat === "dospeli" ? ["Muži", "Ženy"] : ["Chlapci", "Dívky"]).map(x => x ? " – " + T(x).toLowerCase() : "");
  const s = DATA.meta.sezona, done = (e.do || e.od || "9999") < iso(today);
  const pri = (cls) => done ? (cls === "res" ? ' class="pri"' : "") : (cls === "reg" ? ' class="pri"' : "");
  if (done) {
    if (e.km) out.push(`<a${pri("res")} href="${CTS}${e.km}?sezona=${s}" target="_blank" rel="noopener">${T("Výsledky")}${g[0]}</a>`);
    if (e.kz) out.push(`<a${pri("res")} href="${CTS}${e.kz}?sezona=${s}" target="_blank" rel="noopener">${T("Výsledky")}${g[1]}</a>`);
  }
  if (e.km) out.push(`<a${pri("reg")} href="${CTS}${e.km}?sezona=${s}&tab=seznam" target="_blank" rel="noopener">${T(done ? "Hráči" : "Přihlášky")}${g[0]}</a>`);
  if (e.kz) out.push(`<a${pri("reg")} href="${CTS}${e.kz}?sezona=${s}&tab=seznam" target="_blank" rel="noopener">${T(done ? "Hráči" : "Přihlášky")}${g[1]}</a>`);
  if (!done) {
    if (e.km) out.push(`<a href="${CTS}${e.km}?sezona=${s}" target="_blank" rel="noopener">${T("Hrací plány / výsledky")}${g[0]}</a>`);
    if (e.kz) out.push(`<a href="${CTS}${e.kz}?sezona=${s}" target="_blank" rel="noopener">${T("Hrací plány / výsledky")}${g[1]}</a>`);
  }
  return out.join("");
}
const STAR = '<svg viewBox="0 0 24 24"><path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/></svg>';
const isNew = e => e.nove && (today - pd(e.nove)) / 864e5 <= 7 && (e.src === "te" ? TEDATA?.meta?.prvni_beh : DATA.meta.prvni_beh) !== e.nove;

/* kompaktní řádek do seznamu */
function item(e) {
  const v = VEN[e.misto] || {}, zr = e.st === "zruseno";
  const d = MYPOS && v.lat != null ? ` · ${Math.round(km(MYPOS, [v.lat, v.lon]))} km` : "";
  const occ = occOf(e).filter(Boolean);
  const full = occ.length && occ.every(o => o[0] >= o[1]);
  const te = e.src === "te";
  const sex = te ? "" : e.mix ? T("děti") : [e.km && T(e.kat === "dospeli" ? "muži" : "chlapci"), e.kz && T(e.kat === "dospeli" ? "ženy" : "dívky")].filter(Boolean).join(" + ");
  return `<div class="item${zr ? " zr" : ""}" data-ev="${esc(e.id)}">
    <i class="bar" style="background:${colorOf(e.tr, zr)}"></i>
    <div class="main"><div class="t">${esc(e.nz || e.por)}</div>
      <div class="s">${esc(fmtRange(e.od, e.do, true))} · ${esc(v.nazev_mista && v.presnost === "areal" ? v.nazev_mista : e.por)}${d}</div>
      <div class="m"><span class="pill cls" style="background:${colorOf(e.tr, zr)}">${esc(clsShort(e.tr))}</span>${te ? `<span class="pill">${esc((e.ages || []).join(", ").replace(/&U/g, "U") || "–")}</span><span class="pill flag">${flag(e.zeme)}</span>` : `<span class="pill">${esc(CAT_QUICK[e.kat])}</span><span class="pill">${sex}</span>`}
      ${e.kap ? `<span class="pill${full ? " full" : ""}">${full ? T("plno") : "max " + e.kap}</span>` : ""}${e.pov ? `<span class="pill">${esc(surfLabel(surfGroup(e.pov)))}</span>` : ""}
      ${zr ? `<span class="pill zr">${T("ZRUŠENO")}</span>` : ""}${partCancel(e) ? `<span class="pill zr">${partCancel(e)} ${T("zrušeno")}</span>` : ""}${isNew(e) ? `<span class="pill new">${T("NOVÉ")}</span>` : ""}${playerPills(e)}</div></div>
    <button class="star${FAV.has(e.id) ? " on" : ""}" data-fav="${esc(e.id)}" aria-label="${T("Oblíbené")}">${STAR}</button></div>`;
}
/* zrušená jen jedna soutěž turnaje (např. dívky) */
function partCancel(e) {
  if (!e.zr || e.st === "zruseno") return "";
  return T(e.zr === "m" ? (e.kat === "dospeli" ? "muži" : "chlapci") : (e.kat === "dospeli" ? "ženy" : "dívky"));
}
/* karta turnaje Tennis Europe (bez kapacity a přihlášek – ty jsou na webu TE) */
function teCard(e) {
  const zr = e.st === "zruseno", v = VEN[e.misto] || {};
  return `<div class="card${zr ? " zr" : ""}" id="c-${esc(e.id)}">
    <div class="top"><span class="badgecls" style="background:${colorOf(e.tr, zr)}">${esc(PIN_LAB[e.tr] || "TE")}</span>
      <div style="flex:1;min-width:0"><div class="nm">${esc(e.nz)}</div><div class="sub">Tennis Europe · ${esc((e.ages || []).join(", ").replace(/&U/g, "U"))} · ${esc(fmtRange(e.od, e.do))}</div>
      <div class="m" style="display:flex;gap:4px;margin-top:4px">${zr ? `<span class="pill zr">${T("ZRUŠENO")}</span>` : ""}${isNew(e) ? `<span class="pill new">${T("NOVÉ")}</span>` : ""}${e.entry ? `<span class="pill te">${T("online přihlášky")}</span>` : ""}</div></div>
      <button class="star${FAV.has(e.id) ? " on" : ""}" data-fav="${esc(e.id)}" aria-label="${T("Oblíbené")}">${STAR}</button></div>
    <div class="facts"><div><span>${T("Kategorie TE")}</span>${esc(CLASS_LABEL[e.tr] || e.tecat || "–")}</div><div><span>${T("Věk")}</span>${esc((e.ages || []).join(", ") || "–")}</div>
      <div><span>${T("Povrch")}</span>${esc(e.pov || T("neuvedeno"))}</div><div><span>${T("Země")}</span>${flag(e.zeme)} ${esc(v.region || "")}</div>
      <div><span>${T("Místo")}</span>${esc(e.por)}</div></div>
    ${zr ? `<div class="note">${T("Turnaj zmizel z kalendáře Tennis Europe – ověřte na jejich webu.")}</div>` : ""}
    <div class="muted" style="margin-top:8px">${T("Kapacita, přihlášky, losy a výsledky jsou na webu Tennis Europe.")}</div>
    <div class="links"><a class="pri" href="${TEURL}${esc(e.id.slice(3))}" target="_blank" rel="noopener">${T("Detail a přihlášky · Tennis Europe")}</a></div>
    <span class="reportlink" data-report-ev="${esc(e.id)}">${T("Nahlásit chybu u tohoto turnaje")}</span></div>`;
}
/* plná karta v detailu místa */
function card(e) {
  if (e.src === "te") return teCard(e);
  const zr = e.st === "zruseno";
  const g = (e.mix ? ["Děti", ""] : e.kat === "dospeli" ? ["Muži", "Ženy"] : ["Chlapci", "Dívky"]).map(x => T(x));
  const occ = [];
  for (const [code, o, p, lab] of [[e.km, e.om, e.pm, g[0]], [e.kz, e.oz, e.pz, g[1]]]) {
    if (!code) continue;
    const t = occText(o, p, e.kap);
    occ.push(`<div><span>${lab} <small class="muted">· ${T("kód")} ${code}</small></span><b>${t.t}</b></div><div class="bar5"><i style="width:${Math.min(100, t.pct * 100)}%"></i></div>`);
  }
  return `<div class="card${zr ? " zr" : ""}" id="c-${esc(e.id)}">
    <div class="top"><span class="badgecls" style="background:${colorOf(e.tr, zr)}">${esc(e.tr === "MCR" ? "MČR" : e.tr || "–")}</span>
      <div style="flex:1;min-width:0"><div class="nm">${esc(e.nz || e.por)}</div><div class="sub">${esc(CAT_SHORT[e.kat] || e.kat)} · ${esc(fmtRange(e.od, e.do))}</div>
      <div class="m" style="display:flex;gap:4px;margin-top:4px">${zr ? `<span class="pill zr">${T("ZRUŠENO")}</span>` : ""}${isNew(e) ? `<span class="pill new">${T("NOVÉ")}</span>` : ""}${e.test ? '<span class="pill">TEST</span>' : ""}</div></div>
      <button class="star${FAV.has(e.id) ? " on" : ""}" data-fav="${esc(e.id)}" aria-label="${T("Oblíbené")}">${STAR}</button></div>
    <div class="occ">${occ.join("")}${partCancel(e) ? `<div><span>${esc(partCancel(e)[0].toUpperCase() + partCancel(e).slice(1))}</span><b class="zrtxt">${T("zrušeno")}</b></div>` : ""}</div>
    <div class="facts"><div><span>${T("Max. hráčů")}</span>${e.kap ?? "?"}</div><div><span>${T("Dvorce · povrch")}</span>${e.dv ?? "?"} · ${esc(e.pov ? rawSurf(e.pov) : T("neuvedeno"))}</div>
      ${e.mic ? `<div><span>${T("Míče")}</span>${esc(e.mic)}</div>` : ""}${e.vk ? `<div><span>${T("Vklad")}</span>${e.vk} ${EN ? "CZK" : "Kč"}</div>` : ""}
      ${e.prez ? `<div><span>${T("Prezentace")}</span>${esc(prezText(e.prez))}</div>` : ""}<div><span>${T("Pořadatel")}</span>${esc(e.por)}</div></div>
    ${zr ? `<div class="note">${e.zrus ? T("Turnaj zmizel z termínové listiny {d} – ověřte na webu ČTS.", {d: esc(fmtRange(e.zrus))}) : T("Turnaj je v listině označen jako zrušený – ověřte na webu ČTS.")}</div>` : ""}
    <div class="links">${linkSet(e)}</div>
    <span class="reportlink" data-report-ev="${esc(e.id)}">${T("Nahlásit chybu u tohoto turnaje")}</span></div>`;
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
  if (v.zdroj === "te") return v.nazev_mista || v.poradatel;
  if (v.nazev_mista && v.presnost === "areal") return v.nazev_mista;
  if (SVAZY.test((v.poradatel || "").trim()) && v.adresa) return v.adresa.split(",").pop().trim();
  return v.poradatel;
}
function openVenue(vi, opt = {}) {
  const v = VEN[vi];
  lastVenue = vi;
  const all = byVenue.get(vi) || [];
  const match = all.filter(e => evMatches(e, {ignoreRadius: true}));
  const other = all.filter(e => !match.includes(e) && (isArchive() || (e.do || e.od) >= iso(today)));
  const groups = new Map();
  for (const e of match) { const k = e.od + "|" + e.do; (groups.get(k) || groups.set(k, []).get(k)).push(e); }
  let [pc, pt] = PREC[v.presnost] || PREC.nezname;
  if (v.presnost === "adresa") [pc, pt] = v.zdroj === "detail" ? ["ok", T("Adresa místa konání podle ČTS")] : ["mid", T("Adresa klubu (místo konání zatím neuvedeno)")];
  if (v.presnost === "areal" && v.zdroj === "detail") pt = T("Adresa podle ČTS, ověřeno v mapě");
  if (v.zdroj === "te") [pc, pt] = v.presnost === "areal" ? ["ok", T("Areál dohledán v mapě (OpenStreetMap)")] : v.presnost === "obec" ? ["mid", T("Jen obec – areál v mapě nedohledán")] : ["bad", T("Místo neznámé")];
  // Mapy.com URL API: souřadnice v pořadí lon,lat (developer.mapy.com – Mapy.cz URL); start = poloha z GPS, jinak ho doplní aplikace
  const start = MYPOS ? `start=${MYPOS[1]},${MYPOS[0]}&` : "";
  const nav = v.lat != null ? `<div class="links">
    <a class="pri" href="https://mapy.com/fnc/v1/route?${start}end=${v.lon},${v.lat}&routeType=car_fast_traffic&navigate=true" target="_blank" rel="noopener">${T("Navigovat · Mapy.com")}</a>
    <a href="https://www.google.com/maps/dir/?api=1&destination=${v.lat},${v.lon}&travelmode=driving" target="_blank" rel="noopener">Google Maps</a>
    <a href="https://mapy.com/fnc/v1/showmap?center=${v.lon},${v.lat}&zoom=17&marker=true" target="_blank" rel="noopener">${T("Ukázat v Mapy.com")}</a></div>` : "";
  let html = `<div class="venue"><h2>${esc(venueTitle(v))}</h2>
    <div class="addr">${v.zdroj === "te" ? `${flag(v.zeme)} ${esc(v.adresa)} · Tennis Europe` : SVAZY.test((v.poradatel || "").trim()) ? T(v.poradatel === "ČTS" ? "Pořadatel: {p}" : "Pořadatel: {p} oblastní svaz", {p: esc(v.poradatel)}) : esc(v.poradatel) + (v.adresa ? " · " + esc(v.adresa) : "") + (v.region ? " · " + esc(v.region) : "")}</div>
    <span class="prec ${pc}">${esc(pt)}</span>${v.poznamka ? `<div class="muted">${esc(noteText(v.poznamka))}</div>` : ""}${nav}
    <span class="reportlink" data-report-venue="${vi}">${T("Nahlásit špatné místo nebo údaje")}</span></div>`;
  if (!groups.size) html += `<div class="empty">${T("Žádný turnaj tohoto místa neodpovídá filtrům.")}</div>`;
  for (const [, evs] of [...groups].sort()) {
    const ncat = new Set(evs.map(e => e.kat)).size, ncomp = evs.reduce((a, e) => a + (e.km ? 1 : 0) + (e.kz ? 1 : 0), 0);
    html += `<div class="group"><h4>${esc(fmtRange(evs[0].od, evs[0].do))}</h4>${ncomp > 1 ? `<div class="concur">${T(ncat > 1 ? "Souběh: {n} soutěží v {c} kategoriích ve stejném termínu" : "Souběh: {n} soutěží ve stejném termínu", {n: ncomp, c: ncat})}</div>` : ""}
      ${evs.map(card).join("")}</div>`;
  }
  if (other.length) html += `<details class="group"><summary>${T("Další turnaje v tomto místě mimo filtr ({n})", {n: other.length})}</summary>${other.map(card).join("")}</details>`;
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
  const xs = shown;
  $("#listBody").innerHTML = xs.length ? xs.slice(0, 300).map(item).join("") + (xs.length > 300 ? `<div class="empty">${T("Zobrazeno prvních 300 – zužte filtr.")}</div>` : "") : `<div class="empty">${T("Filtrům neodpovídá žádný turnaj.")}</div>`;
  bind($("#listBody"));
}
function renderFavs() {
  const xs = EV.filter(e => FAV.has(e.id)).sort((a, b) => (a.od || "").localeCompare(b.od || ""));
  const mine = [...FAV].filter(id => id.startsWith(SEZ + "-"));
  const gone = mine.filter(id => !EV.some(e => e.id === id));
  const others = [...FAV].filter(id => !id.startsWith(SEZ + "-") && !id.startsWith("TE-"));
  const bySez = {}; others.forEach(id => { const k = id.split("-")[0]; bySez[k] = (bySez[k] || 0) + 1; });
  $("#favBody").innerHTML = (xs.length ? xs.map(item).join("") : `<div class="empty">${T("V sezóně {s} zatím žádné oblíbené – přidáte je hvězdičkou u turnaje.", {s: esc(sezName(sezInfo()) || SEZ)})}</div>`) +
    (gone.length ? `<div class="muted">${T("{n} oblíbených turnajů už v datech není.", {n: gone.length})}</div>` : "") +
    (others.length ? `<div class="muted">${T("Další oblíbené v jiných sezónách: {x} – přepněte sezónu nahoře.", {x: Object.entries(bySez).map(([k, n]) => `${esc(sezName(SEZONY.find(x => x.id === k) || {nazev: k}))} (${n})`).join(", ")})}</div>` : "");
  bind($("#favBody"));
}
function shareFavs() {
  if (!FAV.size) return toast(T("Nejdřív přidejte oblíbené turnaje."));
  const url = location.origin + location.pathname + "#obl=" + [...FAV].join(",");
  if (navigator.share) navigator.share({title: T("Moje tenisové turnaje"), url}).catch(() => {});
  else navigator.clipboard?.writeText(url).then(() => toast(T("Odkaz zkopírován.")), () => prompt(T("Odkaz:"), url));
}
function icsFavs() {
  const xs = EV.filter(e => FAV.has(e.id) && e.od && e.st !== "zruseno");
  if (!xs.length) return toast(T("Žádné oblíbené turnaje k exportu."));
  const d = s => s.replace(/-/g, ""), esI = s => String(s).replace(/[,;\\]/g, m => "\\" + m).replace(/\n/g, "\\n");
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//TenisMapa//CS", "CALSCALE:GREGORIAN"];
  for (const e of xs) { const v = VEN[e.misto] || {};
    lines.push("BEGIN:VEVENT", `UID:${e.id}@tenismapa`, `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").slice(0, 15)}Z`, `DTSTART;VALUE=DATE:${d(e.od)}`,
      `DTEND;VALUE=DATE:${d(iso(addDays(pd(e.do || e.od), 1)))}`, `SUMMARY:${esI(e.src === "te" ? `Tennis Europe ${PIN_LAB[e.tr] || ""} ${(e.ages || []).join(",")} – ${e.nz}` : `${e.tr === "MCR" ? "MČR" : e.tr} ${CAT_SHORT[e.kat]} – ${e.nz || e.por}`)}`,
      `LOCATION:${esI([v.nazev_mista, v.adresa].filter(Boolean).join(", "))}`, `DESCRIPTION:${esI(e.src === "te" ? `Tennis Europe – ${e.por}\n${TEURL}${e.id.slice(3)}` : `${e.por}\n${CTS}${e.km || e.kz}?sezona=${DATA.meta.sezona}&tab=seznam`)}`, "END:VEVENT"); }
  lines.push("END:VCALENDAR");
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([lines.join("\r\n")], {type: "text/calendar"})); a.download = "tenisove-turnaje.ics"; a.click();
}
function importFromHash() {
  const m = location.hash.match(/obl=([^&]+)/); if (!m) return;
  const ids = decodeURIComponent(m[1]).split(",").filter(id => EV.some(e => e.id === id));
  history.replaceState(null, "", location.pathname);
  if (!ids.length) return;
  const box = $("#favImport"); box.hidden = false;
  box.innerHTML = `<div class="card">${T("Sdílený seznam obsahuje <b>{n}</b> turnajů.", {n: ids.length})}<div class="links"><a href="#" class="pri" id="impAdd">${T("Přidat do mých oblíbených")}</a><a href="#" id="impNo">${T("Ne")}</a></div></div>`;
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
    e.src === "te" ? `Odkaz TE: ${TEURL}${e.id.slice(3)}` : `Odkaz ČTS: ${CTS}${e.km || e.kz}?sezona=${DATA.meta.sezona}&tab=seznam`);
  if (v) L1.push(`Místo: ${v.nazev_mista || "-"} | pořadatel ${v.poradatel} | adresa ${v.adresa || "-"} | přesnost ${v.presnost}/${v.zdroj} | ${v.lat ?? "-"},${v.lon ?? "-"}`);
  const c = map.getCenter();
  L1.push(`Mapa: ${c.lat.toFixed(5)},${c.lng.toFixed(5)} z${map.getZoom()} | panel ${stack[stack.length - 1] || panel}`,
    `Filtry: od ${F.from}${F.to ? " do " + F.to : ""}; kat ${F.cat.join(",") || "vše"}; třída ${F.cls.join(",") || "vše"}; povrch ${F.surf.join(",") || "vše"}; zdroj ${F.src}; text "${F.text}"`,
    `Data: ${DATA.meta.aktualizace} | aplikace ${APP_VERSION} | ${navigator.userAgent.replace(/\s+/g, " ").slice(0, 140)}`);
  return L1;
}
function renderCtx() {
  const e = ctx.ev ? EV.find(x => x.id === ctx.ev) : null;
  const vi = e ? e.misto : ctx.venue, v = vi != null ? VEN[vi] : null;
  $("#repCtx").innerHTML = e ? `<b>${esc(e.nz || e.por)}</b>${esc(CAT_SHORT[e.kat])} · ${esc(fmtRange(e.od, e.do))} · ${e.src === "te" ? "Tennis Europe" : T("kód") + " " + esc(e.km || e.kz)}<div class="muted">${esc(v ? (v.nazev_mista || v.poradatel) + " · " + (v.adresa || "") : "")}</div>`
    : v ? `<b>${esc(v.nazev_mista && v.presnost === "areal" ? v.nazev_mista : v.poradatel)}</b>${esc(v.adresa || T("adresa neuvedena"))}<div class="muted">${T("Místo na mapě · přesnost: {p}", {p: esc((PREC[v.presnost] || PREC.nezname)[1])})}</div>`
    : T(`<b>Obecné hlášení</b>Přiloží se aktuální výřez mapy a nastavené filtry.<div class="muted">Tip: pro konkrétní turnaj otevřete jeho detail a klepněte na „Nahlásit chybu“.</div>`);
}
function syncReportButtons() {
  $("#repSend").disabled = !REPORT_FORM;
  $("#repNote").textContent = T("Hlášení se odešle přímo z aplikace (služba FormSubmit) – nepotřebujete účet ani vlastní e-mail.") + (shot ? T(" Snímek se přiloží.") : "");
}
async function openReport(c) {
  ctx = c || {};
  if (!ctx.ev && ctx.venue == null && panel === "detail") ctx.venue = lastVenue;
  const prevSnap = snap;
  setShot(null); repType = ""; $$("#repType button").forEach(b => b.classList.remove("on"));
  // snímek obrazovky v podobě, jakou uživatel právě vidí (před otevřením formuláře)
  try { toast(T("Pořizuji snímek obrazovky…")); setShot(await captureScreen()); $("#toast").hidden = true; } catch { $("#toast").hidden = true; }
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
  try { setShot(await captureScreen()); } catch { toast(T("Snímek se nepodařilo pořídit – vyberte obrázek z galerie.")); }
  setSnap(keep);
};
$("#repFile").onchange = e => { const f = e.target.files?.[0]; if (f) setShot(f); e.target.value = ""; };
$("#repShotDel").onclick = () => setShot(null);
$("#repSend").onclick = () => {
  if (!$("#repText").value.trim() && !repType) { toast(T("Vyberte typ problému nebo napište krátký popis.")); return; }
  sendForm();
};
function sendForm() {
  const btn = $("#repSend"); btn.disabled = true; btn.textContent = T("Odesílám…");
  const f = document.createElement("form");
  f.method = "POST"; f.action = "https://formsubmit.co/" + REPORT_FORM; f.enctype = "multipart/form-data"; f.target = "repFrame"; f.hidden = true;
  const add = (n, v) => { const i = document.createElement("input"); i.type = "hidden"; i.name = n; i.value = v; f.appendChild(i); };
  add("_subject", reportSubject()); add("_template", "table"); add("_captcha", "false"); add("_honey", "");
  add("Typ", repType || "neuvedeno"); add("Popis", $("#repText").value.trim() || "(bez popisu)");
  const contact = $("#repContact").value.trim();
  if (contact) { add("Kontakt", contact); add("_replyto", contact); }
  add("Kontext", ctxLines().join("\n"));
  if (shot) {
    const fi = document.createElement("input"); fi.type = "file"; fi.name = "attachment";
    const dt = new DataTransfer(); dt.items.add(new File([shot], `snimek-${iso(new Date())}.jpg`, {type: shot.type || "image/jpeg"})); fi.files = dt.files; f.appendChild(fi);
  }
  document.body.appendChild(f);
  const frame = $("#repFrame");
  let done = false;
  const finish = ok => { if (done) return; done = true; btn.disabled = false; btn.textContent = T("Odeslat hlášení"); f.remove();
    if (ok) { toast(T("Děkujeme, hlášení bylo odesláno.")); $("#repText").value = ""; setShot(null); repType = ""; $$("#repType button").forEach(b => b.classList.remove("on")); $("#btnBack").click(); }
    else toast(T("Odeslání se možná nepovedlo – zkuste „Poslat raději vlastním e-mailem“.")); };
  frame.onload = () => finish(true);
  setTimeout(() => finish(false), 20000);
  f.submit();
}
$("#repMail").onclick = async () => {
  if (!REPORT_EMAIL) return;
  if (!$("#repText").value.trim() && !repType) { toast(T("Vyberte typ problému nebo napište krátký popis.")); return; }
  const body = reportText();
  const file = shot ? new File([shot], `tenisova-mapa-${iso(new Date())}.jpg`, {type: shot.type || "image/jpeg"}) : null;
  if (file && navigator.canShare && navigator.canShare({files: [file]})) {
    try { await navigator.share({files: [file], title: reportSubject(), text: `${T("Komu")}: ${REPORT_EMAIL}\n${T("Předmět")}: ${reportSubject()}\n\n${body}`}); toast(T("Děkujeme za hlášení!")); return; }
    catch (err) { if (err && err.name === "AbortError") return; }
  }
  if (file) downloadShot();
  openMail(body);
  toast(T("Děkujeme za hlášení!"));
};

/* ---------- hráči a jejich přihlášky ---------- */
let HR = null, curPlayer = null, normIdx = null;
const PERSON = '<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/></svg>';
const ZK = {mz: ["mladsi-zactvo", "m"], mzk: ["mladsi-zactvo", "z"], sz: ["starsi-zactvo", "m"], szk: ["starsi-zactvo", "z"], d: ["dorost", "m"], dk: ["dorost", "z"], m: ["dospeli", "m"], z: ["dospeli", "z"]};
const ZK_LABEL = Object.fromEntries(Object.entries({mz: "ml. žák", mzk: "ml. žákyně", sz: "st. žák", szk: "st. žákyně", d: "dorostenec", dk: "dorostenka", m: "muž", z: "žena"}).map(([k, v]) => [k, T(v)]));
const LADDER = ["mladsi-zactvo", "starsi-zactvo", "dorost", "dospeli"];
const fold = s => (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
let ZEB = null;
function loadPlayers() {
  if (HR && HR.sez === SEZ) return Promise.resolve(HR);
  if (loadPlayers.p && loadPlayers.sez === SEZ) return loadPlayers.p;
  loadPlayers.sez = SEZ;
  const zeb = ZEB ? Promise.resolve(ZEB) : fetch("data/zebricek.json", {cache: "no-cache"}).then(r => r.ok ? r.json() : {p: {}}).catch(() => ({p: {}})).then(z => (ZEB = z));
  const sez = fetch(`data/${SEZ}/hraci.json`, {cache: "no-cache"}).then(r => r.ok ? r.json() : {p: {}, e: {}}).catch(() => ({p: {}, e: {}}));
  return loadPlayers.p = Promise.all([zeb, sez]).then(([z, js]) => {
    HR = {sez: SEZ, p: Object.assign({}, z.p, js.p), e: js.e || {}, sets: {}, zebricek: z.meta?.zebricek || ""};
    normIdx = Object.entries(HR.p).map(([id, p]) => [id, fold(p[0]), fold(p[1])]);
    render(); return HR;
  }).catch(() => (loadPlayers.p = null));
}
const entrySet = pid => HR.sets[pid] ||= new Set((HR.e[pid] || []).map(x => x[0]));
const pinfo = pid => HR?.p[pid] || [T("hráč") + " " + pid, "", []];
const shortName = pid => { const n = pinfo(pid)[0].split(" "); return n.length > 1 ? `${n[0]} ${n[1][0]}.` : n[0]; };
/* podle soutěžního řádu může hráč startovat ve své věkové kategorii i ve starších (ne v mladších);
   kategorie a pohlaví se odvozují ze žebříčku zima 2026/27 – nejmladší kategorie, ve které je hráč veden */
function eligibility(pid) {
  const cats = pinfo(pid)[2] || [];
  if (!cats.length) return null;
  const idx = Math.min(...cats.map(c => LADDER.indexOf(ZK[c[0]][0])));
  return {cats: LADDER.slice(idx), sex: ZK[cats[0][0]][1]};
}
function eligible(pid, e) {
  const el = eligibility(pid);
  if (!el) return entrySet(pid).has(e.id);
  if (!el.cats.includes(e.kat)) return false;
  return el.sex === "m" ? !!e.km : !!e.kz;
}
function playerPills(e) {
  if (!F.players.length || !HR) return "";
  return F.players.filter(pid => entrySet(pid).has(e.id)).map(pid => {
    const x = HR.e[pid].find(y => y[0] === e.id);
    return `<span class="pill pl">${PERSON}${esc(shortName(pid))}${x && x[2] === "Q" ? " · " + T("kval.") : x && x[2] === "N" ? " · " + T("náhr.") : ""}</span>`;
  }).join("");
}
function hideSuggest() { $("#suggest").hidden = true; }
function suggest() {
  const box = $("#suggest"), q = fold(F.text);
  if (!HR || q.length < 2) { box.hidden = true; return; }
  const words = q.split(/\s+/).filter(Boolean);
  const hits = [];
  for (const [id, n, k] of normIdx) {
    if (words.every(w => n.includes(w) || k.includes(w))) {
      const sc = (n.startsWith(words[0]) ? 0 : 1) + (HR.e[id] ? -2 : 0);
      hits.push([sc, id]);
      if (hits.length > 400) break;
    }
  }
  hits.sort((a, b) => a[0] - b[0] || pinfo(a[1])[0].localeCompare(pinfo(b[1])[0], "cs"));
  const top = hits.slice(0, 8);
  box.innerHTML = (top.length ? `<div class="sh">${T("Hráči")}</div>` + top.map(([, id]) => {
      const p = pinfo(id), n = (HR.e[id] || []).length, cat = (p[2] || []).map(c => `${ZK_LABEL[c[0]]}${c[1] ? (EN ? " #" + c[1] : " " + c[1] + ".") : ""}`).join(", ");
      return `<button class="sg" data-pid="${esc(id)}">${PERSON}<span><b>${esc(p[0])}</b><small>${esc(p[1])}${cat ? " · " + esc(cat) : ""}</small></span><em class="${n ? "has" : ""}">${n ? T("{n}× přihl.", {n}) : T("bez přihlášek")}</em></button>`;
    }).join("") : `<div class="sh">${T("Žádný hráč neodpovídá")}</div>`) +
    `<button class="sg all" data-all="1"><span>${T("Hledat „{q}“ v turnajích ({n})", {q: esc(F.text), n: nf(shown.length)})}</span></button>`;
  box.hidden = false;
  box.querySelectorAll("[data-pid]").forEach(b => b.onclick = () => { $("#fText").value = ""; F.text = ""; hideSuggest(); togglePlayer(b.dataset.pid, true); openPlayer(b.dataset.pid); });
  box.querySelector("[data-all]").onclick = () => { hideSuggest(); showPanel("list"); };
}
function togglePlayer(pid, on) {
  const i = F.players.indexOf(pid);
  if (on && i < 0) F.players.push(pid);
  if (!on && i >= 0) F.players.splice(i, 1);
  render();
}
function openPlayer(pid) {
  curPlayer = pid;
  const p = pinfo(pid), ents = (HR?.e[pid] || []).map(x => [EV.find(e => e.id === x[0]), x]).filter(x => x[0]).sort((a, b) => (a[0].od || "").localeCompare(b[0].od || ""));
  if (isArchive() && F.pmode === "eligible") F.pmode = "entries";
  const el = eligibility(pid);
  const cats = (p[2] || []).map(c => `<span class="pill">${ZK_LABEL[c[0]]}${c[1] ? " · " + T("{r}. v ČR", {r: c[1]}) : ""}</span>`).join("");
  const sel = F.players.includes(pid);
  $("#playerBody").innerHTML = `<div class="venue"><h2>${esc(p[0])}</h2><div class="addr">${esc(p[1])}</div>
    <div class="m" style="display:flex;flex-wrap:wrap;gap:4px;margin-top:6px">${cats || `<span class="pill">${T("mimo žebříček {z}", {z: esc(HR?.zebricek || "")})}</span>`}</div>
    <div class="links"><a class="pri" href="#" id="plToggle">${T(sel ? "Odebrat z mapy" : "Zobrazit v mapě")}</a><a href="https://cesky-tenis.cz/hrac/${encodeURIComponent(pid)}" target="_blank" rel="noopener">${T("Profil na ČTS")}</a></div></div>
    ${isArchive() ? `<p class="muted" style="margin-top:14px">${T("Turnaje sezóny {s}, kterých se hráč účastnil.", {s: esc(sezName(sezInfo()) || SEZ)})}</p>` : `<div class="seg small" id="pmode" style="margin-top:14px"><button data-m="entries" class="${F.pmode === "entries" ? "on" : ""}">${T("Kde je přihlášen")}</button><button data-m="eligible" class="${F.pmode === "eligible" ? "on" : ""}">${T("Kam se může přihlásit")}</button></div>`}
    <p class="muted">${F.pmode === "eligible" ? (el ? T("Podle soutěžního řádu může hráč startovat ve své kategorii i ve starších: {c} ({g}). Kategorie je odvozená ze žebříčku {z} – ověřte si to v propozicích turnaje.", {c: el.cats.map(c => CAT_SHORT[c]).join(", "), g: T(el.sex === "m" ? "chlapci / muži" : "dívky / ženy"), z: esc(HR?.zebricek || "")}) : T("Hráč není v žebříčku, kategorii nelze určit – zobrazujeme jen jeho přihlášky.")) : T("Přihlášky z veřejných seznamů ČTS (hlavní soutěž, kvalifikace, náhradníci), obnovují se denně.")}</p>
    <div id="plList">${F.pmode === "entries" ? (ents.length ? ents.map(([e]) => item(e)).join("") : `<div class="empty">${T("Zatím žádná přihláška.")}</div>`)
      : (() => { const xs = EV.filter(e => evMatchesBase(e) && eligible(pid, e)); return xs.length ? xs.slice(0, 200).map(item).join("") + (xs.length > 200 ? `<div class="empty">${T("Zobrazeno 200 z {n} – zužte filtr.", {n: xs.length})}</div>` : "") : `<div class="empty">${T("Žádný vhodný turnaj v nastaveném termínu.")}</div>`; })()}</div>`;
  $("#plToggle").onclick = ev => { ev.preventDefault(); togglePlayer(pid, !F.players.includes(pid)); openPlayer(pid); };
  $$("#pmode button").forEach(b => b.onclick = () => { F.pmode = b.dataset.m; render(); openPlayer(pid); });
  bind($("#playerBody"));
  $("#summary").innerHTML = `${PERSON} ${esc(p[0])}`;
  showPanel("player");
  if (!isDesk() && snap === "peek") setSnap("half");
}
/* filtr bez omezení na hráče (pro seznam „kam se může přihlásit“) */
function evMatchesBase(e) { const keep = F.players; F.players = []; const r = evMatches(e); F.players = keep; return r; }

/* ---------- o aplikaci ---------- */
function openAbout() {
  const upd = new Date(DATA.meta.aktualizace);
  $("#aboutData").textContent = T("data k {d}", {d: upd.toLocaleString(EN ? "en-GB" : "cs-CZ", {day: "numeric", month: EN ? "short" : "numeric", year: "numeric", hour: "2-digit", minute: "2-digit"})});
  $("#aboutVer").textContent = T("verze {v}", {v: APP_VERSION});
  $("#aboutSez").textContent = SEZONY.map(x => EN ? sezName(x) : x.nazev).join(", ");
  showPanel("about");
  if (!isDesk()) setSnap(snap === "peek" ? "half" : snap);
}

/* ---------- události UI ---------- */
$$("#tabs button").forEach(t => t.onclick = e => { e.stopPropagation(); t.dataset.panel === "report" ? openReport({venue: panel === "detail" ? lastVenue : null}) : showPanel(t.dataset.panel); });
$("#btnBack").onclick = e => {
  e.stopPropagation();
  const prev = stack.pop() || "list";
  popping = true;
  try {
    if (prev === "detail" && lastVenue != null) openVenue(lastVenue, {move: false});
    else if (prev === "player" && curPlayer) openPlayer(curPlayer);
    else showPanel(prev);
  } finally { popping = false; }
};
$("#btnAbout").onclick = () => openAbout();
$("#aboutReport").onclick = ev => { ev.preventDefault(); openReport({}); };
$("#btnFilters").onclick = () => { showPanel("filters"); setSnap("full"); };
$("#fFrom").onchange = e => { F.from = e.target.value || (isArchive() ? sezInfo().od : iso(today)); render(); };
$("#fTo").onchange = e => { F.to = e.target.value; render(); };
$$("#datePresets button").forEach(b => b.onclick = () => presets(b.dataset.p));
$("#fText").oninput = e => { F.text = e.target.value.trim(); clearTimeout(render.t); render.t = setTimeout(() => { render(); suggest(); }, 200); };
$("#fText").onfocus = () => { loadPlayers(); suggest(); };
$("#fText").onkeydown = e => { if (e.key === "Enter") { e.target.blur(); hideSuggest(); showPanel("list"); } if (e.key === "Escape") hideSuggest(); };
document.addEventListener("pointerdown", e => { if (!e.target.closest("#suggest, .searchbox")) hideSuggest(); });
$("#fFree").onchange = e => { F.free = e.target.checked; render(); };
$("#fCancelled").onchange = e => { F.cancelled = e.target.checked; render(); };
$("#fGuess").onchange = e => { F.guess = e.target.checked; render(); };
$("#btnBase").onclick = () => toggleBaseMenu();
$("#btnLocate").onclick = () => { if (MYPOS) { MYPOS = null; drawMyPos(); render(); } else locate(); };
$("#btnLegend").onclick = () => { $("#legend").hidden = !$("#legend").hidden; $("#btnLegend").classList.toggle("on", !$("#legend").hidden); };
$("#legend").addEventListener("click", e => { const b = e.target.closest("button.lg"); if (!b) return; const a = F.cls, i = a.indexOf(b.dataset.v); i >= 0 ? a.splice(i, 1) : a.push(b.dataset.v); render(); });
$("#btnReset").onclick = () => { F = defaults(); render(); };
$("#btnShow").onclick = () => { showPanel("list"); if (!isDesk()) setSnap("peek"); };
$$("#fSrc button").forEach(b => b.onclick = () => { F.src = b.dataset.src; render(); });
$("#btnShare").onclick = shareFavs;
$("#btnIcs").onclick = icsFavs;
$("#btnFavMap").onclick = () => { F.favOnly = !F.favOnly; render(); };
/* přepínač jazyka: tlačítko ukazuje jazyk, na který se přepne */
const otherLang = EN ? "cs" : "en";
$("#btnLang").textContent = otherLang === "en" ? "EN" : "CZ";
$("#btnLang").title = otherLang === "en" ? "English" : "Čeština"; $("#btnLang").setAttribute("aria-label", $("#btnLang").title);
$("#btnLang").onclick = () => window.I18N && I18N.set(otherLang);
$("#aboutLang").textContent = otherLang === "en" ? "English version" : "Česká verze";
$("#aboutLang").onclick = ev => { ev.preventDefault(); window.I18N && I18N.set(otherLang); };

/* ---------- start ---------- */
setSnap("peek");
/* sezóny: výchozí = poslední už začatá (aktuální), uložená volba uživatele má přednost, pokud sezóna existuje */
function defaultSeason() {
  const started = SEZONY.filter(x => x.od <= iso(today));
  return (started[0] || SEZONY[SEZONY.length - 1] || {}).id;
}
function loadSeason(id, opt = {}) {
  SEZ = id; LS.set("tm.sez", id === defaultSeason() ? null : id);
  $("#summary").textContent = T("Načítám {s}…", {s: sezName(sezInfo()) || id});
  return Promise.all([fetch(`data/${id}/turnaje.json`, {cache: "no-cache"}).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); }), loadTE()]).then(([js, te]) => {
    DATA = js; EV = js.turnaje; VEN = js.mista; byVenue = new Map();
    // Tennis Europe: turnaje v rozsahu sezóny (u nejnovější sezóny i všechny pozdější), místa připojená za místa ČTS
    if (te && te.turnaje.length) {
      const si0 = sezInfo(), latest = SEZONY[0] && SEZONY[0].id === id, end = latest ? "9999" : si0.do, off = VEN.length;
      const xs = te.turnaje.filter(e => (e.do || e.od) >= si0.od && e.od <= end).map(e => Object.assign({}, e, {misto: e.misto + off}));
      if (xs.length) { EV = EV.concat(xs); VEN = VEN.concat(te.mista); }
    }
    for (const e of EV) (byVenue.get(e.misto) || byVenue.set(e.misto, []).get(e.misto)).push(e);
    const si = sezInfo();
    if (opt.reset) { F.from = isArchive() ? si.od : (si.od > iso(today) ? si.od : iso(today)); F.to = ""; }
    else if (!isArchive() && (!F.from || F.from < iso(today))) F.from = iso(today);
    else if (isArchive() && (!F.from || F.from > si.do || F.from < si.od)) { F.from = si.od; F.to = ""; }
    const upd = new Date(js.meta.aktualizace);
    $("#fText").placeholder = T("Hráč, klub, turnaj… (data {d})", {d: dShort(iso(upd))});
    clearFocus(); buildFilterUI();
    HR = null; if (F.players.length) loadPlayers();
    showPanel(panel === "detail" || panel === "player" ? "list" : (SUB.has(panel) ? "list" : panel));
    render();
  });
}
function loadTE() {
  if (TEDATA) return Promise.resolve(TEDATA);
  return fetch("data/TE/turnaje.json", {cache: "no-cache"}).then(r => r.ok ? r.json() : null).catch(() => null)
    .then(js => (TEDATA = js && js.turnaje ? js : {meta: {}, mista: [], turnaje: []}));
}
/* přiblížit mapu na zobrazená místa (např. po zapnutí Tennis Europe) */
const EUROPE = [[36, -9], [60, 32]];
function fitShown() {
  if (F.src !== "cts") return fitVisible(L.latLngBounds(EUROPE));
  const pts = [...new Set(shown.map(e => e.misto))].map(i => VEN[i]).filter(v => v && v.lat != null).map(v => [v.lat, v.lon]);
  if (pts.length) fitVisible(L.latLngBounds(pts));
}
function toggleBaseMenu() {
  let m = $("#baseMenu");
  if (m) { m.remove(); return; }
  m = document.createElement("div"); m.id = "baseMenu"; m.className = "seasonmenu basemenu";
  m.innerHTML = `<div class="sh">${T("Mapový podklad")}</div>` + Object.keys(BASE_LABEL).map(k => `<button data-b="${k}" class="${k === baseMode ? "on" : ""}"><span>${esc(T(BASE_LABEL[k]))}</span><small>${esc(T(BASE_HINT[k]))}</small></button>`).join("");
  document.body.appendChild(m);
  m.querySelectorAll("[data-b]").forEach(b => b.onclick = () => { m.remove(); baseMode = b.dataset.b; LS.set("tm.map", baseMode); baseKey = null; applyBase(); });
}
document.addEventListener("pointerdown", e => { const m = $("#baseMenu"); if (m && !e.target.closest("#baseMenu, #btnBase")) m.remove(); });
function toggleSeasonMenu() {
  let m = $("#seasonMenu");
  if (m) { m.remove(); return; }
  m = document.createElement("div"); m.id = "seasonMenu"; m.className = "seasonmenu";
  m.innerHTML = `<div class="sh">${T("Sezóna")}</div>` + SEZONY.map(x => `<button data-s="${x.id}" class="${x.id === SEZ ? "on" : ""}"><span>${sezIcon(x.id)} ${esc(sezLabel(x))}</span><small>${nf(x.pocet)} ${T("turnajů")} · ${T(x.archiv ? "archiv" : x.od > iso(today) ? "připravuje se" : "probíhá")}</small></button>`).join("");
  document.body.appendChild(m);
  m.querySelectorAll("[data-s]").forEach(b => b.onclick = () => { m.remove(); if (b.dataset.s !== SEZ) loadSeason(b.dataset.s, {reset: true}).then(() => fitVisible(L.latLngBounds(CZ))); });
}
document.addEventListener("pointerdown", e => { const m = $("#seasonMenu"); if (m && !e.target.closest("#seasonMenu, .quick .season")) m.remove(); });

fetch("data/sezony.json", {cache: "no-cache"}).then(r => r.ok ? r.json() : null).catch(() => null).then(idx => {
  SEZONY = idx?.sezony || [];
  if (!SEZONY.length) SEZONY = [{id: "Z2627", nazev: "zima 2026/27", od: "2026-10-01", do: "2027-03-31", pocet: 0}];
  const stored = LS.get("tm.sez", null);
  return loadSeason(SEZONY.some(x => x.id === stored) ? stored : defaultSeason());
}).then(() => {
  importFromHash();
  setTimeout(() => loadH2C().catch(() => {}), 4000);
  if (!F.players.length) setTimeout(loadPlayers, 2500);
  if (isDesk()) setSnap("full");
  fitVisible(L.latLngBounds(CZ));
}).catch(err => { $("#summary").textContent = T("Data se nepodařilo načíst: ") + err; });
if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => {});
})();
