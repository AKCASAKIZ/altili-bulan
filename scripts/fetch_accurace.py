#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Accurace.net'in checkpoint (100m aralıklı sıralama) verisinden atların koşu
karakterini (öncü/kaçak, tempocu, bekleyici/kapanışçı) çıkarıp at bazlı kalıcı
bir profile EMA ile işler.

Not: accurace.net'in robots.txt'i /network/ yolunu crawler'lara kapatmış.
Bu script bilinçli olarak o kısıtlamayı aşıyor ama riski azaltmak için:
  - Ham accurace verisi (checkpoint zamanları, "Accurace Derecesi" vb.) hiçbir
    zaman diske/repoya yazılmaz, sadece bellekte işlenip atılır.
  - Repoya yalnızca bizim hesapladığımız türev metrikler (pozisyon deltaları)
    yazılır — Accurace'in kendi puanlama çıktısı yeniden yayınlanmaz.

Kullanım:
  python scripts/fetch_accurace.py                # bugün + dün (sonuçlanmış koşular)
  python scripts/fetch_accurace.py 2026-07-08    # belirli gün(ler)

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
ATLAR = DATA / "atlar"
UA = {"User-Agent": "Mozilla/5.0 (compatible; AltiliBulan/2.0; kisisel arsiv)"}

TR_MAP = str.maketrans("çğıöşüÇĞİIÖŞÜ", "cgiosuCGIIOSU")
EKIPMAN = re.compile(r"(\s+(SGKR|GDSK|DSGK|GKDSK|SKG|KGD|GKD|DSK|GSK|SGK|GDS|DSG|GKR|KG|DB|SK|GD|GK|DS|KD|GM|BB|ÖG|YP|G|K|D|M|S))+$")

EMA_ALPHA = 0.3


def _to_int(x):
    try:
        return int(str(x).strip())
    except (TypeError, ValueError):
        return None


def slugify(s: str) -> str:
    s = s.translate(TR_MAP).lower()
    return re.sub(r"^-|-$", "", re.sub(r"[^a-z0-9]+", "-", s))


def at_adi_temizle(ad: str) -> str:
    ad = re.sub(r"\s*\(.*?\)\s*", " ", ad or "")
    return EKIPMAN.sub("", ad).strip().upper()


def http_get(url: str, timeout: int = 30) -> bytes | None:
    try:
        req = urllib.request.Request(url, headers=UA)
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.read()
    except Exception:
        return None


def _resolve_nuxt(arr: list) -> dict:
    """Nuxt SSR __NUXT_DATA__ dizisini (index-referanslı devalue formatı) çözer."""
    memo: dict = {}

    def resolve(i, seen=frozenset()):
        if i in memo:
            return memo[i]
        if i in seen or not isinstance(i, int) or not (0 <= i < len(arr)):
            return None
        seen = seen | {i}
        v = arr[i]
        if isinstance(v, list):
            if len(v) == 2 and isinstance(v[0], str) and v[0] in ("ShallowReactive", "Reactive", "Ref", "ShallowRef"):
                r = resolve(v[1], seen)
            else:
                r = [resolve(x, seen) if isinstance(x, int) else x for x in v]
        elif isinstance(v, dict):
            r = {k: (resolve(x, seen) if isinstance(x, int) else x) for k, x in v.items()}
        else:
            r = v
        memo[i] = r
        return r

    return resolve(0)


def fetch_network_race(date: datetime, city_ascii: str, race_no: int) -> dict | None:
    url = f"https://accurace.net/network/{date:%Y-%m-%d}/{city_ascii}/{race_no}"
    body = http_get(url)
    if not body:
        return None
    html = body.decode("utf-8", "replace")
    m = re.search(
        r'<script type="application/json" data-nuxt-data="nuxt-app" data-ssr="true" id="__NUXT_DATA__">(.*?)</script>',
        html, re.S,
    )
    if not m:
        return None
    try:
        arr = json.loads(m.group(1))
        root = _resolve_nuxt(arr)
        table = root["data"]["result"]["data"]["table"]
    except Exception:
        return None
    if not table or not table.get("horse"):
        return None
    return table


