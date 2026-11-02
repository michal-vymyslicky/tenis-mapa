"""Turnaje Tennis Europe (Junior Tour) z veřejného vyhledávání te.tournamentsoftware.com → site/data/TE/turnaje.json.

Zdroj: /find/tournament (robots.txt povoleno; detaily turnajů /sport/ se nestahují – jen se na ně odkazuje).
Web vyžaduje souhlas s cookies – posíláme jen „základní funkce“ (CookiePurposes=1). Šetrně: 1 požadavek / 1,5 s.
Rozsah: od 1. 9. aktuálního tenisového roku (září–srpen) dál do budoucna, kam až jsou turnaje vypsané (+2 roky).
Místa: Nominatim (OSM) „areál, obec, země“ → „obec, země“; v ČR navíc paměť míst klubů ČTS (data/mista_kluby.json).
"""
import datetime as dt, html, json, os, re, sys, time, urllib.parse

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import DATA, SITE_DATA, UA_GEO, Http, load, norm, save

BASE = "https://te.tournamentsoftware.com"
TDIR = os.path.join(DATA, "TE")
UA = "TenisovaMapa/2.7 (+https://turnajovamapa.cz; tenisova-mapa@seznam.cz)"

# věkové skupiny TE → kategorie mapy (filtr kategorií je společný s ČTS)
AGE_CAT = {"10&U": "minitenis", "12&U": "mladsi-zactvo", "14&U": "starsi-zactvo", "16&U": "dorost", "18&U": "dorost"}
# kategorie turnajů TE → kód třídy (barva a písmeno ve špendlíku)
CLS = [("super category", "TS"), ("category 1", "T1"), ("category 2", "T2"), ("category 3", "T3"), ("masters", "TM"),
       ("european championship", "TEC"), ("festival", "TF"), ("invitational", "TI"), ("small states", "TSS")]
ISO = {"ALB": "al", "AND": "ad", "ARM": "am", "AUT": "at", "AZE": "az", "BLR": "by", "BEL": "be", "BIH": "ba", "BUL": "bg", "BGR": "bg",
       "CRO": "hr", "HRV": "hr", "CYP": "cy", "CZE": "cz", "DEN": "dk", "DNK": "dk", "EST": "ee", "FIN": "fi", "FRA": "fr", "GEO": "ge",
       "GER": "de", "DEU": "de", "GBR": "gb", "GRE": "gr", "GRC": "gr", "HUN": "hu", "ISL": "is", "IRL": "ie", "ISR": "il", "ITA": "it",
       "KAZ": "kz", "KOS": "xk", "LAT": "lv", "LVA": "lv", "LIE": "li", "LTU": "lt", "LUX": "lu", "MLT": "mt", "MDA": "md", "MON": "mc",
       "MCO": "mc", "MNE": "me", "NED": "nl", "NLD": "nl", "MKD": "mk", "NOR": "no", "POL": "pl", "POR": "pt", "PRT": "pt", "ROU": "ro",
       "RUS": "ru", "SMR": "sm", "SRB": "rs", "SVK": "sk", "SLO": "si", "SVN": "si", "ESP": "es", "SWE": "se", "SUI": "ch", "CHE": "ch",
       "TUR": "tr", "UKR": "ua", "EGY": "eg", "TUN": "tn", "MAR": "ma", "UAE": "ae", "ARE": "ae", "QAT": "qa", "USA": "us"}

geo_http = Http(ua=UA_GEO, pause=1.1)
CACHE = load("geocache.json", {})


def season_start(today=None):
    d = today or dt.date.today()
    return dt.date(d.year if d.month >= 9 else d.year - 1, 9, 1)


