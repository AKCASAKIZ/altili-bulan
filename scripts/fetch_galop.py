#!/usr/bin/env python3
"""liderform.com.tr "Bulten Galop" sekmesini gunluk JSON'a cevirir.

Ceken sey iki sinyal:
  * GP  (point.now) — sitenin galop puani. F2 kriteri bunun ilk 4'unu kullanir.
  * Galop jokeyi (workout.jockey.id) ile kosu jokeyinin (jockey.id) ayni olup
    olmadigi. F3 kriteri bunu kullanir.

Sayfa bir Next.js uygulamasi; tablo HTML'de <tr> olarak degil, __NEXT_DATA__
icindeki JSON'da duruyor. Tabloyu HTML'den kazimaya calisma, dogrudan o JSON'u
oku — sutun sirasi degisse bile bozulmaz.

NOT: Site Cloudflare arkasinda ve TARAYICI OTOMASYONUNU blokluyor ("Sorry, you
have been blocked"), ama duz HTTP istegini gecirir. Bu yuzden veri buradan
cekilir, tarayiciyla degil.

Cikti: data/{gun}/galop-{slug}.json
  { "1": [ {"no":1,"ad":"...","gp":133,"jokey":"İ.GÜREKE",
            "galop_jokey":"İ.GÜREKE","ayni":true,"caba":"UNDERRESTRAINT",
            "idman_tarih":"2026-08-01"}, ... ], "2": [...] }
"""
import json
import re
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

BASE = "https://liderform.com.tr/program/galop-bulten"
UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/127.0 Safari/537.36")
NEXT_DATA = re.compile(
    r'<script id="__NEXT_DATA__" type="application/json">(.*?)</script>', re.S)


def _sayfa(day: str, slug: str, kosu: int):
    """Tek kosunun pageProps'unu dondurur; sayfa yoksa None."""
    url = f"{BASE}/{day}/{slug}/{kosu}"
    req = urllib.request.Request(url, headers={
        "User-Agent": UA,
        "Accept-Language": "tr-TR,tr;q=0.9",
    })
    try:
        h = urllib.request.urlopen(req, timeout=30).read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        print(f"  ! {url} -> HTTP {e.code}")
        return None
    except Exception as e:                                  # aglar, zaman asimi
        print(f"  ! {url} -> {type(e).__name__}: {e}")
        return None
    m = NEXT_DATA.search(h)
    if not m:
        print(f"  ! {url} -> __NEXT_DATA__ yok (sayfa yapisi degismis olabilir)")
        return None
    try:
        return json.loads(m.group(1)).get("props", {}).get("pageProps", {})
    except json.JSONDecodeError:
        print(f"  ! {url} -> __NEXT_DATA__ cozulemedi")
        return None


def _atlar(race_data):
    out = []
    for r in race_data or []:
        horse = r.get("horse") or {}
        jok = r.get("jockey") or {}
        wo = r.get("workout") or {}
        wjok = (wo.get("jockey") or {}) if wo else {}
        gp = (r.get("point") or {}).get("now")
        jid, wjid = jok.get("id"), wjok.get("id")
        out.append({
            "no": int(r.get("horse_number") or 0),
            "ad": (horse.get("name") or "").strip(),
            "gp": gp if isinstance(gp, (int, float)) else None,
            "jokey": (jok.get("name") or "").strip(),
            "galop_jokey": (wjok.get("name") or "").strip(),
            # Isim degil ID karsilastiriliyor: program jokeyi kisaltmali yazildigi
            # icin isim eslestirmesi kirilgan, ID kesin.
            "ayni": bool(jid and wjid and jid == wjid),
            "caba": (wo.get("effort") or "") if wo else "",
            "idman_tarih": (wo.get("meeting_date") or "") if wo else "",
            "kosmaz": r.get("entry_status") != "RUNNER",
        })
    return out


def fetch_galop(day: str, slug: str, out_dir: Path) -> None:
    """Bir hipodromun tum kosularinin galop bultenini indirir."""
    ilk = _sayfa(day, slug, 1)
    if not ilk:
        print(f"  - galop-{slug}: 1. kosu alinamadi, atlaniyor")
        return
    # Kac kosu var? raceTimeList sayfa basina geliyor; yoksa 1'den basla artir.
    kosular = ilk.get("raceTimeList") or []
    n = len(kosular) if kosular else 12
    veri = {"1": _atlar(ilk.get("raceData"))}
    for k in range(2, n + 1):
        time.sleep(0.3)
        p = _sayfa(day, slug, k)
        if not p:
            break
        atlar = _atlar(p.get("raceData"))
        if not atlar:
            break
        veri[str(k)] = atlar
    veri = {k: v for k, v in veri.items() if v}
    if not veri:
        print(f"  - galop-{slug}: bos, yazilmadi")
        return
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / f"galop-{slug}.json").write_text(
        json.dumps(veri, ensure_ascii=False), encoding="utf-8")
    ayni = sum(1 for v in veri.values() for h in v if h["ayni"])
    at = sum(len(v) for v in veri.values())
    print(f"  + galop-{slug}.json ({len(veri)} kosu, {at} at, {ayni} ayni jokey)")


def main(argv):
    """Argumansiz calisirsa bugunu, o gunun program-*.json dosyalarindaki
    hipodromlar icin ceker — gunluk cron boyle cagirir."""
    import datetime
    day = argv[1] if len(argv) > 1 else datetime.date.today().isoformat()
    out_dir = Path(__file__).resolve().parent.parent / "data" / day
    sluglar = argv[2:]
    if not sluglar:
        sluglar = sorted(p.name[len("program-"):-len(".json")]
                         for p in out_dir.glob("program-*.json"))
        if not sluglar:
            print(f"{day}: program dosyasi yok, galop cekilmedi")
            return 0
    for slug in sluglar:
        fetch_galop(day, slug, out_dir)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
