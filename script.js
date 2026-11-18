let barangList = JSON.parse(localStorage.getItem('sembako_barang')) || [];
let pengeluaranList = JSON.parse(localStorage.getItem('sembako_pengeluaran')) || [];
let transaksiList = JSON.parse(localStorage.getItem('sembako_transaksi')) || [];
let kasbonList = JSON.parse(localStorage.getItem('sembako_kasbon')) || [];
let keranjangList = [];

let adminCreds = JSON.parse(localStorage.getItem('sembako_admin')) || { username: 'admin', password: 'admin' };
let tokoProfile = JSON.parse(localStorage.getItem('sembako_toko')) || {
  nama: 'TOKO SEMBAKO',
  telp: '087877611218',
  alamat: 'Jl. Bojonegoro Kp. Kernaden rt 05 05'
};

document.addEventListener('DOMContentLoaded', () => {
  loadProfilData();
  if (sessionStorage.getItem('sembako_logged_in') === 'true') {
    document.getElementById('loginPage').classList.add('hidden');
    document.getElementById('appContainer').classList.remove('hidden');
    showTab('berandaTab');
  }
  renderBarangTable();
  renderPengeluaranTable();
  renderRiwayatTransaksi();
  renderKasbonTable();
  renderUniversalQRCode();
  updateDashboardStats();
});

function handleLogin(e) {
  e.preventDefault();
  if(document.getElementById('loginUsername').value.trim() === adminCreds.username && document.getElementById('loginPassword').value.trim() === adminCreds.password) {
    sessionStorage.setItem('sembako_logged_in', 'true');
    document.getElementById('loginPage').classList.add('hidden');
    document.getElementById('appContainer').classList.remove('hidden');
    showTab('berandaTab');
    renderUniversalQRCode();
  } else { alert("Login Salah!"); }
}

function logout() { sessionStorage.removeItem('sembako_logged_in'); location.reload(); }

function showTab(tabId) {
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(tabId).classList.add('active');
  document.querySelector(`.nav-btn[data-tab="${tabId}"]`)?.classList.add('active');
  if(tabId === 'barangTab' || tabId === 'berandaTab') renderUniversalQRCode();
}

function saveDataToStorage() {
  localStorage.setItem('sembako_barang', JSON.stringify(barangList));
  localStorage.setItem('sembako_pengeluaran', JSON.stringify(pengeluaranList));
  localStorage.setItem('sembako_transaksi', JSON.stringify(transaksiList));
  localStorage.setItem('sembako_kasbon', JSON.stringify(kasbonList));
  localStorage.setItem('sembako_toko', JSON.stringify(tokoProfile));
}

function renderUniversalQRCode() {
  const container = document.getElementById('universalQRCodeContainer');
  const urlTextEl = document.getElementById('universalQRUrlText');
  const titleEl = document.getElementById('qrCardTitle');
  if(!container) return;

  container.innerHTML = "";
  if(titleEl) titleEl.innerText = `QR ${tokoProfile.nama.toUpperCase()} (Keseluruhan Barang)`;

  // Generate target URL langsung ke halaman kasir pembeli dengan parameter toko
  const targetUrl = window.location.origin + window.location.pathname + `?store=${encodeURIComponent(tokoProfile.nama)}&mode=kasir`;
  if(urlTextEl) urlTextEl.innerText = targetUrl;

  try {
    new QRCode(container, {
      text: targetUrl,
      width: 180,
      height: 180,
      colorDark: "#000000",
      colorLight: "#ffffff",
      correctLevel: QRCode.CorrectLevel.H
    });
  } catch(e) {
    console.error("Gagal merender QR Code:", e);
  }
}

function salinUniversalQRUrl() {
  const targetUrl = window.location.origin + window.location.pathname + `?store=${encodeURIComponent(tokoProfile.nama)}&mode=kasir`;
  navigator.clipboard.writeText(targetUrl).then(() => alert(`Link QR berhasil disalin: ${targetUrl}`));
}

function downloadUniversalQRPNG() {
  const imgEl = document.querySelector('#universalQRCodeContainer img') || document.querySelector('#universalQRCodeContainer canvas');
  if(!imgEl) { alert("QR belum siap!"); return; }
  
  let imageUrl = "";
  if(imgEl.tagName === 'CANVAS') {
    imageUrl = imgEl.toDataURL("image/png");
  } else {
    imageUrl = imgEl.src;
  }

  const a = document.createElement('a');
  a.download = `QR-Keseluruhan-${tokoProfile.nama.replace(/\s+/g, '_')}.png`;
  a.href = imageUrl;
  a.click();
}

function savePengeluaran(e) {
  e.preventDefault();
  pengeluaranList.push({
    tanggal: document.getElementById('pengTgl').value,
    keterangan: document.getElementById('pengKeterangan').value.trim(),
    modal: parseFloat(document.getElementById('pengHargaModal').value) || 0,
    jual: parseFloat(document.getElementById('pengHargaJual').value) || 0,
    barcode: document.getElementById('pengBarcodeCode').value.trim()
  });
  saveDataToStorage();
  renderPengeluaranTable();
  document.getElementById('pengeluaranForm').reset();
}

