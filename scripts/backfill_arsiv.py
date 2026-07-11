#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
TJK geçmiş yarış sonuçlarını (varsayılan: son 2 yıl) CDN'deki günlük CSV
raporlarından çekip data/arsiv/{YYYY-MM}.json dosyalarına yazar.

Kaynak: https://medya-cdn.tjk.org/raporftp/TJKPDF/{yıl}/{yyyy-mm-dd}/CSV/
        GunlukYarisSonuclari/{dd.mm.yyyy}-{Şehir}-GunlukYarisSonuclari-TR.csv

Şehir listesi sabittir (10 hipodrom); koşu olmayan gün/şehir 404 döner ve
atlanır. Var olan ay dosyalarındaki günler tekrar indirilmez (devam edilebilir).

Kullanım:
  python scripts/backfill_arsiv.py                 # son 730 gün
  python scripts/backfill_arsiv.py 2024-07-11 2026-07-10
"""
import json
import subprocess
import sys
import urllib.parse
import importlib.util
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta
from pathlib import Path

BASE = Path(__file__).resolve().parent.parent
ARSIV = BASE / "data" / "arsiv"

# parse_csv'yi fetch_tjk.py'den yeniden kullan
spec = importlib.util.spec_from_file_location("fetch_tjk", BASE / "scripts" / "fetch_tjk.py")
fetch_tjk = importlib.util.module_from_spec(spec)
spec.loader.exec_module(fetch_tjk)

CITIES = ["İstanbul", "Ankara", "İzmir", "Adana", "Bursa",
          "Kocaeli", "Şanlıurfa", "Elazığ", "Diyarbakır", "Antalya"]

KEEP_HORSE = ("no", "ad", "yas", "kilo", "jokey", "sahip", "antrenor",
              "st", "h", "derece", "ganyan", "fark")


def curl_get(url: str) -> bytes | None:
    """urllib yerine curl: yerel SSL sertifika sorunlarından etkilenmez."""
    try:
        r = subprocess.run(["curl", "-sf", "--max-time", "30", url],
                           capture_output=True, timeout=40)
        return r.stdout if r.returncode == 0 and r.stdout else None
    except Exception:
        return None


def csv_url(date: datetime, city: str) -> str:
    t = "GunlukYarisSonuclari"
    return ("https://medya-cdn.tjk.org/raporftp/TJKPDF/"
            f"{date:%Y}/{date:%Y-%m-%d}/CSV/{t}/"
            + urllib.parse.quote(f"{date:%d.%m.%Y}-{city}-{t}-TR.csv"))


def slim(parsed: dict, city: str, iso: str) -> dict:
    """parse_csv çıktısını arşiv için gerekli alanlara indirger."""
    races = []
    for r in parsed.get("races", []):
        horses = []
        for i, h in enumerate(r.get("horses", []), start=1):
            row = {k: h[k] for k in KEEP_HORSE if h.get(k)}
            row["sira"] = i  # CSV'de atlar bitiş sırasıyla listelenir
            horses.append(row)
        races.append({
            "no": r.get("no"), "saat": r.get("saat"), "tur": r.get("tur"),
            "grup": r.get("grup"), "mesafe": r.get("mesafe"),
            "pist": r.get("pist"), "ikramiye": r.get("ikramiye"),
            "atlar": horses,
        })
    return {"tarih": iso, "sehir": city, "kosular": races}


def load_month(path: Path) -> dict:
    if path.exists():
        return json.loads(path.read_text(encoding="utf-8"))
    return {}


def main() -> None:
    if len(sys.argv) == 3:
        start = datetime.strptime(sys.argv[1], "%Y-%m-%d")
        end = datetime.strptime(sys.argv[2], "%Y-%m-%d")
    else:
        end = datetime.now() - timedelta(days=1)
        start = end - timedelta(days=729)

    ARSIV.mkdir(parents=True, exist_ok=True)
    month_cache: dict[str, dict] = {}

    def fetch_day(d: datetime) -> tuple[str, list]:
        iso = d.strftime("%Y-%m-%d")
        gunler = []
        for city in CITIES:
            raw = curl_get(csv_url(d, city))
            if not raw:
                continue
            try:
                parsed = fetch_tjk.parse_csv(raw.decode("utf-8-sig", "replace"))
            except Exception as e:
                print(f"  ! {iso} {city}: parse hatası: {e}", flush=True)
                continue
            gunler.append(slim(parsed, city, iso))
        return iso, gunler

    days = []
    d = start
    while d <= end:
        ay = d.strftime("%Y-%m")
        if ay not in month_cache:
            month_cache[ay] = load_month(ARSIV / f"{ay}.json")
        if d.strftime("%Y-%m-%d") not in month_cache[ay]:
            days.append(d)
        d += timedelta(days=1)

    done = 0
    with ThreadPoolExecutor(max_workers=12) as ex:
        for iso, gunler in ex.map(fetch_day, days):
            month = month_cache[iso[:7]]
            month[iso] = gunler
            done += 1
            if done % 50 == 0 or done == len(days):
                for ay, m in month_cache.items():
                    (ARSIV / f"{ay}.json").write_text(
                        json.dumps(m, ensure_ascii=False, separators=(",", ":")),
                        encoding="utf-8")
                print(f"{done}/{len(days)} gün (son: {iso})", flush=True)
    print("TAMAM", flush=True)


if __name__ == "__main__":
    main()
