const WebSocket = require('ws')

const sessions = new Map()

function setupWebSocket(server) {
    const wss = new WebSocket.Server({ server })

    wss.on('connection', (ws, req) => {
        const urlParts = req.url.split('/')
        const userId = urlParts[urlParts.length - 1]

        console.log(`Usuario conectado: ${userId}`)
        sessions.set(userId, ws)

        ws.on('message', (data) => {
            try {
                // 🔐 El mensaje ya está cifrado extremo a extremo (Base64 JSON)
                const encryptedPayload = data.toString()

                // Parseamos el contenido solo para extraer el destinatario
                const parsed = JSON.parse(Buffer.from(encryptedPayload, 'base64').toString('utf-8'))
                const recipientId = parsed.recipientId
                const recipientWs = sessions.get(recipientId)

                if (recipientWs && recipientWs.readyState === WebSocket.OPEN) {
                    recipientWs.send(encryptedPayload)
                } else {
                    console.warn(`Usuario ${recipientId} no conectado`)
                }
            } catch (err) {
                console.error("Error al manejar mensaje:", err)
            }
        })

        ws.on('close', () => {
            sessions.delete(userId)
            console.log(`Usuario desconectado: ${userId}`)
        })
    })
}

module.exports = { setupWebSocket }