class TE:
    def __init__(self, pause=1.5):
        self.h = Http(ua=UA, pause=pause)

    def consent(self):
        self.h.get(f"{BASE}/cookiewall/?returnurl=%2Ffind%2Ftournament")
        self.h.get(f"{BASE}/cookiewall/Save", data="ReturnUrl=%2Ffind%2Ftournament&SettingsOpen=false&CookiePurposes=1",
                   referer=f"{BASE}/cookiewall/")

    def page(self, n, od, do):
        body = urllib.parse.urlencode({"Page": n, "TournamentExtendedFilter.SportID": 0, "TournamentFilter.Q": "",
                                       "TournamentFilter.DateFilterType": 0, "TournamentFilter.StartDate": od,
                                       "TournamentFilter.EndDate": do, "TournamentExtendedFilter.StatusFilterID": "false"})
        st, txt = self.h.get(f"{BASE}/find/tournament/DoSearch", data=body, referer=f"{BASE}/find/tournament")
        if st != 200:
            raise RuntimeError(f"TE DoSearch {st}")
        return txt


def text(s):
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", s or ""))).strip()


def parse(txt):
    out = []
    for m in re.finditer(r'<li class="list__item">\s*<div class="media">(.*?)</ul>', txt, re.S):
        b = m.group(1)
        gid = re.search(r"/sport/tournament\?id=([0-9A-Fa-f-]{36})", b)
        if not gid:
            continue
        name = text((re.search(r'class="media__link"[^>]*>(.*?)</a>', b, re.S) or [None, ""])[1])
        loc = re.search(r'icon-marker.*?<span class="nav-link__value">(.*?)</span>', b, re.S)
        venue, city, country, iso3 = "", "", "", ""
        if loc:
            raw = loc.group(1)
            f = re.search(r'flags/([A-Z]{3})\.svg"[^>]*alt="([^"]*)"', raw)
            if f:
                iso3, country = f.group(1), html.unescape(f.group(2))
            t = text(raw)
            if "|" in t:
                venue, rest = t.rsplit("|", 1)
            else:
                venue, rest = "", t
            venue, rest = venue.strip(), rest.strip()
            if country and rest.endswith(country):
                rest = rest[: -len(country)].strip(" ,")
            city = rest
        times = re.findall(r'<time datetime="(\d{4}-\d{2}-\d{2})', b)
        surf = re.search(r'icon-court.*?<span class="nav-link__value">(.*?)</span>', b, re.S)
        tags = [text(x) for x in re.findall(r'<span class="tag[^"]*">(.*?)</span>', b + "</ul>", re.S)]
        out.append({"id": gid.group(1).upper(), "nz": name, "venue": venue, "city": city, "country": country, "iso3": iso3,
                    "od": times[0] if times else None, "do": times[1] if len(times) > 1 else (times[0] if times else None),
                    "pov": text(surf.group(1)) if surf else "", "tags": tags,
                    "entry": bool(re.search(r"online entry", b, re.I))})
    return out


def fetch_all(od, do, pause=1.5, max_pages=80):
    te = TE(pause)
    te.consent()
    seen, rows = set(), []
    for n in range(1, max_pages + 1):
        part = parse(te.page(n, od, do))
        new = [r for r in part if r["id"] not in seen]
        if not new:
            break
        for r in new:
            seen.add(r["id"]); rows.append(r)
        print(f"  TE strana {n}: +{len(new)} (celkem {len(rows)})", flush=True)
    return rows


# ---------- místa ----------
def nominatim(q, cc):
    params = {"q": q, "format": "jsonv2", "limit": 1, "addressdetails": 0}
    if cc:
        params["countrycodes"] = cc
    url = "https://nominatim.openstreetmap.org/search?" + urllib.parse.urlencode(sorted(params.items()))
    if url in CACHE:
        return CACHE[url]
    st, body = geo_http.get(url)
    res = json.loads(body) if st == 200 and body.strip().startswith("[") else []
    CACHE[url] = [{k: x.get(k) for k in ("name", "display_name", "lat", "lon", "category", "type", "addresstype")} for x in res]
    return CACHE[url]


def clean_city(c):
    c = re.sub(r"\(.*?\)", "", c or "")
    c = re.sub(r"\b\d{1,2}\b$", "", c.strip())          # „Opava 7“, „Praha 4“ → bez čísla obvodu
    return re.sub(r"\s+", " ", c).strip(" ,-")


