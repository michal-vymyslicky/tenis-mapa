"""Denní obnova dat Tenisové mapy.

  python3 pipeline/update.py                 # stáhne listinu + detaily, určí místa, vytvoří site/data/turnaje.json
  python3 pipeline/update.py --bez-stahovani # jen přepočet z data/lists.json + data/details.json
  python3 pipeline/update.py --kluby         # navíc obnoví adresář klubů ČTS (stačí občas)

Zrušené turnaje: turnaj, který byl v listině a zmizel z ní (a listina kategorie se stáhla v pořádku),
nebo má v názvu/řádku „zruš“, dostane stav „zruseno“ a dál se zobrazuje (přeškrtnutě) – data/stav.json.
"""
import argparse, datetime as dt, json, os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import DATA, SITE_DATA, load, norm, save
import cts, venues

SEASON = os.environ.get("SEZONA", "Z2627")
TODAY = dt.date.today().isoformat()


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


def build_hraci(events):
    """site/data/hraci.json: hráči ze žebříčku (+ přihlášení, kteří v žebříčku nejsou) a jejich přihlášky na turnaje."""
    # žebříček (vstup – export z Tenis Data data/01_zebricky, obnovit při novém žebříčku): pipeline/zebricek_2027Z.json
    zp = os.path.join(os.path.dirname(os.path.abspath(__file__)), "zebricek_2027Z.json")
    zeb = json.load(open(zp, encoding="utf-8")).get("hraci", {}) if os.path.exists(zp) else {}
    prihl = load("prihlasky.json", {})
    code2ev = {}
    for e in events:
        if e.get("km"): code2ev[e["km"]] = (e["id"], "m" if not e.get("mix") else "d")
        if e.get("kz"): code2ev[e["kz"]] = (e["id"], "z")
    players, entries = {}, {}
    for pid, (n, k, cats) in zeb.items():
        players[pid] = [n, k, cats]
    for code, lst in prihl.items():
        if code not in code2ev:
            continue
        eid, g = code2ev[code]
        for pid, n, k, sec in lst:
            if sec == "O":
                continue
            if pid not in players:
                players[pid] = [n, k, []]
            entries.setdefault(pid, []).append([eid, g, sec])
    save("hraci.json", {"meta": {"aktualizace": dt.datetime.now().astimezone().isoformat(timespec="minutes"),
                                  "zebricek": "zima 2026/27", "kategorie": ZEB_KAT,
                                  "prihlasenych": len(entries), "prihlasek": sum(len(v) for v in entries.values())},
                         "p": players, "e": entries}, folder=SITE_DATA, indent=None)
    print("hráči:", len(players), "| s přihláškou:", len(entries), "| přihlášek:", sum(len(v) for v in entries.values()))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--bez-stahovani", action="store_true")
    ap.add_argument("--kluby", action="store_true")
    a = ap.parse_args()

    lists = load("lists.json", {})
    details = load("details.json", {})
    ok_slugs = set()
    if not a.bez_stahovani:
        for slug in cts.CATS:
            rows, ok = cts.fetch_list(slug, SEASON)
            print(f"listina {slug}: {len(rows)} řádků, ok={ok}", flush=True)
            if ok and (rows or not lists.get(slug)):
                lists[slug] = rows; ok_slugs.add(slug)
            elif ok and not rows and lists.get(slug):
                print(f"  ! {slug}: web vrátil 0 řádků, předtím {len(lists[slug])} – beru jako chybu, ponechávám", flush=True)
        save("lists.json", lists)
        codes = sorted({c for rows in lists.values() for r in rows for c in (r.get("kod_m"), r.get("kod_z")) if c})
        new = cts.fetch_details(codes, SEASON)
        prihl = load("prihlasky.json", {})
        for c, d in new.items():
            # přihlášky (veřejné seznamy z cesky-tenis.cz): jen ID, jméno, klub a sekce – bez roku narození a bodů
            pr = d.pop("prihlaseni", None)
            if pr is not None:
                d["prihlaseno"] = sum(1 for e in pr if not re.search("odstran|odhl", e.get("sekce", "").lower()))
                if d.get("_status") == "ok":
                    prihl[c] = [[e["id"], e["jmeno"], e["klub"], sekce_kod(e.get("sekce", ""))] for e in pr if e.get("id")]
            if d.get("_status") == "ok" or c not in details:
                details[c] = d
        save("details.json", details)
        save("prihlasky.json", {c: v for c, v in prihl.items() if c in set(codes)})
    else:
        ok_slugs = set(lists)
    if a.kluby:
        import subprocess
        subprocess.run([sys.executable, os.path.join(os.path.dirname(__file__), "_puvodni_scrape_clubs.py"), DATA], check=True)
    clubs = load("clubs.json", [])

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
            vreq.setdefault(vk, {"poradatel": r["poradatel"], "adresa_detail": ad, "kod": km or kz})
            m = re.match(r"^\s*(\d+)\s*•\s*(.*)$", d.get("dvorce_povrch", ""))
            text = " ".join([r.get("radek", ""), d.get("nazev", ""), d.get("h1", "")]).lower()
            ent = {k: dd.get("prihlaseno") for k, dd in (("m", dm), ("z", dz))}
            events.append({
                "id": f"{slug}-{km or 'x'}-{kz or 'x'}", "kat": slug, "od": od.isoformat() if od else None,
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
    stav = load("stav.json", {})
    cur = {e["id"] for e in events}
    for e in events:
        s = stav.setdefault(e["id"], {"prvni": TODAY})
        s["posledni"] = TODAY
        if e["st"] == "zruseno":
            s.setdefault("zruseno", TODAY)
        s["snimek"] = e
        e["nove"] = s["prvni"]
    for eid, s in stav.items():
        if eid in cur:
            continue
        snap = dict(s.get("snimek") or {})
        if not snap:
            continue
        if snap["kat"] in ok_slugs and not s.get("zruseno"):
            s["zruseno"] = TODAY
        if s.get("zruseno"):
            snap.update(st="zruseno", zrus=s["zruseno"], nove=s.get("prvni"))
            # ČTS u zrušeného turnaje často nechá v listině řádek bez kódů – nahradíme ho původním snímkem s detaily
            events[:] = [e for e in events if not (not e["km"] and not e["kz"] and e["kat"] == snap["kat"]
                                                   and e["txt"] == snap["txt"] and e["por"] == snap["por"])]
            events.append(snap)
            vreq.setdefault(snap["misto"], {"poradatel": snap["por"], "adresa_detail": "", "kod": snap.get("km") or snap.get("kz")})
    save("stav.json", stav)

    # --- místa ---
    mista = venues.resolve(vreq, clubs)
    save("mista.json", mista)

    keys = sorted(mista)
    kidx = {k: i for i, k in enumerate(keys)}
    for e in events:
        e["misto"] = kidx[e["misto"]]
    events.sort(key=lambda e: (e["od"] or "9999", e["kat"], e["por"]))
    out = {
        "meta": {"sezona": SEASON, "aktualizace": dt.datetime.now().astimezone().isoformat(timespec="minutes"),
                 "pocet": len(events), "kategorie": cts.CATS,
                 "prvni_beh": min((s.get("prvni", TODAY) for s in stav.values()), default=TODAY),
                 "pocty_kategorii": {s: len(r) for s, r in lists.items()}},
        "mista": [{k: mista[x].get(k) for k in ("poradatel", "adresa", "zdroj", "region", "lat", "lon", "presnost", "nazev_mista", "poznamka")}
                  for x in keys],
        "turnaje": events,
    }
    save("turnaje.json", out, folder=SITE_DATA, indent=None)
    build_hraci(events)
    from collections import Counter
    print("turnajů:", len(events), "| míst:", len(keys), "| přesnost:", dict(Counter(m["presnost"] for m in mista.values())),
          "| zrušeno:", sum(e["st"] == "zruseno" for e in events))


if __name__ == "__main__":
    main()
