# Tenisová mapa – stav a kde pokračovat

Předávací log (stav k 2. 11. 2026, verze webu v3.5).

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

### v3.5 (5. 11. 2026) – proklikávání klub ↔ hráč ↔ turnaj
- Jména hráčů na turnajích (zelené štítky klubu i štítky vybraných hráčů) jsou klikací → profil hráče s přihláškami; z klubu se hráč otevře bez přidání do filtru mapy.
- U hráče je klikací název klubu → klub. Šipka zpět vrací po krocích (zásobník stack) a obnoví i posun panelu (scrollMem); rozbalený seznam hráčů klubu zůstane rozbalený.
- v3.4.1: kratší popisky lišty (🇪🇺 TE, Kategorie), čip klubu „týden/měsíc/sezóna“.

### v3.4 (5. 11. 2026) – hráči na displeji, výběr klubu
- Horní lišta: vpravo od [období / Od dnes] dvě řady – 1. Region, Kategorie; 2. vybraný klub, hráči, oblíbené (na telefonu vždy viditelné pod horní řadou, vpravo místo pro tlačítka mapy).
- Klub: hledání (pole Hráč, klub, turnaj…) nabízí i kluby (z žebříčku + přihlášek, HR.p[pid][1]). Panel „club“: počet hráčů klubu a přihlášených, období Příští týden (7 dní) / Příští měsíc (31 dní) / Celá sezóna (F.clubWin), seznam přihlášených hráčů (klik → hráč), turnaje se jmény hráčů klubu (zelené štítky, kval./náhr.). „Zobrazit v mapě“ = filtr F.club (+ období) a čip v liště.

### Návštěvnost (2. 11. 2026)
- Měření GoatCounter (bez cookies): skript v index.html, účet tenisova-mapa@seznam.cz (e-mail ověřen), kód webu „mapaturnaju“ → přehled https://mapaturnaju.goatcounter.com. Zmínka v O aplikaci (about.d7).

### v3.3 (2. 11. 2026) – seznam podle vzdálenosti, návrat na stejné místo
- Při přiblížení mapy (zoom ≥ 8, NEAR_ZOOM) se seznam Turnaje řadí podle vzdálenosti od středu viditelné části mapy (shoda → podle data); u turnaje je vzdálenost v km, nahoře poznámka „Seřazeno podle vzdálenosti od středu mapy“. Po posunu mapy se seznam přeřadí (moveend, 250 ms).
- Šipka zpět z detailu turnaje otevřeného ze seznamu vrátí výřez mapy, výšku panelu i pozici v seznamu (listState).

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

