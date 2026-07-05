# 🏇 Altılı Bulan v2

At yarışı için **25 kriterli ağırlıklı puanlama sistemi** — 2000'li yıllardan kalma "altılı bulan" Excel sisteminin modernleştirilmiş hali.

Üç parçadan oluşur:

| Parça | Ne işe yarar |
|---|---|
| **Web uygulaması** (`index.html`) | Modern arayüz: puanlama, kupon oluşturma, program/sonuç görüntüleme. GitHub Pages'te çalışır. |
| **Excel dosyası** (`excel/altili-bulan-v2.xlsx`) | Aynı sistemin çevrimdışı Excel hali: 6 ayak sayfası + otomatik KUPON özeti. |
| **Otomatik veri** (`scripts/` + GitHub Actions) | Her gün TJK'nın açık CSV raporlarından günün programını ve sonuçlarını çekip `data/` klasörüne JSON olarak kaydeder. |

## Kurulum (GitHub)

1. **Repo oluşturun:** github.com → New repository → adı örn. `altili-bulan` → Public → Create.
2. **Dosyaları yükleyin:** Bilgisayarda git kurulu değilse en kolayı web arayüzü:
   - Repo sayfasında *uploading an existing file* bağlantısına tıklayın,
   - `C:\Users\tunc.akcasakiz\Projects\altili-bulan` içindeki **tüm dosya ve klasörleri** sürükleyip bırakın → Commit.
   - (Alternatif: [git-scm.com](https://git-scm.com)'dan git kurup `git init`, `git add .`, `git commit`, `git remote add origin ...`, `git push`.)
   - Not: `.github` gizli klasördür; web yüklemesinde atlanırsa repo içinde *Add file → Create new file* ile `.github/workflows/gunluk-veri.yml` dosyasını oluşturup içeriği yapıştırın.
3. **GitHub Pages'i açın:** Repo → Settings → Pages → Source: *Deploy from a branch* → Branch: `main`, klasör: `/ (root)` → Save. Birkaç dakika sonra siteniz `https://KULLANICIADI.github.io/altili-bulan/` adresinde yayında olur.
4. **Actions'ı etkinleştirin:** Repo → Actions sekmesi → workflow'u onaylayın. Artık her gün:
   - **08:30 TR** — günün yarış programı çekilir,
   - **23:45 TR** — günün sonuçları çekilir,
   ve `data/` klasörüne işlenir. İsterseniz Actions → *Günlük TJK verisi* → *Run workflow* ile elle de tetikleyebilirsiniz.

## Kullanım

1. Üst bardan **gün + hipodrom** seçin.
2. **Puanlama** sekmesinde *Programdan yükle* → günün koşuları ayak ayak gelir.
3. *Otomatik puanla* — B5 (kazanma %), B6 (tahmini derece), B8 (son koşu tarihi), B13 (son 6 toplamı) kriterlerini TJK program verisinden otomatik doldurur. Kalan kriterleri kılavuza göre elle girersiniz (genelde 100/60/20).
4. **Kupon** sekmesi: *Puanlara göre öner* düğmesi kılavuzdaki 2. yöntemi uygular (1.–2. puan farkı en yüksek ayak tek, diğerlerine iki at). Elle de seçebilirsiniz; kombinasyon ve tutar otomatik hesaplanır.
5. **Sonuçlar** sekmesi: akşam sonuçlar çekildiğinde kazananlar ve ödemeler görünür; kupondaki atlarınız işaretlenir.
6. Puanlamalarınız tarayıcıda otomatik saklanır; **Veri** sekmesinden JSON yedeği alabilirsiniz. GitHub verisi olmayan günler için TJK sitesinden indirilen CSV dosyasını da yükleyebilirsiniz.

## Puanlama sistemi

3 ana bakış açısı: **A** (at sahibi, 3 kriter), **B** (at + antrenör, 18 kriter), **C** (jokey, 4 kriter).
Her kritere 0–100 puan verilir, kriterin katsayısıyla çarpılıp toplanır. Katsayılar **Katsayılar** sekmesinden düzenlenebilir.

> ⚠️ Orijinal kılavuzdaki katsayı tablosunda B16–B18 satırlarında kayma vardı (B16 %3.41 ↔ 0.0124). Bu sürümde katsayılar yüzdelerle tutarlı hale getirildi; toplam tam %100.

**Tavsiye modu:** sistemin yazarının fiilen kullandığı 6 kriter (A3, B1, B2, B3, B6, B13) — tek tıkla açılır.

## Veri kaynağı

TJK'nın kendi sitesinde herkese açık olarak sunduğu günlük CSV raporları kullanılır:
`https://medya-cdn.tjk.org/raporftp/TJKPDF/{yıl}/{tarih}/CSV/...`
Yurt dışı hipodromların CSV'si yayınlanmadığı için yalnızca Türkiye koşuları gelir.

Elle çekmek için: `python3 scripts/fetch_tjk.py` (bugün + dün) veya `python3 scripts/fetch_tjk.py 2026-07-05`.

---
*Bu araç kişisel istatistik/analiz amaçlıdır. Sorumlu oynayın.*
