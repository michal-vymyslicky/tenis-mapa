"""Určení a ověření místa konání turnajů (souřadnice).

Pořadí zdrojů (sloupec `presnost` v mista.json):
  1. adresa z detailu turnaje (ČTS ji vyplní po schválení turnaje)       -> zdroj "detail"
  2. adresa klubu-pořadatele z adresáře klubů ČTS                         -> zdroj "adresar"
  3. turnaje oblastních svazů / ČTS bez adresy: místo loňského ročníku
     stejného kódu (loňská sezóna)                                                -> zdroj "loni" (odhad)
Geokódování (od v2.5): 1) RÚIAN – vyhledávací služba ČÚZK (adresní místa ČR, přesný bod budovy; zkouší varianty
zápisu: zkratky nábř./nám./tř., bez /orientačního čísla, oprava „Ulice123“), 2) Nominatim (OSM) jako záloha.
Přichycení na kurty: lokální index tenisových areálů ČR z OSM (data/osm_tenis.json, pipeline/osm_tenis.py – kurty
sloučené do areálů, názvy hal/areálů, web). Výběr areálu: vzdálenost od adresy, shoda názvu s klubem / s místem
v adrese / s webem, počet kurtů, hala (zima). `presnost`:
  "areal"      = bod na tenisovém areálu (u přesné adresy do 350 m nebo shoda názvu do 2,5 km)
  "areal_obec" = adresa jen na úroveň obce, areál vybrán v obci (nejvíc kurtů / shoda názvu) – neověřeno
  "adresa"     = bod adresy (areál v OSM v blízkosti není)
  "obec"       = jen střed obce
  "odhad"      = místo minulého ročníku (letos zatím nezveřejněno)
Ruční opravy: data/mista_opravy.csv (mají přednost).
"""
import csv, json, math, os, re, sys, time, urllib.parse
from common import DATA, UA_GEO, Http, load, norm, save

NOMI = "https://nominatim.openstreetmap.org/search"
geo_http = Http(ua=UA_GEO, pause=1.1)  # pravidla Nominatim: max 1 požadavek/s
cts_http = Http(pause=1.5)
CACHE = load("geocache.json", {})
STOP = set("tj tk sk ltc tc tcm tsm lob sa z s o s spolek sokol tenis tennis tenisovy klub club oddil sportovni centrum cz a as s r o "
           "academy akademie team clubu area arena sport sportcentrum resort park hala sportovni".split())
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
    a = re.sub(r"(^|,)\s*\d{3} ?\d{2}\s+(?=[A-ZÁ-Ža-zá-ž])", r"\1 ", a)   # PSČ před obcí (stejné místo s PSČ i bez něj)
    a = re.sub(r"\s+", " ", a).strip(" ,")
    return a


def city_of(addr):
    # „Pánkova 30/9, 10300 Praha 10“ -> „Praha 10“; „Lužánecká 7, Brno“ -> „Brno“
    last = addr.split(",")[-1].strip()
    return re.sub(r"^\d{3}\s?\d{2}\s*", "", last).strip()


RUIAN = "https://ags.cuzk.cz/arcgis/rest/services/RUIAN/Vyhledavaci_sluzba_nad_daty_RUIAN/MapServer/exts/GeocodeSOE/findAddressCandidates"
ruian_http = Http(ua=UA_GEO, pause=0.2)
ABBR = [(r"\bnábřeží\b", "nábř."), (r"\bnáměstí\b", "nám."), (r"\btřída\b", "tř."), (r"\bnábř\b(?!\.)", "nábř."),
        (r"\bnám\b(?!\.)", "nám."), (r"\bsídliště\b", "sídl.")]


def ruian(q):
    key = "ruian:" + q
    if key in CACHE:
        return CACHE[key]
    url = RUIAN + "?" + urllib.parse.urlencode({"SingleLine": q, "outSR": 4326, "maxLocations": 3, "f": "json"})
    try:
        st, body = ruian_http.get(url, tries=2)
        res = json.loads(body).get("candidates", []) if st == 200 else []
    except Exception:  # noqa: BLE001 – služba nedostupná → zkusí se Nominatim
        return []
    CACHE[key] = [{"a": c["address"], "lat": round(c["location"]["y"], 6), "lon": round(c["location"]["x"], 6), "s": c.get("score", 0)} for c in res]
    return CACHE[key]


