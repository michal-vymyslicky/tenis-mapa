"""Společné funkce pipeline Tenisové mapy (HTTP, normalizace názvů, JSON)."""
import json, os, re, time, unicodedata, urllib.request, urllib.parse, http.cookiejar

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data")
SITE_DATA = os.path.join(ROOT, "site", "data")
UA_CTS = "Mozilla/5.0 (TenisMapa; +https://github.com)"
UA_GEO = "TenisMapa/1.0 (mapa turnaju CTS; kontakt vymyslicky@oculus.cz)"


def norm(s):
    s = unicodedata.normalize("NFKD", s or "").encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", " ", s).strip()


def load(name, default=None):
    p = os.path.join(DATA, name)
    if not os.path.exists(p):
        return default
    with open(p, encoding="utf-8") as f:
        return json.load(f)


def save(name, obj, folder=DATA, indent=1):
    os.makedirs(folder, exist_ok=True)
    p = os.path.join(folder, name)
    tmp = p + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, indent=indent, separators=None if indent else (",", ":"))
    os.replace(tmp, p)


class Http:
    """Jednoduchý klient se session cookie (Nette formuláře na cesky-tenis.cz) a opakováním."""

    def __init__(self, ua=UA_CTS, pause=0.3):
        self.cj = http.cookiejar.CookieJar()
        self.op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(self.cj))
        self.ua, self.pause = ua, pause

    def get(self, url, data=None, referer=None, tries=4):
        last = None
        for a in range(tries):
            try:
                req = urllib.request.Request(url, data=data.encode() if isinstance(data, str) else data,
                                             headers={"User-Agent": self.ua, "Accept-Language": "cs"})
                if referer:
                    req.add_header("Referer", referer)
                with self.op.open(req, timeout=60) as r:
                    body = r.read().decode("utf-8", "replace")
                    time.sleep(self.pause)
                    return r.status, body
            except urllib.error.HTTPError as e:
                if e.code == 404:
                    return 404, ""
                last = e
            except Exception as e:  # síť, timeout
                last = e
            time.sleep(2 * (a + 1))
        raise RuntimeError(f"GET selhal {url}: {last}")
