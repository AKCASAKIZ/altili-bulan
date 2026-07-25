#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Gun icindeki PROGRAM DEGISIKLIKLERINI izler (pist degisimi, mesafe degisimi,
saat kaymasi, kosmaz/cikan at, jokey-kilo degisikligi) ve:

  1) data/{gun}/program-{sehir}.json dosyasini gunceller,
  2) data/{gun}/degisiklik-{sehir}.json'a olay gunlugu yazar (web arayuzu bunu
     okuyup uyari serit gosterir + etkilenen kriterleri yeniden puanlar),
  3) telefona bildirim gonderir (ntfy.sh ve/veya Telegram).

Ornek: cok yagmur yagip cim kosular kuma alindiginda ve mesafeler
degistiginde, program CSV'si gun icinde TJK tarafinda guncellenir; bu script
onu yakalar.

Kullanim:
  python scripts/izle_program.py               # bugun (TR saati)
  python scripts/izle_program.py 2026-07-25    # belirli gun
  python scripts/izle_program.py --kuru        # yazma/bildirim yok, sadece rapor

Bildirim icin ortam degiskenleri (hicbiri zorunlu degil):
  NTFY_TOPIC        ntfy.sh konu adi (ornek: altili-bulan-tunc-7f3a)
  NTFY_SERVER       varsayilan https://ntfy.sh
  TELEGRAM_TOKEN    BotFather'dan alinan bot token'i
  TELEGRAM_CHAT_ID  bildirimin gidecegi sohbet id'si

