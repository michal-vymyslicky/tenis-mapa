# Tenisová mapa – stav a kde pokračovat

Předávací log (stav k 2. 11. 2026, verze webu v3.2).

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

## Místa přeborů podle rozpisu svazu
- `data/mista_svaz.csv` (sezona;kod;klub;zdroj;poznamka): oblastní přebor (kód turnaje) → pořádající klub podle rozpisu svazu.
  Má přednost před „místem loňského ročníku“, dokud ČTS nedoplní adresu do detailu turnaje. Z2627: Jihočeský TS – všech 9 přeborů
  (výsledky výběrového řízení zima 2026/27, interní dokument svazu poskytnutý uživatelem – do repozitáře jen kód → klub).

## v2.7 – Tennis Europe
- `pipeline/te.py`: veřejné vyhledávání te.tournamentsoftware.com (/find/tournament/DoSearch, robots povoleno, souhlas jen se
  základními cookies, 1 req/1,5 s). Rozsah od 1. 9. aktuálního tenisového roku do budoucna (+2 roky). Denně s `update.py --auto`
  (chyba TE neshodí aktualizaci ČTS); ručně `python3 pipeline/te.py`, bez stahování `TE_BEZ_STAHOVANI=1 python3 pipeline/te.py`.
- Data: `data/TE/` (turnaje_raw, mista – cache míst, stav – první výskyt/zmizení), web `site/data/TE/turnaje.json`.
- Místa: Nominatim „areál, obec“ (areal) → „tennis obec“ (areal_obec, neověřeno) → obec; v ČR areál klubu z `mista_kluby.json`.
- Web: TE turnaje se přimíchají do zvolené sezóny podle termínu (u nejnovější sezóny i všechny pozdější). Filtr „Turnaje: Vše / ČTS /
  Tennis Europe“ + rychlý čip 🇪🇺 Tennis Europe (přiblíží Evropu). Věk 12/14/16/18&U → kategorie ml. žactvo / st. žactvo / dorost.
  Třídy TE (Super, Cat. 1–3, Masters, ME, Festival) modře se žlutým okrajem špendlíku. Detail: odkaz na turnaj na webu TE.

## v2.8 – přehlednější GUI, ČTS primárně
- Výchozí zobrazení jen ČTS; Tennis Europe je doplněk: čip „🇪🇺 + Tennis Europe“ na konci rychlé lišty (zapne ČTS + TE a ukáže Evropu)
  a sekce „Mezinárodní turnaje“ ve filtrech (Jen ČTS / ČTS + TE / Jen TE, kategorie TE). Uložené filtry starších verzí se přepnou na ČTS.
- Zrušen okruh vzdálenosti (bod v mapě, hledání obce, posuvník km) i řazení podle vzdálenosti. Tlačítko „Moje poloha“ jen ukáže
  polohu v mapě (modrá tečka) a v seznamu vzdálenost k turnaji; navigace Mapy.com startuje z polohy.
- Záložka „Seznam“ přejmenována na „Turnaje“; filtr „Třída turnaje ČTS“; legenda ukazuje třídy TE jen při zapnutém TE.
- Místa TE: `pipeline/te_mista.py` – Overpass (OSM) v okolí 10 km, shoda názvu areálu → „areál“; jinak jediný větší areál → „areál v obci“.
  Volá se z te.py (limit `TE_OSM_LIMIT`, výchozí 600 s denně, pokračuje, kde skončil; cache `data/TE/overpass.json`).
- Přesná adresa, počet přihlášených a kapacita turnajů TE: jsou jen na stránkách detailu (/sport/), které robots.txt Tennis Europe
  zakazuje strojově číst → čeká se na svolení Tennis Europe (koncept e-mailu: `web/tenis-mapa_TE_zadost.html`). Po svolení doplnit
  skript pro detail (adresa, přihlášení, max. hráčů) – data pak do karty turnaje TE.

## v2.9 – mapové podklady
- Tlačítko „Mapový podklad“ (ikona vrstev): Automaticky (výchozí – OSM v ČR, mimo ČR Esri World Street Map s názvy latinkou),
  Základní (OSM, místní písmo – v Srbsku azbuka), Latinka (Esri), Turistická (OpenTopoMap), Letecká (Esri World Imagery + popisky).
  Volba v `localStorage` (tm.map). Vše bez klíče. Možné rozšíření: Mapy.com (základní/turistická/letecká/zimní) – potřebuje
  bezplatný API klíč z developer.mapy.com (vytvoří uživatel). Google Maps nedoporučeno (klíč + platební účet, podmínky).

### v3.2 (2. 11. 2026) – turnaj ze seznamu na přehledové mapě
- Klik na turnaj v záložce Turnaje: mapa ukáže celou ČR (ČTS) nebo celou Evropu (Tennis Europe) a jen špendlík místa turnaje (ostatní značky skryté – openVenue(…, {solo: true})). Návrat zpět do seznamu značky obnoví (clearFocus). Klik na špendlík v mapě funguje jako dřív (přiblížení).

### v3.1 (2. 11. 2026) – lišta s rozbalovacími menu
- Lišta: [Období / pod ním Od dnes] [Region ▾] [Kategorie ▾] (+ oblíbené, hráči).
- Region: ČTS a Tennis Europe zaškrtávací, aspoň jeden zapnutý; vypnutí regionu zruší jeho kategorie.
- Kategorie: vícenásobný výběr; ČTS v pořadí Babytenis, Střední kurt, Minitenis, Mladší žactvo, Starší žactvo, Dorost, Dospělí; pak Tennis Europe U12/U14/U16 (klíče te-u12… podle věku 12&U…, ne podle mapování na ČTS kategorie). U vybrané kategorie „upřesnit ▾“ rozbalí pohlaví a třídu (F.sub).

### v3.0 (2. 11. 2026) – přestavba horní lišty
- Pořadí v liště: období (sezóna) · Od dnes | 🇨🇿 ČTS · 🇪🇺 Tennis Europe | kategorie | oblíbené | hráči.
- ČTS a Tennis Europe se zapínají nezávisle (jen ČTS, jen TE, obojí); aspoň jeden zůstane zapnutý (F.src = cts/te/all).
- Klik na kategorii ji vybere a rozbalí pod lištou panel #catPanel: pohlaví a třída turnaje (ČTS i TE) zvlášť pro každou kategorii (F.sub[kat] = {sex, cls}); odznak na čipu ukazuje počet podfiltrů. Panel Filtry (vícenásobné filtrování) zůstává.
- Spodní panel na mobilu lze stáhnout až na úchyt (snap „min“ 26 px).
- Mapové podklady jen tři: Základní (dřív Automaticky – OSM v ČR, latinka v zahraničí), Turistická, Letecká.

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