### Proveditelnost – národní turnaje SK, PL, AT, DE (kontrola 2. 11. 2026, zatím nic nestaženo)
Pořadí podle náročnosti (od nejsnazší):
1. **SK (STZ)** – termínová listina v systému eTenis (www.etenis.sk, index.php?nav=terminovka&nav1=oficialni; filtry kategorie, region, trieda, obdobie; sloupce termín, kategorie, třída, usporiadateľ, región, detail). Kategorie a třídy jako ČTS (ml./st. žiaci, dorast, dospelí, A–D, deti do 8/10). robots.txt na etenis.sk není (404), stz.sk nic podstatného nezakazuje. URL obsahují session ID. Listina 2027 byla 2. 11. 2026 ještě prázdná (přihlášky turnajů do 15. 10.). Místo konání: jen pořadatel → adresa klubu + RÚIAN/OSM jako u ČTS.
2. **PL (PZT)** – portal.pzt.pl (robots.txt „Allow: /“), seznamy TournamentsResults.aspx?CategoryID=…, detail TournamentResults.aspx?…&TournamentID=<GUID>; Tenis10 (barvy) CategoryID=10, ostatní věkové kategorie (skrzaty, żaki, młodzicy, juniorzy młodsi, juniorzy) – CategoryID ověřit. V seznamu jen název (obec za pomlčkou), stav, termín → místo z detailu / OSM.
3. **AT (ÖTV)** – www.oetv.at/turniere (robots Allow, Crawl-delay 5) načítá turnaje z interního API webu (klíč v JavaScriptu stránky) – bez souhlasu ÖTV NEPOUŽÍVAT. Veřejné stránky nuLiga TENAT (oetv-austria.liga.nu, robots zakazuje jen *.inc/*.csi) – ověřit veřejný turnajový kalendář. Třídy: kids / juniors / general / seniors, 9 zemských svazů.
4. **DE (DTB)** – vyhledávání tennis.de/turniersuche je widget widgets.tennis.de (robots.txt „Disallow: /“ → nepoužívat). Data jsou v nuLiga 18 zemských svazů (např. btv.de/turniere/turniersuche), tisíce LK a mládežnických turnajů ročně. Rozumné jen pro příhraniční svazy (Bayern BTV, Sachsen, Thüringen) a jen mládež; nejlépe po dohodě s DTB/svazem.
Otevřené: zda mohou hráči ČTS startovat na národních turnajích sousedů (licence/ID hráče, LK) – ověřit v řádech svazů, jinak by turnaje v mapě měly jen informativní význam. U AT a DE doporučeno požádat svaz o souhlas/data (podobně jako žádost Tennis Europe).

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

## Odolnost denní aktualizace (7. 11. 2026)
- Běh 7. 11. 2026 spadl po 3,5 h: cesky-tenis.cz začal vracet **HTTP 429 Too Many Requests** (běžně běh trvá ~25 min);
  výjimka u listiny L27 shodila celý krok → nic se neuložilo ani nenasadilo.
- `pipeline/common.py` – `Http`: při 429/503 zpomalí všechna vlákna pro daný web (Retry-After, jinak 15 s → 30 s → … max. 5 min,
  pauza mezi stránkami +0,5 s až +3 s); po 8 odmítnutích za sebou / 60 za běh vyhodí `RateLimited` a stahování z webu se vzdá.
- `pipeline/update.py`: chyba listiny kategorie nebo celé sezóny už běh neshodí – ponechají se uložená data (nic se neoznačí
  jako zrušené), stažená data se uloží a web se nasadí; problémy se vypíšou jako `::warning::` v souhrnu běhu Actions.
- `pipeline/venues.py`: loňská adresa turnaje se při chybě webu ČTS přeskočí (nezapíše se do cache).

## Šetrné stahování z cesky-tenis.cz (7. 11. 2026)
- Denní běh v noci: cron 0:23 UTC (1:23 / 2:23 v ČR), 1 vlákno, 1,5 s mezi stránkami (dřív 3 vlákna, 0,3 s), identifikace
  `TenisovaMapa/3.5; +https://turnajovamapa.cz; tenisova-mapa@seznam.cz`.
- Listiny (7 kategorií × sezóna) se čtou celé každý den. Detail turnaje (seznam přihlášených) jen když: je nový / minule selhal,
  změnil se jeho řádek v listině (obsazenost, termín, zrušení), nebo je na řadě: start do 21 dnů = denně, do 60 dnů = každý 2. den,
  dál = každý 5. den (rozložené podle kódu turnaje). Výměna hráčů při stejném počtu se u blízkých turnajů projeví do druhého dne.
  Parametry `OBNOVA` v `pipeline/update.py`, datum stažení detailu `_stazeno` v `data/<S>/details.json`.
- Zátěž: ~700 detailů denně místo ~1 950 (Z2627, 11/2026), běh ~20–25 min; první běh po změně stáhne vše (~1 h).

## Opakované nasazení webu (9. 11. 2026)
- Běh 9. 11. 2026 stáhl a uložil data v pořádku (36 min, bez 429), ale `deploy-pages` hned po nahrání nenašel artefakt
  („No artifacts named github-pages“ – přechodná chyba GitHubu). `aktualizace.yml`: při chybě nasazení pauza 60 s a druhý pokus;
  push změny workflow spouští rychlé nasazení (bez stahování).

## Samostatné nasazení webu (10. 11. 2026)
- 10. 11. 2026 běh doběhl „úspěšně“ včetně deploy-pages, ale web zůstal na datech z 9. 11.: běh nasazoval verzi označenou commitem,
  ze kterého vyšel (e11cf8c), a ta už byla nasazená pushem → GitHub Pages nasazení tiše přeskočil. Stejně by dopadl každý den po pushi.
- Nově `nasazeni.yml` (workflow_run po „Denní aktualizace turnajů“ / „Doplnění sezóny“, i ručně Run workflow): checkout main =
  nový commit s daty → upload → deploy (při chybě po 60 s druhý pokus). `aktualizace.yml` nasazuje sám už jen při push; `doplneni.yml` vůbec.
- Kontrola, co web opravdu servíruje: `curl -sI https://turnajovamapa.cz/data/sezony.json` (last-modified) a pole `aktualizace`.

## v3.6 – jedno místo = jeden špendlík, hlášení přes AJAX (26. 11. 2026)
- **Sloučení míst (`mergeVenues()` v app.js):** záznamy míst se stejným bodem (lat/lon na 5 des. míst) se v klientu sloučí do jednoho
  špendlíku se společným počtem turnajů. Typicky oblastní přebor (pořadatel = svaz, místo z loňska / rozpisu svazu) vs. turnaje klubu
  v témže areálu (dřív např. Houštka: špendlík A s 13 turnaji + zvlášť P přebor). Za místo se bere nejlepší záznam (přesnost → zdroj detail →
  klub před svazem → název místa). Turnaj si pamatuje původní místo `e.mo`: filtr odhadnutých míst, čárkovaný špendlík (jen když jsou odhadem
  všechny turnaje místa), poznámka v kartě turnaje („Odhad: místo loňského ročníku“) a kontext hlášení se řídí původním místem.
  Data/pipeline beze změny. Z2627: 260 → 181 míst s turnaji.
- **Hlášení problému:** odesílá se `fetch` na `https://formsubmit.co/ajax/<adresa>` (JSON odpověď, chybová zpráva FormSubmit se ukáže
  v hlášce) místo skrytého formuláře do iframe – ve Firefoxu iframe nedal výsledek a po 20 s se ukázalo „nepodařilo“. Když odeslání se snímkem
  selže, zkusí se znovu bez snímku. Skrytý iframe `repFrame` z index.html odstraněn. Service worker cache v21.

## v3.7 – po načtení stránky bez filtrů (26. 11. 2026)
- Každé načtení / refresh začíná s výchozími filtry (od dnes, ČTS, bez kategorií, hráčů, klubu) a v aktuální sezóně. Filtry (`tm.filters`)
  ani sezóna (`tm.sez`) se už neukládají, staré uložené hodnoty se při startu smažou. Pamatuje se jen jazyk, oblíbené (`tm.fav`) a mapový podklad (`tm.map`).
- v3.6.1: tlačítko jazyka ukazuje aktuální jazyk (CZ / EN); v3.9.1–3.9.2: přepínač CZ / EN (obě volby pod sebou ve čtverci 44 px jako ostatní tlačítka, aktuální zvýrazněná oranžově).

## v3.8 – kvalifikace a hlavní soutěž (26. 11. 2026)
- Detail turnaje s kvalifikací má na ČTS dva bloky „Kvalifikace“ a „Hlavní soutěž“, každý s vlastním „Počet účastníků“. Parser dřív bral
  první (= kvalifikaci, typicky 16) jako kapacitu turnaje. `cts.parse_detail` nově čte `kap_q` a `kap_h`, `pocet_ucastniku` = hlavní soutěž.
  Z2627: 30 detailů doplněno ze snímku HTML 31. 10. (`data/00_seznamy/terminova_listina_Z2627/detail_html_Z2627.zip`), ostatní se opraví
  při dalším stažení detailu.
- Turnaje v `turnaje.json` mají `kap` (hlavní soutěž), `kq` (kvalifikace) a `sm`/`sz` = [hlavní soutěž, kvalifikace, náhradníci] z veřejného
  seznamu přihlášených (`prihlasky.json`). Starší detail bez rozlišení bloků a s přihláškami v kvalifikaci → `kap` neznámé, `kq` = uvedený počet.
  Přepočítány všechny sezóny (`update.py --sezona X --bez-stahovani`).
- Web: v kartě turnaje s kvalifikací dva pruhy (Hlavní soutěž modrý, Kvalifikace oranžový) + počet náhradníků; v seznamu „max 32 + Q 16“;
  „plno“ až když je plná hlavní soutěž i kvalifikace; filtr „volná místa“ počítá i kvalifikaci. Obsazenost hlavní soutěže = jen hráči v hlavní
  soutěži (dřív všichni přihlášení vč. náhradníků a kvalifikace).

## v3.9 – vykřičník u dopočítané polohy (26. 11. 2026)
- Špendlík místa, kde má aspoň jeden aktivní turnaj dopočítanou polohu (odhad podle loňska, jen obec, areál v obci – podle původního místa `e.mo`),
  má vlevo nahoře červený vykřičník (`.pin .wx`); čárkovaný obrys zůstává jen u míst, kde jsou odhadem všechny turnaje. Legenda doplněna.
- Detail místa začíná červeným varováním (`locWarn()`): „Poloha je jen dopočítaná – může být nepřesná“ / „Poloha některých turnajů (n) je jen dopočítaná“
  + důvod (přesnost) a doporučení ověřit místo u pořadatele / na cesky-tenis.cz. Clustery vykřičník nemají.
- Pozn.: zkušební hlášení 26. 11. 18:20 přišlo ještě z v3.5 (Safari, starý způsob odeslání) a bez snímku – ověřit odeslání se snímkem z v3.6+.

## v3.9.3 – hlášení ve Firefoxu, 2. pokus (26. 11. 2026)
- Ve Firefoxu (v3.9.2) odeslání hlášení se snímkem vypršelo (30 s), v Safari prošlo. Nově: snímek se před odesláním zmenší (max. 1600 px, JPEG 0,72),
  1. pokus multipart se snímkem (limit 20 s); při jakékoli chybě 2. pokus jako JSON bez snímku (limit 15 s, v e-mailu pole „Snímek: nepřiložen…“).
  Chyby se píšou do konzole prohlížeče („Tenisová mapa – odeslání hlášení selhalo“). Ověřeno v Playwright (Chromium i Firefox) se simulovaným
  zaseknutím požadavku se snímkem; skutečné odeslání z Firefoxu ověří uživatel.
- v3.9.4: turnaj s nejistou polohou (stejná podmínka jako vykřičník, `unsure(e)`) má v seznamu turnajů i v kartě v detailu místa červený rámeček.
- v3.9.5: při filtru klubu (čip klubu v liště) má karta turnaje v detailu místa blok „Přihlášení z klubu X (n)“ – všichni přihlášení hráči klubu
  celým jménem (hlavní soutěž, pak kvalifikace, náhradníci), klepnutí otevře přihlášky hráče (`clubBlock(e)`).
- v3.9.6: u každého červeně orámovaného turnaje (seznam i karta, ČTS i TE) červený řádek „! Nejisté místo konání: <důvod>“ (`unsureText(e)`,
  důvod = přesnost původního místa, např. „Odhad: místo loňského ročníku“, „Jen obec – přesné místo neznámé“ + poznámka místa).

## v3.10 – čerstvější přihlášky blízkých turnajů (26. 11. 2026)
- Problém: Zoe Vymyslická (1061803) nebyla v datech u turnaje Tenis Jesenice st. žákyně 28. 11. (606178), přestože už byla v seznamu přihlášených.
  Detail se stáhl v noci 26. 11. (~2–3 h), hráčka se objevila později. Navíc „O aplikaci“ ukazovalo „data k 26. 11. 18:48“ – to byl čas
  přepočtu bez stahování z chatu, ne čas stažení z ČTS (chyba: `--bez-stahovani` přepisoval `meta.aktualizace`).
- Opravy: `meta.aktualizace` = čas posledního skutečného stažení (přepočet ho nemění; hodnoty vráceny na noční běh 26. 11. 3:16);
  u každého turnaje `ak` = kdy byl stažen jeho detail (`_kdy`, starší jen datum) → v kartě „Přihlášky podle ČTS k 26. 11. 12:47“.
- Nový workflow `blizke.yml` („Blízké turnaje (přihlášky)“): 2× denně (10:47 a 16:47 UTC) + ručně (Actions → Run workflow, vstup dní).
  `update.py --blizke 7`: jen aktuální sezóna, 7 listin + detaily turnajů začínajících do 7 dní (~110 stránek), 1 vlákno, 3 s pauza
  (~6–7 min), při 429/503 zpomalení / konec běhu. Stejná concurrency skupina jako noční běh. Po doběhnutí nasadí web `nasazeni.yml`.
  Zátěž webu ČTS: noc ~700 stránek po 1,5 s + 2× ~110 stránek po 3 s.
- 26. 11. večer (v3.10.1): na přání uživatele stačí noční aktualizace – `blizke.yml` už se automaticky nespouští (jen ručně z Actions).
- **Kontrola noční aktualizace** (`kontrola.yml`, 6:43 UTC, `pipeline/kontrola_behu.py`): ověří, že web (`/data/sezony.json`) má data z dnešní noci,
  a přečte `data/posledni_beh.json` (zapisuje noční `update.py --auto`: čas, chyby, počty HTTP 429/503). Při problému pošle e-mail přes FormSubmit
  AJAX na adresu z GitHub secretu `NOTIFY_EMAIL` (osobní adresa uživatele – v repozitáři ji kvůli robotům neuvádět) a job skončí chybou.
  Ruční spuštění (Run workflow, volba test) pošle zkušební e-mail. První zpráva na novou adresu = aktivační e-mail FormSubmit, nutno potvrdit.
- v3.10.2: tlačítko filtrů (vedle hledání) je přepínač – druhé klepnutí filtry zavře a vrátí seznam turnajů; otevřené filtry = tlačítko zvýrazněné.

## v3.11 – spolehlivé hlášení problému (26. 11. 2026)
- Příčina „vypršel čas“ v Safari i Firefoxu: služba FormSubmit byla 26. 11. večer přetížená (GET úvodní stránky ~12 s, POST > 40 s bez odpovědi,
  AJAX po 30 s HTTP 500) – ne chyba prohlížeče ani aplikace.
- Nově: hlášení se nejdřív uloží do fronty v prohlížeči (`localStorage tm.outbox`, i zmenšený snímek ~1400 px), pak se odesílá přes XHR
  (skutečný průběh nahrávání → tlačítko se vybarvuje, `--p`), limit 60 s se snímkem, pak 45 s bez snímku (JSON). Když služba neodpoví,
  hlášení zůstane ve frontě („Uloženo ✓“, bez chybové hlášky) a aplikace ho odešle sama: 6 s po startu, při obnovení připojení a každé 3 min,
  nejdéle 7 dní. Ověřeno v Playwright (Chromium, Firefox, WebKit/Safari) se simulovanou chybou serveru.
- Omezení: frontu odešle jen stejný prohlížeč, až bude aplikace znovu otevřená. Pro vyšší spolehlivost lze doplnit druhou službu (např. Web3Forms
  – přístupový klíč získá uživatel zdarma na web3forms.com) jako zálohu.

## v3.11.1 – pruh obsazenosti, kontrola míst (26. 11. 2026)
- Pruhy „Hlavní soutěž / Kvalifikace“ nezačínaly vyplněné od začátku: CSS `.occ div.sub` (odsazení textu) se uplatnilo i na samotný pruh
  (`div.bar5.sub`) → vnitřní odsazení 12 px; nově jen `div.sub:not(.bar5)`.
- **Místo loňského ročníku jen při stejném pořadateli** (`venues.prev_poradatel()`): kódy turnajů se mezi ročníky recyklují, takže „loňské místo“
  bylo u části přeborů jiného svazu/klubu (např. přebor středočeského svazu babytenis „ve Valašském Meziříčí“, pražský v Litvínově). Pořadatel
  stejného kódu se ověří v uložené loňské listině (`data/<loňská sezóna>/lists.json`); jiný pořadatel → místo neznámé (bez špendlíku).
- Ruční ověření dalších míst: TJ Slavoj Tesla Hloubětín (dříve bazén Hloubětín), TJ Start Ostrava-Poruba (dříve koupaliště Poruba) → kurty u adresy;
  TK Drnovice = Tenis centrum Drnovice (potvrzeno). Kontrola automatických „areál“ s odstupem ≥ 250 m od adresy (17 míst) – ostatní v pořádku.
- Zbývá nejisté: oblastní přebory a HMČR bez adresy v ČTS (30× odhad podle loňska), 16× neznámé; TJ Žďár n. S., TK DOMYNO P4, TK Krásné Březno,
  TK Meziboří. Rozpisy svazů na zimu 2026/27 se nepodařilo dohledat (zatím jen Jihočeský TS v `mista_svaz.csv`).
