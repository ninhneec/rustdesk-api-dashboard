const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Khởi tạo Database SQLite
const db = new sqlite3.Database('./devices.db', (err) => {
    if (err) {
        console.error('Error connecting to database:', err.message);
    } else {
        console.log('Connected to the SQLite database.');
        db.run(`CREATE TABLE IF NOT EXISTS devices (
            id TEXT PRIMARY KEY,
            pass TEXT,
            hostname TEXT,
            seat_id TEXT,
            last_seen DATETIME DEFAULT CURRENT_TIMESTAMP
        )`, (err) => {
            if (!err) {
                db.run(`ALTER TABLE devices ADD COLUMN seat_id TEXT`, () => {});
            }
        });
        // Bảng lưu tin nhắn Chat
        db.run(`CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            rustdesk_id TEXT,
            message TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);
    }
});

// Giao tiếp Socket.io
io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    // Bắt sự kiện có tin nhắn mới từ App Chat
    socket.on('send_chat', (data) => {
        // data: { rustdesk_id, message }
        db.run(`INSERT INTO messages (rustdesk_id, message) VALUES (?, ?)`, [data.rustdesk_id, data.message], function(err) {
            if (!err) {
                // Broadcast cho tất cả admin (và client khác)
                io.emit('new_chat', {
                    id: this.lastID,
                    rustdesk_id: data.rustdesk_id,
                    message: data.message,
                    timestamp: new Date().toISOString()
                });
            }
        });
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
    });
});

// API: Lấy lịch sử chat
app.get('/api/chat/history', (req, res) => {
    db.all(`SELECT * FROM messages ORDER BY timestamp DESC LIMIT 50`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json(rows.reverse()); // Đảo lại theo thứ tự thời gian cũ -> mới
    });
});

// API: Cập nhật hoặc thêm thiết bị mới
app.post('/api/device/save-password', (req, res) => {
    const { id, pass, hostname } = req.body;
    if (!id || !pass) {
        return res.status(400).json({ error: 'Missing id or password' });
    }

    const query = `
        INSERT INTO devices (id, pass, hostname, last_seen)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(id) DO UPDATE SET 
            pass = excluded.pass,
            hostname = excluded.hostname,
            last_seen = CURRENT_TIMESTAMP
    `;

    db.run(query, [id, pass, hostname || 'Unknown'], function (err) {
        if (err) {
            console.error('Error saving device:', err.message);
            return res.status(500).json({ error: 'Database error' });
        }
        res.json({ success: true, message: 'Device saved successfully' });
    });
});

// API: Lấy danh sách thiết bị
app.get('/api/devices', (req, res) => {
    db.all(`SELECT * FROM devices ORDER BY last_seen DESC`, [], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        res.json(rows);
    });
});

// API: Gán thiết bị vào ghế
app.post('/api/device/assign', (req, res) => {
    const { id, seat_id } = req.body;
    if (!id || !seat_id) return res.status(400).json({ error: 'Missing id or seat_id' });

    db.run(`UPDATE devices SET seat_id = ? WHERE id = ?`, [seat_id, id], function(err) {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json({ success: true });
    });
});

// API: Thu hồi (gỡ) thiết bị khỏi ghế
app.post('/api/device/unassign', (req, res) => {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'Missing id' });

    db.run(`UPDATE devices SET seat_id = NULL WHERE id = ?`, [id], function(err) {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json({ success: true });
    });
});

server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
