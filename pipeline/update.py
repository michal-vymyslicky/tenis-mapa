"""Obnova dat Tenisové mapy – více sezón (zima Zxxyy, léto Lyy).

  python3 pipeline/update.py --auto                  # denní běh: aktuální + následující sezóna (+ právě skončená do 30 dnů)
  python3 pipeline/update.py --sezona Z2526          # jedna sezóna (doplnění archivu / ruční obnova)
  python3 pipeline/update.py --sezona Z2526 --vlakna 2 --pauza 0.8   # šetrné stahování archivu
  python3 pipeline/update.py --sezona Z2627 --bez-stahovani          # jen přepočet z uložených dat
  python3 pipeline/update.py --index                 # jen site/data/sezony.json + zebricek.json
  python3 pipeline/update.py --kluby ...             # navíc obnoví adresář klubů ČTS (stačí občas)

Data sezóny: data/<sezóna>/ (lists, details, stav, prihlasky, mista); sdílené: data/geocache.json, clubs.json, mista_opravy.csv.
Web: site/data/<sezóna>/turnaje.json + hraci.json, site/data/sezony.json (přehled sezón), site/data/zebricek.json.

Zrušené turnaje: turnaj, který byl v listině a zmizel z ní (a listina kategorie se stáhla v pořádku),
nebo má v názvu/řádku „zruš“, dostane stav „zruseno“ a dál se zobrazuje (přeškrtnutě) – data/<sezóna>/stav.json.
"""
import argparse, datetime as dt, glob, json, os, re, shutil, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import DATA, SITE_DATA, load, norm, save
import cts, venues

PIPE = os.path.dirname(os.path.abspath(__file__))
TODAY = dt.date.today()
LEGACY = "Z2627"   # sezóna, jejíž data ležela do v2.3 přímo v data/ – při prvním běhu se přesunou do data/Z2627/


# ---------------------------------------------------------------- sezóny
def season_range(s):
    """Z2627 → 1. 10. 2026 – 31. 3. 2027; L26 → 1. 4. – 30. 9. 2026 (orientační okno sezóny)."""
    if s[0] == "Z":
        y = 2000 + int(s[1:3])
        return dt.date(y, 10, 1), dt.date(y + 1, 3, 31)
    y = 2000 + int(s[1:3])
    return dt.date(y, 4, 1), dt.date(y, 9, 30)


def season_name(s):
    y = 2000 + int(s[1:3])
    return f"zima {y}/{str(y + 1)[2:]}" if s[0] == "Z" else f"léto {y}"


def season_of(d):
    if d.month >= 10:
        return f"Z{d.year % 100:02d}{(d.year + 1) % 100:02d}"
    if d.month <= 3:
        return f"Z{(d.year - 1) % 100:02d}{d.year % 100:02d}"
    return f"L{d.year % 100:02d}"


def season_next(s):
    a, b = season_range(s)
    return season_of(b + dt.timedelta(days=1))


def season_prev(s):
    a, b = season_range(s)
    return season_of(a - dt.timedelta(days=1))


def seasons_auto(d=TODAY):
    """Aktuální sezóna, následující (listina vychází s předstihem) a předchozí do 30 dnů po konci (pozdní výsledky)."""
    cur = season_of(d)
    out = [cur, season_next(cur)]
    prev = season_prev(cur)
    if d <= season_range(prev)[1] + dt.timedelta(days=30):
        out.insert(0, prev)
    return out


# ---------------------------------------------------------------- pomocné
def parse_date(s):
    s = (s or "").replace("\xa0", " ")
    m = re.match(r"^(\d+)\.\s*-\s*(\d+)\.\s*(\d+)\.\s*(\d{4})$", s)
    if m:
        d1, d2, mo, y = map(int, m.groups()); return dt.date(y, mo, d1), dt.date(y, mo, d2)
    m = re.match(r"^(\d+)\.\s*(\d+)\.\s*-\s*(\d+)\.\s*(\d+)\.\s*(\d{4})$", s)
    if m:
        d1, m1, d2, m2, y = map(int, m.groups())
        return dt.date(y - 1 if m1 > m2 else y, m1, d1), dt.date(y, m2, d2)
    m = re.match(r"^(\d+)\.\s*(\d+)\.\s*(\d{4})$", s)
    if m:
        d, mo, y = map(int, m.groups()); return dt.date(y, mo, d), dt.date(y, mo, d)
    return None, None


def num(s):
    m = re.search(r"\d[\d ]*", s or "")
    return int(m.group(0).replace(" ", "")) if m else None


def occ(s):
    m = re.match(r"^\s*(\d+)\s*/\s*(\d+)", s or "")
    return [int(m.group(1)), int(m.group(2))] if m else None


