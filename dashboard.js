// ============================================================
// dashboard.js — fetch data dari Supabase & render tiap tab
// ============================================================

let TARGET = { omzet: 10000000, jumlah_transaksi: 80, rata_rata_transaksi: 125000, laba_kotor_persen: 25 };

async function initDashboard() {
  const session = await requireLogin();
  if (!session) return;

  // Guard: cuma admin yang boleh liat dashboard. Kalau role user nekat buka
  // index.html langsung dari URL, tendang balik ke halaman input.
  const role = session.user.app_metadata?.role || "user";
  if (role !== "admin") {
    window.location.href = "input.html";
    return;
  }

  document.getElementById("userEmail").textContent = session.user.email;
  document.getElementById("todayLabel").textContent = tanggalIndo(todayStr());

  const { data: t } = await supabaseClient.from("target_harian").select("*").limit(1).maybeSingle();
  if (t) TARGET = t;

  await Promise.all([
    loadRingkasan(),
    loadKeuanganHarian(),
    loadPersediaan(),
    loadPelayanan(),
    loadPenjualan(),
    loadSDM(),
    loadKeuanganBulanan(),
  ]);
}

// ---------- Helper query ----------
async function getHari(table, tanggal) {
  const { data } = await supabaseClient.from(table).select("*").eq("tanggal", tanggal).maybeSingle();
  return data;
}
async function getMTDRows(table) {
  const { data } = await supabaseClient
    .from(table)
    .select("*")
    .gte("tanggal", monthStartStr())
    .lte("tanggal", todayStr());
  return data || [];
}
function sumField(rows, field) {
  return rows.reduce((acc, r) => acc + (Number(r[field]) || 0), 0);
}
function avgField(rows, field) {
  if (!rows.length) return 0;
  return sumField(rows, field) / rows.length;
}

// ---------- Helper: ambil warna dari CSS variable di style.css ----------
function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

// ---------- RINGKASAN PAGI (Dashboard Pemilik) ----------
async function loadRingkasan() {
  const grid = document.getElementById("ringkasanGrid");
  const kemarin = await getHari("transaksi_harian", yesterdayStr());
  const persedKemarin = await getHari("persediaan_harian", yesterdayStr());
  const pelayananKemarin = await getHari("pelayanan_harian", yesterdayStr());
  const { data: produkKemarin } = await supabaseClient
    .from("produk_terlaris").select("*").eq("tanggal", yesterdayStr()).eq("peringkat", 1).maybeSingle();
  const { data: piutangBelumLunas } = await supabaseClient
    .from("piutang").select("jumlah").eq("lunas", false);
  const mtdRows = await getMTDRows("transaksi_harian");
  const { data: kb } = await supabaseClient
    .from("keuangan_bulanan").select("*").eq("bulan", monthStartStr()).maybeSingle();

  const omzetKemarin = kemarin?.omzet || 0;
  const jmlTransaksi = kemarin?.jumlah_transaksi || 0;
  const rataRata = jmlTransaksi > 0 ? omzetKemarin / jmlTransaksi : 0;
  const labaKotor = kemarin?.laba_kotor_persen || 0;
  const saldoKas = (kemarin?.kas_masuk || 0) - (kemarin?.kas_keluar || 0);
  const piutangTotal = sumField(piutangBelumLunas || [], "jumlah");
  const omzetMTD = sumField(mtdRows, "omzet");
  const targetBulanan = kb?.target_omzet || 300000000;
  const pctTargetBulanan = targetBulanan > 0 ? (omzetMTD / targetBulanan) * 100 : 0;

  const cards = [
    { icon: "", label: "Omzet Kemarin", value: rupiah(omzetKemarin), target: `Target harian ${rupiah(TARGET.omzet)}`, status: statusOf(omzetKemarin, TARGET.omzet), group: "kh" },
    { icon: "", label: "Jumlah Transaksi", value: angka(jmlTransaksi), target: `Target ${angka(TARGET.jumlah_transaksi)}`, status: statusOf(jmlTransaksi, TARGET.jumlah_transaksi), group: "kh" },
    { icon: "", label: "Rata-rata Nilai Transaksi", value: rupiah(rataRata), target: `Target ${rupiah(TARGET.rata_rata_transaksi)}`, status: statusOf(rataRata, TARGET.rata_rata_transaksi), group: "kh" },
    { icon: "", label: "Laba Kotor", value: persen(labaKotor), target: `Target ≥${TARGET.laba_kotor_persen}%`, status: statusOf(labaKotor, TARGET.laba_kotor_persen), group: "kh" },
    { icon: "", label: "Kas di Tangan", value: rupiah(saldoKas), target: "Kas masuk − kas keluar", status: saldoKas >= 0 ? "g" : "r", group: "kh" },
    { icon: "", label: "Fast Moving Kosong", value: angka(persedKemarin?.fast_moving_habis || 0), target: "Target 0 item", status: statusOf(persedKemarin?.fast_moving_habis || 0, 0.0001, "rendah"), group: "persediaan" },
    { icon: "", label: "Akan Expired < 6 Bulan", value: angka(persedKemarin?.expired_6_bulan || 0), target: "Target 0 item", status: statusOf(persedKemarin?.expired_6_bulan || 0, 0.0001, "rendah"), group: "persediaan" },
    { icon: "", label: "Produk Terlaris", value: produkKemarin?.nama_produk || "—", target: produkKemarin ? `${angka(produkKemarin.qty)} pcs · ${rupiah(produkKemarin.omzet)}` : "Belum ada data", status: "g", group: "produk" },
    { icon: "", label: "Slow Moving", value: persen(persedKemarin?.slow_moving_persen || 0), target: "Target <10%", status: statusOf(persedKemarin?.slow_moving_persen || 0, 10, "rendah"), group: "persediaan" },
    { icon: "", label: "Komplain Pelanggan", value: angka(pelayananKemarin?.komplain || 0), target: "Target 0", status: statusOf(pelayananKemarin?.komplain || 0, 0.0001, "rendah"), group: "pelayanan" },
    { icon: "", label: "Piutang Belum Tertagih", value: rupiah(piutangTotal), target: "Target Rp0", status: piutangTotal > 0 ? "r" : "g", group: "piutang" },
    { icon: "", label: "Target Omzet Bulan Ini", value: persen(pctTargetBulanan), target: `${rupiah(omzetMTD)} / ${rupiah(targetBulanan)}`, status: statusOf(pctTargetBulanan, 100), group: "bulanan" },
  ];

  grid.innerHTML = cards.map(c => `
    <div class="capsule ${c.status}">
      <button class="capsule-edit-btn" onclick="openEditModal('${c.group}')" title="Edit data">✎</button>
      <div class="capsule-body">
        <p class="capsule-label">${c.icon} ${c.label}</p>
        <p class="capsule-value">${c.value}</p>
        <p class="capsule-target">${c.target}</p>
      </div>
    </div>
  `).join("");

  await loadCharts();
}

