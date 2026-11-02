"""Zpřesnění míst turnajů Tennis Europe přes OpenStreetMap (Overpass API).

Pro místa, která Nominatim našel jen na úrovni obce, hledá v okolí (do 10 km) tenisová sportoviště v OSM
(sport=tennis, haly/areály/kluby s tenisem v názvu) a vybere to, jehož název se shoduje s názvem areálu
z Tennis Europe (např. „Tennishalle Liezen“, „Racketstadion“). Bez shody názvu: pokud je v okruhu 3 km jediný větší
tenisový areál (3+ kurty), použije se jako „areál v obci – neověřeno“.
Výsledky dotazů se ukládají do data/TE/overpass.json (opakované běhy jsou rychlé). Overpass z cloudového
kontejneru Claude nefunguje – běží na Macu nebo v GitHub Actions.
Použití: python3 pipeline/te_mista.py [časový limit v s]  (pak TE_BEZ_STAHOVANI=1 python3 pipeline/te.py)
"""
import json, math, os, re, sys, time, urllib.parse, urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import DATA, load, norm, save

URL = "https://overpass-api.de/api/interpreter"
UA = "TenisovaMapa/2.8 (+https://turnajovamapa.cz; tenisova-mapa@seznam.cz)"
STOP = set("tennis tenis tenisz tenisa tenisowy tenisowa club klub kulubu kulubü sports sport spor centre center centrum centro "
           "academy akademie akademia akademija the and of de la le del des club de tc tk ltc atc sc ac sk asd ssd te court courts "
           "arena park hall halle hala resort hotel municipal municipales municipal city stadium stadion".split())


def km(a, b):
    la1, lo1, la2, lo2 = map(math.radians, (a[0], a[1], b[0], b[1]))
    h = math.sin((la2 - la1) / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin((lo2 - lo1) / 2) ** 2
    return 6371 * 2 * math.asin(math.sqrt(h))


def toks(s):
    return {t for t in norm(s).split() if len(t) > 2 and t not in STOP}


def overpass(lat, lon, r=10000):
    q = f"""[out:json][timeout:60];
(nwr(around:{r},{lat},{lon})["sport"~"tennis"];
 nwr(around:{r},{lat},{lon})["leisure"~"sports_centre|sports_hall|club|stadium"]["name"];);
out center tags;"""
    req = urllib.request.Request(URL, data=urllib.parse.urlencode({"data": q}).encode(), headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=90) as f:
        js = json.load(f)
    out = []
    for e in js.get("elements", []):
        t = e.get("tags", {})
        c = (e["lat"], e["lon"]) if "lat" in e else ((e["center"]["lat"], e["center"]["lon"]) if "center" in e else None)
        sp = t.get("sport", "")
        if not c or ("table_tennis" in sp and "tennis" not in sp.replace("table_tennis", "")):
            continue
        out.append({"lat": round(c[0], 6), "lon": round(c[1], 6), "name": t.get("name", ""), "tennis": "tennis" in sp.replace("table_tennis", ""),
                    "pitch": t.get("leisure") == "pitch"})
    return out


def best_match(v, venue, feats):
    """Shoda názvu → (lat, lon, název, 'areal'); jinak jediný větší tenisový areál do 3 km → 'areal_obec'."""
    vt = toks(venue)
    pt = (v["lat"], v["lon"])
    best = None
    for f in feats:
        if not f["name"]:
            continue
        ov = len(vt & toks(f["name"]))
        if not ov:
            continue
        d = km(pt, (f["lat"], f["lon"]))
        if d > 10:
            continue
        sc = ov * 2 - d / 5 + (0.5 if f["tennis"] else 0)
        if best is None or sc > best[0]:
            best = (sc, f)
    if best:
        f = best[1]
        # kurty kolem pojmenovaného areálu: posun na nejbližší tenisový kurt do 300 m (přesnější bod)
        near = [g for g in feats if g["pitch"] and g["tennis"] and km((f["lat"], f["lon"]), (g["lat"], g["lon"])) <= 0.3]
        if near and not f["pitch"]:
            g = min(near, key=lambda g: km((f["lat"], f["lon"]), (g["lat"], g["lon"])))
            return f["lat"] * 0.5 + g["lat"] * 0.5, f["lon"] * 0.5 + g["lon"] * 0.5, f["name"], "areal"
        return f["lat"], f["lon"], f["name"], "areal"
    # shluky kurtů do 3 km
    pitches = [g for g in feats if g["pitch"] and g["tennis"] and km(pt, (g["lat"], g["lon"])) <= 3]
    clusters = []
    for g in pitches:
        for c in clusters:
            if km((c[0]["lat"], c[0]["lon"]), (g["lat"], g["lon"])) <= 0.1:
                c.append(g); break
        else:
            clusters.append([g])
    big = [c for c in clusters if len(c) >= 3]
    if len(big) == 1:
        c = big[0]
        return sum(g["lat"] for g in c) / len(c), sum(g["lon"] for g in c) / len(c), "", "areal_obec"
    return None


def improve(vcache=None, budget=150, pause=2.0):
    """Zpřesní místa v data/TE/mista.json (nebo předaném slovníku). Vrací počet zpřesněných."""
    own = vcache is None
    vcache = vcache if vcache is not None else (load(os.path.join("TE", "mista.json"), {}) or {})
    ocache = load(os.path.join("TE", "overpass.json"), {}) or {}
    t0, n, done = time.time(), 0, 0
    for k, v in vcache.items():
        if v.get("presnost") not in ("obec", "areal_obec") or v.get("lat") is None or v.get("osm3"):
            continue
        if time.time() - t0 > budget:
            break
        key = f"{v['lat']:.3f},{v['lon']:.3f}"
        if key not in ocache:
            err = None
            for attempt in range(3):            # Overpass bývá přetížený (502/504) – krátké opakování
                try:
                    ocache[key] = overpass(v["lat"], v["lon"])
                    err = None
                    break
                except Exception as e:  # noqa: BLE001
                    err = e
                    time.sleep(8 * (attempt + 1))
            if err is not None:                  # nedostupný → skončit, příští běh pokračuje
                print("  Overpass:", err, flush=True)
                break
            time.sleep(pause)
        venue = v.get("nazev_mista") or v.get("poradatel") or ""
        m = best_match(v, venue, ocache[key])
        v["osm3"] = 1
        done += 1
        if m and (m[3] == "areal" or v["presnost"] == "obec"):
            v.update(lat=round(m[0], 6), lon=round(m[1], 6), presnost=m[3],
                     poznamka=("areál podle OpenStreetMap: " + m[2]) if m[2] else "tenisový areál v obci podle OpenStreetMap")
            n += 1
    save("overpass.json", ocache, folder=os.path.join(DATA, "TE"), indent=None)
    if own:
        save("mista.json", vcache, folder=os.path.join(DATA, "TE"))
    left = sum(1 for v in vcache.values() if v.get("presnost") in ("obec", "areal_obec") and v.get("lat") is not None and not v.get("osm3"))
    print(f"TE místa přes OSM: prověřeno {done}, zpřesněno {n}, zbývá {left}", flush=True)
    return n


if __name__ == "__main__":
    improve(budget=float(sys.argv[1]) if len(sys.argv) > 1 else 150)
