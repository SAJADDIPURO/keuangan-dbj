// ============================================================
// kelola.js — admin bisa edit/hapus/tambah data langsung dari web
// ============================================================

// Config semua tabel: kolom, label, dan tipe data (nentuin cara tampil & jenis input pas edit)
const TABLES = {
  kh: {
    table: "transaksi_harian", dateField: "tanggal", orderField: "tanggal", limit: 30,
    columns: [
      { field: "tanggal", label: "Tanggal", type: "date" },
      { field: "omzet", label: "Omzet", type: "money" },
      { field: "jumlah_transaksi", label: "Jumlah Transaksi", type: "number" },
      { field: "laba_kotor_persen", label: "Laba Kotor (%)", type: "percent" },
      { field: "kas_masuk", label: "Kas Masuk", type: "money" },
      { field: "kas_keluar", label: "Kas Keluar", type: "money" },
      { field: "qris", label: "QRIS", type: "money" },
      { field: "tunai", label: "Tunai", type: "money" },
    ],
  },
  piutang: {
    table: "piutang", dateField: "tanggal", orderField: "tanggal", limit: 50,
    columns: [
      { field: "tanggal", label: "Tanggal", type: "date" },
      { field: "pelanggan", label: "Pelanggan", type: "text" },
      { field: "jumlah", label: "Jumlah", type: "money" },
      { field: "lunas", label: "Lunas", type: "boolean" },
    ],
  },
  persediaan: {
    table: "persediaan_harian", dateField: "tanggal", orderField: "tanggal", limit: 30,
    columns: [
      { field: "tanggal", label: "Tanggal", type: "date" },
      { field: "nilai_persediaan", label: "Nilai Persediaan", type: "money" },
      { field: "fast_moving_habis", label: "Fast Moving Habis", type: "number" },
      { field: "slow_moving_persen", label: "Slow Moving (%)", type: "percent" },
      { field: "expired_6_bulan", label: "Expired < 6 Bln", type: "number" },
      { field: "expired_3_bulan", label: "Expired < 3 Bln", type: "number" },
      { field: "stock_out", label: "Stock Out", type: "number" },
      { field: "ketersediaan_persen", label: "Ketersediaan (%)", type: "percent" },
    ],
  },
  pelayanan: {
    table: "pelayanan_harian", dateField: "tanggal", orderField: "tanggal", limit: 30,
    columns: [
      { field: "tanggal", label: "Tanggal", type: "date" },
      { field: "resep_masuk", label: "Resep Masuk", type: "number" },
      { field: "resep_selesai_persen", label: "Resep Selesai (%)", type: "percent" },
      { field: "waktu_layanan_menit", label: "Waktu Layanan (menit)", type: "number" },
      { field: "komplain", label: "Komplain", type: "number" },
      { field: "pelanggan_baru", label: "Pelanggan Baru", type: "number" },
      { field: "pelanggan_loyal", label: "Pelanggan Loyal", type: "number" },
      { field: "pengantaran", label: "Pengantaran", type: "number" },
    ],
  },
  produk: {
    table: "produk_terlaris", dateField: "tanggal", orderField: "tanggal", limit: 50,
    columns: [
      { field: "tanggal", label: "Tanggal", type: "date" },
      { field: "peringkat", label: "Peringkat", type: "number" },
      { field: "nama_produk", label: "Nama Produk", type: "text" },
      { field: "qty", label: "Qty", type: "number" },
      { field: "omzet", label: "Omzet", type: "money" },
    ],
  },
  sdm: {
    table: "sdm_harian", dateField: "tanggal", orderField: "tanggal", limit: 30,
    columns: [
      { field: "tanggal", label: "Tanggal", type: "date" },
      { field: "kehadiran_persen", label: "Kehadiran (%)", type: "percent" },
      { field: "keterlambatan", label: "Keterlambatan", type: "number" },
      { field: "briefing_pagi", label: "Briefing Pagi", type: "boolean" },
      { field: "sop_dipatuhi_persen", label: "SOP Dipatuhi (%)", type: "percent" },
      { field: "kebersihan", label: "Kebersihan", type: "text" },
    ],
  },
  bulanan: {
    table: "keuangan_bulanan", dateField: "bulan", orderField: "bulan", limit: 12,
    columns: [
      { field: "bulan", label: "Bulan", type: "month" },
      { field: "target_omzet", label: "Target Omzet", type: "money" },
      { field: "hpp", label: "HPP", type: "money" },
      { field: "biaya_operasional", label: "Biaya Operasional", type: "money" },
    ],
  },
};

// cache data yang lagi ditampilkan
const CACHE = {};

