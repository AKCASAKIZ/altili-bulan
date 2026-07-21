/* ===== Yarış Gazetesi PDF entegrasyonu =====
 * Repodaki PDF'leri (kök ve dergi/ klasörü) GitHub API'den listeler,
 * pdf.js ile tarayıcıda ayrıştırır, tahminleri puanlamaya uygular. */
"use strict";

/* at adını ekipman soneklerinden arındırıp normalize eder — dergi.js'in tüm bölümleri ortak kullanır */
function temizle(ad) {
  return (ad || "")
    .replace(/\s*\(.*?\)\s*/g, " ")
    .replace(/(\s+(KG|SKG|GDSK|DSGK|GKDSK|GKD|DSK|GSK|SGK|GDS|DSG|GKR|DB|SK|GD|GK|DS|KD|GM|KGD|G|K|D|M|S))+\s*$/g, "")
    .trim().toUpperCase();
}

// data/atlar/{slug}.json dosya adını üretir — Python tarafındaki
// slugify(at_adi_temizle(ad)) ile birebir eşleşmeli (fetch_accurace.py).
const TR_ASCII = { "ç": "c", "ğ": "g", "ı": "i", "ö": "o", "ş": "s", "ü": "u",
  "Ç": "c", "Ğ": "g", "İ": "i", "I": "i", "Ö": "o", "Ş": "s", "Ü": "u" };
