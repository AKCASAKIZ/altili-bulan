/* ===== Altılı Bulan v2 — puanlama motoru ===== */
"use strict";

/* --- 25 kriter (angle) tanımı — katsayılar kılavuzdaki yüzdelerle tutarlı olacak şekilde düzeltildi (toplam %100) --- */
const ANGLES = [
  { k: "A1", name: "Başarılı at sahibi", pct: 2.00, desc: "İlk 3'e giren atların sahiplerinin listesi. Üst sıradakine 100, ortadakine 60." },
  { k: "A2", name: "Sahibin son koşan atı: derece", pct: 3.20, desc: "At sahibinin son koşan atı 1. ise 100, 2. ise 60, 3. ise 20." },
  { k: "A3", name: "Sahibin son koşan atı: kaç gün önce", pct: 2.80, desc: "≤10 gün: 100, ≤20 gün: 60, ≤30 gün: 20." },
  { k: "B1", name: "Purse drop (ikramiye düşüşü)", pct: 6.20, desc: "Son koşusu şimdikinden çok daha yüksek ikramiyeliyse 100, az farkla yüksekse 60, aynıysa 20." },
  { k: "B2", name: "Distance switch (mesafe uygunluğu)", pct: 3.10, desc: "Daha uygun mesafede koşuyorsa 100/60/20. Otomatik: 2 yıllık kariyerin mesafe grubu (kısa/orta/uzun) kırılımında bugünkü grubun ilk-3 oranı diğerlerinden iyiyse." },
  { k: "B3", name: "Surface switch (pist uygunluğu)", pct: 4.03, desc: "Daha yatkın olduğu pistte koşuyorsa 100/60/20. Otomatik: 2 yıllık kariyerin pist kırılımında bugünkü pistin ilk-3 oranı diğerlerinden iyiyse." },
  { k: "B4", name: "Racing cycle (koşu sıklığı)", pct: 3.72, desc: "Aradan dönüş sonrası uygun koşu sırası 100; arasızsa son galibiyetin yakınlığına göre 100/60/20." },
  { k: "B5", name: "Wins (kazanma yüzdesi)", pct: 6.82, desc: "Kazanma yüzdesi en yüksek ilk 5 at: 100,70,50,30,10." },
  { k: "B6", name: "Tahmini derece", pct: 7.44, desc: "En iyi 5 tahmini dereceye sahip atlar: 100,70,50,30,10." },
  { k: "B7", name: "Superior workout (idman)", pct: 2.17, desc: "Son 7 günde ≥1000 m galop: 100 (son 2 günde yapılmışsa puan yok)." },
  { k: "B8", name: "Son koşu tarihi", pct: 4.34, desc: "≤7 gün: 100, 8–10: 80, 11–15: 50, 16–21: 20." },
  { k: "B9", name: "Pace scenario (koşturalım)", pct: 3.10, desc: "Benzer stilde rakibi yoksa 100, az etkileniyorsa 60." },
  { k: "B10", name: "Equipment change (ekipman)", pct: 1.55, desc: "Son koşusuna göre farklı ekipmanla (M, K, KG, GM…) koşuyorsa 100." },
  { k: "B11", name: "Longshot / istikrar", pct: 1.86, desc: "Bomba: sürpriz galibiyetleri 2+ ise 100, 1 ise 60. İstikrar: üst üste ilk 3'e girme 4/3/2 kez → 100/60/10." },
  { k: "B12", name: "Mesafe ayarı (kısalma)", pct: 2.48, desc: "Son koşusu şimdikinden uzunsa: 300–600 m fark 100, 200 m 80, 100 m 60." },
  { k: "B13", name: "Son 6 koşu toplamı", pct: 3.72, desc: "Son 6 koşu derece toplamı en düşük ilk 5 at: 100,70,50,30,10." },
  { k: "B14", name: "Yarış karakteri (kafa farkı)", pct: 2.48, desc: "Baş/burun/boyun farkıyla geçtiği koşu sayısı en yüksek 5 at: 100,70,50,30,10." },
  { k: "B15", name: "Kilo farkı", pct: 2.17, desc: "Son koşusuna göre ±2.5 kg: 100, 3–4 kg: 60, 4.5–5 kg: 30." },
  { k: "B16", name: "Başarılı antrenör", pct: 3.41, desc: "Antrenör listesinde üst sıradakine 100, ortadakine 60." },
  { k: "B17", name: "Antrenörün son atı: derece", pct: 2.17, desc: "Antrenörün son koşan atı 1./2./3. ise 100/60/20." },
  { k: "B18", name: "Antrenörün son atı: kaç gün önce", pct: 1.24, desc: "≤7 gün: 100, ≤14: 60, ≤21: 20." },
  { k: "C1", name: "Top jokey", pct: 12.00, desc: "1. sınıf jokey 100, 2. sınıf 60, 3. sınıf/apranti 20." },
  { k: "C2", name: "Jockey switch", pct: 7.50, desc: "3–4. sınıftan 1. sınıfa geçiş 100, 2.→1. 60, 3.→2. 20." },
  { k: "C3", name: "Jokeyin o günkü koşu sayısı", pct: 7.50, desc: "≤2 koşuya binen 1. sınıf jokey 100, 2. sınıf 80; 3–4 koşu binen 1. sınıf 60, 2. sınıf 30." },
  { k: "C4", name: "En yüksek ödüllü jokey", pct: 3.00, desc: "Katıldığı koşuların ikramiye toplamı en yüksek 5 jokey: 100,70,50,30,10." },
  { k: "D1", name: "Koşu karakteri: kapanış gücü", pct: 2.50, desc: "Accurace checkpoint verisinden türetilen son_atak_delta_ema (1600m→bitiş sıra kazancı) en yüksek 5 at: 100,70,50,30,10." },
  { k: "D2", name: "Koşu karakteri: erken tempo", pct: 2.50, desc: "Accurace checkpoint verisinden türetilen erken_gec_delta_ema (öncü/kaçak eğilimi) en yüksek 5 at: 100,70,50,30,10." },
  { k: "E1", name: "Jokey kazanma % (arşiv)", pct: 3.00, desc: "2 yıllık sonuç arşivinden jokeyin gerçek kazanma yüzdesi. Koşudaki en yüksek 5 jokey: 100,70,50,30,10." },
  { k: "E2", name: "Antrenör kazanma % (arşiv)", pct: 2.00, desc: "2 yıllık sonuç arşivinden antrenörün gerçek kazanma yüzdesi. Koşudaki en yüksek 5: 100,70,50,30,10." },
  { k: "E3", name: "Kulvar avantajı (arşiv)", pct: 3.00, desc: "Hipodrom + pist + mesafe kırılımında start kulvarının 2 yıllık gerçek kazanma oranı. En avantajlı 5 kulvardaki atlar: 100,70,50,30,10." },
];
const PRESET6 = ["A3", "B1", "B2", "B3", "B6", "B13"];
const RANK5 = [100, 70, 50, 30, 10];

/* --- durum --- */
const state = {
  index: null, day: null, city: null,
  program: null, results: null, idman: null,
  legs: [], activeLeg: 0, picks: [],
  coefs: {}, enabled: {},
};
const $ = (s) => document.querySelector(s);
const LS = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};

