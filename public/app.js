const API_BASE = 'http://' + window.location.host;

let devices = [];
let selectedSeat = null;

// Map configuration
const ROWS = 4;
const SEATS_PER_ROW = 9;

// DOM Elements
const tabMap = document.getElementById('tab-map');
const tabKeys = document.getElementById('tab-keys');
const viewMap = document.getElementById('view-map');
const viewKeys = document.getElementById('view-keys');
const statsSection = document.getElementById('stats-section');
const pageTitle = document.getElementById('page-title');

const seatsContainer = document.getElementById('seats-container');
const devicesList = document.getElementById('devices-list');
const statTotal = document.getElementById('stat-total');
const statOnline = document.getElementById('stat-online');
const statOffline = document.getElementById('stat-offline');

const assignModal = document.getElementById('assign-modal');
const modalTitle = document.getElementById('modal-title');
const unassignedList = document.getElementById('unassigned-devices');
const btnCancelModal = document.getElementById('btn-cancel-modal');

const fcModal = document.getElementById('fast-connect-modal');
const fcModalTitle = document.getElementById('fc-modal-title');
const fcId = document.getElementById('fc-id');
const fcPass = document.getElementById('fc-pass');
const btnCloseFc = document.getElementById('btn-close-fc');
const btnUnassignFc = document.getElementById('btn-unassign-fc');

// --- TABS LOGIC ---
tabMap.addEventListener('click', (e) => {
    e.preventDefault();
    tabMap.classList.add('active');
    tabKeys.classList.remove('active');
    viewMap.style.display = 'block';
    viewKeys.style.display = 'none';
    statsSection.style.display = 'none';
    pageTitle.innerText = 'Sơ Đồ Phòng Máy';
});

tabKeys.addEventListener('click', (e) => {
    e.preventDefault();
    tabKeys.classList.add('active');
    tabMap.classList.remove('active');
    viewKeys.style.display = 'block';
    viewMap.style.display = 'none';
    statsSection.style.display = 'flex';
    pageTitle.innerText = 'Main Dashboard';
});

// --- RENDER MAP ---
function renderMap() {
    seatsContainer.innerHTML = '';
    
    for (let r = ROWS; r >= 1; r--) {
        const rowDiv = document.createElement('div');
        rowDiv.className = 'seat-row';
        
        const labelDiv = document.createElement('div');
        labelDiv.className = 'row-label';
        labelDiv.innerText = `Row ${r}`;
        rowDiv.appendChild(labelDiv);
        
        const gridDiv = document.createElement('div');
        gridDiv.className = 'seats-grid';
        
        // Tính toán ID của từng ghế: M01 - M36
        const startSeat = (r - 1) * SEATS_PER_ROW + 1;
        const endSeat = r * SEATS_PER_ROW;
        
        for (let s = startSeat; s <= endSeat; s++) {
            const seatId = 'M' + s.toString().padStart(2, '0');
            const seatDiv = document.createElement('div');
            
            // Staggering (zig zag)
            const staggerClass = (s % 2 === 0) ? 'stagger-up' : 'stagger-down';
            
            seatDiv.className = `seat empty ${staggerClass}`;
            seatDiv.id = `seat-${seatId}`;
            seatDiv.innerText = seatId;
            
            // Click handler
            seatDiv.addEventListener('click', () => handleSeatClick(seatId));
            
            gridDiv.appendChild(seatDiv);
        }
        
        rowDiv.appendChild(gridDiv);
        seatsContainer.appendChild(rowDiv);
    }
}

// --- FETCH DATA ---
async function fetchDevices() {
    try {
        const res = await fetch(`${API_BASE}/api/devices`);
        devices = await res.json();
        updateUI();
    } catch (error) {
        console.error('Error fetching devices:', error);
    }
}

