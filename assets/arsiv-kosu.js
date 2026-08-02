/* ===== 🔎 Geçmiş koşu sonucu (arşivden) =====
 * TJK'nın Koşu Sorgulama sayfasında bir yarışa tıklayınca çıkan sonuç listesinin
 * aynısını, tek tek tıklamadan, kendi arşivimizden gösterir.
 * Kapsam: 2021-08-25 → bugün (data/arsiv/{YYYY-MM}.json).
 *
 * Neden ayrı sekme DEĞİL: mobilde sekme sayısını yeni azalttık (bkz. mobil.js).
 * Bu yüzden dergi.js'in kurduğu "📜 Geçmiş" bölmesinin içine, at geçmişi
 * görüntüleyicisinin üstüne yerleşir. dergi.js'ten SONRA yüklenmeli.
 *
 * Ay dosyaları ~1,3 MB. Arşivin tamamı 165 MB — asla toptan yüklenmez, yalnız
 * seçilen ay çekilir ve bellekte tutulur.
 */
(function () {
  const AB = window.AB;
  if (!AB) return;

  const ILK = "2021-08-25";                 // arşivin gerçek başlangıcı (ölçüldü)
  const pane = document.getElementById("tab-gecmis");
  if (!pane) return;                        // dergi.js yüklenmediyse sessizce çık

  const blok = document.createElement("div");
  blok.className = "arsiv-kosu";
  blok.innerHTML = `
    <div class="toolbar">
      <label>Tarih <input type="date" id="akTarih" min="${ILK}"></label>
      <select id="akSehir" disabled></select>
      <select id="akKosu" disabled></select>
    </div>
    <p class="hint" id="akInfo">Bir tarih seçin — o günün hipodromları ve koşuları gelir.</p>
    <div id="akView"></div>
    <hr class="arsiv-ayrac">`;
  pane.insertBefore(blok, pane.firstChild);

  const $ = (id) => document.getElementById(id);
  const aylar = {};                         // "YYYY-MM" -> veri | null

  async function ay(anahtar) {
    if (anahtar in aylar) return aylar[anahtar];
    $("akInfo").textContent = "Arşiv okunuyor…";
    /* "no-cache" ŞART. Ay dosyaları değişiyor (backfill_numara.py at
       numaralarını sonradan dolduruyor). Sunucu Cache-Control göndermediği
       için tarayıcı sezgisel tazelik uygulayıp eski kopyayı doğrulamadan
       sunuyor ve "No" sütunu boş kalıyordu — "force-cache" ile de, varsayılanla
       da. "no-cache" her seferinde koşullu istek atar, değişmemişse 304 döner
       (ucuz). Bellekteki `aylar` sözlüğü zaten oturum içinde tekrar indirmez. */
    aylar[anahtar] = await fetch(`data/arsiv/${anahtar}.json`, { cache: "no-cache" })
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null);
    return aylar[anahtar];
  }

  function doldur(sel, secenekler, bosMetin) {
    sel.innerHTML = "";
    if (!secenekler.length) {
      sel.innerHTML = `<option value="">${bosMetin}</option>`;
      sel.disabled = true;
      return;
    }
    secenekler.forEach((o, i) => {
      const e = document.createElement("option");
      e.value = String(i);
      e.textContent = o;
      sel.appendChild(e);
    });
    sel.disabled = false;
  }

  let gunVerisi = [];                       // o günün hipodrom listesi

  async function tarihDegisti() {
    const t = $("akTarih").value;
    $("akView").innerHTML = "";
    if (!t) return;
    if (t < ILK) {
      $("akInfo").textContent = `Arşiv ${ILK} tarihinde başlıyor, daha geriye veri yok.`;
      doldur($("akSehir"), [], "—"); doldur($("akKosu"), [], "—");
      return;
    }
    const v = await ay(t.slice(0, 7));
    gunVerisi = (v && v[t]) || [];
    if (!gunVerisi.length) {
      $("akInfo").textContent = "Bu tarihte yarış yok (ya da arşivde eksik).";
      doldur($("akSehir"), [], "—"); doldur($("akKosu"), [], "—");
      return;
    }
    doldur($("akSehir"), gunVerisi.map((h) => h.sehir || "?"), "—");
    sehirDegisti();
  }

  function sehirDegisti() {
    const h = gunVerisi[+$("akSehir").value || 0];
    if (!h) return;
    const ks = h.kosular || [];
    doldur($("akKosu"), ks.map((k) => `${k.no}. Koşu · ${k.mesafe || ""} ${k.pist || ""}`.trim()), "—");
    ciz();
  }

  function ciz() {
    const h = gunVerisi[+$("akSehir").value || 0];
    const k = h && (h.kosular || [])[+$("akKosu").value || 0];
    const view = $("akView");
    if (!k) { view.innerHTML = ""; return; }

    const kunye = [k.saat, k.tur, k.grup, `${k.mesafe || ""} ${k.pist || ""}`.trim(), k.ikramiye]
      .filter(Boolean).map(AB.esc).join(" · ");
    $("akInfo").textContent = `${h.sehir} · ${$("akTarih").value} · ${(k.atlar || []).length} at`;

    // Bitiş sırasına göre. sira boşsa (koşmayan/diskalifiye) en sona.
    const atlar = [...(k.atlar || [])].sort(
      (a, b) => ((a.sira ?? 99) - (b.sira ?? 99))
    );

    /* At numarası ancak `nv` işaretli şehir-günlerinde gerçek. İşaretsiz günde
       `no` hâlâ sonuç CSV'sinden gelen bitiş sırasının kopyası — onu numara
       diye göstermek yanlış bilgi olur, "–" basılır.
       (scripts/backfill_numara.py program CSV'sinden doldurup nv=1 yazıyor.) */
    const numarali = h.nv === 1;

    let html = `<div class="race-card"><header>
      <h3>🔎 ${AB.esc(h.sehir || "")} — ${k.no}. Koşu</h3>
      <span class="race-tags">${kunye}</span></header>
      <div class="table-wrap"><table><thead><tr>
      <th>Sıra</th><th>No</th><th>St</th><th>At</th><th>Yaş</th><th>Kilo</th><th>Jokey</th>
      <th>Antrenör</th><th>Derece</th><th>Ganyan</th><th>Fark</th><th>AGF</th>
      </tr></thead><tbody>`;
    for (const a of atlar) {
      const ilk3 = a.sira && a.sira <= 3 ? ' class="ak-derece"' : "";
      html += `<tr${ilk3}>` +
        `<td><b>${AB.esc(String(a.sira ?? "-"))}</b></td>` +
        `<td>${numarali ? AB.esc(String(a.no ?? "")) : "–"}</td>` +
        `<td>${AB.esc(String(a.st ?? ""))}</td>` +
        `<td>${AB.esc(a.ad || "")}</td>` +
        `<td>${AB.esc(a.yas || "")}</td>` +
        `<td>${AB.esc(a.kilo || "")}</td>` +
        `<td>${AB.esc(a.jokey || "")}</td>` +
        `<td>${AB.esc(a.antrenor || "")}</td>` +
        `<td>${AB.esc(a.derece || "")}</td>` +
        `<td>${AB.esc(a.ganyan || "")}</td>` +
        `<td>${AB.esc(a.fark || "")}</td>` +
        `<td>${AB.esc(a.agf || "")}</td></tr>`;
    }
    html += `</tbody></table></div>
      <p class="hint">Kaynak: TJK günlük sonuç CSV arşivi. <b>No</b> = atın yarış
      numarası (altılıda oynanan), <b>St</b> = start (kulvar) numarası.
      ${numarali ? "" : "Bu günün numaraları henüz program CSV'sinden doldurulmadı."}</p>
      </div>`;
    view.innerHTML = html;
  }

  $("akTarih").addEventListener("change", tarihDegisti);
  $("akSehir").addEventListener("change", sehirDegisti);
  $("akKosu").addEventListener("change", ciz);
})();
