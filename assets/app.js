/* ===== Altılı Bulan v2 — puanlama motoru ===== */
"use strict";

/* --- 41 kriter (angle) tanımı. NOT: pct toplamı %180; ağırlıklar mutlak
     ölçek olarak kullanılıyor, sıralamayı yalnızca göreli büyüklükleri etkiler.
     F4 istisna: puanı 0-100 merdiveni değil ham GP (0-120), katsayısı 0.25. --- */
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
  { k: "E4", name: "Jokey favori güvenilirliği (arşiv)", pct: 3.00, desc: "YALNIZCA bugünün AGF favorisi (1. sıra) olan atlarda işler. Arşivde jokeyin favoriye bindiği koşularda kazanma oranı, tüm jokeylerin favoriyle kazanma ortalamasına (%32) bölünür. Endeks ≥1.10 → 100, ≥1.00 → 70, ≥0.90 → 40, altı 0. Az binişi olan jokeyin endeksi Bayes büzmesiyle ortalamaya çekilir (25 binişlik önyargı), yoksa 3 binişte 0 galibiyet 'güvenilmez' gibi görünürdü. Ölçtüğü şey niyet değil, sonucun piyasa beklentisinden sapmasıdır." },
  { k: "E5", name: "Jokey sürpriz eğilimi (arşiv)", pct: 3.00, desc: "YALNIZCA AGF sıralamasında 5. ve gerisindeki atlarda işler. Arşivde jokeyin sürprize bindiği koşularda kazanma oranı, tüm jokeylerin aynı roldeki ortalamasına (%3,8) bölünür. Endeks ≥1.40 → 100, ≥1.15 → 70, ≥0.90 → 40, altı 0. Yüksek endeks 'az şansla iş çıkaran' jokey demektir — bomba arayan kuponda değerlidir." },
  { k: "F1", name: "Uzman tahminleri", pct: 5.00, desc: "Takip edilen tahmincilerin favori/plase/sürpriz işaretleri (F=100, P=60, S=30; işaretleyen tahmincilerin ortalaması). Puanlama sekmesindeki 🎩 Uzman panelinden girilir." },
  { k: "F2", name: "Galop bülteni (ilk 4)", pct: 5.00, desc: "liderform Bülten Galop sekmesinin galop puanına (GP) göre koşunun ilk 4 atı: 1. (favori) 100, 2. 70, 3. 50, 4. 30. Günlük olarak otomatik çekilir (data/{gün}/galop-{şehir}.json). Puanlama sekmesindeki 🏇 panelinden elle işaretleme yapılırsa o ayakta otomatik sıra devre dışı kalır." },
  { k: "F3", name: "Galop jokeyi = koşu jokeyi", pct: 5.00, desc: "Atın galopunu yaptıran jokey bugün onu koşuyorsa 50 puan, değilse 0. Birincil kaynak Bülten Galop verisi — karşılaştırma jokey ID'si üzerinden yapılır. O veri yoksa TJK idman sorgusunun \"İ. Jokeyi\" sütununa düşülür ve isim (soyad + baş harf) eşleştirilir." },
  { k: "F4", name: "Ham galop puanı (GP)", pct: 25.00, desc: "liderform Bülten Galop'taki GP değerinin kendisi — merdivene çevrilmeden, koşan her ata kendi puanı. Katsayı 0.25 olduğu için toplam puana doğrudan GP×0.25 katkı yapar (GP tipik olarak 0–120 arası, yani ~0–30 puan). F2 aynı veriyi yalnızca ilk 4 at için sıralamaya çevirir; F4 tüm kadroyu ve puanlar arasındaki gerçek farkı yansıtır. GP verisi olmayan atta puan hesaba katılmaz. Arşiv backtest'inde galop bülteni bulunmadığı için F2/F3 gibi F4 de kapalı geçer." },
  { k: "G1", name: "Sınıf düşüşü + geçen koşu favorisi", pct: 4.00, desc: "Atın bir önceki koşusundaki RAKİPLERİNİN handikap ortalaması bugünkü kadronun ortalama handikabından yüksekse (daha zorlu sınıftan iniyor) VE o koşuda AGF sıralamasında ilk 3'te ise 100, aksi halde 0. Veri arşivden (stats.json son6) gelir; arşivde bulunmayan atlarda atın kendi hp'si + ganyan ≤4,0 proxy'sine düşülür." },
  { k: "G2", name: "Kazanan profiline yakınlık (şart)", pct: 4.00, desc: "Aynı şartta (ırk · yaş · koşu cinsi · mesafe · pist) geçmişte KAZANAN atların profiline kaç kriterde uyduğu. Arşivden (data/arsiv/sartlar.json) kazananların kilo / kulvar / yaş / ganyan / AGF yüzdelikleri ve takı dağılımı çıkarılır — en çok 6 kriter. Bir kriter ancak atın değeri kazananların TİPİK bandındaysa (q25–q75; takıda: taşıdığı takının payı, o şartta en yaygın takının payının ≥%80'i) sağlanmış sayılır. Sağlanan kriter sayısı ≥5 → 100, 4 → 80, 3 → 60, 2 → 50, altı 0. Bugünkü kadroda herkeste aynı olan özellik (ör. tek yaşlı koşuda yaş) ayırt edici olmadığı için hesaba katılmaz; verisi olmayan kriter o at için hiç ölçülmez." },
  { k: "G3", name: "Temiz favori (gizli eküri yok)", pct: 4.00, desc: "YALNIZCA bugünün AGF favorisinde işler. Aynı antrenörün o koşuda başka atı varsa, ya da sahiplerden biriyle aynı soyadlı FARKLI bir sahibin atı varsa (S.KAYA / K.KAYA — 'gizli eküri'), favori şüpheli sayılır. Arşiv: şüpheli favori %25,4 kazanıyor, temiz favori bazı %31,9 — endeks 0,80 (soyad eşleşmesinde 0,76) ve bu her hipodromda benzer. Temiz favori 100; şüpheli favori hipodrom endeksine göre 0/30/60. Aynı KİŞİNİN iki atı zaten açık eküridir, şüpheli sayılmaz." },
  { k: "G4", name: "Eküri sürprizi (antrenörün diğer atı)", pct: 3.00, desc: "YALNIZCA AGF'de 5. ve gerisindeki, ama aynı antrenörün favorisi de aynı koşuda olan atlarda işler. Arşiv: bu atlar %4,53 kazanıyor, sürpriz bazı %3,78 — endeks 1,20. Favori tarafının aksine bu sinyal hipodroma göre gerçekten değişiyor (Bursa 1,39 · Diyarbakır 1,29 · Şanlıurfa 1,22 · Ankara 1,21 ↔ İstanbul 0,83), o yüzden puan şehir endeksinden okunur: ≥1,35 → 100, ≥1,15 → 70, ≥0,95 → 40, altı 0. İnce veride ülke geneline büzülür." },
  { k: "H1", name: "Piyasa desteği (AGF)", pct: 6.00, desc: "Bugünkü AGF (at grubu favorisi) yüzdesi en yüksek 5 at: 100,70,50,30,10. Piyasanın kolektif görüşü — TJK Yarış Gazetesi kesildiği için onun editör tahminlerinin (eski B6/B11 beslemesi) yerini alır. Veri programla birlikte günlük gelir, PDF gerektirmez." },
];
const PRESET6 = ["A3", "B1", "B2", "B3", "B6", "B13"];
const RANK5 = [100, 70, 50, 30, 10];

/* --- durum --- */
const state = {
  index: null, day: null, city: null,
  program: null, results: null, idman: null, galop: null,
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
  // Arşiv backtest'i sonradan eklendi; eski bir index.html önbellekte kalmışsa
  // bu düğme bulunmaz — tüm bindUI'ı düşürmesin.
  const btnArsiv = $("#btnRunBacktestArsiv");
  if (btnArsiv) { btnArsiv.onclick = () => runBacktest(true); renderArsivYillar(); }
  $("#btnGazetePdf").onclick = buildGazete;
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
  state.program = null; state.results = null; state.idman = null; state.gecmis = null; state.galop = null;
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
  // liderform "Bülten Galop" sekmesi: koşu başına galop puanı (GP) + galop
  // jokeyinin koşu jokeyiyle aynı olup olmadığı. F2 ve F3 kriterlerini besler.
  state.galop = await tryFetch(`data/${state.day}/galop-${state.city}.json`);
  // atların geçmiş koşu geçmişi (ganyan/hp) — G1 kriteri için (yoksa null, G1 puanlanmaz)
  state.gecmis = await tryFetch(`data/${state.day}/gecmis-${state.city}.json`);
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
  tazeleMeta();
}

/* Eski oturumlar programa sonradan eklenen meta alanlarını içermez (ör. G1 için
   şart olan handikap `h`) — bu yüzden kriter sessizce atlanır. Kayıtlı puanlara
   dokunmadan yalnız EKSİK meta alanlarını günün programından tamamlar. */
function tazeleMeta() {
  if (!state.program?.races || !state.legs.length) return;
  for (const leg of state.legs) {
    const race = state.program.races.find((r) => r.no === leg.raceNo);
    if (!race?.horses) continue;
    for (const h of leg.horses) {
      const key = temizle(h.ad);
      const p = race.horses.find((x) => String(x.no) === String(h.no) && temizle(x.ad) === key)
             || race.horses.find((x) => temizle(x.ad) === key);
      if (!p) continue;
      h.meta = h.meta || {};
      const yeni = { kgs: p.kgs, son6: p.son6, eniyi: p.eniyi, agf: p.agf, h: p.h, jokey: p.jokey, kilo: p.kilo, sahip: p.sahip, antrenor: p.antrenor, st: p.st, yas: p.yas };
      for (const [k, v] of Object.entries(yeni)) if (h.meta[k] == null && v != null && v !== "") h.meta[k] = v;
    }
  }
}

