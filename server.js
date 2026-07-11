/* Altılı Bulan — şifre + IP korumalı statik sunucu (bağımlılıksız Node ≥18).
 *
 * Ortam değişkenleri (Render → Environment):
 *   AUTH_USER    zorunlu — kullanıcı adı
 *   AUTH_PASS    zorunlu — şifre (repo herkese açık olduğu için koda YAZILMAZ)
 *   SECRET       önerilir — oturum imza anahtarı (boşsa her açılışta yenilenir,
 *                sunucu yeniden başlayınca herkes tekrar giriş yapar)
 *   ALLOWED_IPS  isteğe bağlı — virgüllü IP listesi; doluysa yalnız bu IP'ler
 *                giriş yapabilir. Boşsa herkes giriş deneyebilir ama oturum,
 *                giriş yapılan IP'ye kilitlenir (çerez çalınsa da başka IP'den çalışmaz).
 *   SESSION_HOURS oturum süresi (varsayılan 720 = 30 gün)
 */
"use strict";
const http = require("http");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const KOK = __dirname;
const PORT = process.env.PORT || 10000;
const USER = process.env.AUTH_USER || "";
const PASS = process.env.AUTH_PASS || "";
const SECRET = process.env.SECRET || crypto.randomBytes(32).toString("hex");
const IZINLI_IP = (process.env.ALLOWED_IPS || "").split(",").map((s) => s.trim()).filter(Boolean);
const OTURUM_SAAT = +(process.env.SESSION_HOURS || 720);

const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json", ".png": "image/png",
  ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".ico": "image/x-icon",
  ".pdf": "application/pdf", ".txt": "text/plain; charset=utf-8",
};

const ip = (req) =>
  ((req.headers["x-forwarded-for"] || "").split(",")[0].trim()) ||
  req.socket.remoteAddress || "";

const hmac = (s) => crypto.createHmac("sha256", SECRET).update(s).digest("base64url");

function oturumVer(res, kullanici, istekIp) {
  const son = Date.now() + OTURUM_SAAT * 3600_000;
  const veri = Buffer.from(`${kullanici}|${istekIp}|${son}`).toString("base64url");
  res.setHeader("Set-Cookie",
    `oturum=${veri}.${hmac(veri)}; Path=/; Max-Age=${OTURUM_SAAT * 3600}; HttpOnly; SameSite=Lax; Secure`);
}

function oturumGecerli(req) {
  const m = /(?:^|;\s*)oturum=([^;]+)/.exec(req.headers.cookie || "");
  if (!m) return false;
  const [veri, imza] = m[1].split(".");
  if (!veri || !imza) return false;
  try {
    if (!crypto.timingSafeEqual(Buffer.from(imza), Buffer.from(hmac(veri)))) return false;
  } catch { return false; }
  const [kullanici, kayitliIp, son] = Buffer.from(veri, "base64url").toString().split("|");
  if (kullanici !== USER || Date.now() > +son) return false;
  return kayitliIp === ip(req); // oturum, giriş yapılan IP'ye kilitli
}

const GIRIS_SAYFASI = (hata) => `<!doctype html><html lang="tr"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Altılı Bulan — Giriş</title><style>
body{font-family:-apple-system,system-ui,sans-serif;background:#12141a;color:#eee;
display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}
form{background:#1c1f27;padding:32px;border-radius:12px;width:min(320px,90vw)}
h1{font-size:20px;margin:0 0 16px}input{display:block;width:100%;box-sizing:border-box;
margin:8px 0;padding:10px;border-radius:8px;border:1px solid #333;background:#12141a;color:#eee}
button{width:100%;padding:10px;margin-top:12px;border:0;border-radius:8px;
background:#0d7a5f;color:#fff;font-weight:600;cursor:pointer}
.hata{color:#ff7b7b;font-size:13px;margin-top:8px}</style></head><body>
<form method="post" action="/giris">
<h1>🏇 Altılı Bulan</h1>
<input name="kullanici" placeholder="Kullanıcı adı" autocomplete="username" required>
<input name="sifre" type="password" placeholder="Şifre" autocomplete="current-password" required>
<button>Giriş</button>${hata ? `<div class="hata">${hata}</div>` : ""}
</form></body></html>`;

function esitMi(a, b) {
  const ab = Buffer.from(String(a)), bb = Buffer.from(String(b));
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://x");
  const istekIp = ip(req);

  if (url.pathname === "/healthz") { res.end("ok"); return; }

  if (req.method === "POST" && url.pathname === "/giris") {
    let govde = "";
    req.on("data", (c) => { govde += c; if (govde.length > 4096) req.destroy(); });
    req.on("end", () => {
      const p = new URLSearchParams(govde);
      if (IZINLI_IP.length && !IZINLI_IP.includes(istekIp)) {
        res.writeHead(403, { "Content-Type": "text/html; charset=utf-8" });
        res.end(GIRIS_SAYFASI("Bu IP adresine izin verilmiyor: " + istekIp));
        return;
      }
      if (USER && PASS && esitMi(p.get("kullanici"), USER) && esitMi(p.get("sifre"), PASS)) {
        oturumVer(res, USER, istekIp);
        res.writeHead(302, { Location: "/" });
        res.end();
      } else {
        res.writeHead(401, { "Content-Type": "text/html; charset=utf-8" });
        res.end(GIRIS_SAYFASI(USER && PASS ? "Kullanıcı adı veya şifre hatalı." :
          "Sunucuda AUTH_USER/AUTH_PASS tanımlı değil — Render ortam değişkenlerini ayarlayın."));
      }
    });
    return;
  }

  if (!oturumGecerli(req)) {
    res.writeHead(401, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
    res.end(GIRIS_SAYFASI(""));
    return;
  }

  // statik dosya sunumu
  let dosya = decodeURIComponent(url.pathname);
  if (dosya.endsWith("/")) dosya += "index.html";
  const tam = path.normalize(path.join(KOK, dosya));
  if (!tam.startsWith(KOK) || /[\\/]\.(git|github)/.test(tam)) {
    res.writeHead(404); res.end(); return;
  }
  fs.readFile(tam, (err, veri) => {
    if (err) { res.writeHead(404); res.end("bulunamadı"); return; }
    const uz = path.extname(tam).toLowerCase();
    res.writeHead(200, {
      "Content-Type": MIME[uz] || "application/octet-stream",
      "Cache-Control": uz === ".html" ? "no-cache" : "public, max-age=300",
    });
    res.end(veri);
  });
});

server.listen(PORT, () => {
  console.log(`Altılı Bulan sunucusu ${PORT} portunda` +
    (USER && PASS ? "" : " — UYARI: AUTH_USER/AUTH_PASS tanımlı değil, giriş kapalı") +
    (IZINLI_IP.length ? ` — izinli IP: ${IZINLI_IP.join(", ")}` : " — oturumlar giriş IP'sine kilitlenir"));
});