def addr_parts(addr):
    """„Bezručova 4880,PO BOX 36, Chomutov 3“ → (ulice+číslo, obec, části) – pro RÚIAN a kontrolu výsledků."""
    a = re.sub(r"PO ?BOX ?\d+", "", addr, flags=re.I)
    a = re.sub(r"\bul\.\s*", "", a, flags=re.I)                                    # „ul.17.listopadu“
    a = re.sub(r"([A-ZÁ-Ža-zá-ž])\.(?=[A-ZÁ-Ža-zá-ž0-9])", r"\1. ", a)              # „B.Němcové“ → „B. Němcové“
    a = re.sub(r"(\d)\.(?=[A-Za-zÁ-ž])", r"\1. ", a)                                # „17.listopadu“ → „17. listopadu“
    a = re.sub(r"\bn\.\s*L\.?", "nad Labem", a)
    a = re.sub(r"\bn\.\s*Vlt\.?", "nad Vltavou", a)
    a = re.sub(r"([a-záčďéěíňóřšťúůýž])(\d)", r"\1 \2", a)                         # Salašska2182 → Salašska 2182
    parts = [p.strip() for p in a.split(",") if p.strip()]
    cand = parts[:-1] if len(parts) > 1 else parts
    street = next((p for p in cand if re.search(r"\d", p) and re.search(r"[A-Za-zÁ-ž]", p) and not re.match(r"^\d{3}\s?\d{2}\b", p)
                   and not re.match(r"^(Praha|Brno|Ostrava|Plzeň|Liberec)\s*\d+$", p)), "")
    city = city_of(a)
    city = re.sub(r"\s*-\s*.*$", "", city).strip()                                  # „Praha 8 - Čimice“ → „Praha 8“
    city = re.sub(r"/.*$", "", city).strip()                                          # „Brno/Kohoutovice“ → „Brno“
    return street, city, parts


def city_in(ck, text):
    """Obec (klíč) je v textu výsledku – i s drobným překlepem (Vedryně × Vendryně)."""
    import difflib
    if not ck:
        return True
    words = norm(text).split()
    return ck in words or any(difflib.SequenceMatcher(None, ck, w).ratio() >= 0.8 for w in words if abs(len(w) - len(ck)) <= 2)


def city_key(city):
    w = [t for t in norm(re.sub(r"\d+", " ", city)).split() if t not in ("nad", "pod", "u", "v")]
    return w[0] if w else ""


def street_key(street):
    w = [t for t in norm(re.sub(r"\d+\w*", " ", street)).split() if len(t) > 2 and t not in ("nam", "namesti", "nabr", "nabrezi", "trida", "ulice")]
    return w[0][:5] if w else ""


def geocode_ruian(addr):
    street, city, parts = addr_parts(addr)
    if not street or not city:
        return None
    cities = [city]
    c2 = re.sub(r"\s+\d+$", "", city).strip()                                        # „Liberec 1“, „Praha 22“ → bez čísla obvodu
    if c2 and c2 != city:
        cities.append(c2)
    sts = [street]
    s2 = re.sub(r"(\d+)\s*/\s*\d+\w*", r"\1", street)                                # bez orientačního čísla
    if s2 != street:
        sts.append(s2)
    for st in list(sts):
        for a, b in ABBR:
            v = re.sub(a, b, st, flags=re.I)
            if v != st and v not in sts:
                sts.append(v)
    qs = [f"{st}, {c}" for c in cities for st in sts]
    if re.match(r"^[A-ZÁ-Ž][^\d]*\s\d+$", street):                                  # „Trojanovice 112“ = obec + č. p.
        qs.append(street)
    ck, sk = city_key(city), street_key(street)
    for q in qs:
        for c in ruian(q):
            an = norm(c["a"])
            words = set(an.split())
            if c["s"] < 90:
                continue
            if q == street:
                if street_key(street) and an.startswith("c p ") and street_key(street) in an:
                    return c["lat"], c["lon"], "adresa", "RÚIAN: " + c["a"]
                continue
            if not city_in(ck, c["a"]):
                continue
            if sk and sk not in an:
                continue
            return c["lat"], c["lon"], "adresa", "RÚIAN: " + c["a"]
    return None


