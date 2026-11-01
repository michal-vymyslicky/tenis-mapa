"""Index tenisových areálů ČR z OpenStreetMap (Overpass API) → data/osm_tenis.json.

Stáhne všechny tenisové kurty (sport=tennis, bez stolního tenisu), haly/areály/kluby s tenisem nebo s „tenis/tennis“
v názvu a sloučí kurty ležící u sebe (do 70 m) do jednoho areálu. Každý areál má střed, počet kurtů, název
(z pojmenovaného areálu/haly v okolí 150 m), krytí (hala/nafukovačka/building) a web. Slouží k přichycení
geokódované adresy na skutečné kurty (venues.py). Obnova: jednou za 30 dní (update.py), ručně `python3 pipeline/osm_tenis.py`.
"""
import json, math, os, sys, time, urllib.parse, urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import DATA, norm

URLS = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"]
UA = "tenisova-mapa/2.5 (+https://turnajovamapa.cz; tenisova-mapa@seznam.cz)"
Q = """[out:json][timeout:300];
area["ISO3166-1"="CZ"][admin_level=2]->.cz;
(
  nwr["sport"~"(^|;)tennis(;|$)"](area.cz);
  nwr["leisure"~"sports_centre|sports_hall|stadium|club|fitness_centre"]["name"~"[Tt]enis|[Tt]ennis|TENIS|TENNIS|LTC|TK |TC "](area.cz);
  nwr["building"]["name"~"[Tt]enis|[Tt]ennis|TENIS|TENNIS"](area.cz);
  nwr["leisure"~"^(sports_centre|sports_hall|club)$"]["name"](area.cz);
);
out center tags;"""
OUT = os.path.join(DATA, "osm_tenis.json")


def fetch():
    body = urllib.parse.urlencode({"data": Q}).encode()
    last = None
    for u in URLS:
        for attempt in range(3):
            try:
                req = urllib.request.Request(u, data=body, headers={"User-Agent": UA})
                with urllib.request.urlopen(req, timeout=360) as r:
                    return json.load(r)
            except Exception as e:  # noqa: BLE001
                last = e
                print("  overpass:", u, e, flush=True)
                time.sleep(20 * (attempt + 1))
    raise RuntimeError(f"Overpass nedostupný: {last}")


