// State Data Utama
let storeName = localStorage.getItem('storeName') || "APLIKASI KASIR";
let barangList = JSON.parse(localStorage.getItem('barangList')) || [
    { id: 1, nama: "Minyak Goreng 1L", harga: 18000, stok: 30 },
    { id: 2, nama: "Gula Pasir 1Kg", harga: 14500, stok: 25 },
    { id: 3, nama: "Kopi Bubuk Sachet", harga: 2000, stok: 50 }
];
let transaksiList = JSON.parse(localStorage.getItem('transaksiList')) || [];
let cart = [];

// Inisialisasi Halaman & Query URL Scanner Barcode
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('brandTitle').innerText = storeName;
    document.getElementById('storeNameDisplay').innerText = storeName;
    document.getElementById('settingStoreName').value = storeName;

    const urlParams = new URLSearchParams(window.location.search);
    const mode = urlParams.get('mode');

    if (mode === 'kasir') {
        // Mode Barcode Scan langsung ke Kasir tanpa menu manajemen lain
        document.getElementById('sidebar').style.display = 'none';
        switchPage('transaksi-kasir');
        setupBarcodeNavigation();
    } else {
        setupEventListeners();
        renderBarang();
        renderTransaksi();
        renderKasbon();
        renderPOSGrid();
        generatePermanentQR();
    }
});

function setupBarcodeNavigation() {
    // Batasi menu khusus kasir/transaksi/kasbon saat dibuka lewat barcode
    const menuList = document.getElementById('sidebarMenu');
    menuList.innerHTML = `
        <li data-target="transaksi-kasir" class="active"><i class="fa-solid fa-cart-shopping"></i> Transaksi Kasir</li>
        <li data-target="data-transaksi"><i class="fa-solid fa-receipt"></i> Data Transaksi</li>
        <li data-target="kasbon-piutang"><i class="fa-solid fa-file-invoice-dollar"></i> Kasbon / Piutang</li>
    `;
    document.getElementById('sidebar').style.display = 'block';
    setupEventListeners();
    renderBarang();
    renderTransaksi();
    renderKasbon();
    renderPOSGrid();
}

function saveData() {
    localStorage.setItem('barangList', JSON.stringify(barangList));
    localStorage.setItem('transaksiList', JSON.stringify(transaksiList));
    localStorage.setItem('storeName', storeName);
    generatePermanentQR();
}

function switchPage(targetId) {
    document.querySelectorAll('.page-section').forEach(sec => sec.classList.remove('active'));
    document.getElementById(targetId).classList.add('active');
    document.querySelectorAll('.sidebar-menu li').forEach(li => li.classList.remove('active'));
    const activeLi = document.querySelector(`.sidebar-menu li[data-target="${targetId}"]`);
    if (activeLi) activeLi.classList.add('active');
}

function setupEventListeners() {
    document.querySelectorAll('.sidebar-menu li').forEach(li => {
        li.addEventListener('click', () => {
            const target = li.getAttribute('data-target');
            switchPage(target);
        });
    });

    // Pengaturan Toko
    document.getElementById('saveSetting').addEventListener('click', () => {
        storeName = document.getElementById('settingStoreName').value || "APLIKASI KASIR";
        document.getElementById('brandTitle').innerText = storeName;
        document.getElementById('storeNameDisplay').innerText = storeName;
        saveData();
        alert('Pengaturan berhasil disimpan!');
    });

    // Data Barang Events
    document.getElementById('btnTambahBarang').addEventListener('click', () => openModal());
    document.getElementById('closeModal').addEventListener('click', closeModal);
    document.getElementById('saveBarang').addEventListener('click', saveBarangItem);

    // POS / Transaksi Kasir
    document.getElementById('posSearch').addEventListener('input', (e) => {
        renderPOSGrid(e.target.value);
    });

    document.getElementById('payAmount').addEventListener('input', (e) => {
        const total = cart.reduce((sum, item) => sum + (item.harga * item.qty), 0);
        const bayar = parseFloat(e.target.value) || 0;
        document.getElementById('changeAmount').innerText = `Rp ${(bayar - total >= 0 ? bayar - total : 0).toLocaleString()}`;
    });

    document.getElementById('processTransaction').addEventListener('click', processTransaction);
}

