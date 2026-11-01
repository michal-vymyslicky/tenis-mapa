import subprocess, sys, re, json, os, time
from bs4 import BeautifulSoup
OUT = sys.argv[1]
SLUGS = {"praha": "Praha", "stredocesky": "Středočeský", "jihocesky": "Jihočeský", "zapadocesky": "Západočeský",
         "severocesky": "Severočeský", "vychodo%C4%8Desky": "Východočeský", "jihomoravsky": "Jihomoravský", "severomoravsky": "Severomoravský"}

def get(url):
    for a in range(4):
        r = subprocess.run(["curl", "-sS", "-L", "-A", "Mozilla/5.0", "--max-time", "60", "-w", "\n%{http_code}", url], capture_output=True)
        if r.returncode == 0:
            body, code = r.stdout.decode("utf-8", "replace").rsplit("\n", 1)
            return body, code.strip()
        time.sleep(2)
    return "", "000"

clubs = []
for slug, reg in SLUGS.items():
    page = 1
    while True:
        url = f"https://cesky-tenis.cz/adresar/{slug}/{page}" if page > 1 else f"https://cesky-tenis.cz/adresar/{slug}"
        h, code = get(url)
        if code != "200":
            print("ERR", url, code); break
        soup = BeautifulSoup(h, "html.parser")
        sel = soup.select_one("select[name=oblast] option[selected]")
        rows = soup.select("table.table__table tbody tr")
        n = 0
        for tr in rows:
            tds = [re.sub(r"\s+", " ", td.get_text(" ", strip=True)) for td in tr.find_all("td")]
            if len(tds) >= 3 and tds[0].isdigit():
                clubs.append({"cislo": tds[0], "nazev": tds[1], "adresa": tds[2], "region": reg}); n += 1
        print(slug, page, "sel", sel.get_text(strip=True) if sel else None, n, flush=True)
        if n == 0 or not soup.select_one('a[rel="next"]'):
            break
        page += 1
        time.sleep(0.25)
json.dump(clubs, open(os.path.join(OUT, "clubs.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print("clubs", len(clubs))
