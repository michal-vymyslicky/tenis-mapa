#!/usr/bin/env python3
"""Noční sběr výsledků turnajů ČTS pro databázi Tenis Data (spouští GitHub Action po aktualizaci mapy).

  python3 pipeline/vysledky.py --auto                 sezóny s turnaji dohranými v posledních 60 dnech
  python3 pipeline/vysledky.py --sezona Z2627         jen jedna sezóna
  python3 pipeline/vysledky.py --auto --zkouska       jen vypíše plán, nic nestahuje

Pravidla (METODIKA Tenis Data kap. 9.9):
  - stahuje se výsledková stránka soutěže https://cesky-tenis.cz/turnaj/<kód>?sezona=<S> nejdříve ZPOZDENI (2) dny
    po posledním dni turnaje (výsledky bývají zadané a často už schválené);
  - znovu jen soutěže s neoficiálními výsledky (každé 2 dny, max. 60 dní po konci) a bez dat (každé 3 dny, max. 21 dní);
    oficiální výsledky se už nestahují;
  - postupně (1 spojení), pauza --pauza s (výchozí 4) a nejvýše --max stránek za běh (výchozí 300) – zbytek příští noc;
  - při HTTP 429/503 běh OKAMŽITĚ končí a čas z Retry-After (min. 1 h) se uloží do data/omezeni.json; dokud nevyprší,
    nestahuje vysledky.py ani update.py (common.Http) nic;
  - ze stránek se odstraní vložené fotky fotogalerie (jako Tenis Data skripty/archiv.py), uloží se jako
    data/vysledky/<S>/<kód>.html.xz; stav v data/vysledky/<S>/stav.json. Na Mac je přebírá skripty/prevzit_vysledky.py.
"""
import argparse, datetime, hashlib, json, lzma, os, re, sys, time, urllib.request, urllib.error
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import DATA, SITE_DATA, UA_CTS, load, save, omezeni_aktivni, uloz_omezeni

ZPOZDENI = 2                      # dny po konci turnaje
ZNOVU = {"neoficialni": (2, 60), "bez_dat": (3, 21)}   # stav: (interval dní, max. dní po konci)
FOTO = re.compile(r"data:image/[a-zA-Z+]+;base64,[A-Za-z0-9+/=\s]+")
HOST = "cesky-tenis.cz"
BEZ_VYSLEDKU = {"babytenis", "minitenis", "stredni-kurt"}   # ČTS výsledky nezveřejňuje


def stav_stranky(h):
    """Stejná logika jako Tenis Data skripty/spolecne.py (rozpoznání turnaje)."""
    if "Kódové číslo" not in h:
        return "neplatna"
    i = h.find("Dvouhra - ")
    j = h.find("Čtyřhra - ", i + 1) if i >= 0 else -1
    sek = h[i:j if j > 0 else i + 20000] if i >= 0 else ""
    if i < 0 or "nejsou data" in sek:
        return "bez_dat"
    return "oficialni" if "Dvouhra - oficiální" in h else "neoficialni"


def souteze(sezona):
    """Soutěže (kódy) sezóny s datem konce z dat mapy: bez zrušených a testovacích, jen ČTS (ne Tennis Europe)."""
    d = json.load(open(os.path.join(SITE_DATA, sezona, "turnaje.json"), encoding="utf-8"))
    out = {}
    for t in d["turnaje"]:
        if t.get("test") or t.get("st") == "zruseno" or t.get("kat") in BEZ_VYSLEDKU or t.get("zdroj") == "te" or str(t["id"]).startswith("TE"):
            continue
        if not t.get("do"):
            continue
        for k, p in ((t.get("km"), "m"), (t.get("kz"), "z")):
            if k and t.get("zr") != p and re.fullmatch(r"\d{6}", str(k)):
                out[str(k)] = max(out.get(str(k), ""), t["do"])
    return out


def sezony_auto(dnes):
    s = json.load(open(os.path.join(SITE_DATA, "sezony.json"), encoding="utf-8"))["sezony"]
    hranice = (dnes - datetime.timedelta(days=60)).isoformat()
    return [x["id"] for x in s if x["do"] >= hranice and x["od"] <= dnes.isoformat()]


def plan(sezona, dnes):
    st = load(os.path.join("vysledky", sezona, "stav.json"), {})
    out = []
    for kod, konec in souteze(sezona).items():
        k = datetime.date.fromisoformat(konec)
        if (dnes - k).days < ZPOZDENI:
            continue
        o = st.get(kod)
        if not o:
            out.append((konec, sezona, kod, "nový"))
        elif o["stav"] in ZNOVU:
            interval, maxd = ZNOVU[o["stav"]]
            posl = datetime.date.fromisoformat(o["stazeno"][:10])
            if (dnes - k).days <= maxd and (dnes - posl).days >= interval:
                out.append((konec, sezona, kod, f"znovu ({o['stav']})"))
    return out