def addr_from_detail(d):
    a = d.get("poradatel_adresa") or ""
    a = re.sub(r"^.*?\([^)]*\)\s*,?\s*", "", a) if "(" in a else a
    return a.strip(" ,")


def sekce_kod(sec):
    s = (sec or "").lower()
    return "O" if re.search("odstran|odhl", s) else "Q" if "kvalif" in s else "N" if "náhrad" in s else "H"


ZEB_KAT = {"mz": "mladší žáci", "mzk": "mladší žákyně", "sz": "starší žáci", "szk": "starší žákyně",
           "d": "dorostenci", "dk": "dorostenky", "m": "muži", "z": "ženy"}


def migrate_legacy():
    """Do v2.3 ležela data jediné sezóny (Z2627) přímo v data/ – přesun do data/Z2627/ a doplnění sezóny do ID turnajů."""
    dst = os.path.join(DATA, LEGACY)
    if os.path.exists(os.path.join(DATA, "lists.json")) and not os.path.exists(os.path.join(dst, "lists.json")):
        os.makedirs(dst, exist_ok=True)
        for f in ("lists.json", "details.json", "stav.json", "prihlasky.json", "mista.json", "kontrola_mist.csv"):
            if os.path.exists(os.path.join(DATA, f)):
                shutil.move(os.path.join(DATA, f), os.path.join(dst, f))
        print("migrace: data přesunuta do data/" + LEGACY, flush=True)
    elif os.path.exists(os.path.join(dst, "lists.json")):
        for f in ("lists.json", "details.json", "stav.json", "prihlasky.json", "mista.json", "kontrola_mist.csv"):
            if os.path.exists(os.path.join(DATA, f)):
                os.remove(os.path.join(DATA, f))   # zbytky staré struktury (data už jsou v data/Z2627/)
    for f in ("turnaje.json", "hraci.json"):
        p = os.path.join(SITE_DATA, f)
        if os.path.exists(p):
            os.remove(p)


def sload(season, name, default=None):
    return load(os.path.join(season, name), default)


def ssave(season, name, obj, indent=1):
    save(name, obj, folder=os.path.join(DATA, season), indent=indent)