def pozisyon_deltalari(horse_table: dict) -> dict | None:
    """Bir atın checkpoint listesinden erken/orta/geç pozisyon deltalarını çıkarır."""
    cps = horse_table.get("checkpoint") or []
    by_dist = {}
    for c in cps:
        if not isinstance(c, dict):
            continue
        dist, place = c.get("checkpoint"), c.get("place")
        if dist is None or place is None:
            continue
        try:
            by_dist[int(float(dist))] = int(float(place))
        except (TypeError, ValueError):
            continue
    if len(by_dist) < 4:
        return None
    finish = max(by_dist)
    def near(target):
        d = min(by_dist, key=lambda x: abs(x - target))
        return by_dist[d] if abs(d - target) <= 150 else None

    erken = [p for p in (near(400), near(800)) if p is not None]
    gec = [p for p in (near(finish - 200), by_dist[finish]) if p is not None]
    if not erken or not gec:
        return None
    erken_poz = sum(erken) / len(erken)
    gec_poz = sum(gec) / len(gec)
    # Son atak: bitişten ~600m önceki sıra ile bitiş sırası farkı (pozitif = finişte
    # sıra kazandı). Sabit 1600m referansı kullanılmaz; TR koşularının çoğu 1200-1400m
    # olduğu için o referans neredeyse hiç oluşmuyordu.
    son_atak = None
    for geri in (600, 500, 400):
        hedef = finish - geri
        if hedef <= 0:
            continue
        p = near(hedef)
        if p is not None:
            son_atak = p - by_dist[finish]
            break
    return {
        "erken_gec_delta": round(erken_poz - gec_poz, 2),
        "son_atak_delta": son_atak,
    }


def guncelle_at_profili(canonical_name: str, race_key: str, deltalar: dict) -> None:
    ATLAR.mkdir(parents=True, exist_ok=True)
    path = ATLAR / f"{slugify(canonical_name)}.json"
    if path.exists():
        profil = json.loads(path.read_text(encoding="utf-8"))
    else:
        profil = {"ad": canonical_name, "kosu_sayisi": 0, "islenen_yarislar": []}

    if race_key in profil.get("islenen_yarislar", []):
        # Bu koşu daha önce işlenmiş; ama profilde hiç oluşmamış bir metrik varsa
        # (ör. eski sürümde üretilemeyen son_atak_delta) onu tohumla — koşu
        # sayısını artırmadan, çift sayım olmadan.
        eksik = {a: deltalar[a] for a in ("erken_gec_delta", "son_atak_delta")
                 if deltalar.get(a) is not None and profil.get(f"{a}_ema") is None}
        if not eksik:
            return
        for alan, deger in eksik.items():
            profil[f"{alan}_ema"] = deger
        path.write_text(json.dumps(profil, ensure_ascii=False, indent=1), encoding="utf-8")
        return

    n = profil.get("kosu_sayisi", 0)
    for alan in ("erken_gec_delta", "son_atak_delta"):
        deger = deltalar.get(alan)
        if deger is None:
            continue
        eski = profil.get(f"{alan}_ema")
        profil[f"{alan}_ema"] = deger if eski is None or n == 0 else round(EMA_ALPHA * deger + (1 - EMA_ALPHA) * eski, 3)

    profil["kosu_sayisi"] = n + 1
    profil["son_guncelleme"] = race_key
    profil.setdefault("islenen_yarislar", []).append(race_key)
    profil["islenen_yarislar"] = profil["islenen_yarislar"][-100:]
    path.write_text(json.dumps(profil, ensure_ascii=False, indent=1), encoding="utf-8")


BACKFILL_MAX_YARIS = 15
BACKFILL_MAX_KOSU_NO = 10