// ---------- CHARTS (flat, tanpa gradasi, warna narik dari style.css) ----------
let omzetChartInstance = null;
let paymentChartInstance = null;

async function loadCharts() {
  const GREEN = cssVar("--green");           // #01b360
  const GREEN_SOFT = cssVar("--green-soft"); // #EAFCF1
  const GREEN_LINE = cssVar("--green-line"); // #C9F2DA
  const INK_SOFT = cssVar("--ink-soft");     // #5C7568

  // 14 hari terakhir
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 13);
  const startStr = start.toISOString().slice(0, 10);
  const endStr = end.toISOString().slice(0, 10);

  const { data: rows } = await supabaseClient
    .from("transaksi_harian")
    .select("tanggal, omzet, qris, tunai")
    .gte("tanggal", startStr)
    .lte("tanggal", endStr)
    .order("tanggal");

  const byDate = {};
  (rows || []).forEach(r => { byDate[r.tanggal] = r; });

  const labels = [];
  const omzetData = [];
  let qrisTotal = 0, tunaiTotal = 0;
  for (let i = 0; i < 14; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    labels.push(d.toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit" }));
    omzetData.push(byDate[key]?.omzet || 0);
    qrisTotal += byDate[key]?.qris || 0;
    tunaiTotal += byDate[key]?.tunai || 0;
  }

  const ctx1 = document.getElementById("omzetChart");
  if (ctx1) {
    if (omzetChartInstance) omzetChartInstance.destroy();
    omzetChartInstance = new Chart(ctx1, {
      type: "line",
      data: {
        labels,
        datasets: [{
          label: "Omzet",
          data: omzetData,
          borderColor: GREEN,
          backgroundColor: GREEN_SOFT, // flat solid, bukan gradasi
          fill: true,
          tension: 0.35,
          pointRadius: 2.5,
          pointBackgroundColor: GREEN,
          borderWidth: 2.5,
        }],
      },
      options: {
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: (c) => rupiah(c.raw) } },
        },
        scales: {
          y: {
            ticks: { callback: (v) => (v >= 1000000 ? (v / 1000000) + "jt" : v), color: INK_SOFT, font: { size: 10 } },
            grid: { color: GREEN_LINE },
          },
          x: {
            ticks: { color: INK_SOFT, font: { size: 10 } },
            grid: { display: false },
          },
        },
      },
    });
  }

  const ctx2 = document.getElementById("paymentChart");
  if (ctx2) {
    if (paymentChartInstance) paymentChartInstance.destroy();
    paymentChartInstance = new Chart(ctx2, {
      type: "doughnut",
      data: {
        labels: ["QRIS", "Tunai"],
        datasets: [{
          data: [qrisTotal, tunaiTotal],
          backgroundColor: [GREEN, GREEN_LINE],
          borderWidth: 0,
        }],
      },
      options: {
        cutout: "68%",
        plugins: {
          legend: { position: "bottom", labels: { boxWidth: 10, font: { size: 11 }, color: INK_SOFT } },
        },
      },
    });
  }
}

