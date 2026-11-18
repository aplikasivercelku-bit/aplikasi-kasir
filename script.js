let barangList = JSON.parse(localStorage.getItem('sembako_barang')) || [];
let pengeluaranList = JSON.parse(localStorage.getItem('sembako_pengeluaran')) || [];
let transaksiList = JSON.parse(localStorage.getItem('sembako_transaksi')) || [];
let kasbonList = JSON.parse(localStorage.getItem('sembako_kasbon')) || [];
let keranjangList = [];
let currentSelectedKasirBarcode = "";

let selectedProdukAktif = null;
let html5QrCode = null;
let lastScannedCode = "";
let lastScannedTime = 0;

let currentFilteredTransaksi = [];

let adminCreds = JSON.parse(localStorage.getItem('sembako_admin')) || {
  username: 'admin',
  password: 'admin',
  avatar: ''
};

let tokoProfile = JSON.parse(localStorage.getItem('sembako_toko')) || {
  storeId: 'aplikasi-kasir-utama',
  nama: 'APLIKASI KASIR',
  telp: '087877611218',
  alamat: 'Jl. Bojonegoro Kp. Kernaden rt 05 05',
  notes: 'Terima kasih atas kunjungan Anda!',
  logo: ''
};

let tempAvatarBase64 = '';
let tempLogoBase64 = '';
let currentLightboxBarcode = "";
let currentLightboxTitle = "";
let currentQrModalKode = "";
let currentQrModalNama = "";

function encodeDataToUrlParam(obj) {
  try {
    const jsonStr = JSON.stringify(obj);
    return btoa(unescape(encodeURIComponent(jsonStr)));
  } catch (e) {
    return "";
  }
}

function decodeDataFromUrlParam(base64Str) {
  try {
    const jsonStr = decodeURIComponent(escape(atob(base64Str)));
    return JSON.parse(jsonStr);
  } catch (e) {
    return null;
  }
}

