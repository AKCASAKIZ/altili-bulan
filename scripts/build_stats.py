#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
data/arsiv/{YYYY-MM}.json dosyalarından puanlama algoritmasının (AGM kılavuzu)
kullanabileceği özet istatistikleri üretir → data/arsiv/stats.json

Üretilen istatistikler:
  jokey      : ad → [koşu, galibiyet, tabela]           (E1)
  antrenor   : ad → [koşu, galibiyet, tabela]           (E2)
  kulvar     : şehir|pist|mesafe_grubu → kulvar → [start, galibiyet]  (E3)
  sahip90    : son 90 günde ilk-3 puanı (1.→4, 2.→2, 3.→1) + eşikler  (A1)
  antrenor90 : aynı yapı, antrenörler için                (B16)
  sahip_son  : sahibin son koşan atı → [tarih, sıra]      (A2, A3)
  antrenor_son: antrenörün son koşan atı → [tarih, sıra]  (B17, B18)
  at         : at (temiz ad) → geçmiş özeti               (B1,B2,B3,B4,B5,B10,B11,B12,B14,B15)
               {n, w, kafa, bomba, ikr, mes, kilo, ekip, son6:[[tarih,sıra,ganyan,pist]…],
                pk: pist → [koşu, ilk3], mg: mesafe_grubu → [koşu, ilk3]}  (kariyer kırılımı, B2/B3)