// ---------- KEUANGAN HARIAN ----------
async function loadKeuanganHarian() {
  const hariIni = await getHari("transaksi_harian", todayStr());
  const kemarin = await getHari("transaksi_harian", yesterdayStr());
  const mtdRows = await getMTDRows("transaksi_harian");
  const { data: piutangBelumLunas } = await supabaseClient.from("piutang").select("jumlah").eq("lunas", false);

  const omzetMTD = sumField(mtdRows, "omzet");
  const transaksiMTD = sumField(mtdRows, "jumlah_transaksi");
  const rataMTD = transaksiMTD > 0 ? omzetMTD / transaksiMTD : 0;
  const labaMTD = avgField(mtdRows, "laba_kotor_persen");
  const kasMasukMTD = sumField(mtdRows, "kas_masuk");
  const kasKeluarMTD = sumField(mtdRows, "kas_keluar");
  const qrisMTD = sumField(mtdRows, "qris");
  const tunaiMTD = sumField(mtdRows, "tunai");
  const piutangTotal = sumField(piutangBelumLunas || [], "jumlah");

  const rataHariIni = (hariIni?.jumlah_transaksi) ? hariIni.omzet / hariIni.jumlah_transaksi : 0;
  const rataKemarin = (kemarin?.jumlah_transaksi) ? kemarin.omzet / kemarin.jumlah_transaksi : 0;

  const rows = [
    ["Omzet", rupiah(TARGET.omzet), rupiah(hariIni?.omzet||0), rupiah(kemarin?.omzet||0), rupiah(omzetMTD), statusOf(hariIni?.omzet||0, TARGET.omzet)],
    ["Jumlah Transaksi", angka(TARGET.jumlah_transaksi), angka(hariIni?.jumlah_transaksi||0), angka(kemarin?.jumlah_transaksi||0), angka(transaksiMTD), statusOf(hariIni?.jumlah_transaksi||0, TARGET.jumlah_transaksi)],
    ["Rata-rata Nilai Transaksi", rupiah(TARGET.rata_rata_transaksi), rupiah(rataHariIni), rupiah(rataKemarin), rupiah(rataMTD), statusOf(rataHariIni, TARGET.rata_rata_transaksi)],
    ["Laba Kotor (%)", `≥${TARGET.laba_kotor_persen}%`, persen(hariIni?.laba_kotor_persen||0), persen(kemarin?.laba_kotor_persen||0), persen(labaMTD), statusOf(hariIni?.laba_kotor_persen||0, TARGET.laba_kotor_persen)],
    ["Kas Masuk", "—", rupiah(hariIni?.kas_masuk||0), rupiah(kemarin?.kas_masuk||0), rupiah(kasMasukMTD), null],
    ["Kas Keluar", "—", rupiah(hariIni?.kas_keluar||0), rupiah(kemarin?.kas_keluar||0), rupiah(kasKeluarMTD), null],
    ["Saldo Kas", "—", rupiah((hariIni?.kas_masuk||0)-(hariIni?.kas_keluar||0)), rupiah((kemarin?.kas_masuk||0)-(kemarin?.kas_keluar||0)), rupiah(kasMasukMTD-kasKeluarMTD), null],
    ["Piutang", "Rp0", rupiah(piutangTotal), "—", "—", piutangTotal > 0 ? "r" : "g"],
    ["Pembayaran QRIS", "—", rupiah(hariIni?.qris||0), rupiah(kemarin?.qris||0), rupiah(qrisMTD), null],
    ["Pembayaran Tunai", "—", rupiah(hariIni?.tunai||0), rupiah(kemarin?.tunai||0), rupiah(tunaiMTD), null],
  ];
  renderTable("keuanganHarianTable", ["Indikator","Target","Hari Ini","Kemarin","MTD","Status"], rows, {
    group: "kh", dateOverride: todayStr(),
    fields: [
      { field: "omzet" },
      { field: "jumlah_transaksi" },
      null, // Rata-rata: dihitung otomatis dari omzet & jumlah transaksi
      { field: "laba_kotor_persen" },
      { field: "kas_masuk" },
      { field: "kas_keluar" },
      null, // Saldo Kas: dihitung otomatis (kas masuk - kas keluar)
      { special: "piutang" },
      { field: "qris" },
      { field: "tunai" },
    ],
  });
}

// ---------- PERSEDIAAN ----------
async function loadPersediaan() {
  const h = await getHari("persediaan_harian", todayStr());
  const rows = [
    ["Nilai Persediaan", "—", rupiah(h?.nilai_persediaan||0), null],
    ["Obat Fast Moving Habis", "0", angka(h?.fast_moving_habis||0), statusOf(h?.fast_moving_habis||0, 0.0001, "rendah")],
    ["Obat Slow Moving", "<10%", persen(h?.slow_moving_persen||0), statusOf(h?.slow_moving_persen||0, 10, "rendah")],
    ["Obat Expired < 6 Bulan", "0", angka(h?.expired_6_bulan||0), statusOf(h?.expired_6_bulan||0, 0.0001, "rendah")],
    ["Obat Expired < 3 Bulan", "0", angka(h?.expired_3_bulan||0), statusOf(h?.expired_3_bulan||0, 0.0001, "rendah")],
    ["Jumlah Stock Out", "0", angka(h?.stock_out||0), statusOf(h?.stock_out||0, 0.0001, "rendah")],
    ["Persentase Ketersediaan Obat", ">98%", persen(h?.ketersediaan_persen ?? 100), statusOf(h?.ketersediaan_persen ?? 100, 98)],
  ];
  renderTable("persediaanTable", ["Indikator","Target","Hari Ini","Status"], rows, {
    group: "persediaan", dateOverride: todayStr(),
    fields: [
      { field: "nilai_persediaan" },
      { field: "fast_moving_habis" },
      { field: "slow_moving_persen" },
      { field: "expired_6_bulan" },
      { field: "expired_3_bulan" },
      { field: "stock_out" },
      { field: "ketersediaan_persen" },
    ],
  });
}

