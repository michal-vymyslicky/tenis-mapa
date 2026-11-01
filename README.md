# Tenisová mapa turnajů ČTS

Webová mapa turnajů jednotlivců z termínové listiny ČTS (cesky-tenis.cz) – optimalizovaná pro mobil.

- špendlíky barevně podle třídy (MČR, A, B, P – přebor, C, D, E), číslo = počet turnajů v místě, čárkovaný okraj = odhadnuté místo
- filtry: termín od–do (kalendář), kategorie, pohlaví, třída, povrch (vše vícenásobný výběr), text, jen volná místa, zrušené
- okruh: moje poloha (GPS), bod v mapě nebo hledání obce/adresy + vzdálenost 5–300 km
- detail místa: ověření místa, navigace, všechny turnaje v místě seskupené podle termínu (souběh chlapci/dívky a kategorií),
  max. počet hráčů, obsazenost, dvorce, povrch, míče, vklad, prezentace, odkazy na přihlášky a hrací plány/výsledky ČTS
- oblíbené (v prohlížeči zařízení), sdílení odkazem, export do kalendáře (.ics)
- zrušené turnaje zůstávají v mapě přeškrtnuté (zmizely z listiny / označeny „zruš…“)

## Struktura

| Cesta | Obsah |
| --- | --- |
| `site/` | statický web (GitHub Pages): `index.html`, `app.js`, `app.css`, `vendor/` (Leaflet 1.9.4, markercluster 1.5.3), `data/turnaje.json` |
| `pipeline/update.py` | denní obnova: listina všech kategorií → detaily → místa → `site/data/turnaje.json` |
| `pipeline/cts.py` | stažení listiny (Nette POST filtr sezóny) a detailů (`&tab=seznam`) |
| `pipeline/venues.py` | určení a ověření místa konání (adresa → OSM, přichycení na tenisový areál) |
| `pipeline/kontrola_mist.py` | `data/kontrola_mist.csv` – přehled míst k ručnímu ověření |
| `data/mista_opravy.csv` | ruční opravy míst (`klic;lat;lon;nazev_mista;adresa;poznamka`) – mají přednost |
| `data/stav.json` | historie turnajů (první výskyt, zrušení) |
| `data/geocache.json` | mezipaměť geokódování (Nominatim se ptá jen na nová místa) |
| `.github/workflows/aktualizace.yml` | denně 3:17 UTC stáhne data, uloží je do repozitáře a nasadí web |

Jména přihlášených hráčů se do repozitáře neukládají (jen počty).

## Spuštění lokálně

```
pip install beautifulsoup4
python3 pipeline/update.py              # plná obnova (≈ 10 min, poprvé déle kvůli geokódování)
python3 pipeline/update.py --bez-stahovani
python3 pipeline/kontrola_mist.py
cd site && python3 -m http.server 8000  # http://localhost:8000
```

## Nasazení (GitHub Pages)

1. Na GitHubu vytvořit veřejný repozitář (např. `tenis-mapa`) a nahrát obsah této složky.
2. Settings → Pages → Source: **GitHub Actions**.
3. Actions → „Denní aktualizace turnajů“ → **Run workflow** (první nasazení). Dál běží samo každý den.
4. Web: `https://<uživatel>.github.io/tenis-mapa/`

Nová sezóna: v `.github/workflows/aktualizace.yml` změnit `SEZONA` (např. `L27`).
Zdroje dat: © ČTS (cesky-tenis.cz), mapa © přispěvatelé OpenStreetMap, geokódování Nominatim.
