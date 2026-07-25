/* ===== 🏆 "Bu şartta kim kazanmış" paneli (G2'nin vitrini) =====
 * Aktif koşunun şartını (ırk · yaş · koşu cinsi · mesafe · pist) arşivdeki
 * şart profiliyle eşleştirip:
 *   - tipik KAZANAN profilini (kilo / kulvar / yaş / ganyan bantları),
 *   - o şartta son kazanan atları,
 *   - bugünkü kadronun bu profile yakınlığını (G2 puanı)
 * gösterir. Puanlama G2 kriteri app.js'te hesaplanır; bu panel yalnız
 * gerekçeyi görünür kılar.
 */
(function () {
  const AB = window.AB;
  if (!AB || typeof AB.sartBul !== "function") return;

  const pane = document.getElementById("tab-puanlama");
  if (!pane) return;
  const box = document.createElement("div");
  box.id = "sartPanel";
  pane.appendChild(box);

  const bantMetin = (b, birim) => (b ? `${b[1]}–${b[3]}${birim || ""} <span class="hint">(orta ${b[2]})</span>` : "—");

  async function ciz() {
    const leg = AB.state.legs[AB.state.activeLeg];
    if (!leg) { box.innerHTML = ""; return; }
    if (AB.state.sartlar === undefined) AB.state.sartlar = await AB.tryFetch("data/arsiv/sartlar.json");
    const sart = AB.sartBul(leg, AB.state.sartlar);
    if (!sart) {
      box.innerHTML = `<details class="sart-box"><summary><b>🏆 Bu şartta kim kazanmış</b></summary>
        <p class="hint">Bu koşu şartı için arşivde yeterli örnek yok.</p></details>`;
      return;
    }
    const r = sart.r;
    const [irk, ...kalan] = sart.k.split("|");
    const dayInt = parseInt(String(AB.state.day).replace(/-/g, ""), 10);
    const ozellikler = AB.sartOzellikleri(leg.horses, sart, AB.state.stats, dayInt);

    const kazananlar = (r.ornek || []).map((o) => `
      <tr><td>${AB.esc(o.t)}</td><td>${AB.esc(o.s || "")}</td><td><b>${AB.esc(o.ad)}</b></td>
          <td>${AB.esc(String(o.st ?? "—"))}</td><td>${AB.esc(o.kilo || "—")}</td>
          <td>${AB.esc((o.yas || "").split(" ")[0] || "—")}</td><td>${AB.esc(o.ganyan || "—")}</td>
          <td>${AB.esc(o.agf || "—")}</td><td>${AB.esc(o.jokey || "")}</td></tr>`).join("");

    const atlar = leg.horses.map((h, i) => {
      const p = AB.sartPuani(ozellikler[i]);
      const kirilim = (ozellikler[i] || []).map((x) =>
        `<span class="sart-oz sart-${x.v === 1 ? "tam" : x.v === 0.5 ? "yari" : "yok"}">${AB.esc(x.ad)} ${x.deger ?? "—"}</span>`).join(" ");
      return { h, p, kirilim };
    }).sort((a, b) => (b.p ?? -1) - (a.p ?? -1));

    box.innerHTML = `<details class="sart-box">
      <summary><b>🏆 Bu şartta kim kazanmış</b> <span class="hint">— G2 kriterinin dayanağı (${r.n} geçmiş koşu)</span></summary>
      <p class="hint">Eşleşen şart: <b>${AB.esc(irk)}</b> · ${AB.esc(kalan.join(" · "))} — arşivde <b>${r.n}</b> koşu.</p>
      <p class="sart-bant">Tipik kazanan → kilo <b>${bantMetin(r.kilo, " kg")}</b> · kulvar <b>${bantMetin(r.st)}</b>
         · yaş <b>${bantMetin(r.yas)}</b> · ganyan <b>${bantMetin(r.ganyan)}</b>${r.agf ? ` · AGF <b>${bantMetin(r.agf, "%")}</b>` : ""}</p>
      <div class="table-wrap"><table class="score-table sart-tablo">
        <thead><tr><th>Tarih</th><th>Şehir</th><th>Kazanan</th><th>Kulvar</th><th>Kilo</th><th>Yaş</th><th>Ganyan</th><th>AGF</th><th>Jokey</th></tr></thead>
        <tbody>${kazananlar}</tbody></table></div>
      <p class="hint" style="margin-top:10px">Bugünkü kadronun bu profile yakınlığı (G2):</p>
      <div class="table-wrap"><table class="score-table sart-tablo">
        <thead><tr><th>At</th><th>G2</th><th>Eşleşen özellikler</th></tr></thead><tbody>
        ${atlar.map(({ h, p, kirilim }) => `<tr><td>${h.no}. ${AB.esc(h.ad)}</td>
           <td><b>${p == null ? "—" : p}</b></td><td>${kirilim || '<span class="hint">veri yok</span>'}</td></tr>`).join("")}
        </tbody></table></div>
    </details>`;
  }

  // Puanlama tablosu her çizildiğinde paneli tazele (ayak değişimini yakalar)
  const eski = window.renderScoreTable;
  const yeni = function () { eski.apply(this, arguments); ciz(); };
  window.renderScoreTable = yeni;
  AB.renderScoreTable = yeni;
  ciz();
})();
