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



/* ===== İstatistik motoru: birikmiş sonuç verisinden otomatik puanlama =====
 * data/ klasöründeki geçmiş sonuçlardan sahip/antrenör/jokey istatistikleri
 * ve at geçmişleri çıkarır; A1-A3, B1, B5, B12, B14, B15, B16-B18, C1, C3 doldurur. */
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

  const temizle = (ad) => (ad || "")
    .replace(/\s*\(.*?\)\s*/g, " ")
    .replace(/(\s+(KG|SKG|GDSK|DSGK|GKDSK|GKD|DSK|GSK|SGK|GDS|DSG|GKR|DB|SK|GD|GK|DS|KD|GM|KGD|G|K|D|M|S))+$/g, "")
    .trim().toUpperCase();

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
      const bugun = AB.state.day;
      const kariyer = await fetch(`data/${AB.state.day}/atistatistik-${AB.state.city}.json`, { cache: "no-store" })
        .then((r) => r.ok ? r.json() : null).catch(() => null);
      const idman = await fetch(`data/${AB.state.day}/idman-${AB.state.city}.json`, { cache: "no-store" }).then((r) => r.ok ? r.json() : null).catch(() => null);
      const jokeyYilJson = await fetch(`data/istatistik/jokey-${new Date().getFullYear()}.json`, { cache: "no-store" }).then((r) => r.ok ? r.json() : null).catch(() => null);
      const jokeyYil = jokeyYilJson ? Object.keys(jokeyYilJson).map((s) => s.toUpperCase()) : null;
      const gecmis = await fetch(`data/${AB.state.day}/gecmis-${AB.state.city}.json`, { cache: "no-store" }).then((r) => r.ok ? r.json() : null).catch(() => null);
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
          // B5 (gerçek kazanma yüzdesi) ve B14 (kısa farkla geçilen koşular)
          // Geçmiş koşulardan B2, B3, B4, B10 (+B1 yedeği)
          const gm = gecmis && gecmis[temizle(h.ad)];
          if (gm && gm.length) {
            const cur = parseInt(leg.mesafe) || 0;
            const pistH = (leg.pist || "").charAt(0).toUpperCase();
            const poz = (r) => parseInt(r.poz) || 10;
            const yakin = gm.filter((r) => Math.abs((parseInt(r.mesafe) || 0) - cur) <= 100);
            const uzak = gm.filter((r) => Math.abs((parseInt(r.mesafe) || 0) - cur) > 100);
            if (yakin.length && uzak.length) {
              const oy = yakin.reduce((s, r) => s + poz(r), 0) / yakin.length;
              const ou = uzak.reduce((s, r) => s + poz(r), 0) / uzak.length;
              yaz(h, "B2", oy < ou - 0.5 ? 100 : oy <= ou + 0.5 ? 60 : 20);
            }
            const ayni = gm.filter((r) => (r.pist || "").charAt(0).toUpperCase() === pistH);
            const diger = gm.filter((r) => (r.pist || "").charAt(0).toUpperCase() !== pistH);
            if (ayni.length && diger.length) {
              const oa = ayni.reduce((s, r) => s + poz(r), 0) / ayni.length;
              const od = diger.reduce((s, r) => s + poz(r), 0) / diger.length;
              yaz(h, "B3", oa < od - 0.5 ? 100 : oa <= od + 0.5 ? 60 : 20);
            }
            const trh = (s) => { const pp = (s || "").split("."); return new Date(pp[2] + "-" + pp[1] + "-" + pp[0]); };
            const gunler = [new Date(bugun)].concat(gm.slice(0, 6).map((r) => trh(r.t)));
            let araIx = -1, araGun = 0;
            for (let gi = 1; gi < gunler.length; gi++) {
              const f = Math.round((gunler[gi - 1] - gunler[gi]) / GUN);
              if (f >= 20) { araIx = gi; araGun = f; break; }
            }
            if (araIx > 0) {
              const sonra = araIx;
              const ok = araGun >= 45 ? (sonra >= 3 && sonra <= 6) : araGun >= 30 ? (sonra >= 2 && sonra <= 5) : (sonra >= 2 && sonra <= 4);
              if (ok) yaz(h, "B4", 100);
            } else {
              const winIx = gm.slice(0, 6).findIndex((r) => poz(r) === 1);
              if (winIx >= 0) yaz(h, "B4", winIx < 2 ? 100 : winIx < 4 ? 60 : 20);
            }
            const bugunEk = h.ad.toUpperCase().replace(temizle(h.ad), "").replace(/[^A-Z]/g, "");
            const sonEk = (gm[0].ekipman || "").toUpperCase().replace(/[^A-Z]/g, "");
            if (bugunEk !== sonEk) yaz(h, "B10", 100);
            if (curIkr) {
              const sonIkr = parseFloat((gm[0].ikr || "").replace(/\./g, "").replace(",", ".")) || null;
              if (sonIkr) {
                if (sonIkr > curIkr * 1.3) yaz(h, "B1", 100);
                else if (sonIkr > curIkr) yaz(h, "B1", 60);
                else if (Math.abs(sonIkr - curIkr) < 1) yaz(h, "B1", 20);
              }
            }
          }
          const idm = idman && idman[temizle(h.ad)];
          if (idm) {
            for (const w of idm) {
              const p = (w.t || "").split(".");
              if (p.length !== 3) continue;
              const g = Math.round((new Date(bugun) - new Date(p[2] + "-" + p[1] + "-" + p[0])) / GUN);
              const uzun = ((w.m1000 || "") + (w.m1200 || "") + (w.m1400 || "")).trim();
              if (uzun && /galop/i.test(w.tur || "") && g >= 3 && g <= 7) {
                if (g > 3 || /R/.test(w.durum || "")) { yaz(h, "B7", 100); break; }
              }
            }
          }
          const ki = kariyer && kariyer[temizle(h.ad)];
          if (ki && ki.kosu) b5.push({ h, v: ki.p1 / ki.kosu });
          else if (hist.length) b5.push({ h, v: hist.filter((x) => x.pos === 1).length / hist.length });
          if (hist.length) {
            const kf = hist.filter((x) => x.pos <= 3 && /(BURUN|BAŞ|BOYUN|YARIM)/i.test(x.fark)).length;
            b14.push({ h, v: kf || null });
          }
          // jokey: C1, C3
          const j = (m.jokey || "").trim().toUpperCase();
          let sn = sinif[j];
          if (jokeyYil) { const ix = jokeyYil.indexOf(j); sn = ix < 0 ? 4 : ix < 15 ? 1 : ix < 35 ? 2 : 3; }
          if (sn) yaz(h, "C1", sn === 1 ? 100 : sn === 2 ? 60 : sn === 3 ? 20 : 0);
          const b = binis[j] || 0;
          if (sn && b) yaz(h, "C3", b <= 2 ? (sn === 1 ? 100 : sn === 2 ? 80 : null) : b <= 4 ? (sn === 1 ? 60 : sn === 2 ? 30 : null) : null);
          // C2: jokey değişimi (geçmişteki kısaltmayı yıllık listeyle eşle)
          if (gm && gm.length && sn && sn < 4 && jokeyYil) {
            const km = (gm[0].jokey || "").trim().toUpperCase().match(/^([A-ZÇĞİÖŞÜ])[A-ZÇĞİÖŞÜ]*\.\s*([A-ZÇĞİÖŞÜ]+)$/);
            let eski = 4;
            if (km) { const ix2 = jokeyYil.findIndex((n) => n.startsWith(km[1]) && n.endsWith(" " + km[2])); eski = ix2 < 0 ? 4 : ix2 < 15 ? 1 : ix2 < 35 ? 2 : 3; }
            if (eski >= 3 && sn === 1) yaz(h, "C2", 100);
            else if (eski === 2 && sn === 1) yaz(h, "C2", 60);
            else if (eski === 3 && sn === 2) yaz(h, "C2", 20);
          }
        }
        rank5(b5, "B5", false);
        rank5(b14, "B14", false);
      }
      AB.saveSession();
      AB.renderAll();
      btn.textContent = "🤖 Tam otomatik (tüm ayaklar)";
      alert(`✅ ${dolu} puan hücresi ${H.gunSayisi} günlük sonuç arşivinden dolduruldu.\n(A1-A3 sahip, B16-B18 antrenör, C1/C3 jokey, B1 ikramiye, B5, B12, B14, B15)\nElle girdiğiniz puanların ÜZERİNE YAZILMADI. Arşiv büyüdükçe isabet artar.`);
    } catch (e) {
      btn.textContent = "🤖 Tam otomatik (tüm ayaklar)";
      alert("Hata: " + e.message);
    }
  }
  btn.onclick = tamOtomatik;
})();