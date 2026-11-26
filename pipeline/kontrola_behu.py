"""Ranní kontrola noční aktualizace (workflow kontrola.yml).

Zkontroluje web (https://turnajovamapa.cz/data/sezony.json – čas aktualizace probíhající sezóny) a záznam o posledním
nočním běhu (data/posledni_beh.json). Když data nejsou z dnešní noci, nebo běh hlásil chyby (např. HTTP 429 – část
detailů nestažena), pošle upozornění e-mailem přes FormSubmit (formsubmit.co, AJAX, bez účtu) na adresu z proměnné
NOTIFY_EMAIL (GitHub secret) a skončí chybou (GitHub pak upozorní i sám).
Spuštění: python3 pipeline/kontrola_behu.py [--test]
"""
import datetime as dt, json, os, sys, urllib.request

SITE = "https://turnajovamapa.cz/data/sezony.json"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REPO = os.environ.get("GITHUB_REPOSITORY", "michal-vymyslicky/tenis-mapa")
RUN = f"https://github.com/{REPO}/actions"


def dnes():
    try:
        from zoneinfo import ZoneInfo
        return dt.datetime.now(ZoneInfo("Europe/Prague")).date()
    except Exception:  # noqa: BLE001
        return dt.date.today()


def posli(predmet, text):
    to = os.environ.get("NOTIFY_EMAIL", "").strip()
    if not to:
        print("::warning::NOTIFY_EMAIL není nastaven – e-mail se neposílá", flush=True)
        return False
    body = json.dumps({"_subject": predmet, "_template": "box", "_captcha": "false", "Zpráva": text}).encode()
    req = urllib.request.Request(f"https://formsubmit.co/ajax/{to}", data=body, method="POST",
                                 headers={"Content-Type": "application/json", "Accept": "application/json",
                                          "Origin": "https://turnajovamapa.cz", "Referer": "https://turnajovamapa.cz/",
                                          "User-Agent": "turnajovamapa.cz kontrola"})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            js = json.loads(r.read().decode() or "{}")
        print("FormSubmit:", js, flush=True)
        return str(js.get("success")) == "true"
    except Exception as e:  # noqa: BLE001
        print("::warning::e-mail se nepodařilo odeslat:", e, flush=True)
        return False


def main():
    test = "--test" in sys.argv
    d = dnes()
    problemy = []
    try:
        with urllib.request.urlopen(urllib.request.Request(SITE + f"?t={dt.datetime.now().timestamp():.0f}",
                                                           headers={"User-Agent": "turnajovamapa.cz kontrola"}), timeout=30) as r:
            sez = json.loads(r.read().decode())
        akt = [x for x in sez.get("sezony", []) if not x.get("archiv") and x.get("od", "") <= d.isoformat()]
        posl = max((x.get("aktualizace", "") for x in akt), default="")
        if posl[:10] != d.isoformat():
            problemy.append(f"Web ukazuje data z {posl or '?'} – dnešní noční aktualizace se na web nedostala (neproběhla, selhala, nebo selhalo nasazení).")
    except Exception as e:  # noqa: BLE001
        problemy.append(f"Web turnajovamapa.cz se nepodařilo načíst: {e}")
    try:
        beh = json.load(open(os.path.join(ROOT, "data", "posledni_beh.json"), encoding="utf-8"))
        if beh.get("cas", "")[:10] == d.isoformat():
            if beh.get("chyby"):
                problemy.append("Noční běh doběhl s upozorněními:\n- " + "\n- ".join(beh["chyby"]))
            if beh.get("omezeni"):
                problemy.append(f"Servery omezovaly požadavky (HTTP 429/503): {beh['omezeni']}")
        v = beh.get("vysledky") or {}
        if v.get("cas", "")[:10] == d.isoformat() and (v.get("souhrn", {}).get("omezeno") or v.get("souhrn", {}).get("chyba")):
            problemy.append(f"Sběr výsledků turnajů (vysledky.py) skončil s omezením/chybou: {v.get('souhrn')} – "
                            f"web požádal o pauzu, další pokus až po jejím vypršení (data/omezeni.json).")
    except FileNotFoundError:
        pass
    if test:
        problemy = problemy or []
        ok = posli(f"Tenisová mapa – TEST upozornění ({d.strftime('%-d. %-m. %Y')})",
                   "Zkušební zpráva z kontroly noční aktualizace Tenisové mapy. Když přijde, upozornění fungují.\n\n"
                   + ("Aktuální stav: " + ("\n\n".join(problemy) if problemy else "v pořádku") + f"\n\nGitHub Actions: {RUN}"))
        sys.exit(0 if ok else 1)
    if not problemy:
        print("Noční aktualizace v pořádku.", flush=True)
        return
    text = "\n\n".join(problemy) + f"\n\nPřehled běhů: {RUN}\nRuční spuštění: Actions → „Denní aktualizace turnajů“ → Run workflow."
    print(text, flush=True)
    posli(f"Tenisová mapa – problém s noční aktualizací ({d.strftime('%-d. %-m. %Y')})", text)
    sys.exit(1)


if __name__ == "__main__":
    main()