PLACE_JUNK = r"\b(sport\.?\s*areál|sportovní areál|areál|tenisové kurty|tenisová hala|kurty|hala|ulice|sportoviště)\b\.?"


def geocode_nominatim(addr):
    parts = [p.strip() for p in addr.split(",") if p.strip()]
    city = city_of(addr)
    cityb = re.sub(r"\s*-\s*.*$", "", city).strip()
    qs = [(addr, "adresa")] + [(p, "adresa") for p in parts[:-1] if re.search(r"\d", p)]
    # pojmenovaná místa v adrese („sport.areál Mrázovka“, „tenisové kurty Vyhlídka“) → hledat s obcí
    for p in parts[:-1]:
        if not re.search(r"\d", p):
            core = re.sub(PLACE_JUNK, " ", p, flags=re.I).strip(" .-")
            if len(core) > 3 and norm(core) != norm(cityb):
                qs.append((f"{core}, {re.sub(r'[0-9]+', '', cityb).strip()}", "misto"))
    qs += [(re.sub(r"^[^,]*,\s*", "", addr) if "," in addr else None, "obec"), (city, "obec")]
    for q, prec in qs:
        if not q:
            continue
        r = nominatim({"q": q, "limit": 1})
        ck = city_key(cityb)
        if r and not city_in(ck, " ".join(seg for seg in r[0].get("display_name", "").split(",")
                                          if not seg.strip().startswith(("okres", "Kraj")) and "kraj" not in seg)):
            r = None                                   # nalezeno v jiné obci → zkusit další dotaz
        if r:
            x = r[0]
            p = "adresa" if prec != "obec" else "obec"
            if x.get("category") == "highway":
                p = "ulice"
            elif x.get("category") == "boundary" or x.get("addresstype") in ("city", "town", "village", "suburb", "municipality", "city_district",
                                                                                 "county", "state", "hamlet", "neighbourhood", "quarter", "isolated_dwelling"):
                p = "obec"
            elif prec == "misto":
                p = "ulice"                       # pojmenované místo (park, areál) – hledat kurty v okolí ~1 km
            return float(x["lat"]), float(x["lon"]), p, "OSM: " + x.get("display_name", "")
    return None


def geocode_address(addr):
    addr = clean_addr(addr)
    if not addr:
        return None
    return geocode_ruian(addr) or geocode_nominatim(addr)


def tokens(name):
    return [t for t in norm(name).split() if len(t) > 2 and t not in STOP]


_OSM = None


def osm_index():
    global _OSM
    if _OSM is None:
        d = load("osm_tenis.json", {}) or {}
        _OSM = [f for f in d.get("arealy", []) if f.get("kurty") or re.search(r"tenis|tennis", norm(f.get("nazev", "")))]   # bez kurtů jen haly s tenisem v názvu
        for f in _OSM:
            f["_n"] = set(norm(" ".join([f.get("nazev", ""), re.sub(r"https?://|www\.|\.(cz|com|eu|org|net)\b.*", " ", f.get("web", "")),
                                        f.get("adresa", "")])).split())
    return _OSM


ADDR_STOP = {"ulice", "nam", "namesti", "trida", "nabr", "nabrezi", "areal", "sport", "sportovni", "tenisove", "kurty", "hala", "praha", "brno",
             "ostrava", "plzen", "psc", "box", "cesky", "ceske", "ceska", "nad", "pod", "pri", "u", "na", "v"}