// ---------- PELAYANAN ----------
async function loadPelayanan() {
  const h = await getHari("pelayanan_harian", todayStr());
  const rows = [
    ["Resep Masuk", "—", angka(h?.resep_masuk||0), null],
    ["Resep Selesai", "100%", persen(h?.resep_selesai_persen ?? 100), statusOf(h?.resep_selesai_persen ?? 100, 100)],
    ["Waktu Pelayanan Rata-rata", "<10 menit", `${angka(h?.waktu_layanan_menit||0,1)} menit`, statusOf(h?.waktu_layanan_menit||0, 10, "rendah")],
    ["Komplain Pelanggan", "0", angka(h?.komplain||0), statusOf(h?.komplain||0, 0.0001, "rendah")],
    ["Pelanggan Baru", "—", angka(h?.pelanggan_baru||0), null],
    ["Pelanggan Loyal", "—", angka(h?.pelanggan_loyal||0), null],
    ["Pengantaran Obat", "—", angka(h?.pengantaran||0), null],
  ];
  renderTable("pelayananTable", ["Indikator","Target","Hari Ini","Status"], rows, {
    group: "pelayanan", dateOverride: todayStr(),
    fields: [
      { field: "resep_masuk" },
      { field: "resep_selesai_persen" },
      { field: "waktu_layanan_menit" },
      { field: "komplain" },
      { field: "pelanggan_baru" },
      { field: "pelanggan_loyal" },
      { field: "pengantaran" },
    ],
  });
}

// ---------- PENJUALAN ----------
async function loadPenjualan() {
  let { data } = await supabaseClient.from("produk_terlaris").select("*").eq("tanggal", todayStr()).order("peringkat");
  let tanggalDipakai = todayStr();
  if (!data || data.length === 0) {
    const r = await supabaseClient.from("produk_terlaris").select("*").eq("tanggal", yesterdayStr()).order("peringkat");
    data = r.data;
    tanggalDipakai = yesterdayStr();
  }
  document.getElementById("penjualanTanggal").textContent = data && data.length ? `Data: ${tanggalIndo(tanggalDipakai)}` : "Belum ada data produk terlaris";
  const rows = (data || []).map(p => [p.peringkat, p.nama_produk, angka(p.qty), rupiah(p.omzet)]);
  renderTable("penjualanTable", ["Peringkat","Produk Terlaris","Qty","Omzet"], rows.map(r => [r[0], r[1], r[2], r[3], null]));
}

// ---------- SDM ----------
async function loadSDM() {
  const h = await getHari("sdm_harian", todayStr());
  const rows = [
    ["Kehadiran Karyawan", "100%", persen(h?.kehadiran_persen ?? 100), statusOf(h?.kehadiran_persen ?? 100, 100)],
    ["Keterlambatan", "0", angka(h?.keterlambatan||0), statusOf(h?.keterlambatan||0, 0.0001, "rendah")],
    ["Briefing Pagi", "Ya", h?.briefing_pagi === false ? "Tidak" : "Ya", (h?.briefing_pagi === false) ? "r" : "g"],
    ["SOP Dipatuhi", "100%", persen(h?.sop_dipatuhi_persen ?? 100), statusOf(h?.sop_dipatuhi_persen ?? 100, 100)],
    ["Kebersihan Apotek", "Baik", h?.kebersihan || "Baik", (h?.kebersihan && h.kebersihan !== "Baik") ? "y" : "g"],
  ];
  renderTable("sdmTable", ["Indikator","Target","Status Hari Ini","Status"], rows, {
    group: "sdm", dateOverride: todayStr(),
    fields: [
      { field: "kehadiran_persen" },
      { field: "keterlambatan" },
      { field: "briefing_pagi" },
      { field: "sop_dipatuhi_persen" },
      { field: "kebersihan" },
    ],
  });
}

