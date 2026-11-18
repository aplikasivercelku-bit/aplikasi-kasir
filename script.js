let barangList = JSON.parse(localStorage.getItem('sembako_barang')) || [];
let pengeluaranList = JSON.parse(localStorage.getItem('sembako_pengeluaran')) || [];
let transaksiList = JSON.parse(localStorage.getItem('sembako_transaksi')) || [];
let kasbonList = JSON.parse(localStorage.getItem('sembako_kasbon')) || [];
let keranjangList = [];
let currentSelectedKasirBarcode = "";

let keranjangScanner = [];
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
  nama: 'TOKO SEMBAKO',
  telp: '087877611218',
  alamat: 'Jl. Bojonegoro Kp. Kernaden rt 05 05',
  notes: 'Terima kasih atas kunjungan Anda!',
  logo: ''
};

let tempAvatarBase64 = '';
let tempLogoBase64 = '';

let currentLightboxBarcode = "";
let currentLightboxTitle = "";

document.addEventListener('DOMContentLoaded', () => {
  barangList = JSON.parse(localStorage.getItem('sembako_barang')) || [];
  pengeluaranList = JSON.parse(localStorage.getItem('sembako_pengeluaran')) || [];
  transaksiList = JSON.parse(localStorage.getItem('sembako_transaksi')) || [];
  kasbonList = JSON.parse(localStorage.getItem('sembako_kasbon')) || [];

  loadProfilData();
  
  if (barangList.length === 0 && pengeluaranList.length > 0) {
    pengeluaranList.forEach(p => {
      barangList.push({
        kode: p.barcode,
        nama: p.keterangan.toUpperCase().trim(),
        stok: 50,
        minStok: 3,
        satuan: 'Pcs',
        expired: '',
        minExpDays: 15,
        modal: parseFloat(p.modal) || 0,
        jual: parseFloat(p.jual) || 0
      });
    });
    localStorage.setItem('sembako_barang', JSON.stringify(barangList));
  }
  
  const urlParams = new URLSearchParams(window.location.search);
  const mode = urlParams.get('mode');
  const storeParam = urlParams.get('store');

  if (storeParam) {
    tokoProfile.nama = decodeURIComponent(storeParam);
    if(document.getElementById('browserPageTitle')) {
      document.getElementById('browserPageTitle').innerText = tokoProfile.nama;
    }
  }

  if (mode === 'kasir') {
    document.getElementById('loginPage')?.classList.add('hidden');
    document.getElementById('appContainer')?.classList.remove('hidden');
    setupBarcodeModeNavigation();
    showTab('kasirTab');
  } else {
    const isSessionLoggedIn = sessionStorage.getItem('sembako_logged_in');
    if (isSessionLoggedIn === 'true') {
      document.getElementById('loginPage')?.classList.add('hidden');
      document.getElementById('appContainer')?.classList.remove('hidden');
      showTab('berandaTab');
    } else {
      document.getElementById('loginPage')?.classList.remove('hidden');
      document.getElementById('appContainer')?.classList.add('hidden');
    }
  }

  renderBarangTable();
  renderPengeluaranTable();
  renderRiwayatTransaksi();
  renderKasbonTable();
  renderKeranjangScanner();
  populateBarangDatalist();
  populateKasbonDatalist();
  populateLaporanBarangSelect();
  updateDashboardStats();
  updateFinancialSummary();
  updateNotifications();
  updateKasbonNotifications();
  
  const today = new Date().toISOString().split('T')[0];
  if(document.getElementById('pengTgl')) document.getElementById('pengTgl').value = today;
  if(document.getElementById('barExpired')) document.getElementById('barExpired').value = today;
  if(document.getElementById('kasbonTgl')) document.getElementById('kasbonTgl').value = today;
});

function setupBarcodeModeNavigation() {
  const menuContainer = document.getElementById('sidebarMenuContainer');
  if(menuContainer) {
    menuContainer.innerHTML = `
      <button class="nav-btn active" data-tab="kasirTab" onclick="showTab('kasirTab')">🛒 Transaksi Kasir</button>
      <button class="nav-btn" data-tab="transaksiTab" onclick="showTab('transaksiTab')">📜 Data Transaksi</button>
      <button class="nav-btn" data-tab="kasbonTab" onclick="showTab('kasbonTab')">📑 Kasbon / Piutang</button>
      
      <div class="sidebar-user-section">
        <div class="user-info">
          <span>👤</span>
          <span>Mode Barcode Kasir</span>
        </div>
      </div>
    `;
  }
}

function handleLogin(e) {
  e.preventDefault();
  const uInput = document.getElementById('loginUsername').value.trim();
  const pInput = document.getElementById('loginPassword').value.trim();

  if(uInput === adminCreds.username && pInput === adminCreds.password) {
    sessionStorage.setItem('sembako_logged_in', 'true');
    document.getElementById('loginPage').classList.add('hidden');
    document.getElementById('appContainer').classList.remove('hidden');
    showTab('berandaTab');
  } else {
    alert("Username atau Password salah! (Default: admin / admin)");
  }
}

