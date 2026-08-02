/* ===== Mobil alt navigasyon =====
 * Telefonda üstteki sekme şeridi 11 sekmeyle üç satıra yayılıyor ve başlıkla
 * birlikte 390px'lik ekranın ~%30'unu içerik görünmeden yiyordu. Bu modül o
 * şeridi mobilde gizleyip (bkz. style.css) başparmağın eriştiği yere, ekranın
 * altına sabit bir çubuk koyar: 4 sabit sekme + "Daha fazla" sayfası.
 *
 * app.js'e DOKUNMAZ. Çubuktaki düğme, üstteki gerçek sekme düğmesine tıklar;
 * böylece sekme değişiminin tüm yan etkileri (renderKupon, renderTagm…) aynen
 * çalışır. Sekmeler app.js tarafından sonradan da eklenebiliyor (Dergi,
 * Geçmiş), o yüzden şerit MutationObserver ile izlenir.
 */
(function () {
  const serit = document.getElementById("mainTabs");
  if (!serit) return;

  // Çubukta sabit duracak sekmeler — günlük akış bu sırayla ilerliyor:
  // programa bak, puanla, kuponu kur, koşudan sonra sonuca bak.
  const SABIT = ["program", "puanlama", "kupon", "sonuclar"];

  const nav = document.createElement("nav");
  nav.className = "mnav";
  nav.setAttribute("aria-label", "Ana bölümler");

  const sheet = document.createElement("div");
  sheet.className = "msheet";
  sheet.hidden = true;
  sheet.innerHTML =
    '<div class="msheet-arka"></div>' +
    '<div class="msheet-panel" role="dialog" aria-label="Diğer bölümler">' +
    '<div class="msheet-tut"></div><div class="msheet-liste"></div></div>';

  /* Sekme etiketi "📋 Program" biçiminde: baştaki simgeyi metinden ayır.
     Simge ayrı bir <span>'e girmezse çubukta yazıyla aynı satıra yapışıyor. */
  function ayir(btn) {
    const ham = (btn.textContent || "").trim();
    const m = ham.match(/^(\P{L}+)\s*(.*)$/u);
    return m ? { ikon: m[1].trim(), ad: m[2].trim() } : { ikon: "•", ad: ham };
  }

  function tabDugmeleri() {
    return Array.from(serit.querySelectorAll(".tab"));
  }

  function git(btn) {
    btn.click();                       // gerçek sekmeye tıkla — yan etkiler korunur
    kapat();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function kapat() {
    sheet.hidden = true;
    document.body.classList.remove("msheet-acik");
  }

  function ac() {
    sheet.hidden = false;
    document.body.classList.add("msheet-acik");
  }

  /* --- çubuğu ve sayfayı kur --- */
  function kur() {
    const tumu = tabDugmeleri();
    if (!tumu.length) return;

    const sabitler = SABIT
      .map((t) => tumu.find((b) => b.dataset.tab === t))
      .filter(Boolean);
    const digerleri = tumu.filter((b) => !SABIT.includes(b.dataset.tab));

    nav.innerHTML = "";
    sabitler.forEach((btn) => {
      const { ikon, ad } = ayir(btn);
      const d = document.createElement("button");
      d.className = "mnav-oge";
      d.dataset.tab = btn.dataset.tab;
      d.innerHTML =
        '<span class="mnav-ikon">' + ikon + "</span>" +
        '<span class="mnav-ad"></span>';
      d.querySelector(".mnav-ad").textContent = ad;
      d.addEventListener("click", () => git(btn));
      nav.appendChild(d);
    });

    const daha = document.createElement("button");
    daha.className = "mnav-oge mnav-daha";
    daha.innerHTML =
      '<span class="mnav-ikon">☰</span><span class="mnav-ad">Daha fazla</span>';
    daha.addEventListener("click", () => (sheet.hidden ? ac() : kapat()));
    nav.appendChild(daha);

    const liste = sheet.querySelector(".msheet-liste");
    liste.innerHTML = "";
    digerleri.forEach((btn) => {
      const { ikon, ad } = ayir(btn);
      const d = document.createElement("button");
      d.className = "msheet-oge";
      d.dataset.tab = btn.dataset.tab;
      d.innerHTML = '<span class="msheet-ikon">' + ikon + "</span><span></span>";
      d.querySelector("span:last-child").textContent = ad;
      d.addEventListener("click", () => git(btn));
      liste.appendChild(d);
    });

    isaretle();
  }

  /* --- aktif sekmeyi çubuğa yansıt --- */
  function isaretle() {
    const aktif = serit.querySelector(".tab.active");
    const ad = aktif ? aktif.dataset.tab : null;
    const sabitte = SABIT.includes(ad);
    nav.querySelectorAll(".mnav-oge").forEach((d) => {
      d.classList.toggle("aktif", d.dataset.tab === ad);
    });
    // Aktif sekme "Daha fazla" içindeyse çubukta kaybolmasın, ☰ işaretli dursun
    nav.querySelector(".mnav-daha").classList.toggle("aktif", !sabitte);
  }

  /* --- Kupon özeti çekmecesi ---
   * Dikey telefonda iki altılının bileti ekranın tamamını kaplıyordu. CSS onu
   * sola gizliyor; buradaki tutamak açıp kapatıyor. Yatayda tutamak gizli,
   * bilet zaten sol sütunda duruyor (bkz. style.css).
   */
  const ozet = document.getElementById("kuponSummary");
  if (ozet) {
    const tut = document.createElement("button");
    tut.className = "kupon-tut";
    tut.type = "button";
    tut.textContent = "BİLET";
    tut.setAttribute("aria-label", "Kupon biletini aç/kapat");
    tut.addEventListener("click", () => {
      const acik = ozet.classList.toggle("acik");
      tut.classList.toggle("acik", acik);
      tut.setAttribute("aria-expanded", acik ? "true" : "false");
    });
    ozet.parentNode.insertBefore(tut, ozet);
  }

  sheet.querySelector(".msheet-arka").addEventListener("click", kapat);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") kapat();
  });

  document.body.appendChild(nav);
  document.body.appendChild(sheet);
  kur();

  // Şerit değişirse (yeni sekme eklendi ya da aktiflik değişti) yeniden kur.
  // childList → sekme eklendi, attributes → .active sınıfı değişti.
  new MutationObserver((kayitlar) => {
    if (kayitlar.some((k) => k.type === "childList")) kur();
    else isaretle();
  }).observe(serit, { childList: true, subtree: true, attributeFilter: ["class"] });
})();
