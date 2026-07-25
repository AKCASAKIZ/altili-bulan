/* ===== Program değişikliği izleyici (istemci tarafı) =====
 * scripts/izle_program.py gün içinde TJK programını yeniden çekip farkı
 * data/{gün}/degisiklik-{şehir}.json'a yazıyor (pist Çim→Kum, mesafe değişimi,
 * koşmaz atlar, jokey değişikliği…). Bu modül o dosyayı düzenli aralıkla okur:
 *   1) yeni sürüm varsa güncel programı yeniden indirir,
 *   2) ayakların mesafe/pist/saat bilgisini ve kadroyu senkronlar,
 *   3) değişimden ETKİLENEN otomatik kriterleri silip yeniden puanlar
 *      (elle girilen puanlara ve etkilenmeyen kriterlere dokunmaz),
 *   4) sayfanın üstünde uyarı şeridi + (izin verilmişse) cihaz bildirimi gösterir.
 */
(function () {
  const AB = window.AB;
  if (!AB) return;

  const PERIYOT = 5 * 60 * 1000;          // 5 dakikada bir kontrol
  const gorKey = (d, c) => `ab2:deg:goruldu:${d}:${c}`;
  const uygKey = (d, c) => `ab2:deg:uygulandi:${d}:${c}`;
  let sonAnahtar = null;                  // en son kontrol edilen gün|şehir|sürüm

  /* --- uyarı şeridi --- */
  function serit() {
    let el = document.getElementById("degSerit");
    if (!el) {
      el = document.createElement("div");
      el.id = "degSerit";
      el.className = "deg-serit";
      const pane = document.getElementById("tab-puanlama");
      pane.insertBefore(el, pane.firstChild);
    }
    return el;
  }

  function seridiGizle() {
    document.getElementById("degSerit")?.remove();
  }

  function tarihce(gunluk) {
    // Aynı metinden birden çok kez birikmesin (her taramada tekrar yazılabiliyor).
    const gorulen = new Set();
    return (gunluk.olaylar || []).filter((o) => {
      if (gorulen.has(o.metin)) return false;
      gorulen.add(o.metin);
      return true;
    });
  }

  function seridiCiz(gunluk, ozet) {
    const olaylar = tarihce(gunluk);
    const onemli = olaylar.filter((o) => ["pist", "mesafe", "kadro", "kosu", "jokey"].includes(o.tip));
    const liste = onemli.length ? onemli : olaylar;
    const kucuk = olaylar.length - onemli.length;
    const el = serit();
    el.innerHTML = `
      <div class="deg-head">
        <b>⚠️ Program değişti</b>
        <span class="hint">${AB.esc(gunluk.sehir || "")} · son güncelleme ${AB.esc(gunluk.guncelleme || "")}</span>
        <button class="btn btn-ghost" id="degKapat" title="Şeridi kapat">✕</button>
      </div>
      <ul class="deg-liste">${liste.slice(0, 25).map((o) => `<li>${AB.esc(o.metin)}</li>`).join("")}</ul>
      ${liste.length > 25 ? `<p class="hint">… +${liste.length - 25} değişiklik daha</p>` : ""}
      ${onemli.length && kucuk ? `<p class="hint">Ayrıca ${kucuk} küçük düzeltme (kilo/start).</p>` : ""}
      <p class="deg-ozet">${AB.esc(ozet)}</p>
      <div class="deg-btns">
        <button class="btn btn-accent" id="degYeniden">🔄 Etkilenen koşuları yeniden puanla</button>
        <button class="btn btn-ghost" id="degBildirim">🔔 Bu cihazda uyar</button>
      </div>`;
    el.querySelector("#degKapat").onclick = seridiGizle;
    el.querySelector("#degYeniden").onclick = () => uygula(gunluk, true);
    el.querySelector("#degBildirim").onclick = bildirimIzni;
  }

  /* --- cihaz bildirimi (sayfa açıkken) --- */
  function bildirimIzni() {
    if (!("Notification" in window)) return alert("Bu tarayıcı bildirim desteklemiyor.");
    Notification.requestPermission().then((izin) => {
      alert(izin === "granted"
        ? "✅ Bildirim açıldı. Sayfa açıkken program değişirse uyarı alacaksınız.\n\nTelefonunuza sayfa kapalıyken de bildirim için ntfy/Telegram kurulumunu kullanın."
        : "Bildirim izni verilmedi.");
    });
  }
  function cihazBildir(baslik, govde) {
    try {
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification(baslik, { body: govde, icon: "assets/icons/apple-touch-icon.png", tag: "ab-program" });
      }
    } catch { /* bildirim başarısız olsa da akış sürsün */ }
  }

  /* --- değişikliği ayaklara uygula --- */
  async function uygula(gunluk, elle) {
    const { day, city } = AB.state;
    // Güncel programı yeniden indir (sayfa açıldığından beri değişmiş olabilir).
    const taze = await fetch(`data/${day}/program-${city}.json`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null)).catch(() => null);
    if (taze) AB.state.program = taze;
    const prog = AB.state.program;
    if (!prog?.races || !AB.state.legs.length) {
      if (elle) alert("Önce Puanlama sekmesinden programı yükleyin.");
      return "";
    }

    const etk = gunluk.etkilenen || {};
    let cikan = 0, eklenen = 0, silinenPuan = 0;
    const yenilenecek = [];

    for (const leg of AB.state.legs) {
      const r = prog.races.find((x) => x.no === leg.raceNo);
      if (!r) continue;
      for (const k of ["saat", "tur", "grup", "mesafe", "pist", "ikramiye"]) {
        if (r[k] != null && r[k] !== "") leg[k] = r[k];
      }
      const guncel = (r.horses || []).filter((h) => !/koşmaz/i.test(h.ad));
      const noSet = new Set(guncel.map((h) => +h.no));
      const li = AB.state.legs.indexOf(leg);
      const once = leg.horses.length;
      leg.horses = leg.horses.filter((h) => noSet.has(+h.no));
      cikan += once - leg.horses.length;
      if (AB.state.picks[li]) AB.state.picks[li] = AB.state.picks[li].filter((no) => noSet.has(+no));

      const mevcut = new Map(leg.horses.map((h) => [+h.no, h]));
      for (const p of guncel) {
        const meta = { kgs: p.kgs, son6: p.son6, eniyi: p.eniyi, agf: p.agf, h: p.h,
                       jokey: p.jokey, kilo: p.kilo, sahip: p.sahip, antrenor: p.antrenor, st: p.st };
        const h = mevcut.get(+p.no);
        if (h) { h.ad = p.ad; h.meta = Object.assign(h.meta || {}, meta); }
        else { leg.horses.push({ no: +p.no, ad: p.ad, scores: {}, meta }); eklenen++; }
      }
      leg.horses.sort((a, b) => a.no - b.no);

      // Etkilenen kriterleri temizle → aşağıda scoreLeg yeniden hesaplayacak.
      const kodlar = etk[String(leg.raceNo)] || [];
      if (kodlar.length || once !== leg.horses.length) {
        for (const h of leg.horses) for (const k of kodlar) {
          if (h.scores[k] != null) { delete h.scores[k]; silinenPuan++; }
        }
        yenilenecek.push(leg);
      }
    }

    if (typeof AB.scoreLeg === "function") {
      for (const leg of yenilenecek) {
        try { await AB.scoreLeg(leg); } catch (e) { console.warn("scoreLeg", leg.raceNo, e); }
      }
    }
    AB.saveSession();
    AB.renderAll();
    AB.LS.set(uygKey(day, city), gunluk.surum);

    const ozet = `↻ ${yenilenecek.length} koşu yeniden puanlandı`
      + (cikan ? ` · ${cikan} at çıkarıldı` : "")
      + (eklenen ? ` · ${eklenen} at eklendi` : "")
      + (silinenPuan ? ` · ${silinenPuan} puan hücresi tazelendi` : "");
    if (elle) {
      seridiCiz(gunluk, ozet);
      alert("✅ " + ozet + "\n\nElle girdiğiniz ve değişimden etkilenmeyen puanlar korundu.");
    }
    return ozet;
  }

  /* --- düzenli kontrol --- */
  async function kontrol() {
    const { day, city } = AB.state;
    if (!day || !city) return;
    const gunluk = await fetch(`data/${day}/degisiklik-${city}.json`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null)).catch(() => null);
    if (!gunluk?.olaylar?.length) { if (sonAnahtar?.startsWith(`${day}|${city}|`)) seridiGizle(); return; }

    const anahtar = `${day}|${city}|${gunluk.surum}`;
    if (anahtar === sonAnahtar) return;   // aynı sürüm, iş yok
    sonAnahtar = anahtar;

    const uygulanan = +AB.LS.get(uygKey(day, city), 0);
    let ozet = "";
    if (gunluk.surum > uygulanan) ozet = await uygula(gunluk, false);
    seridiCiz(gunluk, ozet || "Puanlama bu değişikliğe göre güncel.");

    const gorulen = +AB.LS.get(gorKey(day, city), 0);
    if (gunluk.surum > gorulen) {
      AB.LS.set(gorKey(day, city), gunluk.surum);
      const ilk = (gunluk.olaylar || []).slice(-3).map((o) => o.metin).join("\n");
      cihazBildir(`${gunluk.sehir || "Program"} değişti`, ilk);
    }
  }

  setTimeout(kontrol, 2500);              // ilk yükleme verisi otursun
  setInterval(kontrol, PERIYOT);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) kontrol(); });
  // Gün/hipodrom değiştirilince hemen bak
  document.getElementById("citySelect")?.addEventListener("change", () => setTimeout(kontrol, 1200));
  document.getElementById("daySelect")?.addEventListener("change", () => setTimeout(kontrol, 1200));
  window.AB.programDegisikligiKontrol = kontrol;
})();
