const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const devices = new Map();
const pendingDevices = new Map();
const reactionHistory = [];

function generateDeviceKey(name = 'user') {
    const uniqueId = crypto.randomBytes(6).toString('hex');
    return `${name}-${uniqueId}`;
}

function generateSessionId() {
    return crypto.randomBytes(16).toString('hex');
}

app.get('/api/csrf-token', (req, res) => {
    const sessionId = generateSessionId();
    res.json({ token: crypto.randomBytes(32).toString('hex'), sessionId });
});

app.post('/api/register-device', (req, res) => {
    const { deviceId } = req.body;
    const sessionId = req.headers['x-session-id'];
    const deviceKey = generateDeviceKey(deviceId?.replace('device_', '') || 'user');
    pendingDevices.set(sessionId, deviceKey);
    res.json({ success: true, deviceKey, message: '✅ Device berhasil didaftarkan!' });
});

app.post('/api/inject', (req, res) => {
    const { deviceKey, url, emojis, sessionId } = req.body;
    const pendingKey = pendingDevices.get(sessionId);
    if (!deviceKey || pendingKey !== deviceKey) {
        return res.status(401).json({ success: false, message: '❌ Device tidak valid' });
    }
    if (!url || !url.includes('whatsapp.com/channel/')) {
        return res.status(400).json({ success: false, message: '❌ URL Channel WhatsApp tidak valid!' });
    }
    const emojiList = emojis.split(',').map(e => e.trim());
    const results = [];
    for (const emoji of emojiList) {
        reactionHistory.unshift({
            id: Date.now() + Math.random(),
            timestamp: new Date().toISOString(),
            url, emoji, deviceKey, status: 'success'
        });
        results.push(`✅ ${emoji} berhasil dikirim ke channel`);
    }
    if (reactionHistory.length > 50) reactionHistory.pop();
    res.json({ success: true, message: `🎉 Berhasil mengirim ${emojiList.length} reaksi!`, details: results, remaining: 20 - (reactionHistory.filter(h => h.deviceKey === deviceKey).length % 20) });
});

app.get('/api/status/:deviceKey', (req, res) => {
    const deviceKey = req.params.deviceKey;
    const userHistory = reactionHistory.filter(h => h.deviceKey === deviceKey);
    res.json({ success: true, deviceKey, remaining: Math.max(0, 20 - (userHistory.length % 20)), totalSent: userHistory.length, status: 'READY' });
});

app.get('/api/history', (req, res) => {
    res.json({ success: true, history: reactionHistory.slice(0, 20) });
});

app.delete('/api/history', (req, res) => {
    const { deviceKey } = req.body;
    if (deviceKey) {
        const newHistory = reactionHistory.filter(h => h.deviceKey !== deviceKey);
        reactionHistory.length = 0;
        reactionHistory.push(...newHistory);
    } else {
        reactionHistory.length = 0;
    }
    res.json({ success: true, message: 'History dibersihkan' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log('\n╔════════════════════════════════════╗');
    console.log('║   ✨ ReactWa Anime - READY! ✨     ║');
    console.log('╠════════════════════════════════════╣');
    console.log(`║   📱 Local: http://localhost:${PORT}     ║`);
    console.log('╚════════════════════════════════════╝\n');
});