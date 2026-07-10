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
const searchInput = document.getElementById('search-input');

const chatHistory = document.getElementById('chat-history');
const adminChatInput = document.getElementById('admin-chat-input');
const adminChatSend = document.getElementById('admin-chat-send');

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

const mapBoard = document.getElementById('map-board');
const mapCanvas = document.getElementById('map-canvas');
const btnZoomIn = document.querySelector('.map-controls .btn-icon:nth-child(1)');
const btnReset = document.querySelector('.map-controls .btn-icon:nth-child(2)');
const btnZoomOut = document.querySelector('.map-controls .btn-icon:nth-child(3)');

let scale = 1;
let translateX = -50; // starts at -50% due to absolute positioning centering
let translateY = -50;
let isDragging = false;
let startX, startY;

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

    const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';

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

        // Search filter
        const matchSearch = (device.seat_id && device.seat_id.toLowerCase().includes(searchTerm)) ||
                            device.id.toLowerCase().includes(searchTerm) ||
                            device.hostname.toLowerCase().includes(searchTerm);

        if (!matchSearch) return;

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

if (searchInput) {
    searchInput.addEventListener('input', () => {
        updateUI();
    });
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

// --- PAN & ZOOM LOGIC ---
function updateTransform() {
    // Keep it smooth
    mapCanvas.style.transform = `translate(calc(-50% + ${translateX}px), calc(-50% + ${translateY}px)) scale(${scale})`;
}

if (mapBoard && mapCanvas) {
    // Zoom with wheel
    mapBoard.addEventListener('wheel', (e) => {
        e.preventDefault();
        const zoomSpeed = 0.1;
        if (e.deltaY < 0) scale = Math.min(scale + zoomSpeed, 3);
        else scale = Math.max(scale - zoomSpeed, 0.3);
        updateTransform();
    });

    // Pan with mouse drag
    mapBoard.addEventListener('mousedown', (e) => {
        isDragging = true;
        startX = e.clientX - translateX;
        startY = e.clientY - translateY;
    });

    window.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        translateX = e.clientX - startX;
        translateY = e.clientY - startY;
        // Tắt transition khi đang drag để mượt hơn
        mapCanvas.style.transition = 'none'; 
        updateTransform();
    });

    window.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            mapCanvas.style.transition = 'transform 0.1s ease-out';
        }
    });

    // Buttons
    if (btnZoomIn) btnZoomIn.addEventListener('click', () => { scale = Math.min(scale + 0.2, 3); updateTransform(); });
    if (btnZoomOut) btnZoomOut.addEventListener('click', () => { scale = Math.max(scale - 0.2, 0.3); updateTransform(); });
    if (btnReset) btnReset.addEventListener('click', () => { scale = 1; translateX = 0; translateY = 0; updateTransform(); });
    
    // Initial center
    translateX = 0; translateY = 0;
    updateTransform();
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

// --- CHAT LOGIC ---
const socket = io();

function appendAdminMessage(sender, text, timeStr) {
    const div = document.createElement('div');
    div.className = 'admin-msg-item';
    div.innerHTML = `<span class="msg-sender">${sender}</span> ${text} <span class="msg-time">${timeStr}</span>`;
    chatHistory.appendChild(div);
    chatHistory.scrollTop = chatHistory.scrollHeight;
}

// Lấy lịch sử chat ban đầu
fetch('/api/chat/history').then(r => r.json()).then(rows => {
    rows.forEach(r => {
        let sender = r.rustdesk_id === 'ADMIN_BROADCAST' ? 'ADMIN (All)' : r.rustdesk_id;
        const timeStr = new Date(r.timestamp).toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'});
        appendAdminMessage(sender, r.message, timeStr);
    });
});

socket.on('new_chat', (data) => {
    let sender = data.rustdesk_id;
    if (sender.startsWith('ADMIN')) sender = 'ADMIN';

    const timeStr = new Date(data.timestamp).toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'});
    appendAdminMessage(sender, data.message, timeStr);

    // Tìm xem máy này đang ngồi ở ghế nào
    const device = devices.find(d => d.id === data.rustdesk_id);
    if (device && device.seat_id) {
        // Tạo bubble
        const seatEl = document.getElementById(`seat-${device.seat_id}`);
        if (seatEl) {
            const bubble = document.createElement('div');
            bubble.className = 'chat-bubble show';
            bubble.innerText = data.message;
            seatEl.appendChild(bubble);

            // Tự xóa sau 3s
            setTimeout(() => {
                if (bubble.parentNode) bubble.parentNode.removeChild(bubble);
            }, 3000);
        }
    }
});

function sendAdminChat() {
    const text = adminChatInput.value.trim();
    if (!text) return;

    socket.emit('send_chat', {
        rustdesk_id: 'ADMIN_BROADCAST',
        message: text
    });
    adminChatInput.value = '';
}

adminChatSend.addEventListener('click', sendAdminChat);
adminChatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendAdminChat();
});

// Khởi tạo
renderMap();
fetchDevices();
setInterval(fetchDevices, 5000); // Tự động cập nhật mỗi 5 giây
