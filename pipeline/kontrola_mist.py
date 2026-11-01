"""Kontrolní přehled míst konání: data/kontrola_mist.csv (pro ruční ověření a opravy).

Pro každé místo: klíč, pořadatel, adresa, zdroj adresy, přesnost, název areálu v OSM, vzdálenost
areálu od adresy, počet turnajů, odkaz do mapy. Opravy se zapisují do data/mista_opravy.csv
(stejný `klic`, lat, lon, název, adresa, poznámka) a projeví se při dalším běhu update.py.
"""
import csv, json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import DATA, SITE_DATA

site = json.load(open(os.path.join(SITE_DATA, "turnaje.json"), encoding="utf-8"))
mista = json.load(open(os.path.join(DATA, "mista.json"), encoding="utf-8"))
keys = sorted(mista)
cnt = {}
for e in site["turnaje"]:
    cnt[keys[e["misto"]]] = cnt.get(keys[e["misto"]], 0) + 1
order = {"nezname": 0, "odhad": 1, "obec": 2, "areal_obec": 3, "adresa": 4, "areal": 5, "rucne": 6}
rows = sorted(mista.values(), key=lambda v: (order.get(v["presnost"], 9), -cnt.get(v["klic"], 0)))
with open(os.path.join(DATA, "kontrola_mist.csv"), "w", encoding="utf-8-sig", newline="") as f:
    w = csv.writer(f, delimiter=";")
    w.writerow(["klic", "poradatel", "pocet_turnaju", "presnost", "zdroj_adresy", "adresa", "nazev_mista_OSM", "vzdalenost_od_adresy_km", "lat", "lon", "mapa"])
    for v in rows:
        w.writerow([v["klic"], v["poradatel"], cnt.get(v["klic"], 0), v["presnost"], v["zdroj"], v["adresa"], v.get("nazev_mista", ""),
                    v.get("osm_vzdalenost_km") or "", v["lat"], v["lon"],
                    f"https://www.openstreetmap.org/?mlat={v['lat']}&mlon={v['lon']}#map=17/{v['lat']}/{v['lon']}" if v["lat"] else ""])
from collections import Counter
print("kontrola_mist.csv:", len(rows), "míst", dict(Counter(v["presnost"] for v in rows)))