function logout() {
  if(confirm("Keluar dari sesi ini dan kembali ke halaman login?")) {
    sessionStorage.removeItem('sembako_logged_in');
    document.getElementById('appContainer').classList.add('hidden');
    document.getElementById('loginPage').classList.remove('hidden');
    document.getElementById('loginUsername').value = '';
    document.getElementById('loginPassword').value = '';
  }
}

function showTab(tabId) {
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
  if(tabId === 'barangTab') populateBarangDatalist();
  if(tabId === 'kasirTab') {
    populateKasbonDatalist();
    if(!document.getElementById('transaksiEditIndex').value) {
      resetKasirForm();
    }
  }
  if(tabId === 'scannerTab') {
    populateKasbonDatalist();
    initScannerCamera();
  } else {
    if(html5QrCode) {
      try { html5QrCode.stop(); } catch(e){}
    }
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
    notifList.innerHTML = `<div class="notif-empty">Tidak ada piutang belum lunas.</div>`;
    return;
  }

  let html = '';
  belumLunasList.forEach((k) => {
    html += `<div class="notif-item stok-warning"><span>📑</span><div>Piutang: <b>${k.nama}</b><br><small style="color: #dc2626; font-weight: 600;">Belum Lunas</small></div></div>`;
  });
  notifList.innerHTML = html;
}

function toggleKasbonNotifDropdown() {
  document.getElementById('kasbonNotifDropdown')?.classList.toggle('hidden');
}

function updateNotifications() {
  const notifList = document.getElementById('notifListContainer');
  const notifCountBadge = document.getElementById('notifCount');
  if(!notifList || !notifCountBadge) return;

  let warnings = [];
  barangList.forEach((b) => {
    if(b.stok < (parseInt(b.minStok) || 3)) {
      warnings.push({ text: `Stok menipis: <b>${b.nama}</b> tersisa ${b.stok} ${b.satuan}` });
    }
  });

  notifCountBadge.innerText = warnings.length;
  if(warnings.length === 0) {
    notifList.innerHTML = `<div class="notif-empty">Tidak ada peringatan.</div>`;
    return;
  }
  let html = '';
  warnings.forEach(w => { html += `<div class="notif-item stok-warning"><span>⚠️</span><div>${w.text}</div></div>`; });
  notifList.innerHTML = html;
}

function toggleNotifDropdown() {
  document.getElementById('notifDropdown')?.classList.toggle('hidden');
}