# ---------------------------------------------------------------- jedna sezóna
def process(season, download=True, threads=3, pause=0.3, clubs=None):
    print(f"=== sezóna {season} ({season_name(season)}) ===", flush=True)
    lists = sload(season, "lists.json", {})
    details = sload(season, "details.json", {})
    ok_slugs = set()
    if download:
        for slug in cts.CATS:
            rows, ok = cts.fetch_list(slug, season)
            print(f"listina {slug}: {len(rows)} řádků, ok={ok}", flush=True)
            if ok and (rows or not lists.get(slug)):
                lists[slug] = rows; ok_slugs.add(slug)
            elif ok and not rows and lists.get(slug):
                print(f"  ! {slug}: web vrátil 0 řádků, předtím {len(lists[slug])} – beru jako chybu, ponechávám", flush=True)
        if not any(lists.values()):
            print(f"sezóna {season}: listina zatím prázdná – nic dalšího", flush=True)
            ssave(season, "lists.json", lists)
            return None
        ssave(season, "lists.json", lists)
        codes = sorted({c for rows in lists.values() for r in rows for c in (r.get("kod_m"), r.get("kod_z")) if c})
        new = cts.fetch_details(codes, season, threads=threads, pause=pause)
        prihl = sload(season, "prihlasky.json", {})
        for c, d in new.items():
            # přihlášky (veřejné seznamy z cesky-tenis.cz): jen ID, jméno, klub a sekce – bez roku narození a bodů
            pr = d.pop("prihlaseni", None)
            if pr is not None:
                d["prihlaseno"] = sum(1 for e in pr if not re.search("odstran|odhl", e.get("sekce", "").lower()))
                if d.get("_status") == "ok":
                    prihl[c] = [[e["id"], e["jmeno"], e["klub"], sekce_kod(e.get("sekce", ""))] for e in pr if e.get("id")]
            if d.get("_status") == "ok" or c not in details:
                details[c] = d
        ssave(season, "details.json", details)
        ssave(season, "prihlasky.json", {c: v for c, v in prihl.items() if c in set(codes)})
    else:
        ok_slugs = set(lists)
    if not any(lists.values()):
        return None

    # --- události ---
    events, vreq = [], {}
    for slug, rows in lists.items():
        for r in rows:
            km, kz = r.get("kod_m", ""), r.get("kod_z", "")
            dm, dz = details.get(km, {}) if km else {}, details.get(kz, {}) if kz else {}
            d = dm if dm.get("_status") == "ok" else dz
            od, do = parse_date(r["datum"])
            tr = r["trida"] or ("MCR" if r["poradatel"].strip() == "ČTS" or "MČR" in d.get("nazev", "") else "")
            ad = addr_from_detail(d)
            vk = venues.venue_key(r["poradatel"], km or kz, ad)
            vreq.setdefault(vk, {"poradatel": r["poradatel"], "adresa_detail": ad, "kod": km or kz, "sezona": season})
            m = re.match(r"^\s*(\d+)\s*•\s*(.*)$", d.get("dvorce_povrch", ""))
            text = " ".join([r.get("radek", ""), d.get("nazev", ""), d.get("h1", "")]).lower()
            ent = {k: dd.get("prihlaseno") for k, dd in (("m", dm), ("z", dz))}
            events.append({
                "id": f"{season}-{slug}-{km or 'x'}-{kz or 'x'}", "kat": slug, "od": od.isoformat() if od else None,
                "do": do.isoformat() if do else None, "txt": r["datum"], "tr": tr, "vk": num(r["vklad"]),
                "nz": d.get("nazev", ""), "por": r["poradatel"], "misto": vk, "km": km, "kz": kz,
                "mix": bool(r.get("mix")), "om": occ(r.get("obs_m")), "oz": occ(r.get("obs_z")), "pm": ent.get("m"), "pz": ent.get("z"),
                "kap": num(d.get("pocet_ucastniku")), "dv": int(m.group(1)) if m else None,
                "pov": (m.group(2).strip() if m else d.get("dvorce_povrch", "")) or "", "mic": d.get("mice", ""),
                "prez": d.get("prezentace", ""), "el": d.get("el_prezence", "") if d.get("el_prezence") not in ("—", "-") else "",
                "hp": bool(dm.get("hraci_plany") or dz.get("hraci_plany")),
                "st": "zruseno" if "zruš" in text else "ok",
                "test": "nepřihlašujte" in text or "testovací" in text})

    # --- stav (první výskyt, zrušené) ---
    stav = sload(season, "stav.json", {})
    for k in [k for k in stav if not k.startswith(season + "-")]:   # starší ID bez sezóny (do v2.3)
        s = stav.pop(k); stav[f"{season}-{k}"] = s
        if s.get("snimek"): s["snimek"]["id"] = f"{season}-{k}"
    today = TODAY.isoformat()
    cur = {e["id"] for e in events}
    for e in events:
        s = stav.setdefault(e["id"], {"prvni": today})
        s["posledni"] = today
        if e["st"] == "zruseno":
            s.setdefault("zruseno", today)
        s["snimek"] = e
        e["nove"] = s["prvni"]
    for eid, s in stav.items():
        if eid in cur:
            continue
        snap = dict(s.get("snimek") or {})
        if not snap:
            continue
        if snap["kat"] in ok_slugs and not s.get("zruseno"):
            s["zruseno"] = today
        if s.get("zruseno"):
            snap.update(st="zruseno", zrus=s["zruseno"], nove=s.get("prvni"))
            # ČTS u zrušeného turnaje často nechá v listině řádek bez kódů – nahradíme ho původním snímkem s detaily
            events[:] = [e for e in events if not (not e["km"] and not e["kz"] and e["kat"] == snap["kat"]
                                                   and e["txt"] == snap["txt"] and e["por"] == snap["por"])]
            events.append(snap)
            vreq.setdefault(snap["misto"], {"poradatel": snap["por"], "adresa_detail": "", "kod": snap.get("km") or snap.get("kz"), "sezona": season})
    ssave(season, "stav.json", stav)

    # --- místa ---
    mista = venues.resolve(vreq, clubs if clubs is not None else load("clubs.json", []))
    ssave(season, "mista.json", mista)

    keys = sorted(mista)
    kidx = {k: i for i, k in enumerate(keys)}
    for e in events:
        e["misto"] = kidx[e["misto"]]
    events.sort(key=lambda e: (e["od"] or "9999", e["kat"], e["por"]))
    sd = os.path.join(SITE_DATA, season)
    out = {
        "meta": {"sezona": season, "nazev": season_name(season), "aktualizace": dt.datetime.now().astimezone().isoformat(timespec="minutes"),
                 "pocet": len(events), "kategorie": cts.CATS,
                 "prvni_beh": min((s.get("prvni", today) for s in stav.values()), default=today),
                 "pocty_kategorii": {s: len(r) for s, r in lists.items()}},
        "mista": [{k: mista[x].get(k) for k in ("poradatel", "adresa", "zdroj", "region", "lat", "lon", "presnost", "nazev_mista", "poznamka")}
                  for x in keys],
        "turnaje": events,
    }
    save("turnaje.json", out, folder=sd, indent=None)
    build_hraci(season, events)
    from collections import Counter
    print(f"{season}: turnajů {len(events)} | míst {len(keys)} | přesnost {dict(Counter(m['presnost'] for m in mista.values()))}"
          f" | zrušeno {sum(e['st'] == 'zruseno' for e in events)}", flush=True)
    return out


