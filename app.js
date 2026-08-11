// ============================================================
// app.js — shared logic dipakai di index.html & input.html
// ============================================================

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ---------- AUTH GUARD ----------
// Cek apakah user sudah login. Kalau belum, lempar ke login.html
async function requireLogin() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) {
    window.location.href = "login.html";
    return null;
  }
  return session;
}

async function logout() {
  await supabaseClient.auth.signOut();
  window.location.href = "login.html";
}

// ---------- FORMAT HELPERS ----------
function rupiah(n) {
  n = Number(n) || 0;
  return "Rp" + n.toLocaleString("id-ID", { maximumFractionDigits: 0 });
}
function angka(n, digits = 0) {
  n = Number(n) || 0;
  return n.toLocaleString("id-ID", { maximumFractionDigits: digits });
}
function persen(n) {
  n = Number(n) || 0;
  return angka(n, 1) + "%";
}
function todayStr() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}
function yesterdayStr() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}
function monthStartStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}
function tanggalIndo(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

// ---------- STATUS (traffic light) ----------
// mode "tinggi" = makin tinggi makin bagus (default)
// mode "rendah" = makin rendah makin bagus (mis. komplain, waktu layanan, expired)
function statusOf(value, target, mode = "tinggi") {
  value = Number(value) || 0;
  target = Number(target) || 0;
  if (target === 0) return "g";
  let ratio;
  if (mode === "tinggi") {
    ratio = value / target;
  } else {
    if (value <= target) return "g";
    ratio = target / value;
  }
  if (ratio >= 1) return "g";
  if (ratio >= 0.8) return "y";
  return "r";
}
function statusLabel(s) {
  return { g: "Tercapai", y: "Perhatian", r: "Tindakan" }[s] || "-";
}
function pillHtml(s) {
  const dotColor = { g: "🟢", y: "🟡", r: "🔴" }[s];
  return `<span class="status-pill ${s}">${dotColor} ${statusLabel(s)}</span>`;
}
function dotHtml(s) {
  return `<span class="dot ${s}"></span>`;
}