/* ==================== PUANLAMA ==================== */
function loadLegsFromProgram() {
  if (!state.program) return alert("Bu gün/hipodrom için program verisi yok. 'Veri' sekmesinden CSV yükleyebilirsiniz.");
  if (state.legs.length && !confirm("Mevcut puanlama silinip program yeniden yüklensin mi?")) return;
  state.legs = state.program.races.map((r) => ({
    raceNo: r.no, saat: r.saat, tur: r.tur, grup: r.grup, mesafe: r.mesafe, pist: r.pist, ikramiye: r.ikramiye,
    horses: r.horses.filter((h) => !/koşmaz/i.test(h.ad)).map((h) => ({
      no: h.no, ad: h.ad, scores: {},
      meta: { kgs: h.kgs, son6: h.son6, eniyi: h.eniyi, agf: h.agf, h: h.h, jokey: h.jokey, kilo: h.kilo, sahip: h.sahip, antrenor: h.antrenor, st: h.st, yas: h.yas },
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
/* Backtest'te ay başı stats anlık görüntüleri — ay başına bir kez indirilir.
   Değer null ise o ay için dosya yok demektir (tekrar denenmesin). */
const aylikStats = {};
const BOS_SIZAN = { jokey: {}, antrenor: {}, kulvar: {},
                    sahip90: { puan: {}, esik: [999, 999] },
                    antrenor90: { puan: {}, esik: [999, 999] } };

async function scoreLeg(leg, ctx) {
  const idman = ctx?.idman !== undefined ? ctx.idman : state.idman;
  // Arşiv backtest'inde galop bülteni yok (site geçmişe dönük veri vermiyor),
  // o yüzden ctx varsa bu kaynak kapalı kalır ve F2/F3 puansız geçer.
  const galop = ctx ? (ctx.galop || null) : state.galop;
  const galopKosu = galop?.[String(leg.raceNo)] || null;
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

  // H1: piyasa desteği — bugünkü AGF yüzdesi en yüksek 5 at. Gazete kesildiği için
  // editör görüşünün yerini tutan tek dış sinyal bu. AGF'si olmayan at puansız kalır.
  const agfler = hs.map((h) => parseAgf(h.meta?.agf) || null); // %0 = veri yok sayılır
  assignRank5(hs, agfler, "H1", false);

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

    // F3 (yedek yol): galop bülteni yoksa TJK idmanının "İ. Jokeyi" sütunuyla
    // karşılaştır. İsim eşleştirmesi ID'den zayıf, o yüzden yalnız yedek.
    if (!galopKosu) {
      hs.forEach((h) => {
        const rows = idman[temizle(h.ad)];
        const gj = rows?.find((r) => (r.jokey || "").trim())?.jokey;
        if (!gj) return;
        h.scores.F3 = jokeyAyniMi(h.meta?.jokey, gj) ? 50 : 0;
      });
    }
  }

  // F2 + F3 + F4: liderform "Bülten Galop" verisi (varsa birincil kaynak).
  // F2 = galop puanına (GP) göre ilk 4 at: 100/70/50/30.
  // F3 = galop jokeyi ile koşu jokeyi aynıysa 50. Karşılaştırma jokey ID'si
  //      üzerinden yapılmış olarak gelir, isim eşleştirmesine gerek yok.
  // F4 = ham GP değerinin kendisi (0-100 ölçeğine çekilmez); katsayısı 0.25
  //      olduğu için toplam puana doğrudan GP×0.25 olarak girer.
  if (galopKosu) {
    const byNo = new Map(galopKosu.map((g) => [String(g.no), g]));
    const gp = hs.map((h) => {
      const g = byNo.get(String(h.no));
      return g && typeof g.gp === "number" ? g.gp : null;
    });
    // elle işaretlenmiş ayakta otomatik F2 devreye girmez (kullanıcı kararı üstün)
    if (!hs.some((h) => +h.galopSira)) assignRank5(hs, gp, "F2", false, [100, 70, 50, 30]);
    hs.forEach((h, i) => {
      const g = byNo.get(String(h.no));
      if (g) h.scores.F3 = g.ayni ? 50 : 0;
      if (gp[i] != null) h.scores.F4 = gp[i]; else delete h.scores.F4;
    });
  }

  // D1/D2: accurace'den türetilmiş koşu-karakteri profilleri (data/atlar/*.json, her at ayrı dosya)
  // Arşiv backtest'inde (ctx.profilsiz) atlanır: on binlerce benzersiz at var, her biri
  // ayrı bir istek demek ve accurace zaten yalnız son dönem atlarını kapsıyor.
  const atlar = ctx?.profilsiz
    ? hs.map(() => null)
    : await Promise.all(hs.map((h) => atProfil(h.ad)));
  hs.forEach((h, i) => { h.meta.karakter = karakterEtiketi(atlar[i]); });
  const sonAtak = hs.map((_, i) => atlar[i]?.son_atak_delta_ema ?? null);
  assignRank5(hs, sonAtak, "D1", false);
  const erkenGec = hs.map((_, i) => atlar[i]?.erken_gec_delta_ema ?? null);
  assignRank5(hs, erkenGec, "D2", false);

  // E1/E2/E3: 2 yıllık sonuç arşivinden jokey/antrenör kazanma yüzdesi ve kulvar avantajı
  if (state.stats === undefined) state.stats = await tryFetch("data/arsiv/stats.json");
  let stats = state.stats;
  // Backtest'te (ctx) bu tablolar OLDUĞU GİBİ kullanılamaz: jokey/antrenör kariyer
  // toplamları, kulvar hücreleri ve 90 günlük sahip/antrenör listeleri arşivin
  // TAMAMINDAN hesaplanıyor — yani puanlanan günün geleceğini de görüyorlar.
  // build_stats.py'nin ay başı anlık görüntüsüyle değiştir. Görüntü yoksa bu
  // kriterleri boş bırak: uydurma yerine puansız kalsınlar.
  if (ctx && stats) {
    const ay = String(day).slice(0, 7);
    if (!(ay in aylikStats)) aylikStats[ay] = await tryFetch(`data/arsiv/stats-ay/${ay}.json`);
    stats = { ...stats, ...(aylikStats[ay] || BOS_SIZAN) };
  }

  // G1: Sınıf düşüşü + geçen koşu favorisi.
  // GERÇEK sürüm (v2): arşivden gelen son6 kaydının 5. elemanı önceki koşunun
  // RAKİP handikap ortalaması, 6. elemanı atın o koşudaki AGF sırasıdır.
  // Bunlar yoksa (eski şemalı stats.json / arşiv dışı gün) atın kendi hp'si +
  // ganyan eşiğine dayanan proxy sürüme (v1) düşülür.
  // Backtest'te ctx verilir ama gecmis ayrıca geçilmezse G1 atlanır (gelecek veri sızmasın).
  const gecmis = ctx ? (ctx.gecmis ?? null) : state.gecmis;
  const hVals = hs.map((h) => parseFloat(h.meta?.h)).filter((v) => isFinite(v));
  const ortH = hVals.length ? hVals.reduce((a, b) => a + b, 0) / hVals.length : null; // bugünkü kadronun ortalama handikabı
  if (ortH != null && (gecmis || stats)) {
    const dayIso = String(day);
    const dayInt = parseInt(dayIso.replace(/-/g, ""), 10);
    hs.forEach((h) => {
      const ad = temizle(h.ad);
      // (v2) arşivdeki son6'dan puanlanan günden ÖNCEKİ en yakın koşu
      const s6 = stats?.at?.[ad]?.son6;
      const oncekiArsiv = Array.isArray(s6)
        ? s6.filter((r) => r.length >= 6 && r[0] < dayInt).sort((a, b) => b[0] - a[0])[0]
        : null;
      if (oncekiArsiv && oncekiArsiv[4] != null && oncekiArsiv[5] != null) {
        const sinifDususu = oncekiArsiv[4] > ortH; // önceki koşunun rakip handikap ort. > bugünkü kadro ort.
        const gecenFavori = oncekiArsiv[5] <= 3;   // önceki koşuda AGF ilk 3
        h.scores.G1 = sinifDususu && gecenFavori ? 100 : 0;
        return;
      }
      // (v1 proxy) arşiv verisi yoksa gecmis-*.json'a düş
      if (!gecmis) return;
      const recs = gecmis[ad];
      if (!recs || !recs.length) return;
      const onceki = recs
        .map((r) => ({ r, iso: ddmmyyyyToIso(r.t) }))
        .filter((x) => x.iso && x.iso < dayIso)
        .sort((a, b) => (a.iso < b.iso ? 1 : -1))[0]?.r;
      if (!onceki) return;
      const oncekiHp = parseFloat(onceki.hp);
      const oncekiGanyan = parseGanyan(onceki.ganyan);
      if (!isFinite(oncekiHp) || oncekiGanyan == null) return;
      h.scores.G1 = oncekiHp > ortH && oncekiGanyan <= 4.0 ? 100 : 0;
    });
  }

  // G2: aynı şartta geçmişte kazanan atların profiline yakınlık.
  // Backtest'te (ctx) ATLANIR: şart bantları tüm arşivden — yani geçmişe dönük
  // puanlanan günün geleceğinden de — hesaplandığı için sonuç sızardı.
  if (!ctx && state.sartlar === undefined) state.sartlar = await tryFetch("data/arsiv/sartlar.json");
  const sart = ctx ? null : sartBul(leg, state.sartlar);
  if (sart) {
    const dayInt2 = parseInt(String(day).replace(/-/g, ""), 10);
    const ozellikler = sartOzellikleri(hs, sart, stats, dayInt2);
    hs.forEach((h, i) => {
      const p = sartPuani(ozellikler[i]);
      if (p != null) h.scores.G2 = p;
    });
  }

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

    /* --- E4 / E5: jokey piyasa beklentisine paralel mi? ---
     * Arşivden (build_stats.py) her jokeyin FAVORİYE binerken ve SÜRPRİZE
     * binerken kazanma sayıları gelir; ölçü, tüm jokeylerin aynı roldeki
     * ortalaması (beklenti_baz). Endeks 1.00 = beklendiği kadar.
     *
     * Küçük örneklem yanıltmasın diye Bayes büzmesi: az binişi olan jokeyin
     * endeksi ortalamaya çekilir (K biniş kadar "ortalama jokey" önyargısı).
     * Kriterler yalnızca atın BUGÜNKÜ rolünde işler — favori olmayan atta E4,
     * sürpriz olmayan atta E5 hiç yazılmaz, yoksa rolsüz atları cezalandırırdı.
     *
     * NOT: bu tablo jokeyin niyetini değil, sonucun beklentiden sapmasını
     * ölçer. Düşük endeks kötü şans da olabilir; yüksek sürpriz endeksi iyi
     * bir "az şansla iş çıkaran" jokey de olabilir. */
    const jb = stats.jokey_beklenti, jz = stats.beklenti_baz;
    if (jb && jz?.[0] && jz?.[2]) {
      const K = 25;                                   // büzme gücü (biniş cinsinden)
      const bazFav = jz[1] / jz[0], bazSur = jz[3] / jz[2];
      const endeks = (ad, rol, baz) => {
        const v = jb[(ad || "").trim()];
        if (!v || !v[rol]) return null;
        return ((v[rol + 1] + K * baz) / (v[rol] + K)) / baz;
      };
      hs.forEach((h) => {
        const sira = agfSiraNo(h.meta?.agf);
        if (sira === 1) {
          const e = endeks(h.meta?.jokey, 0, bazFav);
          if (e != null) h.scores.E4 = e >= 1.10 ? 100 : e >= 1.00 ? 70 : e >= 0.90 ? 40 : 0;
        }
        if (sira && sira >= 5) {
          const e = endeks(h.meta?.jokey, 2, bazSur);
          if (e != null) h.scores.E5 = e >= 1.40 ? 100 : e >= 1.15 ? 70 : e >= 0.90 ? 40 : 0;
        }
      });
    }

    /* --- G3 / G4: "gizli eküri" ---
     * Aynı ANTRENÖRÜN koşuda birden çok atı varsa ve biri AGF favorisiyse, o
     * favori arşivde normal favoriden belirgin az kazanıyor (ülke geneli 0.80);
     * aynı antrenörün yüksek ganyanlı atı ise beklenenden çok kazanıyor (1.20).
     * İkinci mekanizma: farklı KİŞİLER ama aynı SOYADLI sahipler (S.KAYA /
     * K.KAYA) — orada da favori 0.76'ya düşüyor, sürprizde sinyal yok.
     *
     * Endeks hipodrom bazında okunur ama ince veride ülke geneline büzülür.
     * Ölçüm: favori tarafı her hipodromda benzer (0.76–0.91), sürpriz tarafı
     * şehre göre gerçekten değişiyor (İstanbul 0.83 ↔ Bursa 1.39).
     * İşaretleme mantığı scripts/build_stats.py `ekuri_isaretle` ile aynı
     * olmalı — biri değişirse diğeri de değişmeli. */
    const ek = stats.ekuri;
    if (ek?.TOPLAM) {
      const sehirAdi = ctx?.city || aktifSehirAdi();
      const K = 60;
      const endeksEk = (rol) => {
        const t = ek.TOPLAM, c = ek[sehirAdi] || t;
        if (!c.baz?.[rol] || !t.isaret?.[rol]) return null;
        const ulkeOran = t.isaret[rol + 1] / t.isaret[rol];
        const oran = (c.isaret[rol + 1] + K * ulkeOran) / (c.isaret[rol] + K);
        const baz = c.baz[rol + 1] / c.baz[rol];
        return baz ? oran / baz : null;
      };
      const soyadi = (s) => (s || "").trim().split(/\s+/).pop() || "";
      const antSay = {}, soyGrup = {};
      hs.forEach((h) => {
        const a = (h.meta?.antrenor || "").trim();
        if (a) (antSay[a] = antSay[a] || []).push(h);
        const sy = soyadi(h.meta?.sahip);
        if (sy.length >= 4) (soyGrup[sy] = soyGrup[sy] || []).push(h);
      });
      const favoriMi = (h) => agfSiraNo(h.meta?.agf) === 1;
      const supheli = new Set(), ekuriSurpriz = new Set();
      Object.values(antSay).forEach((liste) => {
        if (liste.length < 2 || !liste.some(favoriMi)) return;
        liste.forEach((h) => {
          const s = agfSiraNo(h.meta?.agf);
          if (s === 1) supheli.add(h);
          else if (s && s >= 5) ekuriSurpriz.add(h);
        });
      });
      Object.values(soyGrup).forEach((liste) => {
        // aynı kişinin iki atı açık eküri sayılır, "gizli" değil
        if (liste.length < 2 || new Set(liste.map((h) => h.meta?.sahip)).size < 2) return;
        liste.forEach((h) => { if (favoriMi(h)) supheli.add(h); });
      });

      const eFav = endeksEk(0), eSur = endeksEk(2);
      hs.forEach((h) => {
        if (favoriMi(h) && eFav != null) {
          h.scores.G3 = !supheli.has(h) ? 100 : eFav <= 0.85 ? 0 : eFav <= 0.95 ? 30 : 60;
        }
        if (ekuriSurpriz.has(h) && eSur != null) {
          h.scores.G4 = eSur >= 1.35 ? 100 : eSur >= 1.15 ? 70 : eSur >= 0.95 ? 40 : 0;
        }
      });
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
/* ==================== G2: KOŞU ŞARTI / KAZANAN PROFİLİ ====================
 * scripts/build_sartlar.py arşivdeki her koşu şartı için KAZANAN atların
 * kilo / kulvar / yaş / ganyan / AGF yüzdeliklerini (q10,q25,q50,q75,q90)
 * data/arsiv/sartlar.json'a yazar. Buradaki fonksiyonlar bugünkü koşunun
 * şartını aynı anahtar mantığıyla bulup atları o profile göre puanlar.
 * ÖNEMLİ: sonuç CSV'sinde "At No" kolonu bitiş sırasını tutuyor; atın gerçek
 * numarası/kulvarı `st` alanıdır — "kaçıncı at" ile "kulvar" tek özelliktir. */
const SART_YETER = 12;   // bu kadar örneği olan en dar anahtar tercih edilir

/* "%28.4(1)" → 1 : atın bugünkü AGF sıralaması (piyasadaki yeri). */
function agfSiraNo(agf) {
  const m = /\((\d+)\)/.exec(String(agf ?? ""));
  return m ? +m[1] : null;
}
function sartSayi(v) {
  const m = /(\d+(?:[.,]\d+)?)/.exec(String(v ?? ""));
  return m ? parseFloat(m[1].replace(",", ".")) : null;
}
function sartAnahtarlari(leg) {
  const g = leg.grup || "", t = (leg.tur || "").toUpperCase();
  const irk = /arap/i.test(g) ? "Arap" : "İngiliz";
  const ym = /^\s*(\d+)\s*(ve\s+Yukar[ıi])?/i.exec(g);
  const yas = ym ? (ym[2] ? ym[1] + "+" : ym[1] + "y") : "?";
  let cins = "?";
  for (const [ara, ad] of [["MAIDEN", "Maiden"], ["HANDIKAP", "Handikap"], ["HANDİKAP", "Handikap"],
                           ["ŞARTLI", "Şartlı"], ["SARTLI", "Şartlı"], ["SATIŞ", "Satış"],
                           ["SATIS", "Satış"], ["KV", "KV"], ["DENEME", "Deneme"], ["GRUP", "Grup"]]) {
    if (t.includes(ara)) { cins = ad; break; }
  }
  if (cins === "?") {
    const ilk = (t.split("/")[0].trim().split(/\s+/)[0] || "?");
    cins = ilk.charAt(0) + ilk.slice(1).toLowerCase();
  }
  const cinsD = cins + (/di[şs]i/i.test(leg.tur || "") ? "-D" : "");
  const mv = sartSayi(leg.mesafe);
  const m = mv ? String(Math.round(mv)) : "?";
  const mg = mesafeGrubu(leg.mesafe);
  const p = (leg.pist || "").trim().split(/\s+/)[0] || "?";
  return [`${irk}|${yas}|${cinsD}|${m}|${p}`, `${irk}|${cins}|${m}|${p}`,
          `${irk}|${cins}|${mg}|${p}`, `${irk}|${mg}|${p}`];
}
function sartBul(leg, sartlar) {
  if (!sartlar?.anahtar) return null;
  const ks = sartAnahtarlari(leg);
  for (const k of ks) { const r = sartlar.anahtar[k]; if (r && r.n >= SART_YETER) return { k, r }; }
  for (const k of ks) { const r = sartlar.anahtar[k]; if (r) return { k, r }; }
  return null;
}
/* bant = [q10,q25,q50,q75,q90] → tipik bantta 1, geniş bantta 0.5, dışında 0 */
function sartYakinlik(v, bant) {
  if (v == null || !bant) return null;
  if (v >= bant[1] && v <= bant[3]) return 1;
  if (v >= bant[0] && v <= bant[4]) return 0.5;
  return 0;
}
/* Bugünkü kadronun her atı için [{ad, deger, v}] özellik listesi.
 * Kadrodaki herkeste aynı olan özellik ayırt edici değildir (ör. "4 Yaşlı
 * Araplar" koşusunda yaş) ve hesaba katılmaz. */
/* Takı ekseni: sayısal bant yok, kazananların takı DAĞILIMI var
 * ({"SK":42,"DB":39,...} + takisiz sayısı, n kazanan üzerinden). Atın taşıdığı
 * takılardan en yaygın olanının kazananlar arasındaki payı ölçü alınır; takısız
 * atta "takisiz" payı kullanılır.
 *
 * Eşik MUTLAK yüzde olamaz: bir at birden çok takı taşıyabildiği için paylar
 * çakışır ve ham %33 eşiği kadronun ~%94'ünü geçiriyordu — herkese bedava puan.
 * Bu yüzden pay, o şartta EN YAYGIN takının payına göre normalize edilir:
 * atın payı en yaygının %80'ine ulaşıyorsa tipik, %50'sine ulaşıyorsa geniş. */
function sartTakiOrani(h, r) {
  const n = r.n || 0;
  if (!n) return null;
  const paylar = Object.values(r.taki || {}).concat(r.takisiz || 0);
  const enYaygin = Math.max(0, ...paylar);
  if (!enYaygin) return null;
  const t = takiAyikla(h.ad).taki;
  const kendi = t.length ? Math.max(...t.map((x) => r.taki?.[x] || 0)) : (r.takisiz || 0);
  return kendi / enYaygin;
}
function sartOzellikleri(hs, sart, stats, dayInt) {
  const r = sart.r;
  // AGF ekseni ancak kadronun yarısından çoğunda AGF varsa anlamlı (aynı birim
  // kıyası); ganyan ekseni atın ÖNCEKİ koşusundaki ganyanı kullanır.
  const agfSayisi = hs.filter((h) => sartSayi(h.meta?.agf) != null).length;
  const agfVar = r.agf && agfSayisi >= hs.length / 2;
  const oncekiGanyan = (h) => {
    const s6 = stats?.at?.[temizle(h.ad)]?.son6;
    if (!Array.isArray(s6)) return null;
    const o = s6.filter((x) => x[0] < dayInt).sort((a, b) => b[0] - a[0])[0];
    return o ? sartSayi(o[2]) : null;
  };
  const bantli = (ad, bant, deger) => bant && {
    ad, deger, yakinlik: (h) => sartYakinlik(deger(h), bant), goster: (h) => deger(h),
  };
  const eksenler = [
    bantli("kilo", r.kilo, (h) => sartSayi(h.meta?.kilo)),
    bantli("kulvar", r.st, (h) => sartSayi(h.meta?.st) ?? sartSayi(h.no)),
    bantli("yaş", r.yas, (h) => sartSayi(h.meta?.yas)),
    bantli("ganyan", r.ganyan, oncekiGanyan),
    agfVar && bantli("AGF", r.agf, (h) => sartSayi(h.meta?.agf)),
    r.taki && {
      ad: "takı",
      deger: (h) => sartTakiOrani(h, r),
      yakinlik: (h) => {
        const o = sartTakiOrani(h, r);
        return o == null ? null : o >= 0.8 ? 1 : o >= 0.5 ? 0.5 : 0;
      },
      goster: (h) => {
        const o = sartTakiOrani(h, r);
        if (o == null) return null;
        const t = takiAyikla(h.ad).taki;
        return `${t.length ? t.join("+") : "takısız"} ${o.toFixed(2)}×`;
      },
    },
  ].filter(Boolean);
  return hs.map((h) => {
    const out = [];
    for (const e of eksenler) {
      const degerler = hs.map(e.deger).filter((v) => v != null);
      if (new Set(degerler).size < 2) continue;      // ayırt etmiyor
      const v = e.yakinlik(h);
      if (v != null) out.push({ ad: e.ad, deger: e.goster(h), v });
    }
    return out;
  });
}
/* Puan artık ORTALAMA yakınlık değil, SAĞLANAN KRİTER SAYISI: atın kaç ekseni
 * kazananların tipik bandında (q25–q75) tutturduğu sayılır. Geniş bant (0.5)
 * sayılmaz — eşiği seçici tutmak için. En çok 6 eksen olabilir (kilo, kulvar,
 * yaş, ganyan, AGF, takı); verisi eksik atta ölçülebilen eksen sayısı düşer,
 * o at doğal olarak üst basamaklara çıkamaz. */
function sartPuani(parcalar) {
  if (!parcalar || parcalar.length < 2) return null;
  const tutan = parcalar.filter((x) => x.v === 1).length;
  return tutan >= 5 ? 100 : tutan === 4 ? 80 : tutan === 3 ? 60 : tutan === 2 ? 50 : 0;
}

/* merdiven varsayılan olarak RANK5 (5 at); F2 gibi 4 basamaklı kriterler kendi
   merdivenini geçirir. Merdivenin uzunluğu kaç atın puanlanacağını da belirler. */
function assignRank5(hs, values, key, asc, merdiven) {
  const puanlar = merdiven || RANK5;
  const idx = values.map((v, i) => ({ v, i }))
    .filter((x) => x.v !== Infinity && x.v !== -1 && x.v !== null)
    .sort((a, b) => (asc ? a.v - b.v : b.v - a.v));
  idx.slice(0, puanlar.length).forEach((x, r) => { hs[x.i].scores[key] = puanlar[r]; });
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
  sartBolumleriDoldur(el, state.program.races);
}
function renderResults() {
  const el = $("#resultsView");
  if (!state.results) { el.innerHTML = `<div class="empty-note">Bu gün/hipodrom için sonuç verisi henüz yok. Sonuçlar koşular bittikten sonra GitHub Actions ile otomatik çekilir.</div>`; return; }
  el.innerHTML = state.results.races.map((r) => raceCard(r, true)).join("");
  sartBolumleriDoldur(el, state.results.races);
}

/* ==================== "BU ŞARTTA KİM KAZANMIŞ" ====================
 * Kaynak: data/arsiv/sartlar.json (scripts/build_sartlar.py) — G2 kriterinin
 * kullandığı dosyanın ta kendisi. Orada zaten hesaplanan kazanan profilini
 * burada GÖRÜNÜR kılıyoruz, ayrıca takı dağılımını ekliyoruz.
 * Dosya ~3 MB; senkron render'ı bekletmemek için kartlar çizildikten sonra
 * yer tutucular arkadan doldurulur. */
async function sartBolumleriDoldur(kok, races) {
  const yuvalar = kok.querySelectorAll(".sart-kazanan[data-race]");
  if (!yuvalar.length || !races) return;
  if (state.sartlar === undefined) state.sartlar = await tryFetch("data/arsiv/sartlar.json");
  if (!state.sartlar) return;
  yuvalar.forEach((el) => {
    const r = races.find((x) => String(x.no) === el.dataset.race);
    if (r) el.innerHTML = sartKazananHTML(r);
  });
}

function sartKazananHTML(r) {
  const s = sartBul(r, state.sartlar);
  const rec = s?.r;
  const ornek = rec?.ornek || [];
  if (!ornek.length) return "";

  const dag = rec.taki || {};
  const paylar = Object.entries(dag)
    .map(([kod, c]) => `<span class="taki-pay"><span class="taki-kod">${esc(kod)}</span>%${Math.round((c / rec.n) * 100)}</span>`)
    .join("");
  const takisiz = rec.takisiz
    ? `<span class="taki-pay hint">takısız %${Math.round((rec.takisiz / rec.n) * 100)}</span>` : "";

  const satir = ornek.map((o) => `<tr>
      <td>${esc(trDate(o.t))}</td><td>${esc(o.s || "")}</td>
      <td>${esc(o.ad || "")}</td>
      <td class="taki-cell">${takiHTML(o.taki)}</td>
      <td>${esc(o.st ?? "")}</td><td>${esc(o.kilo ?? "")}</td>
      <td>${esc(o.jokey || "")}</td><td>${esc(o.ganyan ?? "")}</td>
      <td>${esc(o.agf ?? "")}</td><td>${esc(o.kadro ?? "")}</td>
    </tr>`).join("");

  return `<details class="sart-detay">
    <summary>Bu şartta kim kazanmış? <span class="hint">${rec.n} kazanan · ${esc(s.k)}</span></summary>
    <div class="sart-govde">
      <div class="taki-dagilim">Kazananların takısı: ${paylar}${takisiz}</div>
      <div class="table-wrap"><table class="sart-tablo"><thead><tr>
        <th>Tarih</th><th>Şehir</th><th>Kazanan</th><th>Takı</th><th>Kulvar</th>
        <th>Kilo</th><th>Jokey</th><th>Ganyan</th><th>AGF</th><th>Kadro</th>
      </tr></thead><tbody>${satir}</tbody></table></div>
      <div class="hint sart-not">Şart eşleşmesi ırk · yaş · koşu cinsi · mesafe · pist üzerinden yapılır;
        yeterli örnek yoksa daha genişine düşülür (başlıktaki anahtar hangi seviyede eşleştiğini gösterir).
        Yüzdeler ${rec.n} kazananın tamamı üzerinden, tablo son ${ornek.length} kazanan.</div>
    </div>
  </details>`;
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
    const t = takiAyikla(h.ad);
    rows += `<tr class="${pos === 1 ? "pos-1" : ""}">${posCell}
      <td>${h.no}</td><td>${esc(h.st || "")}</td><td>${esc(t.ad)} ${picked ? '<span class="hit">kuponda</span>' : ""}${soy ? `<br><span class="hint" style="font-size:11px">${esc(soy)}</span>` : ""}</td>
      <td class="taki-cell">${takiHTML(t.taki)}</td>
      <td>${esc(h.jokey || "")}</td><td>${esc(h.kilo || "")}</td>
      ${isResult
        ? `<td>${esc(h.derece || "")}</td><td>${esc(h.ganyan || "")}</td><td>${esc(h.fark || "")}</td>`
        : `<td>${esc(h.son6 || "")}</td><td>${esc(h.kgs || "")}</td><td>${esc(h.agf || "")}</td><td>${esc(h.eniyi || "")}</td><td>${esc(formatIdmanSon(state.idman?.[temizle(h.ad)]))}</td>`}
    </tr>`;
  });
  const head = isResult
    ? `<th>Sıra</th><th>No</th><th>KLV</th><th>At</th><th>Takı</th><th>Jokey</th><th>Kilo</th><th>Derece</th><th>Ganyan</th><th>Fark</th>`
    : `<th>No</th><th>KLV</th><th>At</th><th>Takı</th><th>Jokey</th><th>Kilo</th><th>Son 6</th><th>KGS</th><th>AGF</th><th>En iyi</th><th>Son Galop</th>`;
  return `<div class="race-card">
    <header><h3>${r.no}. Koşu — ${r.saat || ""}</h3>
    <span class="race-tags">${esc(r.grup || "")} · ${esc(r.mesafe || "")} ${esc(r.pist || "")} · ${esc(r.tur || "")} ${r.ikramiye ? "· 1.lik: " + esc(r.ikramiye) : ""}</span></header>
    <div class="table-wrap"><table><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table></div>
    ${r.odemeler ? `<div class="payout">💰 ${esc(r.odemeler)}</div>` : ""}
    <div class="sart-kazanan" data-race="${r.no}"></div>
    ${isResult ? "" : `<div class="ses-kutu" data-ses-race="${r.no}"></div>`}
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
        meta: { kgs: h.kgs, son6: h.son6, eniyi: h.eniyi, agf: h.agf, h: h.h, jokey: h.jokey, kilo: h.kilo, baba: h.baba, anne: h.anne },
      })),
    };
    await scoreLeg(leg);
    const top = rankedHorses(leg)[0];
    if (top && top.score > 0) logTagmTahmin(state.day, state.city, r.no, top.h);
    cards.push(tagmRaceCard(r, leg));
  }
  el.innerHTML = cards.join("");
}

/* ==================== GAZETE (yazdırılabilir / PDF — tam düzen) ====================
   TAGM = kendi yarış dergimiz. Bu, tüm koşuları puanlanmış tam gazete düzeninde
   ekranda gizli #gazeteRoot'a basar ve window.print() ile tarayıcının "PDF olarak
   kaydet" akışını açar. Harici kütüphane yok, çevrimdışı çalışır. */
async function buildGazete() {
  if (!state.program) return alert("Bu gün/hipodrom için program verisi yok.");
  const btn = $("#btnGazetePdf");
  if (btn) { btn.disabled = true; btn.textContent = "⏳ Hazırlanıyor…"; }
  try {
    const sehir = aktifSehirAdi() || state.city || "";
    const parts = [];
    for (const r of state.program.races) {
      const leg = {
        raceNo: r.no, saat: r.saat, grup: r.grup, mesafe: r.mesafe, pist: r.pist, tur: r.tur, ikramiye: r.ikramiye,
        horses: r.horses.filter((h) => !/koşmaz/i.test(h.ad)).map((h) => ({
          no: h.no, ad: h.ad, scores: {},
          meta: { kgs: h.kgs, son6: h.son6, eniyi: h.eniyi, agf: h.agf, h: h.h, jokey: h.jokey, kilo: h.kilo, baba: h.baba, anne: h.anne, sahip: h.sahip, antrenor: h.antrenor, st: h.st, yas: h.yas },
        })),
      };
      await scoreLeg(leg);
      parts.push(gazeteRace(r, leg));
    }
    const doc = `<div class="gz-doc">
      <div class="gz-head">
        <div class="gz-title">🏇 TAGM Yarış Gazetesi</div>
        <div class="gz-sub">${esc(sehir)} · ${esc(trDate(state.day) || state.day || "")} · ${state.program.races.length} koşu</div>
        <div class="gz-note">Kendi puanlama motorumuzla üretildi — TJK Yarış Gazetesi'nden bağımsız. Önc.% = atın bir önceki koşusundaki ganyandan örtük olasılık; Önc.HP = bir önceki koşusundaki handikap. Sorumlu oynayın.</div>
      </div>
      ${parts.join("")}
    </div>`;
    $("#gazeteRoot").innerHTML = doc;
    window.print();
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = "🖨️ Gazete PDF"; }
  }
}

/* Atın puanlanan günden önceki en yakın koşusu (gecmis kaydı) — G1 ve gazete "Önc." sütunları için */
function oncekiKosu(ad, day, gecmis) {
  const recs = (gecmis !== undefined ? gecmis : state.gecmis)?.[temizle(ad)];
  if (!recs || !recs.length) return null;
  const dayIso = String(day || state.day || "9999");
  return recs.map((r) => ({ r, iso: ddmmyyyyToIso(r.t) }))
    .filter((x) => x.iso && x.iso < dayIso)
    .sort((a, b) => (a.iso < b.iso ? 1 : -1))[0]?.r || null;
}

function gazeteRace(r, leg) {
  const ranked = rankedHorses(leg);
  const vm = valueMap(leg);
  const { probOf } = legProbs(leg);
  const puanli = ranked.filter((x) => x.score > 0);
  const fav = puanli[0];
  const ilk4 = puanli.slice(0, 4).map((x) => x.h.no).join("-");
  let rows = "";
  ranked.forEach(({ h, score }, ix) => {
    const rank = ix + 1;
    const soy = [h.meta.baba, h.meta.anne].filter(Boolean).join(" — ");
    const kunye = [h.meta.yas ? esc(h.meta.yas) : "", soy ? esc(soy) : ""].filter(Boolean).join(" · ");
    const v = vm.get(h.no);
    const agf = v && v.agf != null ? `%${(v.agf * 100).toFixed(1)}${v.value ? " 💎" : ""}` : esc(h.meta.agf || "");
    // önceki koşu: ganyandan örtük % + handikap (hp)
    const onc = oncekiKosu(h.ad);
    const oncG = onc ? parseGanyan(onc.ganyan) : null;
    const oncPct = oncG ? `%${(100 / oncG).toFixed(1)}` : "";
    const oncHp = onc && isFinite(parseFloat(onc.hp)) ? esc(String(onc.hp)) : "";
    rows += `<tr class="${rank <= 4 && score > 0 ? "gz-top" : ""}">
      <td class="gz-rank">${score > 0 ? rank : "–"}</td>
      <td class="gz-no">${h.no}</td>
      <td class="gz-at"><b>${esc(h.ad)}</b>${kunye ? `<div class="gz-kunye">${kunye}</div>` : ""}</td>
      <td>${esc(h.meta.jokey || "")}<div class="gz-kunye">${esc(h.meta.kilo || "")} kg</div></td>
      <td>${esc(h.meta.sahip || "")}</td>
      <td>${esc(h.meta.antrenor || "")}</td>
      <td class="gz-c">${esc(h.meta.st || "")}</td>
      <td class="gz-c">${esc(h.meta.eniyi || "")}</td>
      <td class="gz-c">${agf}</td>
      <td class="gz-c">${oncPct}</td>
      <td class="gz-c">${oncHp}</td>
      <td class="gz-puan">${score > 0 ? score.toFixed(1) : "–"}${score > 0 ? `<div class="gz-kunye">%${(probOf(score) * 100).toFixed(0)}</div>` : ""}</td>
    </tr>`;
  });
  const favTxt = fav ? `TAGM favorisi: <b>${fav.h.no} ${esc(fav.h.ad)}</b> (%${(probOf(fav.score) * 100).toFixed(0)})` : "TAGM favorisi: —";
  return `<section class="gz-race">
    <div class="gz-rhead">
      <span class="gz-rno">${r.no}. Koşu</span> <span class="gz-rtime">${esc(r.saat || "")}</span>
      <span class="gz-rtags">${esc(r.grup || "")} · ${esc(r.mesafe || "")} ${esc(r.pist || "")} · ${esc(r.tur || "")}${r.ikramiye ? " · 1.lik: " + esc(r.ikramiye) : ""}</span>
    </div>
    <div class="gz-summary">${favTxt}${ilk4 ? ` · İlk 4 sıra: <b>${ilk4}</b>` : ""}</div>
    <table class="gz-table">
      <thead><tr><th>Sıra</th><th>No</th><th>At / Künye</th><th>Jokey / Kilo</th><th>Sahip</th><th>Antrenör</th><th>St</th><th>En iyi</th><th>AGF</th><th>Önc.%</th><th>Önc.HP</th><th>Puan</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </section>`;
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
// bayrak). Hiç işaret yoksa varsayılan: Altılı-1 = İLK 6 koşu, Altılı-2 = SON 6
// koşu. 10 koşuluk bir günde bu 1-6 ve 5-10 demektir; 5. ve 6. koşular ORTAK
// ayak olur (iki kuponda birden yer alır).
// İki altılı ancak günün koşu sayısı yeterliyse oynanır: her blok 6 ayak
// olduğundan 9'dan az koşulu günde ikinci altılı diye bir şey yoktur (tek
// altılı koşulur). Bu günlerde Altılı-2 düğmesi hiç gösterilmez ve eski
// oturumlardan kalmış a2 işaretleri temizlenir.
const IKI_ALTILI_MIN = 9;
function ikiAltiliVar() { return state.legs.length >= IKI_ALTILI_MIN; }

function ensureAltiliDefault() {
  const n = state.legs.length;
  if (!ikiAltiliVar()) state.legs.forEach((l) => { delete l.a2; });
  if (state.legs.some((l) => l.a1 || l.a2)) return;
  state.legs.forEach((l, i) => {
    l.a1 = i < 6;
    l.a2 = n >= IKI_ALTILI_MIN && i >= n - 6;
  });
}
/* Bu ayak iki altılıda birden mi? Ortak ayaktaki bir hata İKİ kuponu birden
   götürdüğü için burada daha geniş oynanır (bkz. legRecommendation). */
function ortakAyak(leg) { return !!(leg.a1 && leg.a2); }
function toggleAltili(li, b) {
  if (b === 2 && !ikiAltiliVar())
    return alert(`Bu günde ${state.legs.length} koşu var — ikinci altılı için en az ${IKI_ALTILI_MIN} koşu gerekir.`);
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
  // 7) ortak ayak: bu koşu iki altılıda birden; yanlış tahmin iki kuponu da
  // götürür, o yüzden bir at geniş tutulur.
  if (ortakAyak(leg)) { count++; reasons.push("ORTAK AYAK — iki kuponda birden (+1)"); }

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
    div.className = "kupon-leg" + (leg.a1 || leg.a2 ? " in-altili" : "") + (ortakAyak(leg) ? " ortak-ayak" : "");
    div.innerHTML = `
      <div class="kupon-leg-head">
        <h4>${leg.raceNo}. Koşu <span class="hint">(${leg.saat || ""} · ${leg.mesafe || ""} ${leg.pist || ""}${leg.grup ? " · " + esc(leg.grup) : ""})</span></h4>
        <div class="altili-toggles">
          ${ortakAyak(leg) ? `<span class="ortak-rozet" title="Bu koşu iki altılıda birden — buradaki hata iki kuponu birden götürür">ORTAK</span>` : ""}
          <button class="altili-tag alt1 ${leg.a1 ? "on" : ""}" title="Altılıya ekle/çıkar">${ikiAltiliVar() ? "Altılı-1" : "Altılı"}</button>
          ${ikiAltiliVar() ? `<button class="altili-tag alt2 ${leg.a2 ? "on" : ""}" title="Altılı-2'ye ekle/çıkar">Altılı-2</button>` : ""}
        </div>
      </div>
      <div class="rec-badge">🎯 Öneri: <b>${rec.count} at</b> — <span class="rec-reason">${esc(rec.reason)}</span></div>`;
    div.querySelector(".alt1").onclick = () => toggleAltili(li, 1);
    const alt2Btn = div.querySelector(".alt2");
    if (alt2Btn) alt2Btn.onclick = () => toggleAltili(li, 2);
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
      <div class="ticket-head">🎯 ${ikiAltiliVar() ? "ALTILI-" + bl : "ALTILI"} <span class="hint">(${legs.length} ayak)</span></div>
      <table class="ticket-table"><tbody>${rows}</tbody></table>
      <div class="ticket-foot">Dolu: <b>${filled.length}/${legs.length}</b> · Kombinasyon: <b>${combo.toLocaleString("tr-TR")}</b> · Tutar: <b>${(combo * price).toLocaleString("tr-TR", { maximumFractionDigits: 2 })} TL</b></div>
    </div>`;
  }
  $("#kuponSummary").innerHTML = html ||
    `<span class="hint">Henüz Altılı bloğu tanımlı değil. Ayak başlıklarındaki ${ikiAltiliVar() ? `"Altılı-1 / Altılı-2" düğmeleriyle koşuları bloklara ekleyin (bir koşu iki altılıda birden olabilir)` : `"Altılı" düğmesiyle 6 koşuyu işaretleyin`}.</span>`;
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
      const [program, sonuclar, idman, gecmis] = await Promise.all([
        tryFetch(`data/${day}/program-${c.slug}.json`),
        tryFetch(`data/${day}/sonuclar-${c.slug}.json`),
        tryFetch(`data/${day}/idman-${c.slug}.json`),
        tryFetch(`data/${day}/gecmis-${c.slug}.json`),
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
          // grup/tur legRecommendation'ın maiden ve Arap kurallarını besliyor —
          // taşınmazsa o kurallar backtest'te hiç tetiklenmez.
          pist: r.pist, mesafe: r.mesafe, ikramiye: r.ikramiye,
          grup: r.grup, tur: r.tur,
          horses: r.horses.filter((h) => !/koşmaz/i.test(h.ad)).map((h) => ({
            no: h.no, ad: h.ad, scores: {},
            meta: { kgs: h.kgs, son6: h.son6, eniyi: h.eniyi, agf: h.agf, h: h.h, jokey: h.jokey, antrenor: h.antrenor, sahip: h.sahip, kilo: h.kilo, st: h.st },
          })),
        };
        await scoreLeg(leg, { idman, day, city: c.name, gecmis });
        const ranked = rankedHorses(leg).filter((x) => x.score > 0);
        if (ranked.length < 2) continue;
        if (!leg.horses.some((h) => temizle(h.ad) === kazananAd)) continue; // kazanan programda bulunamadıysa atla
        // AGF favorisi (halkın 1 numarası) — kıyas çizgisi
        let agfFav = null, best = -1;
        for (const h of leg.horses) {
          const a = parseAgf(h.meta.agf);
          if (a != null && a > best) { best = a; agfFav = h; }
        }
        rows.push({ day, city: c.name, raceNo: r.no, leg, ranked, kazananAd, tabela, ganyan, agfFav,
                    odemeler: res.odemeler });
      }
    }
  }
  return rows;
}

/* Arşivden backtest — scripts/build_backtest.py çıktısı (data/arsiv/backtest/{yıl}.json).
   Günlük program+sonuç çifti yalnız cron'un başladığı tarihten beri var (~500 koşu);
   arşiv 2021'den beri ~31.790 koşu tutuyor. Buradaki koşular puanlamaya hazır:
   kgs/son6/eniyi atın O GÜNE KADARKİ geçmişinden türetildi, geleceği görmüyorlar.
   Eksikler: idman (B7) ve altılı ödeme satırı — arşiv CSV'sinde yok. */
async function collectBacktestArsiv(yillar, onProgress) {
  const rows = [];
  for (const yil of yillar) {
    onProgress?.(`${yil} indiriliyor…`);
    const kosular = await tryFetch(`data/arsiv/backtest/${yil}.json`);
    if (!kosular) continue;
    let i = 0;
    for (const k of kosular) {
      if (++i % 250 === 0) {
        onProgress?.(`${yil}: ${i}/${kosular.length} koşu`);
        await new Promise((r) => setTimeout(r)); // arayüz kilitlenmesin
      }
      const gelenler = k.atlar.filter((h) => typeof h.sira === "number").sort((a, b) => a.sira - b.sira);
      if (gelenler.length < 2) continue;
      const kazananAd = temizle(gelenler[0].ad);
      const tabela = new Set(gelenler.slice(0, 3).map((h) => temizle(h.ad)));
      const leg = {
        pist: k.pist, mesafe: k.mesafe, ikramiye: k.ikramiye, grup: k.grup, tur: k.tur,
        horses: k.atlar.map((h) => ({
          no: h.no, ad: h.ad, scores: {},
          meta: { kgs: h.kgs, son6: h.son6, eniyi: h.eniyi, agf: h.agf, h: h.h,
                  jokey: h.jokey, antrenor: h.antrenor, sahip: h.sahip, kilo: h.kilo, st: h.st },
        })),
      };
      await scoreLeg(leg, { day: k.gun, city: k.sehir, gecmis: null, profilsiz: true });
      const ranked = rankedHorses(leg).filter((x) => x.score > 0);
      if (ranked.length < 2) continue;
      let agfFav = null, best = -1;
      for (const h of leg.horses) {
        const a = parseAgf(h.meta.agf);
        if (a != null && a > best) { best = a; agfFav = h; }
      }
      rows.push({ day: k.gun, city: k.sehir, raceNo: k.no, leg, ranked, kazananAd, tabela,
                  ganyan: parseGanyan(gelenler[0].ganyan), agfFav, odemeler: "" });
    }
  }
  return rows;
}

/* ==================== ALTILI KUPON SİMÜLASYONU ==================== */
/* "1. 6'LI GANYAN(2,5/5/7/5/9/1) :12.185,75 TL" → [{sira:1, tutar:12185.75}]
   Altılı, ödeme satırının bulunduğu koşuda BİTER; ayakları o koşu ve öncesindeki
   5 koşudur. (4 Tem 2026 Ankara ile doğrulandı: K6'daki "1. 6'LI"nin kombinasyonu
   K1-K6 kazananlarına, K9'daki "2. 6'LI"nınki K4-K9 kazananlarına birebir uyuyor.) */
function altiliOdeme(odemeler) {
  const out = [];
  const re = /(?:(\d+)\.\s*)?6['’]?\s*LI\s+GANYAN\s*\([^)]*\)\s*:?\s*([\d.]+,\d+)/gi;
  let m;
  while ((m = re.exec(odemeler || ""))) out.push({ sira: +m[1] || 1, tutar: sayiTR(m[2]) });
  return out;
}

/* İki kupon politikasını aynı altılılar üzerinde yan yana ölçer.
   Maliyet "kolon" cinsinden, dönüş de kolon başına ödeme olduğu için ROI birim
   fiyattan bağımsız — hangi bahis birimini oynadığın sonucu değiştirmiyor. */
const ALTILI_POLITIKA = [
  { k: "auto", ad: "autoKupon — öneriye göre", sec: (r) => legRecommendation(r.leg).horses },
  { k: "tek", ad: "Tek kolon — her ayakta 1. tercih", sec: (r) => [r.ranked[0].h.no] },
];
function altiliRapor(rows) {
  const gunler = new Map(); // "gün|şehir" → (koşu no → satır)
  for (const r of rows) {
    const k = `${r.day}|${r.city}`;
    if (!gunler.has(k)) gunler.set(k, new Map());
    gunler.get(k).set(r.raceNo, r);
  }
  const sonuc = ALTILI_POLITIKA.map((p) => ({ ...p, n: 0, kazanan: 0, kolon: 0, donus: 0 }));
  let bulunan = 0, eksik = 0;
  for (const [, kosular] of gunler) {
    // 1) günün altılıları — ödeme satırından, varsayım yok
    const altililar = [];
    for (const [no, r] of kosular) {
      for (const od of altiliOdeme(r.odemeler)) {
        bulunan++;
        const ayaklar = [];
        for (let i = no - 5; i <= no; i++) ayaklar.push(kosular.get(i));
        altililar.push({ od, ayaklar, tam: ayaklar.every(Boolean) && od.tutar != null });
      }
    }
    // 2) ortak ayak bayrakları: legRecommendation kural 7'de bunu okuyor, canlı
    //    kullanımdaki genişletme davranışı backtest'te de birebir olsun
    altililar.forEach((a, ix) => a.ayaklar.forEach((r) => { if (r) r.leg["a" + (ix + 1)] = true; }));
    // 3) değerlendir
    for (const a of altililar) {
      if (!a.tam) { eksik++; continue; }
      for (const p of sonuc) {
        const secimler = a.ayaklar.map(p.sec);
        const kombin = secimler.reduce((t, x) => t * x.length, 1);
        const tuttu = a.ayaklar.every((r, i) => {
          const kaz = r.leg.horses.find((h) => temizle(h.ad) === r.kazananAd);
          return kaz && secimler[i].includes(kaz.no);
        });
        p.n++; p.kolon += kombin;
        if (tuttu) { p.kazanan++; p.donus += a.od.tutar; }
      }
    }
  }
  return { sonuc, bulunan, eksik, degerlendirilen: bulunan - eksik };
}

function altiliRaporHtml(rows) {
  const { sonuc, bulunan, eksik, degerlendirilen } = altiliRapor(rows);
  if (!degerlendirilen) {
    return `<h3 style="margin-top:24px">🎫 Altılı kupon simülasyonu</h3>
    <div class="empty-note">Değerlendirilebilir altılı bulunamadı${bulunan ? ` (${bulunan} altılı bulundu, ${eksik} tanesinin ayakları eksik)` : " — sonuç verisinde 6'LI GANYAN ödeme satırı yok"}.</div>`;
  }
  const satir = (p) => {
    const roi = p.kolon ? (p.donus / p.kolon - 1) * 100 : 0;
    return `<tr>
      <td>${esc(p.ad)}</td>
      <td>${p.kazanan}/${p.n} <span class="hint">(%${(p.kazanan / p.n * 100).toFixed(1)})</span></td>
      <td>${(p.kolon / p.n).toFixed(1)}</td>
      <td>${p.kolon.toLocaleString("tr-TR")}</td>
      <td>${p.donus.toLocaleString("tr-TR", { maximumFractionDigits: 0 })}</td>
      <td class="${roi >= 0 ? "pos" : "neg"}"><b>${roi >= 0 ? "+" : ""}${roi.toFixed(1)}%</b></td>
    </tr>`;
  };
  return `<h3 style="margin-top:24px">🎫 Altılı kupon simülasyonu <span class="hint">(${degerlendirilen} altılı${eksik ? `, ${eksik} tanesi ayak eksikliğinden atlandı` : ""})</span></h3>
  <div class="table-wrap"><table>
    <thead><tr><th>Politika</th><th>İsabet</th><th>Ort. kolon</th><th>Toplam kolon</th><th>Toplam dönüş</th><th>ROI</th></tr></thead>
    <tbody>${sonuc.map(satir).join("")}</tbody>
  </table></div>
  <p class="hint">Maliyet kolon sayısı, dönüş de kolon başına ödeme cinsinden — ROI birim bahis fiyatından bağımsızdır. Ayaklar, TJK'nın "6'LI GANYAN" ödeme satırından türetilir; tahmin edilmez. Ölü yarışta kazanan olarak sonuç listesinin ilk atı sayılır.</p>`;
}

/* Arşiv yıl kutucukları — build_backtest.py'nin index.json'ından. */
async function renderArsivYillar() {
  const el = $("#arsivYillar");
  if (!el) return;
  const idx = await tryFetch("data/arsiv/backtest/index.json");
  if (!idx) { $("#arsivBar").style.display = "none"; return; }
  const secili = LS.get("ab2:arsivYil", null);
  el.innerHTML = Object.entries(idx).map(([y, v]) =>
    `<label class="hint" style="margin-right:.7rem"><input type="checkbox" data-yil="${y}" ${
      secili ? (secili.includes(y) ? "checked" : "") : (y >= "2025" ? "checked" : "")
    }> ${y} <span style="opacity:.6">(${v.kosu})</span></label>`).join("");
  el.onchange = () => LS.set("ab2:arsivYil", secilenYillar());
}
const secilenYillar = () =>
  [...document.querySelectorAll("#arsivYillar input:checked")].map((c) => c.dataset.yil);

async function runBacktest(arsivden = false) {
  const st = $("#backtestStatus"), el = $("#backtestView");
  st.textContent = "Hesaplanıyor…";
  el.innerHTML = "";
  if (arsivden) {
    const yillar = secilenYillar();
    if (!yillar.length) { st.textContent = ""; el.innerHTML = `<div class="empty-note">En az bir yıl seçin.</div>`; return; }
    backtestRows = await collectBacktestArsiv(yillar, (t) => (st.textContent = "Arşiv: " + t));
  } else {
    backtestRows = await collectBacktest((t) => (st.textContent = "Hesaplanıyor… " + t));
  }
  st.textContent = "";
  if (!backtestRows.length) { el.innerHTML = `<div class="empty-note">Karşılaştırılacak koşu bulunamadı.</div>`; return; }

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
  html += altiliRaporHtml(backtestRows);
  // Arşiv backtest'i 10.000+ satır üretebiliyor; hepsini DOM'a basmak sayfayı
  // kilitliyor ve altındaki katsayı önerisini erişilemez kılıyordu. Son N koşu yeter.
  const SATIR_SINIR = 500;
  const gosterilen = detay.length > SATIR_SINIR ? detay.slice(-SATIR_SINIR) : detay;
  if (gosterilen.length < detay.length) {
    html += `<p class="hint">Aşağıdaki listede ${detay.length.toLocaleString("tr")} koşunun son ${SATIR_SINIR}'ü gösteriliyor — yukarıdaki oranlar tamamından hesaplandı.</p>`;
  }
  html += `<div class="table-wrap"><table><thead><tr><th>Gün</th><th>Şehir</th><th>Koşu</th><th>1. tercih</th><th>Sonuç</th><th>Kazanan</th><th>Ganyan</th><th>💎</th></tr></thead><tbody>`;
  for (const d of gosterilen) {
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
const TUNABLE = ["A1", "A2", "A3", "B1", "B4", "B5", "B6", "B7", "B8", "B10", "B11", "B12", "B13", "B14", "B15", "B16", "B17", "B18", "C4", "D1", "D2", "E1", "E2", "E3", "E4", "E5", "F2", "F3", "F4", "G3", "G4", "H1"];

/* Bir ağırlık vektörünün koşu başına ortalama log-olabilirliği (0'a yakın = iyi).
   Rastgele tahminin değeri ln(1/kadro) — ortalama 10 atlı kadroda ≈ -2.30. */
function logitUyum(races, w) {
  let t = 0;
  for (const { X, winIx } of races) {
    const z = X.map((x) => x.reduce((a, v, j) => a + v * w[j], 0));
    const mx = Math.max(...z);
    const ex = z.map((v) => Math.exp(v - mx));
    t += Math.log(ex[winIx] / ex.reduce((a, b) => a + b, 0));
  }
  return t / races.length;
}

/* Koşu-içi lojistik modeli gradyan yükselişiyle eğitir.
   İki ayar da ölçülerek seçildi (scratchpad'de sentetik testler):
   - Eski sabit 400 tur AZDI: bütün ağırlıklar aynı noktadan başladığı için alakasız
     kriterler o turda henüz sıfıra inmemiş oluyor, normalize edilince bütçenin
     yarısına yakınını yiyorlardı (%46).
   - Ama platoya kadar sürmek de FAZLA: 60-150 koşuluk gerçekçi boyutlarda model
     aşırı özgüvenli katsayı üretip görülmemiş veride rastgeleden kötü kalıyordu.
   Çözüm: doğrulama kümesi verilirse ORADA en iyi olan tur seçilir (erken durdurma);
   verilmezse eski plato ölçütüne düşülür.
   opt: { dogSet, olcek, sabitTur } — `olcek` ağırlıkları doğrulamada ölçmeden önce
   uygulanacak hâle çevirir (kullanıcının basacağı düğme onu yazacağı için). */
async function logitEgit(races, w0, st, etiket, opt = {}) {
  const { dogSet = null, olcek = (v) => v, sabitTur = 0 } = opt;
  const w = w0.slice();
  const lr = 0.1, l2 = 0.001, EPS = 1e-7, SABIR = 500, OLC_ARA = 25;
  // Arşiv backtest'i 10.000+ koşu getirebiliyor. Her turda TÜM koşuları gezmek
  // o boyutta tarayıcıyı dondurur (20.000 tur × 10.000 koşu). Veri büyükse her
  // turda rastgele bir alt küme kullan (mini-batch) ve tur sayısını sınırla.
  const PARTI = 400;
  const partili = races.length > PARTI;
  const MAX_ITER = sabitTur || (partili ? 1200 : 20000);
  // Doğrulama seti de büyük olabilir; her OLC_ARA turda tamamını gezmek pahalı.
  const dog = dogSet && dogSet.length > 1200 ? dogSet.slice(0, 1200) : dogSet;
  let onceki = -Infinity, ll = 0, iter = 0;
  let enIyi = dogSet ? { w: w.slice(), uyum: -Infinity, iter: 0 } : null;
  for (; iter < MAX_ITER; iter++) {
    const parti = partili
      ? Array.from({ length: PARTI }, () => races[(Math.random() * races.length) | 0])
      : races;
    const grad = new Array(w.length).fill(0);
    ll = 0;
    for (const { X, winIx } of parti) {
      const z = X.map((x) => x.reduce((t, v, j) => t + v * w[j], 0));
      const mx = Math.max(...z);
      const ex = z.map((v) => Math.exp(v - mx));
      const S = ex.reduce((a, b) => a + b, 0);
      ll += Math.log(ex[winIx] / S);
      X.forEach((x, i) => {
        const p = ex[i] / S;
        x.forEach((v, j) => { grad[j] += ((i === winIx ? 1 : 0) - p) * v; });
      });
    }
    ll /= parti.length;
    w.forEach((v, j) => { w[j] = v + lr * (grad[j] / parti.length - l2 * v); });
    if (dog && iter % OLC_ARA === 0) {
      const u = logitUyum(dog, olcek(w));
      if (u > enIyi.uyum) enIyi = { w: w.slice(), uyum: u, iter };
      else if (iter - enIyi.iter >= SABIR) break; // doğrulama artık iyileşmiyor
    } else if (!dogSet && !sabitTur && !partili && iter > 50 && ll - onceki < EPS) {
      break; // parti kullanılırken ll gürültülü olur, plato ölçütü güvenilmez
    }
    onceki = ll;
    // Sayfa donmasın ve kullanıcı ilerlediğini görsün — döngü senkron olduğu için
    // arada olay döngüsüne dönmezsek düğme tıklanmamış gibi duruyor.
    if (iter % (partili ? 25 : 250) === 0) {
      if (st) st.textContent = `${etiket}… ${iter} tur, uyum ${ll.toFixed(4)}`;
      await new Promise((res) => setTimeout(res));
    }
  }
  return dogSet ? { w: enIyi.w, uyum: enIyi.uyum, iter: enIyi.iter, ll }
                : { w, ll, iter };
}
async function suggestCoefs() {
  const el = $("#coefSuggestView"), st = $("#backtestStatus");
  el.innerHTML = "";
  // Kapalı kriterler toplam puana hiç girmiyor (bkz. legScore'daki enabled kontrolü);
  // onlara katsayı öğrenmek de, bütçeden pay vermek de yanıltıcı olur — dışarıda bırak.
  const aktif = TUNABLE.filter((k) => state.enabled[k]);
  if (!aktif.length) {
    el.innerHTML = `<div class="empty-note">Otomatik puanlanan kriterlerin hepsi kapalı — Katsayılar sekmesinden en az birini açın.</div>`;
    return;
  }
  if (!backtestRows) { st.textContent = "Önce veri toplanıyor…"; backtestRows = await collectBacktest((t) => (st.textContent = "Veri toplanıyor… " + t)); st.textContent = ""; }
  const races = [];
  for (const r of backtestRows) {
    const winIx = r.leg.horses.findIndex((h) => temizle(h.ad) === r.kazananAd);
    if (winIx < 0) continue;
    races.push({ X: r.leg.horses.map((h) => aktif.map((k) => (+h.scores[k] || 0) / 100)), winIx });
  }
  if (races.length < 20) {
    el.innerHTML = `<div class="empty-note">Katsayı önerisi için en az 20 sonuçlanmış koşu gerekir (şu an ${races.length}). Birkaç gün daha veri biriksin.</div>`;
    return;
  }
  // Başlangıç noktası: mevcut katsayılar (özellik /100 ölçeklendiği için ×100)
  const w0 = aktif.map((k) => state.coefs[k] * 100);
  const hedefToplam = aktif.reduce((t, k) => t + state.coefs[k], 0);
  // Uygulanacak hâle getir: negatifleri sıfırla, toplamı hedefe ölçekle.
  // Doğrulama da bu hâl üzerinden yapılmalı — kullanıcının basacağı düğme bunu yazıyor.
  const olcekle = (w) => {
    const pos = w.map((v) => Math.max(0, v));
    const tot = pos.reduce((a, b) => a + b, 0) || 1;
    return pos.map((v) => (v / tot) * hedefToplam);
  };

  // 1) AYRILMIŞ DOĞRULAMA — zaman sırası korunarak ilk %80'de eğit, son %20'de ölç.
  //    Rastgele bölme değil: gerçek kullanım da geçmişte öğrenip gelecekte oynamak.
  //    Eğitim uyumunu raporlamak yanıltıcı olurdu — az veride model ezberliyor.
  const kesim = Math.floor(races.length * 0.8);
  const test = races.slice(kesim);
  const olcekW = (w) => olcekle(w).map((v) => v * 100); // doğrulamada ölçülen hâl
  let dogrulama = null, sabitTur = 0;
  if (test.length >= 10) {
    const r = await logitEgit(races.slice(0, kesim), w0, st, "Doğrulama",
                              { dogSet: test, olcek: olcekW });
    sabitTur = Math.max(r.iter, 50); // nihai eğitim de burada dursun
    dogrulama = {
      n: test.length, tur: r.iter, oneri: r.uyum,
      mevcut: logitUyum(test, w0),
      taban: Math.log(1 / (test.reduce((t, r2) => t + r2.X.length, 0) / test.length)),
    };
  }

  // 2) Nihai katsayılar TÜM veriyle, doğrulamanın seçtiği tur sayısı kadar eğitilir.
  //    (Doğrulama yoksa plato ölçütüne düşer — o durumda uyarı gösteriliyor.)
  const { w, ll, iter } = await logitEgit(races, w0, st, "Eğitim", { sabitTur });
  st.textContent = "";
  const olcekli = olcekle(w);
  const oneri = {};
  aktif.forEach((k, j) => { oneri[k] = +olcekli[j].toFixed(4); });

  let dogHtml;
  if (!dogrulama) {
    dogHtml = `<p class="hint">⚠️ Ayrılmış doğrulama yapılamadı: son %20 dilimde en az 10 koşu gerekiyor. Aşağıdaki katsayılar sınanmadan üretildi — az veride model ezberler, dikkatli uygulayın.</p>`;
  } else {
    const d = dogrulama, iyi = d.oneri > d.mevcut;
    dogHtml = `<p class="hint">🔬 <b>Ayrılmış doğrulama</b> — son ${d.n} koşu eğitimde hiç kullanılmadı, uyum orada ölçüldü ve eğitim ${d.tur}. turda orada en iyi olan noktada durduruldu (0'a yakın daha iyi):</p>
    <div class="table-wrap"><table><tbody>
      <tr><td>Mevcut katsayılarınız</td><td><b>${d.mevcut.toFixed(4)}</b></td></tr>
      <tr><td>Önerilen katsayılar</td><td class="${iyi ? "pos" : "neg"}"><b>${d.oneri.toFixed(4)}</b> ${iyi ? "✅ daha iyi" : "❌ daha kötü"}</td></tr>
      <tr><td>Rastgele tahmin</td><td>${d.taban.toFixed(4)}</td></tr>
    </tbody></table></div>
    ${iyi && d.oneri > d.taban ? "" : `<p class="hint">⚠️ ${d.oneri <= d.taban
        ? "Öneri rastgele tahminden iyi değil — uygulamayın, veri birikmesini bekleyin."
        : "Öneri mevcut katsayılarınızı görülmemiş veride geçemedi — uygulamak muhtemelen işe yaramaz."}</p>`}`;
  }

  let html = `<h3 style="margin-top:24px">🧮 Önerilen katsayılar <span class="hint">(${races.length} koşu · ${iter} tur — yalnız açık ve otomatik puanlanan kriterler)</span></h3>
  ${dogHtml}
  <p class="hint">Eğitim uyumu ${ll.toFixed(4)} — bu sayı iyimserdir (model kendi eğitim verisinde ölçülüyor), kararınızı yukarıdaki doğrulama tablosuna göre verin.</p>
  <div class="table-wrap"><table><thead><tr><th>Kod</th><th>Kriter</th><th>Mevcut</th><th>Önerilen</th><th>Değişim</th></tr></thead><tbody>`;
  for (const k of aktif) {
    const a = ANGLES.find((x) => x.k === k);
    const cur = state.coefs[k], yeni = oneri[k];
    const yon = yeni > cur * 1.05 ? "🔼" : yeni < cur * 0.95 ? "🔽" : "≈";
    html += `<tr><td><b>${k}</b></td><td>${esc(a.name)}</td><td>${cur.toFixed(4)}</td><td><b>${yeni.toFixed(4)}</b></td><td>${yon}</td></tr>`;
  }
  html += `</tbody></table></div>
  <p><button id="btnApplyCoefs" class="btn btn-accent">✔ Önerilen katsayıları uygula</button>
  <span class="hint">Toplam ölçek korunur: önerilenlerin toplamı, <b>açık</b> otomatik kriterlerin mevcut katsayı toplamına (${hedefToplam.toFixed(4)}) eşittir; kapalı kriterlere dokunulmaz. Katsayılar sekmesinden her zaman varsayılana dönebilirsiniz.</span></p>`;
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

/* TAKI: TJK ayrı bir alan vermiyor, at adının SONUNA ekliyor —
 * "DAMPERLİ KG K" → ad "DAMPERLİ", takı [KG, K].
 * Beyaz liste ZORUNLU: arşivde BEY / KIZI / TAY / OF / THE / STAR gibi gerçek
 * isim kelimeleri de "sonda kısa büyük harfli kelime" desenine uyuyor; genel
 * bir regex bunları takı sanıp at adını kırpar.
 * scripts/build_sartlar.py içindeki taki_ayikla() ile aynı listeyi kullanır —
 * biri değişirse diğeri de değişmeli. */
const TAKI_KODLARI = new Set(["K", "KG", "DB", "SK", "SKG", "GKR", "ÖG", "SGKR"]);
function takiAyikla(ad) {
  const s = String(ad ?? "").trim();
  if (!s) return { ad: "", taki: [] };
  // "(Koşmaz)" gibi parantezli ek en sonda durur, takı ondan ÖNCE gelir
  const par = /\s*(\([^)]*\))\s*$/.exec(s);
  const govde = par ? s.slice(0, par.index) : s;
  const parcalar = govde.trim().split(/\s+/).filter(Boolean);
  const taki = [];
  while (parcalar.length > 1 && TAKI_KODLARI.has(parcalar[parcalar.length - 1])) {
    taki.unshift(parcalar.pop());
  }
  return { ad: parcalar.join(" ") + (par ? " " + par[1] : ""), taki };
}
function takiHTML(taki) {
  return taki && taki.length
    ? taki.map((t) => `<span class="taki-kod">${esc(t)}</span>`).join("")
    : `<span class="hint">—</span>`;
}
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
/* F3 için jokey adı eşleştirme.
   Program jokeyi KISALTMALI gelir ("MEH.TAŞKAYA", "M.B.ÇAKMAK AP"), idman
   sorgusu ise TAM ad verir ("AZİZ AKDEMİR"). Bu yüzden soyadın birebir tutması
   ve kısaltılmış ön adların tam adların başlangıcı olması aranır.
   "AP" (apranti) gibi sondaki sınıf eki atılır. */
function jokeyParcala(s) {
  const t = (s || "").toUpperCase().replace(/\s*\b(AP|A)\b\s*$/, "").trim();
  if (!t) return null;
  const p = t.split(/[.\s]+/).filter(Boolean);
  if (!p.length) return null;
  return { soyad: p[p.length - 1], on: p.slice(0, -1) };
}
function jokeyAyniMi(programJokey, idmanJokey) {
  const a = jokeyParcala(programJokey), b = jokeyParcala(idmanJokey);
  if (!a || !b || a.soyad !== b.soyad) return false;
  // Kısaltmalı taraf hangisiyse, onun her parçası diğerinin aynı sıradaki
  // parçasının başlangıcı olmalı. Ön ad hiç yazılmamışsa soyad eşleşmesi yeter.
  const n = Math.min(a.on.length, b.on.length);
  for (let i = 0; i < n; i++) {
    if (!a.on[i].startsWith(b.on[i]) && !b.on[i].startsWith(a.on[i])) return false;
  }
  return true;
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
window.AB = { state, ANGLES, RANK5, saveSession, renderAll, renderScoreTable, rankedHorses, slugify, esc, LS, scoreLeg, temizle, sartBul, sartOzellikleri, sartPuani, tryFetch, takiAyikla, takiHTML, computeScore, legProbs, legRecommendation };

/* ==================== F1: UZMAN TAHMİNLERİ ====================
 * Tahminci listesi tutulur (ör. Ferdi Akıncı, Final, Ferhat Pusa); YouTube/dergi
 * yorumunu izlerken ayak ayak F(avori)/P(lase)/S(ürpriz) işaretlenir → F1 puanı
 * işaretleyen tahmincilerin ortalamasıdır. Karne: kayıtlı işaretler yayınlanmış
 * sonuçlarla karşılaştırılıp tahminci başına isabet yüzdesi gösterilir. */
(() => {
  const DEF_UZMAN = ["Ferdi Akıncı", "Final", "Ferhat Pusa"];
  const uzmanlar = () => LS.get("ab2:uzmanlar", DEF_UZMAN);
  const FPS_PUAN = { F: 100, P: 60, S: 30 };
  let secili = uzmanlar()[0] || null;

  const pane = document.getElementById("tab-puanlama");
  if (!pane) return;
  const box = document.createElement("div");
  box.id = "uzmanPanel";
  box.innerHTML = `<details style="margin-top:14px">
    <summary style="cursor:pointer"><b>🎩 Uzman tahminleri (F1)</b> — tahminci seç, atları F/P/S işaretle</summary>
    <div class="toolbar" id="uzmanBar" style="flex-wrap:wrap;gap:6px;margin:8px 0"></div>
    <div id="uzmanMarks"></div>
    <div class="toolbar" style="margin-top:8px">
      <button class="btn" id="btnUzmanKarne">📋 Karne (isabet geçmişi)</button>
      <span class="hint">F=favori (kazanma), P=plase, S=sürpriz (ilk 3) olarak puanlanır.</span>
    </div>
    <div id="uzmanKarne"></div>
  </details>`;
  pane.appendChild(box);

  function renderBar() {
    const bar = box.querySelector("#uzmanBar");
    const list = uzmanlar();
    if (secili && !list.includes(secili)) secili = list[0] || null;
    bar.innerHTML = list.map((u) =>
      `<button class="btn ${u === secili ? "btn-accent" : "btn-ghost"}" data-uz="${esc(u)}">${esc(u)}
         <span data-uzdel="${esc(u)}" title="Tahminciyi sil" style="margin-left:4px;opacity:.6">✕</span></button>`).join("") +
      `<input id="uzmanYeni" placeholder="Yeni tahminci…" style="width:140px">
       <button class="btn btn-ghost" id="uzmanEkle">+ Ekle</button>`;
    bar.querySelectorAll("[data-uz]").forEach((b) => (b.onclick = (e) => {
      const del = e.target.dataset?.uzdel;
      if (del) {
        if (!confirm(`"${del}" silinsin mi? (işaretleri kalır, puanlamaya girmez)`)) return;
        LS.set("ab2:uzmanlar", uzmanlar().filter((x) => x !== del));
      } else secili = b.dataset.uz;
      renderBar(); renderMarks();
    }));
    bar.querySelector("#uzmanEkle").onclick = () => {
      const ad = bar.querySelector("#uzmanYeni").value.trim();
      if (!ad) return;
      const list2 = uzmanlar();
      if (!list2.includes(ad)) LS.set("ab2:uzmanlar", [...list2, ad]);
      secili = ad; renderBar(); renderMarks();
    };
  }

  function hesaplaF1(leg) {
    const list = uzmanlar();
    const isaretleyen = list.filter((u) => leg.horses.some((h) => h.uzman?.[u]));
    leg.horses.forEach((h) => {
      if (!isaretleyen.length) { delete h.scores.F1; return; }
      const t = isaretleyen.reduce((s, u) => s + (FPS_PUAN[h.uzman?.[u]] || 0), 0);
      const v = Math.round(t / isaretleyen.length);
      if (v) h.scores.F1 = v; else delete h.scores.F1;
    });
  }

  function renderMarks() {
    const el = box.querySelector("#uzmanMarks");
    const leg = state.legs[state.activeLeg];
    if (!leg || !secili) { el.innerHTML = `<p class="hint">Ayak yüklü değil ya da tahminci seçili değil.</p>`; return; }
    el.innerHTML = `<table class="score-table"><thead><tr><th>At</th><th colspan="3">${esc(secili)} işareti</th></tr></thead><tbody>` +
      leg.horses.map((h, i) => {
        const m = h.uzman?.[secili] || "";
        const btn = (k, lbl) =>
          `<td><button class="btn ${m === k ? "btn-accent" : "btn-ghost"}" data-fps="${k}" data-h="${i}">${lbl}</button></td>`;
        return `<tr><td>${h.no}. ${esc(h.ad)}</td>${btn("F", "Favori")}${btn("P", "Plase")}${btn("S", "Sürpriz")}</tr>`;
      }).join("") + "</tbody></table>";
    el.querySelectorAll("[data-fps]").forEach((b) => (b.onclick = () => {
      const h = leg.horses[+b.dataset.h];
      h.uzman = h.uzman || {};
      // aynı işarete tekrar basınca temizle
      if (h.uzman[secili] === b.dataset.fps) delete h.uzman[secili];
      else h.uzman[secili] = b.dataset.fps;
      hesaplaF1(leg); saveSession(); renderScoreTable();
    }));
  }

  /* --- Karne: kayıtlı tüm oturumlardaki işaretler × yayınlanmış sonuçlar --- */
  async function karne() {
    const out = box.querySelector("#uzmanKarne");
    out.innerHTML = `<p class="hint">Hesaplanıyor…</p>`;
    const list = uzmanlar();
    const stats = {}; // ad → {F:[n,isabet], P:[n,isabet], S:[n,isabet]}
    const sonCache = {};
    for (const k of Object.keys(localStorage)) {
      if (!k.startsWith("ab2:session:")) continue;
      const [, , day, city] = k.split(":");
      const s = LS.get(k, null);
      if (!s?.legs?.length || !s.legs.some((l) => (l.horses || []).some((h) => h.uzman))) continue;
      const ck = `${day}|${city}`;
      if (!(ck in sonCache)) sonCache[ck] = await tryFetch(`data/${day}/sonuclar-${city}.json`);
      const res = sonCache[ck];
      if (!res?.races) continue;
      for (const leg of s.legs) {
        const race = res.races.find((r) => r.no === leg.raceNo);
        if (!race?.horses?.length) continue;
        const bitis = {}; // at no → bitiş sırası (sonuçta atlar bitiş sırasıyla)
        race.horses.forEach((h, ix) => { bitis[String(h.no)] = ix + 1; });
        for (const h of leg.horses || []) {
          if (!h.uzman) continue;
          const sira = bitis[String(h.no)];
          if (!sira) continue; // koşmamış
          for (const u of list) {
            const mk = h.uzman[u];
            if (!mk) continue;
            const st = stats[u] || (stats[u] = { F: [0, 0], P: [0, 0], S: [0, 0] });
            st[mk][0]++;
            if (mk === "F" ? sira === 1 : sira <= 3) st[mk][1]++;
          }
        }
      }
    }
    const adlar = Object.keys(stats);
    if (!adlar.length) { out.innerHTML = `<p class="hint">Henüz sonuçlanmış işaret yok — tahmin işaretle, akşam sonuçlar gelince karne oluşur.</p>`; return; }
    const pct = (a) => (a[0] ? `%${Math.round((a[1] / a[0]) * 100)} <span class="hint">(${a[1]}/${a[0]})</span>` : "–");
    out.innerHTML = `<table class="score-table"><thead><tr><th>Tahminci</th><th>Favori→1.</th><th>Plase→ilk3</th><th>Sürpriz→ilk3</th></tr></thead><tbody>` +
      adlar.map((u) => `<tr><td>${esc(u)}</td><td>${pct(stats[u].F)}</td><td>${pct(stats[u].P)}</td><td>${pct(stats[u].S)}</td></tr>`).join("") +
      "</tbody></table>";
  }
  box.querySelector("#btnUzmanKarne").onclick = karne;

  // puanlama tablosu her çizildiğinde uzman panelini de tazele (ayak değişimini yakalar)
  const eskiRender = renderScoreTable;
  const yeniRender = function () { eskiRender.apply(this, arguments); renderBar(); renderMarks(); };
  renderScoreTable = yeniRender;
  window.AB.renderScoreTable = yeniRender;
  renderBar(); renderMarks();
})();

/* ==================== F2: GALOP BÜLTENİ (İLK 4) ====================
 * Bülten'in Galop sekmesi koşu başına atları galop puanına göre sıralıyor.
 * O sekme Cloudflare arkasında olduğu için otomatik çekilemiyor; ilk 4 at
 * elle işaretlenir: 1. sıra favori (100), 2/3/4 plase (70/50/30).
 * Bir sıra tek ata ait — aynı sırayı başka ata verince eskisinden düşer. */
(() => {
  const F2_PUAN = [100, 70, 50, 30];

  const pane = document.getElementById("tab-puanlama");
  if (!pane) return;
  const box = document.createElement("div");
  box.id = "galopPanel";
  box.innerHTML = `<details style="margin-top:14px">
    <summary style="cursor:pointer"><b>🏇 Galop bülteni (F2)</b> — otomatik; elle düzeltmek istersen sırala</summary>
    <div id="galopMarks"></div>
    <div class="toolbar" style="margin-top:8px">
      <button class="btn btn-ghost" id="btnGalopSil">Bu ayağın işaretlerini temizle (otomatiğe dön)</button>
      <span class="hint">1. = favori (100), 2. = 70, 3. = 50, 4. = 30 puan. Hiç işaret yoksa GP'ye göre otomatik sıralanır.</span>
    </div>
  </details>`;
  pane.appendChild(box);

  function hesaplaF2(leg) {
    leg.horses.forEach((h) => {
      const s = +h.galopSira;
      if (s >= 1 && s <= 4) h.scores.F2 = F2_PUAN[s - 1];
      else delete h.scores.F2;
    });
  }

  function renderMarks() {
    const el = box.querySelector("#galopMarks");
    const leg = state.legs[state.activeLeg];
    if (!leg) { el.innerHTML = `<p class="hint">Ayak yüklü değil.</p>`; return; }
    el.innerHTML = `<table class="score-table"><thead><tr><th>At</th><th colspan="4">Galop sırası</th></tr></thead><tbody>` +
      leg.horses.map((h, i) => {
        const cur = +h.galopSira || 0;
        const btn = (s) =>
          `<td><button class="btn ${cur === s ? "btn-accent" : "btn-ghost"}" data-gs="${s}" data-h="${i}">${s}.</button></td>`;
        return `<tr><td>${h.no}. ${esc(h.ad)}</td>${btn(1)}${btn(2)}${btn(3)}${btn(4)}</tr>`;
      }).join("") + "</tbody></table>";
    el.querySelectorAll("[data-gs]").forEach((b) => (b.onclick = () => {
      const s = +b.dataset.gs, h = leg.horses[+b.dataset.h];
      if (+h.galopSira === s) delete h.galopSira;          // aynı sıraya tekrar basınca temizle
      else {
        leg.horses.forEach((x) => { if (+x.galopSira === s) delete x.galopSira; }); // sıra tekil
        h.galopSira = s;
      }
      hesaplaF2(leg); saveSession(); renderScoreTable();
    }));
  }

  box.querySelector("#btnGalopSil").onclick = () => {
    const leg = state.legs[state.activeLeg];
    if (!leg) return;
    leg.horses.forEach((h) => delete h.galopSira);
    hesaplaF2(leg); saveSession(); renderScoreTable();
  };

  const eskiRender = renderScoreTable;
  const yeniRender = function () { eskiRender.apply(this, arguments); renderMarks(); };
  renderScoreTable = yeniRender;
  window.AB.renderScoreTable = yeniRender;
  renderMarks();
})();