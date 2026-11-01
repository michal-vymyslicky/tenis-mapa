"""Určení a ověření místa konání turnajů (souřadnice).

Pořadí zdrojů (sloupec `presnost` v mista.json):
  1. adresa z detailu turnaje (ČTS ji vyplní po schválení turnaje)       -> zdroj "detail"
  2. adresa klubu-pořadatele z adresáře klubů ČTS                         -> zdroj "adresar"
  3. turnaje oblastních svazů / ČTS bez adresy: místo loňského ročníku
     stejného kódu (loňská sezóna)                                                -> zdroj "loni" (odhad)
Adresa se geokóduje (Nominatim/OSM) a poté se v okolí 2,5 km hledá tenisový areál/hala
v OSM (sport=tennis, název s „tenis“/„tennis“ nebo shodou s názvem klubu) – `presnost`:
  "areal"  = bod přichycen na tenisový areál v OSM (ověřeno)
  "adresa" = bod adresy (areál v OSM nenalezen)
  "obec"   = jen střed obce
  "odhad"  = loňské místo (letos zatím nezveřejněno)
Ruční opravy: data/mista_opravy.csv (mají přednost).
"""
import csv, json, math, os, re, sys, time, urllib.parse
from common import DATA, UA_GEO, Http, load, norm, save

NOMI = "https://nominatim.openstreetmap.org/search"
geo_http = Http(ua=UA_GEO, pause=1.1)  # pravidla Nominatim: max 1 požadavek/s
cts_http = Http(pause=0.3)
CACHE = load("geocache.json", {})
STOP = set("tj tk sk ltc tc tcm tsm lob sa z s o s spolek sokol tenis tennis tenisovy klub club oddil sportovni centrum cz a as s r o "
           "academy akademie team clubu area arena sport sportcentrum".split())
RA = {"praha": "Praha", "stredocesky": "Středočeský", "jihocesky": "Jihočeský", "zapadocesky": "Západočeský",
      "severocesky": "Severočeský", "vychodocesky": "Východočeský", "jihomoravsky": "Jihomoravský",
      "severomoravsky": "Severomoravský", "cts": "ČTS"}


def nominatim(params):
    params = dict(params, format="jsonv2", countrycodes="cz", extratags=1, addressdetails=0)
    url = NOMI + "?" + urllib.parse.urlencode(sorted(params.items()))
    if url in CACHE:
        return CACHE[url]
    st, body = geo_http.get(url)
    res = json.loads(body) if st == 200 and body.strip().startswith("[") else []
    CACHE[url] = [{k: x.get(k) for k in ("name", "display_name", "lat", "lon", "category", "type", "addresstype", "extratags", "osm_type", "osm_id")} for x in res]
    return CACHE[url]