function renderPengeluaranTable() {
  const tbody = document.getElementById('pengeluaranTbody');
  if(!tbody) return;
  tbody.innerHTML = pengeluaranList.length === 0 ? `<tr><td colspan="8" style="text-align:center;">Kosong</td></tr>` : '';
  pengeluaranList.forEach((p, i) => {
    tbody.innerHTML += `<tr><td><input type="checkbox" class="pengeluaran-checkbox" value="${i}"></td><td>${i+1}</td><td>${p.tanggal}</td><td><b>${p.keterangan}</b></td><td>Rp ${formatNumber(p.modal)}</td><td>Rp ${formatNumber(p.jual)}</td><td>${p.barcode}</td><td><button class="btn btn-danger btn-sm" onclick="pengeluaranList.splice(${i},1);saveDataToStorage();renderPengeluaranTable();">Hapus</button></td></tr>`;
  });
}

function saveBarang(e) {
  e.preventDefault();
  barangList.push({
    kode: document.getElementById('barKode').value,
    nama: document.getElementById('barNama').value.toUpperCase(),
    stok: parseInt(document.getElementById('barStok').value) || 0,
    minStok: 3,
    satuan: document.getElementById('barSatuan').value,
    expired: document.getElementById('barExpired').value,
    modal: parseFloat(document.getElementById('barHargaModal').value) || 0,
    jual: parseFloat(document.getElementById('barHargaJual').value) || 0
  });
  saveDataToStorage();
  renderBarangTable();
  document.getElementById('barangForm').reset();
  alert("Barang disimpan!");
}

function renderBarangTable() {
  const tbody = document.getElementById('barangTbody');
  if(!tbody) return;
  tbody.innerHTML = barangList.length === 0 ? `<tr><td colspan="6" style="text-align:center;">Belum ada barang</td></tr>` : '';
  barangList.forEach((b, i) => {
    const svgId = `barCode_${i}`;
    tbody.innerHTML += `<tr><td><input type="checkbox" class="barang-checkbox" value="${i}"></td><td>${i+1}</td><td style="text-align:center;"><svg id="${svgId}"></svg></td><td><b>${b.nama}</b></td><td>${b.stok} ${b.satuan}</td><td><button class="btn btn-danger btn-sm" onclick="barangList.splice(${i},1);saveDataToStorage();renderBarangTable();">Hapus</button></td></tr>`;
    setTimeout(() => { try { JsBarcode(`#${svgId}`, b.kode, { format: "CODE128", width: 1.5, height: 40, displayValue: true }); } catch(e){} }, 50);
  });
}

function onInputBarangNama(val) {
  const matched = pengeluaranList.find(p => p.keterangan.toLowerCase() === val.trim().toLowerCase());
  if(matched) {
    document.getElementById('barKode').value = matched.barcode;
    document.getElementById('barHargaModal').value = matched.modal;
    document.getElementById('barHargaJual').value = matched.jual;
  }
}

function onKetikCariBarang() {
  const kw = document.getElementById('kasirBarangInput').value.toLowerCase();
  const box = document.getElementById('autocompleteDropdown');
  if(!kw) { box.classList.add('hidden'); return; }
  const found = barangList.map((b,i)=>({...b, i})).filter(b => b.nama.toLowerCase().includes(kw));
  box.innerHTML = found.map(b => `<div class="autocomplete-item" onclick="pilihItemAutocomplete(${b.i})"><b>${b.nama}</b> (Stok: ${b.stok}) - Rp ${formatNumber(b.jual)}</div>`).join('');
  box.classList.remove('hidden');
}

function pilihItemAutocomplete(i) {
  const b = barangList[i];
  document.getElementById('kasirBarangInput').value = `${b.nama} - Rp ${formatNumber(b.jual)}`;
  document.getElementById('selectedKasirBarangIndex').value = i;
  document.getElementById('autocompleteDropdown').classList.add('hidden');
}

function tambahItemKeranjang() {
  const idx = document.getElementById('selectedKasirBarangIndex').value;
  const qty = parseInt(document.getElementById('kasirQty').value) || 1;
  if(idx === "" || !barangList[idx]) return;
  const b = barangList[idx];
  keranjangList.push({ kode: b.kode, nama: b.nama, hargaJual: b.jual, qty, subtotal: b.jual * qty });
  renderKeranjang();
  document.getElementById('kasirBarangInput').value = "";
  document.getElementById('selectedKasirBarangIndex').value = "";
}

function renderKeranjang() {
  const tbody = document.getElementById('keranjangTbody');
  if(!tbody) return;
  let total = 0;
  tbody.innerHTML = keranjangList.map((item, i) => {
    total += item.subtotal;
    return `<tr><td>${i+1}</td><td>${item.nama}</td><td>${item.kode}</td><td>Rp ${formatNumber(item.hargaJual)}</td><td>${item.qty}</td><td>Rp ${formatNumber(item.subtotal)}</td><td><button class="btn btn-danger btn-sm" onclick="keranjangList.splice(${i},1);renderKeranjang();">Hapus</button></td></tr>`;
  }).join('');
  document.getElementById('kasirTotalDisplay').innerText = `Rp ${formatNumber(total)}`;
}