def resolve_venue(r, mem):
    cc = ISO.get(r["iso3"], "")
    venue, city = r["venue"], clean_city(r["city"])
    v = {"poradatel": venue or city, "adresa": ", ".join(x for x in (city, r["country"]) if x), "zdroj": "te", "region": r["country"],
         "lat": None, "lon": None, "presnost": "nezname", "nazev_mista": venue, "zeme": cc}
    # ČR: ověřený areál klubu ČTS se stejným názvem
    if cc == "cz" and venue:
        nv = norm(venue)
        for k, lst in mem.items():
            if k and (k == nv or k.startswith(nv) or nv.startswith(k)) and len(min(k, nv, key=len)) >= 6:
                m = next((x for x in lst if x["presnost"] in ("areal", "rucne")), None)
                if m:
                    v.update(lat=m["lat"], lon=m["lon"], presnost="areal", poznamka="místo podle areálu klubu v datech ČTS")
                    return v
    tries = []
    if venue:
        tries.append((f"{venue}, {city}" if city else venue, "areal"))
        tries.append((venue, "areal"))
    if city:
        tries.append((city, "obec"))
    for q, prec in tries:
        res = nominatim(q, cc)
        if not res:
            continue
        x = res[0]
        p = prec
        if prec == "areal" and (x.get("addresstype") in ("city", "town", "village", "municipality", "suburb", "county", "state", "country",
                                                         "hamlet", "city_district", "neighbourhood", "quarter") or x.get("category") == "boundary"):
            p = "obec"
        v.update(lat=round(float(x["lat"]), 6), lon=round(float(x["lon"]), 6), presnost=p)
        if p == "obec" and city:
            # areál nenalezen podle názvu → tenisové sportoviště v obci (OSM), označené jako neověřené
            for t in nominatim(f"tennis {city}", cc)[:1]:
                if t.get("category") in ("leisure", "building", "amenity") and _km((v["lat"], v["lon"]), (float(t["lat"]), float(t["lon"]))) <= 10:
                    v.update(lat=round(float(t["lat"]), 6), lon=round(float(t["lon"]), 6), presnost="areal_obec",
                             poznamka=f"tenisový areál v obci podle OSM: {t.get('name') or ''}".strip())
        return v
    return v