// INISIALISASI & SINKRONISASI OTOMATIS DATA BARANG, TRANSAKSI & KASBON
document.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  const scanParam = params.get('scan') || params.get('barcode') || params.get('kode');
  const modeParam = params.get('mode');
  const storeParam = params.get('store');
  const syncItemsParam = params.get('items');
  const syncSingleItemParam = params.get('item');
  const syncTransactionsParam = params.get('transactions');
  const syncKasbonParam = params.get('kasbon');
  const tokoNameParam = params.get('toko');

  if (syncItemsParam) {
    const importedItems = decodeDataFromUrlParam(syncItemsParam);
    if (Array.isArray(importedItems) && importedItems.length > 0) {
      importedItems.forEach(imp => {
        const existingIdx = barangList.findIndex(b => b.kode.toLowerCase() === imp.k.toLowerCase());
        const mappedBarang = {
          kode: imp.k,
          nama: imp.n,
          stok: parseInt(imp.s) || 0,
          minStok: 3,
          satuan: imp.u || 'Pcs',
          expired: '',
          minExpDays: 15,
          modal: parseFloat(imp.m) || 0,
          jual: parseFloat(imp.j) || 0
        };
        if (existingIdx !== -1) {
          barangList[existingIdx] = { ...barangList[existingIdx], ...mappedBarang };
        } else {
          barangList.push(mappedBarang);
        }
      });
      localStorage.setItem('sembako_barang', JSON.stringify(barangList));
    }
  }

  if (syncTransactionsParam) {
    const importedTrx = decodeDataFromUrlParam(syncTransactionsParam);
    if (Array.isArray(importedTrx) && importedTrx.length > 0) {
      transaksiList = importedTrx;
      localStorage.setItem('sembako_transaksi', JSON.stringify(transaksiList));
    }
  }

  if (syncKasbonParam) {
    const importedKasbon = decodeDataFromUrlParam(syncKasbonParam);
    if (Array.isArray(importedKasbon) && importedKasbon.length > 0) {
      kasbonList = importedKasbon;
      localStorage.setItem('sembako_kasbon', JSON.stringify(kasbonList));
    }
  }

  if (syncSingleItemParam) {
    const imp = decodeDataFromUrlParam(syncSingleItemParam);
    if (imp && imp.k) {
      const existingIdx = barangList.findIndex(b => b.kode.toLowerCase() === imp.k.toLowerCase());
      const mappedBarang = {
        kode: imp.k,
        nama: imp.n,
        stok: parseInt(imp.s) || 0,
        minStok: 3,
        satuan: imp.u || 'Pcs',
        expired: '',
        minExpDays: 15,
        modal: parseFloat(imp.m) || 0,
        jual: parseFloat(imp.j) || 0
      };
      if (existingIdx !== -1) {
        barangList[existingIdx] = { ...barangList[existingIdx], ...mappedBarang };
      } else {
        barangList.push(mappedBarang);
      }
      localStorage.setItem('sembako_barang', JSON.stringify(barangList));
    }
  }

  if (tokoNameParam) {
    tokoProfile.nama = decodeURIComponent(tokoNameParam);
    localStorage.setItem('sembako_toko', JSON.stringify(tokoProfile));
  }

  if (storeParam && !tokoProfile.storeId) {
    tokoProfile.storeId = storeParam;
    saveDataToStorage();
  }

  loadProfilData();

  if (scanParam || modeParam === 'all') {
    sessionStorage.setItem('sembako_logged_in', 'true');
    if (modeParam === 'all') {
      sessionStorage.setItem('sembako_kasir_only', 'true');
    }
  }

  const isSessionLoggedIn = sessionStorage.getItem('sembako_logged_in');
  const isKasirOnly = sessionStorage.getItem('sembako_kasir_only') === 'true';

  if (isSessionLoggedIn === 'true') {
    document.getElementById('loginPage').classList.add('hidden');
    document.getElementById('appContainer').classList.remove('hidden');
    
    renderBarangTable();
    renderPengeluaranTable();
    renderRiwayatTransaksi();
    renderKasbonTable();
    populateBarangDatalist();
    populateKasbonDatalist();
    populateLaporanBarangSelect();
    updateDashboardStats();
    updateFinancialSummary();
    updateNotifications();
    updateKasbonNotifications();

    if (isKasirOnly || scanParam) {
      aturMenuKasirSaja();
      showTab('kasirTab');
    }

    if (scanParam) {
      bukaLangsungTransaksiDariBarcode(scanParam);
    } else if (!isKasirOnly) {
      showTab('berandaTab');
    }
  } else {
    document.getElementById('loginPage').classList.remove('hidden');
    document.getElementById('appContainer').classList.add('hidden');
  }

  const today = new Date().toISOString().split('T')[0];
  if(document.getElementById('pengTgl')) document.getElementById('pengTgl').value = today;
  if(document.getElementById('barExpired')) document.getElementById('barExpired').value = today;
  if(document.getElementById('kasbonTgl')) document.getElementById('kasbonTgl').value = today;
});

function toggleAdminMenuDropdown(e) {
  if(e) e.stopPropagation();
  const dropdown = document.getElementById('adminMenuDropdown');
  if(dropdown) dropdown.classList.toggle('hidden');
}

window.addEventListener('click', function(e) {
  if(!e.target.closest('.admin-dropdown-wrapper')) {
    const dropdown = document.getElementById('adminMenuDropdown');
    if(dropdown && !dropdown.classList.contains('hidden')) dropdown.classList.add('hidden');
  }
});

function bukaPengaturanAdmin() {
  const dropdown = document.getElementById('adminMenuDropdown');
  if(dropdown) dropdown.classList.add('hidden');
  showTab('profilTab');
}

function aturMenuKasirSaja() {
  const sidebarMenu = document.getElementById('sidebarMenuContainer');
  if (sidebarMenu) {
    sidebarMenu.innerHTML = `
      <button class="nav-btn active" data-tab="kasirTab" onclick="showTab('kasirTab')">🛒 Transaksi Kasir</button>
      <button class="nav-btn" data-tab="scannerTab" onclick="showTab('scannerTab')">📷 Scanner Barcode</button>
      <button class="nav-btn" data-tab="transaksiTab" onclick="showTab('transaksiTab')">📜 Data Transaksi</button>
      <button class="nav-btn" data-tab="kasbonTab" onclick="showTab('kasbonTab')">📑 Kasbon / Piutang</button>
    `;
  }
}