def stahni(url, ua):
    req = urllib.request.Request(url, headers={"User-Agent": ua, "Accept-Language": "cs"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read().decode("utf-8", "replace")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--auto", action="store_true")
    ap.add_argument("--sezona")
    ap.add_argument("--max", type=int, default=300)
    ap.add_argument("--pauza", type=float, default=4.0)
    ap.add_argument("--zkouska", action="store_true")
    a = ap.parse_args()
    dnes = datetime.date.today()
    sezony = [a.sezona] if a.sezona else sezony_auto(dnes)
    P = sorted(x for s in sezony for x in plan(s, dnes))
    print(f"vysledky: sezóny {sezony}, k stažení {len(P)} (limit {a.max}, pauza {a.pauza} s)", flush=True)
    for p in P[:10]:
        print("  ", *p)
    if a.zkouska or not P:
        return 0
    om = omezeni_aktivni(HOST)
    if om:
        print(f"vysledky: {HOST} omezen do {om} (data/omezeni.json) – nestahuji", flush=True)
        return 0
    souhrn, chyb_za_sebou, staty = {}, 0, {}
    for i, (konec, sezona, kod, duvod) in enumerate(P[:a.max]):
        url = f"https://{HOST}/turnaj/{kod}?sezona={sezona}"
        try:
            h = stahni(url, UA_CTS)
            chyb_za_sebou = 0
        except urllib.error.HTTPError as e:
            if e.code in (429, 503):
                ra = e.headers.get("Retry-After") or ""
                sek = int(ra) if ra.isdigit() else 3600
                uloz_omezeni(HOST, max(3600, sek), f"HTTP {e.code} při {url}")
                print(f"vysledky: HTTP {e.code} (Retry-After {ra or '-'}) – KONČÍM, omezení uloženo", flush=True)
                souhrn["omezeno"] = 1
                break
            souhrn[f"http_{e.code}"] = souhrn.get(f"http_{e.code}", 0) + 1
            chyb_za_sebou += 1
        except Exception as e:
            print(f"  ! {url}: {e}", flush=True)
            souhrn["chyba"] = souhrn.get("chyba", 0) + 1
            chyb_za_sebou += 1
        else:
            stav = stav_stranky(h)
            if stav == "neplatna":
                souhrn["neplatna"] = souhrn.get("neplatna", 0) + 1
            else:
                h = FOTO.sub("data:image-odstraneno", h)
                slozka = os.path.join(DATA, "vysledky", sezona)
                os.makedirs(slozka, exist_ok=True)
                st = staty.setdefault(sezona, load(os.path.join("vysledky", sezona, "stav.json"), {}))
                otisk = hashlib.sha256(h.encode()).hexdigest()[:16]
                if st.get(kod, {}).get("otisk") != otisk:
                    with lzma.open(os.path.join(slozka, f"{kod}.html.xz"), "wt", encoding="utf-8", preset=6) as f:
                        f.write(h)
                st[kod] = {"stav": stav, "konec": konec, "stazeno": datetime.datetime.now().isoformat(timespec="minutes"),
                           "otisk": otisk, "pokusu": st.get(kod, {}).get("pokusu", 0) + 1}
                souhrn[stav] = souhrn.get(stav, 0) + 1
        if chyb_za_sebou >= 5:
            print("vysledky: 5 chyb za sebou – končím", flush=True)
            break
        if (i + 1) % 25 == 0:
            print(f"  {i + 1}/{min(len(P), a.max)} {souhrn}", flush=True)
            for s, st in staty.items():
                save(os.path.join("vysledky", s, "stav.json"), st)
        time.sleep(a.pauza)
    for s, st in staty.items():
        save(os.path.join("vysledky", s, "stav.json"), st)
    zbyva = max(0, len(P) - a.max)
    print(f"vysledky: hotovo {souhrn}, zbývá na další běh {zbyva}", flush=True)
    beh = load("posledni_beh.json", {}) or {}
    beh["vysledky"] = {"cas": datetime.datetime.now().isoformat(timespec="minutes"), "souhrn": souhrn,
                       "naplanovano": len(P), "zbyva": zbyva}
    save("posledni_beh.json", beh)
    return 0


if __name__ == "__main__":
    sys.exit(main())
