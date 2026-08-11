// ============================================================
// input.js — simpan data dari input.html ke Supabase
// ============================================================

async function initInput() {
  const session = await requireLogin();
  if (!session) return;

  document.getElementById("userEmail").textContent = session.user.email;
  document.getElementById("todayLabel").textContent = tanggalIndo(todayStr());

  // Sembunyikan tombol "Kembali ke Dashboard" kalau yang login bukan admin
  const role = session.user.app_metadata?.role || "user";
  if (role !== "admin") {
    const backBtn = document.querySelector('a[href="index.html"]');
    if (backBtn) backBtn.style.display = "none";
  }

  // Auto-isi semua input tanggal dengan hari ini
  ["kh-tanggal", "pt-tanggal", "ps-tanggal", "pl-tanggal", "pd-tanggal", "sd-tanggal"]
    .forEach(id => { document.getElementById(id).value = todayStr(); });

  // Auto-isi bulan berjalan untuk Keuangan Bulanan (format YYYY-MM)
  const d = new Date();
  document.getElementById("kb-bulan").value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

  buildProdukRows();
  await loadPiutangList();
}

// ---------- Helper: tampilkan pesan sukses/error ----------
function showMsg(elId, ok, text) {
  const el = document.getElementById(elId);
  el.innerHTML = `<div class="msg ${ok ? "ok" : "err"}">${text}</div>`;
  setTimeout(() => { el.innerHTML = ""; }, 4000);
}

// ---------- Helper inti: update kalau sudah ada baris untuk tanggal itu, insert kalau belum ----------
async function upsertByDate(table, dateField, dateValue, payload, extraMatch = {}) {
  let query = supabaseClient.from(table).select("id").eq(dateField, dateValue);
  Object.entries(extraMatch).forEach(([k, v]) => { query = query.eq(k, v); });
  const { data: existing } = await query.maybeSingle();

  if (existing) {
    return await supabaseClient.from(table).update(payload).eq("id", existing.id);
  } else {
    return await supabaseClient.from(table).insert({ [dateField]: dateValue, ...extraMatch, ...payload });
  }
}

function numVal(id) {
  const v = document.getElementById(id).value;
  return v === "" ? 0 : Number(v);
}
function textVal(id) {
  return document.getElementById(id).value.trim();
}

// ---------- KEUANGAN HARIAN ----------
async function simpanKeuanganHarian() {
  const tanggal = textVal("kh-tanggal");
  if (!tanggal) return showMsg("kh-msg", false, "Tanggal wajib diisi.");

  const payload = {
    omzet: numVal("kh-omzet"),
    jumlah_transaksi: numVal("kh-jumlah_transaksi"),
    laba_kotor_persen: numVal("kh-laba_kotor_persen"),
    kas_masuk: numVal("kh-kas_masuk"),
    kas_keluar: numVal("kh-kas_keluar"),
    qris: numVal("kh-qris"),
    tunai: numVal("kh-tunai"),
  };
  const { error } = await upsertByDate("transaksi_harian", "tanggal", tanggal, payload);
  showMsg("kh-msg", !error, error ? `Gagal: ${error.message}` : "Keuangan harian tersimpan ✓");
}

// ---------- PIUTANG ----------
async function tambahPiutang() {
  const tanggal = textVal("pt-tanggal");
  const pelanggan = textVal("pt-pelanggan");
  const jumlah = numVal("pt-jumlah");
  if (!tanggal || !pelanggan || jumlah <= 0) {
    return showMsg("pt-msg", false, "Tanggal, nama pelanggan, dan jumlah wajib diisi.");
  }
  const { error } = await supabaseClient.from("piutang").insert({ tanggal, pelanggan, jumlah, lunas: false });
  showMsg("pt-msg", !error, error ? `Gagal: ${error.message}` : "Piutang ditambahkan ✓");
  if (!error) {
    document.getElementById("pt-pelanggan").value = "";
    document.getElementById("pt-jumlah").value = "";
    await loadPiutangList();
  }
}

async function loadPiutangList() {
  const { data } = await supabaseClient
    .from("piutang").select("*").eq("lunas", false).order("tanggal", { ascending: false });
  const el = document.getElementById("pt-list");
  if (!data || data.length === 0) {
    el.innerHTML = `<p style="color:var(--ink-soft);font-size:13px;">Tidak ada piutang belum lunas.</p>`;
    return;
  }
  el.innerHTML = `<table class="data"><thead><tr>
      <th>Tanggal</th><th>Pelanggan</th><th>Jumlah</th><th></th>
    </tr></thead><tbody>` +
    data.map(p => `
      <tr>
        <td>${tanggalIndo(p.tanggal)}</td>
        <td class="label">${p.pelanggan}</td>
        <td>${rupiah(p.jumlah)}</td>
        <td><button class="btn secondary" style="padding:6px 14px;font-size:12.5px;" onclick="tandaiLunas(${p.id})">Tandai Lunas</button></td>
      </tr>
    `).join("") + `</tbody></table>`;
}

async function tandaiLunas(id) {
  const { error } = await supabaseClient.from("piutang").update({ lunas: true }).eq("id", id);
  if (!error) await loadPiutangList();
}

