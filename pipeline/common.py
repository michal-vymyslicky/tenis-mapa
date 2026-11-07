"""Společné funkce pipeline Tenisové mapy (HTTP, normalizace názvů, JSON)."""
import json, os, re, threading, time, unicodedata, urllib.request, urllib.parse, http.cookiejar

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data")
SITE_DATA = os.path.join(ROOT, "site", "data")
UA_CTS = "Mozilla/5.0 (TenisMapa; +https://github.com)"
UA_GEO = "TenisovaMapa/2.5 (+https://turnajovamapa.cz; tenisova-mapa@seznam.cz)"


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


class RateLimited(RuntimeError):
    """Server opakovaně odmítá požadavky (HTTP 429/503) – stahování z tohoto webu se pro tento běh vzdává."""


class Http:
    """Jednoduchý klient se session cookie (Nette formuláře na cesky-tenis.cz) a opakováním.

    Při HTTP 429/503 (omezení počtu požadavků) se zpomalí VŠECHNA vlákna a instance pro daný web (sdílený stav podle hostitele):
    respektuje Retry-After, jinak čeká 15 s, 30 s, 60 s … max. 5 min a trvale přidá pauzu mezi stránkami.
    Po 8 odmítnutích za sebou (nebo 60 za běh) vyhodí RateLimited – volající ponechá stará data místo hodin čekání.
    """
    _lock = threading.Lock()
    _hosts = {}          # host -> {"not_before", "streak", "total", "extra"}
    MAX_STREAK, MAX_TOTAL = 8, 60

    def __init__(self, ua=UA_CTS, pause=0.3):
        self.cj = http.cookiejar.CookieJar()
        self.op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(self.cj))
        self.ua, self.pause = ua, pause

    @classmethod
    def _st(cls, host):
        return cls._hosts.setdefault(host, {"not_before": 0.0, "streak": 0, "total": 0, "extra": 0.0})

    @classmethod
    def _check(cls, host):
        with cls._lock:
            st = cls._st(host)
            if st["streak"] >= cls.MAX_STREAK or st["total"] >= cls.MAX_TOTAL:
                raise RateLimited(f"{host}: server omezuje počet požadavků (429) – {st['total']}× za běh, vzdávám stahování")
            wait = st["not_before"] - time.time()
        if wait > 0:
            time.sleep(wait)

    @classmethod
    def _limited(cls, host, err):
        ra = 0
        try:
            ra = int(err.headers.get("Retry-After") or 0)
        except (TypeError, ValueError, AttributeError):
            pass
        with cls._lock:
            st = cls._st(host)
            st["streak"] += 1; st["total"] += 1
            delay = min(300, max(ra, 15 * 2 ** (st["streak"] - 1)))
            st["not_before"] = max(st["not_before"], time.time() + delay)
            st["extra"] = min(3.0, st["extra"] + 0.5)
            print(f"  ! {host}: HTTP {err.code} – čekám {delay} s, pauza mezi stránkami +{st['extra']:.1f} s "
                  f"({st['total']}× za běh)", flush=True)

    @classmethod
    def _ok(cls, host):
        with cls._lock:
            st = cls._st(host)
            st["streak"] = 0
            return st["extra"]

    @classmethod
    def stav(cls):
        """Souhrn omezení za běh: {host: počet 429/503}."""
        with cls._lock:
            return {h: s["total"] for h, s in cls._hosts.items() if s["total"]}

    def get(self, url, data=None, referer=None, tries=4):
        host = urllib.parse.urlsplit(url).netloc
        last, a = None, 0
        while a < tries:
            self._check(host)
            try:
                req = urllib.request.Request(url, data=data.encode() if isinstance(data, str) else data,
                                             headers={"User-Agent": self.ua, "Accept-Language": "cs"})
                if referer:
                    req.add_header("Referer", referer)
                with self.op.open(req, timeout=60) as r:
                    body = r.read().decode("utf-8", "replace")
                    time.sleep(self.pause + self._ok(host))
                    return r.status, body
            except urllib.error.HTTPError as e:
                if e.code == 404:
                    return 404, ""
                last = e
                if e.code in (429, 503):
                    self._limited(host, e)   # čekání řeší _check; počet pokusů hlídá MAX_STREAK
                    continue
            except Exception as e:  # síť, timeout
                last = e
            a += 1
            time.sleep(2 * a)
        raise RuntimeError(f"GET selhal {url}: {last}")
