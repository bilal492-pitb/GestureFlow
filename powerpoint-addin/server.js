const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// Serve static files
app.use(express.static('.'));
app.use('/powerpoint', express.static('.'));

// Store latest gesture
let latestGesture = null;

// Receive gestures from your main app
app.post('/api/gesture', (req, res) => {
    latestGesture = req.body;
    console.log('Received gesture:', latestGesture);
    res.json({ success: true });
});

// Get latest gesture (for polling)
app.get('/api/gesture', (req, res) => {
    res.json(latestGesture);
    latestGesture = null; // Clear after reading
});

app.listen(3000, () => {
    console.log('Bridge server running at http://localhost:3000');
    console.log('PowerPoint bridge: http://localhost:3000/powerpoint-bridge.html');
});