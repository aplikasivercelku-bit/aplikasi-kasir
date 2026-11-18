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
    document.getElementById('browserPageTitle').innerText = tokoProfile.nama;
  }

  if (mode === 'kasir') {
    document.getElementById('loginPage').classList.add('hidden');
    document.getElementById('appContainer').classList.remove('hidden');
    
    setupBarcodeModeNavigation();
    showTab('kasirTab');
  } else {
    const isSessionLoggedIn = sessionStorage.getItem('sembako_logged_in');
    if (isSessionLoggedIn === 'true') {
      document.getElementById('loginPage').classList.add('hidden');
      document.getElementById('appContainer').classList.remove('hidden');
      showTab('berandaTab');
    } else {
      document.getElementById('loginPage').classList.remove('hidden');
      document.getElementById('appContainer').classList.add('hidden');
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
  if(tabId === 'laporanTab') {
    const tbody = document.getElementById('laporanTbody');
    if(tbody && !tbody.hasAttribute('data-filtered')) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #777;">Silakan pilih tanggal atau klik 'Cetak Keseluruhan Transaksi'.</td></tr>`;
    }
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

// --- FUNGSI PENCARIAN KASIR & KOTAK HIJAU ---
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
    document.getElementById('kasirInfoBarangDitemukan').classList.add('hidden');
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

// Menampilkan Kotak Hijau & Barcode Batang persis seperti Gambar Referensi
function onKasirBarangChange(idx) {
  const previewArea = document.getElementById('kasirBarcodePreviewArea');
  const placeholder = document.getElementById('kasirBarcodePlaceholder');
  const infoBox = document.getElementById('kasirInfoBarangDitemukan');

  if(idx !== "" && idx !== undefined && barangList[idx]) {
    const barang = barangList[idx];
    currentSelectedKasirBarcode = barang.kode;

    infoBox.classList.remove('hidden');
    document.getElementById('infoNamaDitemukan').innerText = barang.nama;
    document.getElementById('infoDetailDitemukan').innerText = `Harga: Rp ${formatNumber(barang.jual)} | Sisa Stok: ${barang.stok} ${barang.satuan}`;

    previewArea.classList.remove('hidden');
    placeholder.classList.add('hidden');
    
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
    infoBox.classList.add('hidden');
    previewArea.classList.add('hidden');
    placeholder.classList.remove('hidden');
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
    alert("Pilih barang dan masukkan jumlah yang valid!");
    return;
  }

  const barang = barangList[idx];
  const existing = keranjangList.find(k => k.kode === barang.kode);
  let currentQtyInCart = existing ? existing.qty : 0;

  if(currentQtyInCart + qty > barang.stok) { 
    alert("Stok fisik tidak mencukupi!"); 
    return; 
  }

  if(existing) {
    existing.qty += qty;
    existing.subtotal = existing.qty * existing.hargaJual;
  } else {
    keranjangList.push({ kode: barang.kode, nama: barang.nama, hargaJual: barang.jual, qty, subtotal: barang.jual * qty });
  }

  renderKeranjang();
  document.getElementById('kasirBarangInput').value = "";
  document.getElementById('selectedKasirBarangIndex').value = "";
  document.getElementById('kasirQty').value = 1;
  document.getElementById('kasirInfoBarangDitemukan').classList.add('hidden');
  document.getElementById('kasirBarcodePreviewArea').classList.add('hidden');
  document.getElementById('kasirBarcodePlaceholder').classList.remove('hidden');
  currentSelectedKasirBarcode = "";
}

function renderKeranjang() {
  const tbody = document.getElementById('keranjangTbody');
  if(!tbody) return;
  tbody.innerHTML = "";
  let total = 0;

  if(keranjangList.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #777;">Keranjang kosong.</td></tr>`;
    document.getElementById('kasirTotalDisplay').innerText = `Rp 0`;
    return;
  }

  keranjangList.forEach((item, idx) => {
    total += item.subtotal;
    const svgId = `keranjangBarcode_${idx}`;
    tbody.innerHTML += `
      <tr>
        <td>${idx + 1}</td>
        <td>${item.nama}</td>
        <td><svg id="${svgId}" class="table-barcode-svg"></svg></td>
        <td>Rp ${formatNumber(item.hargaJual)}</td>
        <td>${item.qty}</td>
        <td>Rp ${formatNumber(item.subtotal)}</td>
        <td><button class="btn btn-danger btn-sm" onclick="keranjangList.splice(${idx}, 1); renderKeranjang();">Hapus</button></td>
      </tr>
    `;
    setTimeout(() => {
      try { JsBarcode(`#${svgId}`, item.kode, { format: "CODE128", width: 1.5, height: 40, displayValue: true, fontSize: 12 }); } catch(err){}
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
  if(keranjangList.length === 0) { alert("Keranjang kosong!"); return; }
  let total = keranjangList.reduce((sum, item) => sum + item.subtotal, 0);
  let bayar = parseFloat(document.getElementById('kasirBayar').value) || 0;
  let namaKasbonInput = document.getElementById('kasirNamaKasbon').value.trim();

  if(bayar < total && namaKasbonInput === "") { alert("Pembayaran kurang dan nama kasbon belum diisi!"); return; }

  keranjangList.forEach(item => {
    const b = barangList.find(x => x.kode === item.kode);
    if(b) { b.stok -= item.qty; if(b.stok < 0) b.stok = 0; }
  });

  const now = new Date();
  const transaksi = {
    id: 'TRX-' + Date.now(),
    tanggalRaw: now.toISOString().split('T')[0],
    tanggal: now.toLocaleString('id-ID'),
    namaKasbon: namaKasbonInput,
    items: keranjangList.map(i => ({ ...i, isLunasItem: false })),
    total, bayar, kembalian: bayar - total >= 0 ? bayar - total : 0,
    isLunasKasbon: false
  };

  transaksiList.push(transaksi);

  if (namaKasbonInput !== '') {
    if (!kasbonList.some(k => k.nama.toLowerCase() === namaKasbonInput.toLowerCase())) {
      kasbonList.push({ tanggal: now.toISOString().split('T')[0], nama: namaKasbonInput, telp: '', alamat: '', status: 'Belum Lunas' });
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

  alert("Transaksi berhasil disimpan dan stok tersinkronisasi!");
  showTab('transaksiTab');
}

function resetKasirForm() {
  keranjangList = [];
  document.getElementById('transaksiEditIndex').value = "";
  document.getElementById('kasirBarangInput').value = "";
  document.getElementById('selectedKasirBarangIndex').value = "";
  document.getElementById('kasirNamaKasbon').value = "";
  document.getElementById('kasirBayar').value = "";
  document.getElementById('kasirInfoBarangDitemukan').classList.add('hidden');
  document.getElementById('kasirBarcodePreviewArea').classList.add('hidden');
  document.getElementById('kasirBarcodePlaceholder').classList.remove('hidden');
  currentSelectedKasirBarcode = "";
  renderKeranjang();
}

function formatNumber(num) {
  return new Intl.NumberFormat('id-ID').format(num);
}

function loadProfilData() {
  document.getElementById('browserPageTitle').innerText = tokoProfile.nama;
  document.getElementById('bannerStoreName').innerText = tokoProfile.nama;
  document.getElementById('bannerAlamat').innerText = tokoProfile.alamat;
  document.getElementById('bannerTelp').innerText = tokoProfile.telp;
  document.getElementById('navBrandText').innerText = tokoProfile.nama;
}