// --- PENGELUARAN & BARCODE ---
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
    barangList.push({
      kode: newItem.barcode,
      nama: newItem.keterangan.toUpperCase().trim(),
      stok: 50,
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
  populateBarangDatalist();
  updateFinancialSummary();
  resetPengeluaranForm();
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
        <td style="text-align: center;"><input type="checkbox" class="pengeluaran-checkbox" value="${origIdx}" style="width: 16px; height: 16px; cursor: pointer;"></td>
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

function resetPengeluaranForm() {
  document.getElementById('pengeluaranForm').reset();
  document.getElementById('pengeluaranEditIndex').value = "";
  document.getElementById('liveBarcodeSvg').innerHTML = "";
  toggleForm('pengeluaranFormCard', 'pengeluaranToggleIcon');
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

function previewLiveBarcode() {
  const code = document.getElementById('pengBarcodeCode').value.trim();
  if(code) {
    try { JsBarcode("#liveBarcodeSvg", code, { format: "CODE128", width: 2.5, height: 75, displayValue: true, fontSize: 16 }); } catch(e){}
  } else {
    document.getElementById('liveBarcodeSvg').innerHTML = "";
  }
}

// --- DATA BARANG STOK ---
function saveBarang(e) {
  e.preventDefault();
  const idx = document.getElementById('barangEditIndex').value;
  const barcodeVal = document.getElementById('barKode').value.trim();
  
  if(!barcodeVal) {
    alert("Barcode wajib terisi otomatis dari data pengeluaran.");
    return;
  }

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
  alert("Data stok barang berhasil disimpan!");
}

function renderBarangTable() {
  const tbody = document.getElementById('barangTbody');
  if(!tbody) return;
  tbody.innerHTML = "";

  const keyword = (document.getElementById('searchBarangInput')?.value || '').toLowerCase();
  const filtered = barangList.filter(b => b.nama.toLowerCase().includes(keyword) || b.kode.toLowerCase().includes(keyword));

  if(filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #777;">Belum ada data barang. Silakan input dari Data Pengeluaran terlebih dahulu.</td></tr>`;
    return;
  }

  filtered.forEach((b, idx) => {
    const origIdx = barangList.indexOf(b);
    const svgIdBarang = `tableBarcode_bar_${origIdx}`;
    const safeName = b.nama.replace(/'/g, "\\'");
    const safeCode = b.kode.replace(/'/g, "\\'");

    tbody.innerHTML += `
      <tr id="barangRow_${origIdx}">
        <td style="text-align: center;"><input type="checkbox" class="barang-checkbox" value="${origIdx}" style="width: 16px; height: 16px; cursor: pointer;"></td>
        <td>${idx + 1}</td>
        <td style="text-align: center;">
          <div class="barcode-clickable" onclick="bukaLightboxBarcode('${safeCode}', '${safeName}')" title="Klik untuk memperbesar & unduh barcode">
            <svg id="${svgIdBarang}" class="table-barcode-svg"></svg>
          </div>
        </td>
        <td><b>${b.nama}</b></td>
        <td><b>${b.stok}</b> ${b.satuan}</td>
        <td>
          <button class="btn btn-primary btn-sm" onclick="editBarang(${origIdx})">Edit</button>
          <button class="btn btn-danger btn-sm" onclick="deleteBarang(${origIdx})">Hapus</button>
        </td>
      </tr>
    `;
    setTimeout(() => {
      try { JsBarcode(`#${svgIdBarang}`, b.kode, { format: "CODE128", width: 2, height: 50, displayValue: true, fontSize: 14 }); } catch(err){}
    }, 50);
  });
}

function resetBarangForm() {
  document.getElementById('barangForm').reset();
  document.getElementById('barangEditIndex').value = "";
  toggleForm('barangFormCard', 'barangToggleIcon');
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
    populateLaporanBarangSelect();
    updateDashboardStats();
    updateFinancialSummary();
  }
}

function populateBarangDatalist() {
  const datalist = document.getElementById('listPengeluaranBarang');
  if(!datalist) return;
  datalist.innerHTML = '';
  barangList.forEach(b => { datalist.innerHTML += `<option value="${b.nama}">`; });
}

function onInputBarangNama(val) {
  const cleanVal = val.trim().toLowerCase();
  const matched = barangList.find(b => b.nama.toLowerCase() === cleanVal);
  if(matched) {
    document.getElementById('barKode').value = matched.kode;
    document.getElementById('barHargaModal').value = matched.modal;
    document.getElementById('barHargaJual').value = matched.jual;
  } else {
    document.getElementById('barKode').value = '';
    document.getElementById('barHargaModal').value = '';
    document.getElementById('barHargaJual').value = '';
  }
}

// --- PENCARIAN KASIR & KOTAK HIJAU ---
function onKetikCariBarang() {
  const keyword = document.getElementById('kasirBarangInput').value.toLowerCase().trim();
  const dropdown = document.getElementById('autocompleteDropdown');
  
  if(keyword === "") {
    dropdown.innerHTML = "";
    dropdown.classList.add('hidden');
    document.getElementById('selectedKasirBarangIndex').value = "";
    onKasirBarangChange("");
    return;
  }

  let combinedItems = [];
  barangList.forEach((b, idx) => {
    combinedItems.push({ nama: b.nama, kode: b.kode, stok: b.stok, satuan: b.satuan || 'Pcs', jual: b.jual, originalIndex: idx });
  });

  pengeluaranList.forEach(p => {
    if (!combinedItems.some(item => item.kode === p.barcode || item.nama.toLowerCase() === p.keterangan.toLowerCase())) {
      combinedItems.push({ nama: p.keterangan.toUpperCase(), kode: p.barcode, stok: 50, satuan: 'Pcs', jual: p.jual, originalIndex: -1 });
    }
  });

  const filtered = combinedItems.filter(item => item.nama.toLowerCase().includes(keyword) || item.kode.toLowerCase().includes(keyword));

  if(filtered.length === 0) {
    dropdown.innerHTML = `<div class="autocomplete-item" style="color: #94a3b8; cursor: default; padding: 8px 12px;">Barang tidak ditemukan</div>`;
    dropdown.classList.remove('hidden');
    document.getElementById('kasirInfoBarangDitemukan')?.classList.add('hidden');
    return;
  }

  let html = "";
  filtered.forEach(item => {
    if (item.originalIndex !== -1) {
      html += `<div class="autocomplete-item" onclick="pilihItemAutocomplete(${item.originalIndex})" style="padding: 8px 12px; cursor: pointer; border-bottom: 1px solid #f1f5f9;">
        <b>${item.nama}</b> (Stok: ${item.stok} ${item.satuan}) - Rp ${formatNumber(item.jual)} [Kode: ${item.kode}]
      </div>`;
    } else {
      const newIdx = barangList.length;
      barangList.push({ kode: item.kode, nama: item.nama, stok: 50, minStok: 3, satuan: 'Pcs', expired: '', minExpDays: 15, modal: item.jual * 0.8, jual: item.jual });
      saveDataToStorage();
      html += `<div class="autocomplete-item" onclick="pilihItemAutocomplete(${newIdx})" style="padding: 8px 12px; cursor: pointer; border-bottom: 1px solid #f1f5f9;">
        <b>${item.nama}</b> (Stok: 50 Pcs) - Rp ${formatNumber(item.jual)} [Kode: ${item.kode}]
      </div>`;
    }
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
  const infoBox = document.getElementById('kasirInfoBarangDitemukan');

  if(idx !== "" && idx !== undefined && barangList[idx]) {
    const barang = barangList[idx];
    currentSelectedKasirBarcode = barang.kode;

    if(infoBox) {
      infoBox.classList.remove('hidden');
      document.getElementById('infoNamaDitemukan').innerText = barang.nama;
      document.getElementById('infoDetailDitemukan').innerText = `Harga: Rp ${formatNumber(barang.jual)} | Sisa Stok: ${barang.stok} ${barang.satuan}`;
    }

    if(previewArea) previewArea.classList.remove('hidden');
    if(placeholder) placeholder.classList.add('hidden');
    
    try { 
      JsBarcode("#kasirBarcodeSvg", barang.kode, { 
        format: "CODE128", 
        width: 2, 
        height: 60, 
        displayValue: true, 
        fontSize: 14 
      }); 
    } catch(e) {
      console.error(e);
    }
  } else {
    currentSelectedKasirBarcode = "";
    if(infoBox) infoBox.classList.add('hidden');
    if(previewArea) previewArea.classList.add('hidden');
    if(placeholder) placeholder.classList.remove('hidden');
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

// --- LIGHTBOX BARCODE & DOWNLOAD BARANG ---
function bukaLightboxBarcode(code, title = "Barcode Barang") {
  if (!code) return;
  currentLightboxBarcode = code;
  currentLightboxTitle = title;
  
  let modal = document.getElementById('barcodeLightboxModal');
  if(!modal) {
    modal = document.createElement('div');
    modal.id = 'barcodeLightboxModal';
    modal.className = 'lightbox-overlay';
    modal.innerHTML = `
      <div class="lightbox-container" style="background:#fff; padding:20px; border-radius:8px; text-align:center; max-width:400px; margin:auto;">
        <h3 id="lightboxItemTitle" style="font-size:1.1rem; margin-bottom:15px;">${title}</h3>
        <div style="background:#fff; padding:10px;"><svg id="lightboxBarcodeSvg"></svg></div>
        <div style="margin-top:15px; display:flex; gap:10px; justify-content:center;">
          <button class="btn btn-success btn-sm" onclick="downloadLightboxBarcodePNG()">📥 Unduh Barcode PNG</button>
          <button class="btn btn-secondary btn-sm" onclick="tutupLightboxBarcode()">Tutup</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }
  document.getElementById('lightboxItemTitle').innerText = title;
  modal.classList.remove('hidden');
  try {
    JsBarcode("#lightboxBarcodeSvg", code, { format: "CODE128", width: 2.5, height: 90, displayValue: true, fontSize: 16 });
  } catch(e){}
}

function tutupLightboxBarcode() {
  document.getElementById('barcodeLightboxModal')?.classList.add('hidden');
}

function downloadLightboxBarcodePNG() {
  if(!currentLightboxBarcode) return;
  const svgEl = document.getElementById('lightboxBarcodeSvg');
  if(!svgEl) return;
  const xml = new XMLSerializer().serializeToString(svgEl);
  const svgBlob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);
  
  const img = new Image();
  img.onload = function() {
    const canvas = document.createElement('canvas');
    canvas.width = img.width || 350; canvas.height = img.height || 120;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);
    const a = document.createElement('a');
    a.download = `barcode_${currentLightboxTitle.replace(/\s+/g, '_')}_${currentLightboxBarcode}.png`;
    a.href = canvas.toDataURL('image/png');
    document.body.appendChild(a); a.click(); a.remove();
  };
  img.src = url;
}

// --- UTILITIES ---
function formatNumber(num) {
  return new Intl.NumberFormat('id-ID').format(num);
}

function loadProfilData() {
  if(document.getElementById('browserPageTitle')) document.getElementById('browserPageTitle').innerText = tokoProfile.nama;
  if(document.getElementById('bannerStoreName')) document.getElementById('bannerStoreName').innerText = tokoProfile.nama;
  if(document.getElementById('bannerAlamat')) document.getElementById('bannerAlamat').innerText = tokoProfile.alamat;
  if(document.getElementById('bannerTelp')) document.getElementById('bannerTelp').innerText = tokoProfile.telp;
  if(document.getElementById('navBrandText')) document.getElementById('navBrandText').innerText = tokoProfile.nama;
}