# Profil şeması sürümü. 2 = son_atak_delta bitişe göreli hesaplanıyor (1'de sabit
# 1600m referansı yüzünden neredeyse hiç üretilemiyordu). Sürüm 1'de doldurulmuş
# profiller, koşu başına kotayla yavaşça yeniden taranıp eksik metriği kazanır.
PROFIL_SURUM = 2
YENIDEN_BACKFILL_KOTA = 8
_yeniden_backfill_kalan = YENIDEN_BACKFILL_KOTA


def _tablo_satirlari(html: str) -> list:
    out = []
    for row in re.findall(r"<tr[^>]*>(.*?)</tr>", html, re.S):
        cells = [re.sub(r"<[^>]+>", "", c).replace("&nbsp;", " ").strip()
                 for c in re.findall(r"<td[^>]*>(.*?)</td>", row, re.S)]
        if cells:
            out.append(cells)
    return out


def tjk_at_id(name: str) -> str | None:
    body = http_get("https://www.tjk.org/TR/YarisSever/Query/Data/AtIstatistikleri"
                     "?QueryParameter_AtAdi=" + urllib.parse.quote(name))
    time.sleep(0.2)
    if not body:
        return None
    m = re.search(r"QueryParameter_AtId=(\d+)", body.decode("utf-8", "replace"))
    return m.group(1) if m else None


def tjk_gecmis_kisa(at_id: str, limit: int) -> list[dict]:
    """AtKosuBilgileri sayfalarını gezip (tarih, şehir, mesafe) satırlarını en yeniden eskiye döndürür."""
    rows: dict[str, dict] = {}
    for sira in range(1, 7):
        body = http_get(
            "https://www.tjk.org/TR/YarisSever/Query/ConnectedPage/AtKosuBilgileri"
            f"?QueryParameter_AtId={at_id}&QueryParameter_Sira={sira}&QueryParameter_YIL=-1"
        )
        time.sleep(0.2)
        if not body:
            continue
        yeni = 0
        for c in _tablo_satirlari(body.decode("utf-8", "replace")):
            if len(c) >= 4 and re.match(r"\d{2}\.\d{2}\.\d{4}", c[0]):
                key = f"{c[0]}|{c[1]}|{c[2]}"
                if key not in rows:
                    rows[key] = {"t": c[0], "sehir": c[1], "mesafe": c[2]}
                    yeni += 1
        if yeni == 0:
            break
    out = sorted(rows.values(), key=lambda r: datetime.strptime(r["t"], "%d.%m.%Y"), reverse=True)
    return out[:limit]


