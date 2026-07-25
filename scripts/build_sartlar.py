#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
G2 kriteri icin SART PROFILLERI uretir: data/arsiv/sartlar.json

Arsivdeki (data/arsiv/YYYY-MM.json) tum kosulari, kosu sartina gore gruplayip
her grupta KAZANAN atlarin profilini cikarir:
    kilo, kulvar (st), yas, ganyan  ->  yuzdelikler (q10,q25,q50,q75,q90)

Web arayuzu (app.js, G2) bugunku atin ayni dort ozelligini bu bantlarla
karsilastirir: bant icindeyse tam, genis bantta yarim puan; yakinlik oranina
gore 100 / 80 / 60 verir.

NOT: SONUC CSV'sinde "At No" kolonu atin numarasini DEGIL bitis sirasini
tutuyor (kazananda hep 1). Atin gercek numarasi/kulvari `st` kolonunda; bu
yuzden "kacinci at" ile "kulvar" tek alandir ve bir kez sayilir.

Sart anahtari 4 seviyede uretilir; istemci en dardan baslayip yeterli ornek
bulana kadar geriye duser:
    1) irk|yas|cins(+Disi)|mesafe|pist      ornek: Arap|4+|Handikap-D|2000|Kum
    2) irk|cins|mesafe|pist
    3) irk|cins|mesafeGrubu|pist
    4) irk|mesafeGrubu|pist

Kullanim:
  python scripts/build_sartlar.py                 # data/arsiv
  python scripts/build_sartlar.py <arsiv_klasoru> # test icin baska klasor