def _km(a, b):
    import math
    la1, lo1, la2, lo2 = map(math.radians, (a[0], a[1], b[0], b[1]))
    h = math.sin((la2 - la1) / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin((lo2 - lo1) / 2) ** 2
    return 6371 * 2 * math.asin(math.sqrt(h))


def cls_of(tags):
    t = " ".join(tags).lower()
    for k, c in CLS:
        if k in t:
            return c
    return "TX"


def process(pause=1.5, today=None):
    today = today or dt.date.today()
    od = season_start(today).isoformat()
    do = (today + dt.timedelta(days=730)).isoformat()
    print(f"=== Tennis Europe {od} → {do} ===", flush=True)
    rows = load(os.path.join("TE", "turnaje_raw.json"), []) if os.environ.get("TE_BEZ_STAHOVANI") else fetch_all(od, do, pause)
    if not rows:
        print("TE: žádné turnaje (chyba zdroje?) – data se nemění", flush=True)
        return None
    os.makedirs(TDIR, exist_ok=True)
    save("turnaje_raw.json", rows, folder=TDIR)
    mem = load("mista_kluby.json", {}) or {}
    vcache = load(os.path.join("TE", "mista.json"), {}) or {}
    mista, vidx, events = [], {}, []
    stav = load(os.path.join("TE", "stav.json"), {}) or {}
    ti = today.isoformat()
    for i, r in enumerate(rows):
        vk = f"{r['iso3']}|{norm(r['venue'])}|{norm(r['city'])}"
        if vk not in vcache or vcache[vk].get("presnost") in ("nezname", "obec") and not vcache[vk].get("v2"):
            vcache[vk] = resolve_venue(r, mem)
            vcache[vk]["v2"] = 1
            if i % 20 == 0:
                save("geocache.json", CACHE)
        if vk not in vidx:
            vidx[vk] = len(mista); mista.append(vcache[vk])
        ages = [t for t in r["tags"] if re.match(r"^\d{2}&U$", t)]
        kats = sorted({AGE_CAT[a] for a in ages if a in AGE_CAT}, key=lambda k: list(AGE_CAT.values()).index(k))
        name_l = r["nz"].lower()
        s = stav.setdefault(r["id"], {"prvni": ti})
        s["posledni"] = ti
        s["snimek"] = r
        events.append({"id": "TE-" + r["id"], "src": "te", "kat": kats[0] if kats else "", "kats": kats, "ages": ages,
                       "od": r["od"], "do": r["do"], "txt": "", "tr": cls_of(r["tags"]),
                       "tecat": next((t for t in r["tags"] if not re.match(r"^\d{2}&U$", t) and "entry" not in t.lower()), ""),
                       "nz": r["nz"], "por": r["venue"] or r["city"], "misto": vidx[vk], "pov": r["pov"], "zeme": vcache[vk].get("zeme", ""),
                       "entry": r["entry"], "st": "zruseno" if re.search(r"cancel", name_l) else "ok", "nove": s["prvni"],
                       "km": "", "kz": "", "mix": True})
    # turnaj, který z vyhledávání zmizel před svým koncem → zrušený (necháme ho v mapě přeškrtnutý)
    cur = {r["id"] for r in rows}
    for gid, s in stav.items():
        snap = s.get("snimek")
        if gid in cur or not snap or (snap.get("do") or "") < ti:
            continue
        s.setdefault("zruseno", ti)
        vk = f"{snap['iso3']}|{norm(snap['venue'])}|{norm(snap['city'])}"
        if vk in vcache:
            if vk not in vidx:
                vidx[vk] = len(mista); mista.append(vcache[vk])
            ages = [t for t in snap["tags"] if re.match(r"^\d{2}&U$", t)]
            kats = sorted({AGE_CAT[a] for a in ages if a in AGE_CAT}, key=lambda k: list(AGE_CAT.values()).index(k))
            events.append({"id": "TE-" + gid, "src": "te", "kat": kats[0] if kats else "", "kats": kats, "ages": ages, "od": snap["od"],
                           "do": snap["do"], "txt": "", "tr": cls_of(snap["tags"]), "tecat": "", "nz": snap["nz"], "por": snap["venue"],
                           "misto": vidx[vk], "pov": snap["pov"], "zeme": vcache[vk].get("zeme", ""), "entry": False, "st": "zruseno",
                           "zrus": s["zruseno"], "nove": s.get("prvni"), "km": "", "kz": "", "mix": True})
    save("mista.json", vcache, folder=TDIR)
    save("stav.json", stav, folder=TDIR)
    save("geocache.json", CACHE)
    events.sort(key=lambda e: (e["od"] or "9999", e["nz"]))
    out = {"meta": {"zdroj": "Tennis Europe (te.tournamentsoftware.com)", "od": od, "do": do,
                    "aktualizace": dt.datetime.now().astimezone().isoformat(timespec="minutes"), "pocet": len(events),
                    "prvni_beh": min((s.get("prvni", ti) for s in stav.values()), default=ti)},
           "mista": mista, "turnaje": events}
    save("turnaje.json", out, folder=os.path.join(SITE_DATA, "TE"), indent=None)
    from collections import Counter
    print(f"TE: turnajů {len(events)} | míst {len(mista)} | přesnost {dict(Counter(m['presnost'] for m in mista))} | "
          f"zemí {len({e['zeme'] for e in events})}", flush=True)
    return out


if __name__ == "__main__":
    process(pause=float(sys.argv[1]) if len(sys.argv) > 1 else 1.5)