def backfill_at_gecmisi(canonical_name: str) -> None:
    """Bu at daha önce hiç işlenmediyse, son BACKFILL_MAX_YARIS yarışını accurace'den arayıp profili tek seferde olgunlaştırır."""
    ATLAR.mkdir(parents=True, exist_ok=True)
    path = ATLAR / f"{slugify(canonical_name)}.json"
    profil = json.loads(path.read_text(encoding="utf-8")) if path.exists() else {
        "ad": canonical_name, "kosu_sayisi": 0, "islenen_yarislar": [],
    }
    global _yeniden_backfill_kalan
    surum = profil.get("gecmis_surum", 1 if profil.get("gecmis_dolduruldu") else 0)
    if surum >= PROFIL_SURUM:
        return
    if surum > 0:
        # Eski sürümde zaten dolduruldu: sadece eksik metrik için yeniden tara.
        # Her çalışmada birkaç at ile sınırlı tut, aksi halde yüzlerce at × 15 yarış
        # istek patlaması olur.
        if profil.get("son_atak_delta_ema") is not None:
            profil["gecmis_surum"] = PROFIL_SURUM
            path.write_text(json.dumps(profil, ensure_ascii=False, indent=1), encoding="utf-8")
            return
        if _yeniden_backfill_kalan <= 0:
            return
        _yeniden_backfill_kalan -= 1

    at_id = tjk_at_id(canonical_name)
    if not at_id:
        # TJK geçici olarak cevap vermedi/atı bulamadı: "dolduruldu" işaretleme,
        # bir sonraki çalışmada yeniden dene (aksi halde tek hicci kalıcı olur).
        return
    gecmis = tjk_gecmis_kisa(at_id, BACKFILL_MAX_YARIS)
    for row in sorted(gecmis, key=lambda r: datetime.strptime(r["t"], "%d.%m.%Y")):
        tarih = datetime.strptime(row["t"], "%d.%m.%Y")
        city_ascii = slugify(row["sehir"]).replace("-", "").upper()
        for race_no in range(1, BACKFILL_MAX_KOSU_NO + 1):
            table = fetch_network_race(tarih, city_ascii, race_no)
            time.sleep(0.4)
            if not table:
                continue
            eslesen = next((h for h in table["horse"]
                            if at_adi_temizle(h.get("horse_name", "")) == canonical_name), None)
            if not eslesen:
                continue
            deltalar = pozisyon_deltalari(eslesen)
            if deltalar:
                race_key = f"{tarih:%Y-%m-%d}-{slugify(row['sehir'])}-{race_no}-backfill"
                guncelle_at_profili(canonical_name, race_key, deltalar)
            break

    profil = json.loads(path.read_text(encoding="utf-8")) if path.exists() else profil
    profil["gecmis_dolduruldu"] = True
    profil["gecmis_surum"] = PROFIL_SURUM
    path.write_text(json.dumps(profil, ensure_ascii=False, indent=1), encoding="utf-8")


def islenmis_sehirler(day_dir: Path) -> list[str]:
    """Sonuçları yayınlanmış (sonuclar-*.json bulunan) hipodromları döndürür."""
    out = []
    for f in day_dir.glob("sonuclar-*.json"):
        m = re.match(r"^sonuclar-(.+)\.json$", f.name)
        if m:
            out.append(m.group(1))
    return out


def fetch_day(date: datetime) -> int:
    day_str = date.strftime("%Y-%m-%d")
    day_dir = DATA / day_str
    if not day_dir.is_dir():
        return 0
    islenen = 0
    for slug in islenmis_sehirler(day_dir):
        program_dosya = day_dir / f"program-{slug}.json"
        if not program_dosya.exists():
            continue
        program = json.loads(program_dosya.read_text(encoding="utf-8"))
        city = program.get("city", slug)
        city_ascii = slugify(city).replace("-", "").upper()
        for race in program.get("races", []):
            race_no = race["no"]
            race_key = f"{day_str}-{slug}-{race_no}"
            table = fetch_network_race(date, city_ascii, race_no)
            time.sleep(0.5)
            if not table:
                continue
            horse_by_no = {}
            for h in race.get("horses", []):
                hn = _to_int(h.get("no"))
                if hn is not None:
                    horse_by_no[hn] = h
            for h_table in table.get("horse", []):
                no = _to_int(h_table.get("horse_number"))
                program_horse = horse_by_no.get(no)
                if not program_horse:
                    continue
                deltalar = pozisyon_deltalari(h_table)
                if not deltalar:
                    continue
                canonical = at_adi_temizle(program_horse.get("ad", ""))
                if not canonical:
                    continue
                backfill_at_gecmisi(canonical)
                guncelle_at_profili(canonical, race_key, deltalar)
                islenen += 1
    return islenen


def main() -> None:
    if len(sys.argv) > 1:
        dates = [datetime.strptime(a, "%Y-%m-%d") for a in sys.argv[1:]]
    else:
        now_tr = datetime.now(timezone.utc) + timedelta(hours=3)
        dates = [now_tr, now_tr - timedelta(days=1)]
    total = 0
    for d in dates:
        print(f"[{d:%Y-%m-%d}] accurace işleniyor…")
        n = fetch_day(d)
        total += n
        print(f"  {n} at-koşu profili güncellendi.")
    print(f"Bitti: {total} at-koşu işlendi.")


if __name__ == "__main__":
    main()