// --- RENDER DATA BARANG ---
function renderBarang() {
    const tbody = document.querySelector('#tabelBarang tbody');
    tbody.innerHTML = '';
    barangList.forEach((item, index) => {
        tbody.innerHTML += `
            <tr>
                <td>${index + 1}</td>
                <td>${item.nama}</td>
                <td>Rp ${item.harga.toLocaleString()}</td>
                <td>${item.stok}</td>
                <td>
                    <button class="btn btn-primary" onclick="editBarang(${item.id})">Edit</button>
                    <button class="btn btn-danger" onclick="deleteBarang(${item.id})">Hapus</button>
                </td>
            </tr>
        `;
    });
    renderPOSGrid();
}

function openModal(item = null) {
    document.getElementById('modalBarang').classList.add('active');
    if (item) {
        document.getElementById('modalTitle').innerText = "Edit Barang";
        document.getElementById('barangId').value = item.id;
        document.getElementById('namaBarang').value = item.nama;
        document.getElementById('hargaBarang').value = item.harga;
        document.getElementById('stokBarang').value = item.stok;
    } else {
        document.getElementById('modalTitle').innerText = "Tambah Barang";
        document.getElementById('barangId').value = '';
        document.getElementById('namaBarang').value = '';
        document.getElementById('hargaBarang').value = '';
        document.getElementById('stokBarang').value = '';
    }
}

function closeModal() {
    document.getElementById('modalBarang').classList.remove('active');
}

function saveBarangItem() {
    const id = document.getElementById('barangId').value;
    const nama = document.getElementById('namaBarang').value;
    const harga = parseFloat(document.getElementById('hargaBarang').value) || 0;
    const stok = parseInt(document.getElementById('stokBarang').value) || 0;

    if (!nama) return alert('Nama barang wajib diisi!');

    if (id) {
        const item = barangList.find(b => b.id == id);
        if (item) { item.nama = nama; item.harga = harga; item.stok = stok; }
    } else {
        const newId = barangList.length > 0 ? Math.max(...barangList.map(b => b.id)) + 1 : 1;
        barangList.push({ id: newId, nama, harga, stok });
    }
    saveData();
    closeModal();
    renderBarang();
}

function editBarang(id) {
    const item = barangList.find(b => b.id == id);
    if (item) openModal(item);
}

function deleteBarang(id) {
    if (confirm('Yakin ingin menghapus barang ini?')) {
        barangList = barangList.filter(b => b.id != id);
        saveData();
        renderBarang();
    }
}

// --- QR BARCODE PERMANEN ---
function generatePermanentQR() {
    const container = document.getElementById('qrCodeContainer');
    if (!container) return;
    container.innerHTML = '';
    const currentUrl = window.location.href.split('?')[0] + `?store=${encodeURIComponent(storeName)}&mode=kasir`;
    
    new QRCode(container, {
        text: currentUrl,
        width: 180,
        height: 180
    });
    document.getElementById('qrUrlText').innerText = currentUrl;
}

// --- POS / TRANSAKSI KASIR ---
function renderPOSGrid(keyword = '') {
    const grid = document.getElementById('posGrid');
    if (!grid) return;
    grid.innerHTML = '';
    const filtered = barangList.filter(b => b.nama.toLowerCase().includes(keyword.toLowerCase()));

    filtered.forEach(item => {
        grid.innerHTML += `
            <div class="pos-item" onclick="addToCart(${item.id})">
                <h4>${item.nama}</h4>
                <p>Rp ${item.harga.toLocaleString()}</p>
                <small>Stok: ${item.stok}</small>
            </div>
        `;
    });
}

function addToCart(id) {
    const item = barangList.find(b => b.id == id);
    if (!item || item.stok <= 0) return alert('Stok habis!');

    const cartItem = cart.find(c => c.id == id);
    if (cartItem) {
        if (cartItem.qty < item.stok) cartItem.qty++;
        else alert('Stok tidak mencukupi!');
    } else {
        cart.push({ id: item.id, nama: item.nama, harga: item.harga, qty: 1 });
    }
    renderCart();
}