Kullanım: python scripts/build_stats.py
"""
import json
import re
from pathlib import Path

BASE = Path(__file__).resolve().parent.parent
ARSIV = BASE / "data" / "arsiv"

MIN_JOKEY = 20     # bu sayının altında koşusu olan jokey/antrenör E1/E2 özetine girmez
MIN_KULVAR = 30    # kulvar hücresi için minimum start sayısı
GUN90 = 90         # A1/B16 "başarılı sahip/antrenör" listesinin penceresi (gün)
BOMBA_GANYAN = 10.0  # bu ganyan ve üstündeki galibiyet "sürpriz" sayılır (B11)

# app.js'teki temizle() ile aynı: ekipman eklerini attan ayır
EKIP_RE = re.compile(
    r"(\s+(SGKR|GDSK|DSGK|GKDSK|SKG|KGD|GKD|DSK|GSK|SGK|GDS|DSG|GKR|KG|DB|SK|GD|GK|DS|KD|GM|BB|ÖG|YP|G|K|D|M|S))+\s*$")
KAFA_RE = re.compile(r"baş|burun|boyun|yarım", re.I)


def temizle(ad: str) -> tuple[str, str]:
    """(temiz ad, ekipman eki) döndürür."""
    s = re.sub(r"\s*\(.*?\)\s*", " ", ad or "")
    m = EKIP_RE.search(s)
    ekip = m.group(0).strip() if m else ""
    return EKIP_RE.sub("", s).strip().upper(), ekip


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


def sayi(s: str) -> float | None:
    """'236.500 TL' → 236500, '60,5 +0.40' → 60.5"""
    mm = re.search(r"\d[\d.]*(?:,\d+)?", s or "")
    if not mm:
        return None
    return float(mm.group(0).replace(".", "").replace(",", "."))


def kilo_sayi(s: str) -> float | None:
    mm = re.match(r"\s*(\d+)(?:[.,](\d+))?", s or "")
    if not mm:
        return None
    return float(f"{mm.group(1)}.{mm.group(2) or 0}")


def gunint(iso: str) -> int:
    return int(iso.replace("-", ""))


def esikler(puanlar: list[float]) -> list[float]:
    """A1/B16 için 'üst sıra' (100p) ve 'orta sıra' (60p) puan eşikleri."""
    if not puanlar:
        return [999, 999]
    s = sorted(puanlar, reverse=True)
    ust = s[max(0, int(len(s) * 0.10) - 1)]
    orta = s[max(0, int(len(s) * 0.35) - 1)]
    return [max(ust, 3), max(orta, 2)]


def main() -> None:
    jokey: dict[str, list] = {}
    antrenor: dict[str, list] = {}
    kulvar: dict[str, dict] = {}
    sahip_son: dict[str, list] = {}
    antrenor_son: dict[str, list] = {}
    at: dict[str, dict] = {}
    ilk3: list[tuple] = []  # (günint, sahip, antrenör, sıra) — A1/B16 pencere hesabı için
    gun_sayisi, kosu_sayisi, son_gun = 0, 0, 0

    # kronolojik sırayla gez: "son koşu" alanları en güncel hâlde kalsın
    for f in sorted(ARSIV.glob("20*.json")):
        month = json.loads(f.read_text(encoding="utf-8"))
        for iso in sorted(month):
            gunler = month[iso]
            if gunler:
                gun_sayisi += 1
                son_gun = max(son_gun, gunint(iso))
            for g in gunler:
                sehir = g["sehir"]
                for r in g["kosular"]:
                    kosu_sayisi += 1
                    pist = (r.get("pist") or "?").split()[0]
                    mgrubu = mesafe_grubu(r.get("mesafe"))
                    key = f"{sehir}|{pist}|{mgrubu}"
                    cell = kulvar.setdefault(key, {})
                    ikr = sayi(r.get("ikramiye"))
                    mes = sayi(r.get("mesafe"))
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
                        if top3:
                            ilk3.append((gunint(iso), h.get("sahip"),
                                         h.get("antrenor"), h["sira"]))
                        if h.get("sahip"):
                            sahip_son[h["sahip"]] = [gunint(iso), h["sira"]]
                        if h.get("antrenor"):
                            antrenor_son[h["antrenor"]] = [gunint(iso), h["sira"]]

                        gt = gate_no(h.get("st"))
                        if gt and len(kostu) >= 6:
                            grec = cell.setdefault(str(gt), [0, 0])
                            grec[0] += 1
                            grec[1] += win

                        # at bazlı geçmiş özeti
                        adx, ekip = temizle(h.get("ad"))
                        if not adx:
                            continue
                        rec = at.setdefault(adx, {
                            "n": 0, "w": 0, "kafa": 0, "bomba": 0,
                            "ikr": None, "mes": None, "kilo": None,
                            "ekip": "", "son6": [], "pk": {}, "mg": {}})
                        rec["n"] += 1
                        rec["w"] += win
                        # kariyer kırılımı: pist ve mesafe grubu → [koşu, ilk3] (B2/B3)
                        for tbl, kk in ((rec["pk"], pist), (rec["mg"], mgrubu)):
                            c = tbl.setdefault(kk, [0, 0])
                            c[0] += 1
                            c[1] += top3
                        gany = sayi(h.get("ganyan"))
                        if win and h.get("fark") and KAFA_RE.search(h["fark"]):
                            rec["kafa"] += 1
                        if win and gany and gany >= BOMBA_GANYAN:
                            rec["bomba"] += 1
                        rec["ikr"] = ikr
                        rec["mes"] = mes
                        rec["kilo"] = kilo_sayi(h.get("kilo"))
                        rec["ekip"] = ekip
                        rec["son6"].append([gunint(iso), h["sira"], gany or 0, pist])
                        if len(rec["son6"]) > 6:
                            rec["son6"] = rec["son6"][-6:]

    # A1/B16: son 90 günün ilk-3 listeleri (1.→4p, 2.→2p, 3.→1p)
    from datetime import datetime, timedelta
    son_dt = datetime.strptime(str(son_gun), "%Y%m%d")
    kesim = int((son_dt - timedelta(days=GUN90)).strftime("%Y%m%d"))
    PUAN = {1: 4, 2: 2, 3: 1}
    sahip90: dict[str, float] = {}
    antrenor90: dict[str, float] = {}
    for gi, sah, ant, sira in ilk3:
        if gi < kesim:
            continue
        if sah:
            sahip90[sah] = sahip90.get(sah, 0) + PUAN[sira]
        if ant:
            antrenor90[ant] = antrenor90.get(ant, 0) + PUAN[sira]

    out = {
        "meta": {"gun": gun_sayisi, "kosu": kosu_sayisi, "son_gun": son_gun,
                 "min_jokey": MIN_JOKEY, "min_kulvar": MIN_KULVAR,
                 "pencere90": GUN90, "bomba_ganyan": BOMBA_GANYAN},
        "jokey": {a: v for a, v in jokey.items() if v[0] >= MIN_JOKEY},
        "antrenor": {a: v for a, v in antrenor.items() if v[0] >= MIN_JOKEY},
        "kulvar": {k: c for k, c in
                   (((k, {g: v for g, v in cell.items() if v[0] >= MIN_KULVAR})
                     for k, cell in kulvar.items())) if c},
        "sahip90": {"puan": sahip90, "esik": esikler(list(sahip90.values()))},
        "antrenor90": {"puan": antrenor90, "esik": esikler(list(antrenor90.values()))},
        "sahip_son": sahip_son,
        "antrenor_son": antrenor_son,
        "at": at,
    }

    dest = ARSIV / "stats.json"
    dest.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")),
                    encoding="utf-8")
    print(f"{dest.name}: {gun_sayisi} gün, {kosu_sayisi} koşu, "
          f"{len(out['jokey'])} jokey, {len(out['antrenor'])} antrenör, "
          f"{len(out['kulvar'])} kulvar hücresi, {len(at)} at, "
          f"{len(sahip90)} sahip (90g), boyut {dest.stat().st_size//1024} KB")


if __name__ == "__main__":
    main()
