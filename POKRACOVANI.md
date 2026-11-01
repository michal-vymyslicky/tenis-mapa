# Tenisová mapa – stav a kde pokračovat

Předávací log pro další chat (stav k 1. 11. 2026, noc).

## Hotovo
- Web `site/` (Leaflet, mobil i desktop): mapa se špendlíky podle třídy, filtry termín od–do (kalendář) + rychlé volby,
  kategorie / pohlaví / třída / povrch (vícenásobný výběr), okruh od GPS polohy / bodu v mapě / hledané obce (5–300 km),
  seznam (řazení podle data / vzdálenosti), detail místa se souběhem turnajů, kapacitou, obsazeností, dvorci, povrchem,
  odkazy na přihlášky a hrací plány/výsledky ČTS, navigace (Mapy.com, Google), oblíbené + sdílení odkazem + export .ics,
  zrušené turnaje přeškrtnuté, PWA (lze přidat na plochu telefonu). Otestováno v Playwright (iPhone 13 + desktop 1400×900), bez chyb v konzoli.
- Data 1. 11. 2026 0:47: 1 379 turnajů (vč. babytenisu 254 a minitenisu 99, zveřejněny 31. 10./1. 11.), 1 790 detailů, 251 míst.
- Místa: adresa z detailu ČTS (1 676 detailů už adresu má) → geokódování Nominatim → přichycení na tenisový areál v OSM.
  Přesnost: areal 36, adresa 114, areal_obec 1, obec 6, odhad 84 (přebory svazů – loňské místo), nezname 10.
  Přehled k ručnímu ověření: `data/kontrola_mist.csv` (`python3 pipeline/kontrola_mist.py`), opravy do `data/mista_opravy.csv`.
- Denní GitHub Action `.github/workflows/aktualizace.yml` (3:17 UTC): stáhne listinu + detaily, přepočítá, commitne data, nasadí Pages.
- Jména přihlášených hráčů se neukládají (jen počty) – repozitář je veřejný.

## Rozpracováno / další kroky
1. **Nasazení na GitHub Pages** – viz README „Nasazení“. Stav pokusu o nahrání: viz sekce níže.
2. Ruční kontrola míst s přesností `obec`, `nezname`, `odhad` (kontrola_mist.csv) – případně opravy v mista_opravy.csv.
3. **Další iterace – hráči:** vyhledání hráče ze žebříčku (data Tenis Data `data/01_zebricky/zebricky.csv`, ID hráče) a zobrazení jeho
   přihlášek v mapě (multiple choice více hráčů). Přihlášky jsou v detailu turnaje (`&tab=seznam`, tabulky „Hlavní soutěž“ /
   „Seznam odstraněných“, odkaz `/hrac/<id>`) – parser je hotový v `pipeline/cts.py::parse_detail` (pole `prihlaseni`).
   Rozhodnout: zveřejnit na webu jen index „ID hráče → kódy turnajů“ (bez jmen, jméno se dohledá ze žebříčku v prohlížeči),
   nebo jména – jde o údaje nezletilých z veřejného webu ČTS, doporučeno minimum.
4. Případně: sezóna L27 – v workflow změnit `SEZONA`.

## Stav nasazení na GitHub (1. 11. 2026)
- Repozitář **https://github.com/michal-vymyslicky/tenis-mapa** (veřejný). Obsah nahrán přes web GitHubu (přetažení složky);
  workflow `.github/workflows/aktualizace.yml` vložen přes editor GitHubu (skryté soubory se přetažením nenahrají – `.gitignore` v repozitáři není).
- Pages: Settings → Pages → Source = **GitHub Actions** (nastaveno). První běh workflow spuštěn ručně 1. 11. 2026.
- Web: **https://michal-vymyslicky.github.io/tenis-mapa/** – data se obnovují denně 3:17 UTC (Action commitne data do repozitáře).
- Lokální kopie v Tenis Data **není git klon** – po změně kódu nahrát změněné soubory na GitHub (web: Add file → Upload files do stejné složky),
  nebo složku jednou naklonovat (`git clone https://github.com/michal-vymyslicky/tenis-mapa.git`). Aktuální data jsou vždy v repozitáři (commity bota).
- Workflow: když chybí `site/vendor`, stáhne Leaflet; když chybí `data/clubs.json`, stáhne adresář klubů (`--kluby`); timeout 150 min.
- Náhled lokálně: `cd site && python3 -m http.server 8000` → http://localhost:8000.