def snap_to_tennis(pt, club_name, addr="", level="adresa", winter=True):
    """Nejlepší tenisový areál z OSM indexu kolem bodu → (lat, lon, název, vzdálenost km, shoda názvu, kurty) nebo None.
    level: „adresa“ (přesný bod budovy), „ulice“ (ulice / pojmenované místo), „obec“ (jen obec)."""
    _, city, _ = addr_parts(addr) if addr else ("", "", [])
    cityt = set(norm(city).split())
    toks = {t for t in tokens(club_name) if t not in cityt and t not in {"praha", "brno", "ostrava", "plzen"}}
    atoks = {t for t in norm(re.sub(r"\d+", " ", addr)).split() if len(t) > 3 and t not in ADDR_STOP and t not in cityt}
    best, big = None, []
    for f in osm_index():
        if abs(f["lat"] - pt[0]) > 0.05 or abs(f["lon"] - pt[1]) > 0.075:
            continue
        d = dist_km(pt, (f["lat"], f["lon"]))
        if d > 5:
            continue
        ov = len(toks & f["_n"]) + 0.5 * len(atoks & f["_n"])
        k = min(f.get("kurty", 0), 8)
        if k >= 3 and d <= 2.0:
            big.append(f)
        if level == "adresa":
            ok = (d <= 0.35 and (k >= 2 or f.get("nazev") or f.get("hala") or d <= 0.2)) or (ov and d <= 2.5)
        elif level == "ulice":
            tn = any(t.startswith(("tenis", "tennis")) for t in f["_n"])
            ok = (d <= 1.2 and (k >= 2 or (tn and f.get("hala")))) or (ov and d <= 3)
        else:
            ok = bool(ov) and d <= 5
        if not ok:
            continue
        score = d - 0.9 * ov - 0.03 * k - (0.12 if winter and f.get("hala") else 0) - (0.05 if f.get("nazev") else 0)
        if k <= 1 and not ov:
            score += 0.15                                   # jednotlivý kurt (hotel, soukromý) jen když nic lepšího
        if best is None or score < best[0]:
            best = (score, d, f, ov)
    if not best and level == "obec" and len(big) == 1:    # v obci je jediný větší areál
        f = big[0]
        best = (0, dist_km(pt, (f["lat"], f["lon"])), f, 0)
    if not best:
        return None
    _, d, f, ov = best
    nm = f.get("nazev") or ""          # bez názvu v OSM → v aplikaci se ukáže název pořadatele
    nn = set(norm(nm).split())
    if nm and not ov and not any(t.startswith(("tenis", "tennis")) for t in nn) and not (toks & nn):
        nm = ""                            # název jiného sportoviště v okolí (např. „Jump aréna“) – nepoužít
    return f["lat"], f["lon"], nm, round(d, 2), ov, f.get("kurty", 0)


def prev_season(season):
    """Z2627 → Z2526, L27 → L26 (loňský ročník stejného typu)."""
    y = int(season[1:3])
    return f"Z{y-1:02d}{y:02d}" if season[0] == "Z" else f"L{y-1:02d}"


def last_year_address(code, season="Z2627"):
    ps = prev_season(season)
    key = f"loni:{code}" if ps == "Z2526" else f"loni:{ps}:{code}"
    if key in CACHE:
        return CACHE[key]
    try:
        st, body = cts_http.get(f"https://cesky-tenis.cz/turnaj/{code}?sezona={ps}&tab=seznam")
    except Exception:  # noqa: BLE001 – web ČTS nedostupný/omezuje → bez loňské adresy (neukládá se, zkusí se příště)
        return ""
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


def load_svaz_mista():
    """data/mista_svaz.csv – místa oblastních přeborů podle rozpisu svazu (sezona;kod;klub;zdroj;poznamka)."""
    p = os.path.join(DATA, "mista_svaz.csv")
    out = {}
    if os.path.exists(p):
        with open(p, encoding="utf-8-sig") as f:
            for r in csv.DictReader(f, delimiter=";"):
                if r.get("kod") and r.get("klub"):
                    out[(r.get("sezona", "").strip(), r["kod"].strip())] = r
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
        return f"klub:{norm(poradatel)}|{norm(clean_addr(addr_detail))}"
    return f"klub:{norm(poradatel)}"


