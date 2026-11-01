# Tenisová mapa – stav a kde pokračovat

Předávací log (stav k 1. 11. 2026, noc, verze webu v2.6).

## Kde web běží
- **https://turnajovamapa.cz** (doména Active24, vlastník Michal Vymyslický, platí do 2. 11. 2027) – GitHub Pages, repozitář
  github.com/michal-vymyslicky/tenis-mapa. Stará adresa michal-vymyslicky.github.io/tenis-mapa přesměruje.
- DNS u Active24 (admin.active24.cz → turnajovamapa.cz → DNS): 4× A 185.199.108–111.153, 4× AAAA 2606:50c0:8000–8003::153,
  www = CNAME michal-vymyslicky.github.io. Pošta (MX, mx10/mx20.active24.cz) beze změny. Wildcard `*` zůstal na Active24.
- GitHub → Settings → Pages: custom domain turnajovamapa.cz, Enforce HTTPS zapnuto (certifikát vystavil GitHub).

## Hotovo (v2.4 – více sezón)
- Web: mapa, filtry (termín, kategorie, pohlaví, třída, povrch se skupinami, okruh), seznam, detail místa se souběhem,
  oblíbené, hledání hráčů a jejich přihlášek, „kam se může přihlásit“, hlášení problému (FormSubmit + e-mail), O aplikaci, PWA.
- **Sezóny:** Z2425, L25, Z2526, L26 (archiv) + Z2627 (probíhá). Přepínač sezóny v řádku rychlých filtrů.
  Data `data/<S>/`, web `site/data/<S>/{turnaje,hraci}.json`, rejstřík `site/data/sezony.json`, žebříček `site/data/zebricek.json`.
- **Budoucí ročníky:** denní workflow `aktualizace.yml` volá `update.py --auto` = probíhající + následující sezóna
  (+ předchozí 30 dní po konci). L27 / Z2728 se přidají samy, jakmile je ČTS zveřejní. Nic se nemusí přepínat.
- Ruční doplnění/obnova sezóny: Actions → „Doplnění sezóny“ (`doplneni.yml`) → Run workflow, vstup např. `Z2425 L25`.

## v2.5 – místa konání
- Geokódování RÚIAN (ČÚZK) → Nominatim; přichycení na kurty z indexu OSM `data/osm_tenis.json` (`pipeline/osm_tenis.py`,
  obnova po 30 dnech; Overpass z cloudového kontejneru Claude nejde – spustit na Macu nebo v GitHub Actions).
- Paměť míst klubů `data/mista_kluby.json` – stejný klub = stejné místo napříč ročníky.
- Částečně zrušené turnaje (jen dívky / jen chlapci) se už neškrtají celé (pole `zr`).
- Přepočet míst bez stahování: `python3 pipeline/update.py --sezona Z2627 --bez-stahovani` (lze opakovat `--sezona`).

## v2.6 – anglická verze
- `site/i18n.js`: slovník čeština → angličtina (klíč = český text), `T("text", {proměnné})` v app.js, statické HTML se přeloží
  při startu (textové uzly + atributy, delší bloky O aplikaci přes `data-i18n`). Jazyk: `?lang=en|cs` > uložená volba > jazyk prohlížeče.
- Přepínač CZ/EN v pravém sloupci tlačítek mapy a v O aplikaci. Názvy turnajů, klubů a adresy zůstávají česky (data ČTS).
- Nový text v aplikaci = přidat anglický překlad do `EN` v i18n.js (jinak se ukáže česky).

## Údržba
- Nový žebříček ČTS: exportovat z Tenis Data `data/01_zebricky/zebricky.csv` do `pipeline/zebricek_<období>.json`
  (stejný formát jako `zebricek_2027Z.json`); web bere poslední soubor.
- Kontrola míst: `python3 pipeline/kontrola_mist.py Z2627` → `data/Z2627/kontrola_mist.csv`; opravy `data/mista_opravy.csv` (klíč místa).
- FormSubmit: první hlášení z webu vyžádá aktivační e-mail na tenisova-mapa@seznam.cz (potvrdit odkaz).
- **Nasazení (od 1. 11. 2026): složka `web/tenis-mapa` je git repozitář napojený na GitHub.** Claude změny udělá přímo v ní,
  nejdřív `git pull --rebase` (stáhne denní data od bota), pak `git commit`. Uživatel jen v aplikaci **GitHub Desktop** klikne
  **Push origin** (účet michal-vymyslicky). Žádné ruční nahrávání přes web GitHubu – nemá limit velikosti a přenese i `.github/workflows`.
  Při konfliktu v generovaných datech (data/, site/data/) vzít verzi z GitHubu a data přepočítat (`update.py --bez-stahovani`).
- Náhled lokálně: `cd site && python3 -m http.server 8000` → http://localhost:8000.