function bukaLangsungTransaksiDariBarcode(kodeScan) {
  const cleanCode = decodeURIComponent(kodeScan).trim().toLowerCase();
  showTab('kasirTab');

  setTimeout(() => {
    const idx = barangList.findIndex(b => 
      b.kode.toLowerCase() === cleanCode || b.nama.toLowerCase() === cleanCode
    );

    if (idx !== -1) {
      const b = barangList[idx];
      document.getElementById('kasirBarangInput').value = `${b.nama} (Stok: ${b.stok} ${b.satuan}) - Rp ${formatNumber(b.jual)}`;
      document.getElementById('selectedKasirBarangIndex').value = idx;
      document.getElementById('kasirQty').value = 1;
      onKasirBarangChange(idx);
      speakSuccessMessage(b.nama);
    } else {
      document.getElementById('kasirBarangInput').value = cleanCode;
      onKetikCariBarang();
    }
  }, 200);
}

function handleLogin(e) {
  e.preventDefault();
  const uInput = document.getElementById('loginUsername').value.trim();
  const pInput = document.getElementById('loginPassword').value.trim();

  if(uInput === adminCreds.username && pInput === adminCreds.password) {
    sessionStorage.setItem('sembako_logged_in', 'true');
    sessionStorage.removeItem('sembako_kasir_only');
    document.getElementById('loginPage').classList.add('hidden');
    document.getElementById('appContainer').classList.remove('hidden');
    
    renderBarangTable();
    renderPengeluaranTable();
    renderRiwayatTransaksi();
    renderKasbonTable();
    populateBarangDatalist();
    populateKasbonDatalist();
    populateLaporanBarangSelect();
    updateDashboardStats();
    updateFinancialSummary();
    updateNotifications();
    updateKasbonNotifications();

    const params = new URLSearchParams(window.location.search);
    const scanParam = params.get('scan') || params.get('barcode');
    if (scanParam) bukaLangsungTransaksiDariBarcode(scanParam);
    else showTab('berandaTab');
  } else {
    alert("Username atau Password salah! (Default: admin / admin)");
  }
}

function logout() {
  if(confirm("Keluar dari sesi ini dan kembali ke halaman login?")) {
    sessionStorage.removeItem('sembako_logged_in');
    sessionStorage.removeItem('sembako_kasir_only');
    window.location.href = window.location.pathname;
  }
}

function showTab(tabId) {
  const isKasirOnly = sessionStorage.getItem('sembako_kasir_only') === 'true';
  if (isKasirOnly && ['berandaTab', 'pengeluaranTab', 'barangTab', 'laporanTab', 'panduanTab', 'profilTab'].includes(tabId)) {
    tabId = 'kasirTab';
  }

  document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));

  const targetTab = document.getElementById(tabId);
  if(targetTab) targetTab.classList.add('active');

  const activeBtn = document.querySelector(`.nav-btn[data-tab="${tabId}"]`);
  if(activeBtn) activeBtn.classList.add('active');

  if(tabId === 'berandaTab') { updateDashboardStats(); updateFinancialSummary(); }
  if(tabId === 'barangTab') { populateBarangDatalist(); renderBarangTable(); }
  if(tabId === 'kasirTab') { populateKasbonDatalist(); }
  if(tabId === 'scannerTab') { populateKasbonDatalist(); initScannerCamera(); } 
  else { if(html5QrCode) { try { html5QrCode.stop(); } catch(e){} } }
  if(tabId === 'kasbonTab') { renderKasbonTable(); }
  if(tabId === 'transaksiTab') { renderRiwayatTransaksi(); }

  const sidebar = document.getElementById('appSidebar');
  if(sidebar && window.innerWidth <= 768) sidebar.classList.remove('mobile-open');
}

function toggleMobileSidebar() {
  const sidebar = document.getElementById('appSidebar');
  if(sidebar) sidebar.classList.toggle('mobile-open');
}

function toggleForm(formId, iconId) {
  const formCard = document.getElementById(formId);
  const icon = document.getElementById(iconId);
  if(formCard.classList.contains('collapsed')) {
    formCard.classList.remove('collapsed');
    icon.innerText = '▲';
  } else {
    formCard.classList.add('collapsed');
    icon.innerText = '...';
  }
}

function saveDataToStorage() {
  localStorage.setItem('sembako_barang', JSON.stringify(barangList));
  localStorage.setItem('sembako_pengeluaran', JSON.stringify(pengeluaranList));
  localStorage.setItem('sembako_transaksi', JSON.stringify(transaksiList));
  localStorage.setItem('sembako_kasbon', JSON.stringify(kasbonList));
  localStorage.setItem('sembako_admin', JSON.stringify(adminCreds));
  localStorage.setItem('sembako_toko', JSON.stringify(tokoProfile));
  updateNotifications();
  updateKasbonNotifications();
}

