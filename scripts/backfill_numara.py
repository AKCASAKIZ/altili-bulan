#!/usr/bin/env python3
"""Arşivdeki atların GERÇEK yarış numarasını program CSV'sinden geriye doldurur.

Neden gerekiyor
---------------
Arşiv, TJK'nın günlük SONUÇ CSV'sinden kuruldu. O dosyanın "At No" başlıklı
kolonu atın numarası DEĞİL, bitiş sırası — 09.05.2022 Bursa 4. koşuda ÇAKIRCALI
sonuçta "3", programda "6" görünüyor. Ayrıştırıcı doğru kolonu okuyor, kaynakta
numara yok. Numara yalnızca PROGRAM CSV'sinde (GunlukYarisProgrami) var.

Altılı numarayla oynandığı için bu alan lazım; bitiş sırası zaten `sira`da.

Eşleme `st` (kulvar) üzerinden
-----------------------------
İki dosyada da `st` aynı ve koşu içinde tekil. İsim eşlemesi gerekmiyor:
isimler ekipman ekleriyle ("KG DB SK") geliyor ve iki dosyada farklı olabiliyor,
kulvar ise ham sayı. Kulvar bulunamazsa isme düşülür, o da yoksa at atlanır
ve rapora yazılır.

Kullanım
--------
    python3 scripts/backfill_numara.py                 # tüm arşiv
    python3 scripts/backfill_numara.py --ay 2022-05    # tek ay
    python3 scripts/backfill_numara.py --dene          # indir, yazma

Tekrar çalıştırılabilir: işi biten şehir-günü `"nv": 1` ile işaretlenir ve
sonraki koşuda atlanır. Yarıda kesilirse kaldığı yerden devam eder.
"""

import argparse
import json
import re
import subprocess
import sys
import time
import urllib.parse
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from fetch_tjk import parse_csv                      # noqa: E402

KOK = Path(__file__).parent.parent
ARSIV = KOK / "data" / "arsiv"
SEMA_NUMARA = 1                                      # "nv" alanı
ARALIK = 0.35                                        # istekler arası saniye


def prog_url(iso: str, sehir: str) -> str:
    d = datetime.strptime(iso, "%Y-%m-%d")
    t = "GunlukYarisProgrami"
    return ("https://medya-cdn.tjk.org/raporftp/TJKPDF/"
            f"{d:%Y}/{d:%Y-%m-%d}/CSV/{t}/"
            + urllib.parse.quote(f"{d:%d.%m.%Y}-{sehir}-{t}-TR.csv"))


def indir(url: str) -> str | None:
    """backfill_arsiv.py ile aynı yaklaşım: curl, yerel SSL derdinden etkilenmez."""
    for deneme in range(3):
        try:
            r = subprocess.run(["curl", "-sf", "--max-time", "30", url],
                               capture_output=True, timeout=40)
            if r.returncode == 0 and r.stdout:
                return r.stdout.decode("utf-8-sig", errors="replace")
        except Exception:
            pass
        time.sleep(1.5 * (deneme + 1))               # üstel geri çekilme
    return None


def anahtar(s) -> str:
    """'11 - DS' ve ' 11-DS ' aynı kulvar sayılsın."""
    return re.sub(r"\s+", "", str(s or "")).upper()


EKIPMAN = re.compile(r"(\s+(SGKR|GDSK|DSGK|GKDSK|SKG|KGD|GKD|DSK|GSK|SGK|GDS|DSG"
                     r"|GKR|KG|DB|SK|GD|GK|DS|KD|GM|BB|ÖG|YP|G|K|D|M|S))+$")


def ad_anahtar(ad: str) -> str:
    return re.sub(r"\s+", " ", EKIPMAN.sub("", (ad or "").upper())).strip()


def gun_isle(gun: dict, iso: str, dene: bool) -> tuple[int, int, str]:
    """Bir şehir-gününü işler. (düzeltilen, eşleşmeyen, durum) döner."""
    sehir = gun.get("sehir") or ""
    ham = indir(prog_url(iso, sehir))
    if not ham:
        return 0, 0, "program CSV yok"
    try:
        prog = parse_csv(ham)
    except Exception as e:
        return 0, 0 , f"ayrıştırma hatası: {e}"

    # koşu no -> {kulvar: numara}, {ad: numara}
    kulvar_map, ad_map = {}, {}
    for r in prog.get("races", []):
        kn = r.get("no")
        kulvar_map[kn] = {anahtar(h.get("st")): h.get("no")
                          for h in r.get("horses", []) if h.get("st")}
        ad_map[kn] = {ad_anahtar(h.get("ad")): h.get("no")
                      for h in r.get("horses", []) if h.get("ad")}

    duzeltildi = eslesmedi = 0
    for k in gun.get("kosular", []):
        kv = kulvar_map.get(k.get("no"), {})
        am = ad_map.get(k.get("no"), {})
        for a in k.get("atlar", []):
            numara = kv.get(anahtar(a.get("st"))) or am.get(ad_anahtar(a.get("ad")))
            if numara:
                if not dene:
                    a["no"] = numara
                duzeltildi += 1
            else:
                eslesmedi += 1
    if not dene and duzeltildi:
        gun["nv"] = SEMA_NUMARA
    return duzeltildi, eslesmedi, "ok"


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--ay", help="yalnız bu ay (YYYY-MM)")
    ap.add_argument("--dene", action="store_true", help="indir ama dosyaya yazma")
    a = ap.parse_args()

    dosyalar = sorted(ARSIV.glob("[0-9]*.json"))
    if a.ay:
        dosyalar = [p for p in dosyalar if p.stem == a.ay]
        if not dosyalar:
            raise SystemExit(f"{a.ay} bulunamadı")

    t0 = time.time()
    top_gun = top_at = top_eksik = 0
    sorunlu: list[str] = []

    for p in dosyalar:
        v = json.loads(p.read_text(encoding="utf-8"))
        degisti = False
        ay_at = ay_gun = 0
        for iso in sorted(v):
            for gun in v[iso]:
                if gun.get("nv") == SEMA_NUMARA:          # zaten yapılmış
                    continue
                d, e, durum = gun_isle(gun, iso, a.dene)
                time.sleep(ARALIK)
                if durum != "ok" or (e and not d):
                    sorunlu.append(f"{iso} {gun.get('sehir')}: {durum}"
                                   + (f" ({e} at eşleşmedi)" if e else ""))
                if d:
                    degisti = True; ay_at += d; ay_gun += 1
                top_eksik += e
        top_gun += ay_gun; top_at += ay_at
        if degisti and not a.dene:
            p.write_text(json.dumps(v, ensure_ascii=False), encoding="utf-8")
        print(f"{p.stem}: {ay_gun} şehir-günü, {ay_at} at"
              + ("  [dene]" if a.dene else ""), flush=True)

    dk = (time.time() - t0) / 60
    print(f"\nTOPLAM: {top_gun} şehir-günü · {top_at} at numarası yazıldı "
          f"· {top_eksik} eşleşmedi · {dk:.1f} dk")
    if sorunlu:
        print(f"\nSorunlu {len(sorunlu)} gün (ilk 15):")
        for s in sorunlu[:15]:
            print("  " + s)


if __name__ == "__main__":
    main()