Sadece standart kutuphane kullanir.
"""
import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from fetch_tjk import (  # noqa: E402  (ayni klasordeki cekici ile ayni ayristiriciyi kullanir)
    DATA, at_adi_temizle, csv_url, get_cities, http_get, parse_csv, slugify,
)

KURU = "--kuru" in sys.argv
KOSMAZ = re.compile(r"ko[sş]maz", re.I)

# Program degisiminden ETKILENEN otomatik kriterler: pist/mesafe degisince bu
# hucreler artik yanlistir, arayuz bunlari silip yeniden hesaplar.
ETKILENEN = {
    "pist": ["B2", "B3", "B6", "B9", "E3"],
    "mesafe": ["B2", "B3", "B6", "B9", "E3"],
    "kadro": ["G1", "B5", "B6", "B13", "D1", "D2", "E1", "E2", "E3"],
    "jokey": ["C1", "C2", "C3", "E1"],
    "kilo": [],
    "saat": [],
    "tur": [],
    "grup": [],
    "ikramiye": ["B1"],
}


def now_tr() -> datetime:
    return datetime.now(timezone.utc) + timedelta(hours=3)


def norm(v) -> str:
    return re.sub(r"\s+", " ", str(v or "")).strip()


def at_haritasi(race: dict) -> dict:
    """At No -> at kaydi."""
    return {int(h.get("no") or 0): h for h in race.get("horses", []) if h.get("no")}


def kosuyu_karsilastir(eski: dict, yeni: dict) -> list[dict]:
    """Tek bir kosunun eski/yeni halini karsilastirip olay listesi uretir."""
    olaylar = []
    no = yeni.get("no")

    def ekle(tip, alan, e, y, metin):
        olaylar.append({"kosu": no, "tip": tip, "alan": alan,
                        "eski": e, "yeni": y, "metin": metin})

    for alan, etiket in (("pist", "Pist"), ("mesafe", "Mesafe"),
                         ("saat", "Saat"), ("tur", "Tur"), ("grup", "Grup"),
                         ("ikramiye", "İkramiye")):
        e, y = norm(eski.get(alan)), norm(yeni.get(alan))
        if e != y and (e or y):
            ekle(alan, alan, e, y, f"{no}. Koşu: {etiket} {e or '—'} → {y or '—'}")

    e_at, y_at = at_haritasi(eski), at_haritasi(yeni)
    for at_no in sorted(set(e_at) | set(y_at)):
        e, y = e_at.get(at_no), y_at.get(at_no)
        if e and not y:
            ekle("kadro", "at", norm(e.get("ad")), None,
                 f"{no}. Koşu: {norm(e.get('ad'))} ({at_no}) programdan çıkarıldı")
            continue
        if y and not e:
            ekle("kadro", "at", None, norm(y.get("ad")),
                 f"{no}. Koşu: {norm(y.get('ad'))} ({at_no}) programa eklendi")
            continue
        e_kosmaz, y_kosmaz = bool(KOSMAZ.search(e.get("ad", ""))), bool(KOSMAZ.search(y.get("ad", "")))
        if y_kosmaz and not e_kosmaz:
            ekle("kadro", "kosmaz", norm(e.get("ad")), norm(y.get("ad")),
                 f"{no}. Koşu: {at_adi_temizle(e.get('ad'))} ({at_no}) KOŞMAZ")
            continue
        if e_kosmaz and not y_kosmaz:
            ekle("kadro", "kosmaz", norm(e.get("ad")), norm(y.get("ad")),
                 f"{no}. Koşu: {at_adi_temizle(y.get('ad'))} ({at_no}) yeniden koşuyor")
            continue
        for alan, etiket in (("jokey", "jokey"), ("kilo", "kilo"), ("st", "start yeri")):
            ev, yv = norm(e.get(alan)), norm(y.get(alan))
            if ev != yv and (ev or yv):
                ekle("jokey" if alan == "jokey" else alan, alan, ev, yv,
                     f"{no}. Koşu: {at_adi_temizle(y.get('ad'))} ({at_no}) {etiket} {ev or '—'} → {yv or '—'}")
    return olaylar


def programlari_karsilastir(eski: dict, yeni: dict) -> list[dict]:
    e_kosu = {r.get("no"): r for r in eski.get("races", [])}
    y_kosu = {r.get("no"): r for r in yeni.get("races", [])}
    olaylar = []
    for no in sorted(set(e_kosu) | set(y_kosu)):
        e, y = e_kosu.get(no), y_kosu.get(no)
        if e and not y:
            olaylar.append({"kosu": no, "tip": "kosu", "alan": "kosu", "eski": no,
                            "yeni": None, "metin": f"{no}. Koşu programdan çıkarıldı"})
        elif y and not e:
            olaylar.append({"kosu": no, "tip": "kosu", "alan": "kosu", "eski": None,
                            "yeni": no, "metin": f"{no}. Koşu programa eklendi"})
        else:
            olaylar += kosuyu_karsilastir(e, y)
    return olaylar


def etkilenen_kriterler(olaylar: list[dict]) -> dict:
    """kosu no -> silinip yeniden hesaplanacak kriter kodlari."""
    out: dict[str, list[str]] = {}
    for o in olaylar:
        kod = ETKILENEN.get(o["tip"], [])
        if not kod or o.get("kosu") is None:
            continue
        k = str(o["kosu"])
        out[k] = sorted(set(out.get(k, [])) | set(kod))
    return out


# ---------------------------------------------------------------- bildirim
def _post(url: str, data: bytes, headers: dict) -> bool:
    try:
        req = urllib.request.Request(url, data=data, headers=headers, method="POST")
        with urllib.request.urlopen(req, timeout=20) as r:
            return 200 <= r.status < 300
    except Exception as e:  # bildirim basarisiz olsa da veri guncellemesi surmeli
        print(f"  ! bildirim gonderilemedi: {e}")
        return False


def bildir(baslik: str, govde: str) -> None:
    if KURU:
        print(f"  (kuru) BILDIRIM: {baslik}\n{govde}")
        return
    gonderildi = False
    topic = os.environ.get("NTFY_TOPIC", "").strip()
    if topic:
        server = os.environ.get("NTFY_SERVER", "https://ntfy.sh").rstrip("/")
        # Baslik ASCII olmali (HTTP basligi); govde UTF-8 gidebilir.
        ascii_baslik = baslik.encode("ascii", "replace").decode("ascii")
        gonderildi |= _post(f"{server}/{urllib.parse.quote(topic)}",
                            govde.encode("utf-8"),
                            {"Title": ascii_baslik, "Priority": "high", "Tags": "horse"})
    token = os.environ.get("TELEGRAM_TOKEN", "").strip()
    chat = os.environ.get("TELEGRAM_CHAT_ID", "").strip()
    if token and chat:
        payload = json.dumps({"chat_id": chat, "text": f"{baslik}\n\n{govde}"}).encode("utf-8")
        gonderildi |= _post(f"https://api.telegram.org/bot{token}/sendMessage",
                            payload, {"Content-Type": "application/json"})
    if not gonderildi:
        print("  ! bildirim kanali yapilandirilmamis (NTFY_TOPIC / TELEGRAM_* yok)")


# ---------------------------------------------------------------- ana akis
def sehri_izle(date: datetime, city: str) -> int:
    gun = date.strftime("%Y-%m-%d")
    slug = slugify(city)
    gun_dir = DATA / gun
    prog_dosya = gun_dir / f"program-{slug}.json"

    raw = http_get(csv_url(date, city, "program"))
    if not raw:
        print(f"  {city}: program CSV'si alinamadi")
        return 0
    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        text = raw.decode("cp1254", "replace")
    try:
        yeni = parse_csv(text)
    except Exception as e:
        print(f"  {city}: ayristirma hatasi: {e}")
        return 0
    if not yeni.get("races"):
        print(f"  {city}: bos program")
        return 0

    if not prog_dosya.exists():
        print(f"  {city}: ilk kez yaziliyor (karsilastirma yok)")
        if not KURU:
            gun_dir.mkdir(parents=True, exist_ok=True)
            prog_dosya.write_text(json.dumps(yeni, ensure_ascii=False, indent=1), encoding="utf-8")
        return 0

    eski = json.loads(prog_dosya.read_text(encoding="utf-8"))
    olaylar = programlari_karsilastir(eski, yeni)
    if not olaylar:
        print(f"  {city}: degisiklik yok")
        return 0

    ts = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    ts_tr = now_tr().strftime("%H:%M")
    for o in olaylar:
        o["ts"] = ts
        print(f"  * {o['metin']}")

    deg_dosya = gun_dir / f"degisiklik-{slug}.json"
    gunluk = {"surum": 0, "olaylar": []}
    if deg_dosya.exists():
        try:
            gunluk = json.loads(deg_dosya.read_text(encoding="utf-8"))
        except Exception:
            pass
    gunluk["surum"] = int(gunluk.get("surum", 0)) + 1
    gunluk["guncelleme"] = ts
    gunluk["sehir"] = yeni.get("city", city)
    gunluk["olaylar"] = (gunluk.get("olaylar") or []) + olaylar
    gunluk["etkilenen"] = etkilenen_kriterler(gunluk["olaylar"])

    if not KURU:
        prog_dosya.write_text(json.dumps(yeni, ensure_ascii=False, indent=1), encoding="utf-8")
        deg_dosya.write_text(json.dumps(gunluk, ensure_ascii=False, indent=1), encoding="utf-8")
        print(f"  ✓ {prog_dosya.name} + {deg_dosya.name} (surum {gunluk['surum']})")

    # Bildirimde yalniz tahmini degistiren olaylar listelenir; kilo/start gibi
    # kucuk duzeltmeler gunluge yazilir ama mesaji sisirmez.
    onemli = [o for o in olaylar if o["tip"] in ("pist", "mesafe", "kadro", "kosu", "jokey")]
    kucuk = len(olaylar) - len(onemli)
    liste = onemli or olaylar
    govde = "\n".join("• " + o["metin"] for o in liste[:20])
    if len(liste) > 20:
        govde += f"\n… +{len(liste) - 20} değişiklik daha"
    if onemli and kucuk:
        govde += f"\n(ayrıca {kucuk} küçük düzeltme: kilo/start)"
    govde += "\n\nPuanlama etkilenen koşularda yenilenecek:\nhttps://altili-bulan.onrender.com"
    bildir(f"{yeni.get('city', city)} programi degisti ({ts_tr}) — {len(liste)} degisiklik", govde)
    return len(olaylar)


def main() -> None:
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    date = datetime.strptime(args[0], "%Y-%m-%d") if args else now_tr()
    print(f"[{date:%Y-%m-%d}] program izleniyor{' (KURU)' if KURU else ''}…")
    cities = get_cities(date, "program")
    if not cities:
        print("  bugun kosu yok / hipodrom bulunamadi")
        return
    toplam = 0
    for city in cities:
        toplam += sehri_izle(date, city)
    print(f"Bitti: {toplam} degisiklik.")


if __name__ == "__main__":
    main()
