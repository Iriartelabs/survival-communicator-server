const dgram = require('dgram');
const os = require('os');
const crypto = require('crypto');
const dotenv = require('dotenv');
const { registerNode } = require('./database');

dotenv.config();

// Puerto para descubrimiento de nodos
const DISCOVERY_PORT = parseInt(process.env.NODE_DISCOVERY_PORT) || 4000;

// ID único para este nodo
const NODE_ID = crypto.randomBytes(16).toString('hex');
const NODE_NAME = process.env.NODE_NAME || 'UnnamedNode';

// Servidor UDP para descubrimiento
const server = dgram.createSocket('udp4');

// Mensaje de anuncio
function getAnnounceMessage() {
  return JSON.stringify({
    type: 'ANNOUNCE',
    id: NODE_ID,
    name: NODE_NAME,
    port: process.env.PORT || 3000,
    timestamp: Date.now()
  });
}

// Iniciar descubrimiento de nodos
function startDiscovery() {
  // Configurar servidor UDP
  server.on('error', (err) => {
    console.error(`Error en el servidor de descubrimiento: ${err.stack}`);
    server.close();
  });

  server.on('message', (msg, rinfo) => {
    try {
      const message = JSON.parse(msg.toString());
      
      if (message.type === 'ANNOUNCE' && message.id !== NODE_ID) {
        console.log(`Nodo descubierto: ${message.name} (${rinfo.address}:${message.port})`);
        
        // Registrar el nodo en la base de datos
        registerNode(message.id, message.name, rinfo.address, message.port)
          .then(() => {
            console.log(`Nodo registrado: ${message.name}`);
          })
          .catch(err => {
            console.error('Error al registrar nodo:', err.message);
          });
          
        // Responder con nuestro anuncio
        const response = Buffer.from(getAnnounceMessage());
        server.send(response, 0, response.length, DISCOVERY_PORT, rinfo.address);
      }
    } catch (error) {
      console.error('Error al procesar mensaje:', error.message);
    }
  });

  server.on('listening', () => {
    const address = server.address();
    console.log(`Servidor de descubrimiento escuchando en ${address.address}:${address.port}`);
    
    // Configurar broadcast
    server.setBroadcast(true);
    
    // Anunciar nuestra presencia periódicamente
    setInterval(broadcastAnnouncement, 60000);
    
    // Anunciar inmediatamente al inicio
    broadcastAnnouncement();
  });

  // Enlazar al puerto de descubrimiento
  server.bind(DISCOVERY_PORT);
}

// Enviar anuncio broadcast a la red local
function broadcastAnnouncement() {
  const interfaces = os.networkInterfaces();
  const message = Buffer.from(getAnnounceMessage());
  
  // Enviar a todas las interfaces de red
  Object.keys(interfaces).forEach((iface) => {
    interfaces[iface].forEach((details) => {
      // Solo IPv4 y no loopback
      if (details.family === 'IPv4' && !details.internal) {
        const subnet = details.address.split('.');
        subnet[3] = '255';
        const broadcastAddr = subnet.join('.');
        
        server.send(message, 0, message.length, DISCOVERY_PORT, broadcastAddr, (err) => {
          if (err) {
            console.error(`Error al enviar broadcast a ${broadcastAddr}:`, err.message);
          } else {
            console.log(`Anuncio enviado a ${broadcastAddr}:${DISCOVERY_PORT}`);
          }
        });
      }
    });
  });
}

module.exports = {
  startDiscovery
};