// ---------- KEUANGAN BULANAN ----------
async function loadKeuanganBulanan() {
  const { data: kb } = await supabaseClient.from("keuangan_bulanan").select("*").eq("bulan", monthStartStr()).maybeSingle();
  const mtdRows = await getMTDRows("transaksi_harian");
  const omzet = sumField(mtdRows, "omzet");
  const target = kb?.target_omzet || 300000000;
  const hpp = kb?.hpp || 0;
  const biayaOps = kb?.biaya_operasional || 0;
  const labaKotor = omzet - hpp;
  const labaBersih = labaKotor - biayaOps;
  const marginBersih = omzet > 0 ? (labaBersih / omzet) * 100 : 0;

  // Bulan lalu untuk pertumbuhan
  const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 1);
  const bulanLaluStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-01`;
  const bulanLaluAkhir = new Date(d.getFullYear(), d.getMonth()+1, 0).toISOString().slice(0,10);
  const { data: rowsBulanLalu } = await supabaseClient.from("transaksi_harian").select("omzet").gte("tanggal", bulanLaluStr).lte("tanggal", bulanLaluAkhir);
  const omzetBulanLalu = sumField(rowsBulanLalu || [], "omzet");
  const pertumbuhan = omzetBulanLalu > 0 ? ((omzet - omzetBulanLalu) / omzetBulanLalu) * 100 : 0;

  const rows = [
    ["Omzet Bulan Ini", rupiah(target), rupiah(omzet), statusOf(omzet, target)],
    ["HPP", "—", rupiah(hpp), null],
    ["Laba Kotor", "—", rupiah(labaKotor), null],
    ["Biaya Operasional", "—", rupiah(biayaOps), null],
    ["Laba Bersih", "—", rupiah(labaBersih), null],
    ["Margin Bersih", "—", persen(marginBersih), null],
    ["Pertumbuhan Omzet", ">10%", persen(pertumbuhan), statusOf(pertumbuhan, 10)],
  ];
  renderTable("keuanganBulananTable", ["Indikator","Target","Realisasi","Status"], rows, {
    group: "bulanan", dateOverride: null,
    fields: [
      { field: "target_omzet" }, // edit "Omzet Bulan Ini" = ubah target-nya (realisasi dihitung otomatis dari transaksi harian)
      { field: "hpp" },
      null, // Laba Kotor: dihitung otomatis
      { field: "biaya_operasional" },
      null, // Laba Bersih: dihitung otomatis
      null, // Margin Bersih: dihitung otomatis
      null, // Pertumbuhan Omzet: dihitung otomatis
    ],
  });
}

// ---------- Generic renderer ----------
// editInfo (opsional): { group: 'kh', dateOverride: '2026-08-11', fields: [ {field:'omzet'} | {special:'piutang'} | null, ... ] }
// fields harus sepanjang jumlah rows, urutannya sama
function renderTable(elId, headers, rows, editInfo) {
  const el = document.getElementById(elId);
  const statusColIdx = headers.length - 1;
  const hasStatusCol = headers[statusColIdx] === "Status";
  const allHeaders = editInfo ? [...headers, "Aksi"] : headers;
  let html = `<table class="data"><thead><tr>${allHeaders.map(h=>`<th>${h}</th>`).join("")}</tr></thead><tbody>`;
  if (!rows.length) {
    html += `<tr><td colspan="${allHeaders.length}" class="label" style="text-align:center;color:var(--ink-soft);padding:20px;">Belum ada data untuk ditampilkan</td></tr>`;
  }
  rows.forEach((r, idx) => {
    html += "<tr>";
    r.forEach((cell, i) => {
      if (hasStatusCol && i === statusColIdx) {
        html += `<td>${cell ? pillHtml(cell) : '<span style="color:var(--ink-soft)">—</span>'}</td>`;
      } else if (i === 0) {
        html += `<td class="label">${cell}</td>`;
      } else {
        html += `<td>${cell}</td>`;
      }
    });
    if (editInfo) {
      const info = editInfo.fields[idx];
      let btn = '<span style="color:var(--ink-soft)">—</span>';
      if (info?.special === "piutang") {
        btn = `<button class="row-edit-btn" onclick="openPiutangModal()" title="Kelola piutang">✎</button>`;
      } else if (info?.field) {
        const dateArg = editInfo.dateOverride ? `'${editInfo.dateOverride}'` : "null";
        btn = `<button class="row-edit-btn" onclick="openFieldEditModal('${editInfo.group}','${info.field}', ${dateArg})" title="Edit">✎</button>`;
      }
      html += `<td>${btn}</td>`;
    }
    html += "</tr>";
  });
  html += "</tbody></table>";
  el.innerHTML = html;
}

// ---------- Tabs ----------
function showTab(tabId, btn) {
  document.querySelectorAll(".panel").forEach(p => p.classList.add("hidden"));
  document.getElementById(tabId).classList.remove("hidden");
  document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
}

// ---------- EDIT LANGSUNG DARI KARTU RINGKASAN ----------
const EDIT_GROUPS = {
  kh: {
    table: "transaksi_harian", dateField: "tanggal", getDate: yesterdayStr,
    title: "Edit Keuangan Harian (Kemarin)",
    columns: [
      { field: "omzet", label: "Omzet (Rp)" },
      { field: "jumlah_transaksi", label: "Jumlah Transaksi" },
      { field: "laba_kotor_persen", label: "Laba Kotor (%)", step: "0.1" },
      { field: "kas_masuk", label: "Kas Masuk (Rp)" },
      { field: "kas_keluar", label: "Kas Keluar (Rp)" },
      { field: "qris", label: "QRIS (Rp)" },
      { field: "tunai", label: "Tunai (Rp)" },
    ],
  },
  persediaan: {
    table: "persediaan_harian", dateField: "tanggal", getDate: yesterdayStr,
    title: "Edit Persediaan (Kemarin)",
    columns: [
      { field: "nilai_persediaan", label: "Nilai Persediaan (Rp)" },
      { field: "fast_moving_habis", label: "Fast Moving Habis" },
      { field: "slow_moving_persen", label: "Slow Moving (%)", step: "0.1" },
      { field: "expired_6_bulan", label: "Expired < 6 Bulan" },
      { field: "expired_3_bulan", label: "Expired < 3 Bulan" },
      { field: "stock_out", label: "Stock Out" },
      { field: "ketersediaan_persen", label: "Ketersediaan (%)", step: "0.1" },
    ],
  },
  pelayanan: {
    table: "pelayanan_harian", dateField: "tanggal", getDate: yesterdayStr,
    title: "Edit Pelayanan (Kemarin)",
    columns: [
      { field: "resep_masuk", label: "Resep Masuk" },
      { field: "resep_selesai_persen", label: "Resep Selesai (%)", step: "0.1" },
      { field: "waktu_layanan_menit", label: "Waktu Layanan (menit)", step: "0.1" },
      { field: "komplain", label: "Komplain" },
      { field: "pelanggan_baru", label: "Pelanggan Baru" },
      { field: "pelanggan_loyal", label: "Pelanggan Loyal" },
      { field: "pengantaran", label: "Pengantaran" },
    ],
  },
  produk: {
    table: "produk_terlaris", dateField: "tanggal", getDate: yesterdayStr, extraMatch: { peringkat: 1 },
    title: "Edit Produk Terlaris #1 (Kemarin)",
    columns: [
      { field: "nama_produk", label: "Nama Produk", isText: true },
      { field: "qty", label: "Qty" },
      { field: "omzet", label: "Omzet (Rp)" },
    ],
  },
  bulanan: {
    table: "keuangan_bulanan", dateField: "bulan", getDate: monthStartStr,
    title: "Edit Target Bulan Ini",
    columns: [
      { field: "target_omzet", label: "Target Omzet (Rp)" },
      { field: "hpp", label: "HPP (Rp)" },
      { field: "biaya_operasional", label: "Biaya Operasional (Rp)" },
    ],
  },
  sdm: {
    table: "sdm_harian", dateField: "tanggal", getDate: todayStr,
    title: "Edit SDM",
    columns: [
      { field: "kehadiran_persen", label: "Kehadiran (%)", step: "0.1" },
      { field: "keterlambatan", label: "Keterlambatan (orang)" },
      { field: "briefing_pagi", label: "Briefing Pagi", type: "boolean" },
      { field: "sop_dipatuhi_persen", label: "SOP Dipatuhi (%)", step: "0.1" },
      { field: "kebersihan", label: "Kebersihan (Baik/Cukup/Kurang)", isText: true },
    ],
  },
};

let currentEditGroup = null;
let currentEditRowId = null;
let currentEditDate = null;

async function openEditModal(groupKey, dateOverride) {
  if (groupKey === "piutang") return openPiutangModal();

  const cfg = EDIT_GROUPS[groupKey];
  const dateVal = dateOverride || cfg.getDate();
  let query = supabaseClient.from(cfg.table).select("*").eq(cfg.dateField, dateVal);
  Object.entries(cfg.extraMatch || {}).forEach(([k, v]) => { query = query.eq(k, v); });
  const { data: row } = await query.maybeSingle();

  currentEditGroup = groupKey;
  currentEditRowId = row?.id || null;
  currentEditDate = dateVal;

  const box = document.getElementById("editModalBox");
  box.innerHTML = `
    <button class="modal-close" onclick="closeEditModal()">✕</button>
    <h3>${cfg.title}${dateOverride ? " — " + tanggalIndo(dateVal) : ""}</h3>
    ${cfg.columns.map(c => `
      <div class="field">
        <label>${c.label}</label>
        ${c.type === "boolean"
          ? `<select data-field="${c.field}">
               <option value="true" ${row?.[c.field] === true ? "selected" : ""}>Ya</option>
               <option value="false" ${row?.[c.field] === false ? "selected" : ""}>Tidak</option>
             </select>`
          : `<input type="${c.isText ? "text" : "number"}" ${c.step ? `step="${c.step}"` : ""} data-field="${c.field}" value="${row ? (row[c.field] ?? "") : ""}">`
        }
      </div>
    `).join("")}
    <div class="modal-actions">
      <button class="btn" onclick="simpanEditGroup()">Simpan</button>
      ${row ? `<button class="btn secondary" onclick="hapusEditGroup()">Hapus</button>` : ""}
      <button class="btn secondary" onclick="closeEditModal()">Tutup</button>
    </div>
  `;
  document.getElementById("editModal").classList.remove("hidden");
}

function closeEditModal() {
  document.getElementById("editModal").classList.add("hidden");
  currentEditGroup = null;
  currentEditRowId = null;
  currentEditDate = null;
}

async function simpanEditGroup() {
  const cfg = EDIT_GROUPS[currentEditGroup];
  const box = document.getElementById("editModalBox");
  const payload = {};
  cfg.columns.forEach(c => {
    const el = box.querySelector(`[data-field="${c.field}"]`);
    if (c.type === "boolean") { payload[c.field] = el.value === "true"; return; }
    payload[c.field] = c.isText ? el.value : (el.value === "" ? 0 : Number(el.value));
  });

  let error;
  if (currentEditRowId) {
    ({ error } = await supabaseClient.from(cfg.table).update(payload).eq("id", currentEditRowId));
  } else {
    const insertPayload = { [cfg.dateField]: currentEditDate, ...(cfg.extraMatch || {}), ...payload };
    ({ error } = await supabaseClient.from(cfg.table).insert(insertPayload));
  }

  if (error) { alert("Gagal simpan: " + error.message); return; }
  closeEditModal();
  await Promise.all([loadRingkasan(), loadKeuanganHarian(), loadPersediaan(), loadPelayanan(), loadSDM(), loadKeuanganBulanan()]);
}

async function hapusEditGroup() {
  if (!currentEditRowId) return;
  if (!confirm("Yakin mau hapus data ini?")) return;
  const cfg = EDIT_GROUPS[currentEditGroup];
  const { error } = await supabaseClient.from(cfg.table).delete().eq("id", currentEditRowId);
  if (error) { alert("Gagal hapus: " + error.message); return; }
  closeEditModal();
  await loadRingkasan();
}

// ---------- Piutang: modal khusus (list, bukan 1 baris) ----------
async function openPiutangModal() {
  const box = document.getElementById("editModalBox");
  box.innerHTML = `
    <button class="modal-close" onclick="closeEditModal()">✕</button>
    <h3>Kelola Piutang</h3>
    <div class="field"><label>Tanggal</label><input type="date" id="pt-modal-tanggal" value="${todayStr()}"></div>
    <div class="field"><label>Nama Pelanggan</label><input type="text" id="pt-modal-pelanggan" placeholder="Nama pelanggan"></div>
    <div class="field"><label>Jumlah (Rp)</label><input type="number" id="pt-modal-jumlah" placeholder="0"></div>
    <div class="modal-actions">
      <button class="btn" onclick="tambahPiutangModal()">+ Tambah Piutang</button>
      <button class="btn secondary" onclick="closeEditModal()">Tutup</button>
    </div>
    <div id="pt-modal-list" style="margin-top:16px;"></div>
  `;
  document.getElementById("editModal").classList.remove("hidden");
  await renderPiutangModalList();
}

async function renderPiutangModalList() {
  const { data } = await supabaseClient.from("piutang").select("*").eq("lunas", false).order("tanggal", { ascending: false });
  const el = document.getElementById("pt-modal-list");
  if (!data || !data.length) {
    el.innerHTML = `<p style="color:var(--ink-soft);font-size:13px;">Tidak ada piutang belum lunas.</p>`;
    return;
  }
  el.innerHTML = data.map(p => `
    <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 0; border-bottom:1px solid var(--green-line); font-size:13px;">
      <div><strong>${p.pelanggan}</strong><br><span style="color:var(--ink-soft);">${tanggalIndo(p.tanggal)} · ${rupiah(p.jumlah)}</span></div>
      <div style="display:flex; gap:6px;">
        <button class="btn secondary" style="padding:5px 10px;font-size:11.5px;" onclick="lunasPiutangModal(${p.id})">Lunas</button>
        <button class="btn secondary" style="padding:5px 10px;font-size:11.5px;" onclick="hapusPiutangModal(${p.id})">Hapus</button>
      </div>
    </div>
  `).join("");
}

async function tambahPiutangModal() {
  const tanggal = document.getElementById("pt-modal-tanggal").value;
  const pelanggan = document.getElementById("pt-modal-pelanggan").value.trim();
  const jumlah = Number(document.getElementById("pt-modal-jumlah").value) || 0;
  if (!tanggal || !pelanggan || jumlah <= 0) { alert("Tanggal, nama, dan jumlah wajib diisi."); return; }
  const { error } = await supabaseClient.from("piutang").insert({ tanggal, pelanggan, jumlah, lunas: false });
  if (error) { alert("Gagal: " + error.message); return; }
  document.getElementById("pt-modal-pelanggan").value = "";
  document.getElementById("pt-modal-jumlah").value = "";
  await renderPiutangModalList();
  await loadRingkasan();
}

async function lunasPiutangModal(id) {
  await supabaseClient.from("piutang").update({ lunas: true }).eq("id", id);
  await renderPiutangModalList();
  await loadRingkasan();
}

async function hapusPiutangModal(id) {
  if (!confirm("Yakin mau hapus piutang ini?")) return;
  await supabaseClient.from("piutang").delete().eq("id", id);
  await renderPiutangModalList();
  await loadRingkasan();
}

// ---------- Produk Terlaris: modal khusus (5 slot peringkat per tanggal) ----------
async function openProdukListModal(dateVal) {
  dateVal = dateVal || todayStr();
  const { data } = await supabaseClient.from("produk_terlaris").select("*").eq("tanggal", dateVal).order("peringkat");
  const rowsByRank = {};
  (data || []).forEach(r => { rowsByRank[r.peringkat] = r; });

  let rowsHtml = "";
  for (let i = 1; i <= 5; i++) {
    const r = rowsByRank[i];
    rowsHtml += `
      <div style="border:1px solid var(--green-line); border-radius:12px; padding:12px; margin-bottom:10px;">
        <div style="font-size:11px; color:var(--ink-soft); margin-bottom:8px; font-weight:600;">Peringkat #${i}</div>
        <div class="field"><label>Nama Produk</label><input type="text" id="pd-modal-nama-${i}" value="${r?.nama_produk || ""}"></div>
        <div class="field"><label>Qty</label><input type="number" id="pd-modal-qty-${i}" value="${r?.qty || ""}"></div>
        <div class="field"><label>Omzet (Rp)</label><input type="number" id="pd-modal-omzet-${i}" value="${r?.omzet || ""}"></div>
        <div style="display:flex; gap:6px; margin-top:8px;">
          <button class="btn secondary" style="padding:6px 12px;font-size:12px;" onclick="simpanProdukModal(${i}, '${dateVal}')">Simpan</button>
          ${r ? `<button class="btn secondary" style="padding:6px 12px;font-size:12px;" onclick="hapusProdukModal(${r.id}, '${dateVal}')">Hapus</button>` : ""}
        </div>
      </div>
    `;
  }

  const box = document.getElementById("editModalBox");
  box.innerHTML = `
    <button class="modal-close" onclick="closeEditModal()">✕</button>
    <h3>Kelola Produk Terlaris</h3>
    <div class="field"><label>Tanggal</label><input type="date" id="pd-modal-tanggal" value="${dateVal}" onchange="openProdukListModal(this.value)"></div>
    ${rowsHtml}
    <div class="modal-actions">
      <button class="btn secondary" onclick="closeEditModal()">Tutup</button>
    </div>
  `;
  document.getElementById("editModal").classList.remove("hidden");
}

async function simpanProdukModal(peringkat, dateVal) {
  const nama = document.getElementById(`pd-modal-nama-${peringkat}`).value.trim();
  const qty = Number(document.getElementById(`pd-modal-qty-${peringkat}`).value) || 0;
  const omzet = Number(document.getElementById(`pd-modal-omzet-${peringkat}`).value) || 0;
  if (!nama) { alert("Nama produk wajib diisi."); return; }

  const { data: existing } = await supabaseClient
    .from("produk_terlaris").select("id").eq("tanggal", dateVal).eq("peringkat", peringkat).maybeSingle();

  let error;
  if (existing) {
    ({ error } = await supabaseClient.from("produk_terlaris").update({ nama_produk: nama, qty, omzet }).eq("id", existing.id));
  } else {
    ({ error } = await supabaseClient.from("produk_terlaris").insert({ tanggal: dateVal, peringkat, nama_produk: nama, qty, omzet }));
  }
  if (error) { alert("Gagal simpan: " + error.message); return; }

  await openProdukListModal(dateVal);
  await loadPenjualan();
  await loadRingkasan();
}

async function hapusProdukModal(id, dateVal) {
  if (!confirm("Yakin mau hapus produk ini?")) return;
  await supabaseClient.from("produk_terlaris").delete().eq("id", id);
  await openProdukListModal(dateVal);
  await loadPenjualan();
  await loadRingkasan();
}

// ---------- Edit 1 field saja (dipanggil dari ikon ✎ per baris tabel) ----------
let currentFieldGroup = null;
let currentFieldName = null;
let currentFieldRowId = null;
let currentFieldDate = null;

async function openFieldEditModal(groupKey, fieldName, dateOverride) {
  const cfg = EDIT_GROUPS[groupKey];
  const col = cfg.columns.find(c => c.field === fieldName);
  const dateVal = dateOverride || cfg.getDate();

  let query = supabaseClient.from(cfg.table).select("*").eq(cfg.dateField, dateVal);
  Object.entries(cfg.extraMatch || {}).forEach(([k, v]) => { query = query.eq(k, v); });
  const { data: row } = await query.maybeSingle();

  currentFieldGroup = groupKey;
  currentFieldName = fieldName;
  currentFieldRowId = row?.id || null;
  currentFieldDate = dateVal;

  const box = document.getElementById("editModalBox");
  box.innerHTML = `
    <button class="modal-close" onclick="closeEditModal()">✕</button>
    <h3>Edit ${col.label}</h3>
    <div class="field">
      <label>${col.label}</label>
      ${col.type === "boolean"
        ? `<select data-single>
             <option value="true" ${row?.[fieldName] === true ? "selected" : ""}>Ya</option>
             <option value="false" ${row?.[fieldName] === false ? "selected" : ""}>Tidak</option>
           </select>`
        : `<input type="${col.isText ? "text" : "number"}" ${col.step ? `step="${col.step}"` : ""} data-single value="${row ? (row[fieldName] ?? "") : ""}">`
      }
    </div>
    <div class="modal-actions">
      <button class="btn" onclick="simpanFieldEdit()">Simpan</button>
      <button class="btn secondary" onclick="closeEditModal()">Tutup</button>
    </div>
  `;
  document.getElementById("editModal").classList.remove("hidden");
}

async function simpanFieldEdit() {
  const cfg = EDIT_GROUPS[currentFieldGroup];
  const col = cfg.columns.find(c => c.field === currentFieldName);
  const el = document.querySelector("#editModalBox [data-single]");

  let val;
  if (col.type === "boolean") val = el.value === "true";
  else val = col.isText ? el.value : (el.value === "" ? 0 : Number(el.value));

  const payload = { [currentFieldName]: val };
  let error;
  if (currentFieldRowId) {
    ({ error } = await supabaseClient.from(cfg.table).update(payload).eq("id", currentFieldRowId));
  } else {
    const insertPayload = { [cfg.dateField]: currentFieldDate, ...(cfg.extraMatch || {}), ...payload };
    ({ error } = await supabaseClient.from(cfg.table).insert(insertPayload));
  }

  if (error) { alert("Gagal simpan: " + error.message); return; }
  closeEditModal();
  await Promise.all([loadRingkasan(), loadKeuanganHarian(), loadPersediaan(), loadPelayanan(), loadSDM(), loadKeuanganBulanan()]);
}

// ---------- Edit Target Harian (tabel target_harian - 1 baris global) ----------
const TARGET_FIELDS = [
  { field: "omzet", label: "Target Omzet (Rp)" },
  { field: "jumlah_transaksi", label: "Target Jumlah Transaksi" },
  { field: "rata_rata_transaksi", label: "Target Rata-rata Nilai Transaksi (Rp)" },
  { field: "laba_kotor_persen", label: "Target Laba Kotor (%)", step: "0.1" },
];

function openTargetModal() {
  const box = document.getElementById("editModalBox");
  box.innerHTML = `
    <button class="modal-close" onclick="closeEditModal()">✕</button>
    <h3>Edit Target Harian</h3>
    ${TARGET_FIELDS.map(c => `
      <div class="field">
        <label>${c.label}</label>
        <input type="number" ${c.step ? `step="${c.step}"` : ""} data-target-field="${c.field}" value="${TARGET[c.field] ?? ""}">
      </div>
    `).join("")}
    <div class="modal-actions">
      <button class="btn" onclick="simpanTargetModal()">Simpan</button>
      <button class="btn secondary" onclick="closeEditModal()">Tutup</button>
    </div>
  `;
  document.getElementById("editModal").classList.remove("hidden");
}

async function simpanTargetModal() {
  const box = document.getElementById("editModalBox");
  const payload = {};
  TARGET_FIELDS.forEach(c => {
    const el = box.querySelector(`[data-target-field="${c.field}"]`);
    payload[c.field] = el.value === "" ? 0 : Number(el.value);
  });

  let error;
  if (TARGET.id) {
    ({ error } = await supabaseClient.from("target_harian").update(payload).eq("id", TARGET.id));
  } else {
    ({ error } = await supabaseClient.from("target_harian").insert(payload));
  }
  if (error) { alert("Gagal simpan target: " + error.message); return; }

  const { data: t } = await supabaseClient.from("target_harian").select("*").limit(1).maybeSingle();
  if (t) TARGET = t;

  closeEditModal();
  await Promise.all([loadRingkasan(), loadKeuanganHarian()]);
}

initDashboard();