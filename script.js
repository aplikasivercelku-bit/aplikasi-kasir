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

// INISIALISASI & SINKRONISASI MENGGUNAKAN LOCALSTORAGE AGAR REFRESH TIDAK BLANK
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

function toggleAdminMenuDropdown(e) {
  if(e) e.stopPropagation();
  const dropdown = document.getElementById('adminMenuDropdown');
  if(dropdown) {
    dropdown.classList.toggle('hidden');
  }
}

window.addEventListener('click', function(e) {
  if(!e.target.closest('.admin-dropdown-wrapper')) {
    const dropdown = document.getElementById('adminMenuDropdown');
    if(dropdown && !dropdown.classList.contains('hidden')) {
      dropdown.classList.add('hidden');
    }
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
  e.preventDefault();
  const uInput = document.getElementById('loginUsername').value.trim();
  const pInput = document.getElementById('loginPassword').value.trim();

  if(uInput === adminCreds.username && pInput === adminCreds.password) {
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

    const params = new URLSearchParams(window.location.search);
    const scanParam = params.get('scan') || params.get('barcode');
    if (scanParam) {
      bukaLangsungTransaksiDariBarcode(scanParam);
    } else {
      showTab('berandaTab');
    }
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
  if (isKasirOnly && ['berandaTab', 'pengeluaranTab', 'barangTab', 'laporanTab', 'panduanTab', 'profilTab'].includes(tabId)) {
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
    if(!document.getElementById('kasbonEditIndex').value) {
      document.getElementById('kasbonTgl').value = new Date().toISOString().split('T')[0];
    }
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
    const sisa = totalBelanja - sudahDibayar;

    html += `<div class="notif-item" onclick="navigateToKasbon(${origIdx})">
      <div>📑 Piutang: <b>${k.nama}</b><br><small style="color: #dc2626; font-weight: 600;">Belum Lunas (Sisa: Rp ${formatNumber(sisa)})</small></div>
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
      const detailRow = document.getElementById(`kasbonDetailRow_${idx}`);
      const btn = document.getElementById(`btnDetailKasbon_${idx}`);
      if(detailRow && detailRow.classList.contains('hidden')) {
        detailRow.classList.remove('hidden');
        if(btn) btn.innerText = '❌ Tutup';
      }
    }
  }, 150);
}

function updateNotifications() {
  const notifList = document.getElementById('notifListContainer');
  const notifCountBadge = document.getElementById('notifCount');
  if(!notifList || !notifCountBadge) return;

  let warnings = [];
  const today = new Date();
  today.setHours(0,0,0,0);

  barangList.forEach((b, idx) => {
    const batasMinimal = parseInt(b.minStok) || 3;
    if(b.stok < batasMinimal) {
      warnings.push({
        type: 'stok',
        text: `Stok menipis: <b>${b.nama}</b> tersisa ${b.stok} ${b.satuan}`,
        index: idx
      });
    }
    if(b.expired) {
      const expDate = new Date(b.expired);
      expDate.setHours(0,0,0,0);
      const diffDays = Math.ceil((expDate - today) / (1000 * 60 * 60 * 24));
      const batasHariExp = parseInt(b.minExpDays) || 15;
      if(diffDays <= batasHariExp) {
        const formattedExp = formatDateID(b.expired);
        let msg = diffDays < 0 ? `Sudah kadaluarsa (${formattedExp})` : `Kadaluarsa dalam ${diffDays} hari (${formattedExp})`;
        warnings.push({
          type: 'expired',
          text: `Masa aktif habis: <b>${b.nama}</b> - ${msg}`,
          index: idx
        });
      }
    }
  });

  notifCountBadge.innerText = warnings.length;
  if(warnings.length === 0) {
    notifList.innerHTML = `<div style="font-size:0.8rem; color:#64748b;">Tidak ada peringatan.</div>`;
    return;
  }

  let html = '';
  warnings.forEach(w => {
    let icon = w.type === 'stok' ? '⚠️ [Stok]' : '⏰ [Exp]';
    html += `<div class="notif-item" onclick="navigateToBarang(${w.index})">${icon} ${w.text}</div>`;
  });
  notifList.innerHTML = html;
}

function toggleNotifDropdown() {
  const dropdown = document.getElementById('notifDropdown');
  const otherDropdown = document.getElementById('kasbonNotifDropdown');
  if(otherDropdown) otherDropdown.classList.add('hidden');
  if(dropdown) dropdown.classList.toggle('hidden');
}

function navigateToBarang(idx) {
  toggleNotifDropdown();
  showTab('barangTab');
  setTimeout(() => {
    const row = document.getElementById(`barangRow_${idx}`);
    if(row) {
      row.scrollIntoView({ behavior: 'smooth', block: 'center' });
      row.classList.add('highlight-row-yellow');
      setTimeout(() => row.classList.remove('highlight-row-yellow'), 3000);
    }
  }, 150);
}

// DATA PENGELUARAN & SINKRONISASI
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
  populateBarangDatalist();
  updateFinancialSummary();
  resetPengeluaranForm();
  alert("Data pengeluaran disimpan & tersinkron otomatis ke Data Barang dan Kasir!");
}

function renderPengeluaranTable() {
  const tbody = document.getElementById('pengeluaranTbody');
  if(!tbody) return;
  tbody.innerHTML = "";
  
  const selectAllCb = document.getElementById('selectAllPengeluaranCheckbox');
  if(selectAllCb) selectAllCb.checked = false;

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
        <td style="text-align: center;">
          <input type="checkbox" class="pengeluaran-checkbox" value="${origIdx}" style="width: 16px; height: 16px; cursor: pointer;">
        </td>
        <td>${idx + 1}</td>
        <td>${formatDateID(p.tanggal)}</td>
        <td><b>${p.keterangan}</b></td>
        <td>Rp ${formatNumber(p.modal)}</td>
        <td>Rp ${formatNumber(p.jual)}</td>
        <td style="text-align: center;">
          <div class="barcode-clickable" onclick="bukaLightboxBarcode('${safeCode}', '${safeName}')" title="Klik untuk memperbesar barcode">
            <svg id="${svgId}" class="table-barcode-svg"></svg>
          </div>
        </td>
        <td>
          <button class="btn btn-primary btn-sm" onclick="editPengeluaran(${origIdx})">Edit</button>
          <button class="btn btn-danger btn-sm" onclick="deletePengeluaran(${origIdx})">Hapus</button>
        </td>
      </tr>
    `;
    setTimeout(() => {
      try { JsBarcode(`#${svgId}`, p.barcode, { format: "CODE128", width: 2, height: 50, displayValue: true, fontSize: 14 }); } catch(err){}
    }, 50);
  });
}

function hapusPengeluaranTerpilih() {
  const selected = document.querySelectorAll('.pengeluaran-checkbox:checked');
  if(selected.length === 0) return alert("Pilih minimal satu data pengeluaran!");
  if(confirm(`Yakin ingin menghapus ${selected.length} data pengeluaran terpilih?`)) {
    const indices = Array.from(selected).map(cb => parseInt(cb.value)).sort((a,b) => b-a);
    indices.forEach(idx => { pengeluaranList.splice(idx, 1); });
    saveDataToStorage();
    renderPengeluaranTable();
    populateBarangDatalist();
    updateFinancialSummary();
  }
}

function editPengeluaran(idx) {
  const card = document.getElementById('pengeluaranFormCard');
  if(card.classList.contains('collapsed')) toggleForm('pengeluaranFormCard', 'pengeluaranToggleIcon');
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
    populateBarangDatalist();
    updateFinancialSummary();
  }
}

function resetPengeluaranForm() {
  document.getElementById('pengeluaranForm').reset();
  document.getElementById('pengeluaranEditIndex').value = "";
  document.getElementById('liveBarcodeSvg').innerHTML = "";
  toggleForm('pengeluaranFormCard', 'pengeluaranToggleIcon');
}

// DATA BARANG & QR
function toggleSelectAllBarang(source) {
  document.querySelectorAll('.barang-checkbox').forEach(cb => { cb.checked = source.checked; });
}

function saveBarang(e) {
  e.preventDefault();
  const idx = document.getElementById('barangEditIndex').value;
  const barcodeVal = document.getElementById('barKode').value.trim();
  
  if(!barcodeVal) return alert("Barcode wajib terisi otomatis dari data pengeluaran.");

  const barang = {
    kode: barcodeVal,
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
  populateLaporanBarangSelect();
  updateDashboardStats();
  updateFinancialSummary();
  resetBarangForm();
  alert("Data barang berhasil disimpan! Barcode tetap sama dan siap digunakan.");
}

function renderBarangTable() {
  const tbody = document.getElementById('barangTbody');
  if(!tbody) return;
  tbody.innerHTML = "";
  
  const selectAllCb = document.getElementById('selectAllBarangCheckbox');
  if(selectAllCb) selectAllCb.checked = false;

  const keyword = (document.getElementById('searchBarangInput')?.value || '').toLowerCase();
  const filtered = barangList.filter(b => b.nama.toLowerCase().includes(keyword) || b.kode.toLowerCase().includes(keyword));

  if(filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #777;">Belum ada data barang. Silakan input dari Data Pengeluaran terlebih dahulu.</td></tr>`;
    return;
  }

  const today = new Date();
  today.setHours(0,0,0,0);

  filtered.forEach((b, idx) => {
    const origIdx = barangList.indexOf(b);
    const formattedExpDate = formatDateID(b.expired);
    const svgIdBarang = `tableBarcode_bar_${origIdx}`;
    const safeName = b.nama.replace(/'/g, "\\'");
    const safeCode = b.kode.replace(/'/g, "\\'");
    const batasMinimal = parseInt(b.minStok) || 3;
    const batasHariExp = parseInt(b.minExpDays) || 15;
    
    let expBadge = formattedExpDate;
    if(b.expired) {
      const expDate = new Date(b.expired);
      expDate.setHours(0,0,0,0);
      const diffDays = Math.ceil((expDate - today) / (1000 * 60 * 60 * 24));
      if(diffDays <= batasHariExp) {
        let label = diffDays < 0 ? `Expired (${formattedExpDate})` : `${formattedExpDate} (⚠️ ${diffDays} hari)`;
        expBadge = `<span class="badge-expired">${label}</span>`;
      } else {
        expBadge = `<span class="badge-safe">${formattedExpDate}</span>`;
      }
    }

    let stokBadge = `<b>${b.stok}</b> ${b.satuan}`;
    if(b.stok < batasMinimal) {
      stokBadge = `<span class="badge-warning">${b.stok} ${b.satuan} (⚠️ Menipis)</span>`;
    }

    tbody.innerHTML += `
      <tr id="barangRow_${origIdx}">
        <td style="text-align: center;">
          <input type="checkbox" class="barang-checkbox" value="${origIdx}" style="width: 16px; height: 16px; cursor: pointer;">
        </td>
        <td>${idx + 1}</td>
        <td style="text-align: center;">
          <div class="barcode-clickable" onclick="bukaLightboxBarcode('${safeCode}', '${safeName}')" title="Klik untuk memperbesar barcode">
            <svg id="${svgIdBarang}" class="table-barcode-svg"></svg>
          </div>
          <div style="margin-top: 6px; display: flex; gap: 5px; justify-content: center; flex-wrap: wrap;">
            <button type="button" class="btn btn-success btn-sm" style="font-size: 0.74rem; padding: 3px 8px;" onclick="bukaModalQrKasir('${safeCode}', '${safeName}')" title="Unduh QR untuk scan Google Lens / HP langsung ke Kasir">📱 QR Langsung Kasir</button>
            <button type="button" class="btn btn-secondary btn-sm" style="font-size: 0.74rem; padding: 3px 8px;" onclick="downloadBarangBarcodePNG(${origIdx})">📥 Barcode PNG</button>
            <button type="button" class="btn btn-primary btn-sm" style="font-size: 0.74rem; padding: 3px 8px;" onclick="salinNomorBarcode('${safeCode}')">📋 Salin</button>
          </div>
        </td>
        <td><b>${b.nama}</b><br><small style="color:#16a34a; font-weight:600;">Jual: Rp ${formatNumber(b.jual)}</small></td>
        <td>${stokBadge}</td>
        <td>
          <button class="btn btn-primary btn-sm" onclick="toggleDetailBarang(${origIdx})" id="btnDetail_${origIdx}">🔍 Detail</button>
        </td>
      </tr>
      <tr id="barangDetailRow_${origIdx}" class="hidden">
        <td colspan="6" style="padding: 0; background-color: #f8fafc;">
          <div style="padding: 15px 20px; border-left: 4px solid #4f46e5; background: #ffffff; margin: 10px; border-radius: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
            <div style="display: flex; flex-wrap: wrap; gap: 20px; font-size: 0.9rem; margin-bottom: 15px; align-items: center;">
              <div><b>Stok:</b> ${stokBadge} (Min: ${batasMinimal})</div>
              <div><b>Satuan:</b> ${b.satuan}</div>
              <div><b>Kadaluarsa:</b> ${expBadge}</div>
              <div><b>Harga Modal:</b> Rp ${formatNumber(b.modal)}</div>
              <div><b>Harga Jual:</b> Rp ${formatNumber(b.jual)}</div>
              <div><b>Kode Barcode Permanen:</b> <code>${b.kode}</code></div>
            </div>
            <div style="display: flex; gap: 8px; flex-wrap: wrap;">
              <button class="btn btn-success btn-sm" onclick="editBarangKeKasir(${origIdx})">🛒 Beli (Transaksi Kasir)</button>
              <button class="btn btn-primary btn-sm" onclick="editBarang(${origIdx})">✏️ Edit Data</button>
              <button class="btn btn-danger btn-sm" onclick="deleteBarang(${origIdx})">🗑️ Hapus</button>
            </div>
          </div>
        </td>
      </tr>
    `;
    setTimeout(() => {
      try { JsBarcode(`#${svgIdBarang}`, b.kode, { format: "CODE128", width: 2, height: 50, displayValue: true, fontSize: 14 }); } catch(err){}
    }, 50);
  });
}

function bukaModalQrMasterBarang() {
  const storeId = tokoProfile.storeId || "aplikasi-kasir-utama";
  const baseUrl = window.location.origin + window.location.pathname;

  const compactItems = barangList.map(b => ({
    k: b.kode,
    n: b.nama,
    s: b.stok,
    u: b.satuan,
    m: b.modal,
    j: b.jual
  }));
  const encodedItems = encodeDataToUrlParam(compactItems);
  const encodedTrx = encodeDataToUrlParam(transaksiList);
  const encodedKasbon = encodeDataToUrlParam(kasbonList);

  const masterUrl = `${baseUrl}?store=${encodeURIComponent(storeId)}&mode=all&toko=${encodeURIComponent(tokoProfile.nama || 'TOKO SEMBAKO')}&items=${encodeURIComponent(encodedItems)}&transactions=${encodeURIComponent(encodedTrx)}&kasbon=${encodeURIComponent(encodedKasbon)}`;

  document.getElementById('qrMasterModalTitle').innerText = tokoProfile.nama || "Aplikasi Kasir";
  document.getElementById('qrMasterItemCount').innerText = ""; 
  document.getElementById('qrMasterUrlInput').value = masterUrl;

  const container = document.getElementById('qrMasterCanvasContainer');
  container.innerHTML = "";

  if (typeof QRCode !== "undefined") {
    new QRCode(container, {
      text: masterUrl,
      width: 230,
      height: 230,
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
  exportCanvas.width = 320;
  exportCanvas.height = 360;
  const ctx = exportCanvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 15px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText((tokoProfile.nama || "APLIKASI KASIR").substring(0, 30), 160, 28);

  if (canvas) {
    ctx.drawImage(canvas, 45, 50, 230, 230);
  } else if (img) {
    ctx.drawImage(img, 45, 50, 230, 230);
  }

  ctx.fillStyle = '#16a34a';
  ctx.font = 'bold 11px sans-serif';
  ctx.fillText('QR Kasir & Sinkron Barang HP', 160, 302);
  ctx.fillStyle = '#64748b';
  ctx.font = '10px sans-serif';
  ctx.fillText('Scan untuk Buka Kasir & Data Barang', 160, 322);

  const link = document.createElement('a');
  link.download = `QR_Kasir_Saja_${(tokoProfile.nama || 'Toko').replace(/\s+/g, '_')}.png`;
  link.href = exportCanvas.toDataURL('image/png');
  link.click();
}

function bukaModalQrKasir(kode, nama = "") {
  if (!kode) return;
  const barang = barangList.find(b => b.kode === kode);
  const namaTampil = nama || (barang ? barang.nama : kode);
  const storeId = tokoProfile.storeId || "aplikasi-kasir-utama";

  currentQrModalKode = kode;
  currentQrModalNama = namaTampil;

  const baseUrl = window.location.origin + window.location.pathname;
  let itemParamStr = "";
  if (barang) {
    const compactSingle = {
      k: barang.kode,
      n: barang.nama,
      s: barang.stok,
      u: barang.satuan,
      m: barang.modal,
      j: barang.jual
    };
    itemParamStr = `&item=${encodeURIComponent(encodeDataToUrlParam(compactSingle))}`;
  }

  const directKasirUrl = `${baseUrl}?store=${encodeURIComponent(storeId)}&toko=${encodeURIComponent(tokoProfile.nama || 'TOKO SEMBAKO')}&scan=${encodeURIComponent(kode)}${itemParamStr}`;

  document.getElementById('qrModalItemTitle').innerText = namaTampil;
  document.getElementById('qrModalItemCode').innerText = `Kode Barcode Permanen: ${kode}`;

  const container = document.getElementById('qrModalCanvasContainer');
  container.innerHTML = "";

  if (typeof QRCode !== "undefined") {
    new QRCode(container, {
      text: directKasirUrl,
      width: 220,
      height: 220,
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
  exportCanvas.width = 290;
  exportCanvas.height = 340;
  const ctx = exportCanvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 14px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(currentQrModalNama.substring(0, 28), 145, 26);

  if (canvas) {
    ctx.drawImage(canvas, 35, 42, 220, 220);
  } else if (img) {
    ctx.drawImage(img, 35, 42, 220, 220);
  }

  ctx.fillStyle = '#475569';
  ctx.font = '12px monospace';
  ctx.fillText(`Kode: ${currentQrModalKode}`, 145, 285);
  ctx.font = '10px sans-serif';
  ctx.fillText('Scan HP / Google Lens -> Transaksi Kasir', 145, 308);

  const link = document.createElement('a');
  link.download = `QR_Kasir_${currentQrModalNama.replace(/\s+/g, '_')}_${currentQrModalKode}.png`;
  link.href = exportCanvas.toDataURL('image/png');
  link.click();
}

function bukaLightboxBarcode(code, title = "Barcode Barang") {
  if (!code || code.trim() === "") return;
  currentLightboxBarcode = code.trim();
  currentLightboxTitle = title;

  let modalOverlay = document.getElementById('barcodeLightboxModal');
  if(!modalOverlay) {
    modalOverlay = document.createElement('div');
    modalOverlay.id = 'barcodeLightboxModal';
    modalOverlay.className = 'lightbox-overlay hidden';
    modalOverlay.setAttribute('onclick', 'if(event.target.id==="barcodeLightboxModal") tutupLightboxBarcode()');
    modalOverlay.innerHTML = `
      <div class="lightbox-container" onclick="event.stopPropagation()">
        <div class="lightbox-header">
          <div>
            <h3 id="lightboxItemTitle" style="font-size:1.1rem; color:#0f172a;">Nama Barang</h3>
            <span id="lightboxItemSubtitle" style="font-size:0.85rem; color:#64748b;">Kode Barcode: -</span>
          </div>
          <button type="button" style="background:none; border:none; font-size:1.5rem; cursor:pointer;" onclick="tutupLightboxBarcode()">×</button>
        </div>
        <div class="lightbox-stage">
          <svg id="lightboxBarcodeSvg"></svg>
        </div>
        <div class="lightbox-footer">
          <div style="display: flex; gap: 8px; flex-wrap: wrap;">
            <button type="button" class="btn btn-primary btn-sm" onclick="salinKodeDariLightbox()">📋 Salin Kode</button>
            <button type="button" class="btn btn-success btn-sm" onclick="unduhPngDariLightbox()">📥 Unduh PNG</button>
          </div>
          <button type="button" class="btn btn-secondary btn-sm" onclick="tutupLightboxBarcode()">Tutup</button>
        </div>
      </div>
    `;
    document.body.appendChild(modalOverlay);
  }

  document.getElementById('lightboxItemTitle').innerText = title;
  document.getElementById('lightboxItemSubtitle').innerText = `Kode Barcode Permanen: ${currentLightboxBarcode}`;
  modalOverlay.classList.remove('hidden');

  setTimeout(() => {
    try {
      JsBarcode("#lightboxBarcodeSvg", currentLightboxBarcode, {
        format: "CODE128", lineColor: "#000000", width: 3, height: 110, displayValue: true, fontSize: 18, margin: 15
      });
    } catch (e) {}
  }, 30);
}

function tutupLightboxBarcode() {
  const modal = document.getElementById('barcodeLightboxModal');
  if(modal) modal.classList.add('hidden');
}

function salinKodeDariLightbox() {
  navigator.clipboard.writeText(currentLightboxBarcode).then(() => alert(`Kode "${currentLightboxBarcode}" disalin!`));
}

function unduhPngDariLightbox() {
  const svg = document.getElementById('lightboxBarcodeSvg');
  if(!svg) return;
  const svgData = new XMLSerializer().serializeToString(svg);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  const img = new Image();
  img.onload = function() {
    canvas.width = img.width + 60; canvas.height = img.height + 60;
    ctx.fillStyle = "#FFFFFF"; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 30, 30);
    const link = document.createElement("a");
    link.download = `Barcode-${currentLightboxTitle.replace(/\s+/g, '_')}-${currentLightboxBarcode}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };
  img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
}

function hapusBarangTerpilih() {
  const selected = document.querySelectorAll('.barang-checkbox:checked');
  if(selected.length === 0) return alert("Pilih minimal satu barang!");
  if(confirm(`Hapus ${selected.length} barang terpilih?`)) {
    const indices = Array.from(selected).map(cb => parseInt(cb.value)).sort((a,b) => b-a);
    indices.forEach(idx => { barangList.splice(idx, 1); });
    saveDataToStorage();
    renderBarangTable();
    populateLaporanBarangSelect();
    updateDashboardStats();
    updateFinancialSummary();
  }
}

function toggleDetailBarang(idx) {
  const detailRow = document.getElementById(`barangDetailRow_${idx}`);
  const btn = document.getElementById(`btnDetail_${idx}`);
  if(detailRow.classList.contains('hidden')) {
    detailRow.classList.remove('hidden');
    btn.innerText = '❌ Tutup';
  } else {
    detailRow.classList.add('hidden');
    btn.innerText = '🔍 Detail';
  }
}

function downloadBarangBarcodePNG(idx) {
  const barang = barangList[idx];
  if(!barang) return;
  const svgEl = document.getElementById(`tableBarcode_bar_${idx}`);
  if(!svgEl) return;

  const xml = new XMLSerializer().serializeToString(svgEl);
  const svgBlob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);
  
  const img = new Image();
  img.onload = function() {
    const canvas = document.createElement('canvas');
    canvas.width = img.width || 300; canvas.height = img.height || 100;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);
    const a = document.createElement('a');
    a.download = `barcode_${barang.nama}_${barang.kode}.png`;
    a.href = canvas.toDataURL('image/png');
    document.body.appendChild(a); a.click(); a.remove();
  };
  img.src = url;
}

function editBarangKeKasir(idx) {
  showTab('kasirTab');
  setTimeout(() => {
    const b = barangList[idx];
    document.getElementById('kasirBarangInput').value = `${b.nama} (Stok: ${b.stok} ${b.satuan}) - Rp ${formatNumber(b.jual)}`;
    document.getElementById('selectedKasirBarangIndex').value = idx;
    onKasirBarangChange(idx);
  }, 100);
}

function editBarang(idx) {
  const card = document.getElementById('barangFormCard');
  if(card.classList.contains('collapsed')) toggleForm('barangFormCard', 'barangToggleIcon');
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
    populateLaporanBarangSelect();
    updateDashboardStats();
    updateFinancialSummary();
  }
}

function resetBarangForm() {
  document.getElementById('barangForm').reset();
  document.getElementById('barangEditIndex').value = "";
  toggleForm('barangFormCard', 'barangToggleIcon');
}

// TRANSAKSI KASIR
function onKetikCariBarang() {
  const rawInput = document.getElementById('kasirBarangInput').value.trim();
  const keyword = rawInput.toLowerCase();
  const dropdown = document.getElementById('autocompleteDropdown');

  if(keyword === "") {
    dropdown.innerHTML = "";
    dropdown.classList.add('hidden');
    document.getElementById('selectedKasirBarangIndex').value = "";
    onKasirBarangChange("");
    return;
  }

  let extractedCode = keyword;
  if (keyword.includes('scan=')) {
    try {
      const urlObj = new URL(rawInput);
      const s = urlObj.searchParams.get('scan');
      if (s) extractedCode = s.toLowerCase();
    } catch(e) {}
  }

  const exactIdx = barangList.findIndex(b => b.kode.toLowerCase() === extractedCode);
  if (exactIdx !== -1 && rawInput.length >= 2) {
    pilihItemAutocomplete(exactIdx);
    return;
  }

  const filtered = barangList.map((b, idx) => ({ ...b, originalIndex: idx })).filter(b => 
    b.nama.toLowerCase().includes(extractedCode) || b.kode.toLowerCase().includes(extractedCode)
  );

  if(filtered.length === 0) {
    dropdown.innerHTML = `<div class="autocomplete-item" style="color: #94a3b8; cursor: default;">Barang tidak ditemukan di Data Barang</div>`;
    dropdown.classList.remove('hidden');
    return;
  }

  let html = "";
  filtered.forEach(item => {
    html += `<div class="autocomplete-item" onclick="pilihItemAutocomplete(${item.originalIndex})">
      <b>${item.nama}</b> (Stok: ${item.stok} ${item.satuan}) - Rp ${formatNumber(item.jual)} [Kode: ${item.kode}]
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
  onKasirBarangChange(idx);
}

function onKasirBarangChange(idx) {
  const previewArea = document.getElementById('kasirBarcodePreviewArea');
  const placeholder = document.getElementById('kasirBarcodePlaceholder');
  const detectedBox = document.getElementById('kasirDetectedItemBox');

  if(idx !== "" && idx !== undefined && barangList[idx]) {
    const barang = barangList[idx];
    currentSelectedKasirBarcode = barang.kode;
    if(previewArea) previewArea.classList.remove('hidden');
    if(placeholder) placeholder.classList.add('hidden');
    
    if (detectedBox) {
      detectedBox.classList.remove('hidden');
      document.getElementById('kasirDetectedNama').innerText = barang.nama;
      document.getElementById('kasirDetectedHarga').innerText = `Rp ${formatNumber(barang.jual)}`;
      document.getElementById('kasirDetectedStok').innerText = `${barang.stok} ${barang.satuan}`;
      document.getElementById('kasirDetectedKode').innerText = barang.kode;
    }

    try { JsBarcode("#kasirBarcodeSvg", barang.kode, { format: "CODE128", width: 2, height: 60, displayValue: true, fontSize: 14 }); } catch(e){}
  } else {
    currentSelectedKasirBarcode = "";
    if(previewArea) previewArea.classList.add('hidden');
    if(placeholder) placeholder.classList.remove('hidden');
    if (detectedBox) detectedBox.classList.add('hidden');
  }
}

function downloadKasirBarcodePNG() {
  if(!currentSelectedKasirBarcode) return;
  const svgEl = document.getElementById('kasirBarcodeSvg');
  if(!svgEl) return;
  const xml = new XMLSerializer().serializeToString(svgEl);
  const svgBlob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);
  
  const img = new Image();
  img.onload = function() {
    const canvas = document.createElement('canvas');
    canvas.width = img.width || 300; canvas.height = img.height || 100;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);
    const a = document.createElement('a');
    a.download = `barcode_${currentSelectedKasirBarcode}.png`;
    a.href = canvas.toDataURL('image/png');
    document.body.appendChild(a); a.click(); a.remove();
  };
  img.src = url;
}

function tambahItemKeranjang() {
  const idx = document.getElementById('selectedKasirBarangIndex').value;
  const qty = parseInt(document.getElementById('kasirQty').value) || 0;
  if(idx === "" || idx === undefined || qty <= 0 || !barangList[idx]) {
    alert("Pilih barang dari Data Barang dan masukkan jumlah yang valid!");
    return;
  }

  const barang = barangList[idx];
  const editIdx = document.getElementById('transaksiEditIndex').value;
  let stokAsli = barang.stok;
  if (editIdx !== "") {
    const oldTrx = transaksiList[editIdx];
    if (oldTrx && oldTrx.items) {
      const matchedOldItem = oldTrx.items.find(i => i.kode === barang.kode);
      if (matchedOldItem) stokAsli += matchedOldItem.qty;
    }
  }

  const existing = keranjangList.find(k => k.kode === barang.kode);
  let currentQtyInCart = existing ? existing.qty : 0;

  if(currentQtyInCart + qty > stokAsli) { 
    alert(`Stok fisik "${barang.nama}" tidak mencukupi! (Sisa stok: ${stokAsli} ${barang.satuan})`); 
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
  const previewArea = document.getElementById('kasirBarcodePreviewArea');
  const placeholder = document.getElementById('kasirBarcodePlaceholder');
  if(previewArea) previewArea.classList.add('hidden');
  if(placeholder) placeholder.classList.remove('hidden');
  const detectedBox = document.getElementById('kasirDetectedItemBox');
  if (detectedBox) detectedBox.classList.add('hidden');
  currentSelectedKasirBarcode = "";
}

function renderKeranjang() {
  const tbody = document.getElementById('keranjangTbody');
  if(!tbody) return;
  tbody.innerHTML = "";
  let total = 0;

  if(keranjangList.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #777;">Keranjang belanja kosong.</td></tr>`;
    if(document.getElementById('kasirTotalDisplay')) document.getElementById('kasirTotalDisplay').innerText = `Rp 0`;
    hitungKembalian();
    return;
  }

  const isEditing = document.getElementById('transaksiEditIndex').value !== "";

  keranjangList.forEach((item, idx) => {
    total += item.subtotal;
    const svgId = `keranjangBarcode_${idx}`;
    const editBadgeLabel = isEditing ? `<span class="badge-edit-mode">Mode Edit</span>` : '';

    tbody.innerHTML += `
      <tr>
        <td>${idx + 1}</td>
        <td><b>${item.nama}</b> ${editBadgeLabel}</td>
        <td><svg id="${svgId}" class="table-barcode-svg"></svg></td>
        <td>Rp ${formatNumber(item.hargaJual)}</td>
        <td>
          <input type="number" class="form-control" style="width: 80px; padding: 4px 8px;" value="${item.qty}" min="1" 
            oninput="updateQtyKeranjang(${idx}, this.value)">
        </td>
        <td><b>Rp ${formatNumber(item.subtotal)}</b></td>
        <td><button class="btn btn-danger btn-sm" onclick="hapusItemKeranjang(${idx})">Hapus</button></td>
      </tr>
    `;
    setTimeout(() => {
      try { JsBarcode(`#${svgId}`, item.kode, { format: "CODE128", width: 1.5, height: 40, displayValue: true, fontSize: 12 }); } catch(err){}
    }, 50);
  });

  if(document.getElementById('kasirTotalDisplay')) {
    document.getElementById('kasirTotalDisplay').innerText = `Rp ${formatNumber(total)}`;
  }
  hitungKembalian();
}

function updateQtyKeranjang(idx, value) {
  const newQty = parseInt(value) || 0;
  if(newQty <= 0) return;
  const item = keranjangList[idx];
  const barang = barangList.find(b => b.kode === item.kode);
  
  const editIdx = document.getElementById('transaksiEditIndex').value;
  let stokAsli = barang ? barang.stok : 0;
  if (editIdx !== "") {
    const oldTrx = transaksiList[editIdx];
    if (oldTrx && oldTrx.items) {
      const matchedOldItem = oldTrx.items.find(i => i.kode === item.kode);
      if (matchedOldItem) stokAsli += matchedOldItem.qty;
    }
  }

  if(barang && newQty > stokAsli) { 
    alert("Stok fisik tidak mencukupi!"); 
    renderKeranjang(); 
    return; 
  }
  item.qty = newQty;
  item.subtotal = item.qty * item.hargaJual;
  renderKeranjang();
}

function hapusItemKeranjang(idx) {
  keranjangList.splice(idx, 1);
  renderKeranjang();
}

function hitungKembalian() {
  let total = keranjangList.reduce((sum, item) => sum + item.subtotal, 0);
  let bayarInput = document.getElementById('kasirBayar').value;
  let bayar = parseFloat(bayarInput) || 0;

  if (bayar > 0 && bayar < total && bayarInput.length <= 2) {
    if ((bayar * 1000) >= total) bayar = bayar * 1000;
  }

  let kembalian = bayar - total;
  const kembalianDisplay = document.getElementById('kasirKembalianDisplay');
  if(kembalianDisplay) kembalianDisplay.innerText = kembalian >= 0 ? `Rp ${formatNumber(kembalian)}` : `Rp 0`;
}

function prosesPembayaran() {
  if(keranjangList.length === 0) { alert("Keranjang belanja masih kosong!"); return; }
  
  let total = keranjangList.reduce((sum, item) => sum + item.subtotal, 0);
  const namaKasbonInput = document.getElementById('kasirNamaKasbon').value.trim();
  const isKasbon = namaKasbonInput !== "";

  let bayarInput = document.getElementById('kasirBayar').value;
  let bayar = parseFloat(bayarInput) || 0;
  
  if (bayar > 0 && bayar < total && bayarInput.length <= 2) {
    if ((bayar * 1000) >= total) bayar = bayar * 1000;
  }

  if(!isKasbon && bayar < total) { 
    alert("Jumlah tunai dibayar kurang! (Atau isi Nama Kasbon jika pelanggan berhutang)"); 
    return; 
  }

  const editIdx = document.getElementById('transaksiEditIndex').value;

  if (editIdx !== "") {
    const oldTrx = transaksiList[editIdx];
    if (oldTrx && oldTrx.items && Array.isArray(oldTrx.items)) {
      oldTrx.items.forEach(oldItem => {
        const b = barangList.find(x => x.kode === oldItem.kode);
        if (b) b.stok += oldItem.qty;
      });
    }
  }

  keranjangList.forEach(item => {
    const b = barangList.find(x => x.kode === item.kode);
    if(b) {
      b.stok -= item.qty;
      if(b.stok < 0) b.stok = 0;
    }
  });

  let trxId = '';
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  let tanggalRaw = `${yyyy}-${mm}-${dd}`;
  let tanggalStr = now.toLocaleString('id-ID');

  let existingItemsStatus = [];
  if(editIdx !== "") {
    trxId = transaksiList[editIdx].id;
    tanggalRaw = transaksiList[editIdx].tanggalRaw || tanggalRaw;
    tanggalStr = transaksiList[editIdx].tanggal;
    if (transaksiList[editIdx].items) existingItemsStatus = transaksiList[editIdx].items;
    transaksiList.splice(editIdx, 1);
  } else {
    trxId = 'TRX-' + Date.now();
  }

  const itemsWithLunas = keranjangList.map((item, idx) => {
    let isLunas = !isKasbon;
    if (isKasbon && existingItemsStatus[idx] && existingItemsStatus[idx].kode === item.kode) {
      isLunas = existingItemsStatus[idx].isLunasItem || false;
    }
    return { ...item, isLunasItem: isLunas };
  });

  const allItemsLunas = itemsWithLunas.every(i => i.isLunasItem);

  const transaksi = {
    id: trxId,
    tanggalRaw,
    tanggal: tanggalStr,
    namaKasbon: namaKasbonInput,
    items: itemsWithLunas,
    total,
    bayar: isKasbon ? bayar : bayar,
    kembalian: isKasbon ? Math.max(0, bayar - total) : (bayar - total),
    isLunasKasbon: allItemsLunas
  };

  transaksiList.push(transaksi);

  if (isKasbon) {
    const existingKasbon = kasbonList.find(k => k.nama.toLowerCase() === namaKasbonInput.toLowerCase());
    if (!existingKasbon) {
      kasbonList.push({
        tanggal: tanggalRaw,
        nama: namaKasbonInput,
        telp: '',
        alamat: '',
        status: 'Belum Lunas'
      });
    } else {
      existingKasbon.status = 'Belum Lunas';
    }
  }

  saveDataToStorage();
  renderBarangTable();
  renderRiwayatTransaksi();
  renderKasbonTable();
  populateKasbonDatalist();
  resetKasirForm();
  updateDashboardStats();
  updateFinancialSummary();
  updateNotifications();
  updateKasbonNotifications();

  if (window.location.search.includes('scan=')) {
    const cleanUrl = window.location.origin + window.location.pathname;
    window.history.replaceState({}, document.title, cleanUrl);
  }

  if (isKasbon) {
    alert(`Transaksi Kasbon atas nama "${namaKasbonInput}" tercatat! Stok barang otomatis dikurangi.`);
    arahkanSetelahTransaksi(namaKasbonInput);
  } else {
    alert("Transaksi Tunai berhasil! Stok barang otomatis dikurangi.");
    showTab('transaksiTab');
  }
}

function arahkanSetelahTransaksi(namaKasbon) {
  const cleanKasbon = namaKasbon ? namaKasbon.trim() : "";
  if (cleanKasbon !== "") {
    let kasbonIdx = kasbonList.findIndex(k => k.nama.toLowerCase() === cleanKasbon.toLowerCase());
    showTab('kasbonTab');

    setTimeout(() => {
      if (kasbonIdx !== -1) {
        const row = document.getElementById(`kasbonRow_${kasbonIdx}`);
        if(row) {
          row.scrollIntoView({ behavior: 'smooth', block: 'center' });
          document.querySelectorAll('.highlight-row-yellow').forEach(el => el.classList.remove('highlight-row-yellow'));
          row.classList.add('highlight-row-yellow');
          setTimeout(() => row.classList.remove('highlight-row-yellow'), 5000);

          const detailRow = document.getElementById(`kasbonDetailRow_${kasbonIdx}`);
          const btn = document.getElementById(`btnDetailKasbon_${kasbonIdx}`);
          if(detailRow && detailRow.classList.contains('hidden')) {
            detailRow.classList.remove('hidden');
            if(btn) btn.innerText = '❌ Tutup';
          }
        }
      }
    }, 150);
  } else {
    showTab('transaksiTab');
  }
}

function resetKasirForm() {
  keranjangList = [];
  document.getElementById('transaksiEditIndex').value = "";
  document.getElementById('kasirBarangInput').value = "";
  document.getElementById('selectedKasirBarangIndex').value = "";
  document.getElementById('kasirNamaKasbon').value = "";
  document.getElementById('kasirBayar').value = "";
  document.getElementById('kasirFormTitle').innerText = "🛒 Kasir Penjualan";
  document.getElementById('btnSimpanTransaksi').innerText = "✅ Selesaikan Transaksi";
  const previewArea = document.getElementById('kasirBarcodePreviewArea');
  const placeholder = document.getElementById('kasirBarcodePlaceholder');
  if(previewArea) previewArea.classList.add('hidden');
  if(placeholder) placeholder.classList.remove('hidden');
  const detectedBox = document.getElementById('kasirDetectedItemBox');
  if (detectedBox) detectedBox.classList.add('hidden');
  currentSelectedKasirBarcode = "";
  renderKeranjang();
}

// SCANNER KAMERA / UPLOAD
function speakSuccessMessage(namaBarang) {
  try {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(`Barang ditemukan, ${namaBarang}`);
      utterance.lang = 'id-ID';
      window.speechSynthesis.speak(utterance);
    }
  } catch(e) {}
}

function switchMode(mode) {
  const btnCamera = document.getElementById('btnTabCamera');
  const btnUpload = document.getElementById('btnTabUpload');
  const camSec = document.getElementById('cameraSection');
  const upSec = document.getElementById('uploadSection');

  if(mode === 'camera') {
    if(btnCamera) btnCamera.classList.add('active'); 
    if(btnUpload) btnUpload.classList.remove('active');
    if(camSec) camSec.classList.remove('hidden'); 
    if(upSec) upSec.classList.add('hidden');
    initScannerCamera();
  } else {
    if(btnUpload) btnUpload.classList.add('active'); 
    if(btnCamera) btnCamera.classList.remove('active');
    if(upSec) upSec.classList.remove('hidden'); 
    if(camSec) camSec.classList.add('hidden');
    if(html5QrCode) { try { html5QrCode.stop(); } catch(e){} }
  }
}

function initScannerCamera() {
  if(!document.getElementById('reader')) return;
  if(!html5QrCode) html5QrCode = new Html5Qrcode("reader");
  const config = { fps: 10, qrbox: { width: 250, height: 150 } };

  html5QrCode.start(
    { facingMode: "environment" }, 
    config, 
    (decodedText) => {
      const currentTime = Date.now();
      if (decodedText === lastScannedCode && (currentTime - lastScannedTime < 2500)) return;
      lastScannedCode = decodedText;
      lastScannedTime = currentTime;

      let codeToProcess = decodedText;
      if (decodedText.includes('scan=')) {
        try {
          const urlObj = new URL(decodedText);
          const s = urlObj.searchParams.get('scan');
          if (s) codeToProcess = s;
        } catch(e) {}
      }

      document.getElementById('scanResultCode').value = codeToProcess;
      cariProdukByBarcodeScanner(codeToProcess, true);
    },
    () => {}
  ).catch(() => {
    const statusEl = document.getElementById('scannerStatus');
    if(statusEl) statusEl.innerText = "Kamera tidak aktif / gunakan mode Unggah Gambar.";
  });
}

function scanImageFromFile(e) {
  const file = e.target.files[0];
  if(!file) return;

  const statusEl = document.getElementById('uploadStatus');
  if(statusEl) statusEl.innerText = "Membaca gambar barcode...";

  const qrScanner = new Html5Qrcode("reader");
  qrScanner.scanFile(file, true)
    .then(decodedText => {
      let codeToProcess = decodedText;
      if (decodedText.includes('scan=')) {
        try {
          const urlObj = new URL(decodedText);
          const s = urlObj.searchParams.get('scan');
          if (s) codeToProcess = s;
        } catch(e) {}
      }
      document.getElementById('scanResultCode').value = codeToProcess;
      if(statusEl) statusEl.innerText = `✅ Berhasil membaca barcode: ${codeToProcess}`;
      cariProdukByBarcodeScanner(codeToProcess, true);
    })
    .catch(() => {
      if(statusEl) statusEl.innerText = "❌ Gagal mendeteksi barcode dari gambar.";
    });
}

function cariProdukByBarcodeScanner(code, autoRedirectToKasir = false) {
  let cleanCode = code.trim();
  if (cleanCode.includes('scan=')) {
    try {
      const urlObj = new URL(cleanCode);
      const s = urlObj.searchParams.get('scan');
      if (s) cleanCode = s;
    } catch(e) {}
  }

  const lowerCode = cleanCode.toLowerCase();
  const infoCard = document.getElementById('productDetailInfo');
  const notFoundText = document.getElementById('productNotFound');

  if(!lowerCode) {
    if(infoCard) infoCard.classList.add('hidden');
    if(notFoundText) notFoundText.classList.add('hidden');
    selectedProdukAktif = null;
    return;
  }

  const foundIdx = barangList.findIndex(b => b.kode.toLowerCase() === lowerCode || b.nama.toLowerCase() === lowerCode);

  if(foundIdx !== -1) {
    const found = barangList[foundIdx];
    selectedProdukAktif = found;
    document.getElementById('infoNama').innerText = found.nama;
    document.getElementById('infoStok').innerText = `${found.stok} ${found.satuan}`;
    document.getElementById('infoHarga').innerText = `Rp ${formatNumber(found.jual)}`;
    document.getElementById('scanQty').value = 1;

    if(infoCard) infoCard.classList.remove('hidden');
    if(notFoundText) notFoundText.classList.add('hidden');

    if (autoRedirectToKasir) {
      kirimHasilScanKeKasir();
    }
  } else {
    selectedProdukAktif = null;
    if(infoCard) infoCard.classList.add('hidden');
    if(notFoundText) notFoundText.classList.remove('hidden');
  }
}

function kirimHasilScanKeKasir() {
  if(!selectedProdukAktif) return;
  const qty = parseInt(document.getElementById('scanQty').value) || 1;
  const idx = barangList.findIndex(b => b.kode === selectedProdukAktif.kode);

  if (idx !== -1) {
    showTab('kasirTab');
    setTimeout(() => {
      const b = barangList[idx];
      document.getElementById('kasirBarangInput').value = `${b.nama} (Stok: ${b.stok} ${b.satuan}) - Rp ${formatNumber(b.jual)}`;
      document.getElementById('selectedKasirBarangIndex').value = idx;
      document.getElementById('kasirQty').value = qty;
      onKasirBarangChange(idx);
      tambahItemKeranjang();
      speakSuccessMessage(b.nama);
    }, 100);
  }
  document.getElementById('scanResultCode').value = "";
  const infoCard = document.getElementById('productDetailInfo');
  if(infoCard) infoCard.classList.add('hidden');
  selectedProdukAktif = null;
}

// KASBON & TRANSAKSI
function toggleSelectAllKasbon(source) {
  document.querySelectorAll('.kasbon-checkbox').forEach(cb => { cb.checked = source.checked; });
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
  renderRiwayatTransaksi();
  populateKasbonDatalist();
  resetKasbonForm();
  alert("Data kasbon berhasil disimpan!");
}

function renderKasbonTable() {
  const tbody = document.getElementById('kasbonTbody');
  if(!tbody) return;
  tbody.innerHTML = "";
  
  const keyword = (document.getElementById('searchKasbonInput')?.value || '').toLowerCase();
  const filtered = kasbonList.filter(k => k.nama.toLowerCase().includes(keyword) || (k.telp && k.telp.toLowerCase().includes(keyword)));

  if(filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #777;">Belum ada data kasbon.</td></tr>`;
    return;
  }

  filtered.forEach((k, idx) => {
    const origIdx = kasbonList.indexOf(k);
    const transaksiKasbon = transaksiList.filter(t => t.namaKasbon && t.namaKasbon.toLowerCase() === k.nama.toLowerCase());
    const jumlahTrx = transaksiKasbon.length;
    let totalBelanjaKasbon = transaksiKasbon.reduce((sum, t) => sum + (parseFloat(t.total) || 0), 0);
    
    let sisaKurang = 0;
    transaksiKasbon.forEach(t => {
      if (t.items && Array.isArray(t.items)) {
        t.items.forEach(item => { if (!item.isLunasItem) sisaKurang += (parseFloat(item.subtotal) || 0); });
      } else if (!t.isLunasKasbon) {
        sisaKurang += (parseFloat(t.total) || 0);
      }
    });

    let statusBadge = '';
    if (jumlahTrx === 0) {
      statusBadge = `<span style="background: #f1f5f9; color: #64748b; padding: 3px 8px; border-radius: 4px; font-weight: 600; font-size: 0.85rem;">Tidak ada transaksi</span>`;
    } else if (sisaKurang === 0) {
      k.status = 'Lunas';
      statusBadge = `<span style="background: #dcfce7; color: #16a34a; padding: 3px 8px; border-radius: 4px; font-weight: 600; font-size: 0.85rem;">Lunas</span>`;
    } else {
      k.status = 'Belum Lunas';
      statusBadge = `<span style="background: #fee2e2; color: #dc2626; padding: 3px 8px; border-radius: 4px; font-weight: 600; font-size: 0.85rem;">Belum Lunas (Sisa: Rp ${formatNumber(sisaKurang)})</span>`;
    }

    let listTrxHtml = '<div style="margin-top: 10px; font-size: 0.85rem;"><b>Rincian Barang Kasbon (Centang jika sudah dibayar):</b><div style="margin-top: 8px; display: flex; flex-direction: column; gap: 8px;">';
    if(jumlahTrx > 0) {
      transaksiKasbon.forEach(t => {
        const globalTrxIdx = transaksiList.indexOf(t);
        if (t.items && Array.isArray(t.items)) {
          t.items.forEach((item, itemIdx) => {
            const isChecked = item.isLunasItem ? 'checked' : '';
            listTrxHtml += `<div style="background: #f8fafc; padding: 10px 12px; border-radius: 6px; border: 1px solid #e2e8f0; display: flex; align-items: center; gap: 10px;">
              <input type="checkbox" ${isChecked} onchange="toggleLunasItemKasbon(${globalTrxIdx}, ${itemIdx}, ${origIdx})" style="width: 18px; height: 18px; cursor: pointer;">
              <div>
                <div style="font-weight: 600; color: #1e293b;">[${t.tanggal}] ${item.nama} (${item.qty}x) - Rp ${formatNumber(item.subtotal)}</div>
                <div style="font-size: 0.75rem; color: #64748b;">Status: ${item.isLunasItem ? '<b style="color:#16a34a;">Lunas</b>' : '<b style="color:#dc2626;">Belum Lunas</b>'}</div>
              </div>
            </div>`;
          });
        }
      });
    }
    listTrxHtml += '</div></div>';

    tbody.innerHTML += `
      <tr id="kasbonRow_${origIdx}">
        <td style="text-align: center;"><input type="checkbox" class="kasbon-checkbox" value="${origIdx}" style="width: 16px; height: 16px; cursor: pointer;"></td>
        <td>${idx + 1}</td>
        <td>${formatDateID(k.tanggal)}</td>
        <td><b>${k.nama}</b></td>
        <td>${statusBadge}</td>
        <td>
          <button class="btn btn-primary btn-sm" onclick="toggleDetailKasbon(${origIdx})" id="btnDetailKasbon_${origIdx}">🔍 Detail</button>
          <button class="btn btn-primary btn-sm" onclick="editKasbon(${origIdx})">Edit</button>
          <button class="btn btn-danger btn-sm" onclick="deleteKasbon(${origIdx})">Hapus</button>
        </td>
      </tr>
      <tr id="kasbonDetailRow_${origIdx}" class="hidden">
        <td colspan="6" style="padding: 0; background-color: #f8fafc;">
          <div style="padding: 15px 20px; border-left: 4px solid #4f46e5; background: #ffffff; margin: 10px; border-radius: 6px;">
            <div style="display: flex; flex-wrap: wrap; gap: 20px; font-size: 0.9rem; border-bottom: 1px solid #e2e8f0; padding-bottom: 10px;">
              <div><b>No. Telp:</b> ${k.telp || '-'}</div>
              <div><b>Alamat:</b> ${k.alamat || '-'}</div>
              <div><b>Total Kasbon:</b> Rp ${formatNumber(totalBelanjaKasbon)}</div>
              <div><b>Sisa Piutang:</b> <span style="color: #dc2626; font-weight: bold;">Rp ${formatNumber(sisaKurang)}</span></div>
            </div>
            ${listTrxHtml}
          </div>
        </td>
      </tr>
    `;
  });
}

function toggleLunasItemKasbon(trxIndex, itemIndex, kasbonIdx) {
  if(transaksiList[trxIndex] && transaksiList[trxIndex].items && transaksiList[trxIndex].items[itemIndex]) {
    transaksiList[trxIndex].items[itemIndex].isLunasItem = !transaksiList[trxIndex].items[itemIndex].isLunasItem;
    transaksiList[trxIndex].isLunasKasbon = transaksiList[trxIndex].items.every(i => i.isLunasItem);

    saveDataToStorage();
    renderKasbonTable();
    renderRiwayatTransaksi();
    updateKasbonNotifications();
    
    const detailRow = document.getElementById(`kasbonDetailRow_${kasbonIdx}`);
    const btn = document.getElementById(`btnDetailKasbon_${kasbonIdx}`);
    if(detailRow && btn) {
      detailRow.classList.remove('hidden');
      btn.innerText = '❌ Tutup';
    }
  }
}

function toggleDetailKasbon(idx) {
  const detailRow = document.getElementById(`kasbonDetailRow_${idx}`);
  const btn = document.getElementById(`btnDetailKasbon_${idx}`);
  if(detailRow.classList.contains('hidden')) {
    detailRow.classList.remove('hidden');
    btn.innerText = '❌ Tutup';
  } else {
    detailRow.classList.add('hidden');
    btn.innerText = '🔍 Detail';
  }
}

function editKasbon(idx) {
  const k = kasbonList[idx];
  const formCard = document.getElementById('kasbonFormCard');
  if(formCard.classList.contains('collapsed')) toggleForm('kasbonFormCard', 'kasbonToggleIcon');
  document.getElementById('kasbonEditIndex').value = idx;
  document.getElementById('kasbonTgl').value = k.tanggal;
  document.getElementById('kasbonNama').value = k.nama;
  document.getElementById('kasbonTelp').value = k.telp;
  document.getElementById('kasbonAlamat').value = k.alamat;
  document.getElementById('btnSimpanKasbon').innerText = "🔄 Perbarui Kasbon";
  document.getElementById('btnBatalEditKasbon').classList.remove('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function deleteKasbon(idx) {
  const k = kasbonList[idx];
  if(!k) return;
  if(confirm(`Hapus data kasbon "${k.nama}"?`)) {
    const namaTarget = k.nama.toLowerCase();
    transaksiList = transaksiList.filter(t => !t.namaKasbon || t.namaKasbon.toLowerCase() !== namaTarget);
    kasbonList.splice(idx, 1);
    saveDataToStorage();
    renderKasbonTable();
    renderRiwayatTransaksi();
    updateKasbonNotifications();
  }
}

function hapusKasbonTerpilih() {
  const selected = document.querySelectorAll('.kasbon-checkbox:checked');
  if(selected.length === 0) return alert("Pilih minimal satu data kasbon!");
  if(confirm(`Hapus ${selected.length} data kasbon terpilih?`)) {
    const indices = Array.from(selected).map(cb => parseInt(cb.value)).sort((a,b) => b-a);
    indices.forEach(idx => { kasbonList.splice(idx, 1); });
    saveDataToStorage();
    renderKasbonTable();
    updateKasbonNotifications();
  }
}

function resetKasbonForm() {
  document.getElementById('kasbonForm').reset();
  document.getElementById('kasbonEditIndex').value = "";
  document.getElementById('btnSimpanKasbon').innerText = "✅ Simpan Kasbon";
  document.getElementById('btnBatalEditKasbon').classList.add('hidden');
}

function populateKasbonDatalist() {
  const datalist = document.getElementById('listKasbonNama');
  if(!datalist) return;
  datalist.innerHTML = '';
  kasbonList.forEach(k => { datalist.innerHTML += `<option value="${k.nama}">`; });
}

function toggleSelectAllTransaksi(source) {
  document.querySelectorAll('.trx-checkbox').forEach(cb => { cb.checked = source.checked; });
}

function filterTransaksiByDateRange() {
  const tglDari = document.getElementById('trxTglDari').value;
  const tglSampai = document.getElementById('trxTglSampai').value;
  const keyword = (document.getElementById('searchTransaksiKeyword')?.value || '').toLowerCase().trim();

  currentFilteredTransaksi = transaksiList.filter(t => {
    let tglTrx = t.tanggalRaw;
    let matchTanggal = true;
    if (tglDari && tglSampai) matchTanggal = tglTrx && tglTrx >= tglDari && tglTrx <= tglSampai;
    let matchKeyword = true;
    if (keyword) {
      const matchNamaBarang = t.items.some(i => i.nama.toLowerCase().includes(keyword));
      const matchKasbon = t.namaKasbon && t.namaKasbon.toLowerCase().includes(keyword);
      matchKeyword = matchNamaBarang || matchKasbon;
    }
    return matchTanggal && matchKeyword;
  });

  renderRiwayatTransaksiFiltered();
}

function resetFilterTransaksi() {
  document.getElementById('trxTglDari').value = '';
  document.getElementById('trxTglSampai').value = '';
  if(document.getElementById('searchTransaksiKeyword')) document.getElementById('searchTransaksiKeyword').value = '';
  renderRiwayatTransaksi();
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
    tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: #777;">Belum ada data transaksi penjualan.</td></tr>`;
    return;
  }

  let totalKeseluruhan = 0;
  currentFilteredTransaksi.forEach((t, idx) => {
    const originalIndex = transaksiList.indexOf(t);
    const namaBarangUtama = t.items.map((i, iIdx) => `${iIdx + 1}. ${i.nama} (${i.qty}x)`).join('<br>');
    
    let namaKasbonDisplay = '<span style="color:#64748b;">Tunai</span>';
    if (t.namaKasbon && t.namaKasbon.trim() !== '') {
      const isAllItemsLunas = t.items && t.items.length > 0 && t.items.every(i => i.isLunasItem);
      const statusTrxKasbon = (t.isLunasKasbon || isAllItemsLunas) ? 'Lunas' : 'Belum Lunas';
      namaKasbonDisplay = statusTrxKasbon === 'Lunas'
        ? `<b>${t.namaKasbon}</b> <br><span style="background: #dcfce7; color: #16a34a; padding: 2px 6px; border-radius: 4px; font-size: 0.75rem; font-weight: 600;">(Lunas)</span>`
        : `<b>${t.namaKasbon}</b> <br><span style="background: #fee2e2; color: #dc2626; padding: 2px 6px; border-radius: 4px; font-size: 0.75rem; font-weight: 600;">(Belum Lunas)</span>`;
    }

    totalKeseluruhan += t.total;
    tbody.innerHTML += `
      <tr style="vertical-align: middle;">
        <td class="no-print" style="text-align: center;"><input type="checkbox" class="trx-checkbox" value="${originalIndex}" style="width: 16px; height: 16px; cursor: pointer;"></td>
        <td>${idx + 1}</td>
        <td style="line-height: 1.6; padding: 10px;"><b>${namaBarangUtama}</b></td>
        <td style="text-align: center;">${namaKasbonDisplay}</td>
        <td>${t.tanggal}</td>
        <td>${t.items.length} item</td>
        <td><b>Rp ${formatNumber(t.total)}</b></td>
        <td class="no-print">
          <button class="btn btn-secondary btn-sm" onclick="bukaModalCetakNota(${originalIndex})">🖨️ Cetak</button>
          <button class="btn btn-primary btn-sm" onclick="editTransaksi(${originalIndex})">✏️ Edit</button>
          <button class="btn btn-danger btn-sm" onclick="deleteTransaksi(${originalIndex})">🗑️ Hapus</button>
        </td>
      </tr>
    `;
  });

  let summaryBox = document.getElementById('transaksiSummaryCard');
  if(!summaryBox) {
    summaryBox = document.createElement('div');
    summaryBox.id = 'transaksiSummaryCard';
    tbody.closest('.table-responsive').after(summaryBox);
  }
  summaryBox.style.cssText = "margin-top: 15px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px 20px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 15px;";
  summaryBox.innerHTML = `
    <div>
      <div style="font-size: 0.85rem; color: #64748b;">Terbilang:</div>
      <div style="font-size: 0.95rem; font-style: italic; color: #334155;">${getTerbilangRupiah(totalKeseluruhan)}</div>
    </div>
    <div style="text-align: right;">
      <div style="font-size: 0.85rem; color: #64748b;">TOTAL KESELURUHAN:</div>
      <div style="font-size: 1.4rem; font-weight: bold; color: #0f172a;">Rp ${formatNumber(totalKeseluruhan)}</div>
    </div>
  `;
}

function hapusTransaksiTerpilih() {
  const selected = document.querySelectorAll('.trx-checkbox:checked');
  if(selected.length === 0) return alert("Pilih minimal satu transaksi!");
  if(confirm(`Hapus ${selected.length} transaksi terpilih?`)) {
    const indices = Array.from(selected).map(cb => parseInt(cb.value)).sort((a,b) => b-a);
    indices.forEach(idx => { transaksiList.splice(idx, 1); });
    saveDataToStorage();
    renderRiwayatTransaksi();
    renderKasbonTable();
    updateDashboardStats();
    updateFinancialSummary();
  }
}

function cetakDataTransaksiTerfilter() { window.print(); }

function bukaModalCetakNota(idx) {
  const t = transaksiList[idx];
  let itemsHtml = '';
  t.items.forEach(i => {
    itemsHtml += `<tr><td colspan="2" style="padding-top: 4px;"><b>${i.nama}</b></td></tr>
      <tr><td>${i.qty} PCS x ${formatNumber(i.hargaJual)}</td><td style="text-align: right;">${formatNumber(i.subtotal)}</td></tr>`;
  });

  let kasbonReceiptHtml = '';
  if (t.namaKasbon && t.namaKasbon.trim() !== '') {
    const statusKasbon = t.isLunasKasbon ? 'LUNAS' : 'BELUM LUNAS';
    kasbonReceiptHtml = `<div style="font-size: 0.75rem; margin-bottom: 5px;"><span>Kasbon : <b>${t.namaKasbon}</b> (${statusKasbon})</span></div>`;
  }

  document.getElementById('printReceiptContent').innerHTML = `
    <div class="receipt-header"><h4>${tokoProfile.nama}</h4><p>${tokoProfile.alamat}</p><p>Telp: ${tokoProfile.telp}</p></div>
    <div class="receipt-divider"></div>
    <div style="font-size: 0.75rem; margin-bottom: 5px;"><span>Tgl : ${t.tanggal}</span><br><span>Struk : #${t.id || (idx + 1)}</span></div>
    ${kasbonReceiptHtml}
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

function editTransaksi(idx) {
  const t = transaksiList[idx];
  keranjangList = t.items.map(i => ({ ...i }));
  showTab('kasirTab');
  document.getElementById('transaksiEditIndex').value = idx;
  document.getElementById('kasirBayar').value = t.bayar;
  document.getElementById('kasirNamaKasbon').value = t.namaKasbon || '';
  document.getElementById('kasirFormTitle').innerText = `✏️ Edit Transaksi Penjualan`;
  document.getElementById('btnSimpanTransaksi').innerText = "🔄 Perbarui Transaksi";
  renderKeranjang();
}

function deleteTransaksi(idx) {
  if(confirm("Yakin ingin menghapus transaksi ini?")) {
    transaksiList.splice(idx, 1);
    saveDataToStorage();
    renderRiwayatTransaksi();
    renderKasbonTable();
    updateDashboardStats();
    updateFinancialSummary();
  }
}

function salinNomorBarcode(kode) {
  navigator.clipboard.writeText(kode).then(() => alert(`Kode barcode "${kode}" disalin!`));
}

function previewLiveBarcode() {
  const code = document.getElementById('pengBarcodeCode').value.trim();
  if(code) {
    try { JsBarcode("#liveBarcodeSvg", code, { format: "CODE128", width: 2.5, height: 75, displayValue: true, fontSize: 16 }); } catch(e){}
  } else {
    document.getElementById('liveBarcodeSvg').innerHTML = "";
  }
}

function populateBarangDatalist() {
  const datalist = document.getElementById('listPengeluaranBarang');
  if(!datalist) return;
  datalist.innerHTML = '';
  pengeluaranList.forEach(p => { datalist.innerHTML += `<option value="${p.keterangan}"></option>`; });
}

function onInputBarangNama(val) {
  const cleanVal = val.trim().toLowerCase();
  const matched = pengeluaranList.find(p => p.keterangan.toLowerCase() === cleanVal);
  if(matched) {
    document.getElementById('barKode').value = matched.barcode;
    document.getElementById('barHargaModal').value = matched.modal;
    document.getElementById('barHargaJual').value = matched.jual;
  }
}

function populateLaporanBarangSelect() {
  const select = document.getElementById('laporanBarangSelect');
  if(!select) return;
  select.innerHTML = '<option value="">-- Semua Barang --</option>';
  barangList.forEach(b => { select.innerHTML += `<option value="${b.nama}">${b.nama}</option>`; });
}

function terbilang(nilai) {
  nilai = Math.abs(nilai);
  const angka = ["", "Satu", "Dua", "Tiga", "Empat", "Lima", "Enam", "Tujuh", "Delapan", "Sembilan", "Sepuluh", "Sebelas"];
  let temp = "";
  if (nilai < 12) temp = " " + angka[nilai];
  else if (nilai < 20) temp = terbilang(nilai - 10) + " Belas";
  else if (nilai < 100) temp = terbilang(Math.floor(nilai / 10)) + " Puluh" + terbilang(nilai % 10);
  else if (nilai < 200) temp = " Seratus" + terbilang(nilai - 100);
  else if (nilai < 1000) temp = terbilang(Math.floor(nilai / 100)) + " Ratus" + terbilang(nilai % 100);
  else if (nilai < 2000) temp = " Seribu" + terbilang(nilai - 1000);
  else if (nilai < 1000000) temp = terbilang(Math.floor(nilai / 1000)) + " Ribu" + terbilang(nilai % 1000);
  else if (nilai < 1000000000) temp = terbilang(Math.floor(nilai / 1000000)) + " Juta" + terbilang(nilai % 1000000);
  return temp;
}

function getTerbilangRupiah(nominal) {
  return nominal === 0 ? "Nol Rupiah" : terbilang(nominal).trim() + " Rupiah";
}

function filterLaporan() {
  const namaBarang = document.getElementById('laporanBarangSelect').value;
  const tglDari = document.getElementById('laporanTglDari').value;
  const tglSampai = document.getElementById('laporanTglSampai').value;
  const tbody = document.getElementById('laporanTbody');
  if(!tbody) return;
  tbody.innerHTML = "";

  if(!tglDari || !tglSampai) return alert("Pilih rentang tanggal terlebih dahulu!");

  let filtered = transaksiList.filter(t => t.tanggalRaw >= tglDari && t.tanggalRaw <= tglSampai);
  if(namaBarang) {
    filtered = filtered.filter(t => t.items.some(i => i.nama.toLowerCase() === namaBarang.toLowerCase()));
  }

  if(filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #777;">Tidak ada data laporan.</td></tr>`;
    return;
  }

  filtered.forEach((t, idx) => {
    const namaBarangUtama = t.items.map((i, iIdx) => `${iIdx + 1}. ${i.nama} (${i.qty}x)`).join('<br>');
    tbody.innerHTML += `
      <tr>
        <td>${idx + 1}</td>
        <td>${formatDateID(t.tanggalRaw)}</td>
        <td><b>${namaBarangUtama}</b></td>
        <td style="text-align: center;">${t.namaKasbon || 'Tunai'}</td>
        <td>${t.items.length} item</td>
        <td><b>Rp ${formatNumber(t.total)}</b></td>
        <td class="no-print"><button class="btn btn-primary btn-sm" onclick="bukaModalCetakNota(${transaksiList.indexOf(t)})">Detail</button></td>
      </tr>
    `;
  });
}

function cetakSemuaLaporanKeseluruhan() {
  const tbody = document.getElementById('laporanTbody');
  if(!tbody) return;
  tbody.innerHTML = "";
  transaksiList.forEach((t, idx) => {
    const namaBarangUtama = t.items.map((i, iIdx) => `${iIdx + 1}. ${i.nama} (${i.qty}x)`).join('<br>');
    tbody.innerHTML += `
      <tr>
        <td>${idx + 1}</td>
        <td>${formatDateID(t.tanggalRaw)}</td>
        <td><b>${namaBarangUtama}</b></td>
        <td style="text-align: center;">${t.namaKasbon || 'Tunai'}</td>
        <td>${t.items.length} item</td>
        <td><b>Rp ${formatNumber(t.total)}</b></td>
        <td class="no-print">-</td>
      </tr>
    `;
  });
  window.print();
}

function cetakRekapLaporan() { window.print(); }

function loadProfilData() {
  if(!document.getElementById('profilUsername')) return;
  document.getElementById('browserPageTitle').innerText = tokoProfile.nama;
  document.getElementById('profilUsername').value = adminCreds.username;
  if(document.getElementById('tokoStoreId')) document.getElementById('tokoStoreId').value = tokoProfile.storeId || 'aplikasi-kasir-utama';
  document.getElementById('tokoNama').value = tokoProfile.nama;
  document.getElementById('tokoTelp').value = tokoProfile.telp;
  document.getElementById('tokoAlamat').value = tokoProfile.alamat;
  document.getElementById('tokoNotes').value = tokoProfile.notes;

  document.getElementById('userDisplayName').innerText = adminCreds.username;
  document.getElementById('topbarMobileBrandText').innerText = tokoProfile.nama;
  document.getElementById('navBrandText').innerText = tokoProfile.nama;
  document.getElementById('bannerStoreName').innerText = tokoProfile.nama;
  document.getElementById('bannerTelp').innerText = tokoProfile.telp;
  document.getElementById('bannerAlamat').innerText = tokoProfile.alamat;
  document.getElementById('sidebarUserText').innerText = `Halo, ${adminCreds.username}`;

  if(adminCreds.avatar) {
    document.getElementById('previewAvatarImg').src = adminCreds.avatar;
    document.getElementById('previewAvatarImg').classList.remove('hidden');
    document.getElementById('previewAvatarIcon').classList.add('hidden');
    document.getElementById('navUserAvatarImg').src = adminCreds.avatar;
    document.getElementById('navUserAvatarImg').classList.remove('hidden');
    document.getElementById('navUserAvatarIcon').classList.add('hidden');
  }
  if(tokoProfile.logo) {
    document.getElementById('previewLogoImg').src = tokoProfile.logo;
    document.getElementById('previewLogoImg').classList.remove('hidden');
    document.getElementById('previewLogoIcon').classList.add('hidden');
    document.getElementById('navBrandImg').src = tokoProfile.logo;
    document.getElementById('navBrandImg').classList.remove('hidden');
    document.getElementById('bannerLogoImg').src = tokoProfile.logo;
    document.getElementById('bannerLogoImg').classList.remove('hidden');
    document.getElementById('bannerLogoIcon').classList.add('hidden');
  }
}

function previewAvatar(e) {
  const file = e.target.files[0];
  if(file) {
    const reader = new FileReader();
    reader.onload = function(event) {
      tempAvatarBase64 = event.target.result;
      const img = document.getElementById('previewAvatarImg');
      img.src = tempAvatarBase64; img.classList.remove('hidden');
      document.getElementById('previewAvatarIcon').classList.add('hidden');
    };
    reader.readAsDataURL(file);
  }
}

function hapusFotoAdmin() {
  adminCreds.avatar = ''; tempAvatarBase64 = '';
  saveDataToStorage(); loadProfilData();
}

function previewLogo(e) {
  const file = e.target.files[0];
  if(file) {
    const reader = new FileReader();
    reader.onload = function(event) {
      tempLogoBase64 = event.target.result;
      const img = document.getElementById('previewLogoImg');
      img.src = tempLogoBase64; img.classList.remove('hidden');
      document.getElementById('previewLogoIcon').classList.add('hidden');
    };
    reader.readAsDataURL(file);
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
  const rawStoreId = document.getElementById('tokoStoreId').value.trim();
  tokoProfile.storeId = rawStoreId ? rawStoreId.toLowerCase().replace(/[^a-z0-9-]+/g, '-') : 'aplikasi-kasir-utama';
  tokoProfile.nama = document.getElementById('tokoNama').value;
  tokoProfile.telp = document.getElementById('tokoTelp').value;
  tokoProfile.alamat = document.getElementById('tokoAlamat').value;
  tokoProfile.notes = document.getElementById('tokoNotes').value;
  if(tempLogoBase64) tokoProfile.logo = tempLogoBase64;
  saveDataToStorage(); loadProfilData();
  alert("Pengaturan data aplikasi disimpan!");
}

function exportDataApp() {
  const dataToExport = { barangList, pengeluaranList, transaksiList, kasbonList, adminCreds, tokoProfile };
  const blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `backup_aplikasi_kasir.json`;
  a.click();
}

function importDataApp() {
  const file = document.getElementById('importFileJson').files[0];
  if(!file) return alert("Pilih file backup (.json)!");
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const data = JSON.parse(e.target.result);
      if(data.barangList) barangList = data.barangList;
      if(data.pengeluaranList) pengeluaranList = data.pengeluaranList; // Diperbaiki dari pengeluuranList
      if(data.transaksiList) transaksiList = data.transaksiList;
      if(data.kasbonList) kasbonList = data.kasbonList;
      if(data.adminCreds) adminCreds = data.adminCreds;
      if(data.tokoProfile) tokoProfile = data.tokoProfile;
      
      saveDataToStorage(); 
      loadProfilData(); 
      renderBarangTable(); 
      renderPengeluaranTable(); // Memastikan tabel pengeluaran ikut dirender ulang
      renderRiwayatTransaksi(); 
      renderKasbonTable();
      updateDashboardStats();
      updateFinancialSummary();
      
      alert("Pemulihan data (import) berhasil! Seluruh data termasuk pengeluaran telah dimuat.");
    } catch (err) {
      alert("Gagal membaca file JSON: Format tidak valid.");
    }
  };
  reader.readAsText(file);
}

function formatNumber(num) {
  return new Intl.NumberFormat('id-ID').format(num);
}
