#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
data/arsiv/{YYYY-MM}.json dosyalarından puanlama algoritmasının
kullanabileceği özet istatistikleri üretir → data/arsiv/stats.json

Üretilen istatistikler:
  jokey     : {koşu, galibiyet, tabela(ilk 3)} → kazanma/tabela yüzdesi
  antrenor  : aynı yapı
  kulvar    : şehir|pist|mesafe_grubu bazında start kulvarı → {start, galibiyet}
  sehir_pist: şehir|pist bazında toplam koşu sayısı (bağlam için)

Kullanım: python scripts/build_stats.py
"""
import json
import re
from pathlib import Path

BASE = Path(__file__).resolve().parent.parent
ARSIV = BASE / "data" / "arsiv"

MIN_JOKEY = 20     # bu sayının altında koşusu olan jokey/antrenör özete girmez
MIN_KULVAR = 30    # kulvar hücresi için minimum start sayısı


def mesafe_grubu(m: str) -> str:
    mm = re.search(r"(\d+)", m or "")
    if not mm:
        return "?"
    v = int(mm.group(1))
    if v <= 1400:
        return "kisa"
    if v <= 1900:
        return "orta"
    return "uzun"


def gate_no(st: str) -> int | None:
    mm = re.match(r"\s*(\d+)", st or "")
    return int(mm.group(1)) if mm else None


def main() -> None:
    jokey: dict[str, list] = {}    # ad -> [koşu, galibiyet, tabela]
    antrenor: dict[str, list] = {}
    kulvar: dict[str, dict] = {}   # "şehir|pist|grup" -> {gate: [start, win]}
    sehir_pist: dict[str, int] = {}
    gun_sayisi, kosu_sayisi = 0, 0

    for f in sorted(ARSIV.glob("20*.json")):
        month = json.loads(f.read_text(encoding="utf-8"))
        for iso, gunler in month.items():
            if gunler:
                gun_sayisi += 1
            for g in gunler:
                sehir = g["sehir"]
                for r in g["kosular"]:
                    kosu_sayisi += 1
                    pist = (r.get("pist") or "?").split()[0]
                    key = f"{sehir}|{pist}|{mesafe_grubu(r.get('mesafe'))}"
                    sehir_pist[f"{sehir}|{pist}"] = sehir_pist.get(f"{sehir}|{pist}", 0) + 1
                    cell = kulvar.setdefault(key, {})
                    kostu = [h for h in r["atlar"]
                             if h.get("derece") not in (None, "Koşmaz")]
                    for h in kostu:
                        win = 1 if h["sira"] == 1 else 0
                        top3 = 1 if h["sira"] <= 3 else 0
                        for tbl, ad in ((jokey, h.get("jokey")),
                                        (antrenor, h.get("antrenor"))):
                            if ad:
                                rec = tbl.setdefault(ad, [0, 0, 0])
                                rec[0] += 1
                                rec[1] += win
                                rec[2] += top3
                        gt = gate_no(h.get("st"))
                        if gt and len(kostu) >= 6:  # küçük kadrolar kulvarı anlamsızlaştırır
                            grec = cell.setdefault(str(gt), [0, 0])
                            grec[0] += 1
                            grec[1] += win

    out = {
        "meta": {"gun": gun_sayisi, "kosu": kosu_sayisi,
                 "min_jokey": MIN_JOKEY, "min_kulvar": MIN_KULVAR},
        "jokey": {a: v for a, v in jokey.items() if v[0] >= MIN_JOKEY},
        "antrenor": {a: v for a, v in antrenor.items() if v[0] >= MIN_JOKEY},
        "kulvar": {k: {g: v for g, v in cell.items() if v[0] >= MIN_KULVAR}
                   for k, cell in kulvar.items()},
    }
    out["kulvar"] = {k: c for k, c in out["kulvar"].items() if c}

    dest = ARSIV / "stats.json"
    dest.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")),
                    encoding="utf-8")
    print(f"{dest.name}: {gun_sayisi} gün, {kosu_sayisi} koşu, "
          f"{len(out['jokey'])} jokey, {len(out['antrenor'])} antrenör, "
          f"{len(out['kulvar'])} kulvar hücresi")


if __name__ == "__main__":
    main()
