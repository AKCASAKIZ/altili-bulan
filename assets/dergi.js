/* ===== Yarış Gazetesi PDF entegrasyonu =====
 * Repodaki PDF'leri (kök ve dergi/ klasörü) GitHub API'den listeler,
 * pdf.js ile tarayıcıda ayrıştırır, tahminleri puanlamaya uygular. */
"use strict";
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
      <div class="toolbar-right">
        <button id="btnDergiParse" class="btn">📖 PDF'i oku</button>
        <button id="btnDergiApply" class="btn btn-accent">⚡ Puanlamaya uygula (B6+B11)</button>
      </div>
    </div>
    <p class="hint" id="dergiInfo">Yarış Gazetesi PDF'ini GitHub reposuna yükleyin (kök veya <b>dergi/</b> klasörü) — burada otomatik listelenir. "PDF'i oku" gazetenin puanlarını, FAVORİ/PLASE/SÜRPRİZ tahminlerini ve banko atları çıkarır. "Puanlamaya uygula": gazete puanı en yüksek 5 ata <b>B6</b> (100,70,50,30,10), favorilere <b>B11</b>=100, plaselere 60, sürprizlere 30 yazar.</p>
    <div id="dergiView"></div>`;
  document.querySelector("main").appendChild(pane);

  tabBtn.onclick = () => {
    document.querySelectorAll(".tab").forEach((x) => x.classList.toggle("active", x === tabBtn));
    document.querySelectorAll(".tab-pane").forEach((p) => p.classList.toggle("active", p.id === "tab-dergi"));
  };

  let current = null; // ayrıştırılmış dergi verisi

  /* ---- repo PDF listesi ---- */
  async function listPdfs() {
    const sel = document.getElementById("dergiSelect");
    const found = [];
    for (const path of ["", "dergi"]) {
      try {
        const r = await fetch(`https://api.github.com/repos/${REPO}/contents/${path}`, { cache: "no-store" });
        if (!r.ok) continue;
        for (const f of await r.json()) {
          if (f.type === "file" && /\.pdf$/i.test(f.name)) found.push({ name: f.name, url: f.download_url });
        }
      } catch {}
    }
    sel.innerHTML = found.length
      ? found.map((f) => `<option value="${AB.esc(f.url)}">${AB.esc(f.name)}</option>`).join("")
      : `<option value="">PDF bulunamadı — repoya yükleyin</option>`;
  }

  /* ---- pdf.js ile metin çıkarma (sayfa 1, iki sütunlu düzen) ---- */
  async function extractColumns(url) {
    const pdfjs = window.pdfjsLib;
    pdfjs.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
    const doc = await pdfjs.getDocument({ url }).promise;
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
      const mr = line.match(/(\d{1,2})\.KOŞU/);
      // koşu başlığı (tahmin bölümündeki "N.KOŞU : ..." satırlarıyla karışmasın)
      if (mr && !line.includes(":")) { raceNo = +mr[1]; if (!d.races[raceNo]) d.races[raceNo] = { horses: {} }; continue; }

      // tahmin satırı: "1.KOŞU : 6-7 10-4-1-8 5-2-9-3"
      const mt = line.match(/(\d{1,2})\.KOŞU\s*:\s*([\d()\- ]+)/);
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

  /* ---- olaylar ---- */
  document.getElementById("btnDergiParse").onclick = async () => {
    const url = document.getElementById("dergiSelect").value;
    if (!url) return alert("Önce repoya PDF yükleyin.");
    document.getElementById("dergiInfo").textContent = "PDF okunuyor…";
    try {
      const lines = await extractColumns(url);
      current = parseDergi(lines);
      AB.LS.set(`ab2:dergi:${current.date}:${AB.slugify(current.city || "")}`, current);
      document.getElementById("dergiInfo").textContent = `✅ Okundu: ${current.city} ${current.date} — ${Object.keys(current.races).length} koşu, ${Object.keys(current.tahmin).length} tahmin satırı, ${current.banko.length} banko.`;
      render();
    } catch (e) {
      document.getElementById("dergiInfo").textContent = "❌ PDF okunamadı: " + e.message;
    }
  };
  document.getElementById("btnDergiApply").onclick = apply;

  listPdfs();
  render();
})();
