const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const { initDatabase } = require('./database');
const { startDiscovery } = require('./discovery');
const { setupSync } = require('./sync');
const routes = require('./routes');

// Cargar variables de entorno
dotenv.config();

// Inicializar el servidor Express
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Inicializar la base de datos
initDatabase();

// Configurar rutas
app.use('/api', routes);

// Ruta base
app.get('/', (req, res) => {
  res.json({ 
    message: 'Survival Communicator Server', 
    status: 'online',
    nodeName: process.env.NODE_NAME || 'UnnamedNode'
  });
});

// Iniciar el servidor
const server = app.listen(PORT, () => {
  console.log(`Servidor escuchando en el puerto ${PORT}`);
  
  // Iniciar el descubrimiento de nodos
  startDiscovery();
  
  // Configurar sincronización entre nodos
  setupSync();
  setupWebSocket(server);
});

// Manejo de errores y cierre gracioso
process.on('SIGINT', () => {
  console.log('Cerrando servidor...');
  server.close(() => {
    console.log('Servidor cerrado.');
    process.exit(0);
  });
});

module.exports = server;