// ---------- PERSEDIAAN ----------
async function simpanPersediaan() {
  const tanggal = textVal("ps-tanggal");
  if (!tanggal) return showMsg("ps-msg", false, "Tanggal wajib diisi.");

  const payload = {
    nilai_persediaan: numVal("ps-nilai_persediaan"),
    fast_moving_habis: numVal("ps-fast_moving_habis"),
    slow_moving_persen: numVal("ps-slow_moving_persen"),
    expired_6_bulan: numVal("ps-expired_6_bulan"),
    expired_3_bulan: numVal("ps-expired_3_bulan"),
    stock_out: numVal("ps-stock_out"),
    ketersediaan_persen: numVal("ps-ketersediaan_persen"),
  };
  const { error } = await upsertByDate("persediaan_harian", "tanggal", tanggal, payload);
  showMsg("ps-msg", !error, error ? `Gagal: ${error.message}` : "Persediaan tersimpan ✓");
}

// ---------- PELAYANAN ----------
async function simpanPelayanan() {
  const tanggal = textVal("pl-tanggal");
  if (!tanggal) return showMsg("pl-msg", false, "Tanggal wajib diisi.");

  const payload = {
    resep_masuk: numVal("pl-resep_masuk"),
    resep_selesai_persen: numVal("pl-resep_selesai_persen"),
    waktu_layanan_menit: numVal("pl-waktu_layanan_menit"),
    komplain: numVal("pl-komplain"),
    pelanggan_baru: numVal("pl-pelanggan_baru"),
    pelanggan_loyal: numVal("pl-pelanggan_loyal"),
    pengantaran: numVal("pl-pengantaran"),
  };
  const { error } = await upsertByDate("pelayanan_harian", "tanggal", tanggal, payload);
  showMsg("pl-msg", !error, error ? `Gagal: ${error.message}` : "Pelayanan tersimpan ✓");
}

// ---------- PRODUK TERLARIS ----------
function buildProdukRows() {
  const wrap = document.getElementById("pd-rows");
  wrap.innerHTML = [1, 2, 3, 4, 5].map(i => `
    <div class="field-grid" style="grid-template-columns:70px 2fr 1fr 1.4fr;">
      <div class="field"><label>#${i}</label><input type="text" value="${i}" disabled style="text-align:center;"></div>
      <div class="field"><label>Nama Produk</label><input type="text" id="pd-nama-${i}" placeholder="Nama produk"></div>
      <div class="field"><label>Qty</label><input type="number" id="pd-qty-${i}" placeholder="0"></div>
      <div class="field"><label>Omzet (Rp)</label><input type="number" id="pd-omzet-${i}" placeholder="0"></div>
    </div>
  `).join("");
}

async function simpanProdukTerlaris() {
  const tanggal = textVal("pd-tanggal");
  if (!tanggal) return showMsg("pd-msg", false, "Tanggal wajib diisi.");

  let ada = 0, errorTerakhir = null;
  for (let i = 1; i <= 5; i++) {
    const nama = textVal(`pd-nama-${i}`);
    if (!nama) continue; // slot kosong dilewati
    ada++;
    const payload = { nama_produk: nama, qty: numVal(`pd-qty-${i}`), omzet: numVal(`pd-omzet-${i}`) };
    const { error } = await upsertByDate("produk_terlaris", "tanggal", tanggal, payload, { peringkat: i });
    if (error) errorTerakhir = error;
  }
  if (ada === 0) return showMsg("pd-msg", false, "Isi minimal 1 produk.");
  showMsg("pd-msg", !errorTerakhir, errorTerakhir ? `Gagal: ${errorTerakhir.message}` : `${ada} produk terlaris tersimpan ✓`);
}

// ---------- SDM ----------
async function simpanSDM() {
  const tanggal = textVal("sd-tanggal");
  if (!tanggal) return showMsg("sd-msg", false, "Tanggal wajib diisi.");

  const payload = {
    kehadiran_persen: numVal("sd-kehadiran_persen"),
    keterlambatan: numVal("sd-keterlambatan"),
    briefing_pagi: document.getElementById("sd-briefing_pagi").value === "true",
    sop_dipatuhi_persen: numVal("sd-sop_dipatuhi_persen"),
    kebersihan: textVal("sd-kebersihan"),
  };
  const { error } = await upsertByDate("sdm_harian", "tanggal", tanggal, payload);
  showMsg("sd-msg", !error, error ? `Gagal: ${error.message}` : "Data SDM tersimpan ✓");
}

// ---------- KEUANGAN BULANAN ----------
async function simpanKeuanganBulanan() {
  const bulanInput = textVal("kb-bulan"); // format YYYY-MM dari <input type="month">
  if (!bulanInput) return showMsg("kb-msg", false, "Bulan wajib diisi.");
  const bulan = `${bulanInput}-01`; // disamakan ke format date (tanggal 1)

  const payload = {
    target_omzet: numVal("kb-target_omzet"),
    hpp: numVal("kb-hpp"),
    biaya_operasional: numVal("kb-biaya_operasional"),
  };
  const { error } = await upsertByDate("keuangan_bulanan", "bulan", bulan, payload);
  showMsg("kb-msg", !error, error ? `Gagal: ${error.message}` : "Keuangan bulanan tersimpan ✓");
}

// ---------- Tabs ----------
function showTab(tabId, btn) {
  document.querySelectorAll(".panel").forEach(p => p.classList.add("hidden"));
  document.getElementById(tabId).classList.remove("hidden");
  document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
}

initInput();