function hitungKembalian() {
  const total = keranjangList.reduce((sum, i) => sum + i.subtotal, 0);
  const bayar = parseFloat(document.getElementById('kasirBayar').value) || 0;
  document.getElementById('kasirKembalianDisplay').innerText = bayar >= total ? `Rp ${formatNumber(bayar - total)}` : `Rp 0`;
}

function prosesPembayaran() {
  if(keranjangList.length === 0) return;
  const total = keranjangList.reduce((sum, i) => sum + i.subtotal, 0);
  const bayar = parseFloat(document.getElementById('kasirBayar').value) || 0;
  const namaKasbon = document.getElementById('kasirNamaKasbon').value.trim();

  keranjangList.forEach(item => {
    const b = barangList.find(x => x.kode === item.kode);
    if(b) b.stok -= item.qty;
  });

  transaksiList.push({
    id: 'TRX-' + Date.now(),
    tanggal: new Date().toLocaleString('id-ID'),
    namaKasbon, items: [...keranjangList], total, bayar, kembalian: bayar - total, isLunasKasbon: false
  });

  if(namaKasbon && !kasbonList.some(k => k.nama.toLowerCase() === namaKasbon.toLowerCase())) {
    kasbonList.push({ tanggal: new Date().toISOString().split('T')[0], nama: namaKasbon, telp: '', alamat: '', status: 'Belum Lunas' });
  }

  saveDataToStorage();
  renderBarangTable();
  renderRiwayatTransaksi();
  renderKasbonTable();
  keranjangList = [];
  renderKeranjang();
  alert("Transaksi Berhasil!");
}

function renderRiwayatTransaksi() {
  const tbody = document.getElementById('riwayatTransaksiTbody');
  if(!tbody) return;
  tbody.innerHTML = transaksiList.length === 0 ? `<tr><td colspan="7" style="text-align:center;">Belum ada transaksi</td></tr>` : '';
  transaksiList.forEach((t, i) => {
    tbody.innerHTML += `<tr><td class="no-print"><input type="checkbox" class="trx-checkbox" value="${i}"></td><td>${i+1}</td><td>${t.items.map(x=>x.nama).join(', ')}</td><td style="text-align:center;"><b>${t.namaKasbon || '-'}</b></td><td>${t.tanggal}</td><td>Rp ${formatNumber(t.total)}</td><td class="no-print"><button class="btn btn-danger btn-sm" onclick="transaksiList.splice(${i},1);saveDataToStorage();renderRiwayatTransaksi();">Hapus</button></td></tr>`;
  });
}

function saveKasbon(e) {
  e.preventDefault();
  kasbonList.push({
    tanggal: document.getElementById('kasbonTgl').value,
    nama: document.getElementById('kasbonNama').value.trim(),
    telp: document.getElementById('kasbonTelp').value.trim(),
    alamat: document.getElementById('kasbonAlamat').value.trim(),
    status: 'Belum Lunas'
  });
  saveDataToStorage();
  renderKasbonTable();
  document.getElementById('kasbonForm').reset();
}

function renderKasbonTable() {
  const tbody = document.getElementById('kasbonTbody');
  if(!tbody) return;
  tbody.innerHTML = kasbonList.length === 0 ? `<tr><td colspan="5" style="text-align:center;">Belum ada kasbon</td></tr>` : '';
  kasbonList.forEach((k, i) => {
    tbody.innerHTML += `<tr><td>${i+1}</td><td>${k.tanggal}</td><td><b>${k.nama}</b></td><td><span style="color:red; font-weight:bold;">${k.status}</span></td><td><button class="btn btn-danger btn-sm" onclick="kasbonList.splice(${i},1);saveDataToStorage();renderKasbonTable();">Hapus</button></td></tr>`;
  });
}

function loadProfilData() {
  document.getElementById('browserPageTitle').innerText = tokoProfile.nama;
  document.getElementById('tokoNama').value = tokoProfile.nama;
  document.getElementById('tokoTelp').value = tokoProfile.telp;
  document.getElementById('tokoAlamat').value = tokoProfile.alamat;
}

function saveProfilToko(e) {
  e.preventDefault();
  tokoProfile.nama = document.getElementById('tokoNama').value;
  tokoProfile.telp = document.getElementById('tokoTelp').value;
  tokoProfile.alamat = document.getElementById('tokoAlamat').value;
  saveDataToStorage();
  loadProfilData();
  renderUniversalQRCode();
  alert("Profil Disimpan!");
}

function toggleForm(fId, iId) { document.getElementById(fId).classList.toggle('collapsed'); }
function formatNumber(n) { return new Intl.NumberFormat('id-ID').format(n); }
function updateDashboardStats() {}
