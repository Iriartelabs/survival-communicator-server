// server/ws.js
const WebSocket = require('ws');

const clients = new Map();

function setupWebSocket(server) {
  const wss = new WebSocket.Server({ server });

  wss.on('connection', (ws, req) => {
    const userId = req.url.split('/').pop();
    if (!userId) {
      ws.close();
      return;
    }

    console.log(`🟢 Usuario conectado por WebSocket: ${userId}`);
    clients.set(userId, ws);

    ws.on('message', (data) => {
      try {
        const encrypted = data.toString();

        // Extraer recipientId desde mensaje ya cifrado (base64 json)
        const decoded = Buffer.from(encrypted, 'base64').toString('utf8');
        const { recipientId } = JSON.parse(decoded);

        const recipientSocket = clients.get(recipientId);
        if (recipientSocket && recipientSocket.readyState === WebSocket.OPEN) {
          recipientSocket.send(encrypted);
        } else {
          console.warn(`⚠️ Usuario ${recipientId} no conectado`);
        }
      } catch (err) {
        console.error('❌ Error al manejar mensaje:', err.message);
      }
    });

    ws.on('close', () => {
      clients.delete(userId);
      console.log(`🔴 Usuario desconectado del WebSocket: ${userId}`);
    });
  });
}

module.exports = { setupWebSocket };