/* ==================== BAŞLATMA ==================== */
init();
async function init() {
  // tema
  const theme = LS.get("ab2:theme", matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  document.documentElement.dataset.theme = theme;
  $("#themeToggle").onclick = () => {
    const t = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = t;
    LS.set("ab2:theme", t);
  };

  // katsayılar
  const savedCoefs = LS.get("ab2:coefs", null);
  const savedEnabled = LS.get("ab2:enabled", null);
  ANGLES.forEach((a) => {
    state.coefs[a.k] = savedCoefs?.[a.k] ?? a.pct / 100;
    state.enabled[a.k] = savedEnabled?.[a.k] ?? true;
  });

  // sekmeler
  document.querySelectorAll(".tab").forEach((b) => {
    b.onclick = () => {
      document.querySelectorAll(".tab").forEach((x) => x.classList.toggle("active", x === b));
      document.querySelectorAll(".tab-pane").forEach((p) => p.classList.toggle("active", p.id === "tab-" + b.dataset.tab));
      if (b.dataset.tab === "kupon") renderKupon();
      if (b.dataset.tab === "tagm") renderTagm();
      if (b.dataset.tab === "karsilastir") renderKarsilastir();
    };
  });

  bindUI();
  renderCoefTable();
  await loadIndex();
}

function bindUI() {
  $("#daySelect").onchange = () => { state.day = $("#daySelect").value; fillCitySelect(); };
  $("#citySelect").onchange = () => { state.city = $("#citySelect").value; loadDayData(); };
  $("#btnLoadProgram").onclick = loadLegsFromProgram;
  $("#btnAutoScore").onclick = autoScoreLeg;
  $("#btnAddHorse").onclick = () => {
    const leg = state.legs[state.activeLeg];
    if (!leg) return alert("Önce programdan yükleyin veya bir ayak oluşturun.");
    const ad = prompt("At ismi:");
    if (ad) { leg.horses.push({ no: leg.horses.length + 1, ad, scores: {}, meta: {} }); saveSession(); renderScoreTable(); }
  };
  $("#btnPresetAll").onclick = () => {
    ANGLES.forEach((a) => { state.enabled[a.k] = true; state.coefs[a.k] = a.pct / 100; });
    persistCoefs(); renderCoefTable(); renderScoreTable();
  };
  $("#btnPreset6").onclick = () => {
    ANGLES.forEach((a) => { state.enabled[a.k] = PRESET6.includes(a.k); state.coefs[a.k] = a.pct / 100; });
    persistCoefs(); renderCoefTable(); renderScoreTable();
  };
  $("#btnExport").onclick = exportJson;
  $("#importFile").onchange = importJson;
  $("#csvFile").onchange = importCsv;
  $("#btnReload").onclick = loadIndex;
  $("#btnAutoKupon").onclick = autoKupon;
  $("#btnKarmaKupon").onclick = karmaKupon;
  $("#unitPrice").onchange = renderKuponSummary;
  $("#btnRunBacktest").onclick = runBacktest;
  $("#btnSuggestCoefs").onclick = suggestCoefs;
}

/* ==================== VERİ YÜKLEME ==================== */
async function loadIndex() {
  $("#dataStatus").textContent = "Veri yükleniyor…";
  try {
    const r = await fetch("data/index.json", { cache: "no-store" });
    if (!r.ok) throw new Error(r.status);
    state.index = await r.json();
    const days = Object.keys(state.index.days || {}).sort().reverse();
    $("#daySelect").innerHTML = days.map((d) => `<option value="${d}">${trDate(d)}</option>`).join("");
    if (days.length) { state.day = days[0]; fillCitySelect(); }
    $("#dataStatus").textContent = `✅ ${days.length} günlük veri mevcut. Son güncelleme: ${state.index.updated || "?"}`;
  } catch (e) {
    $("#dataStatus").textContent = "⚠️ GitHub verisi bulunamadı (data/index.json yok ya da yerel dosyadan açıldı). 'Veri' sekmesinden TJK CSV dosyası yükleyebilir veya siteyi GitHub Pages üzerinden açabilirsiniz.";
    loadUploadsIntoIndex();
  }
}

function loadUploadsIntoIndex() {
  // localStorage'a kaydedilmiş CSV yüklemelerini de gün listesine ekle
  const uploads = LS.get("ab2:uploads", {});
  const days = Object.keys(uploads).sort().reverse();
  if (!days.length) return;
  state.index = { days: {} };
  days.forEach((d) => { state.index.days[d] = uploads[d]; });
  $("#daySelect").innerHTML = days.map((d) => `<option value="${d}">${trDate(d)}</option>`).join("");
  state.day = days[0];
  fillCitySelect();
}

function fillCitySelect() {
  const cities = (state.index?.days?.[state.day]) || [];
  $("#citySelect").innerHTML = cities.map((c) => `<option value="${c.slug}">${c.name}</option>`).join("");
  if (cities.length) { state.city = cities[0].slug; loadDayData(); }
  else { state.city = null; state.program = null; state.results = null; renderAll(); }
}

async function loadDayData() {
  state.program = null; state.results = null; state.idman = null;
  // önce localStorage'daki CSV yüklemeleri
  const upKeyP = `ab2:csv:${state.day}:${state.city}:program`;
  const upKeyS = `ab2:csv:${state.day}:${state.city}:sonuclar`;
  state.program = LS.get(upKeyP, null);
  state.results = LS.get(upKeyS, null);
  // sonra repo verisi
  if (!state.program) state.program = await tryFetch(`data/${state.day}/program-${state.city}.json`);
  if (!state.results) state.results = await tryFetch(`data/${state.day}/sonuclar-${state.city}.json`);
  // TJK'nın günlük idman/galop sorgusundan çekilen veri (GitHub Actions ile her sabah güncellenir)
  state.idman = await tryFetch(`data/${state.day}/idman-${state.city}.json`);
  restoreSession();
  renderAll();
}
async function tryFetch(url) {
  try { const r = await fetch(url, { cache: "no-store" }); return r.ok ? await r.json() : null; } catch { return null; }
}

/* ==================== OTURUM (puanlama kaydı) ==================== */
const sessionKey = () => `ab2:session:${state.day}:${state.city}`;
function saveSession() {
  if (!state.day || !state.city) return;
  LS.set(sessionKey(), { legs: state.legs, picks: state.picks, activeLeg: state.activeLeg });
}
function restoreSession() {
  const s = LS.get(sessionKey(), null);
  state.legs = s?.legs || [];
  state.picks = s?.picks || [];
  state.activeLeg = Math.min(s?.activeLeg || 0, Math.max(0, state.legs.length - 1));
}

/* ==================== PUANLAMA ==================== */
function loadLegsFromProgram() {
  if (!state.program) return alert("Bu gün/hipodrom için program verisi yok. 'Veri' sekmesinden CSV yükleyebilirsiniz.");
  if (state.legs.length && !confirm("Mevcut puanlama silinip program yeniden yüklensin mi?")) return;
  state.legs = state.program.races.map((r) => ({
    raceNo: r.no, saat: r.saat, tur: r.tur, grup: r.grup, mesafe: r.mesafe, pist: r.pist, ikramiye: r.ikramiye,
    horses: r.horses.filter((h) => !/koşmaz/i.test(h.ad)).map((h) => ({
      no: h.no, ad: h.ad, scores: {},
      meta: { kgs: h.kgs, son6: h.son6, eniyi: h.eniyi, agf: h.agf, jokey: h.jokey, kilo: h.kilo, sahip: h.sahip, antrenor: h.antrenor, st: h.st },
    })),
  }));
  state.picks = state.legs.map(() => []);
  state.activeLeg = 0;
  saveSession();
  renderAll();
}

function computeScore(horse) {
  let t = 0;
  for (const a of ANGLES) {
    if (!state.enabled[a.k]) continue;
    const v = +horse.scores[a.k] || 0;
    t += v * state.coefs[a.k];
  }
  return t;
}
function rankedHorses(leg) {
  return leg.horses
    .map((h, i) => ({ h, i, score: computeScore(h) }))
    .sort((x, y) => y.score - x.score);
}

/* --- Isı skalası: model kazanma olasılığı → turuncu ton ---
   Olasılık = atın puanı / ayaktaki toplam puan. Ayağın favorisi tam turuncu,
   düşük ihtimalliler yüzey rengine (açık temada beyaza) doğru solar. */
function legProbs(leg) {
  const scores = leg.horses.map((h) => Math.max(0, computeScore(h)));
  const tot = scores.reduce((a, b) => a + b, 0);
  return { probOf: (s) => (tot > 0 ? Math.max(0, s) / tot : 0), max: Math.max(0, ...scores) };
}
function heatBg(score, max, surface = "--surface") {
  if (!(score > 0) || !(max > 0)) return "";
  const t = Math.pow(score / max, 1.5); // favori belirgin kalsın, alt sıralar hızla soluklaşsın
  const pct = Math.round(t * 60);       // en koyu ton %60 karışım — üzerindeki metin okunur kalır
  return pct < 4 ? "" : `background:color-mix(in srgb, var(--heat) ${pct}%, var(${surface}));`;
}

function renderLegChips() {
  const el = $("#legChips");
  el.innerHTML = "";
  state.legs.forEach((leg, i) => {
    const b = document.createElement("button");
    b.className = "chip" + (i === state.activeLeg ? " active" : "");
    b.innerHTML = `${leg.raceNo}. Koşu <span class="cnt">(${leg.horses.length})</span>`;
    b.onclick = () => { state.activeLeg = i; saveSession(); renderScoreTable(); renderLegChips(); };
    el.appendChild(b);
  });
}

function renderScoreTable() {
  const table = $("#scoreTable");
  const leg = state.legs[state.activeLeg];
  const meta = $("#raceMeta");
  if (!leg) {
    table.innerHTML = "";
    meta.innerHTML = "";
    $("#tab-puanlama .table-wrap").style.display = "none";
    if (!$("#noLegNote")) {
      const d = document.createElement("div");
      d.id = "noLegNote"; d.className = "empty-note";
      d.textContent = "Henüz ayak yok — üstteki '📥 Programdan yükle' düğmesiyle günün koşularını getirin.";
      $("#tab-puanlama .table-wrap").before(d);
    }
    return;
  }
  $("#noLegNote")?.remove();
  $("#tab-puanlama .table-wrap").style.display = "";
  meta.innerHTML = `<b>${leg.raceNo}. Koşu</b> · ${leg.saat || ""} · ${leg.grup || ""} · ${leg.mesafe || ""} ${leg.pist || ""} ${leg.tur ? "· " + leg.tur : ""}`;

  const active = ANGLES.filter((a) => state.enabled[a.k]);
  const ranked = rankedHorses(leg);
  const rankOf = new Map(ranked.map((r, ix) => [r.i, ix + 1]));

  let html = `<thead><tr><th class="sticky-col">At</th>`;
  html += active.map((a) => `<th class="angle-h" title="${esc(a.name)} — ${esc(a.desc)} (katsayı ${state.coefs[a.k].toFixed(4)})">${a.k}</th>`).join("");
  html += `<th style="text-align:right">Puan</th><th>Sıra</th><th></th></tr></thead><tbody>`;

  const { probOf, max } = legProbs(leg);
  leg.horses.forEach((h, i) => {
    const rank = rankOf.get(i);
    const score = computeScore(h);
    const heat = heatBg(score, max);
    html += `<tr class="${rank <= 4 && score > 0 ? "top-row" : ""}" style="${heat}">`;
    html += `<td class="sticky-col" style="${heat}" title="${esc(h.meta?.jokey || "")}">${h.no}. ${esc(h.ad)}</td>`;
    active.forEach((a) => {
      const v = h.scores[a.k];
      html += `<td class="angle-c"><input class="score-in ${v ? "filled" : ""}" type="number" min="0" max="100" step="5" data-h="${i}" data-a="${a.k}" value="${v ?? ""}" placeholder="·"></td>`;
    });
    html += `<td class="total">${score.toFixed(1)}${score > 0 ? `<span class="win-pct">%${(probOf(score) * 100).toFixed(0)}</span>` : ""}</td>`;
    html += `<td><span class="rank-badge rank-${rank}">${score > 0 ? rank : "–"}</span></td>`;
    html += `<td><button class="del-horse" title="Atı çıkar" data-del="${i}">✕</button></td></tr>`;
  });
  html += "</tbody>";
  table.innerHTML = html;

  table.querySelectorAll("input.score-in").forEach((inp) => {
    inp.onchange = () => {
      const h = leg.horses[+inp.dataset.h];
      const v = inp.value === "" ? undefined : Math.max(0, Math.min(100, +inp.value));
      if (v === undefined) delete h.scores[inp.dataset.a];
      else h.scores[inp.dataset.a] = v;
      saveSession();
      renderScoreTable();
    };
  });
  table.querySelectorAll("[data-del]").forEach((b) => {
    b.onclick = () => {
      if (!confirm("At çıkarılsın mı?")) return;
      leg.horses.splice(+b.dataset.del, 1);
      saveSession(); renderScoreTable();
    };
  });
}

/* --- otomatik puanlama: program verisinden B5, B6, B8, B13, D1, D2 + arşiv istatistiklerinden E1, E2, E3 --- */
async function autoScoreLeg() {
  const leg = state.legs[state.activeLeg];
  if (!leg) return alert("Önce programdan yükleyin.");
  await scoreLeg(leg);
  saveSession();
  renderScoreTable();
}
async function scoreLeg(leg, ctx) {
  const idman = ctx?.idman !== undefined ? ctx.idman : state.idman;
  const day = ctx?.day || state.day;
  const hs = leg.horses;

  // B8: KGS (son koşusundan bu yana geçen gün)
  hs.forEach((h) => {
    const g = parseInt(h.meta?.kgs);
    if (isNaN(g)) return;
    h.scores.B8 = g <= 7 ? 100 : g <= 10 ? 80 : g <= 15 ? 50 : g <= 21 ? 20 : 0;
  });

  // Son 6 koşu dizisini ayrıştır: "Ç7K2Ç5K2" → [7,2,5,2] (0 → 10 kabul edilir)
  const parseSon6 = (s) => (s || "").match(/\d/g)?.map((d) => (+d === 0 ? 10 : +d)) || [];

  // B13: son 6 derece toplamı — en düşük 5'e 100,70,50,30,10 (hiç koşusu olmayan hariç)
  const sums = hs.map((h) => {
    const arr = parseSon6(h.meta?.son6);
    return arr.length ? arr.reduce((a, b) => a + b, 0) + (6 - Math.min(arr.length, 6)) * 5 : Infinity; // eksik koşulara nötr 5
  });
  assignRank5(hs, sums, "B13", true);

  // B5: kazanma yüzdesi (son 6'dan yaklaşık)
  const winPct = hs.map((h) => {
    const arr = parseSon6(h.meta?.son6);
    return arr.length ? arr.filter((x) => x === 1).length / arr.length : -1;
  });
  assignRank5(hs, winPct, "B5", false);

  // B6: tahmini derece — programdaki En İyi Derece'ye göre (küçük olan iyi)
  const times = hs.map((h) => {
    const m = (h.meta?.eniyi || "").match(/(\d+):(\d+)\.(\d+)/);
    return m ? +m[1] * 60 + +m[2] + +m[3] / 100 : Infinity;
  });
  assignRank5(hs, times, "B6", true);

  // B7: TJK idman sorgusundan son galop — son 7 günde ≥1000 m yapmışsa 100, son 2 günde yapılmışsa puan yok
  if (idman) {
    hs.forEach((h) => {
      const rows = idman[temizle(h.ad)];
      if (!rows || !rows.length) return;
      for (const row of rows) {
        if (!(row.m1400 || row.m1200 || row.m1000)) continue;
        const iso = ddmmyyyyToIso(row.t);
        if (!iso) continue;
        const gun = Math.round((new Date(day) - new Date(iso)) / 86400000);
        if (gun < 0) continue;
        // kılavuz: son 2 günde yapılan galoba puan yok; 3. gün yapılmışsa ancak ÇR/R/HÇ ile bitmişse 100 (Ç ise yok)
        if (gun === 3) h.scores.B7 = /^(ÇR|R|HÇ)$/.test((row.durum || "").trim()) ? 100 : 0;
        else if (gun > 3) h.scores.B7 = gun <= 7 ? 100 : 0;
        break;
      }
    });
  }

  // D1/D2: accurace'den türetilmiş koşu-karakteri profilleri (data/atlar/*.json, her at ayrı dosya)
  const atlar = await Promise.all(hs.map((h) => atProfil(h.ad)));
  hs.forEach((h, i) => { h.meta.karakter = karakterEtiketi(atlar[i]); });
  const sonAtak = hs.map((_, i) => atlar[i]?.son_atak_delta_ema ?? null);
  assignRank5(hs, sonAtak, "D1", false);
  const erkenGec = hs.map((_, i) => atlar[i]?.erken_gec_delta_ema ?? null);
  assignRank5(hs, erkenGec, "D2", false);

  // E1/E2/E3: 2 yıllık sonuç arşivinden jokey/antrenör kazanma yüzdesi ve kulvar avantajı
  if (state.stats === undefined) state.stats = await tryFetch("data/arsiv/stats.json");
  const stats = state.stats;
  if (stats) {
    const oran = (tbl, ad) => {
      const rec = tbl?.[(ad || "").trim()];
      return rec ? rec[1] / rec[0] : null;
    };
    assignRank5(hs, hs.map((h) => oran(stats.jokey, h.meta?.jokey)), "E1", false);
    assignRank5(hs, hs.map((h) => oran(stats.antrenor, h.meta?.antrenor)), "E2", false);

    const sehir = ctx?.city || aktifSehirAdi();
    const pist = (leg.pist || "").trim().split(/\s+/)[0];
    const cell = stats.kulvar?.[`${sehir}|${pist}|${mesafeGrubu(leg.mesafe)}`];
    if (cell) {
      const gw = hs.map((h) => {
        const g = parseInt(h.meta?.st);
        const v = isNaN(g) ? null : cell[String(g)];
        return v ? v[1] / v[0] : null;
      });
      assignRank5(hs, gw, "E3", false);
    }

    /* --- AGM kılavuzu kriterleri, arşiv istatistikleriyle otomatik --- */
    const dayInt = +String(day).replace(/-/g, "");
    const gunFarki = (gi) => Math.round((new Date(day) - new Date(String(gi).replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3"))) / 86400000);
    // arşivin puanlanan günden ÖNCEKİ kayıtları geçerli (backtest'te gelecek bilgisi sızmasın)
    const gecerliSon = (tbl, ad) => {
      const rec = tbl?.[(ad || "").trim()];
      return rec && rec[0] < dayInt ? rec : null;
    };

    // A1 / B16: son 90 günün başarılı sahip/antrenör listesi (1.→4p, 2.→2p, 3.→1p)
    const listePuan = (grup, ad) => {
      const g = stats[grup];
      const p = g?.puan?.[(ad || "").trim()];
      if (p == null) return;
      return p >= g.esik[0] ? 100 : p >= g.esik[1] ? 60 : undefined;
    };
    hs.forEach((h) => {
      const a1 = listePuan("sahip90", h.meta?.sahip);
      if (a1 !== undefined) h.scores.A1 = a1;
      const b16 = listePuan("antrenor90", h.meta?.antrenor);
      if (b16 !== undefined) h.scores.B16 = b16;
    });

    // A2/A3 (sahibin son koşan atı) ve B17/B18 (antrenörün son koşan atı)
    hs.forEach((h) => {
      const s = gecerliSon(stats.sahip_son, h.meta?.sahip);
      if (s) {
        h.scores.A2 = s[1] === 1 ? 100 : s[1] === 2 ? 60 : s[1] === 3 ? 20 : 0;
        const g = gunFarki(s[0]);
        h.scores.A3 = g <= 10 ? 100 : g <= 20 ? 60 : g <= 30 ? 20 : 0;
      }
      const a = gecerliSon(stats.antrenor_son, h.meta?.antrenor);
      if (a) {
        h.scores.B17 = a[1] === 1 ? 100 : a[1] === 2 ? 60 : a[1] === 3 ? 20 : 0;
        const g = gunFarki(a[0]);
        h.scores.B18 = g <= 7 ? 100 : g <= 14 ? 60 : g <= 21 ? 20 : 0;
      }
    });

    // at bazlı kriterler: B1, B4, B5, B10, B11, B12, B14, B15
    const atRecs = hs.map((h) => {
      const rec = stats.at?.[temizle(h.ad)];
      if (!rec) return null;
      // puanlanan günden önceki koşuları al (backtest güvenliği)
      const son6 = (rec.son6 || []).filter((x) => x[0] < dayInt);
      return son6.length === (rec.son6 || []).length ? rec : null; // gelecek verisi karışmışsa atla
    });
    const simdikiIkr = sayiTR(leg.ikramiye);
    const simdikiMes = sayiTR(leg.mesafe);
    const simdikiPist = (leg.pist || "").trim().split(/\s+/)[0];
    const agfSirali = hs.map((h, i) => ({ a: parseAgf(h.meta?.agf), i }))
      .filter((x) => x.a != null).sort((x, y) => y.a - x.a);
    const agfIlk4 = new Set(agfSirali.slice(0, 4).map((x) => x.i));

    hs.forEach((h, i) => {
      const rec = atRecs[i];
      if (!rec || !rec.son6?.length) return;

      // B1 Purse drop: son koşusunun ikramiyesi şimdikinden yüksekse (kılavuzun güncel paraya uyarlaması: ≥%25 fark → 100)
      // Tazelik şartı: son koşusu 90 günden eskiyse sinyal anlamsız — puan verilmez
      const sonKosuGun = gunFarki(rec.son6[rec.son6.length - 1][0]);
      if (rec.ikr && simdikiIkr && sonKosuGun <= 90) {
        if (rec.ikr >= simdikiIkr * 1.25) h.scores.B1 = 100;
        else if (rec.ikr > simdikiIkr * 1.02) h.scores.B1 = 60;
        else if (Math.abs(rec.ikr - simdikiIkr) <= simdikiIkr * 0.02) h.scores.B1 = 20;
      }

      // B2/B3 Mesafe & pist uygunluğu: 2 yıllık kariyer kırılımı (rec.mg / rec.pk) —
      // bugünkü kategorideki ilk-3 oranı diğer kategorilerden belirgin iyiyse yatkın kabul edilir
      const kirilimPuan = (tbl, buKey) => {
        if (!tbl || !buKey || !tbl[buKey]) return;
        const [nT, iT] = tbl[buKey];
        let nD = 0, iD = 0;
        for (const k in tbl) if (k !== buKey) { nD += tbl[k][0]; iD += tbl[k][1]; }
        if (nT >= 3 && nD >= 2) {
          const fark = iT / nT - iD / nD; // bugünkü kategorideki ilk-3 oranı farkı
          return fark >= 0.25 ? 100 : fark >= 0.1 ? 60 : fark > 0 ? 20 : 0;
        }
        if (nT >= 4 && !nD) return iT / nT >= 0.5 ? 60 : 20; // hep bu kategoride koşmuş
      };
      const b2 = kirilimPuan(rec.mg, mesafeGrubu(leg.mesafe));
      if (b2 !== undefined) h.scores.B2 = b2;
      let b3 = kirilimPuan(rec.pk, simdikiPist);
      if (b3 === undefined && simdikiPist && rec.son6.some((x) => x[3])) {
        // yedek: kariyer kırılımı yoksa/yetersizse son 6 koşunun ort. derece kıyası
        const ayni = rec.son6.filter((x) => x[3] === simdikiPist).map((x) => x[1]);
        const diger = rec.son6.filter((x) => x[3] && x[3] !== simdikiPist).map((x) => x[1]);
        const ort = (a) => a.reduce((p, c) => p + c, 0) / a.length;
        if (ayni.length && diger.length) {
          const fark = ort(diger) - ort(ayni); // pozitifse bugünkü pistte daha iyi koşuyor
          b3 = fark >= 2 ? 100 : fark >= 1 ? 60 : fark > 0 ? 20 : 0;
        }
      }
      if (b3 !== undefined) h.scores.B3 = b3;

      // B4 Racing cycle: son 6 koşu tarihlerindeki ara (layoff) düzeni
      const tarihler = rec.son6.map((x) => x[0]);
      const gunler = tarihler.map((t) => gunFarki(t)); // bugünden geriye gün sayısı (artan sırada azalır)
      let layoff = 0, donusSonrasi = 0; // en son ≥20 günlük ara ve ondan sonra koşulan koşu sayısı
      for (let k = rec.son6.length - 1; k >= 1; k--) {
        const ara = gunler[k - 1] - gunler[k];
        if (ara >= 20) { layoff = ara; donusSonrasi = rec.son6.length - k; break; }
      }
      const buKosuSirasi = donusSonrasi + 1; // bugünkü koşu, dönüşten sonraki kaçıncı koşu
      if (layoff >= 45) h.scores.B4 = buKosuSirasi >= 3 && buKosuSirasi <= 6 ? 100 : 0;
      else if (layoff >= 30) h.scores.B4 = buKosuSirasi >= 2 && buKosuSirasi <= 5 ? 100 : 0;
      else if (layoff >= 20) h.scores.B4 = buKosuSirasi >= 2 && buKosuSirasi <= 4 ? 100 : 0;
      else {
        // arasız: son 6'daki en yakın 1.lik kaç koşu önce
        let kacKosuOnce = 0;
        for (let k = rec.son6.length - 1; k >= 0; k--) {
          if (rec.son6[k][1] === 1) { kacKosuOnce = rec.son6.length - k; break; }
        }
        if (kacKosuOnce) h.scores.B4 = kacKosuOnce <= 2 ? 100 : kacKosuOnce <= 4 ? 60 : 20;
      }

      // B10 Ekipman değişikliği: bugünkü ekipman eki son koşudakinden farklıysa
      const buEkip = ekipmanEki(h.ad);
      if (buEkip !== (rec.ekip || "")) h.scores.B10 = 100;

      // B11 Bombalar / İstikrar (bülten ilk-4 yerine AGF ilk-4 kullanılır)
      if (agfIlk4.size && !agfIlk4.has(i)) {
        if (rec.bomba >= 2) h.scores.B11 = 100;
        else if (rec.bomba === 1) h.scores.B11 = 60;
      } else if (agfIlk4.has(i)) {
        let seri = 0;
        for (let k = rec.son6.length - 1; k >= 0; k--) {
          if (rec.son6[k][1] <= 3) seri++; else break;
        }
        if (seri >= 4) h.scores.B11 = 100;
        else if (seri === 3) h.scores.B11 = 60;
        else if (seri === 2) h.scores.B11 = 10;
      }

      // B12 Mesafe ayarı: son koşusu şimdikinden uzunsa
      if (rec.mes && simdikiMes) {
        const fark = rec.mes - simdikiMes;
        if (fark >= 300 && fark <= 600) h.scores.B12 = 100;
        else if (fark >= 200) h.scores.B12 = 80;
        else if (fark >= 100) h.scores.B12 = 60;
      }

      // B15 Kilo farkı: son koşusuna göre
      const buKilo = kiloSayi(h.meta?.kilo);
      if (buKilo != null && rec.kilo != null) {
        const kf = Math.abs(buKilo - rec.kilo);
        h.scores.B15 = kf <= 2.5 ? 100 : kf <= 4 ? 60 : kf <= 5 ? 30 : 0;
      }
    });

    // B5: arşivden gerçek kazanma yüzdesi (yeterli koşusu yoksa son6 yaklaşımı korunur)
    const gercekWin = hs.map((h, i) => {
      const rec = atRecs[i];
      return rec && rec.n >= 3 ? rec.w / rec.n : null;
    });
    if (gercekWin.some((v) => v !== null)) assignRank5(hs, gercekWin, "B5", false);

    // B14 Yarış karakteri: kafa farkıyla (baş/burun/boyun/yarım boy) kazandığı koşu sayısı
    const kafalar = hs.map((_, i) => (atRecs[i]?.kafa > 0 ? atRecs[i].kafa : null));
    assignRank5(hs, kafalar, "B14", false);

    // C4: o günkü jokeylerin katıldıkları koşuların ikramiye toplamı — en yüksek 5 jokey
    const c4 = await c4JokeyToplam(day);
    if (c4) assignRank5(hs, hs.map((h) => c4[(h.meta?.jokey || "").trim()] ?? null), "C4", false);
  }
}
/* C4 için: günün tüm hipodrom programlarından jokey → ikramiye toplamı (gün başına önbellekli) */
const c4Cache = new Map();
function c4JokeyToplam(day) {
  if (!c4Cache.has(day)) {
    c4Cache.set(day, (async () => {
      const cities = state.index?.days?.[day] || [];
      if (!cities.length) return null;
      const toplam = {};
      for (const c of cities) {
        const p = await tryFetch(`data/${day}/program-${c.slug}.json`);
        for (const r of p?.races || []) {
          const ikr = sayiTR(r.ikramiye);
          if (!ikr) continue;
          for (const h of r.horses || []) {
            const j = (h.jokey || "").trim();
            if (j) toplam[j] = (toplam[j] || 0) + ikr;
          }
        }
      }
      return Object.keys(toplam).length ? toplam : null;
    })());
  }
  return c4Cache.get(day);
}
function ekipmanEki(ad) {
  const s = (ad || "").replace(/\s*\(.*?\)\s*/g, " ");
  const m = s.match(/(\s+(SGKR|GDSK|DSGK|GKDSK|SKG|KGD|GKD|DSK|GSK|SGK|GDS|DSG|GKR|KG|DB|SK|GD|GK|DS|KD|GM|BB|ÖG|YP|G|K|D|M|S))+\s*$/);
  return m ? m[0].trim() : "";
}
function sayiTR(s) {
  const m = /\d[\d.]*(?:,\d+)?/.exec(s || "");
  return m ? parseFloat(m[0].replace(/\./g, "").replace(",", ".")) : null;
}
function kiloSayi(s) {
  const m = /^\s*(\d+)(?:[.,](\d+))?/.exec(s || "");
  return m ? parseFloat(`${m[1]}.${m[2] || 0}`) : null;
}
function aktifSehirAdi() {
  const c = (state.index?.days?.[state.day] || []).find((x) => x.slug === state.city);
  return c?.name || "";
}
function mesafeGrubu(m) {
  const mm = /(\d+)/.exec(m || "");
  if (!mm) return "?";
  const v = +mm[1];
  return v <= 1400 ? "kisa" : v <= 1900 ? "orta" : "uzun";
}
/* at profili önbelleği — backtest yüzlerce kez aynı atları puanlarken tekrar tekrar fetch etmesin */
const atProfilCache = new Map();
function atProfil(ad) {
  const key = slugify(temizle(ad));
  if (!atProfilCache.has(key)) atProfilCache.set(key, tryFetch(`data/atlar/${key}.json`));
  return atProfilCache.get(key);
}
function karakterEtiketi(profil) {
  if (!profil) return "";
  const eg = profil.erken_gec_delta_ema, sa = profil.son_atak_delta_ema;
  if (eg == null && sa == null) return "";
  if (eg != null && eg <= -2) return "Kaçak/Öncü";
  if (eg != null && eg >= 2) return "Kapanışçı";
  if (sa != null && sa >= 2) return "Tempocu";
  return "Dengeli";
}
function assignRank5(hs, values, key, asc) {
  const idx = values.map((v, i) => ({ v, i }))
    .filter((x) => x.v !== Infinity && x.v !== -1 && x.v !== null)
    .sort((a, b) => (asc ? a.v - b.v : b.v - a.v));
  idx.slice(0, 5).forEach((x, r) => { hs[x.i].scores[key] = RANK5[r]; });
}

/* ==================== KATSAYILAR ==================== */
function renderCoefTable() {
  const t = $("#coefTable");
  let html = `<thead><tr><th>Aktif</th><th>Kod</th><th>Kriter</th><th>%</th><th>Katsayı</th></tr></thead><tbody>`;
  ANGLES.forEach((a) => {
    html += `<tr class="${state.enabled[a.k] ? "" : "disabled"}">
      <td><input type="checkbox" data-en="${a.k}" ${state.enabled[a.k] ? "checked" : ""}></td>
      <td><b>${a.k}</b></td>
      <td class="cname">${esc(a.name)}<br><span class="hint">${esc(a.desc)}</span></td>
      <td class="pct">%${a.pct}</td>
      <td><input type="number" step="0.0001" min="0" data-co="${a.k}" value="${state.coefs[a.k]}"></td>
    </tr>`;
  });
  t.innerHTML = html + "</tbody>";
  t.querySelectorAll("[data-en]").forEach((c) => (c.onchange = () => {
    state.enabled[c.dataset.en] = c.checked;
    persistCoefs(); renderCoefTable(); renderScoreTable();
  }));
  t.querySelectorAll("[data-co]").forEach((c) => (c.onchange = () => {
    state.coefs[c.dataset.co] = +c.value || 0;
    persistCoefs(); updateCoefSum(); renderScoreTable();
  }));
  updateCoefSum();
}
function updateCoefSum() {
  const s = ANGLES.filter((a) => state.enabled[a.k]).reduce((t, a) => t + state.coefs[a.k], 0);
  $("#coefSum").textContent = `Aktif katsayı toplamı: ${s.toFixed(4)} (maks. puan ${(s * 100).toFixed(1)})`;
}
function persistCoefs() { LS.set("ab2:coefs", state.coefs); LS.set("ab2:enabled", state.enabled); }

/* ==================== PROGRAM & SONUÇ GÖRÜNÜMLERİ ==================== */
function renderProgram() {
  const el = $("#programView");
  if (!state.program) { el.innerHTML = `<div class="empty-note">Bu gün/hipodrom için program verisi yok.</div>`; return; }
  el.innerHTML = state.program.races.map((r) => raceCard(r, false)).join("");
}
function renderResults() {
  const el = $("#resultsView");
  if (!state.results) { el.innerHTML = `<div class="empty-note">Bu gün/hipodrom için sonuç verisi henüz yok. Sonuçlar koşular bittikten sonra GitHub Actions ile otomatik çekilir.</div>`; return; }
  el.innerHTML = state.results.races.map((r) => raceCard(r, true)).join("");
}
function raceCard(r, isResult) {
  const legIx = state.legs.findIndex((l) => l.raceNo === r.no);
  const picks = legIx >= 0 ? state.picks[legIx] || [] : [];
  // Not: TJK'nın sonuç verisinde "At No" gerçek at numarası değil, bitiş sırasıdır — bu yüzden
  // sonuç görünümünde kupon eşleşmesini isimle yapıyoruz (programdaki gerçek at no üzerinden), "no" ile değil.
  let pickedNames = null;
  if (isResult) {
    const programRace = state.program?.races?.find((x) => x.no === r.no);
    pickedNames = new Set(picks.map((no) => temizle(programRace?.horses?.find((h) => h.no === no)?.ad || "")).filter(Boolean));
  }
  let rows = "";
  r.horses.forEach((h, ix) => {
    const kosmaz = /koşmaz/i.test(h.derece || "") || /koşmaz/i.test(h.ad);
    const pos = isResult && !kosmaz ? ix + 1 : null;
    const picked = isResult ? pickedNames.has(temizle(h.ad)) : picks.includes(h.no);
    let posCell = "";
    if (isResult) {
      const mark = pos === 1 && picked ? " ✓" : "";
      posCell = `<td class="pos-cell">${kosmaz ? "—" : pos}${mark}</td>`;
    }
    const soy = [h.baba, h.anne].filter(Boolean).join(" — ");
    rows += `<tr class="${pos === 1 ? "pos-1" : ""}">${posCell}
      <td>${h.no}</td><td>${esc(h.ad)} ${picked ? '<span class="hit">kuponda</span>' : ""}${soy ? `<br><span class="hint" style="font-size:11px">${esc(soy)}</span>` : ""}</td>
      <td>${esc(h.jokey || "")}</td><td>${esc(h.kilo || "")}</td>
      ${isResult
        ? `<td>${esc(h.derece || "")}</td><td>${esc(h.ganyan || "")}</td><td>${esc(h.fark || "")}</td>`
        : `<td>${esc(h.son6 || "")}</td><td>${esc(h.kgs || "")}</td><td>${esc(h.agf || "")}</td><td>${esc(h.eniyi || "")}</td><td>${esc(formatIdmanSon(state.idman?.[temizle(h.ad)]))}</td>`}
    </tr>`;
  });
  const head = isResult
    ? `<th>Sıra</th><th>No</th><th>At</th><th>Jokey</th><th>Kilo</th><th>Derece</th><th>Ganyan</th><th>Fark</th>`
    : `<th>No</th><th>At</th><th>Jokey</th><th>Kilo</th><th>Son 6</th><th>KGS</th><th>AGF</th><th>En iyi</th><th>Son Galop</th>`;
  return `<div class="race-card">
    <header><h3>${r.no}. Koşu — ${r.saat || ""}</h3>
    <span class="race-tags">${esc(r.grup || "")} · ${esc(r.mesafe || "")} ${esc(r.pist || "")} · ${esc(r.tur || "")} ${r.ikramiye ? "· 1.lik: " + esc(r.ikramiye) : ""}</span></header>
    <div class="table-wrap"><table><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table></div>
    ${r.odemeler ? `<div class="payout">💰 ${esc(r.odemeler)}</div>` : ""}
  </div>`;
}

/* ==================== TAGM (kendi yarış dergimiz) ==================== */
async function renderTagm() {
  const el = $("#tagmView");
  if (!state.program) { el.innerHTML = `<div class="empty-note">Bu gün/hipodrom için program verisi yok.</div>`; return; }
  el.innerHTML = `<div class="empty-note">TAGM hazırlanıyor…</div>`;
  const cards = [];
  for (const r of state.program.races) {
    const leg = {
      horses: r.horses.filter((h) => !/koşmaz/i.test(h.ad)).map((h) => ({
        no: h.no, ad: h.ad, scores: {},
        meta: { kgs: h.kgs, son6: h.son6, eniyi: h.eniyi, agf: h.agf, jokey: h.jokey, kilo: h.kilo, baba: h.baba, anne: h.anne },
      })),
    };
    await scoreLeg(leg);
    const top = rankedHorses(leg)[0];
    if (top && top.score > 0) logTagmTahmin(state.day, state.city, r.no, top.h);
    cards.push(tagmRaceCard(r, leg));
  }
  el.innerHTML = cards.join("");
}

/* ==================== TAGM vs Dergi tahmin kaydı & karşılaştırma ==================== */
function logTagmTahmin(day, city, raceNo, horse) {
  const log = LS.get("ab2:tagm-log", {});
  log[`${day}:${city}:${raceNo}`] = { no: horse.no, ad: horse.ad, ts: Date.now() };
  LS.set("ab2:tagm-log", log);
}
function dergiTahminOku(day, city) {
  return LS.get(`ab2:dergi:${day}:${city}`, null);
}
async function renderKarsilastir() {
  const el = $("#karsilastirView");
  el.innerHTML = `<div class="empty-note">Hesaplanıyor…</div>`;
  const tagmLog = LS.get("ab2:tagm-log", {});
  const gunSehirler = new Set(Object.keys(tagmLog).map((k) => k.split(":").slice(0, 2).join(":")));
  let tagmDogru = 0, tagmToplam = 0, dergiDogru = 0, dergiToplam = 0;
  const detay = [];
  for (const gs of gunSehirler) {
    const [day, city] = gs.split(":");
    const dergi = dergiTahminOku(day, city);
    const [sonuclar, program] = await Promise.all([
      tryFetch(`data/${day}/sonuclar-${city}.json`),
      tryFetch(`data/${day}/program-${city}.json`),
    ]);
    if (!sonuclar) continue;
    for (const r of sonuclar.races) {
      // Not: TJK'nın sonuç CSV'sinde "At No" sütunu gerçek at numarası değil, bitiş sırasıdır (1=1.gelen) —
      // bu yüzden kazananı isimle (program verisindeki gerçek at no üzerinden) eşleştiriyoruz, "no" ile değil.
      const kosmaz = (h) => /koşmaz/i.test(h.derece || "") || /koşmaz/i.test(h.ad);
      const kazanan = r.horses.find((h) => !kosmaz(h));
      if (!kazanan) continue;
      const kazananAd = temizle(kazanan.ad);
      const tagmPick = tagmLog[`${day}:${city}:${r.no}`];
      const dergiFavNo = dergi?.tahmin?.[r.no]?.favori?.[0];
      const programRace = program?.races?.find((x) => x.no === r.no);
      const dergiFavAd = dergiFavNo != null ? temizle(programRace?.horses?.find((h) => h.no === dergiFavNo)?.ad || "") || null : null;
      if (!tagmPick && dergiFavAd == null) continue;
      const tagmHit = tagmPick ? temizle(tagmPick.ad) === kazananAd : null;
      const dergiHit = dergiFavAd != null ? dergiFavAd === kazananAd : null;
      if (tagmHit !== null) { tagmToplam++; if (tagmHit) tagmDogru++; }
      if (dergiHit !== null) { dergiToplam++; if (dergiHit) dergiDogru++; }
      detay.push({ day, city, raceNo: r.no, kazanan, tagmPick, dergiFavNo, dergiFavAd, tagmHit, dergiHit });
    }
  }
  const pct = (a, b) => (b ? ((100 * a) / b).toFixed(1) : "–");
  let html = `<div class="cards">
    <div class="card"><h3>🗞️ TAGM</h3><p><b>${tagmDogru}/${tagmToplam}</b> galibiyet isabeti (%${pct(tagmDogru, tagmToplam)})</p></div>
    <div class="card"><h3>📖 Dergi (TJK)</h3><p><b>${dergiDogru}/${dergiToplam}</b> galibiyet isabeti (%${pct(dergiDogru, dergiToplam)})</p></div>
  </div>`;
  if (!detay.length) {
    html += `<div class="empty-note">Henüz karşılaştırılacak veri yok — TAGM sekmesini birkaç gün/hipodrom için açıp gazete PDF'lerini de okuduktan sonra buraya sonuç birikecek.</div>`;
  } else {
    html += `<div class="table-wrap"><table><thead><tr><th>Gün</th><th>Şehir</th><th>Koşu</th><th>Kazanan</th><th>TAGM</th><th>Dergi</th></tr></thead><tbody>`;
    detay.sort((a, b) => (a.day + a.city + a.raceNo < b.day + b.city + b.raceNo ? 1 : -1));
    for (const d of detay) {
      html += `<tr>
        <td>${d.day}</td><td>${esc(d.city)}</td><td>${d.raceNo}</td>
        <td>${esc(d.kazanan.ad)}</td>
        <td>${d.tagmPick ? `${d.tagmPick.no}. ${esc(d.tagmPick.ad)} ${d.tagmHit ? "✅" : "❌"}` : "–"}</td>
        <td>${d.dergiFavAd != null ? `${d.dergiFavNo}. ${esc(d.dergiFavAd)} ${d.dergiHit ? "✅" : "❌"}` : "–"}</td>
      </tr>`;
    }
    html += `</tbody></table></div>`;
  }
  el.innerHTML = html;
}
function tagmRaceCard(r, leg) {
  const ranked = rankedHorses(leg);
  const vm = valueMap(leg);
  const { probOf, max } = legProbs(leg);
  let rows = "";
  ranked.forEach(({ h, score }, ix) => {
    const rank = ix + 1;
    const soy = [h.meta.baba, h.meta.anne].filter(Boolean).join(" — ");
    const karakter = h.meta.karakter ? `<span class="chip" style="cursor:default">${esc(h.meta.karakter)}</span>` : "";
    const v = vm.get(h.no);
    const vCell = v && v.agf != null
      ? `%${(v.agf * 100).toFixed(1)}${v.value ? ' <span title="Model olasılığı AGF\'nin en az 1.5 katı — piyasanın küçümsediği at">💎</span>' : ""}`
      : "";
    rows += `<tr class="${rank <= 4 && score > 0 ? "top-row" : ""}" style="${heatBg(score, max)}">
      <td><span class="rank-badge rank-${rank}">${score > 0 ? rank : "–"}</span></td>
      <td>${h.no}</td>
      <td>${esc(h.ad)}${soy ? `<br><span class="hint" style="font-size:11px">${esc(soy)}</span>` : ""}</td>
      <td>${esc(h.meta.jokey || "")}</td><td>${esc(h.meta.kilo || "")}</td>
      <td>${esc(formatIdmanSon(state.idman?.[temizle(h.ad)]))}</td>
      <td>${karakter}</td>
      <td>${vCell}</td>
      <td class="total">${score.toFixed(1)}${score > 0 ? `<span class="win-pct">%${(probOf(score) * 100).toFixed(0)}</span>` : ""}</td>
    </tr>`;
  });
  return `<div class="race-card">
    <header><h3>${r.no}. Koşu — ${r.saat || ""}</h3>
    <span class="race-tags">${esc(r.grup || "")} · ${esc(r.mesafe || "")} ${esc(r.pist || "")} · ${esc(r.tur || "")} ${r.ikramiye ? "· 1.lik: " + esc(r.ikramiye) : ""}</span></header>
    <div class="table-wrap"><table><thead><tr><th>Sıra</th><th>No</th><th>At</th><th>Jokey</th><th>Kilo</th><th>Son Galop</th><th>Karakter</th><th>AGF</th><th style="text-align:right">Puan</th></tr></thead><tbody>${rows}</tbody></table></div>
  </div>`;
}

/* ==================== KUPON ==================== */
// Altılı blokları elle işaretlenir: her ayak Altılı-1 ve/veya Altılı-2'ye
// ait olabilir (leg.a1 / leg.a2 — 2 altılı çakışabildiği için iki bağımsız
// bayrak). Hiç işaret yoksa günün SON 6 koşusunu Altılı-1 kabul et.
function ensureAltiliDefault() {
  if (state.legs.some((l) => l.a1 || l.a2)) return;
  const n = state.legs.length;
  const start = n >= 6 ? n - 6 : 0;
  state.legs.forEach((l, i) => { l.a1 = i >= start; });
}
function toggleAltili(li, b) {
  const key = "a" + b;
  state.legs[li][key] = !state.legs[li][key];
  saveSession(); renderKupon();
}

/* E: bir ayağa kaç at yazılmalı? Puan dağılımı + koşu şartı + kadro
 * büyüklüğü + mesafe/pist + kulvar (at no) + kilo + cins'e bakarak
 * önerilen genişliği ve GEREKÇESİNİ üretir. */
function legRecommendation(leg) {
  const ranked = rankedHorses(leg).filter((x) => x.score > 0);
  if (!ranked.length) return { count: 0, horses: [], reason: "Puan yok — önce puanlayın." };
  const top = ranked[0].score;
  const reasons = [];
  // 1) lider küme: ardışık göreli fark %12'nin altında kaldıkça genişlet
  let count = 1;
  for (let i = 1; i < ranked.length && i < 6; i++) {
    if ((ranked[i - 1].score - ranked[i].score) / (top || 1) < 0.12) count++; else break;
  }
  reasons.push(count === 1 ? "lider puanca açık ara önde" : `ilk ${count} at puanca yakın`);

  const field = leg.horses.length;
  const mesafe = parseInt(leg.mesafe) || 0;
  const sart = `${leg.grup || ""} ${leg.tur || ""}`;
  const arap = /arap/i.test(sart);
  const maiden = /maiden|dh[öo]|ilk kez|2\s*ya[şs]l[ıi]/i.test(sart);

  // 2) kadro büyüklüğü
  if (field >= 12) { count++; reasons.push(`${field} atlı kalabalık kadro (+1)`); }
  else if (field <= 7) reasons.push(`${field} atlı dar kadro`);
  // 3) maiden / ilk kez koşan → form belirsiz
  if (maiden) { count++; reasons.push("maiden/ilk kez — form belirsiz (+1)"); }
  // 4) mesafe: kısa sprint + kalabalık = şans/start faktörü; uzun = derece belirleyici
  if (mesafe && mesafe <= 1200 && field >= 11) { count++; reasons.push("kısa sprint + kalabalık — şans faktörü yüksek (+1)"); }
  else if (mesafe >= 2000) reasons.push("uzun mesafe — derece belirleyici, dar tutulabilir");
  // 5) kulvar (start): sprinte lider dış kulvardaysa dezavantaj
  const drawTop = ranked[0].h.no;
  if (mesafe && mesafe <= 1400 && field >= 10 && drawTop >= field - 1) {
    count++; reasons.push(`lider dış kulvarda (no ${drawTop}) — sprintte dezavantaj (+1)`);
  }
  // 6) kilo: lider rakiplerinden belirgin ağır mı?
  const kilos = leg.horses.map((h) => parseFloat((h.meta?.kilo || "").replace(",", "."))).filter(Boolean);
  const kTop = parseFloat((ranked[0].h.meta?.kilo || "").replace(",", "."));
  if (kilos.length && kTop) {
    const ort = kilos.reduce((a, b) => a + b, 0) / kilos.length;
    if (kTop - ort >= 3) reasons.push(`lider ${(kTop - ort).toFixed(1)} kg fazla taşıyor`);
  }
  if (arap) reasons.push("Arap koşusu — form genelde korunur");

  count = Math.max(1, Math.min(count, Math.min(6, field)));
  return { count, horses: ranked.slice(0, count).map((x) => x.h.no), reason: reasons.join("; ") };
}

function renderKupon() {
  const el = $("#kuponView");
  if (!state.legs.length) { el.innerHTML = `<div class="empty-note">Önce Puanlama sekmesinden programı yükleyin.</div>`; $("#kuponSummary").innerHTML = ""; return; }
  ensureAltiliDefault();
  el.innerHTML = "";
  state.legs.forEach((leg, li) => {
    const ranked = rankedHorses(leg);
    const rec = legRecommendation(leg);
    const vm = valueMap(leg);
    const { probOf, max } = legProbs(leg);
    const div = document.createElement("div");
    div.className = "kupon-leg" + (leg.a1 || leg.a2 ? " in-altili" : "");
    div.innerHTML = `
      <div class="kupon-leg-head">
        <h4>${leg.raceNo}. Koşu <span class="hint">(${leg.saat || ""} · ${leg.mesafe || ""} ${leg.pist || ""}${leg.grup ? " · " + esc(leg.grup) : ""})</span></h4>
        <div class="altili-toggles">
          <button class="altili-tag alt1 ${leg.a1 ? "on" : ""}" title="Altılı-1'e ekle/çıkar">Altılı-1</button>
          <button class="altili-tag alt2 ${leg.a2 ? "on" : ""}" title="Altılı-2'ye ekle/çıkar">Altılı-2</button>
        </div>
      </div>
      <div class="rec-badge">🎯 Öneri: <b>${rec.count} at</b> — <span class="rec-reason">${esc(rec.reason)}</span></div>`;
    div.querySelector(".alt1").onclick = () => toggleAltili(li, 1);
    div.querySelector(".alt2").onclick = () => toggleAltili(li, 2);
    const wrap = document.createElement("div");
    wrap.className = "kupon-horses";
    ranked.forEach(({ h, score }, ri) => {
      const b = document.createElement("button");
      const picked = (state.picks[li] || []).includes(h.no);
      b.className = "horse-pick" + (picked ? " picked" : "") + (ri < rec.count && score > 0 ? " recommended" : "");
      if (!picked) b.style.cssText = heatBg(score, max, "--surface2");
      const elmas = vm.get(h.no)?.value ? " 💎" : "";
      b.title = elmas ? "Value: model olasılığı AGF'nin en az 1.5 katı" : "";
      b.innerHTML = `${h.no} ${esc(h.ad)}${elmas} <span class="sc">${score.toFixed(1)}${score > 0 ? ` · %${(probOf(score) * 100).toFixed(0)}` : ""}</span>`;
      b.onclick = () => {
        state.picks[li] = state.picks[li] || [];
        const ix = state.picks[li].indexOf(h.no);
        if (ix >= 0) state.picks[li].splice(ix, 1); else state.picks[li].push(h.no);
        saveSession(); renderKupon();
      };
      wrap.appendChild(b);
    });
    div.appendChild(wrap);
    el.appendChild(div);
  });
  renderKuponSummary();
}

// Her Altılı bloğunu DİKEY bilet olarak listeler + kombinasyon/tutar.
function renderKuponSummary() {
  const price = +$("#unitPrice").value || 1;
  let html = "";
  for (const bl of [1, 2]) {
    const legs = state.legs.map((l, i) => ({ l, i })).filter((x) => x.l["a" + bl]);
    if (!legs.length) continue;
    const filled = legs.filter((x) => (state.picks[x.i] || []).length);
    const combo = filled.length ? filled.reduce((t, x) => t * state.picks[x.i].length, 1) : 0;
    const rows = legs.map((x) => {
      const picks = (state.picks[x.i] || []).slice().sort((a, b) => a - b);
      return `<tr><td>${x.l.raceNo}. Koşu</td><td class="tk-picks">${picks.length ? picks.join(" - ") : '<span class="hint">boş</span>'}</td></tr>`;
    }).join("");
    html += `<div class="ticket">
      <div class="ticket-head">🎯 ALTILI-${bl} <span class="hint">(${legs.length} ayak)</span></div>
      <table class="ticket-table"><tbody>${rows}</tbody></table>
      <div class="ticket-foot">Dolu: <b>${filled.length}/${legs.length}</b> · Kombinasyon: <b>${combo.toLocaleString("tr-TR")}</b> · Tutar: <b>${(combo * price).toLocaleString("tr-TR", { maximumFractionDigits: 2 })} TL</b></div>
    </div>`;
  }
  $("#kuponSummary").innerHTML = html ||
    `<span class="hint">Henüz Altılı bloğu tanımlı değil. Ayak başlıklarındaki "Altılı-1 / Altılı-2" düğmeleriyle koşuları bloklara ekleyin (bir koşu iki altılıda birden olabilir).</span>`;
}

// "Öneriye göre doldur": her ayağa legRecommendation'ın önerdiği atları yazar.
function autoKupon() {
  if (!state.legs.length) return alert("Önce programı yükleyip puanlayın.");
  ensureAltiliDefault();
  state.picks = state.legs.map((leg) => legRecommendation(leg).horses);
  saveSession();
  renderKupon();
}
/* TAGM'ın bağımsız puanı (Puanlama sekmesindeki elle girilen puanlara dokunmadan) + Dergi favori/plase'ini birleştirir */
async function karmaKupon() {
  if (!state.legs.length) return alert("Önce programı yükleyip Puanlama sekmesinden ayakları getirin.");
  if (!state.program) return alert("Program verisi yok.");
  const dergi = dergiTahminOku(state.day, state.city);
  const picks = [];
  for (const leg of state.legs) {
    const r = state.program.races.find((x) => x.no === leg.raceNo);
    const set = new Set();
    if (r) {
      const tempLeg = {
        horses: r.horses.filter((h) => !/koşmaz/i.test(h.ad)).map((h) => ({ no: h.no, ad: h.ad, scores: {}, meta: { kgs: h.kgs, son6: h.son6, eniyi: h.eniyi } })),
      };
      await scoreLeg(tempLeg);
      const top = rankedHorses(tempLeg).filter((x) => x.score > 0)[0];
      if (top) set.add(top.h.no);
    }
    const t = dergi?.tahmin?.[leg.raceNo];
    (t?.favori || []).forEach((no) => set.add(no));
    (t?.plase || []).slice(0, 1).forEach((no) => set.add(no));
    picks.push([...set]);
  }
  state.picks = picks;
  saveSession();
  renderKupon();
  $("#kuponInfo").textContent = "✅ Karma kupon hazır: her ayakta TAGM'ın favorisi + Dergi'nin favori/plase atları birleştirildi.";
}

/* ==================== VALUE BET (model olasılığı vs AGF) ==================== */
/* AGF = halkın altılı ganyan bahis dağılımı — piyasanın örtük kazanma olasılığı olarak kullanılır.
   Model olasılığı = atın puanının, ayaktaki toplam puana oranı. Model, halktan belirgin şekilde
   daha iyimserse (oran ≥ VALUE_ESIK ve taban olasılığın üstündeyse) at 💎 value işareti alır. */
const VALUE_ESIK = 1.5, VALUE_TABAN = 0.12;
function parseAgf(s) {
  const m = (s || "").match(/%\s*([\d.,]+)/);
  return m ? parseFloat(m[1].replace(",", ".")) / 100 : null;
}
function parseGanyan(s) {
  const v = parseFloat((s || "").replace(",", "."));
  return isFinite(v) && v > 0 ? v : null;
}
/* leg için at-no → {p: model olasılığı, agf, value} haritası */
function valueMap(leg) {
  const ranked = rankedHorses(leg);
  const tot = ranked.reduce((t, x) => t + Math.max(0, x.score), 0);
  const m = new Map();
  if (!tot) return m;
  for (const x of ranked) {
    const p = Math.max(0, x.score) / tot;
    const agf = parseAgf(x.h.meta?.agf);
    m.set(x.h.no, { p, agf, value: agf != null && agf > 0 && p >= VALUE_TABAN && p / agf >= VALUE_ESIK });
  }
  return m;
}

/* ==================== BACKTEST ==================== */
let backtestRows = null; // son çalıştırmanın verisi (katsayı önerisi de bunu kullanır)
const kosmazMi = (h) => /koşmaz/i.test(h.derece || "") || /koşmaz/i.test(h.ad);

async function collectBacktest(onProgress) {
  const rows = [];
  const days = Object.entries(state.index?.days || {}).sort();
  for (const [day, cities] of days) {
    for (const c of cities) {
      const [program, sonuclar, idman] = await Promise.all([
        tryFetch(`data/${day}/program-${c.slug}.json`),
        tryFetch(`data/${day}/sonuclar-${c.slug}.json`),
        tryFetch(`data/${day}/idman-${c.slug}.json`),
      ]);
      if (!program || !sonuclar) continue;
      onProgress?.(`${trDate(day)} ${c.name}…`);
      for (const r of program.races) {
        const res = sonuclar.races.find((x) => x.no === r.no);
        if (!res) continue;
        // Not: sonuç verisinde sıra = bitiş sırasıdır; kazanan/tabela isimle eşleştirilir
        const gelenler = res.horses.filter((h) => !kosmazMi(h));
        if (!gelenler.length) continue;
        const kazananAd = temizle(gelenler[0].ad);
        const tabela = new Set(gelenler.slice(0, 3).map((h) => temizle(h.ad)));
        const ganyan = parseGanyan(gelenler[0].ganyan);
        const leg = {
          pist: r.pist, mesafe: r.mesafe, ikramiye: r.ikramiye,
          horses: r.horses.filter((h) => !/koşmaz/i.test(h.ad)).map((h) => ({
            no: h.no, ad: h.ad, scores: {},
            meta: { kgs: h.kgs, son6: h.son6, eniyi: h.eniyi, agf: h.agf, jokey: h.jokey, antrenor: h.antrenor, sahip: h.sahip, kilo: h.kilo, st: h.st },
          })),
        };
        await scoreLeg(leg, { idman, day, city: c.name });
        const ranked = rankedHorses(leg).filter((x) => x.score > 0);
        if (ranked.length < 2) continue;
        if (!leg.horses.some((h) => temizle(h.ad) === kazananAd)) continue; // kazanan programda bulunamadıysa atla
        // AGF favorisi (halkın 1 numarası) — kıyas çizgisi
        let agfFav = null, best = -1;
        for (const h of leg.horses) {
          const a = parseAgf(h.meta.agf);
          if (a != null && a > best) { best = a; agfFav = h; }
        }
        rows.push({ day, city: c.name, raceNo: r.no, leg, ranked, kazananAd, tabela, ganyan, agfFav });
      }
    }
  }
  return rows;
}

async function runBacktest() {
  const st = $("#backtestStatus"), el = $("#backtestView");
  st.textContent = "Hesaplanıyor…";
  el.innerHTML = "";
  backtestRows = await collectBacktest((t) => (st.textContent = "Hesaplanıyor… " + t));
  st.textContent = "";
  if (!backtestRows.length) { el.innerHTML = `<div class="empty-note">Karşılaştırılacak program+sonuç çifti bulunamadı.</div>`; return; }

  let n = 0, win1 = 0, top3 = 0, roiDonus = 0;
  let favN = 0, favWin = 0, favDonus = 0;
  let valN = 0, valWin = 0, valDonus = 0;
  const detay = [];
  for (const r of backtestRows) {
    n++;
    const pick = r.ranked[0];
    const pickAd = temizle(pick.h.ad);
    const hit = pickAd === r.kazananAd;
    const plase = r.tabela.has(pickAd);
    if (hit) { win1++; if (r.ganyan) roiDonus += r.ganyan; }
    if (plase) top3++;
    if (r.agfFav) {
      favN++;
      if (temizle(r.agfFav.ad) === r.kazananAd) { favWin++; if (r.ganyan) favDonus += r.ganyan; }
    }
    const vm = valueMap(r.leg);
    const valuePicks = r.ranked.filter((x) => vm.get(x.h.no)?.value);
    for (const v of valuePicks) {
      valN++;
      if (temizle(v.h.ad) === r.kazananAd) { valWin++; if (r.ganyan) valDonus += r.ganyan; }
    }
    detay.push({ ...r, pick, hit, plase, valuePicks });
  }
  const pct = (a, b) => (b ? ((100 * a) / b).toFixed(1) : "–");
  const roi = (donus, adet) => (adet ? (((donus - adet) / adet) * 100).toFixed(1) : "–");
  let html = `<div class="cards">
    <div class="card"><h3>🥇 1. tercih</h3><p><b>${win1}/${n}</b> kazandı (%${pct(win1, n)})<br><b>${top3}/${n}</b> tabelada (%${pct(top3, n)})</p></div>
    <div class="card"><h3>💰 ROI (1. tercihe 1'er birim ganyan)</h3><p>Yatan: <b>${n}</b> · Dönen: <b>${roiDonus.toFixed(2)}</b><br>ROI: <b>%${roi(roiDonus, n)}</b></p></div>
    <div class="card"><h3>👥 AGF favorisi (kıyas)</h3><p><b>${favWin}/${favN}</b> kazandı (%${pct(favWin, favN)})<br>ROI: <b>%${roi(favDonus, favN)}</b></p></div>
    <div class="card"><h3>💎 Value bahisleri</h3><p><b>${valWin}/${valN}</b> kazandı (%${pct(valWin, valN)})<br>ROI: <b>%${roi(valDonus, valN)}</b></p></div>
  </div>`;
  html += `<div class="table-wrap"><table><thead><tr><th>Gün</th><th>Şehir</th><th>Koşu</th><th>1. tercih</th><th>Sonuç</th><th>Kazanan</th><th>Ganyan</th><th>💎</th></tr></thead><tbody>`;
  for (const d of detay) {
    html += `<tr>
      <td>${trDate(d.day)}</td><td>${esc(d.city)}</td><td>${d.raceNo}</td>
      <td>${d.pick.h.no}. ${esc(d.pick.h.ad)}</td>
      <td>${d.hit ? "✅ kazandı" : d.plase ? "🟡 tabela" : "❌"}</td>
      <td>${esc(d.kazananAd)}</td><td>${d.ganyan ?? ""}</td>
      <td>${d.valuePicks.map((v) => `${v.h.no}. ${esc(v.h.ad)}${temizle(v.h.ad) === d.kazananAd ? " ✅" : ""}`).join("<br>")}</td>
    </tr>`;
  }
  el.innerHTML = html + `</tbody></table></div>`;
}

/* ==================== KATSAYI ÖNERİSİ (conditional logit) ==================== */
/* Backtest verisiyle koşu-içi lojistik model eğitir: P(at kazanır) = exp(w·x) / Σ exp(w·x).
   Sadece otomatik puanlanan kriterler öğrenilebilir (diğerlerinin geçmiş puanı yok). */
const TUNABLE = ["A1", "A2", "A3", "B1", "B4", "B5", "B6", "B7", "B8", "B10", "B11", "B12", "B13", "B14", "B15", "B16", "B17", "B18", "C4", "D1", "D2", "E1", "E2", "E3"];
async function suggestCoefs() {
  const el = $("#coefSuggestView"), st = $("#backtestStatus");
  if (!backtestRows) { st.textContent = "Önce veri toplanıyor…"; backtestRows = await collectBacktest((t) => (st.textContent = "Veri toplanıyor… " + t)); st.textContent = ""; }
  const races = [];
  for (const r of backtestRows) {
    const winIx = r.leg.horses.findIndex((h) => temizle(h.ad) === r.kazananAd);
    if (winIx < 0) continue;
    races.push({ X: r.leg.horses.map((h) => TUNABLE.map((k) => (+h.scores[k] || 0) / 100)), winIx });
  }
  if (races.length < 20) {
    el.innerHTML = `<div class="empty-note">Katsayı önerisi için en az 20 sonuçlanmış koşu gerekir (şu an ${races.length}). Birkaç gün daha veri biriksin.</div>`;
    return;
  }
  // w başlangıcı: mevcut katsayılar (özellik /100 ölçeklendiği için ×100)
  const w = TUNABLE.map((k) => state.coefs[k] * 100);
  const lr = 0.1, l2 = 0.001, iters = 400;
  for (let it = 0; it < iters; it++) {
    const grad = new Array(TUNABLE.length).fill(0);
    for (const { X, winIx } of races) {
      const z = X.map((x) => x.reduce((t, v, j) => t + v * w[j], 0));
      const mx = Math.max(...z);
      const ex = z.map((v) => Math.exp(v - mx));
      const S = ex.reduce((a, b) => a + b, 0);
      X.forEach((x, i) => {
        const p = ex[i] / S;
        x.forEach((v, j) => { grad[j] += ((i === winIx ? 1 : 0) - p) * v; });
      });
    }
    w.forEach((v, j) => { w[j] = v + lr * (grad[j] / races.length - l2 * v); });
  }
  // negatifleri sıfırla, toplamı mevcut TUNABLE katsayı toplamına ölçekle (genel denge bozulmasın)
  const pos = w.map((v) => Math.max(0, v));
  const hedefToplam = TUNABLE.reduce((t, k) => t + state.coefs[k], 0);
  const posToplam = pos.reduce((a, b) => a + b, 0) || 1;
  const oneri = {};
  TUNABLE.forEach((k, j) => { oneri[k] = +((pos[j] / posToplam) * hedefToplam).toFixed(4); });

  let html = `<h3 style="margin-top:24px">🧮 Önerilen katsayılar <span class="hint">(${races.length} koşudan öğrenildi — yalnız otomatik puanlanan kriterler)</span></h3>
  <div class="table-wrap"><table><thead><tr><th>Kod</th><th>Kriter</th><th>Mevcut</th><th>Önerilen</th><th>Değişim</th></tr></thead><tbody>`;
  for (const k of TUNABLE) {
    const a = ANGLES.find((x) => x.k === k);
    const cur = state.coefs[k], yeni = oneri[k];
    const yon = yeni > cur * 1.05 ? "🔼" : yeni < cur * 0.95 ? "🔽" : "≈";
    html += `<tr><td><b>${k}</b></td><td>${esc(a.name)}</td><td>${cur.toFixed(4)}</td><td><b>${yeni.toFixed(4)}</b></td><td>${yon}</td></tr>`;
  }
  html += `</tbody></table></div>
  <p><button id="btnApplyCoefs" class="btn btn-accent">✔ Önerilen katsayıları uygula</button>
  <span class="hint">Toplam ölçek korunur: önerilenlerin toplamı, bu kriterlerin mevcut katsayı toplamına (${hedefToplam.toFixed(4)}) eşittir. Katsayılar sekmesinden her zaman varsayılana dönebilirsiniz.</span></p>`;
  el.innerHTML = html;
  $("#btnApplyCoefs").onclick = () => {
    Object.assign(state.coefs, oneri);
    persistCoefs(); renderCoefTable(); renderScoreTable();
    $("#btnApplyCoefs").textContent = "✅ Uygulandı";
  };
}

/* ==================== CSV / JSON İÇE-DIŞA AKTARMA ==================== */
function exportJson() {
  const out = { exported: new Date().toISOString(), coefs: state.coefs, enabled: state.enabled, sessions: {} };
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k.startsWith("ab2:session:")) out.sessions[k] = LS.get(k, null);
  }
  const blob = new Blob([JSON.stringify(out, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `altili-bulan-yedek-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
}
function importJson(e) {
  const f = e.target.files[0];
  if (!f) return;
  f.text().then((t) => {
    const d = JSON.parse(t);
    if (d.coefs) LS.set("ab2:coefs", d.coefs);
    if (d.enabled) LS.set("ab2:enabled", d.enabled);
    Object.entries(d.sessions || {}).forEach(([k, v]) => LS.set(k, v));
    alert("Yedek geri yüklendi. Sayfa yenileniyor.");
    location.reload();
  }).catch(() => alert("Geçersiz JSON dosyası."));
}

function importCsv(e) {
  const f = e.target.files[0];
  if (!f) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = parseTjkCsv(reader.result);
      const slug = slugify(data.city);
      const type = data.isResult ? "sonuclar" : "program";
      LS.set(`ab2:csv:${data.date}:${slug}:${type}`, data);
      const uploads = LS.get("ab2:uploads", {});
      uploads[data.date] = uploads[data.date] || [];
      if (!uploads[data.date].some((c) => c.slug === slug)) uploads[data.date].push({ slug, name: data.city });
      LS.set("ab2:uploads", uploads);
      $("#csvInfo").textContent = `✅ Yüklendi: ${data.city} ${data.date} (${type}, ${data.races.length} koşu)`;
      if (!state.index) state.index = { days: {} };
      const existing = state.index.days[data.date] || [];
      if (!existing.some((c) => c.slug === slug)) existing.push({ slug, name: data.city });
      state.index.days[data.date] = existing;
      const days = Object.keys(state.index.days).sort().reverse();
      $("#daySelect").innerHTML = days.map((d) => `<option value="${d}">${trDate(d)}</option>`).join("");
      state.day = data.date;
      $("#daySelect").value = data.date;
      fillCitySelect();
      $("#citySelect").value = slug;
      state.city = slug;
      loadDayData();
    } catch (err) {
      $("#csvInfo").textContent = "❌ CSV ayrıştırılamadı: " + err.message;
    }
  };
  reader.readAsText(f, "utf-8");
}

/* TJK CSV ayrıştırıcı (program + sonuç aynı format ailesi) */
function parseTjkCsv(text) {
  const lines = text.split(/\r?\n/);
  const head = (lines[0] || "").split(";");
  if (head.length < 3) throw new Error("Başlık satırı tanınamadı");
  const city = head[0].trim();
  const dm = head[2].trim().match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!dm) throw new Error("Tarih bulunamadı");
  const date = `${dm[3]}-${dm[2]}-${dm[1]}`;
  const races = [];
  let race = null, cols = null, isResult = false;
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const cells = line.split(";");
    const mRace = cells[0].match(/^(\d+)\.\s*Kosu\s*:\s*(.+)/i);
    if (mRace) {
      race = { no: +mRace[1], saat: mRace[2].trim(), tur: (cells[1] || "").trim(), grup: (cells[2] || "").trim(), kilo: (cells[3] || "").trim(), mesafe: (cells[4] || "").trim(), pist: (cells[5] || "").trim(), horses: [] };
      races.push(race); cols = null;
      continue;
    }
    if (!race) continue;
    if (/^İkramiye/i.test(cells[0])) continue;
    if (/^1\.\)/.test(cells[0])) { race.ikramiye = cells[0].replace(/^1\.\)/, "").trim(); continue; }
    if (/^At No$/i.test(cells[0].trim())) {
      cols = cells.map((c) => c.trim());
      isResult = cols.includes("Derece");
      continue;
    }
    if (/^GANYAN/i.test(cells[0]) || /ÇİFTE|İKİLİ|ÜÇLÜ|TABELA|ALTILI|BEŞLİ/i.test(cells[0])) { race.odemeler = line.replace(/;+/g, " "); continue; }
    if (cols && /^\d+$/.test(cells[0].trim())) {
      const h = {};
      const map = { "At No": "no", "At İsmi": "ad", "Yaş": "yas", "Orijin(Baba)": "baba", "Orijin(Anne)": "anne", "Kilo": "kilo", "Jokey Adı": "jokey", "Sahip Adı": "sahip", "Antrenör Adı": "antrenor", "St": "st", "AGF": "agf", "H": "h", "Son 6 Yarış": "son6", "KGS": "kgs", "s20": "s20", "EnİyiDerece": "eniyi", "Derece": "derece", "Ganyan": "ganyan", "Fark": "fark" };
      cols.forEach((c, ix) => { const key = map[c]; if (key) h[key] = (cells[ix] || "").trim(); });
      h.no = +h.no;
      race.horses.push(h);
    }
  }
  if (!races.length) throw new Error("Koşu bulunamadı");
  return { date, city, isResult, races };
}

/* ==================== YARDIMCILAR ==================== */
function renderAll() {
  renderLegChips();
  renderScoreTable();
  renderProgram();
  renderResults();
  if ($("#tab-kupon").classList.contains("active")) renderKupon();
}
function esc(s) { return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
function trDate(iso) {
  const [y, m, d] = iso.split("-");
  const ay = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"][+m - 1];
  return `${+d} ${ay} ${y}`;
}
function slugify(s) {
  const map = { ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u", Ç: "c", Ğ: "g", İ: "i", I: "i", Ö: "o", Ş: "s", Ü: "u" };
  return s.replace(/[çğıöşüÇĞİIÖŞÜ]/g, (c) => map[c]).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
/* at adını ekipman soneklerinden arındırıp normalize eder — idman-*.json verisiyle eşleştirmek için (fetch_tjk.py'deki at_adi_temizle ile aynı) */
function temizle(ad) {
  return (ad || "")
    .replace(/\s*\(.*?\)\s*/g, " ")
    .replace(/(\s+(SGKR|GDSK|DSGK|GKDSK|SKG|KGD|GKD|DSK|GSK|SGK|GDS|DSG|GKR|KG|DB|SK|GD|GK|DS|KD|GM|BB|ÖG|YP|G|K|D|M|S))+\s*$/g, "")
    .trim().toUpperCase();
}
function ddmmyyyyToIso(s) {
  const m = (s || "").match(/(\d{2})\.(\d{2})\.(\d{4})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}
/* idman-*.json içindeki en son (ilk) satırı okunur biçimde özetler: "05.07 · 1000m 1.02.50 · Galop" */
function formatIdmanSon(rows) {
  if (!rows || !rows.length) return "";
  const r = rows[0];
  const mesafe = r.m1400 ? "1400m " + r.m1400 : r.m1200 ? "1200m " + r.m1200 : r.m1000 ? "1000m " + r.m1000 : r.m800 ? "800m " + r.m800 : "";
  return [r.t?.slice(0, 5), mesafe, r.tur].filter(Boolean).join(" · ");
}


/* ===== dergi.js entegrasyonu için dışa açılan kancalar ===== */
window.AB = { state, ANGLES, RANK5, saveSession, renderAll, renderScoreTable, rankedHorses, slugify, esc, LS };