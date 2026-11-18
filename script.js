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

// INISIALISASI & SINKRONISASI URL PARAMETER (MASTER QR & SCAN BARCODE)
document.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  const scanParam = params.get('scan') || params.get('barcode') || params.get('kode');
  const modeParam = params.get('mode');
  const storeParam = params.get('store');
  const syncItemsParam = params.get('items');
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

  if (tokoNameParam) {
    tokoProfile.nama = decodeURIComponent(tokoNameParam);
    localStorage.setItem('sembako_toko', JSON.stringify(tokoProfile));
  }

  if (storeParam && !tokoProfile.storeId) {
    tokoProfile.storeId = storeParam;
    saveDataToStorage();
  }

  loadProfilData();
  renderMasterQrCode();

  // Jika diakses melalui scan barcode / QR master tanpa login
  if (scanParam || modeParam === 'all') {
    localStorage.setItem('sembako_logged_in', 'true');
    if (modeParam === 'all') {
      localStorage.setItem('sembako_kasir_only', 'true');
    }
  }

  const isLocalStorageLoggedIn = localStorage.getItem('sembako_logged_in');
  const isKasirOnly = localStorage.getItem('sembako_kasir_only') === 'true';

  if (isLocalStorageLoggedIn === 'true') {
    const loginPage = document.getElementById('loginPage');
    const appContainer = document.getElementById('appContainer');
    
    if(loginPage) loginPage.classList.add('hidden');
    if(appContainer) appContainer.classList.remove('hidden');
    
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
    const loginPage = document.getElementById('loginPage');
    const appContainer = document.getElementById('appContainer');
    if(loginPage) loginPage.classList.remove('hidden');
    if(appContainer) appContainer.classList.add('hidden');
  }

  const today = new Date().toISOString().split('T')[0];
  if(document.getElementById('pengTgl')) document.getElementById('pengTgl').value = today;
  if(document.getElementById('barExpired')) document.getElementById('barExpired').value = today;
  if(document.getElementById('kasbonTgl')) document.getElementById('kasbonTgl').value = today;
});