"""
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

BASE = Path(__file__).resolve().parent.parent
ARSIV = Path(sys.argv[1]) if len(sys.argv) > 1 else BASE / "data" / "arsiv"
CIKTI = ARSIV / "sartlar.json"

MIN_ORNEK = 5      # bu sayidan az kazanani olan anahtar yazilmaz
ORNEK_SAYI = 6     # anahtar basina saklanan son kazanan ornegi


def sayi(v) -> float | None:
    """'58,5' / '2,15' / '%12.4(2)' -> float (ilk sayi, virgul ondalik)."""
    if v is None:
        return None
    m = re.search(r"(\d+(?:[.,]\d+)?)", str(v))
    if not m:
        return None
    try:
        return float(m.group(1).replace(",", "."))
    except ValueError:
        return None


def irk(grup: str) -> str:
    return "Arap" if re.search(r"arap", grup or "", re.I) else "İngiliz"


def yas_sinifi(grup: str) -> str:
    m = re.match(r"\s*(\d+)\s*(ve\s+Yukar[ıi])?", grup or "", re.I)
    if not m:
        return "?"
    return f"{m.group(1)}+" if m.group(2) else f"{m.group(1)}y"


def kosu_cinsi(tur: str) -> str:
    t = (tur or "").upper()
    for anahtar, ad in (("MAIDEN", "Maiden"), ("HANDIKAP", "Handikap"),
                        ("HANDİKAP", "Handikap"), ("ŞARTLI", "Şartlı"),
                        ("SARTLI", "Şartlı"), ("SATIŞ", "Satış"), ("SATIS", "Satış"),
                        ("KV", "KV"), ("DENEME", "Deneme"), ("GRUP", "Grup")):
        if anahtar in t:
            return ad
    return (t.split("/")[0].split()[0].title() if t.strip() else "?")


def disi_mi(tur: str) -> bool:
    return bool(re.search(r"di[şs]i", tur or "", re.I))


def mesafe_grubu(m) -> str:
    v = sayi(m)
    if v is None:
        return "?"
    return "kisa" if v <= 1400 else "orta" if v <= 1900 else "uzun"


def anahtarlar(kosu: dict) -> list[str]:
    """Bir kosu icin en dardan genise dogru sart anahtarlari."""
    grup, tur = kosu.get("grup") or "", kosu.get("tur") or ""
    i = irk(grup)
    y = yas_sinifi(grup)
    c = kosu_cinsi(tur)
    cd = c + ("-D" if disi_mi(tur) else "")
    mv = sayi(kosu.get("mesafe"))
    m = str(int(mv)) if mv else "?"
    mg = mesafe_grubu(kosu.get("mesafe"))
    p = (kosu.get("pist") or "").strip().split()[0] if (kosu.get("pist") or "").strip() else "?"
    return [f"{i}|{y}|{cd}|{m}|{p}", f"{i}|{c}|{m}|{p}", f"{i}|{c}|{mg}|{p}", f"{i}|{mg}|{p}"]


def yuzdelik(vals: list[float], q: float) -> float:
    """Basit dogrusal interpolasyonlu yuzdelik (numpy yok)."""
    if not vals:
        return None
    s = sorted(vals)
    if len(s) == 1:
        return round(s[0], 2)
    idx = q * (len(s) - 1)
    lo, hi = int(idx), min(int(idx) + 1, len(s) - 1)
    return round(s[lo] + (s[hi] - s[lo]) * (idx - lo), 2)


def bant(vals: list[float]) -> list | None:
    vals = [v for v in vals if v is not None]
    if len(vals) < 3:
        return None
    return [yuzdelik(vals, q) for q in (0.10, 0.25, 0.50, 0.75, 0.90)]


def main() -> None:
    if not ARSIV.exists():
        print(f"Arsiv klasoru yok: {ARSIV}")
        return
    aylar = sorted(p for p in ARSIV.glob("*.json") if re.match(r"^\d{4}-\d{2}\.json$", p.name))
    if not aylar:
        print("Arsivde ay dosyasi yok.")
        return

    # anahtar -> {"kilo":[], "no":[], "st":[], "ganyan":[], "ornek":[]}
    kova: dict[str, dict] = {}
    kosu_sayisi = 0

    for ay in aylar:
        try:
            veri = json.loads(ay.read_text(encoding="utf-8"))
        except Exception as e:
            print(f"  ! {ay.name}: {e}")
            continue
        for tarih in sorted(veri):
            for gun in veri[tarih] or []:
                sehir = gun.get("sehir", "")
                for kosu in gun.get("kosular", []) or []:
                    atlar = kosu.get("atlar") or []
                    if not atlar:
                        continue
                    kazanan = next((a for a in atlar if a.get("sira") == 1), None)
                    if not kazanan or re.search(r"ko[sş]maz", kazanan.get("ad", ""), re.I):
                        continue
                    kosu_sayisi += 1
                    ornek = {
                        "t": tarih, "s": sehir, "ad": kazanan.get("ad", ""),
                        "st": kazanan.get("st"), "yas": kazanan.get("yas"),
                        "kilo": kazanan.get("kilo"), "ganyan": kazanan.get("ganyan"),
                        "agf": kazanan.get("agf"), "jokey": kazanan.get("jokey"),
                        "kadro": len(atlar),
                    }
                    for k in anahtarlar(kosu):
                        b = kova.setdefault(k, {"kilo": [], "st": [], "yas": [],
                                                "ganyan": [], "agf": [], "ornek": []})
                        b["kilo"].append(sayi(kazanan.get("kilo")))
                        b["st"].append(sayi(kazanan.get("st")))
                        b["yas"].append(sayi(kazanan.get("yas")))
                        b["ganyan"].append(sayi(kazanan.get("ganyan")))
                        # AGF yuzdesi ("%18.69(2)" -> 18.69): bugunku programda da
                        # ayni birim oldugu icin ganyandan daha durust bir kiyas.
                        b["agf"].append(sayi(kazanan.get("agf")))
                        b["ornek"].append(ornek)

    cikti = {}
    for k, b in kova.items():
        n = len(b["ornek"])
        if n < MIN_ORNEK:
            continue
        kayit = {"n": n}
        for alan in ("kilo", "st", "yas", "ganyan", "agf"):
            bnt = bant(b[alan])
            if bnt:
                kayit[alan] = bnt
        # ornekler: en yeni tarihliler (arsiv zaten tarih sirali islendi)
        kayit["ornek"] = b["ornek"][-ORNEK_SAYI:][::-1]
        cikti[k] = kayit

    out = {
        "uretim": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC"),
        "kosu": kosu_sayisi,
        "min_ornek": MIN_ORNEK,
        "anahtar": cikti,
    }
    CIKTI.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")),
                     encoding="utf-8")
    mb = CIKTI.stat().st_size / 1024 / 1024
    print(f"✓ {CIKTI.relative_to(BASE) if CIKTI.is_relative_to(BASE) else CIKTI}"
          f" — {kosu_sayisi} koşu, {len(cikti)} şart anahtarı, {mb:.2f} MB")


if __name__ == "__main__":
    main()