function slugAt(ad) {
  return temizle(ad)
    .replace(/[çğıöşüÇĞİIÖŞÜ]/g, (c) => TR_ASCII[c])
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

(function () {
  const AB = window.AB;
  if (!AB) { console.error("dergi.js: app.js kancaları yok"); return; }
  const REPO = "AKCASAKIZ/altili-bulan";
  const AYLAR = { OCAK: 1, ŞUBAT: 2, MART: 3, NİSAN: 4, MAYIS: 5, HAZİRAN: 6, TEMMUZ: 7, AĞUSTOS: 8, EYLÜL: 9, EKİM: 10, KASIM: 11, ARALIK: 12 };

  /* ---- sekme + panel DOM'u ---- */
  const tabBtn = document.createElement("button");
  tabBtn.className = "tab";
  tabBtn.dataset.tab = "dergi";
  tabBtn.textContent = "📖 Dergi";
  document.getElementById("mainTabs").insertBefore(tabBtn, document.querySelector('[data-tab="ayarlar"]'));

  const pane = document.createElement("section");
  pane.id = "tab-dergi";
  pane.className = "tab-pane";
  pane.innerHTML = `
    <div class="toolbar">
      <select id="dergiSelect" style="min-width:220px"><option>PDF listesi yükleniyor…</option></select>
      <button id="btnDergiLabel" class="btn btn-ghost" title="Her PDF'in 1. sayfasını okuyup listeyi şehir+tarih olarak etiketler (biraz sürebilir)">🏷️ Şehir+tarih etiketle</button>
      <div class="toolbar-right">
        <button id="btnDergiParse" class="btn">📖 PDF'i oku</button>
        <button id="btnDergiApply" class="btn btn-accent">⚡ Puanlamaya uygula (B6+B11)</button>
        <button id="btnDergiGecmis" class="btn btn-accent">📊 Geçmişi uygula (B1+B2+B3+B12+B15)</button>
      </div>
    </div>
    <p class="hint" id="dergiInfo">Yarış Gazetesi PDF'ini GitHub reposuna yükleyin (kök veya <b>dergi/</b> klasörü) — burada otomatik listelenir. "PDF'i oku" gazetenin puanlarını, FAVORİ/PLASE/SÜRPRİZ tahminlerini, banko atları ve sayfa 2+'deki geçmiş performans tablolarını çıkarır. "Puanlamaya uygula": gazete puanı en yüksek 5 ata <b>B6</b> (100,70,50,30,10), favorilere <b>B11</b>=100, plaselere 60, sürprizlere 30 yazar. "Geçmişi uygula": her atın gazetede basılı geçmiş koşularından <b>B1</b> (ikramiye düşüşü), <b>B2/B3</b> (mesafe/pist uygunluğu — ortalama dereceye göre tahmini), <b>B12</b> (mesafe ayarı), <b>B15</b> (kilo farkı) doldurur.</p>
    <div id="dergiView"></div>`;
  document.querySelector("main").appendChild(pane);

  tabBtn.onclick = () => {
    document.querySelectorAll(".tab").forEach((x) => x.classList.toggle("active", x === tabBtn));
    document.querySelectorAll(".tab-pane").forEach((p) => p.classList.toggle("active", p.id === "tab-dergi"));
  };

  let current = null;   // ayrıştırılmış dergi verisi
  let foundPdfs = [];   // {name, url, sha}

  const trTarih = (iso) => {
    if (!iso) return "";
    const [y, m, d] = iso.split("-");
    return `${d}.${m}.${y}`;
  };

  /* ---- repo PDF listesi (önce dosya adları) ---- */
  async function listPdfs() {
    const sel = document.getElementById("dergiSelect");
    foundPdfs = [];
    for (const path of ["", "dergi"]) {
      try {
        const r = await fetch(`https://api.github.com/repos/${REPO}/contents/${path}`, { cache: "no-store" });
        if (!r.ok) continue;
        for (const f of await r.json()) {
          if (f.type === "file" && /\.pdf$/i.test(f.name)) foundPdfs.push({ name: f.name, url: f.download_url, sha: f.sha });
        }
      } catch {}
    }
    sel.innerHTML = foundPdfs.length
      ? foundPdfs.map((f, i) => `<option value="${AB.esc(f.url)}" data-ix="${i}">${AB.esc(pdfLabelCache(f) || f.name)}</option>`).join("")
      : `<option value="">PDF bulunamadı — repoya yükleyin</option>`;
  }

  // her PDF'in 1. sayfasını okuyup "Şehir — gg.aa.yyyy (dosya.pdf)" etiketi
  // üretir; sonuç localStorage'da sha ile cache'lenir (tekrar okunmaz).
  function pdfLabelCache(f) { return AB.LS.get(`ab2:pdflabel:${f.sha || f.name}`, null); }
  async function pdfLabel(f) {
    const cached = pdfLabelCache(f);
    if (cached) return cached;
    try {
      const doc = await openPdf(f.url);
      const d = parseDergi(await extractColumns(doc));
      if (d.city || d.date) {
        const label = `${d.city || "?"} — ${trTarih(d.date) || "?"}  (${f.name})`;
        AB.LS.set(`ab2:pdflabel:${f.sha || f.name}`, label);
        return label;
      }
    } catch {}
    return f.name;
  }
  async function enrichLabels() {
    const sel = document.getElementById("dergiSelect");
    for (let i = 0; i < foundPdfs.length; i++) {
      const opt = sel.querySelector(`option[data-ix="${i}"]`);
      if (!opt || pdfLabelCache(foundPdfs[i])) continue;
      opt.textContent = foundPdfs[i].name + " — okunuyor…";
      const label = await pdfLabel(foundPdfs[i]); // sırayla: worker'ı boğmamak için
      if (opt) opt.textContent = label;
    }
  }

  /* ---- pdf.js ile açma ---- */
  async function openPdf(url) {
    const pdfjs = window.pdfjsLib;
    pdfjs.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
    return pdfjs.getDocument({ url }).promise;
  }

  /* ---- sayfa 1: iki sütunlu düzen ---- */
  async function extractColumns(doc) {
    const page = await doc.getPage(1);
    const vp = page.getViewport({ scale: 1 });
    const mid = vp.width / 2;
    const tc = await page.getTextContent();
    const cols = { L: new Map(), R: new Map() };
    for (const it of tc.items) {
      if (!it.str.trim()) continue;
      const x = it.transform[4], y = Math.round(it.transform[5] / 4) * 4;
      const side = x < mid ? "L" : "R";
      if (!cols[side].has(y)) cols[side].set(y, []);
      cols[side].get(y).push({ x, s: it.str });
    }
    const lines = (m) => [...m.entries()].sort((a, b) => b[0] - a[0])
      .map(([, items]) => items.sort((a, b) => a.x - b.x).map((i) => i.s).join(" ").replace(/\s+/g, " ").trim());
    return lines(cols.L).concat(lines(cols.R));
  }

  /* ---- sayfa 2..N: "PERFORMANSLAR" — tek sütun akışı halinde satır çıkarma ---- */
  async function extractPageLines(doc, pageNo) {
    const page = await doc.getPage(pageNo);
    const tc = await page.getTextContent();
    const rows = new Map();
    for (const it of tc.items) {
      if (!it.str.trim()) continue;
      const x = it.transform[4], y = Math.round(it.transform[5] / 3) * 3;
      if (!rows.has(y)) rows.set(y, []);
      rows.get(y).push({ x, s: it.str });
    }
    return [...rows.entries()].sort((a, b) => b[0] - a[0])
      .map(([, items]) => items.sort((a, b) => a.x - b.x).map((i) => i.s).join(" ").replace(/\s+/g, " ").trim());
  }

  /* at başlığı: "1. BİLGÜCÜ (KÇ-OU) 2y d.d (...)..."
   * geçmiş koşu satırı: "06.01.26 Ad.1400K 58 E.Çankaya 1(1.30.22)(1.30.22 Lupelıus58)yr(...) (11/3-545)(M)9GD"
   * en altta en son koşu (satırlar eskiden yeniye sıralı basılıyor). */
  function parseGecmis(lines) {
    const horses = {}; // temizle(ad) -> [{tarih,hipodrom,mesafe,pist,kilo,pos,derece,ikr}] eskiden yeniye
    const headerRe = /^(\d{1,2})\.\s+([A-ZÇĞİÖŞÜ][A-ZÇĞİÖŞÜ'\-\s]{2,40}?)\s+\(/;
    const histRe = /^(\d{2})\.(\d{2})\.(\d{2})\s+([A-Za-zÇĞİÖŞÜçğıöşü]{1,3})\.(\d{3,4})(K|Ç)/;
    let currentKey = null;
    for (const line of lines) {
      const mHist = line.match(histRe);
      if (mHist) {
        if (!currentKey) continue;
        const rest = line.slice(mHist[0].length);
        const mk = rest.match(/^\s*(?:[A-Za-zÇĞİÖŞÜçğıöşü]{1,4}\.?\s+)?(\d{1,3}(?:[.,]\d)?)\s+/);
        const kilo = mk ? parseFloat(mk[1].replace(",", ".")) : null;
        const mp = rest.match(/(\d{1,2})\((\d+(?:\.\d+){1,2})\)/);
        let derece = null;
        if (mp) {
          const parts = mp[2].split(".").map(Number);
          derece = parts.length >= 3 ? parts[0] * 60 + parts[1] + parts[2] / 100 : parts[0] + (parts[1] || 0) / 100;
        }
        const purseMatches = [...rest.matchAll(/\((\d{1,2})\/(\d{1,2})-(\d{2,4})\)/g)];
        const ikr = purseMatches.length ? +purseMatches[purseMatches.length - 1][3] * 1000 : null;
        const yil = 2000 + (+mHist[3]);
        (horses[currentKey] = horses[currentKey] || []).push({
          tarih: `${yil}-${mHist[2]}-${mHist[1]}`,
          hipodrom: mHist[4], mesafe: +mHist[5], pist: mHist[6],
          kilo, pos: mp ? +mp[1] : null, derece, ikr,
        });
        continue;
      }
      const mHeader = line.match(headerRe);
      if (mHeader) currentKey = temizle(mHeader[2]);
    }
    return horses;
  }

  /* ---- ayrıştırıcı ---- */
  function parseDergi(lines) {
    const d = { date: null, city: null, races: {}, tahmin: {}, banko: [], kuponlar: [] };
    const all = lines.join("\n");

    // tarih + şehir: "6 TEMMUZ PAZARTESİ BURSA YARIŞLARI"
    let m = all.match(/(\d{1,2})\s+(OCAK|ŞUBAT|MART|NİSAN|MAYIS|HAZİRAN|TEMMUZ|AĞUSTOS|EYLÜL|EKİM|KASIM|ARALIK)\s+\S+\s+([A-ZÇĞİÖŞÜ]+)\s+YARIŞLARI/);
    if (m) {
      const yil = (all.match(/\b(20\d\d)\b/) || [])[1] || new Date().getFullYear();
      d.date = `${yil}-${String(AYLAR[m[2]]).padStart(2, "0")}-${String(+m[1]).padStart(2, "0")}`;
      d.city = m[3];
    }

    let raceNo = 0;
    for (const line of lines) {
      // tahmin satırı: "1.KOŞU : 6-7 10-4-1-8 5-2-9-3" (önce denenir)
      const mt = line.match(/(\d{1,2})\.KOŞU\s*:\s*([\d()\- ]+)/);
      // koşu başlığı: "8.KOŞU" tek başına VEYA "SAAT:" ile aynı satır grubunda
      const mr = line.match(/(\d{1,2})\.KOŞU/);
      if (!mt && mr && (/SAAT\s*:/.test(line) || !line.includes(":"))) {
        raceNo = +mr[1];
        if (!d.races[raceNo]) d.races[raceNo] = { horses: {} };
        continue;
      }
      if (mt) {
        const grup = mt[2].trim().split(/\s+/).map((g) => g.replace(/\(\d+\)/g, "").split("-").map(Number).filter(Boolean));
        d.tahmin[+mt[1]] = { favori: grup[0] || [], plase: grup[1] || [], surpriz: grup[2] || [] };
        continue;
      }

      // banko: "2.Koşu : AMONI (3)"
      for (const mb of line.matchAll(/(\d{1,2})\.Koşu\s*:\s*([A-ZÇĞİÖŞÜ' ]+?)\s*\((\d{1,2})\)/g)) {
        d.banko.push({ race: +mb[1], ad: mb[2].trim(), no: +mb[3] });
      }

      // at satırı: "160 1 BİLGÜCÜ GDSK 57 M.M.BİLGİN ... 47"  → gp, no, ad, ortP
      if (raceNo) {
        const mh = line.match(/^(\d{2,3}|Ekr)\s+(\d{1,2})\s+([A-ZÇĞİÖŞÜ][A-ZÇĞİÖŞÜ'\- ]+?)\s+(?:[A-Z]{1,6}\s+)?\d{2}(?:\.\d)?\s+/);
        if (mh) {
          const nums = line.match(/(\d+)\s*$/);
          d.races[raceNo].horses[+mh[2]] = {
            no: +mh[2], ad: mh[3].trim(),
            gp: mh[1] === "Ekr" ? null : +mh[1],
            ortP: nums ? +nums[1] : null,
          };
        }
      }
    }
    return d;
  }

  /* ---- görünüm ---- */
  function render() {
    const el = document.getElementById("dergiView");
    if (!current) { el.innerHTML = `<div class="empty-note">Henüz PDF okunmadı.</div>`; return; }
    const d = current;
    let html = `<div class="race-card"><header><h3>📖 ${AB.esc(d.city || "?")} — ${AB.esc(d.date || "?")}</h3>
      <span class="race-tags">${Object.keys(d.races).length} koşu bulundu</span></header>`;
    if (d.banko.length) {
      html += `<div class="payout">⭐ GÜNÜN BANKOLARI: ${d.banko.map((b) => `${b.race}.Koşu ${AB.esc(b.ad)} (${b.no})`).join(" · ")}</div>`;
    }
    html += `<div class="table-wrap"><table><thead><tr><th>Koşu</th><th>Favori</th><th>Plase</th><th>Sürpriz</th><th>Gazete puanı ilk 3 (GP)</th></tr></thead><tbody>`;
    const raceNos = Object.keys(d.races).map(Number).sort((a, b) => a - b);
    for (const rn of raceNos) {
      const t = d.tahmin[rn] || {};
      const top = Object.values(d.races[rn].horses)
        .filter((h) => h.gp != null).sort((a, b) => b.gp - a.gp).slice(0, 3)
        .map((h) => `${h.no} ${AB.esc(h.ad)} (${h.gp})`).join(", ");
      html += `<tr><td><b>${rn}</b></td><td class="hit">${(t.favori || []).join("-") || "·"}</td>
        <td>${(t.plase || []).join("-") || "·"}</td><td class="miss">${(t.surpriz || []).join("-") || "·"}</td><td>${top || "·"}</td></tr>`;
    }
    el.innerHTML = html + `</tbody></table></div></div>`;
  }

  /* ---- puanlamaya uygulama: B6 (GP sırası) + B11 (favori/plase/sürpriz) ---- */
  function apply() {
    if (!current) return alert("Önce PDF'i okuyun.");
    if (!AB.state.legs.length) return alert("Önce Puanlama sekmesinde programı yükleyin.");
    if (current.city && AB.state.city && AB.slugify(current.city) !== AB.state.city) {
      document.getElementById("dergiInfo").textContent = `⚠️ Uygulanmadı: dergi ${current.city} (${current.date}) için, ama üstte seçili program farklı. Üst bardan doğru gün/hipodromu seçip programı yükleyin.`;
      return;
    }
    let dokunulan = 0;
    for (const leg of AB.state.legs) {
      const race = current.races[leg.raceNo];
      const t = current.tahmin[leg.raceNo] || {};
      if (!race) continue;
      // B6: gazete puanı (GP) en yüksek 5 at → 100,70,50,30,10
      const sirali = leg.horses
        .map((h) => ({ h, gp: race.horses[h.no]?.gp ?? -1 }))
        .filter((x) => x.gp >= 0).sort((a, b) => b.gp - a.gp);
      sirali.slice(0, 5).forEach((x, i) => { x.h.scores.B6 = AB.RANK5[i]; dokunulan++; });
      // B11: favori 100 / plase 60 / sürpriz 30
      for (const h of leg.horses) {
        if ((t.favori || []).includes(h.no)) { h.scores.B11 = 100; dokunulan++; }
        else if ((t.plase || []).includes(h.no)) { h.scores.B11 = 60; dokunulan++; }
        else if ((t.surpriz || []).includes(h.no)) { h.scores.B11 = 30; dokunulan++; }
      }
    }
    AB.saveSession();
    AB.renderAll();
    document.getElementById("dergiInfo").textContent = `✅ ${dokunulan} puan hücresi dergi verisiyle dolduruldu (B6 + B11). Puanlama sekmesinden kontrol edebilirsiniz.`;
  }

  /* ---- puanlamaya uygulama: gazetenin geçmiş performans tablolarından B1/B2/B3/B12/B15 ---- */
  function ortalamaPos(hist, key, val) {
    const arr = hist.filter((r) => r.pos && r[key] === val).map((r) => r.pos);
    return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
  }

  function applyGecmis() {
    if (!current || !current.gecmis) return alert("Önce PDF'i okuyun (geçmiş performans verisi bulunamadı — sayfa 2+ okunamamış olabilir).");
    if (!AB.state.legs.length) return alert("Önce Puanlama sekmesinde programı yükleyin.");
    let dokunulan = 0;
    const yaz = (h, k, v) => { if (v != null && h.scores[k] == null) { h.scores[k] = v; dokunulan++; } };
    for (const leg of AB.state.legs) {
      const curIkr = parseFloat((AB.state.program?.races.find((r) => r.no === leg.raceNo)?.ikramiye || "").replace(/\./g, "").replace(",", ".")) || null;
      const curMesafe = parseInt(leg.mesafe) || null;
      const curPist = /çim|cim/i.test(leg.pist || "") ? "Ç" : /kum/i.test(leg.pist || "") ? "K" : null;
      const curMesafeBucket = curMesafe ? Math.round(curMesafe / 200) * 200 : null;
      for (const h of leg.horses) {
        const hist = current.gecmis[temizle(h.ad)];
        if (!hist || !hist.length) continue;
        const son = hist[hist.length - 1]; // en son koşu (satırlar eskiden yeniye basılı)

        // B1: ikramiye düşüşü
        if (son.ikr && curIkr) {
          if (son.ikr > curIkr * 1.3) yaz(h, "B1", 100);
          else if (son.ikr > curIkr) yaz(h, "B1", 60);
          else if (Math.abs(son.ikr - curIkr) < 1) yaz(h, "B1", 20);
        }
        // B12: mesafe ayarı (son koşusu bugünkünden uzunsa)
        if (son.mesafe && curMesafe && son.mesafe > curMesafe) {
          const f = son.mesafe - curMesafe;
          yaz(h, "B12", f >= 300 && f <= 600 ? 100 : f === 200 ? 80 : f === 100 ? 60 : null);
        }
        // B15: kilo farkı
        const curK = parseFloat((h.meta?.kilo || "").replace(",", ".")) || null;
        if (son.kilo && curK) {
          const f = Math.abs(curK - son.kilo);
          yaz(h, "B15", f <= 2.5 ? 100 : f <= 4 ? 60 : f <= 5 ? 30 : null);
        }
        // B2: mesafe uygunluğu — bugünkü mesafe bucket'ındaki ort. derece, son koşunun bucket'ından iyiyse
        if (curMesafeBucket && son.mesafe) {
          const aToday = ortalamaPos(hist, "mesafe", curMesafeBucket);
          const aSon = ortalamaPos(hist, "mesafe", Math.round(son.mesafe / 200) * 200);
          if (aToday != null && aSon != null) {
            if (aToday < aSon - 0.3) yaz(h, "B2", 100);
            else if (Math.abs(aToday - aSon) <= 0.3) yaz(h, "B2", 60);
            else yaz(h, "B2", 20);
          }
        }
        // B3: pist uygunluğu — aynı mantık, pist tipine göre
        if (curPist && son.pist && curPist !== son.pist) {
          const aToday = ortalamaPos(hist, "pist", curPist);
          const aSon = ortalamaPos(hist, "pist", son.pist);
          if (aToday != null && aSon != null) {
            if (aToday < aSon - 0.3) yaz(h, "B3", 100);
            else if (Math.abs(aToday - aSon) <= 0.3) yaz(h, "B3", 60);
            else yaz(h, "B3", 20);
          }
        }
      }
    }
    AB.saveSession();
    AB.renderAll();
    document.getElementById("dergiInfo").textContent = `✅ ${dokunulan} puan hücresi gazetenin geçmiş performans tablolarından dolduruldu (B1,B2,B3,B12,B15). B2/B3 ortalama dereceye dayalı tahmindir — Puanlama sekmesinden kontrol edin.`;
  }

  /* ---- olaylar ---- */
  document.getElementById("btnDergiParse").onclick = async () => {
    const url = document.getElementById("dergiSelect").value;
    if (!url) return alert("Önce repoya PDF yükleyin.");
    document.getElementById("dergiInfo").textContent = "PDF okunuyor…";
    try {
      const doc = await openPdf(url);
      const lines = await extractColumns(doc);
      current = parseDergi(lines);
      current.gecmis = {};
      for (let p = 2; p <= doc.numPages; p++) {
        const pLines = await extractPageLines(doc, p);
        const pGecmis = parseGecmis(pLines);
        for (const key of Object.keys(pGecmis)) {
          current.gecmis[key] = (current.gecmis[key] || []).concat(pGecmis[key]);
        }
      }
      // birden fazla bölümde geçen aynı ada ait satırlar birleşince tarih sırası bozulabilir — garantiye al
      for (const key of Object.keys(current.gecmis)) {
        current.gecmis[key].sort((a, b) => (a.tarih < b.tarih ? -1 : a.tarih > b.tarih ? 1 : 0));
      }
      const atSayisi = Object.keys(current.gecmis).length;
      AB.LS.set(`ab2:dergi:${current.date}:${AB.slugify(current.city || "")}`, current);
      document.getElementById("dergiInfo").textContent = `✅ Okundu: ${current.city} ${current.date} — ${Object.keys(current.races).length} koşu, ${Object.keys(current.tahmin).length} tahmin satırı, ${current.banko.length} banko, ${atSayisi} at için geçmiş performans.`;
      // okunan PDF'in şehir+tarih etiketini kalıcı cache'le ve listede güncelle
      const fMatch = foundPdfs.find((x) => x.url === url);
      if (fMatch && (current.city || current.date)) {
        const label = `${current.city || "?"} — ${trTarih(current.date) || "?"}  (${fMatch.name})`;
        AB.LS.set(`ab2:pdflabel:${fMatch.sha || fMatch.name}`, label);
        const opt = document.querySelector(`#dergiSelect option[data-ix="${foundPdfs.indexOf(fMatch)}"]`);
        if (opt) opt.textContent = label;
      }
      render();
    } catch (e) {
      document.getElementById("dergiInfo").textContent = "❌ PDF okunamadı: " + e.message;
    }
  };
  document.getElementById("btnDergiApply").onclick = apply;
  document.getElementById("btnDergiGecmis").onclick = applyGecmis;
  document.getElementById("btnDergiLabel").onclick = async () => {
    const b = document.getElementById("btnDergiLabel");
    b.disabled = true; const t = b.textContent; b.textContent = "🏷️ Etiketleniyor…";
    try { await enrichLabels(); } finally { b.textContent = t; b.disabled = false; }
  };

  listPdfs();
  render();
})();


/* ===== İstatistik motoru: birikmiş sonuç verisinden otomatik puanlama =====
 * data/ klasöründeki geçmiş sonuçlardan sahip/antrenör/jokey istatistikleri
 * ve at geçmişleri çıkarır; A1-A3, B1, B5, B6, B9, B12, B14, B15, B16-B18, C1, C3 doldurur.
 * B6 (tahmini derece) gecmis sürelerinden par-süre modeliyle, B9 (pace senaryosu)
 * accurace koşu-karakter profillerinden (data/atlar/) gelir. */
(function () {
  const AB = window.AB;
  if (!AB) return;
  const GUN = 24 * 60 * 60 * 1000;

  // Puanlama sekmesine düğme
  const btn = document.createElement("button");
  btn.id = "btnFullAuto";
  btn.className = "btn btn-accent";
  btn.textContent = "🤖 Tam otomatik (tüm ayaklar)";
  document.getElementById("btnAutoScore").after(btn);

  async function loadHistory() {
    const idx = await fetch("data/index.json", { cache: "no-store" }).then((r) => r.json());
    const days = Object.keys(idx.days || {}).sort().slice(-30);
    const horse = {}, sahip = {}, antrenor = {}, jokey = {};
    for (const day of days) {
      for (const c of idx.days[day]) {
        const s = await fetch(`data/${day}/sonuclar-${c.slug}.json`, { cache: "no-store" }).then((r) => r.ok ? r.json() : null).catch(() => null);
        if (!s) continue;
        for (const race of s.races) {
          const ikr = parseFloat((race.ikramiye || "").replace(/\./g, "").replace(",", ".")) || null;
          let pos = 0;
          for (const h of race.horses) {
            if (/koşmaz/i.test(h.derece || "") || /koşmaz/i.test(h.ad)) continue;
            pos++;
            const ad = temizle(h.ad);
            (horse[ad] = horse[ad] || []).push({
              date: day, pos, mesafe: parseInt(race.mesafe) || null, pist: race.pist || "",
              kilo: parseFloat((h.kilo || "").replace(",", ".")) || null, ikr,
              fark: h.fark || "",
            });
            for (const [map, key] of [[sahip, h.sahip], [antrenor, h.antrenor], [jokey, h.jokey]]) {
              const k = (key || "").trim().toUpperCase();
              if (!k) continue;
              const st = (map[k] = map[k] || { puan: 0, kosu: 0, win: 0, lastDate: null, lastPos: null });
              st.kosu++;
              if (pos === 1) { st.puan += 4; st.win++; }
              else if (pos === 2) st.puan += 2;
              else if (pos === 3) st.puan += 1;
              if (!st.lastDate || day >= st.lastDate) { st.lastDate = day; st.lastPos = pos; }
            }
          }
        }
      }
    }
    return { horse, sahip, antrenor, jokey, gunSayisi: days.length };
  }

  // B9 için: programdaki her atın accurace koşu-karakter profilini (data/atlar/) çeker.
  async function loadAtProfilleri(legs) {
    const slugs = new Set();
    for (const leg of legs) for (const h of leg.horses) { const s = slugAt(h.ad); if (s) slugs.add(s); }
    const prof = {};
    await Promise.all([...slugs].map(async (sl) => {
      const p = await fetch(`data/atlar/${sl}.json`, { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null)).catch(() => null);
      if (p) prof[sl] = p;
    }));
    return prof;
  }

  // B6 tahmini derece: gecmis-{city}.json'daki bitiriş sürelerinden (derece)
  // mesafe+pist bazlı "par süre" çıkarır, her atın par'a göre reytingini bulur,
  // bugünkü mesafe/pist için tahmini süreyi hesaplar (düşük = hızlı = iyi).
  async function loadTahminiDerece() {
    const g = await fetch(`data/${AB.state.day}/gecmis-${AB.state.city}.json`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null)).catch(() => null);
    if (!g) return null;
    const median = (a) => {
      if (!a.length) return null;
      const s = [...a].sort((x, y) => x - y); const m = s.length >> 1;
      return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
    };
    const pnorm = (p) => (p || "").trim().charAt(0).toUpperCase();
    // Tüm koşuları düz liste + (mesafe|pist) medyan par
    const tumu = [], parGrup = {};
    for (const kosular of Object.values(g)) {
      for (const k of kosular) {
        if (k.derece == null || !k.mesafe) continue;
        const p = pnorm(k.pist);
        tumu.push({ mes: k.mesafe, p, d: k.derece });
        const key = `${k.mesafe}|${p}`;
        (parGrup[key] = parGrup[key] || []).push(k.derece);
      }
    }
    const parMed = {};
    for (const key in parGrup) parMed[key] = median(parGrup[key]);
    const parLookup = (mes, p) => {
      if (!mes) return null;
      const key = `${mes}|${p}`;
      if (parMed[key] != null && parGrup[key].length >= 3) return parMed[key];
      let pool = tumu.filter((r) => r.p === p && Math.abs(r.mes - mes) <= 150);
      if (pool.length < 3) pool = tumu.filter((r) => Math.abs(r.mes - mes) <= 150);
      if (pool.length >= 3) return median(pool.map((r) => r.d));
      return parMed[key] != null ? parMed[key] : null;
    };
    // At reytingleri: temizle(ad) -> tüm deltalar + pist bazlı deltalar
    const reyting = {};
    for (const [ad, kosular] of Object.entries(g)) {
      const tum = [], byP = {};
      for (const k of kosular) {
        if (k.derece == null || !k.mesafe) continue;
        const p = pnorm(k.pist);
        const par = parLookup(k.mesafe, p);
        if (par == null) continue;
        const delta = k.derece - par;
        tum.push(delta);
        (byP[p] = byP[p] || []).push(delta);
      }
      if (tum.length) reyting[temizle(ad)] = { tum, byP };
    }
    const pred = (adKey, mes, p) => {
      const r = reyting[adKey], par = parLookup(mes, p);
      if (!r || par == null) return null;
      const same = r.byP[p];
      const rt = median(same && same.length >= 2 ? same : r.tum); // pist yatkınlığı: o piste ≥2 koşu varsa onu kullan
      return rt == null ? null : par + rt;
    };
    return { pred, pnorm };
  }

  function kisiPuani(st, bugun, gunESIK) {
    // A2/A3 ve B17/B18 tarzı: son koşan atın derecesi + kaç gün önce
    const out = {};
    if (st) {
      if (st.lastPos === 1) out.derece = 100; else if (st.lastPos === 2) out.derece = 60; else if (st.lastPos === 3) out.derece = 20;
      if (st.lastDate) {
        const g = Math.round((new Date(bugun) - new Date(st.lastDate)) / GUN);
        const [e1, e2, e3] = gunESIK;
        out.gun = g <= e1 ? 100 : g <= e2 ? 60 : g <= e3 ? 20 : 0;
      }
    }
    return out;
  }

  function listePuani(map, key) {
    // A1/B16: puan listesinde üst üçtelik 100, orta 60
    const st = map[(key || "").trim().toUpperCase()];
    if (!st || !st.puan) return null;
    const puanlar = Object.values(map).map((x) => x.puan).filter((p) => p > 0).sort((a, b) => b - a);
    const oran = puanlar.indexOf(st.puan) / Math.max(1, puanlar.length);
    return oran <= 0.34 ? 100 : oran <= 0.67 ? 60 : null;
  }

  async function tamOtomatik() {
    if (!AB.state.legs.length) return alert("Önce Puanlama sekmesinden programı yükleyin.");
    btn.textContent = "⏳ İstatistikler yükleniyor…";
    try {
      const H = await loadHistory();
      const atProf = await loadAtProfilleri(AB.state.legs);
      const tahmin = await loadTahminiDerece();
      const bugun = AB.state.day;
      // kariyer istatistikleri (TJK At İstatistikleri'nden, günlük çekilir)
      const kariyer = await fetch(`data/${AB.state.day}/atistatistik-${AB.state.city}.json`, { cache: "no-store" })
        .then((r) => r.ok ? r.json() : null).catch(() => null);
      // jokey sınıfları: kazanma yüzdesine göre çeyrekler (en az 3 koşusu olanlar)
      const jList = Object.entries(H.jokey).filter(([, s]) => s.kosu >= 3)
        .map(([k, s]) => [k, s.win / s.kosu]).sort((a, b) => b[1] - a[1]);
      const sinif = {};
      jList.forEach(([k], i) => { const q = i / Math.max(1, jList.length); sinif[k] = q <= 0.25 ? 1 : q <= 0.5 ? 2 : q <= 0.75 ? 3 : 4; });
      // bugünkü programda jokey başına koşu sayısı (C3)
      const binis = {};
      for (const leg of AB.state.legs) for (const h of leg.horses) {
        const j = (h.meta?.jokey || "").trim().toUpperCase();
        if (j) binis[j] = (binis[j] || 0) + 1;
      }

      let dolu = 0;
      let acbToplam = 0, acbYeter = 0; // accurace kapsamı: toplam at, ≥3 koşulu profil
      const yaz = (h, k, v) => { if (v != null && h.scores[k] == null) { h.scores[k] = v; dolu++; } };
      const rank5 = (list, key, asc) => {
        list.filter((x) => x.v != null).sort((a, b) => asc ? a.v - b.v : b.v - a.v)
          .slice(0, 5).forEach((x, i) => yaz(x.h, key, AB.RANK5[i]));
      };

      for (const leg of AB.state.legs) {
        const curIkr = parseFloat((AB.state.program?.races.find((r) => r.no === leg.raceNo)?.ikramiye || "").replace(/\./g, "").replace(",", ".")) || null;
        const b5 = [], b14 = [];
        for (const h of leg.horses) {
          const m = h.meta || {};
          const hist = (H.horse[temizle(h.ad)] || []).sort((a, b) => a.date < b.date ? 1 : -1);
          const son = hist[0];
          // sahip: A1, A2, A3
          yaz(h, "A1", listePuani(H.sahip, m.sahip));
          const sp = kisiPuani(H.sahip[(m.sahip || "").trim().toUpperCase()], bugun, [10, 20, 30]);
          yaz(h, "A2", sp.derece); yaz(h, "A3", sp.gun);
          // antrenör: B16, B17, B18
          yaz(h, "B16", listePuani(H.antrenor, m.antrenor));
          const ap = kisiPuani(H.antrenor[(m.antrenor || "").trim().toUpperCase()], bugun, [7, 14, 21]);
          yaz(h, "B17", ap.derece); yaz(h, "B18", ap.gun);
          // at geçmişi: B1, B12, B15
          if (son) {
            if (son.ikr && curIkr) {
              if (son.ikr > curIkr * 1.3) yaz(h, "B1", 100);
              else if (son.ikr > curIkr) yaz(h, "B1", 60);
              else if (Math.abs(son.ikr - curIkr) < 1) yaz(h, "B1", 20);
            }
            const curM = parseInt(leg.mesafe) || null;
            if (son.mesafe && curM && son.mesafe > curM) {
              const f = son.mesafe - curM;
              yaz(h, "B12", f >= 300 && f <= 600 ? 100 : f === 200 ? 80 : f === 100 ? 60 : null);
            }
            const curK = parseFloat((m.kilo || "").replace(",", ".")) || null;
            if (son.kilo && curK) {
              const f = Math.abs(curK - son.kilo);
              yaz(h, "B15", f <= 2.5 ? 100 : f <= 4 ? 60 : f <= 5 ? 30 : null);
            }
          }
          // B5: önce kariyer istatistiği (TJK At İstatistikleri), yoksa arşivden yaklaşık
          const ki = kariyer?.[temizle(h.ad)];
          if (ki && ki.kosu) {
            b5.push({ h, v: ki.p1 / ki.kosu });
          } else if (hist.length) {
            b5.push({ h, v: hist.filter((x) => x.pos === 1).length / hist.length });
          }
          // B14 (kısa farkla geçilen koşular)
          if (hist.length) {
            const kf = hist.filter((x) => x.pos <= 3 && /(BURUN|BAŞ|BOYUN|YARIM)/i.test(x.fark)).length;
            b14.push({ h, v: kf || null });
          }
          // jokey: C1, C3
          const j = (m.jokey || "").trim().toUpperCase();
          const sn = sinif[j];
          if (sn) yaz(h, "C1", sn === 1 ? 100 : sn === 2 ? 60 : sn === 3 ? 20 : 0);
          const b = binis[j] || 0;
          if (sn && b) yaz(h, "C3", b <= 2 ? (sn === 1 ? 100 : sn === 2 ? 80 : null) : b <= 4 ? (sn === 1 ? 60 : sn === 2 ? 30 : null) : null);
        }
        // B9: pace senaryosu ("koşturalım") — accurace koşu-karakter profillerinden.
        // erken_gec_delta_ema: negatif = önde koşan (öncü/kaçak), pozitif = kapanışçı.
        const stiller = leg.horses.map((h) => {
          acbToplam++;
          const p = atProf[slugAt(h.ad)];
          const yeter = p && (p.kosu_sayisi || 0) >= 3;
          if (yeter) acbYeter++;
          const d = yeter ? p.erken_gec_delta_ema : null;
          return { h, stil: d == null ? null : d <= -0.8 ? "oncu" : d >= 0.8 ? "kapanis" : "tempo" };
        });
        const oncuSayisi = stiller.filter((x) => x.stil === "oncu").length;
        for (const x of stiller) {
          if (x.stil === "oncu") {
            // Önü boş kaçak avantajlı; başka öncü rakip arttıkça tempo kızışır.
            const diger = oncuSayisi - 1;
            yaz(x.h, "B9", diger === 0 ? 100 : diger === 1 ? 60 : null);
          } else if (x.stil === "kapanis") {
            // Kızışan tempo (çok öncü) kapanışçının lehine çöker.
            yaz(x.h, "B9", oncuSayisi >= 3 ? 100 : oncuSayisi >= 2 ? 60 : null);
          }
        }
        // B6: tahmini derece — dergiden gelmişse (bir at bile doluysa) dokunma, yoksa hesapla.
        if (tahmin && !leg.horses.some((h) => h.scores.B6 != null)) {
          const tM = parseInt(leg.mesafe) || null;
          const tP = tahmin.pnorm(leg.pist);
          const b6 = [];
          for (const h of leg.horses) {
            const pred = tahmin.pred(temizle(h.ad), tM, tP);
            if (pred != null) b6.push({ h, v: pred });
          }
          rank5(b6, "B6", true); // düşük süre = hızlı = 100
        }
        rank5(b5, "B5", false);
        rank5(b14, "B14", false);
      }
      let b9Dolu = 0;
      for (const leg of AB.state.legs) for (const h of leg.horses) if (h.scores.B9 != null) b9Dolu++;
      const profBulunan = Object.keys(atProf).length;
      AB.saveSession();
      AB.renderAll();
      btn.textContent = "🤖 Tam otomatik (tüm ayaklar)";
      alert(`✅ ${dolu} puan hücresi ${H.gunSayisi} günlük sonuç arşivinden dolduruldu.\n(A1-A3 sahip, B16-B18 antrenör, C1/C3 jokey, B1 ikramiye, B5, B6 tahmini derece, B9 pace, B12, B14, B15)\n\n🏇 Accurace (B9 pace): ${profBulunan} atta profil bulundu, ${acbYeter}/${acbToplam} atta ≥3 koşuluk yeterli veri → ${b9Dolu} ayakta B9 dolduruldu.${acbYeter < acbToplam * 0.3 ? "\n⚠️ Accurace verisi henüz sığ; kapsam her günle artıyor." : ""}\n\nElle girdiğiniz puanların ÜZERİNE YAZILMADI. Arşiv büyüdükçe isabet artar.`);
    } catch (e) {
      btn.textContent = "🤖 Tam otomatik (tüm ayaklar)";
      alert("Hata: " + e.message);
    }
  }
  btn.onclick = tamOtomatik;
})();