function aturMenuKasirSaja() {
  const sidebarMenu = document.getElementById('sidebarMenuContainer');
  if (sidebarMenu) {
    sidebarMenu.innerHTML = `
      <button class="nav-btn active" data-tab="kasirTab" onclick="showTab('kasirTab')">🛒 Transaksi Kasir</button>
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
      b.kode.toLowerCase() === cleanCode || 
      b.nama.toLowerCase() === cleanCode
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
  if (e) e.preventDefault();
  const uInput = (document.getElementById('loginUsername')?.value || '').trim();
  const pInput = (document.getElementById('loginPassword')?.value || '').trim();

  const savedUser = (adminCreds.username || 'admin').trim();
  const savedPass = (adminCreds.password || 'admin').trim();

  if ((uInput === savedUser && pInput === savedPass) || (uInput === 'admin' && pInput === 'admin')) {
    localStorage.setItem('sembako_logged_in', 'true');
    localStorage.removeItem('sembako_kasir_only');
    
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
    showTab('berandaTab');
  } else {
    alert("Username atau Password salah! (Default: admin / admin)");
  }
}

function logout() {
  if(confirm("Keluar dari sesi ini dan kembali ke halaman login?")) {
    localStorage.removeItem('sembako_logged_in');
    localStorage.removeItem('sembako_kasir_only');
    window.location.href = window.location.pathname;
  }
}

function showTab(tabId) {
  const isKasirOnly = localStorage.getItem('sembako_kasir_only') === 'true';
  if (isKasirOnly && ['berandaTab', 'pengeluaranTab', 'barangTab', 'laporanTab', 'panduanTab', 'profilTab', 'scannerTab'].includes(tabId)) {
    tabId = 'kasirTab';
  }

  document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));

  const targetTab = document.getElementById(tabId);
  if(targetTab) targetTab.classList.add('active');

  const activeBtn = document.querySelector(`.nav-btn[data-tab="${tabId}"]`);
  if(activeBtn) activeBtn.classList.add('active');

  if(tabId === 'berandaTab') {
    updateDashboardStats();
    updateFinancialSummary();
    renderMasterQrCode();
  }
  if(tabId === 'barangTab') {
    populateBarangDatalist();
    renderBarangTable();
  }
  if(tabId === 'kasirTab') {
    populateKasbonDatalist();
  }
  if(tabId === 'scannerTab') {
    populateKasbonDatalist();
    initScannerCamera();
  } else {
    if(html5QrCode) { try { html5QrCode.stop(); } catch(e){} }
  }
  if(tabId === 'kasbonTab') {
    renderKasbonTable();
  }
  if(tabId === 'transaksiTab') {
    renderRiwayatTransaksi();
  }

  const sidebar = document.getElementById('appSidebar');
  if(sidebar && window.innerWidth <= 768) {
    sidebar.classList.remove('mobile-open');
  }
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
  renderMasterQrCode();
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
    html += `<div class="notif-item" onclick="navigateToKasbon(${origIdx})" style="cursor:pointer; padding:6px 0; border-bottom:1px solid #f1f5f9;">
      <div>📑 Piutang: <b>${k.nama}</b></div>
    </div>`;
  });
  notifList.innerHTML = html;
}

function toggleKasbonNotifDropdown() {
  const dropdown = document.getElementById('kasbonNotifDropdown');
  if(dropdown) dropdown.classList.toggle('hidden');
}

function navigateToKasbon(idx) {
  toggleKasbonNotifDropdown();
  showTab('kasbonTab');
}

function updateNotifications() {
  const notifList = document.getElementById('notifListContainer');
  const notifCountBadge = document.getElementById('notifCount');
  if(!notifList || !notifCountBadge) return;

  let warnings = [];
  barangList.forEach((b, idx) => {
    const batasMinimal = parseInt(b.minStok) || 3;
    if(b.stok < batasMinimal) {
      warnings.push(`Stok menipis: <b>${b.nama}</b> (${b.stok} ${b.satuan})`);
    }
  });

  notifCountBadge.innerText = warnings.length;
  if(warnings.length === 0) {
    notifList.innerHTML = `<div style="font-size:0.8rem; color:#64748b;">Tidak ada peringatan.</div>`;
    return;
  }
  notifList.innerHTML = warnings.map(w => `<div style="font-size:0.8rem; padding:4px 0; border-bottom:1px solid #f1f5f9;">${w}</div>`).join('');
}

function toggleNotifDropdown() {
  const dropdown = document.getElementById('notifDropdown');
  if(dropdown) dropdown.classList.toggle('hidden');
}

// MASTER QR CODE GENERATOR (1 BARCODE UNTUK SELAMANYA & SINKRON)
function renderMasterQrCode() {
  const container = document.getElementById('masterQrContainer');
  if (!container) return;
  container.innerHTML = "";

  const storeId = tokoProfile.storeId || "aplikasi-kasir-utama";
  const baseUrl = window.location.origin + window.location.pathname;

  const compactItems = barangList.map(b => ({
    k: b.kode, n: b.nama, s: b.stok, u: b.satuan, m: b.modal, j: b.jual
  }));
  const encodedItems = encodeDataToUrlParam(compactItems);
  const encodedTrx = encodeDataToUrlParam(transaksiList);
  const encodedKasbon = encodeDataToUrlParam(kasbonList);

  const masterUrl = `${baseUrl}?store=${encodeURIComponent(storeId)}&mode=all&toko=${encodeURIComponent(tokoProfile.nama || 'APLIKASI KASIR')}&items=${encodeURIComponent(encodedItems)}&transactions=${encodeURIComponent(encodedTrx)}&kasbon=${encodeURIComponent(encodedKasbon)}`;

  if (typeof QRCode !== "undefined") {
    new QRCode(container, {
      text: masterUrl,
      width: 120,
      height: 120,
      colorDark: "#000000",
      colorLight: "#ffffff",
      correctLevel: QRCode.CorrectLevel.M
    });
  }
}

function bukaModalQrMasterBarang() {
  const storeId = tokoProfile.storeId || "aplikasi-kasir-utama";
  const baseUrl = window.location.origin + window.location.pathname;

  const compactItems = barangList.map(b => ({
    k: b.kode, n: b.nama, s: b.stok, u: b.satuan, m: b.modal, j: b.jual
  }));
  const encodedItems = encodeDataToUrlParam(compactItems);
  const encodedTrx = encodeDataToUrlParam(transaksiList);
  const encodedKasbon = encodeDataToUrlParam(kasbonList);

  const masterUrl = `${baseUrl}?store=${encodeURIComponent(storeId)}&mode=all&toko=${encodeURIComponent(tokoProfile.nama || 'APLIKASI KASIR')}&items=${encodeURIComponent(encodedItems)}&transactions=${encodeURIComponent(encodedTrx)}&kasbon=${encodeURIComponent(encodedKasbon)}`;

  document.getElementById('qrMasterModalTitle').innerText = tokoProfile.nama || "APLIKASI KASIR";
  document.getElementById('qrMasterUrlInput').value = masterUrl;

  const container = document.getElementById('qrMasterCanvasContainer');
  container.innerHTML = "";

  if (typeof QRCode !== "undefined") {
    new QRCode(container, {
      text: masterUrl,
      width: 220,
      height: 220,
      colorDark: "#000000",
      colorLight: "#ffffff",
      correctLevel: QRCode.CorrectLevel.M
    });
  }

  document.getElementById('qrMasterModalOverlay').classList.remove('hidden');
}

function closeQrMasterModal() {
  document.getElementById('qrMasterModalOverlay').classList.add('hidden');
}

function downloadQrMasterPng() {
  const container = document.getElementById('qrMasterCanvasContainer');
  const canvas = container.querySelector('canvas');
  const img = container.querySelector('img');
  
  const exportCanvas = document.createElement('canvas');
  exportCanvas.width = 300;
  exportCanvas.height = 340;
  const ctx = exportCanvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 15px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText((tokoProfile.nama || "APLIKASI KASIR").substring(0, 30), 150, 28);

  if (canvas) ctx.drawImage(canvas, 35, 45, 230, 230);
  else if (img) ctx.drawImage(img, 35, 45, 230, 230);

  ctx.fillStyle = '#16a34a';
  ctx.font = 'bold 11px sans-serif';
  ctx.fillText('Master QR Kasir & Stok Sinkron', 150, 298);

  const link = document.createElement('a');
  link.download = `Master_QR_${(tokoProfile.nama || 'Toko').replace(/\s+/g, '_')}.png`;
  link.href = exportCanvas.toDataURL('image/png');
  link.click();
}

// PENGELUARAN & SINKRONISASI BARANG
function toggleSelectAllPengeluaran(source) {
  document.querySelectorAll('.pengeluaran-checkbox').forEach(cb => { cb.checked = source.checked; });
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

  if(idx === "") {
    pengeluaranList.push(newItem);
    // Sinkron otomatis ke Data Barang
    barangList.push({
      kode: newItem.barcode,
      nama: newItem.keterangan.toUpperCase(),
      stok: 0,
      minStok: 3,
      satuan: 'Pcs',
      expired: '',
      minExpDays: 15,
      modal: newItem.modal,
      jual: newItem.jual
    });
  } else {
    const oldItem = pengeluaranList[idx];
    pengeluaranList[idx] = newItem;

    barangList.forEach(b => {
      if(b.kode === oldItem.barcode || b.nama.toUpperCase() === oldItem.keterangan.toUpperCase()) {
        b.nama = newItem.keterangan.toUpperCase();
        b.kode = newItem.barcode;
        b.modal = newItem.modal;
        b.jual = newItem.jual;
      }
    });
  }

  saveDataToStorage();
  renderPengeluaranTable();
  renderBarangTable();
  resetPengeluaranForm();
  alert("Data pengeluaran disimpan & tersinkron otomatis ke Data Barang!");
}

function renderPengeluaranTable() {
  const tbody = document.getElementById('pengeluaranTbody');
  if(!tbody) return;
  tbody.innerHTML = "";
  
  const keyword = (document.getElementById('searchPengeluaranInput')?.value || '').toLowerCase();
  const filtered = pengeluaranList.filter(p => p.keterangan.toLowerCase().includes(keyword) || p.barcode.toLowerCase().includes(keyword));

  if(filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: #777;">Belum ada data pengeluaran.</td></tr>`;
    return;
  }

  filtered.forEach((p, idx) => {
    const origIdx = pengeluaranList.indexOf(p);
    const svgId = `tableBarcode_peng_${origIdx}`;
    const safeName = p.keterangan.replace(/'/g, "\\'");
    const safeCode = p.barcode.replace(/'/g, "\\'");

    tbody.innerHTML += `
      <tr>
        <td style="text-align: center;"><input type="checkbox" class="pengeluaran-checkbox" value="${origIdx}"></td>
        <td>${idx + 1}</td>
        <td>${formatDateID(p.tanggal)}</td>
        <td><b>${p.keterangan}</b></td>
        <td>Rp ${formatNumber(p.modal)}</td>
        <td>Rp ${formatNumber(p.jual)}</td>
        <td style="text-align: center;"><svg id="${svgId}" class="table-barcode-svg"></svg></td>
        <td>
          <button class="btn btn-primary btn-sm" onclick="editPengeluaran(${origIdx})">Edit</button>
          <button class="btn btn-danger btn-sm" onclick="deletePengeluaran(${origIdx})">Hapus</button>
        </td>
      </tr>
    `;
    setTimeout(() => {
      try { JsBarcode(`#${svgId}`, p.barcode, { format: "CODE128", width: 1.5, height: 40, displayValue: true, fontSize: 12 }); } catch(err){}
    }, 50);
  });
}

function editPengeluaran(idx) {
  toggleForm('pengeluaranFormCard', 'pengeluaranToggleIcon');
  const p = pengeluaranList[idx];
  document.getElementById('pengeluaranEditIndex').value = idx;
  document.getElementById('pengTgl').value = p.tanggal;
  document.getElementById('pengKeterangan').value = p.keterangan;
  document.getElementById('pengHargaModal').value = p.modal;
  document.getElementById('pengHargaJual').value = p.jual;
  document.getElementById('pengBarcodeCode').value = p.barcode;
  previewLiveBarcode();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function deletePengeluaran(idx) {
  if(confirm("Hapus data pengeluaran ini?")) {
    pengeluaranList.splice(idx, 1);
    saveDataToStorage();
    renderPengeluaranTable();
    updateFinancialSummary();
  }
}

function resetPengeluaranForm() {
  document.getElementById('pengeluaranForm').reset();
  document.getElementById('pengeluaranEditIndex').value = "";
  document.getElementById('liveBarcodeSvg').innerHTML = "";
  toggleForm('pengeluaranFormCard', 'pengeluaranToggleIcon');
}

function previewLiveBarcode() {
  const code = document.getElementById('pengBarcodeCode').value.trim();
  if(code) {
    try { JsBarcode("#liveBarcodeSvg", code, { format: "CODE128", width: 2, height: 60, displayValue: true, fontSize: 14 }); } catch(e){}
  } else {
    document.getElementById('liveBarcodeSvg').innerHTML = "";
  }
}

// DATA BARANG & QR PER ITEM
function toggleSelectAllBarang(source) {
  document.querySelectorAll('.barang-checkbox').forEach(cb => { cb.checked = source.checked; });
}

function saveBarang(e) {
  e.preventDefault();
  const idx = document.getElementById('barangEditIndex').value;
  const barang = {
    kode: document.getElementById('barKode').value.trim(),
    nama: document.getElementById('barNama').value.toUpperCase().trim(),
    stok: parseInt(document.getElementById('barStok').value) || 0,
    minStok: parseInt(document.getElementById('barMinStok').value) || 3,
    satuan: document.getElementById('barSatuan').value,
    expired: document.getElementById('barExpired').value,
    minExpDays: parseInt(document.getElementById('barMinExpDays').value) || 15,
    modal: parseFloat(document.getElementById('barHargaModal').value) || 0,
    jual: parseFloat(document.getElementById('barHargaJual').value) || 0
  };

  if(idx === "") barangList.push(barang);
  else barangList[idx] = barang;

  saveDataToStorage();
  renderBarangTable();
  resetBarangForm();
  alert("Data barang berhasil disimpan!");
}

function renderBarangTable() {
  const tbody = document.getElementById('barangTbody');
  if(!tbody) return;
  tbody.innerHTML = "";

  const keyword = (document.getElementById('searchBarangInput')?.value || '').toLowerCase();
  const filtered = barangList.filter(b => b.nama.toLowerCase().includes(keyword) || b.kode.toLowerCase().includes(keyword));

  if(filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #777;">Belum ada data barang.</td></tr>`;
    return;
  }

  filtered.forEach((b, idx) => {
    const origIdx = barangList.indexOf(b);
    const svgId = `tableBarcode_bar_${origIdx}`;
    const safeName = b.nama.replace(/'/g, "\\'");
    const safeCode = b.kode.replace(/'/g, "\\'");

    tbody.innerHTML += `
      <tr>
        <td style="text-align: center;"><input type="checkbox" class="barang-checkbox" value="${origIdx}"></td>
        <td>${idx + 1}</td>
        <td style="text-align: center;">
          <svg id="${svgId}" class="table-barcode-svg"></svg>
          <div style="margin-top: 5px;">
            <button class="btn btn-success btn-sm" onclick="bukaModalQrKasir('${safeCode}', '${safeName}')">📱 QR Kasir</button>
          </div>
        </td>
        <td><b>${b.nama}</b><br><small style="color:#16a34a;">Jual: Rp ${formatNumber(b.jual)}</small></td>
        <td><b>${b.stok}</b> ${b.satuan}</td>
        <td>
          <button class="btn btn-primary btn-sm" onclick="editBarang(${origIdx})">Edit</button>
          <button class="btn btn-danger btn-sm" onclick="deleteBarang(${origIdx})">Hapus</button>
        </td>
      </tr>
    `;
    setTimeout(() => {
      try { JsBarcode(`#${svgId}`, b.kode, { format: "CODE128", width: 1.5, height: 40, displayValue: true, fontSize: 12 }); } catch(err){}
    }, 50);
  });
}

function bukaModalQrKasir(kode, nama) {
  currentQrModalKode = kode;
  currentQrModalNama = nama;
  document.getElementById('qrModalItemTitle').innerText = nama;
  document.getElementById('qrModalItemCode').innerText = `Kode: ${kode}`;

  const container = document.getElementById('qrModalCanvasContainer');
  container.innerHTML = "";
  const baseUrl = window.location.origin + window.location.pathname;
  const storeId = tokoProfile.storeId || "aplikasi-kasir-utama";
  const directUrl = `${baseUrl}?store=${storeId}&scan=${encodeURIComponent(kode)}`;

  if (typeof QRCode !== "undefined") {
    new QRCode(container, {
      text: directUrl,
      width: 200,
      height: 200,
      colorDark: "#000000",
      colorLight: "#ffffff",
      correctLevel: QRCode.CorrectLevel.M
    });
  }
  document.getElementById('qrKasirModalOverlay').classList.remove('hidden');
}

function closeQrKasirModal() {
  document.getElementById('qrKasirModalOverlay').classList.add('hidden');
}

function downloadQrKasirPng() {
  const container = document.getElementById('qrModalCanvasContainer');
  const canvas = container.querySelector('canvas');
  const img = container.querySelector('img');
  
  const exportCanvas = document.createElement('canvas');
  exportCanvas.width = 280;
  exportCanvas.height = 320;
  const ctx = exportCanvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(currentQrModalNama.substring(0, 28), 140, 25);

  if (canvas) ctx.drawImage(canvas, 30, 40, 220, 220);
  else if (img) ctx.drawImage(img, 30, 40, 220, 220);

  ctx.fillStyle = '#475569';
  ctx.font = '11px monospace';
  ctx.fillText(`Scan -> Langsung Kasir`, 140, 285);

  const link = document.createElement('a');
  link.download = `QR_Kasir_${currentQrModalNama.replace(/\s+/g, '_')}.png`;
  link.href = exportCanvas.toDataURL('image/png');
  link.click();
}

function editBarang(idx) {
  toggleForm('barangFormCard', 'barangToggleIcon');
  const b = barangList[idx];
  document.getElementById('barangEditIndex').value = idx;
  document.getElementById('barNama').value = b.nama;
  document.getElementById('barKode').value = b.kode;
  document.getElementById('barStok').value = b.stok;
  document.getElementById('barMinStok').value = b.minStok || 3;
  document.getElementById('barSatuan').value = b.satuan;
  document.getElementById('barExpired').value = b.expired || '';
  document.getElementById('barMinExpDays').value = b.minExpDays || 15;
  document.getElementById('barHargaModal').value = b.modal;
  document.getElementById('barHargaJual').value = b.jual;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function deleteBarang(idx) {
  if(confirm("Hapus barang ini?")) {
    barangList.splice(idx, 1);
    saveDataToStorage();
    renderBarangTable();
  }
}

function resetBarangForm() {
  document.getElementById('barangForm').reset();
  document.getElementById('barangEditIndex').value = "";
}

// TRANSAKSI KASIR & PENGURANGAN STOK SINKRON
function onKetikCariBarang() {
  const keyword = document.getElementById('kasirBarangInput').value.toLowerCase().trim();
  const dropdown = document.getElementById('autocompleteDropdown');

  if(keyword === "") {
    dropdown.innerHTML = "";
    dropdown.classList.add('hidden');
    return;
  }

  const filtered = barangList.map((b, idx) => ({ ...b, originalIndex: idx })).filter(b => 
    b.nama.toLowerCase().includes(keyword) || b.kode.toLowerCase().includes(keyword)
  );

  if(filtered.length === 0) {
    dropdown.innerHTML = `<div style="padding: 10px; color: #94a3b8;">Barang tidak ditemukan</div>`;
    dropdown.classList.remove('hidden');
    return;
  }

  let html = "";
  filtered.forEach(item => {
    html += `<div onclick="pilihItemAutocomplete(${item.originalIndex})" style="padding: 10px; border-bottom: 1px solid #f1f5f9; cursor: pointer;">
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
  let currentQtyInCart = existing ? existing.qty : 0;

  if(currentQtyInCart + qty > barang.stok) {
    alert(`Stok fisik "${barang.nama}" tidak mencukupi! (Sisa stok: ${barang.stok} ${barang.satuan})`);
    return;
  }

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
    document.getElementById('kasirTotalDisplay').innerText = `Rp 0`;
    hitungKembalian();
    return;
  }

  keranjangList.forEach((item, idx) => {
    total += item.subtotal;
    const svgId = `keranjangBarcode_${idx}`;
    tbody.innerHTML += `
      <tr>
        <td>${idx + 1}</td>
        <td><b>${item.nama}</b></td>
        <td style="text-align: center;"><svg id="${svgId}" class="table-barcode-svg" style="height:30px;"></svg></td>
        <td>Rp ${formatNumber(item.hargaJual)}</td>
        <td>${item.qty}</td>
        <td><b>Rp ${formatNumber(item.subtotal)}</b></td>
        <td><button class="btn btn-danger btn-sm" onclick="keranjangList.splice(${idx}, 1); renderKeranjang();">Hapus</button></td>
      </tr>
    `;
    setTimeout(() => {
      try { JsBarcode(`#${svgId}`, item.kode, { format: "CODE128", width: 1, height: 30, displayValue: false }); } catch(err){}
    }, 50);
  });

  document.getElementById('kasirTotalDisplay').innerText = `Rp ${formatNumber(total)}`;
  hitungKembalian();
}

function hitungKembalian() {
  let total = keranjangList.reduce((sum, item) => sum + item.subtotal, 0);
  let bayar = parseFloat(document.getElementById('kasirBayar').value) || 0;
  let kembalian = bayar - total;
  document.getElementById('kasirKembalianDisplay').innerText = kembalian >= 0 ? `Rp ${formatNumber(kembalian)}` : `Rp 0`;
}

function prosesPembayaran() {
  if(keranjangList.length === 0) { alert("Keranjang belanja masih kosong!"); return; }
  
  let total = keranjangList.reduce((sum, item) => sum + item.subtotal, 0);
  const namaKasbon = document.getElementById('kasirNamaKasbon').value.trim();
  let bayar = parseFloat(document.getElementById('kasirBayar').value) || 0;

  if(!namaKasbon && bayar < total) {
    alert("Jumlah pembayaran tunai kurang!");
    return;
  }

  // Kurangi stok barang secara sinkron
  keranjangList.forEach(item => {
    const b = barangList.find(x => x.kode === item.kode);
    if(b) {
      b.stok -= item.qty;
      if(b.stok < 0) b.stok = 0;
    }
  });

  const now = new Date();
  const transaksi = {
    id: 'TRX-' + Date.now(),
    tanggalRaw: now.toISOString().split('T')[0],
    tanggal: now.toLocaleString('id-ID'),
    namaKasbon: namaKasbon,
    items: [...keranjangList],
    total: total,
    bayar: bayar,
    kembalian: Math.max(0, bayar - total)
  };

  transaksiList.push(transaksi);

  // Jika kasbon, daftarkan ke data kasbon
  if(namaKasbon) {
    const exist = kasbonList.find(k => k.nama.toLowerCase() === namaKasbon.toLowerCase());
    if(!exist) {
      kasbonList.push({
        tanggal: now.toISOString().split('T')[0],
        nama: namaKasbon,
        telp: '',
        alamat: '',
        status: 'Belum Lunas'
      });
    }
  }

  saveDataToStorage();
  renderBarangTable();
  renderRiwayatTransaksi();
  renderKasbonTable();
  resetKasirForm();

  // Redirect sesuai aturan: jika kasbon ke halaman kasbon, jika tidak ke data transaksi[cite: 6]
  if(namaKasbon) {
    alert("Transaksi Kasbon berhasil dicatat!");
    showTab('kasbonTab');
  } else {
    alert("Transaksi Tunai berhasil!");
    showTab('transaksiTab');
  }
}

function resetKasirForm() {
  keranjangList = [];
  document.getElementById('kasirBarangInput').value = "";
  document.getElementById('selectedKasirBarangIndex').value = "";
  document.getElementById('kasirNamaKasbon').value = "";
  document.getElementById('kasirBayar').value = "";
  renderKeranjang();
}

// SCANNER KAMERA
function speakSuccessMessage(nama) {
  try {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(`Barang ditemukan, ${nama}`);
      utterance.lang = 'id-ID';
      window.speechSynthesis.speak(utterance);
    }
  } catch(e) {}
}

function switchMode(mode) {
  const btnCam = document.getElementById('btnTabCamera');
  const btnUp = document.getElementById('btnTabUpload');
  const camSec = document.getElementById('cameraSection');
  const upSec = document.getElementById('uploadSection');

  if(mode === 'camera') {
    btnCam.classList.add('active'); btnUp.classList.remove('active');
    camSec.classList.remove('hidden'); upSec.classList.add('hidden');
    initScannerCamera();
  } else {
    btnUp.classList.add('active'); btnCam.classList.remove('active');
    upSec.classList.remove('hidden'); camSec.classList.add('hidden');
    if(html5QrCode) { try { html5QrCode.stop(); } catch(e){} }
  }
}

function initScannerCamera() {
  if(!document.getElementById('reader')) return;
  if(!html5QrCode) html5QrCode = new Html5Qrcode("reader");
  
  html5QrCode.start(
    { facingMode: "environment" }, 
    { fps: 10, qrbox: { width: 250, height: 150 } }, 
    (decodedText) => {
      const now = Date.now();
      if(decodedText === lastScannedCode && (now - lastScannedTime < 2500)) return;
      lastScannedCode = decodedText;
      lastScannedTime = now;
      document.getElementById('scanResultCode').value = decodedText;
      cariProdukByBarcodeScanner(decodedText, true);
    },
    () => {}
  ).catch(() => {});
}

function scanImageFromFile(e) {
  const file = e.target.files[0];
  if(!file) return;
  const qrScanner = new Html5Qrcode("reader");
  qrScanner.scanFile(file, true)
    .then(decodedText => {
      document.getElementById('scanResultCode').value = decodedText;
      cariProdukByBarcodeScanner(decodedText, true);
    })
    .catch(() => alert("Gagal mendeteksi barcode dari gambar."));
}

function cariProdukByBarcodeScanner(code, autoRedirect = false) {
  const cleanCode = code.trim().toLowerCase();
  const found = barangList.find(b => b.kode.toLowerCase() === cleanCode || b.nama.toLowerCase() === cleanCode);
  const infoCard = document.getElementById('productDetailInfo');
  const notFound = document.getElementById('productNotFound');

  if(found) {
    selectedProdukAktif = found;
    document.getElementById('infoNama').innerText = found.nama;
    document.getElementById('infoStok').innerText = `${found.stok} ${found.satuan}`;
    document.getElementById('infoHarga').innerText = `Rp ${formatNumber(found.jual)}`;
    infoCard.classList.remove('hidden');
    notFound.classList.add('hidden');
    if(autoRedirect) kirimHasilScanKeKasir();
  } else {
    selectedProdukAktif = null;
    infoCard.classList.add('hidden');
    notFound.classList.remove('hidden');
  }
}

function kirimHasilScanKeKasir() {
  if(!selectedProdukAktif) return;
  const qty = parseInt(document.getElementById('scanQty').value) || 1;
  const idx = barangList.findIndex(b => b.kode === selectedProdukAktif.kode);

  if(idx !== -1) {
    showTab('kasirTab');
    setTimeout(() => {
      const b = barangList[idx];
      document.getElementById('kasirBarangInput').value = `${b.nama} (Stok: ${b.stok} ${b.satuan}) - Rp ${formatNumber(b.jual)}`;
      document.getElementById('selectedKasirBarangIndex').value = idx;
      document.getElementById('kasirQty').value = qty;
      tambahItemKeranjang();
      speakSuccessMessage(b.nama);
    }, 100);
  }
}

// KASBON & RIWAYAT TRANSAKSI (Hanya Print & Hapus, Tanpa Tombol Edit di Kasbon)[cite: 6]
function renderKasbonTable() {
  const tbody = document.getElementById('kasbonTbody');
  if(!tbody) return;
  tbody.innerHTML = "";

  if(kasbonList.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #777;">Belum ada data kasbon.</td></tr>`;
    return;
  }

  kasbonList.forEach((k, idx) => {
    tbody.innerHTML += `
      <tr>
        <td style="text-align: center;"><input type="checkbox" class="kasbon-checkbox" value="${idx}"></td>
        <td>${idx + 1}</td>
        <td>${formatDateID(k.tanggal)}</td>
        <td><b>${k.nama}</b></td>
        <td><span style="background: #fee2e2; color: #dc2626; padding: 3px 8px; border-radius: 4px; font-weight: 600;">${k.status || 'Belum Lunas'}</span></td>
        <td>
          <button class="btn btn-danger btn-sm" onclick="deleteKasbon(${idx})">Hapus</button>
        </td>
      </tr>
    `;
  });
}

function saveKasbon(e) {
  e.preventDefault();
  const idx = document.getElementById('kasbonEditIndex').value;
  const newItem = {
    tanggal: document.getElementById('kasbonTgl').value,
    nama: document.getElementById('kasbonNama').value.trim(),
    telp: document.getElementById('kasbonTelp').value.trim(),
    alamat: document.getElementById('kasbonAlamat').value.trim(),
    status: document.getElementById('kasbonStatus').value
  };

  if(idx === "") kasbonList.push(newItem);
  else kasbonList[idx] = newItem;

  saveDataToStorage();
  renderKasbonTable();
  resetKasbonForm();
  alert("Data kasbon disimpan!");
}

function deleteKasbon(idx) {
  if(confirm("Hapus kasbon ini?")) {
    kasbonList.splice(idx, 1);
    saveDataToStorage();
    renderKasbonTable();
  }
}

function resetKasbonForm() {
  document.getElementById('kasbonForm').reset();
  document.getElementById('kasbonEditIndex').value = "";
}

function populateKasbonDatalist() {
  const dl = document.getElementById('listKasbonNama');
  if(!dl) return;
  dl.innerHTML = "";
  kasbonList.forEach(k => { dl.innerHTML += `<option value="${k.nama}">`; });
}

function renderRiwayatTransaksi() {
  currentFilteredTransaksi = [...transaksiList];
  renderRiwayatTransaksiFiltered();
}

function renderRiwayatTransaksiFiltered() {
  const tbody = document.getElementById('riwayatTransaksiTbody');
  if(!tbody) return;
  tbody.innerHTML = "";

  if(currentFilteredTransaksi.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: #777;">Belum ada riwayat transaksi.</td></tr>`;
    return;
  }

  currentFilteredTransaksi.forEach((t, idx) => {
    const origIdx = transaksiList.indexOf(t);
    const namaBarang = t.items.map(i => `${i.nama} (${i.qty}x)`).join(', ');
    tbody.innerHTML += `
      <tr>
        <td class="no-print" style="text-align: center;"><input type="checkbox" class="trx-checkbox" value="${origIdx}"></td>
        <td>${idx + 1}</td>
        <td><b>${namaBarang}</b></td>
        <td style="text-align: center;">${t.namaKasbon || '<span style="color:green;">Tunai</span>'}</td>
        <td>${t.tanggal}</td>
        <td>${t.items.length} item</td>
        <td><b>Rp ${formatNumber(t.total)}</b></td>
        <td class="no-print">
          <button class="btn btn-secondary btn-sm" onclick="bukaModalCetakNota(${origIdx})">🖨️ Cetak</button>
          <button class="btn btn-danger btn-sm" onclick="deleteTransaksi(${origIdx})">🗑️ Hapus</button>
        </td>
      </tr>
    `;
  });
}

function filterTransaksiByDateRange() {
  const dari = document.getElementById('trxTglDari').value;
  const sampai = document.getElementById('trxTglSampai').value;
  const keyword = (document.getElementById('searchTransaksiKeyword')?.value || '').toLowerCase();

  currentFilteredTransaksi = transaksiList.filter(t => {
    let matchTgl = true;
    if(dari && sampai) matchTgl = t.tanggalRaw >= dari && t.tanggalRaw <= sampai;
    let matchKw = true;
    if(keyword) {
      matchKw = t.items.some(i => i.nama.toLowerCase().includes(keyword)) || (t.namaKasbon && t.namaKasbon.toLowerCase().includes(keyword));
    }
    return matchTgl && matchKw;
  });
  renderRiwayatTransaksiFiltered();
}

function resetFilterTransaksi() {
  document.getElementById('trxTglDari').value = "";
  document.getElementById('trxTglSampai').value = "";
  document.getElementById('searchTransaksiKeyword').value = "";
  renderRiwayatTransaksi();
}

function deleteTransaksi(idx) {
  if(confirm("Hapus transaksi ini?")) {
    transaksiList.splice(idx, 1);
    saveDataToStorage();
    renderRiwayatTransaksi();
  }
}

function bukaModalCetakNota(idx) {
  const t = transaksiList[idx];
  let itemsHtml = '';
  t.items.forEach(i => {
    itemsHtml += `<tr><td colspan="2"><b>${i.nama}</b></td></tr>
      <tr><td>${i.qty} x ${formatNumber(i.hargaJual)}</td><td style="text-align:right;">${formatNumber(i.subtotal)}</td></tr>`;
  });

  document.getElementById('printReceiptContent').innerHTML = `
    <div class="receipt-header"><h4>${tokoProfile.nama}</h4><p>${tokoProfile.alamat}</p><p>Telp: ${tokoProfile.telp}</p></div>
    <div class="receipt-divider"></div>
    <div style="font-size: 0.75rem;"><span>Tgl: ${t.tanggal}</span><br><span>Pelanggan: ${t.namaKasbon || 'Tunai'}</span></div>
    <div class="receipt-divider"></div>
    <table class="receipt-items-table"><tbody>${itemsHtml}</tbody></table>
    <div class="receipt-divider"></div>
    <div class="receipt-totals">
      <div class="row"><span>TOTAL:</span> <b>Rp ${formatNumber(t.total)}</b></div>
      <div class="row"><span>BAYAR:</span> <span>Rp ${formatNumber(t.bayar)}</span></div>
      <div class="row"><span>KEMBALI:</span> <span>Rp ${formatNumber(t.kembalian)}</span></div>
    </div>
    <div class="receipt-divider"></div>
    <div class="receipt-footer"><p>${tokoProfile.notes}</p></div>
  `;
  document.getElementById('printModalOverlay').classList.remove('hidden');
}

function closePrintModal() { document.getElementById('printModalOverlay').classList.add('hidden'); }
function triggerWindowPrint() { window.print(); }

// LAPORAN & PROFIL
function populateLaporanBarangSelect() {
  const sel = document.getElementById('laporanBarangSelect');
  if(!sel) return;
  sel.innerHTML = '<option value="">-- Semua Barang --</option>';
  barangList.forEach(b => { sel.innerHTML += `<option value="${b.nama}">${b.nama}</option>`; });
}

function filterLaporan() {
  const nama = document.getElementById('laporanBarangSelect').value;
  const dari = document.getElementById('laporanTglDari').value;
  const sampai = document.getElementById('laporanTglSampai').value;
  const tbody = document.getElementById('laporanTbody');
  if(!tbody) return;
  tbody.innerHTML = "";

  if(!dari || !sampai) return alert("Pilih rentang tanggal!");
  let filtered = transaksiList.filter(t => t.tanggalRaw >= dari && t.tanggalRaw <= sampai);
  if(nama) filtered = filtered.filter(t => t.items.some(i => i.nama.toLowerCase() === nama.toLowerCase()));

  filtered.forEach((t, idx) => {
    const namaBarang = t.items.map(i => `${i.nama} (${i.qty}x)`).join(', ');
    tbody.innerHTML += `
      <tr>
        <td>${idx + 1}</td>
        <td>${formatDateID(t.tanggalRaw)}</td>
        <td><b>${namaBarang}</b></td>
        <td style="text-align: center;">${t.namaKasbon || 'Tunai'}</td>
        <td>${t.items.length}</td>
        <td><b>Rp ${formatNumber(t.total)}</b></td>
        <td class="no-print"><button class="btn btn-primary btn-sm" onclick="bukaModalCetakNota(${transaksiList.indexOf(t)})">Detail</button></td>
      </tr>
    `;
  });
}

function cetakSemuaLaporanKeseluruhan() { window.print(); }

function loadProfilData() {
  if(!document.getElementById('profilUsername')) return;
  document.getElementById('browserPageTitle').innerText = tokoProfile.nama;
  document.getElementById('profilUsername').value = adminCreds.username;
  document.getElementById('tokoStoreId').value = tokoProfile.storeId || 'aplikasi-kasir-utama';
  document.getElementById('tokoNama').value = tokoProfile.nama;
  document.getElementById('tokoTelp').value = tokoProfile.telp;
  document.getElementById('tokoAlamat').value = tokoProfile.alamat;
  document.getElementById('tokoNotes').value = tokoProfile.notes;

  document.getElementById('userDisplayName').innerText = adminCreds.username;
  document.getElementById('topbarMobileBrandText').innerText = tokoProfile.nama;
  document.getElementById('navBrandText').innerText = tokoProfile.nama;
  document.getElementById('bannerStoreName').innerText = tokoProfile.nama;
  document.getElementById('bannerAlamat').innerText = tokoProfile.alamat;
  document.getElementById('bannerTelp').innerText = `Telp: ${tokoProfile.telp}`;
  document.getElementById('sidebarUserText').innerText = `Halo, ${adminCreds.username}`;

  if(adminCreds.avatar) {
    document.getElementById('previewAvatarImg').src = adminCreds.avatar;
    document.getElementById('previewAvatarImg').classList.remove('hidden');
    document.getElementById('previewAvatarIcon').classList.add('hidden');
    document.getElementById('navUserAvatarImg').src = adminCreds.avatar;
    document.getElementById('navUserAvatarImg').classList.remove('hidden');
  }
  if(tokoProfile.logo) {
    document.getElementById('previewLogoImg').src = tokoProfile.logo;
    document.getElementById('previewLogoImg').classList.remove('hidden');
    document.getElementById('previewLogoIcon').classList.add('hidden');
    document.getElementById('navBrandImg').src = tokoProfile.logo;
    document.getElementById('navBrandImg').classList.remove('hidden');
    document.getElementById('bannerLogoImg').src = tokoProfile.logo;
    document.getElementById('bannerLogoImg').classList.remove('hidden');
  }
}

function previewAvatar(e) {
  const f = e.target.files[0];
  if(f) {
    const r = new FileReader();
    r.onload = ev => {
      tempAvatarBase64 = ev.target.result;
      document.getElementById('previewAvatarImg').src = tempAvatarBase64;
      document.getElementById('previewAvatarImg').classList.remove('hidden');
      document.getElementById('previewAvatarIcon').classList.add('hidden');
    };
    r.readAsDataURL(f);
  }
}

function hapusFotoAdmin() {
  adminCreds.avatar = ''; tempAvatarBase64 = '';
  saveDataToStorage(); loadProfilData();
}

function previewLogo(e) {
  const f = e.target.files[0];
  if(f) {
    const r = new FileReader();
    r.onload = ev => {
      tempLogoBase64 = ev.target.result;
      document.getElementById('previewLogoImg').src = tempLogoBase64;
      document.getElementById('previewLogoImg').classList.remove('hidden');
      document.getElementById('previewLogoIcon').classList.add('hidden');
    };
    r.readAsDataURL(f);
  }
}

function hapusLogoToko() {
  tokoProfile.logo = ''; tempLogoBase64 = '';
  saveDataToStorage(); loadProfilData();
}

function saveProfilAdmin(e) {
  e.preventDefault();
  adminCreds.username = document.getElementById('profilUsername').value;
  const p = document.getElementById('profilPassword').value;
  if(p.trim() !== "") adminCreds.password = p;
  if(tempAvatarBase64) adminCreds.avatar = tempAvatarBase64;
  saveDataToStorage(); loadProfilData();
  alert("Profil admin diperbarui!");
}

function saveProfilToko(e) {
  e.preventDefault();
  tokoProfile.storeId = document.getElementById('tokoStoreId').value.trim().toLowerCase();
  tokoProfile.nama = document.getElementById('tokoNama').value;
  tokoProfile.telp = document.getElementById('tokoTelp').value;
  tokoProfile.alamat = document.getElementById('tokoAlamat').value;
  tokoProfile.notes = document.getElementById('tokoNotes').value;
  if(tempLogoBase64) tokoProfile.logo = tempLogoBase64;
  saveDataToStorage(); loadProfilData();
  alert("Pengaturan toko disimpan!");
}

function exportDataApp() {
  const data = { barangList, pengeluaranList, transaksiList, kasbonList, adminCreds, tokoProfile };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `backup_aplikasi_kasir.json`;
  a.click();
}

function importDataApp() {
  const f = document.getElementById('importFileJson').files[0];
  if(!f) return alert("Pilih file backup JSON!");
  const r = new FileReader();
  r.onload = ev => {
    try {
      const data = JSON.parse(ev.target.result);
      if(data.barangList) barangList = data.barangList;
      if(data.pengeluaranList) pengeluaranList = data.pengeluaranList;
      if(data.transaksiList) transaksiList = data.transaksiList;
      if(data.kasbonList) kasbonList = data.kasbonList;
      if(data.adminCreds) adminCreds = data.adminCreds;
      if(data.tokoProfile) tokoProfile = data.tokoProfile;
      saveDataToStorage();
      loadProfilData();
      renderBarangTable();
      renderPengeluaranTable();
      renderRiwayatTransaksi();
      renderKasbonTable();
      alert("Pemulihan data berhasil!");
    } catch(err) {
      alert("Format file tidak valid.");
    }
  };
  r.readAsText(f);
}

function formatNumber(num) {
  return new Intl.NumberFormat('id-ID').format(num);
}