// --- UPDATE UI WITH DATA ---
function updateUI() {
    // 1. Reset all seats to empty
    document.querySelectorAll('.seat').forEach(el => {
        el.className = el.className.replace(/online|offline/g, '').trim();
        if (!el.classList.contains('empty')) el.classList.add('empty');
        // Reset text
        const sid = el.id.replace('seat-', '');
        el.innerText = sid;
        el.title = '';
    });

    let onlineCount = 0;
    const now = new Date();

    devicesList.innerHTML = '';

    devices.forEach(device => {
        const lastSeen = new Date(device.last_seen);
        const isOnline = (now - lastSeen) < 60000; // 1 phút
        if (isOnline) onlineCount++;

        // Nếu thiết bị đã được gán vào 1 ghế
        if (device.seat_id) {
            const seatEl = document.getElementById(`seat-${device.seat_id}`);
            if (seatEl) {
                seatEl.classList.remove('empty');
                seatEl.classList.add(isOnline ? 'online' : 'offline');
                seatEl.title = `ID: ${device.id}\nHost: ${device.hostname}`;
            }
        }

        // Render Table Row
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${device.seat_id ? `<strong>${device.seat_id}</strong>` : '<span class="text-muted">-</span>'}</td>
            <td><span class="text-primary">${device.id}</span></td>
            <td><span class="badge ${device.seat_id ? 'used' : 'unused'}">${device.seat_id ? 'USED' : 'UNUSED'}</span></td>
            <td>${device.hostname}</td>
            <td>
                ${device.seat_id 
                    ? `<span class="text-danger" onclick="unassignDevice('${device.id}')">Thu Hồi</span>` 
                    : `-`}
            </td>
        `;
        devicesList.appendChild(tr);
    });

    // Cập nhật thống kê
    statTotal.innerText = devices.length;
    statOnline.innerText = onlineCount;
    statOffline.innerText = devices.length - onlineCount;
}

// --- SEAT CLICK HANDLER (ASSIGNMENT & FAST CONNECT) ---
function handleSeatClick(seatId) {
    selectedSeat = seatId;
    
    // Kiểm tra xem ghế này đã có ai ngồi chưa
    const deviceInSeat = devices.find(d => d.seat_id === seatId);
    if (deviceInSeat) {
        // FAST CONNECT MODAL
        fcModalTitle.innerText = `Kết nối nhanh: ${seatId}`;
        fcId.innerText = deviceInSeat.id;
        fcPass.innerText = deviceInSeat.pass || 'Unknown';
        
        btnUnassignFc.onclick = () => {
            if (confirm(`Bạn có chắc muốn thu hồi máy ở ghế ${seatId}?`)) {
                unassignDevice(deviceInSeat.id);
                fcModal.classList.remove('show');
            }
        };
        
        fcModal.classList.add('show');
        return;
    }

    // Hiển thị danh sách thiết bị chưa gán
    const unassigned = devices.filter(d => !d.seat_id);
    
    modalTitle.innerText = `Gán thiết bị cho ghế ${seatId}`;
    unassignedList.innerHTML = '';

    if (unassigned.length === 0) {
        unassignedList.innerHTML = '<div style="padding: 16px; text-align: center; color: gray;">Không có thiết bị nào đang chờ gán.</div>';
    } else {
        unassigned.forEach(d => {
            const el = document.createElement('div');
            el.className = 'device-item';
            el.innerHTML = `
                <div>
                    <div class="device-id">${d.id}</div>
                    <div class="device-host">${d.hostname}</div>
                </div>
                <button class="btn-primary" style="padding: 4px 12px; font-size: 12px;">Chọn</button>
            `;
            el.addEventListener('click', () => assignDevice(d.id, seatId));
            unassignedList.appendChild(el);
        });
    }

    assignModal.classList.add('show');
}

btnCancelModal.addEventListener('click', () => {
    assignModal.classList.remove('show');
});

btnCloseFc.addEventListener('click', () => {
    fcModal.classList.remove('show');
});

function copyText(elementId) {
    const text = document.getElementById(elementId).innerText;
    navigator.clipboard.writeText(text).then(() => {
        alert('Đã copy: ' + text);
    });
}

// --- API CALLS ---
async function assignDevice(rustdeskId, seatId) {
    try {
        await fetch(`${API_BASE}/api/device/assign`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: rustdeskId, seat_id: seatId })
        });
        assignModal.classList.remove('show');
        fetchDevices();
    } catch (err) {
        alert('Lỗi khi gán thiết bị');
    }
}

async function unassignDevice(rustdeskId) {
    try {
        await fetch(`${API_BASE}/api/device/unassign`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: rustdeskId })
        });
        fetchDevices();
    } catch (err) {
        alert('Lỗi khi thu hồi thiết bị');
    }
}

// Khởi tạo
renderMap();
fetchDevices();
setInterval(fetchDevices, 5000); // Tự động cập nhật mỗi 5 giây