def resolve(requests, clubs, old=None):
    """requests: {klic: {poradatel, adresa_detail, kod}} -> {klic: místo}."""
    idx = club_index(clubs)
    ovr = load_overrides()
    mem = load("mista_kluby.json", {}) or {}
    svm = load_svaz_mista()
    old = old or {}
    out = {}
    for i, (key, rq) in enumerate(sorted(requests.items())):
        por, ad, code = rq["poradatel"], clean_addr(rq.get("adresa_detail", "")), rq.get("kod", "")
        club = None if norm(por) in RA else find_club(idx, por)
        sv = svm.get((rq.get("sezona", ""), code)) if norm(por) in RA else None
        if sv and not ad:                    # přebor svazu: pořádající klub podle rozpisu svazu
            club = find_club(idx, sv["klub"])
        if ad:
            addr, src = ad, "detail"
        elif sv and club:
            addr, src = clean_addr(club["adresa"]), "svaz_rozpis"
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
            winter = rq.get("sezona", "Z")[0] == "Z"
            s = snap_to_tennis((g[0], g[1]), sv["klub"] if src == "svaz_rozpis" else (por if src != "loni" else ""), addr, level=g[2], winter=winter)
            if g[2] == "ulice":
                v["presnost"] = "obec"
            if s:
                v.update(lat=round(s[0], 6), lon=round(s[1], 6), nazev_mista=s[2], osm_vzdalenost_km=s[3],
                         presnost="areal" if (g[2] == "adresa" or s[4] >= 1) else "areal_obec")
            if src == "loni":
                v["presnost"] = "odhad"
        if src == "svaz_rozpis":
            v["poznamka"] = f"místo podle rozpisu svazu: {sv['klub']}"
            # ověřený areál pořádajícího klubu (paměť míst) má přednost
            known = [m for m in mem.get(norm(sv["klub"]), []) if m["presnost"] in ("areal", "rucne")]
            if known:
                m = min(known, key=lambda m: dist_km((v["lat"], v["lon"]), (m["lat"], m["lon"])) if v["lat"] is not None else 0)
                v.update(lat=m["lat"], lon=m["lon"], nazev_mista=m.get("nazev", ""), presnost="areal")
        if key in ovr:
            o = ovr[key]
            v.update(lat=float(o["lat"]), lon=float(o["lon"]), presnost="rucne", nazev_mista=o.get("nazev_mista") or v["nazev_mista"],
                     adresa=o.get("adresa") or v["adresa"], poznamka=o.get("poznamka", ""))
        out[key] = v
        if i % 10 == 0:
            print(f"  místa {i}/{len(requests)}: {por} -> {v['presnost']} {v['nazev_mista']}", flush=True)
            save("geocache.json", CACHE)
    save("geocache.json", CACHE)
    # aktualizace paměti míst klubů (ověřené areály a ruční opravy)
    for key, v in out.items():
        if not key.startswith("klub:") or v["presnost"] not in ("areal", "rucne") or v.get("pamet") is not None:
            continue
        lst = mem.setdefault(norm(v["poradatel"]), [])
        se = requests[key].get("sezona", "")
        hit = next((m for m in lst if dist_km((m["lat"], m["lon"]), (v["lat"], v["lon"])) <= 0.15), None)
        rec = {"lat": v["lat"], "lon": v["lon"], "nazev": v.get("nazev_mista", ""), "presnost": v["presnost"], "adresa": v["adresa"], "sezona": se}
        if hit is None:
            lst.append(rec)
        elif v["presnost"] == "rucne" or hit["presnost"] != "rucne":
            hit.update(rec)
    # paměť míst klubu (jiné ročníky / jiný zápis adresy): slabé určení nahradit ověřeným areálem téhož klubu
    for key, v in out.items():
        rq = requests[key]
        if key.startswith("klub:") and v["presnost"] in ("adresa", "obec", "areal_obec", "nezname"):
            known = [m for m in mem.get(norm(v["poradatel"]), []) if m["presnost"] in ("areal", "rucne")]
            if v["lat"] is not None:
                known = [m for m in known if dist_km((v["lat"], v["lon"]), (m["lat"], m["lon"])) <= (3 if v["presnost"] != "adresa" else 0.8)]
            elif len({(round(m["lat"], 3), round(m["lon"], 3)) for m in known}) != 1:
                known = []
            if known:
                m = min(known, key=lambda m: dist_km((v["lat"], v["lon"]), (m["lat"], m["lon"])) if v["lat"] is not None else 0)
                v.update(lat=m["lat"], lon=m["lon"], nazev_mista=m.get("nazev", ""), presnost="areal", pamet=m.get("sezona", ""),
                         poznamka="místo podle ověřeného areálu klubu" + (f" (ročník {m['sezona']})" if m.get("sezona") and m["sezona"] != rq.get("sezona") else ""))
    save("mista_kluby.json", mem)
    return out
