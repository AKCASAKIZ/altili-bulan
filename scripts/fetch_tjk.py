#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
TJK günlük yarış programı ve sonuçlarını çeker, JSON'a çevirip data/ altına yazar.

Veri kaynağı: TJK'nın kendi sitesinde sunduğu açık CSV raporları
  https://medya-cdn.tjk.org/raporftp/TJKPDF/{yıl}/{yyyy-mm-dd}/CSV/...

Kullanım:
  python scripts/fetch_tjk.py                # bugün + dün
  python scripts/fetch_tjk.py 2026-07-05    # belirli gün(ler)

Sadece standart kütüphane kullanır.
"""
import json
import re
import sys
import time
import urllib.request
import urllib.parse
from datetime import datetime, timedelta, timezone
from pathlib import Path

BASE = Path(__file__).resolve().parent.parent
DATA = BASE / "data"
UA = {"User-Agent": "Mozilla/5.0 (compatible; AltiliBulan/2.0; kisisel arsiv)"}
TYPES = {"program": "GunlukYarisProgrami", "sonuclar": "GunlukYarisSonuclari"}

TR_MAP = str.maketrans("çğıöşüÇĞİIÖŞÜ", "cgiosuCGIIOSU")


def slugify(s: str) -> str:
    s = s.translate(TR_MAP).lower()
    return re.sub(r"^-|-$", "", re.sub(r"[^a-z0-9]+", "-", s))


def http_get(url: str, timeout: int = 30) -> bytes | None:
    try:
        req = urllib.request.Request(url, headers=UA)
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.read()
    except Exception:
        return None


def get_cities(date: datetime, tip: str) -> list[str]:
    """O gün koşusu olan hipodromları TJK'nın günlük sayfasından bulur."""
    url = (
        "https://www.tjk.org/TR/YarisSever/Info/Data/" + TYPES[tip]
        + "?QueryParameter_Tarih=" + date.strftime("%d/%m/%Y")
    )
    body = http_get(url)
    if not body:
        return []
    html = body.decode("utf-8", "replace")
    cities = re.findall(r"SehirAdi=([^&\"']+)&", html)
    seen, out = set(), []
    for c in cities:
        name = urllib.parse.unquote(c).strip()
        if name and name not in seen:
            seen.add(name)
            out.append(name)
    return out


def csv_url(date: datetime, city: str, tip: str) -> str:
    t = TYPES[tip]
    return (
        "https://medya-cdn.tjk.org/raporftp/TJKPDF/"
        f"{date:%Y}/{date:%Y-%m-%d}/CSV/{t}/"
        + urllib.parse.quote(f"{date:%d.%m.%Y}-{city}-{t}-TR.csv")
    )


HORSE_COLS = {
    "At No": "no", "At İsmi": "ad", "Yaş": "yas", "Orijin(Baba)": "baba",
    "Orijin(Anne)": "anne", "Kilo": "kilo", "Jokey Adı": "jokey",
    "Sahip Adı": "sahip", "Antrenör Adı": "antrenor", "St": "st", "AGF": "agf",
    "H": "h", "Son 6 Yarış": "son6", "KGS": "kgs", "s20": "s20",
    "EnİyiDerece": "eniyi", "Derece": "derece", "Ganyan": "ganyan", "Fark": "fark",
}


def parse_csv(text: str) -> dict:
    lines = text.splitlines()
    head = lines[0].split(";")
    city = head[0].strip()
    m = re.search(r"(\d{2})/(\d{2})/(\d{4})", head[2] if len(head) > 2 else "")
    date = f"{m.group(3)}-{m.group(2)}-{m.group(1)}" if m else ""

    races: list[dict] = []
    race, cols, is_result = None, None, False
    for line in lines[1:]:
        line = line.strip()
        if not line:
            continue
        cells = line.split(";")
        mr = re.match(r"^(\d+)\.\s*Kosu\s*:\s*(.+)", cells[0], re.I)
        if mr:
            race = {
                "no": int(mr.group(1)), "saat": mr.group(2).strip(),
                "tur": cells[1].strip() if len(cells) > 1 else "",
                "grup": cells[2].strip() if len(cells) > 2 else "",
                "kilo": cells[3].strip() if len(cells) > 3 else "",
                "mesafe": cells[4].strip() if len(cells) > 4 else "",
                "pist": cells[5].strip() if len(cells) > 5 else "",
                "horses": [],
            }
            races.append(race)
            cols = None
            continue
        if race is None:
            continue
        c0 = cells[0].strip()
        if c0.startswith("İkramiye"):
            continue
        if re.match(r"^1\.\)", c0):
            race["ikramiye"] = re.sub(r"^1\.\)", "", c0).strip()
            continue
        if c0 == "At No":
            cols = [c.strip() for c in cells]
            is_result = "Derece" in cols
            continue
        if re.match(r"^GANYAN", c0, re.I) or re.search(r"ÇİFTE|İKİLİ|ÜÇLÜ|TABELA|ALTILI|BEŞLİ", c0, re.I):
            race["odemeler"] = re.sub(r";+", " ", line).strip()
            continue
        if cols and re.match(r"^\d+$", c0):
            h = {}
            for i, col in enumerate(cols):
                key = HORSE_COLS.get(col)
                if key and i < len(cells):
                    h[key] = cells[i].strip()
            h["no"] = int(h.get("no", 0) or 0)
            race["horses"].append(h)
    return {"date": date, "city": city, "isResult": is_result, "races": races}


