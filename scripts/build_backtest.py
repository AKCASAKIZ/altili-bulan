#!/usr/bin/env python3
"""Arşivden backtest'e hazır koşu dosyaları üretir.

Sorun: backtest yalnızca `data/{gün}/program-*.json` + `sonuclar-*.json`
çiftiyle çalışıyordu, o çift de günlük cron'un başladığı tarihten beri var
(~29 gün / 510 koşu). Oysa `data/arsiv/{YYYY-MM}.json` 2021'den beri ~31.790
koşu tutuyor ve puanlama için gereken alanların çoğunu (jokey, kilo, AGF,
handikap, kulvar, sahip, antrenör) zaten taşıyor.

Eksik olan üç alan programdan gelir ve arşivde yok: kgs (son koşudan bu yana
geçen gün), son6 (son 6 derece) ve eniyi (en iyi derece). Üçü de atın kendi
geçmişinden türetilebilir — bu script kronolojik ilerleyip her koşu için
YALNIZCA o güne kadar bilinenlerden türetir, yani geleceği sızdırmaz.

Çıktı: data/arsiv/backtest/{yıl}.json  (+ index.json)

Kullanım:
    python3 scripts/build_backtest.py            # tümü
    python3 scripts/build_backtest.py 2025 2026  # yalnız bu yıllar
"""
from __future__ import annotations

import json
import re
import sys
from collections import defaultdict
from datetime import date
from pathlib import Path

KOK = Path(__file__).resolve().parent.parent
ARSIV = KOK / "data" / "arsiv"
CIKTI = ARSIV / "backtest"

DERECE = re.compile(r"(\d+):(\d+)\.(\d+)")


def derece_sn(s: str) -> float | None:
    """'1:06.96' -> 66.96 saniye."""
    m = DERECE.search(s or "")
    if not m:
        return None
    return int(m.group(1)) * 60 + int(m.group(2)) + int(m.group(3)) / 100


def sn_derece(v: float) -> str:
    """66.96 -> '1:06.96' (programdaki 'En iyi derece' biçimi)."""
    dk = int(v // 60)
    kalan = v - dk * 60
    return f"{dk}:{kalan:05.2f}"


def iso(g: str) -> date:
    y, a, gn = g.split("-")
    return date(int(y), int(a), int(gn))


def temizle(ad: str) -> str:
    """app.js'teki temizle() ile aynı niyet: at adını ek harflerden arındır."""
    return re.sub(r"\s+", " ", (ad or "").strip()).upper()


def main() -> None:
    yillar = set(sys.argv[1:])
    aylar = sorted(p for p in ARSIV.glob("*.json") if re.fullmatch(r"\d{4}-\d{2}", p.stem))
    if not aylar:
        sys.exit("arşiv bulunamadı: " + str(ARSIV))

    # at adı -> [(tarih, sıra, derece_sn, mesafe)] — yalnız İŞLENMİŞ günlerden birikir
    gecmis: dict[str, list[tuple[date, int, float | None, str]]] = defaultdict(list)
    yil_kosulari: dict[str, list] = defaultdict(list)
    toplam = 0

    for ay_dosya in aylar:
        ay = json.loads(ay_dosya.read_text(encoding="utf-8"))
        for gun in sorted(ay):
            g = iso(gun)
            gunun_kayitlari = []  # bu günün koşuları geçmişe SONRA eklenir
            for sehir_kaydi in ay[gun]:
                sehir = sehir_kaydi.get("sehir", "")
                for k in sehir_kaydi.get("kosular", []):
                    bu_mesafe = k.get("mesafe", "")
                    atlar = []
                    for h in k.get("atlar", []):
                        ad = temizle(h.get("ad", ""))
                        onceki = gecmis.get(ad, [])
                        # kgs: son koşudan bu yana geçen gün
                        kgs = str((g - onceki[-1][0]).days) if onceki else ""
                        # son6: son 6 koşunun bitiş sırası (10+ -> '0', app.js öyle okur)
                        son6 = "".join(
                            str(s % 10) for _, s, _, _ in onceki[-6:]
                        )
                        # eniyi: TJK programındaki alan BU MESAFEDEKİ en iyi derecedir
                        # (2000 m koşusunda tüm değerler 2:2x çıkıyor), o yüzden
                        # mesafe eşleşmeyen koşular hesaba katılmaz.
                        dereceler = [d for _, _, d, m in onceki if d and m == bu_mesafe]
                        eniyi = sn_derece(min(dereceler)) if dereceler else ""
                        atlar.append({
                            "no": h.get("no"), "ad": h.get("ad", ""),
                            "kgs": kgs, "son6": son6, "eniyi": eniyi,
                            "agf": h.get("agf", ""), "h": h.get("h", ""),
                            "jokey": h.get("jokey", ""), "sahip": h.get("sahip", ""),
                            "antrenor": h.get("antrenor", ""), "kilo": h.get("kilo", ""),
                            "st": h.get("st", ""), "yas": h.get("yas", ""),
                            "sira": h.get("sira"), "ganyan": h.get("ganyan", ""),
                            "derece": h.get("derece", ""),
                        })
                        gunun_kayitlari.append((ad, h.get("sira"), derece_sn(h.get("derece", "")), bu_mesafe))

                    if len(atlar) < 2:
                        continue
                    yil_kosulari[gun[:4]].append({
                        "gun": gun, "sehir": sehir, "no": k.get("no"),
                        "mesafe": k.get("mesafe", ""), "pist": k.get("pist", ""),
                        "ikramiye": k.get("ikramiye", ""), "grup": k.get("grup", ""),
                        "tur": k.get("tur", ""),
                        "atlar": atlar,
                    })
                    toplam += 1

            # Gün bittikten SONRA geçmişe yaz — aynı gün içindeki koşular
            # birbirinin sonucunu görmesin.
            for ad, sira, dsn, mes in gunun_kayitlari:
                if isinstance(sira, int):
                    gecmis[ad].append((g, sira, dsn, mes))

        print(f"  {ay_dosya.stem}: toplam {toplam} koşu", flush=True)

    CIKTI.mkdir(parents=True, exist_ok=True)
    if yillar:
        yil_kosulari = {y: v for y, v in yil_kosulari.items() if y in yillar}
    index = {}
    for yil, kosular in sorted(yil_kosulari.items()):
        hedef = CIKTI / f"{yil}.json"
        hedef.write_text(json.dumps(kosular, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        mb = hedef.stat().st_size / 1024 / 1024
        index[yil] = {"kosu": len(kosular), "mb": round(mb, 1)}
        print(f"{hedef.name}: {len(kosular)} koşu · {mb:.1f} MB")

    (CIKTI / "index.json").write_text(
        json.dumps(index, ensure_ascii=False, indent=1), encoding="utf-8"
    )
    print(f"\nToplam {sum(v['kosu'] for v in index.values())} koşu yazıldı.")


if __name__ == "__main__":
    main()