def dist_m(a, b):
    la1, lo1, la2, lo2 = map(math.radians, (a[0], a[1], b[0], b[1]))
    h = math.sin((la2 - la1) / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin((lo2 - lo1) / 2) ** 2
    return 6371000 * 2 * math.asin(math.sqrt(h))


def build(raw):
    pitches, named = [], []
    for e in raw.get("elements", []):
        t = e.get("tags", {})
        c = (e["lat"], e["lon"]) if "lat" in e else ((e["center"]["lat"], e["center"]["lon"]) if "center" in e else None)
        if not c:
            continue
        sport = t.get("sport", "")
        nm = t.get("name", "")
        n = norm(nm)
        if "table_tennis" in sport and "tennis" not in sport.replace("table_tennis", ""):
            continue
        if any(k.startswith(("disused", "abandoned", "was:", "demolished")) for k in t) or any(w in n for w in ("stoln", "zanikl", "byval")):
            continue
        rec = {"lat": round(c[0], 6), "lon": round(c[1], 6), "name": nm, "leisure": t.get("leisure", ""), "building": t.get("building", ""),
               "covered": t.get("covered", "") or t.get("indoor", ""), "web": t.get("website", "") or t.get("contact:website", ""),
               "sport": sport, "street": t.get("addr:street", "") or t.get("addr:place", ""), "hn": t.get("addr:housenumber", ""),
               "city": t.get("addr:city", ""), "osm": f"{e['type']}/{e['id']}"}
        tennisy = "tennis" in sport or "tenis" in n or "tennis" in n
        if t.get("leisure") == "pitch" and "tennis" in sport:
            pitches.append(rec)
        elif tennisy or (t.get("building") and nm):
            named.append(rec)
        elif nm:
            rec["jen_nazev"] = True            # sportovní centrum bez tenisu v tazích – jen jako název blízkých kurtů
            named.append(rec)
    # shluky kurtů (union-find, 70 m) – mřížka ~0,01° pro rychlost
    parent = list(range(len(pitches)))

    def find(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i
    grid = {}
    for i, p in enumerate(pitches):
        grid.setdefault((round(p["lat"], 2), round(p["lon"], 2)), []).append(i)
    for i, p in enumerate(pitches):
        gx, gy = round(p["lat"], 2), round(p["lon"], 2)
        for dx in (-0.01, 0, 0.01):
            for dy in (-0.01, 0, 0.01):
                for j in grid.get((round(gx + dx, 2), round(gy + dy, 2)), []):
                    if j > i and dist_m((p["lat"], p["lon"]), (pitches[j]["lat"], pitches[j]["lon"])) <= 70:
                        parent[find(i)] = find(j)
    groups = {}
    for i in range(len(pitches)):
        groups.setdefault(find(i), []).append(pitches[i])
    fac = []
    for g in groups.values():
        lat = sum(p["lat"] for p in g) / len(g)
        lon = sum(p["lon"] for p in g) / len(g)
        fac.append({"lat": round(lat, 6), "lon": round(lon, 6), "kurty": len(g), "nazev": next((p["name"] for p in g if p["name"]), ""), "kryte": sum(1 for p in g if p["covered"] in ("yes", "roof")),
                    "web": next((p["web"] for p in g if p["web"]), ""), "povrchy": [], "zdroj": "kurty"})
    # pojmenované areály/haly: přiřadit k nejbližšímu shluku do 150 m, jinak samostatný areál
    named.sort(key=lambda r: r.get("jen_nazev", False))          # tenisové názvy mají přednost
    for r in named:
        best, bd = None, 151
        for f in fac:
            if abs(f["lat"] - r["lat"]) > 0.003 or abs(f["lon"] - r["lon"]) > 0.005:
                continue
            d = dist_m((f["lat"], f["lon"]), (r["lat"], r["lon"]))
            if d < bd:
                best, bd = f, d
        hall = bool(r["building"]) or r["leisure"] == "sports_hall" or r["covered"] in ("yes", "roof")
        if best is not None:
            if r.get("jen_nazev"):
                if not best["nazev"] and r["name"]:
                    best["nazev"] = r["name"]
                continue
            if r["name"] and (not best["nazev"] or "tenis" in norm(r["name"]) or "tennis" in norm(r["name"])):
                best["nazev"] = r["name"]
            best["web"] = best["web"] or r["web"]
            best["hala"] = best.get("hala") or hall
            best.setdefault("adresa", " ".join(x for x in (r["street"], r["hn"], r["city"]) if x))
        elif not r.get("jen_nazev") and (r["name"] or "tennis" in r["sport"]):
            fac.append({"lat": r["lat"], "lon": r["lon"], "kurty": 0, "nazev": r["name"], "kryte": 0, "web": r["web"], "hala": hall,
                        "adresa": " ".join(x for x in (r["street"], r["hn"], r["city"]) if x), "zdroj": r["leisure"] or "budova"})
    for f in fac:
        f["hala"] = bool(f.get("hala") or f["kryte"])
        f.pop("povrchy", None)
        if not f.get("adresa"):
            f.pop("adresa", None)
    return fac


def main():
    raw = fetch()
    fac = build(raw)
    out = {"meta": {"stazeno": time.strftime("%Y-%m-%d"), "zdroj": "OpenStreetMap (ODbL) přes Overpass API",
                    "prvku": len(raw.get("elements", [])), "arealu": len(fac)}, "arealy": fac}
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
    print(f"OSM tenis: {out['meta']['prvku']} prvků → {len(fac)} areálů → {OUT}")


if __name__ == "__main__":
    main()
