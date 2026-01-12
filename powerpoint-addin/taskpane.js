let ws = null;
let isConnected = false;

// Connect to WebSocket server
function connectToServer() {
    if (ws) return;
    
    ws = new WebSocket('ws://localhost:3001');
    
    ws.onopen = () => {
        console.log('Connected to GestureFlow server');
        isConnected = true;
        updateUI();
    };
    
    ws.onclose = () => {
        console.log('Disconnected from GestureFlow server');
        isConnected = false;
        updateUI();
    };
    
    ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        isConnected = false;
        updateUI();
    };
}

// Update UI based on connection status
function updateUI() {
    const status = document.getElementById('status');
    const button = document.getElementById('connectButton');
    
    if (isConnected) {
        status.textContent = 'Connected to GestureFlow';
        status.className = 'status connected';
        button.textContent = 'Disconnect';
    } else {
        status.textContent = 'Not Connected';
        status.className = 'status disconnected';
        button.textContent = 'Connect to GestureFlow';
    }
}

// Initialize when Office.js is ready
Office.onReady(() => {
    const button = document.getElementById('connectButton');
    button.addEventListener('click', () => {
        if (isConnected) {
            if (ws) {
                ws.close();
                ws = null;
            }
            isConnected = false;
        } else {
            connectToServer();
        }
        updateUI();
    });
});