function renderCart() {
    const list = document.getElementById('cartList');
    if (!list) return;
    list.innerHTML = '';
    let total = 0;

    cart.forEach(c => {
        total += c.harga * c.qty;
        list.innerHTML += `
            <div style="display:flex; justify-content:space-between; margin-bottom:8px; align-items:center;">
                <span>${c.nama} x${c.qty}</span>
                <span>Rp ${(c.harga * c.qty).toLocaleString()}</span>
            </div>
        `;
    });
    document.getElementById('cartTotal').innerText = `Rp ${total.toLocaleString()}`;
}

function processTransaction() {
    if (cart.length === 0) return alert('Keranjang masih kosong!');
    const total = cart.reduce((sum, item) => sum + (item.harga * item.qty), 0);
    const status = document.getElementById('paymentStatus').value;

    // Kurangi stok barang (Sinkronisasi Stok)
    cart.forEach(c => {
        const barang = barangList.find(b => b.id == c.id);
        if (barang) barang.stok -= c.qty;
    });

    const newTrx = {
        id: 'TRX-' + Date.now().toString().slice(-6),
        tanggal: new Date().toLocaleString(),
        total: total,
        status: status,
        items: [...cart]
    };

    transaksiList.push(newTrx);
    cart = [];
    saveData();
    renderBarang();
    renderTransaksi();
    renderKasbon();
    renderCart();
    document.getElementById('payAmount').value = '';
    document.getElementById('changeAmount').innerText = 'Rp 0';

    alert('Transaksi berhasil diproses & stok tersinkronisasi!');

    // Pindah halaman otomatis sesuai status kasbon
    if (status === 'kasbon') {
        switchPage('kasbon-piutang');
    } else {
        switchPage('data-transaksi');
    }
}

// --- DATA TRANSAKSI & KASBON ---
function renderTransaksi() {
    const tbody = document.querySelector('#tabelTransaksi tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    transaksiList.forEach(t => {
        tbody.innerHTML += `
            <tr>
                <td>${t.id}</td>
                <td>${t.tanggal}</td>
                <td>Rp ${t.total.toLocaleString()}</td>
                <td>${t.status.toUpperCase()}</td>
                <td>
                    <button class="btn btn-secondary" onclick="printTransaksi('${t.id}')">Print</button>
                    <button class="btn btn-danger" onclick="deleteTransaksi('${t.id}')">Hapus</button>
                </td>
            </tr>
        `;
    });
}

function renderKasbon() {
    const tbody = document.querySelector('#tabelKasbon tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    const kasbonList = transaksiList.filter(t => t.status === 'kasbon');
    kasbonList.forEach(t => {
        tbody.innerHTML += `
            <tr>
                <td>${t.id}</td>
                <td>${t.tanggal}</td>
                <td>Rp ${t.total.toLocaleString()}</td>
                <td><span style="color:red; font-weight:bold;">BELUM LUNAS</span></td>
                <td>
                    <button class="btn btn-primary" onclick="detailKasbon('${t.id}')">Detail</button>
                    <button class="btn btn-success" onclick="lunaskanKasbon('${t.id}')">Lunaskan</button>
                </td>
            </tr>
        `;
    });
}

function deleteTransaksi(id) {
    if (confirm('Hapus data transaksi ini?')) {
        transaksiList = transaksiList.filter(t => t.id !== id);
        saveData();
        renderTransaksi();
        renderKasbon();
    }
}

function printTransaksi(id) {
    const t = transaksiList.find(trx => trx.id === id);
    if (!t) return;
    let details = t.items.map(i => `${i.nama} x${i.qty} = Rp ${(i.harga * i.qty).toLocaleString()}`).join('\n');
    alert(`=== STRUK ${storeName} ===\nID: ${t.id}\nTanggal: ${t.tanggal}\n--------------------\n${details}\n--------------------\nTotal: Rp ${t.total.toLocaleString()}\nStatus: ${t.status.toUpperCase()}`);
}

function detailKasbon(id) {
    printTransaksi(id);
}

function lunaskanKasbon(id) {
    const t = transaksiList.find(trx => trx.id === id);
    if (t) {
        t.status = 'lunas';
        saveData();
        renderTransaksi();
        renderKasbon();
        alert('Kasbon telah dilunaskan!');
    }
}
