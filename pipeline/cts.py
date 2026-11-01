"""Stažení termínové listiny jednotlivců a detailů turnajů z cesky-tenis.cz.

Vychází ze skriptů Tenis Data `skripty/cts_terminova_listina/scrape_lists.py` a `scrape_details.py`
(stejné adresy, filtr sezóny = Nette POST se session cookie, detail jen s &tab=seznam).
Navíc čte seznam přihlášených (pro budoucí vyhledání hráčů a obsazenost).
"""
import re
from concurrent.futures import ThreadPoolExecutor
from bs4 import BeautifulSoup
from common import Http

BASE = "https://cesky-tenis.cz/jednotlivci/"
CATS = {"dospeli": "Dospělí", "dorost": "Dorost", "starsi-zactvo": "Starší žactvo", "mladsi-zactvo": "Mladší žactvo",
        "babytenis": "Babytenis", "stredni-kurt": "Střední kurt", "minitenis": "Minitenis"}


def _t(el):
    return re.sub(r"\s+", " ", el.get_text(" ", strip=True)).strip() if el else ""


def fetch_list(slug, season):
    h = Http(pause=0.4)
    url = BASE + slug
    h.get(url)
    data = f"sezona={season}&_submit=Filtrovat&_do=individualsControl-individualsForm-submit"
    st, body = h.get(url, data=data, referer=url)
    soup = BeautifulSoup(body, "html.parser")
    sel = soup.select_one('select[name="sezona"] option[selected]')
    selected = sel.get("value") if sel else None
    rows = []
    tbl = soup.select_one("table.table__table")
    for tr in (tbl.select("tbody tr") if tbl else []):
        tds = tr.find_all("td")
        if len(tds) < 5:
            continue

        def code(td):
            a = td.find("a", href=re.compile(r"/turnaj/(\d+)"))
            return re.search(r"/turnaj/(\d+)", a["href"]).group(1) if a else ""

        def occ(td):
            s = td.find("span", class_="icons")
            inner = s.find("span") if s else None
            return _t(inner) if inner else _t(td)

        mix = len(tds) == 5  # babytenis / minitenis / střední kurt: jeden sloupec „Děti“ (smíšená soutěž)
        rows.append({"datum": _t(tds[0]), "trida": _t(tds[1]), "vklad": _t(tds[2]), "poradatel": _t(tds[3]),
                     "kod_m": code(tds[4]), "obs_m": occ(tds[4]), "kod_z": "" if mix else code(tds[5]),
                     "obs_z": "" if mix else occ(tds[5]), "mix": mix, "radek": _t(tr)})
    ok = st == 200 and (selected == season) and (bool(rows) or "Nebyl nalezen" in body)
    return rows, ok


def _info(soup, label):
    for p in soup.select("p.info"):
        sp = p.find("span")
        if sp and sp.get_text(strip=True) == label:
            sp = sp.extract()
            v = _t(p)
            p.insert(0, sp)
            return v
    return ""


def parse_detail(body, code):
    soup = BeautifulSoup(body, "html.parser")
    h1, sub = soup.find("h1"), soup.select_one("p.subtitle")
    d = {"_status": "ok", "h1": _t(h1), "nazev": _t(sub), "kod": code}
    for lab, key in [("Datum", "datum"), ("Pořadatel", "poradatel_adresa"), ("Dvorců • povrch", "dvorce_povrch"), ("Míče", "mice"),
                     ("Počet účastníků", "pocet_ucastniku"), ("Prezentace", "prezentace"), ("Elektronická prezence", "el_prezence"),
                     ("Kontaktní osoba", "kontakt"), ("Mobil", "mobil"), ("E-mail", "email"), ("Vrchní rozhodčí", "rozhodci"),
                     ("Poznámka pořadatele", "poznamka")]:
        d[key] = _info(soup, lab)
    d["hraci_plany"] = bool(soup.find("a", string=re.compile("Hrací plány")))
    entrants = []
    for tbl in soup.select("table.table__table"):
        prev = tbl.find_previous(["h2", "h3"])
        sec = _t(prev) if prev else ""
        heads = [_t(th) for th in tbl.select("thead th")]
        if "Jméno" not in heads:
            continue
        for tr in tbl.select("tbody tr"):
            tds = tr.find_all("td")
            if len(tds) < len(heads):
                continue
            rec = dict(zip(heads, (_t(td) for td in tds)))
            a = tr.find("a", href=re.compile(r"/hrac/(\d+)"))
            entrants.append({"id": re.search(r"/hrac/(\d+)", a["href"]).group(1) if a else "",
                             "jmeno": re.sub(r"\s+", " ", rec.get("Jméno", "")), "rok": rec.get("Rok narození", ""),
                             "klub": re.sub(r"\s+", " ", rec.get("Klub", "")), "cz": rec.get("CŽ", ""), "bh": rec.get("BH", ""),
                             "sekce": sec, "pozn": rec.get("Poznámka", ""),
                             "datum": rec.get("Datum přihlášení", rec.get("Datum odhlášení", ""))})
    d["prihlaseni"] = entrants
    return d


def fetch_details(codes, season, threads=3):
    h = Http(pause=0.3)

    def one(code):
        try:
            st, body = h.get(f"https://cesky-tenis.cz/turnaj/{code}?sezona={season}&tab=seznam")
        except Exception as e:
            return code, {"_status": f"chyba: {e}"}
        if st == 404:
            return code, {"_status": "404"}
        if "Kódové číslo" not in body:
            return code, {"_status": "neplatná stránka"}
        return code, parse_detail(body, code)

    out = {}
    with ThreadPoolExecutor(threads) as ex:
        for i, (c, d) in enumerate(ex.map(one, codes)):
            out[c] = d
            if i % 200 == 0:
                print(f"  detaily {i}/{len(codes)}", flush=True)
    return out