EKIPMAN = re.compile(r"(\s+(KG|SKG|GDSK|DSGK|GKDSK|GKD|DSK|GSK|SGK|GDS|DSG|GKR|DB|SK|GD|GK|DS|KD|GM|KGD|G|K|D|M|S))+$")


def at_adi_temizle(ad: str) -> str:
    ad = re.sub(r"\s*\(.*?\)\s*", " ", ad or "")
    return EKIPMAN.sub("", ad).strip().upper()


def fetch_at_istatistik(names: list[str]) -> dict:
    """TJK At Istatistikleri sorgusundan kariyer verilerini ceker."""
    out = {}
    for name in sorted(set(n for n in names if n)):
        url = ("https://www.tjk.org/TR/YarisSever/Query/Data/AtIstatistikleri"
               "?QueryParameter_AtAdi=" + urllib.parse.quote(name))
        body = http_get(url)
        time.sleep(0.25)
        if not body:
            continue
        html = body.decode("utf-8", "replace")
        for row in re.findall(r"<tr[^>]*>(.*?)</tr>", html, re.S):
            cells = [re.sub(r"<[^>]+>", "", c).replace("&nbsp;", " ").strip()
                     for c in re.findall(r"<td[^>]*>(.*?)</td>", row, re.S)]
            if len(cells) >= 18 and at_adi_temizle(cells[0]) == name:
                try:
                    out[name] = {"kosu": int(cells[6]), "p1": int(cells[7]),
                                 "p2": int(cells[8]), "p3": int(cells[9]),
                                 "kazanc": cells[17]}
                except (ValueError, IndexError):
                    pass
                break
    return out


def fetch_day(date: datetime) -> int:
    """Bir günün tüm hipodrom program+sonuçlarını indirir. Yazılan dosya sayısını döndürür."""
    written = 0
    day_str = date.strftime("%Y-%m-%d")
    for tip in TYPES:
        cities = get_cities(date, tip)
        if not cities:
            print(f"  {day_str} {tip}: hipodrom bulunamadı")
            continue
        for city in cities:
            raw = http_get(csv_url(date, city, tip))
            if not raw:
                print(f"  {day_str} {tip} {city}: CSV yok (muhtemelen yurt dışı/henüz yayınlanmadı)")
                continue
            try:
                text = raw.decode("utf-8-sig")
            except UnicodeDecodeError:
                text = raw.decode("cp1254", "replace")
            try:
                data = parse_csv(text)
            except Exception as e:
                print(f"  {day_str} {tip} {city}: ayrıştırma hatası: {e}")
                continue
            if not data["races"]:
                continue
            out_dir = DATA / day_str
            out_dir.mkdir(parents=True, exist_ok=True)
            out = out_dir / f"{tip}-{slugify(city)}.json"
            out.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
            print(f"  ✓ {out.relative_to(BASE)} ({len(data['races'])} koşu)")
            written += 1
            if tip == "program":
                ist_dosya = out_dir / f"atistatistik-{slugify(city)}.json"
                if not ist_dosya.exists():
                    names = [at_adi_temizle(h.get("ad", ""))
                             for r in data["races"] for h in r["horses"]]
                    stats = fetch_at_istatistik(names)
                    if stats:
                        ist_dosya.write_text(json.dumps(stats, ensure_ascii=False), encoding="utf-8")
                        print(f"  + atistatistik ({len(stats)} at)")
                        written += 1
    return written


def rebuild_index() -> None:
    """data/ klasörünü tarayıp index.json'u yeniden kurar."""
    days: dict[str, list[dict]] = {}
    for day_dir in sorted(DATA.iterdir()):
        if not day_dir.is_dir() or not re.match(r"^\d{4}-\d{2}-\d{2}$", day_dir.name):
            continue
        cities: dict[str, str] = {}
        for f in day_dir.glob("*.json"):
            m = re.match(r"^(program|sonuclar)-(.+)\.json$", f.name)
            if not m:
                continue
            slug = m.group(2)
            if slug not in cities:
                try:
                    cities[slug] = json.loads(f.read_text(encoding="utf-8")).get("city", slug)
                except Exception:
                    cities[slug] = slug
        if cities:
            days[day_dir.name] = [{"slug": s, "name": n} for s, n in sorted(cities.items())]
    index = {
        "updated": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC"),
        "days": days,
    }
    (DATA / "index.json").write_text(json.dumps(index, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"  ✓ data/index.json ({len(days)} gün)")


def main() -> None:
    DATA.mkdir(exist_ok=True)
    if len(sys.argv) > 1:
        dates = [datetime.strptime(a, "%Y-%m-%d") for a in sys.argv[1:]]
    else:
        # TR saati (UTC+3) baz alınır: bugün + dün
        now_tr = datetime.now(timezone.utc) + timedelta(hours=3)
        dates = [now_tr, now_tr - timedelta(days=1)]
    total = 0
    for d in dates:
        print(f"[{d:%Y-%m-%d}] çekiliyor…")
        total += fetch_day(d)
    rebuild_index()
    print(f"Bitti: {total} dosya yazıldı/güncellendi.")


if __name__ == "__main__":
    main()
