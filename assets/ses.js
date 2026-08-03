/* ==================== SESLİ KOŞU YORUMU ====================
 * Program sekmesinde her koşu kartının sonuna, o koşuyu modelin gözünden
 * anlatan bir yorum metni + "🔊 Dinle" düğmesi basar.
 *
 * Metin UYDURULMAZ: yalnızca motorun zaten hesapladığı sayılardan üretilir
 * (computeScore / legProbs / legRecommendation + kriter katkıları). Model
 * puanı yoksa (koşu Puanlama sekmesine yüklenmemişse) yorum da üretilmez —
 * boş cümle kurmaktansa "önce puanlayın" demek yeğdir.
 *
 * Ses: tarayıcının Web Speech API'si (speechSynthesis). Ek dosya/ağ yok,
 * çevrimdışı da çalışır. Türkçe ses yoksa metin yine görünür, düğme uyarır.
 */
(function () {
  const AB = window.AB;
  if (!AB) return;

  /* --- Türkçe ses seçimi. Sesler bazı tarayıcılarda gecikmeli yüklenir,
       o yüzden konuşma anında yeniden bakılır. --- */
  function trSes() {
    const v = speechSynthesis.getVoices() || [];
    return v.find((x) => /^tr(-|_|$)/i.test(x.lang)) || null;
  }

  /* Uzun metin tek seferde verilince bazı tarayıcılar ortadan kesiyor;
     cümlelere bölüp sıraya koyuyoruz. Bölme için nokta yetmez ("1. koşu",
     "3. sırada" gibi sıra sayıları da nokta içerir) — ardından büyük harfle
     başlayan yeni bir cümle gelmesi şartı aranır. */
  function konus(metin, durumEl) {
    speechSynthesis.cancel();
    const ses = trSes();
    const parcalar = sesIcin(metin).split(/(?<=[.!?])\s+(?=[A-ZÇĞİÖŞÜ])/).filter(Boolean);
    parcalar.forEach((p, i) => {
      const u = new SpeechSynthesisUtterance(p);
      u.lang = "tr-TR";
      if (ses) u.voice = ses;
      u.rate = 1.0;
      if (i === parcalar.length - 1) u.onend = () => { if (durumEl) durumEl.textContent = ""; };
      speechSynthesis.speak(u);
    });
    if (durumEl) durumEl.textContent = ses ? "okunuyor…" : "okunuyor… (cihazda Türkçe ses yok, aksan bozuk olabilir)";
  }

  /* --- sayı/metin yardımcıları --- */
  const p0 = (x) => Math.round(x);
  function atAdi(h) {
    // takıyı ("KG SK") sesli okurken harf harf saçmalamasın diye at
    return AB.takiAyikla(h.ad).ad;
  }
  function yuzde(x) { return `yüzde ${p0(x * 100)}`; }

  /* Kriter adlarının bir kısmı "Wins (kazanma yüzdesi)" gibi İngilizce başlık +
     Türkçe açıklama biçiminde. Sesli okurken parantez içi Türkçe karşılık daha
     anlaşılır; ama "(arşiv)" / "(idman)" gibi kaynak etiketleri açıklama değil,
     onlarda başlığın kendisi kalır. */
  const KAYNAK_ETIKETI = /^(arşiv|idman|şart|ilk \d+)$/i;
  function kriterAdi(ad) {
    const m = /^(.*?)\s*\((.+)\)\s*$/.exec(ad);
    if (!m) return ad;
    const ic = m[2];
    // "(GP)", "(AGF)" gibi kısaltmalar açıklama değil; onlarda başlık kalır
    const aciklama = /\s/.test(ic) || ic.length > 6;
    return aciklama && !KAYNAK_ETIKETI.test(ic) ? ic : m[1];
  }

  /* Bir atın puanına en çok katkı yapan kriterler — "neden favori" cümlesi. */
  function oneCikanKriterler(h, kac) {
    return AB.ANGLES
      .filter((a) => AB.state.enabled[a.k])
      .map((a) => ({ ad: a.name, katki: (+h.scores[a.k] || 0) * AB.state.coefs[a.k] }))
      .filter((x) => x.katki > 0)
      .sort((a, b) => b.katki - a.katki)
      .slice(0, kac)
      .map((x) => kriterAdi(x.ad).toLocaleLowerCase("tr"));
  }

  /* Seslendirme öncesi: uzun tire duraklama olarak okunmuyor, ondalık nokta ise
     Türkçe'de virgül. Ekranda gösterilen metin bundan etkilenmez. */
  function sesIcin(metin) {
    return metin.replace(/(\d)\.(\d)/g, "$1,$2").replace(/\s*—\s*/g, ", ");
  }

  /* AGF "%28.4(1)" biçiminde gelir; sıra parantez içinde. */
  function agfSira(h) {
    const m = /\((\d+)\)/.exec(h.meta?.agf || "");
    return m ? +m[1] : null;
  }

  function yorumMetni(leg) {
    const ranked = AB.rankedHorses(leg).filter((x) => x.score > 0);
    if (ranked.length < 2) return null;

    const { probOf } = AB.legProbs(leg);
    const c = [];
    const bas = [leg.raceNo + ". koşu"];
    if (leg.mesafe) bas.push(`${parseInt(leg.mesafe) || leg.mesafe} metre`);
    if (leg.pist) bas.push(leg.pist.toLowerCase());
    c.push(`${bas.join(", ")}, ${leg.horses.length} at koşuyor.`);

    // 1) favori + neden
    const f = ranked[0];
    const kriter = oneCikanKriterler(f.h, 3);
    c.push(`Modelin favorisi ${f.h.no} numara ${atAdi(f.h)}, ${p0(f.score)} puan, kazanma ihtimali ${yuzde(probOf(f.score))}.`);
    if (kriter.length) c.push(`Öne çıktığı yerler: ${kriter.join(", ")}.`);

    // 2) rakipler ve aradaki fark
    const ik = ranked[1];
    const fark = (f.score - ik.score) / (f.score || 1);
    c.push(`İkinci sırada ${ik.h.no} numara ${atAdi(ik.h)} var, ${p0(ik.score)} puan.`);
    c.push(fark < 0.08
      ? "Aradaki fark çok az, bu koşuda favori net değil."
      : fark > 0.25 ? "Favori rakiplerinden açık ara önde." : "Favorinin makul bir üstünlüğü var.");

    // 3) model piyasayla aynı fikirde mi? (AGF sırası)
    const fs = agfSira(f.h);
    if (fs === 1) c.push("Piyasa da aynı atı favori gösteriyor.");
    else if (fs && fs > 3) {
      const piyasa = leg.horses.find((h) => agfSira(h) === 1);
      c.push(`Dikkat: piyasanın favorisi başka bir at${piyasa ? `, ${piyasa.no} numara ${atAdi(piyasa)}` : ""}. Modelin favorisi AGF sıralamasında ${fs}. sırada, yani sürpriz adayı.`);
    }

    // 4) kaç at yazılmalı + gerekçe
    const rec = AB.legRecommendation(leg);
    if (rec.count) {
      c.push(`Önerilen genişlik ${rec.count} at: ${rec.horses.join(", ")} numaralar.`);
      if (rec.reason) c.push(`Gerekçe: ${rec.reason.replace(/\s*\(\+1\)/g, "").replace(/;/g, ",")}.`);
    }
    return c.join(" ");
  }

  /* --- kutuları doldur --- */
  function doldur() {
    document.querySelectorAll(".ses-kutu[data-ses-race]").forEach((box) => {
      if (box.dataset.hazir === "1") return;
      box.dataset.hazir = "1";
      const no = +box.dataset.sesRace;
      const leg = (AB.state.legs || []).find((l) => l.raceNo === no);
      const metin = leg ? yorumMetni(leg) : null;
      if (!metin) {
        box.innerHTML = `<p class="hint">🔊 Sesli yorum için bu koşunun Puanlama sekmesinde puanlanmış olması gerekir.</p>`;
        return;
      }
      box.innerHTML = `
        <div class="ses-yorum">
          <button class="ses-btn" type="button">🔊 Dinle</button>
          <button class="ses-dur" type="button" hidden>⏹ Durdur</button>
          <span class="ses-durum hint"></span>
          <p class="ses-metin">${AB.esc(metin)}</p>
        </div>`;
      const durum = box.querySelector(".ses-durum");
      const dur = box.querySelector(".ses-dur");
      box.querySelector(".ses-btn").onclick = () => { dur.hidden = false; konus(metin, durum); };
      dur.onclick = () => { speechSynthesis.cancel(); durum.textContent = ""; dur.hidden = true; };
    });
  }

  /* Program her yeniden çizildiğinde kutular boş olarak gelir (dataset.hazir
     yok), o yüzden render fonksiyonlarını sarmalamak yerine DOM'u izliyoruz —
     hangi kod yolunun çizdiğinden bağımsız çalışır ve puan değişince yorum
     kendiliğinden tazelenir. */
  const gozle = () => {
    const kok = document.querySelector("#programView");
    if (!kok) return false;
    new MutationObserver(() => doldur()).observe(kok, { childList: true, subtree: true });
    doldur();
    return true;
  };
  if (!gozle()) window.addEventListener("load", gozle);
  // sayfadan ayrılırken/sekme değişince konuşmayı kes
  window.addEventListener("pagehide", () => speechSynthesis.cancel());

  AB.sesliYorumMetni = yorumMetni;
})();