def latest_zebricek():
    fs = sorted(glob.glob(os.path.join(PIPE, "zebricek_*.json")))
    return fs[-1] if fs else None


def build_hraci(season, events):
    """site/data/<sezóna>/hraci.json: přihlášky hráčů na turnaje sezóny (+ jména hráčů, kteří nejsou v žebříčku)."""
    zp = latest_zebricek()
    zeb = json.load(open(zp, encoding="utf-8")).get("hraci", {}) if zp else {}
    prihl = sload(season, "prihlasky.json", {})
    code2ev = {}
    for e in events:
        if e.get("km"): code2ev[e["km"]] = (e["id"], "m" if not e.get("mix") else "d")
        if e.get("kz"): code2ev[e["kz"]] = (e["id"], "z")
    extra, entries = {}, {}
    for code, lst in prihl.items():
        if code not in code2ev:
            continue
        eid, g = code2ev[code]
        for pid, n, k, sec in lst:
            if sec == "O":
                continue
            if pid not in zeb and pid not in extra:
                extra[pid] = [n, k, []]
            entries.setdefault(pid, []).append([eid, g, sec])
    save("hraci.json", {"meta": {"sezona": season, "aktualizace": dt.datetime.now().astimezone().isoformat(timespec="minutes"),
                                  "prihlasenych": len(entries), "prihlasek": sum(len(v) for v in entries.values())},
                         "p": extra, "e": entries}, folder=os.path.join(SITE_DATA, season), indent=None)
    print(f"{season}: hráčů s přihláškou {len(entries)} | přihlášek {sum(len(v) for v in entries.values())}", flush=True)


def build_index():
    """site/data/sezony.json (všechny sezóny s daty) a site/data/zebricek.json (hráči z posledního žebříčku)."""
    rows = []
    for p in sorted(glob.glob(os.path.join(SITE_DATA, "*", "turnaje.json"))):
        s = os.path.basename(os.path.dirname(p))
        if not re.match(r"^[ZL]\d{2}(\d{2})?$", s):
            continue
        m = json.load(open(p, encoding="utf-8"))["meta"]
        a, b = season_range(s)
        rows.append({"id": s, "nazev": season_name(s), "od": a.isoformat(), "do": b.isoformat(), "pocet": m["pocet"],
                     "aktualizace": m["aktualizace"], "archiv": TODAY > b + dt.timedelta(days=30)})
    rows.sort(key=lambda r: r["od"], reverse=True)
    zp = latest_zebricek()
    zname = ""
    if zp:
        z = json.load(open(zp, encoding="utf-8"))
        m = re.search(r"zebricek_(\d{4})([ZL])", os.path.basename(zp))
        zname = (f"zima {int(m.group(1)) - 1}/{m.group(1)[2:]}" if m.group(2) == "Z" else f"léto {m.group(1)}") if m else ""
        save("zebricek.json", {"meta": {"zebricek": zname, "kategorie": ZEB_KAT}, "p": z.get("hraci", {})}, folder=SITE_DATA, indent=None)
    save("sezony.json", {"aktualizace": dt.datetime.now().astimezone().isoformat(timespec="minutes"), "zebricek": zname,
                         "sezony": rows}, folder=SITE_DATA, indent=1)
    print("sezóny na webu:", [(r["id"], r["pocet"]) for r in rows], flush=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--sezona", action="append", help="sezóna (Z2627, L27…); lze opakovat")
    ap.add_argument("--auto", action="store_true", help="aktuální + následující sezóna podle data")
    ap.add_argument("--bez-stahovani", action="store_true")
    ap.add_argument("--kluby", action="store_true")
    ap.add_argument("--index", action="store_true", help="jen přehled sezón a žebříček")
    ap.add_argument("--vlakna", type=int, default=3)
    ap.add_argument("--pauza", type=float, default=0.3)
    a = ap.parse_args()

    migrate_legacy()
    if a.kluby:
        import subprocess
        subprocess.run([sys.executable, os.path.join(PIPE, "_puvodni_scrape_clubs.py"), DATA], check=True)
    seasons = a.sezona or (seasons_auto() if a.auto else ([] if a.index else [os.environ.get("SEZONA") or season_of(TODAY)]))
    clubs = load("clubs.json", [])
    for s in seasons:
        process(s, download=not a.bez_stahovani, threads=a.vlakna, pause=a.pauza, clubs=clubs)
    build_index()


if __name__ == "__main__":
    main()