function updateDashboardStats() {
  if(document.getElementById('statTotalBarang')) document.getElementById('statTotalBarang').innerText = barangList.length;
  if(document.getElementById('statTotalTransaksi')) document.getElementById('statTotalTransaksi').innerText = transaksiList.length;
  if(document.getElementById('statTotalPengeluaran')) document.getElementById('statTotalPengeluaran').innerText = pengeluaranList.length;
}

function updateFinancialSummary() {
  const totalPengeluaran = pengeluaranList.reduce((sum, p) => sum + (parseFloat(p.modal) || parseFloat(p.nominal) || 0), 0);
  const totalPembelianStok = barangList.reduce((sum, b) => sum + ((parseFloat(b.modal) || 0) * (parseInt(b.stok) || 0)), 0);
  const totalOmset = transaksiList.reduce((sum, t) => sum + (parseFloat(t.total) || 0), 0);

  if(document.getElementById('finPengeluaran')) {
    document.getElementById('finPengeluaran').innerText = `Rp ${formatNumber(totalPengeluaran)}`;
    document.getElementById('finPembelianStok').innerText = `Rp ${formatNumber(totalPembelianStok)}`;
    document.getElementById('finOmset').innerText = `Rp ${formatNumber(totalOmset)}`;
  }
}

function formatDateID(dateString) {
  if(!dateString) return '-';
  const parts = dateString.split('-');
  if(parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return dateString;
}

function updateKasbonNotifications() {
  const notifList = document.getElementById('kasbonNotifListContainer');
  const notifCountBadge = document.getElementById('kasbonNotifCount');
  if(!notifList || !notifCountBadge) return;

  const belumLunasList = kasbonList.filter(k => {
    const trx = transaksiList.filter(t => t.namaKasbon && t.namaKasbon.toLowerCase() === k.nama.toLowerCase());
    const totalBelanja = trx.reduce((sum, t) => sum + (parseFloat(t.total) || 0), 0);
    const sudahDibayar = trx.reduce((sum, t) => {
      let subSudah = 0;
      if (t.isLunasKasbon === true) subSudah += (parseFloat(t.total) || 0);
      if (t.items && Array.isArray(t.items)) {
        t.items.forEach(i => { if (i.isLunasItem === true) subSudah += (parseFloat(i.subtotal) || 0); });
      }
      return sum + subSudah;
    }, 0);
    return (trx.length > 0 && (totalBelanja - sudahDibayar) > 0);
  });

  notifCountBadge.innerText = belumLunasList.length;
  if(belumLunasList.length === 0) {
    notifList.innerHTML = `<div class="notif-empty" style="font-size:0.8rem; color:#64748b;">Tidak ada piutang belum lunas.</div>`;
    return;
  }

  let html = '';
  belumLunasList.forEach((k) => {
    const origIdx = kasbonList.indexOf(k);
    html += `<div class="notif-item" onclick="navigateToKasbon(${origIdx})">
      <div>📑 Piutang: <b>${k.nama}</b><br><small style="color: #dc2626; font-weight: 600;">Belum Lunas</small></div>
    </div>`;
  });
  notifList.innerHTML = html;
}

function toggleKasbonNotifDropdown() {
  const dropdown = document.getElementById('kasbonNotifDropdown');
  const otherDropdown = document.getElementById('notifDropdown');
  if(otherDropdown) otherDropdown.classList.add('hidden');
  if(dropdown) dropdown.classList.toggle('hidden');
}

function navigateToKasbon(idx) {
  toggleKasbonNotifDropdown();
  showTab('kasbonTab');
  setTimeout(() => {
    const row = document.getElementById(`kasbonRow_${idx}`);
    if(row) {
      row.scrollIntoView({ behavior: 'smooth', block: 'center' });
      row.classList.add('highlight-row-yellow');
      setTimeout(() => row.classList.remove('highlight-row-yellow'), 4000);
    }
  }, 150);
}

function updateNotifications() {
  const notifList = document.getElementById('notifListContainer');
  const notifCountBadge = document.getElementById('notifCount');
  if(!notifList || !notifCountBadge) return;
  let warnings = [];
  notifCountBadge.innerText = warnings.length;
  notifList.innerHTML = `<div style="font-size:0.8rem; color:#64748b;">Tidak ada peringatan.</div>`;
}

function toggleNotifDropdown() {
  const dropdown = document.getElementById('notifDropdown');
  if(dropdown) dropdown.classList.toggle('hidden');
}

function renderPengeluaranTable() {
  const tbody = document.getElementById('pengeluaranTbody');
  if(!tbody) return;
  tbody.innerHTML = "";
  if(pengeluaranList.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: #777;">Belum ada data pengeluaran.</td></tr>`;
    return;
  }
  pengeluaranList.forEach((p, idx) => {
    tbody.innerHTML += `<tr><td>${idx + 1}</td><td>${formatDateID(p.tanggal)}</td><td><b>${p.keterangan}</b></td><td>Rp ${formatNumber(p.modal)}</td><td>Rp ${formatNumber(p.jual)}</td><td>${p.barcode}</td></tr>`;
  });
}

function savePengeluaran(e) {
  e.preventDefault();
  const idx = document.getElementById('pengeluaranEditIndex').value;
  const newItem = {
    tanggal: document.getElementById('pengTgl').value,
    keterangan: document.getElementById('pengKeterangan').value.trim(),
    modal: parseFloat(document.getElementById('pengHargaModal').value) || 0,
    jual: parseFloat(document.getElementById('pengHargaJual').value) || 0,
    barcode: document.getElementById('pengBarcodeCode').value.trim()
  };
  if(idx === "") pengeluaranList.push(newItem);
  else pengeluaranList[idx] = newItem;
  saveDataToStorage();
  renderPengeluaranTable();
  alert("Data pengeluaran disimpan!");
}

function renderBarangTable() {
  const tbody = document.getElementById('barangTbody');
  if(!tbody) return;
  tbody.innerHTML = "";
  if(barangList.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #777;">Belum ada data barang.</td></tr>`;
    return;
  }
  barangList.forEach((b, idx) => {
    tbody.innerHTML += `
      <tr>
        <td>${idx + 1}</td>
        <td><b>${b.kode}</b></td>
        <td><b>${b.nama}</b></td>
        <td>${b.stok} ${b.satuan}</td>
        <td>Rp ${formatNumber(b.jual)}</td>
        <td><button class="btn btn-primary btn-sm" onclick="editBarangKeKasir(${idx})">Beli</button></td>
      </tr>
    `;
  });
}

function saveBarang(e) {
  e.preventDefault();
  const idx = document.getElementById('barangEditIndex').value;
  const barang = {
    kode: document.getElementById('barKode').value.trim(),
    nama: document.getElementById('barNama').value.toUpperCase().trim(),
    stok: parseInt(document.getElementById('barStok').value) || 0,
    satuan: document.getElementById('barSatuan').value,
    modal: parseFloat(document.getElementById('barHargaModal').value) || 0,
    jual: parseFloat(document.getElementById('barHargaJual').value) || 0
  };
  if(idx === "") barangList.push(barang);
  else barangList[idx] = barang;
  saveDataToStorage();
  renderBarangTable();
  alert("Data barang berhasil disimpan!");
}

function onKetikCariBarang() {
  const rawInput = document.getElementById('kasirBarangInput').value.trim();
  const keyword = rawInput.toLowerCase();
  const dropdown = document.getElementById('autocompleteDropdown');
  if(keyword === "") {
    dropdown.innerHTML = ""; dropdown.classList.add('hidden');
    return;
  }
  const filtered = barangList.map((b, idx) => ({ ...b, originalIndex: idx })).filter(b => 
    b.nama.toLowerCase().includes(keyword) || b.kode.toLowerCase().includes(keyword)
  );
  if(filtered.length === 0) {
    dropdown.innerHTML = `<div class="autocomplete-item" style="color: #94a3b8;">Barang tidak ditemukan</div>`;
    dropdown.classList.remove('hidden');
    return;
  }
  let html = "";
  filtered.forEach(item => {
    html += `<div class="autocomplete-item" onclick="pilihItemAutocomplete(${item.originalIndex})">
      <b>${item.nama}</b> (Stok: ${item.stok} ${item.satuan}) - Rp ${formatNumber(item.jual)}
    </div>`;
  });
  dropdown.innerHTML = html;
  dropdown.classList.remove('hidden');
}

function pilihItemAutocomplete(idx) {
  const barang = barangList[idx];
  document.getElementById('kasirBarangInput').value = `${barang.nama} (Stok: ${barang.stok} ${barang.satuan}) - Rp ${formatNumber(barang.jual)}`;
  document.getElementById('selectedKasirBarangIndex').value = idx;
  document.getElementById('autocompleteDropdown').classList.add('hidden');
  document.getElementById('kasirQty').value = 1;
}

function tambahItemKeranjang() {
  const idx = document.getElementById('selectedKasirBarangIndex').value;
  const qty = parseInt(document.getElementById('kasirQty').value) || 0;
  if(idx === "" || qty <= 0 || !barangList[idx]) {
    alert("Pilih barang dan masukkan jumlah yang valid!");
    return;
  }
  const barang = barangList[idx];
  const existing = keranjangList.find(k => k.kode === barang.kode);
  if(existing) {
    existing.qty += qty;
    existing.subtotal = existing.qty * existing.hargaJual;
  } else {
    keranjangList.push({
      kode: barang.kode, nama: barang.nama, hargaJual: barang.jual, qty, subtotal: barang.jual * qty
    });
  }
  renderKeranjang();
  document.getElementById('kasirBarangInput').value = "";
  document.getElementById('selectedKasirBarangIndex').value = "";
  document.getElementById('kasirQty').value = 1;
}

function renderKeranjang() {
  const tbody = document.getElementById('keranjangTbody');
  if(!tbody) return;
  tbody.innerHTML = "";
  let total = 0;
  if(keranjangList.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #777;">Keranjang belanja kosong.</td></tr>`;
    if(document.getElementById('kasirTotalDisplay')) document.getElementById('kasirTotalDisplay').innerText = `Rp 0`;
    return;
  }
  keranjangList.forEach((item, idx) => {
    total += item.subtotal;
    tbody.innerHTML += `
      <tr>
        <td>${idx + 1}</td>
        <td><b>${item.nama}</b></td>
        <td>Rp ${formatNumber(item.hargaJual)}</td>
        <td><input type="number" class="form-control" style="width: 70px;" value="${item.qty}" min="1" oninput="updateQtyKeranjang(${idx}, this.value)"></td>
        <td><b>Rp ${formatNumber(item.subtotal)}</b></td>
        <td><button class="btn btn-danger btn-sm" onclick="hapusItemKeranjang(${idx})">Hapus</button></td>
      </tr>
    `;
  });
  if(document.getElementById('kasirTotalDisplay')) document.getElementById('kasirTotalDisplay').innerText = `Rp ${formatNumber(total)}`;
}

function updateQtyKeranjang(idx, val) {
  const q = parseInt(val) || 1;
  keranjangList[idx].qty = q;
  keranjangList[idx].subtotal = q * keranjangList[idx].hargaJual;
  renderKeranjang();
}

function hapusItemKeranjang(idx) {
  keranjangList.splice(idx, 1);
  renderKeranjang();
}

function prosesPembayaran() {
  if(keranjangList.length === 0) { alert("Keranjang kosong!"); return; }
  let total = keranjangList.reduce((sum, item) => sum + item.subtotal, 0);
  const namaKasbonInput = document.getElementById('kasirNamaKasbon').value.trim();
  const isKasbon = namaKasbonInput !== "";
  let bayar = parseFloat(document.getElementById('kasirBayar').value) || 0;

  if(!isKasbon && bayar < total) { alert("Pembayaran tunai kurang!"); return; }

  keranjangList.forEach(item => {
    const b = barangList.find(x => x.kode === item.kode);
    if(b) { b.stok -= item.qty; if(b.stok < 0) b.stok = 0; }
  });

  const transaksi = {
    id: 'TRX-' + Date.now(),
    tanggalRaw: new Date().toISOString().split('T')[0],
    tanggal: new Date().toLocaleString('id-ID'),
    namaKasbon: namaKasbonInput,
    items: [...keranjangList],
    total,
    bayar,
    kembalian: Math.max(0, bayar - total),
    isLunasKasbon: !isKasbon
  };

  transaksiList.push(transaksi);
  saveDataToStorage();
  resetKasirForm();
  renderBarangTable();
  renderRiwayatTransaksi();
  alert("Transaksi berhasil dicatat dan stok diperbarui!");
  showTab('transaksiTab');
}

function resetKasirForm() {
  keranjangList = [];
  document.getElementById('kasirBarangInput').value = "";
  document.getElementById('kasirNamaKasbon').value = "";
  document.getElementById('kasirBayar').value = "";
  renderKeranjang();
}

// RENDER RIWAYAT TRANSAKSI DENGAN TAMPILAN RAPI & BERSIH
function renderRiwayatTransaksi() {
  const tbody = document.getElementById('riwayatTransaksiTbody');
  if(!tbody) return;
  tbody.innerHTML = "";

  if(transaksiList.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: #777;">Belum ada data transaksi penjualan.</td></tr>`;
    return;
  }

  let totalKeseluruhan = 0;
  transaksiList.forEach((t, idx) => {
    let namaBarangList = t.items.map((i, iIdx) => `<div style="margin-bottom: 2px;"><b>${iIdx + 1}. ${i.nama}</b> (${i.qty}x @Rp ${formatNumber(i.hargaJual)})</div>`).join('');
    
    let statusPembayaran = '<span class="badge-lunas">Tunai</span>';
    if (t.namaKasbon && t.namaKasbon.trim() !== '') {
      statusPembayaran = t.isLunasKasbon ? `<span class="badge-lunas">${t.namaKasbon} (Lunas)</span>` : `<span class="badge-belum-lunas">${t.namaKasbon} (Belum Lunas)</span>`;
    }

    totalKeseluruhan += t.total;
    tbody.innerHTML += `
      <tr style="vertical-align: middle;">
        <td style="text-align: center;"><input type="checkbox" class="trx-checkbox" value="${idx}"></td>
        <td><b>#${t.id ? t.id.slice(-6) : (idx + 1)}</b></td>
        <td style="padding: 10px; line-height: 1.5;">${namaBarangList}</td>
        <td style="text-align: center;">${statusPembayaran}</td>
        <td>${t.tanggal}</td>
        <td><b>Rp ${formatNumber(t.total)}</b></td>
        <td class="no-print" style="text-align: center; white-space: nowrap;">
          <button class="btn btn-secondary btn-sm" onclick="bukaModalCetakNota(${idx})" title="Cetak Nota">🖨️ Cetak</button>
          <button class="btn btn-danger btn-sm" onclick="deleteTransaksi(${idx})" title="Hapus">🗑️</button>
        </td>
      </tr>
    `;
  });
}

function bukaModalCetakNota(idx) {
  const t = transaksiList[idx];
  let itemsHtml = '';
  t.items.forEach(i => {
    itemsHtml += `<tr><td colspan="2"><b>${i.nama}</b></td></tr>
      <tr><td>${i.qty} PCS x ${formatNumber(i.hargaJual)}</td><td style="text-align: right;">Rp ${formatNumber(i.subtotal)}</td></tr>`;
  });

  document.getElementById('printReceiptContent').innerHTML = `
    <div class="receipt-header"><h4>${tokoProfile.nama}</h4><p>${tokoProfile.alamat}</p><p>Telp: ${tokoProfile.telp}</p></div>
    <div class="receipt-divider"></div>
    <div style="font-size: 0.75rem; margin-bottom: 5px;"><span>Tgl : ${t.tanggal}</span><br><span>ID : #${t.id || (idx + 1)}</span></div>
    <div class="receipt-divider"></div>
    <table class="receipt-items-table"><tbody>${itemsHtml}</tbody></table>
    <div class="receipt-divider"></div>
    <div class="receipt-totals">
      <div class="row"><span>TOTAL :</span> <b>Rp ${formatNumber(t.total)}</b></div>
      <div class="row"><span>TUNAI :</span> <span>Rp ${formatNumber(t.bayar)}</span></div>
      <div class="row"><span>KEMBALI :</span> <span>Rp ${formatNumber(t.kembalian)}</span></div>
    </div>
    <div class="receipt-divider"></div>
    <div class="receipt-footer"><p>${tokoProfile.notes}</p></div>
  `;
  document.getElementById('printModalOverlay').classList.remove('hidden');
}

function closePrintModal() { document.getElementById('printModalOverlay').classList.add('hidden'); }
function triggerWindowPrint() { window.print(); }

function deleteTransaksi(idx) {
  if(confirm("Hapus transaksi ini?")) {
    transaksiList.splice(idx, 1);
    saveDataToStorage();
    renderRiwayatTransaksi();
    updateDashboardStats();
    updateFinancialSummary();
  }
}

function formatNumber(num) {
  return new Intl.NumberFormat('id-ID').format(num);
}

function loadProfilData() {
  if(document.getElementById('tokoNama')) document.getElementById('tokoNama').value = tokoProfile.nama;
}
