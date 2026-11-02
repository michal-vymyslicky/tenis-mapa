/* Tenisová mapa – jazyky (čeština = výchozí texty v kódu, angličtina = slovník níže).
   Jazyk: ?lang=en|cs v adrese > uložená volba (tm.lang) > jazyk prohlížeče (cs/sk = čeština, jinak angličtina).
   T("český text", {n: 5}) vrátí překlad (nebo původní text) a dosadí {proměnné}. */
window.I18N = (() => {
  "use strict";
  const LS = {get: k => { try { return localStorage.getItem(k); } catch { return null; } },
              set: (k, v) => { try { localStorage.setItem(k, v); } catch {} }};
  const q = new URLSearchParams(location.search).get("lang");
  let lang = q === "en" || q === "cs" ? q : LS.get("tm.lang");
  if (lang !== "en" && lang !== "cs") lang = /^(cs|sk)\b/i.test(navigator.language || "") ? "cs" : "en";
  if (q === "en" || q === "cs") LS.set("tm.lang", lang);

  /* klíč = český text přesně jako v kódu / HTML */
  const EN = {
    // --- hlavička, mapa, panel ---
    "Tenisová mapa turnajů": "Tennis tournament map",
    "Mapa turnajů jednotlivců ČTS a mezinárodních turnajů Tennis Europe – filtr podle termínu, kategorie, třídy, povrchu a vzdálenosti.": "Map of Czech Tennis Association (ČTS) and international Tennis Europe tournaments – filter by date, category, grade, surface and distance.",
    "Mapa turnajů": "Tournament map",
    "O aplikaci": "About",
    "Hráč, klub, město, turnaj…": "Player, club, town, tournament…",
    "Filtry": "Filters",
    "Rychlý výběr kategorie": "Quick category selection",
    "Moje poloha": "My location",
    "Okruh od bodu v mapě": "Radius from a point on the map",
    "Legenda": "Legend",
    "Klepněte do mapy – od tohoto bodu se počítá okruh": "Tap the map – the radius is measured from this point",
    "Zpět": "Back",
    "Načítám turnaje…": "Loading tournaments…",
    "Minimalizovat": "Minimise",
    "Seznam": "List",
    "Oblíbené": "Favourites",
    "Nahlásit problém": "Report a problem",
    "Podle data": "By date",
    "Podle vzdálenosti": "By distance",
    "Sdílet odkaz": "Share link",
    "Do kalendáře": "Add to calendar",
    "Jen oblíbené v mapě": "Only favourites on map",
    "Jazyk": "Language",
    // --- filtry ---
    "Termín": "Dates",
    "Od": "From",
    "Do": "To",
    "Tento víkend": "This weekend",
    "Příští víkend": "Next weekend",
    "14 dní": "14 days",
    "30 dní": "30 days",
    "Celá sezóna": "Whole season",
    "Kategorie": "Category",
    "Pohlaví": "Gender", "Třída": "Grade", "Odebrat kategorii": "Remove category", "Hotovo": "Done", "Seřazeno podle vzdálenosti od středu mapy": "Sorted by distance from the map centre", "Region": "Region", "lze vybrat oba": "choose one or both", "lze vybrat více": "multiple choice", "Všechny kategorie": "All categories", "{n} kategorie": "{n} categories", "upřesnit": "refine", "Bez dalších voleb": "No further options", "ČTS – turnaje v ČR": "ČTS – Czech tournaments", "Tennis Europe – mezinárodní": "Tennis Europe – international",
    "Třída turnaje": "Tournament grade",
    "Povrch": "Surface",
    "Konkrétní typy povrchů": "Specific surface types",
    "Okruh": "Radius",
    "Celá ČR": "Whole Czechia",
    "Bod v mapě": "Point on map",
    "Nebo hledat obec / adresu…": "Or search a town / address…",
    "Najít": "Search",
    "Vzdálenost do": "Distance up to",
    "Další": "More",
    "Jen s volnými místy": "Only with free places",
    "Zobrazit zrušené turnaje": "Show cancelled tournaments",
    "Zobrazit turnaje s odhadnutým místem": "Show tournaments with estimated location",
    "Vymazat filtry": "Clear filters",
    "Zobrazit": "Show",
    "Chlapci / muži": "Boys / men",
    "Dívky / ženy": "Girls / women",
    "Zobrazuje se celá ČR.": "Showing the whole of Czechia.",
    "Střed": "Centre",
    "moje poloha": "my location",
    "bod v mapě": "point on map",
    "Od dnes": "From today",
    // --- kategorie, třídy, povrchy ---
    "Dospělí": "Adults", "Dorost": "Under 18", "Starší žactvo": "Under 14", "Mladší žactvo": "Under 12",
    "Babytenis": "Babytennis", "Střední kurt": "Midcourt", "Minitenis": "Minitennis",
    "Ml. žactvo": "U12", "St. žactvo": "U14",
    "MČR": "MČR – national champ.", "P – přebor": "P – regional champ.", "bez třídy": "no grade",
    "Antuka": "Clay", "Koberec": "Carpet", "Tvrdý": "Hard", "Umělá tráva": "Artificial grass", "Umělá antuka": "Artificial clay",
    "Sportovní podlaha": "Sports floor", "Neuvedeno": "Not stated", "Jiný": "Other",
    "antuka": "clay", "koberec": "carpet", "koberec s granulemi": "carpet with granules", "koberec s pískem": "sand-filled carpet",
    "umělá tráva": "artificial grass", "umělá antuka": "artificial clay", "beton": "concrete", "neuvedeno": "not stated",
    // --- legenda ---
    "Třída turnaje <small>(klepnutím filtrujete)</small>": "Tournament grade <small>(tap to filter)</small>",
    "zrušeno": "cancelled",
    "čárkovaně = místo odhadnuté": "dashed = estimated location",
    "písmeno ve špendlíku = nejvyšší třída v místě, bublina = počet turnajů": "letter in pin = highest grade at the venue, bubble = number of tournaments",
    // --- přesnost místa ---
    "Místo ověřeno – tenisový areál v mapě": "Location verified – tennis venue on the map",
    "Místo ručně ověřeno": "Location checked manually",
    "Bod adresy (areál v mapě nenalezen)": "Address point (venue not found on the map)",
    "Tenisový areál v obci – neověřeno": "Tennis venue in the town – not verified",
    "Jen obec – přesné místo neznámé": "Town only – exact location unknown",
    "Odhad: místo loňského ročníku": "Estimate: last year's venue",
    "Místo neznámé": "Location unknown",
    "Adresa místa konání podle ČTS": "Venue address according to ČTS",
    "Adresa klubu (místo konání zatím neuvedeno)": "Club address (venue not yet published)",
    "Adresa podle ČTS, ověřeno v mapě": "Address according to ČTS, verified on the map",
    "místo podle ověřeného areálu klubu": "location from the club's verified venue",
    "ročník": "season",
    "místo podle areálu klubu v datech ČTS": "location from the club's venue in ČTS data",
    // --- Tennis Europe ---
    "Třída turnaje ČTS": "ČTS tournament grade", "🇪🇺 Mezinárodní turnaje": "🇪🇺 International tournaments",
    "Juniorské turnaje Tennis Europe po celé Evropě (věk 12–18 let).": "Tennis Europe junior tournaments all over Europe (ages 12–18).",
    "ČTS + Tennis Europe": "ČTS + Tennis Europe", "Jen Tennis Europe": "Tennis Europe only", "Kategorie Tennis Europe": "Tennis Europe categories",
    "Přidány mezinárodní turnaje Tennis Europe": "International Tennis Europe tournaments added",
    "Mapový podklad": "Base map", "Automaticky": "Automatic", "Základní": "Standard", "Latinka": "Latin script",
    "Turistická": "Topographic", "Letecká": "Aerial",
    "OpenStreetMap v ČR, v zahraničí popisky latinkou": "OpenStreetMap in Czechia, Latin-script labels abroad",
    "OpenStreetMap – místní písmo (v Srbsku azbuka)": "OpenStreetMap – local script (Cyrillic in Serbia)",
    "Esri – všechny názvy latinkou": "Esri – all names in Latin script",
    "OpenTopoMap – vrstevnice, turistické trasy": "OpenTopoMap – contours, hiking trails",
    "Esri – satelitní snímky s popisky": "Esri – satellite imagery with labels",
    "Turnaje": "Tournaments", "Vše": "All", "Bez okruhu": "No radius", "Jen ČTS": "ČTS only",
    "Bez omezení vzdálenosti.": "No distance limit.",
    "TE mistrovství Evropy": "TE European Championship", "TE kategorie 1": "TE Category 1", "TE kategorie 2": "TE Category 2",
    "TE kategorie 3": "TE Category 3", "TE ostatní": "TE other",
    "Tennis Europe – žlutý okraj špendlíku": "Tennis Europe – yellow pin outline",
    "online přihlášky": "online entry", "Kategorie TE": "TE category", "Věk": "Age group", "Země": "Country", "Místo": "Venue",
    "Turnaj zmizel z kalendáře Tennis Europe – ověřte na jejich webu.": "The tournament disappeared from the Tennis Europe calendar – please check their website.",
    "Kapacita, přihlášky, losy a výsledky jsou na webu Tennis Europe.": "Capacity, entries, draws and results are on the Tennis Europe website.",
    "Detail a přihlášky · Tennis Europe": "Details and entry · Tennis Europe",
    "Areál dohledán v mapě (OpenStreetMap)": "Venue found on the map (OpenStreetMap)",
    "Jen obec – areál v mapě nedohledán": "Town only – venue not found on the map",
    "místo podle rozpisu svazu": "venue according to the regional association's schedule",
    // --- seznam a karty ---
    "turnajů": "tournaments", "míst": "venues", "bez místa": "without location",
    "děti": "children", "muži": "men", "ženy": "women", "chlapci": "boys", "dívky": "girls",
    "Děti": "Children", "Muži": "Men", "Ženy": "Women", "Chlapci": "Boys", "Dívky": "Girls",
    "plno": "full", "ZRUŠENO": "CANCELLED", "NOVÉ": "NEW",
    "kód": "code", "Max. hráčů": "Max. players", "Dvorce · povrch": "Courts · surface", "Míče": "Balls",
    "Vklad": "Entry fee", "Prezentace": "Sign-in", "Pořadatel": "Organiser",
    "Turnaj zmizel z termínové listiny {d} – ověřte na webu ČTS.": "The tournament disappeared from the ČTS calendar on {d} – please check the ČTS website.",
    "Turnaj je v listině označen jako zrušený – ověřte na webu ČTS.": "The tournament is marked as cancelled in the calendar – please check the ČTS website.",
    "Nahlásit chybu u tohoto turnaje": "Report an error in this tournament",
    "Výsledky": "Results", "Hráči": "Players", "Přihlášky": "Entries", "Hrací plány / výsledky": "Draws / results",
    "Navigovat · Mapy.com": "Navigate · Mapy.com", "Ukázat v Mapy.com": "Show in Mapy.com",
    "Pořadatel: {p} oblastní svaz": "Organiser: {p} regional association", "Pořadatel: {p}": "Organiser: {p}",
    "Nahlásit špatné místo nebo údaje": "Report a wrong location or details",
    "Žádný turnaj tohoto místa neodpovídá filtrům.": "No tournament at this venue matches the filters.",
    "Souběh: {n} soutěží ve stejném termínu": "Concurrent: {n} events on the same dates",
    "Souběh: {n} soutěží v {c} kategoriích ve stejném termínu": "Concurrent: {n} events in {c} categories on the same dates",
    "Další turnaje v tomto místě mimo filtr ({n})": "Other tournaments at this venue outside the filter ({n})",
    "Zobrazeno prvních 300 – zužte filtr.": "Showing the first 300 – narrow the filter.",
    "Filtrům neodpovídá žádný turnaj.": "No tournament matches the filters.",
    // --- oblíbené ---
    "V sezóně {s} zatím žádné oblíbené – přidáte je hvězdičkou u turnaje.": "No favourites in {s} yet – add them with the star next to a tournament.",
    "{n} oblíbených turnajů už v datech není.": "{n} favourite tournaments are no longer in the data.",
    "Další oblíbené v jiných sezónách: {x} – přepněte sezónu nahoře.": "More favourites in other seasons: {x} – switch the season at the top.",
    "Nejdřív přidejte oblíbené turnaje.": "Add some favourite tournaments first.",
    "Moje tenisové turnaje": "My tennis tournaments",
    "Odkaz zkopírován.": "Link copied.",
    "Odkaz:": "Link:",
    "Žádné oblíbené turnaje k exportu.": "No favourite tournaments to export.",
    "Sdílený seznam obsahuje <b>{n}</b> turnajů.": "The shared list contains <b>{n}</b> tournaments.",
    "Přidat do mých oblíbených": "Add to my favourites", "Ne": "No",
    // --- poloha, hledání místa ---
    "Prohlížeč neumí zjistit polohu.": "Your browser cannot determine your location.",
    "Zjišťuji polohu…": "Finding your location…",
    "Přístup k poloze je zakázaný – povolte ho v nastavení prohlížeče.": "Location access is blocked – allow it in your browser settings.",
    "Polohu se nepodařilo zjistit.": "Could not determine your location.",
    "Nejdřív nastavte okruh – polohu nebo bod v mapě.": "Set a radius first – your location or a point on the map.",
    "Hledám…": "Searching…", "Nic nenalezeno.": "Nothing found.", "Vyhledávání se nepodařilo.": "Search failed.",
    // --- hlášení problému ---
    "Popište, co nesedí. Hlášení se odešle e-mailem správci mapy i s informací, o jaký turnaj nebo místo jde.": "Describe what is wrong. The report is e-mailed to the map maintainer together with the tournament or venue it concerns.",
    "Čeho se problém týká": "What the problem concerns",
    "Špatné místo na mapě": "Wrong location on the map",
    "Chybné údaje turnaje": "Wrong tournament details",
    "Turnaj chybí / je zrušený": "Tournament missing / cancelled",
    "Chyba aplikace": "App bug",
    "Návrh na zlepšení": "Suggestion",
    "Popis": "Description",
    "Např.: hala je ve skutečnosti o 2 km dál, U Sportovní haly 12…": "E.g. the hall is actually 2 km further, U Sportovní haly 12…",
    "Váš e-mail pro odpověď (nepovinné)": "Your e-mail for a reply (optional)",
    "Snímek obrazovky (nepovinné)": "Screenshot (optional)",
    "Zachytit aktuální mapu": "Capture current map",
    "Vybrat obrázek": "Choose image",
    "Náhled snímku": "Screenshot preview",
    "Odebrat snímek": "Remove screenshot",
    "Odeslat hlášení": "Send report",
    "Poslat raději vlastním e-mailem": "Send from my own e-mail instead",
    "Odesílám…": "Sending…",
    "Pořizuji snímek obrazovky…": "Taking a screenshot…",
    "Snímek se nepodařilo pořídit – vyberte obrázek z galerie.": "Could not take a screenshot – choose an image from your gallery.",
    "Vyberte typ problému nebo napište krátký popis.": "Choose a problem type or write a short description.",
    "Děkujeme, hlášení bylo odesláno.": "Thank you, the report has been sent.",
    "Odeslání se možná nepovedlo – zkuste „Poslat raději vlastním e-mailem“.": "Sending may have failed – try “Send from my own e-mail instead”.",
    "Děkujeme za hlášení!": "Thank you for the report!",
    "Hlášení se odešle přímo z aplikace (služba FormSubmit) – nepotřebujete účet ani vlastní e-mail.": "The report is sent directly from the app (FormSubmit service) – no account or own e-mail needed.",
    " Snímek se přiloží.": " The screenshot will be attached.",
    "adresa neuvedena": "address not stated",
    "Místo na mapě · přesnost: {p}": "Location on the map · accuracy: {p}",
    "<b>Obecné hlášení</b>Přiloží se aktuální výřez mapy a nastavené filtry.<div class=\"muted\">Tip: pro konkrétní turnaj otevřete jeho detail a klepněte na „Nahlásit chybu“.</div>":
      "<b>General report</b>The current map view and filters will be attached.<div class=\"muted\">Tip: for a specific tournament open its detail and tap “Report an error”.</div>",
    "Komu": "To", "Předmět": "Subject",
    // --- hráči ---
    "hráč": "player",
    "ml. žák": "U12 boy", "ml. žákyně": "U12 girl", "st. žák": "U14 boy", "st. žákyně": "U14 girl",
    "dorostenec": "U18 boy", "dorostenka": "U18 girl", "muž": "man", "žena": "woman",
    "kval.": "qual.", "náhr.": "alt.",
    "Žádný hráč neodpovídá": "No matching player",
    "{n}× přihl.": "{n} entries", "bez přihlášek": "no entries",
    "Hledat „{q}“ v turnajích ({n})": "Search “{q}” in tournaments ({n})",
    "{r}. v ČR": "CZ rank {r}",
    "mimo žebříček {z}": "not in ranking {z}",
    "Odebrat z mapy": "Remove from map", "Zobrazit v mapě": "Show on map", "Profil na ČTS": "Profile on ČTS",
    "Turnaje sezóny {s}, kterých se hráč účastnil.": "Tournaments of {s} the player took part in.",
    "Kde je přihlášen": "Entered in", "Kam se může přihlásit": "Can enter",
    "Podle soutěžního řádu může hráč startovat ve své kategorii i ve starších: {c} ({g}). Kategorie je odvozená ze žebříčku {z} – ověřte si to v propozicích turnaje.":
      "Under the competition rules a player may play in their own age category and in older ones: {c} ({g}). The category is derived from the ranking {z} – check the tournament rules.",
    "chlapci / muži": "boys / men", "dívky / ženy": "girls / women",
    "Hráč není v žebříčku, kategorii nelze určit – zobrazujeme jen jeho přihlášky.": "The player is not in the ranking, so the category cannot be determined – showing their entries only.",
    "Přihlášky z veřejných seznamů ČTS (hlavní soutěž, kvalifikace, náhradníci), obnovují se denně.": "Entries from public ČTS lists (main draw, qualifying, alternates), updated daily.",
    "Zatím žádná přihláška.": "No entries yet.",
    "Zobrazeno 200 z {n} – zužte filtr.": "Showing 200 of {n} – narrow the filter.",
    "Žádný vhodný turnaj v nastaveném termínu.": "No suitable tournament in the selected dates.",
    // --- sezóny, o aplikaci, start ---
    "Sezóna": "Season", "archiv": "archive", "připravuje se": "upcoming", "probíhá": "current",
    "Načítám {s}…": "Loading {s}…",
    "Hráč, klub, turnaj… (data {d})": "Player, club, tournament… (data {d})",
    "Data se nepodařilo načíst: ": "Could not load data: ",
    "data k {d}": "data as of {d}", "verze {v}": "version {v}",
    "Data": "Data", "Upozornění": "Disclaimer", "Kontakt": "Contact",
    "Chyby a náměty:": "Bugs and ideas:",
  };

  /* delší HTML bloky (O aplikaci) – data-i18n="klíč" */
  const EN_HTML = {
    "about.intro": "<b>Tennis map</b> shows individual tournaments from the calendar of the Czech Tennis Association (ČTS) and international Tennis Europe junior tournaments on a map – with filters by date, category, grade, surface and distance, players' entries and favourite tournaments. Tournament names, clubs and the linked ČTS pages are in Czech.",
    "about.disclaimer": "This is a private, non-commercial project that is not run by or affiliated with the Czech Tennis Association. Data is taken automatically from the public website <a href=\"https://cesky-tenis.cz\" target=\"_blank\" rel=\"noopener\">cesky-tenis.cz</a> and may be incomplete, delayed or wrong – especially venues, which are derived from addresses. The app is provided <b>without any warranty and without liability</b> for any damage arising from its use. It is made to the best of our knowledge and belief. Always check the details on the official ČTS website and with the organiser before travelling to a tournament.",
    "about.d1": "Tournaments, entries and ranking: Czech Tennis Association, public website cesky-tenis.cz (<span id=\"aboutData\"></span>).",
    "about.d2": "Seasons in the app: <span id=\"aboutSez\"></span>. The current and upcoming seasons are updated daily; older seasons are an archive with links to results.",
    "about.d6": "International tournaments: Tennis Europe Junior Tour, public search at te.tournamentsoftware.com – dates, venue, surface, category and age group; entries and results on the Tennis Europe website.",
    "about.d3": "Map: © OpenStreetMap contributors; place search: Nominatim (OSM); addresses: RÚIAN (ČÚZK).",
    "about.d4": "Names in entry lists come from public ČTS lists. If you do not wish to be listed in the app, let us know via “Report a problem” and we will remove the data.",
    "about.d5": "Favourite tournaments and filters are stored only in your browser.",
  };

  const t = (s, vars) => {
    let r = lang === "en" && Object.prototype.hasOwnProperty.call(EN, s) ? EN[s] : s;
    if (vars) r = r.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
    return r;
  };

  /* překlad statického HTML: textové uzly + atributy placeholder/title/aria-label/alt + bloky data-i18n */
  function applyDOM(root = document) {
    document.documentElement.lang = lang;
    if (lang === "cs") return;
    document.title = t(document.title);
    const md = document.querySelector('meta[name="description"]');
    if (md) md.content = t(md.content);
    root.querySelectorAll("[data-i18n]").forEach(el => { const h = EN_HTML[el.dataset.i18n]; if (h) el.innerHTML = h; });
    const w = document.createTreeWalker(root.body || root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (w.nextNode()) nodes.push(w.currentNode);
    for (const n of nodes) {
      const s = n.nodeValue.trim();
      if (s && Object.prototype.hasOwnProperty.call(EN, s)) n.nodeValue = n.nodeValue.replace(s, EN[s]);
    }
    root.querySelectorAll("[placeholder],[title],[aria-label],[alt]").forEach(el => {
      for (const a of ["placeholder", "title", "aria-label", "alt"]) {
        const v = el.getAttribute(a);
        if (v && Object.prototype.hasOwnProperty.call(EN, v)) el.setAttribute(a, EN[v]);
      }
    });
  }

  function set(l) {
    LS.set("tm.lang", l);
    const u = new URL(location.href);
    u.searchParams.set("lang", l);
    location.href = u.toString();
  }

  return {lang, t, applyDOM, set, en: lang === "en"};
})();