def dist_km(a, b):
    la1, lo1, la2, lo2 = map(math.radians, (a[0], a[1], b[0], b[1]))
    h = math.sin((la2 - la1) / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin((lo2 - lo1) / 2) ** 2
    return 6371 * 2 * math.asin(math.sqrt(h))


def clean_addr(a):
    a = re.sub(r"\([^)]*\)", "", a or "")          # poznámky v závorce („(dvorce: …)“, „(adresa kurtů)“)
    a = re.sub(r"\b0\b\s*", "", a)                # „Nad Újezdem, 0 Praha 1“ -> bez nuly
    a = re.sub(r"\s+", " ", a).strip(" ,")
    return a


def city_of(addr):
    # „Pánkova 30/9, 10300 Praha 10“ -> „Praha 10“; „Lužánecká 7, Brno“ -> „Brno“
    last = addr.split(",")[-1].strip()
    return re.sub(r"^\d{3}\s?\d{2}\s*", "", last).strip()


def geocode_address(addr):
    addr = clean_addr(addr)
    if not addr:
        return None
    parts = [p.strip() for p in addr.split(",") if p.strip()]
    qs = [(addr, "adresa")] + [(p, "adresa") for p in parts[:-1] if re.search(r"\d", p)] + \
         [(re.sub(r"^[^,]*,\s*", "", addr) if "," in addr else None, "obec"), (city_of(addr), "obec")]
    for q, prec in qs:
        if not q:
            continue
        r = nominatim({"q": q, "limit": 1})
        if r:
            x = r[0]
            p = prec
            if prec == "adresa" and x.get("addresstype") in ("city", "town", "village", "suburb", "municipality", "city_district", "county", "state"):
                p = "obec"
            return float(x["lat"]), float(x["lon"]), p, x.get("display_name", "")
    return None


def tokens(name):
    return [t for t in norm(name).split() if len(t) > 2 and t not in STOP]


def snap_to_tennis(pt, club_name, addr=""):
    dlat, dlon = 0.023, 0.035  # ≈ 2,5 km
    vb = f"{pt[1]-dlon},{pt[0]+dlat},{pt[1]+dlon},{pt[0]-dlat}"
    place = set(norm(addr).split()) | {"praha", "brno", "ostrava", "plzen", "liberec"}
    toks = [t for t in tokens(club_name) if t not in place]  # název obce v názvu klubu nesmí dělat „shodu“
    queries = ["tenis", "tennis", "tenisová hala", "tenisové kurty"] + ([" ".join(toks[:3])] if toks else [])
    cands = {}
    for q in queries:
        for x in nominatim({"q": q, "viewbox": vb, "bounded": 1, "limit": 15}):
            cands[(x.get("osm_type"), x.get("osm_id"))] = x
    best = None
    for x in cands.values():
        et = x.get("extratags") or {}
        nm = norm(x.get("name") or "")
        tennis = "tennis" in (et.get("sport") or "") or "tenis" in nm or "tennis" in nm
        sportish = x.get("category") in ("leisure", "building", "amenity") and x.get("type") in (
            "sports_centre", "sports_hall", "pitch", "stadium", "track", "fitness_centre", "yes", "club")
        overlap = len(set(toks) & set(nm.split()))
        if not (tennis or (sportish and overlap)):
            continue
        if not tennis and (re.search(r"lukostr|fotbal|hokej|plav|atlet|cyklo|golf|kuzel|bowling", nm) or (et.get("sport") and "tennis" not in et.get("sport", ""))):
            continue  # jiný sport se shodou názvu oddílu
        if re.search(r"stoln|table|bar\b|squash|badminton|restaura|hospod|servis|shop|obchod", nm) or "table_tennis" in (et.get("sport") or ""):
            continue  # stolní tenis, bary apod.
        if re.search(r"zanikl|byval|bývalé|disused|abandoned|demol", nm) or any(k.startswith(("disused", "abandoned", "was:")) for k in et):
            continue  # zaniklé kurty
        d = dist_km(pt, (float(x["lat"]), float(x["lon"])))
        if d > 2.5:
            continue
        # zima = kryté kurty: bonus pro haly / budovy / covered
        indoor = "hala" in nm or "hall" in nm or x.get("category") == "building" or x.get("type") == "sports_hall" or et.get("covered") in ("yes", "roof") or et.get("indoor") == "yes"
        score = d - 1.2 * overlap - (0.4 if tennis else 0) - (0.3 if et.get("sport") else 0) - (0.2 if x.get("type") in ("sports_centre", "sports_hall") else 0) - (0.25 if indoor else 0)
        if best is None or score < best[0]:
            best = (score, d, x, overlap)
    if not best:
        return None
    _, d, x, ov = best
    return float(x["lat"]), float(x["lon"]), x.get("name") or "tenisový areál", round(d, 2), ov


def prev_season(season):
    """Z2627 → Z2526, L27 → L26 (loňský ročník stejného typu)."""
    y = int(season[1:3])
    return f"Z{y-1:02d}{y:02d}" if season[0] == "Z" else f"L{y-1:02d}"


def last_year_address(code, season="Z2627"):
    ps = prev_season(season)
    key = f"loni:{code}" if ps == "Z2526" else f"loni:{ps}:{code}"
    if key in CACHE:
        return CACHE[key]
    st, body = cts_http.get(f"https://cesky-tenis.cz/turnaj/{code}?sezona={ps}&tab=seznam")
    addr = ""
    if st == 200:
        m = re.search(r"<span>\s*Pořadatel\s*</span>(.*?)</p>", body, re.S)
        if m:
            t = re.sub(r"<[^>]+>", " ", m.group(1))
            t = re.sub(r"\s+", " ", t).strip()
            addr = re.sub(r"^.*?\([^)]*\)\s*,\s*", "", t).strip(" ,")
    CACHE[key] = addr
    return addr


def load_overrides():
    p = os.path.join(DATA, "mista_opravy.csv")
    out = {}
    if os.path.exists(p):
        with open(p, encoding="utf-8-sig") as f:
            for r in csv.DictReader(f, delimiter=";"):
                if r.get("klic") and r.get("lat") and r.get("lon"):
                    out[r["klic"]] = r
    return out


def club_index(clubs):
    idx = {}
    for c in clubs:
        idx.setdefault(norm(c["nazev"]), c)
    return idx


def find_club(idx, poradatel):
    n = norm(poradatel)
    if n in idx:
        return idx[n]
    cands = [k for k in idx if k and (n.startswith(k) or k.startswith(n))]
    return idx[max(cands, key=len)] if cands else None


def venue_key(poradatel, code, addr_detail):
    """Klíč místa: klub = jedno místo; svaz/ČTS = podle kódu turnaje (každý přebor jinde)."""
    if norm(poradatel) in RA:
        return f"svaz:{norm(poradatel)}:{code}"
    if addr_detail:
        return f"klub:{norm(poradatel)}|{norm(addr_detail)}"
    return f"klub:{norm(poradatel)}"


def resolve(requests, clubs, old=None):
    """requests: {klic: {poradatel, adresa_detail, kod}} -> {klic: místo}."""
    idx = club_index(clubs)
    ovr = load_overrides()
    old = old or {}
    out = {}
    for i, (key, rq) in enumerate(sorted(requests.items())):
        por, ad, code = rq["poradatel"], clean_addr(rq.get("adresa_detail", "")), rq.get("kod", "")
        club = None if norm(por) in RA else find_club(idx, por)
        if ad:
            addr, src = ad, "detail"
        elif club:
            addr, src = clean_addr(club["adresa"]), "adresar"
        elif code:
            addr, src = last_year_address(code, rq.get("sezona", "Z2627")), "loni"
        else:
            addr, src = "", "nezname"
        v = {"klic": key, "poradatel": por, "adresa": addr, "zdroj": src, "region": club["region"] if club else RA.get(norm(por), ""),
             "lat": None, "lon": None, "presnost": "nezname", "nazev_mista": "", "osm_vzdalenost_km": None}
        g = geocode_address(addr) if addr else None
        if g:
            v.update(lat=round(g[0], 6), lon=round(g[1], 6), presnost=g[2], geokod=g[3])
            s = snap_to_tennis((g[0], g[1]), por if src != "loni" else "", addr)
            # přijetí areálu: shoda názvu s klubem (do 2,5 km), nebo areál do 400 m od přesné adresy;
            # u adresy jen na úroveň obce = nejbližší areál v obci, ale označený jako neověřený
            if s and ((g[2] == "adresa" and (s[3] <= 0.4 or (s[4] > 0 and s[3] <= 0.6))) or (g[2] != "adresa" and s[4] > 0)):
                v.update(lat=round(s[0], 6), lon=round(s[1], 6), presnost="areal", nazev_mista=s[2], osm_vzdalenost_km=s[3])
            elif s and g[2] == "obec" and s[3] <= 1.0:
                v.update(lat=round(s[0], 6), lon=round(s[1], 6), presnost="areal_obec", nazev_mista=s[2], osm_vzdalenost_km=s[3])
            if src == "loni":
                v["presnost"] = "odhad"
        if key in ovr:
            o = ovr[key]
            v.update(lat=float(o["lat"]), lon=float(o["lon"]), presnost="rucne", nazev_mista=o.get("nazev_mista") or v["nazev_mista"],
                     adresa=o.get("adresa") or v["adresa"], poznamka=o.get("poznamka", ""))
        out[key] = v
        if i % 10 == 0:
            print(f"  místa {i}/{len(requests)}: {por} -> {v['presnost']} {v['nazev_mista']}", flush=True)
            save("geocache.json", CACHE)
    save("geocache.json", CACHE)
    return out