async function initKelola() {
  const session = await requireLogin();
  if (!session) return;

  const role = session.user.app_metadata?.role || "user";
  if (role !== "admin") {
    window.location.href = "input.html";
    return;
  }

  document.getElementById("userEmail").textContent = session.user.email;
  document.getElementById("todayLabel").textContent = tanggalIndo(todayStr());

  for (const key of Object.keys(TABLES)) {
    await loadTabel(key);
  }
}

async function loadTabel(key) {
  const cfg = TABLES[key];
  const { data, error } = await supabaseClient
    .from(cfg.table).select("*")
    .order(cfg.orderField, { ascending: false })
    .order("id", { ascending: false })
    .limit(cfg.limit);

  CACHE[key] = data || [];
  renderTabel(key);
}

// ---------- Input langsung per tipe kolom ----------
function inputFor(col, value) {
  const v = value === null || value === undefined ? "" : value;
  switch (col.type) {
    case "date":
      return `<input type="date" data-edit="${col.field}" value="${v}">`;
    case "month":
      return `<input type="month" data-edit="${col.field}" value="${String(v).slice(0,7)}">`;
    case "boolean":
      return `<select data-edit="${col.field}">
        <option value="true" ${v === true ? "selected" : ""}>Ya</option>
        <option value="false" ${v === false ? "selected" : ""}>Tidak</option>
      </select>`;
    case "text":
      return `<input type="text" data-edit="${col.field}" value="${v}">`;
    case "percent":
      return `<input type="number" step="0.1" data-edit="${col.field}" value="${v}">`;
    default: // money, number
      return `<input type="number" data-edit="${col.field}" value="${v}">`;
  }
}

// Tabel langsung berisi input di tiap sel, nggak perlu klik "Edit" dulu
function renderTabel(key) {
  const cfg = TABLES[key];
  const rows = CACHE[key];
  const wrap = document.getElementById("wrap-" + key);

  let html = `<table class="data" id="tbl-${key}"><thead><tr>`;
  cfg.columns.forEach(c => { html += `<th>${c.label}</th>`; });
  html += `<th>Aksi</th></tr></thead><tbody>`;

  if (!rows.length) {
    html += `<tr><td colspan="${cfg.columns.length + 1}" style="text-align:center;color:var(--ink-soft);padding:20px;">Belum ada data</td></tr>`;
  }

  rows.forEach(row => {
    html += `<tr data-id="${row.id}">`;
    cfg.columns.forEach(c => { html += `<td>${inputFor(c, row[c.field])}</td>`; });
    html += `<td class="row-actions">
      <button class="btn" onclick="simpanRow('${key}', ${row.id})">Simpan</button>
      <button class="btn secondary" onclick="hapusRow('${key}', ${row.id})">Hapus</button>
    </td></tr>`;
  });

  html += `</tbody></table>`;
  wrap.innerHTML = html;
}

async function simpanRow(key, id) {
  const cfg = TABLES[key];
  const tr = document.querySelector(`#tbl-${key} tr[data-id="${id}"]`);
  const payload = {};

  cfg.columns.forEach(c => {
    const input = tr.querySelector(`[data-edit="${c.field}"]`);
    let val = input.value;
    if (c.type === "boolean") val = val === "true";
    else if (c.type === "number" || c.type === "money" || c.type === "percent") val = val === "" ? 0 : Number(val);
    else if (c.type === "month") val = val ? `${val}-01` : null;
    payload[c.field] = val;
  });

  const { error } = await supabaseClient.from(cfg.table).update(payload).eq("id", id);
  if (error) {
    alert("Gagal simpan: " + error.message);
    return;
  }
  await loadTabel(key);
}

// ---------- Hapus ----------
async function hapusRow(key, id) {
  if (!confirm("Yakin mau hapus data ini? Tindakan ini tidak bisa dibatalkan.")) return;
  const cfg = TABLES[key];
  const { error } = await supabaseClient.from(cfg.table).delete().eq("id", id);
  if (error) {
    alert("Gagal hapus: " + error.message);
    return;
  }
  await loadTabel(key);
}

// ---------- Tambah baris kosong ----------
async function tambahBaris(key) {
  const cfg = TABLES[key];
  const payload = {};
  cfg.columns.forEach(c => {
    if (c.field === cfg.dateField) {
      payload[c.field] = cfg.dateField === "bulan" ? monthStartStr() : todayStr();
    } else if (c.type === "boolean") payload[c.field] = false;
    else if (c.type === "text") payload[c.field] = "";
    else payload[c.field] = 0;
  });

  const { error } = await supabaseClient.from(cfg.table).insert(payload);
  if (error) {
    alert("Gagal tambah baris: " + error.message);
    return;
  }
  await loadTabel(key);
}

// ---------- Tabs ----------
function showTab(tabId, btn) {
  document.querySelectorAll(".panel").forEach(p => p.classList.add("hidden"));
  document.getElementById(tabId).classList.remove("hidden");
  document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
}

initKelola();