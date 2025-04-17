const axios = require('axios');
const { getAllNodes, getAllUsers, createUser } = require('./database');

// Intervalo para la sincronización (en milisegundos)
const SYNC_INTERVAL = 300000; // 5 minutos

// Configurar sincronización entre nodos
function setupSync() {
  // Sincronizar periódicamente
  setInterval(syncWithKnownNodes, SYNC_INTERVAL);
  
  // Sincronizar al inicio
  setTimeout(syncWithKnownNodes, 10000); // Pequeño retraso inicial
}

// Sincronizar con todos los nodos conocidos
async function syncWithKnownNodes() {
  try {
    console.log('Iniciando sincronización con nodos conocidos...');
    
    // Obtener todos los nodos conocidos
    const nodes = await getAllNodes();
    
    if (nodes.length === 0) {
      console.log('No hay nodos conocidos para sincronizar');
      return;
    }
    
    // Realizar sincronización con cada nodo
    for (const node of nodes) {
      try {
        await syncWithNode(node);
      } catch (error) {
        console.error(`Error al sincronizar con nodo ${node.name} (${node.address}:${node.port}):`, error.message);
      }
    }
    
    console.log('Sincronización completada');
  } catch (error) {
    console.error('Error durante la sincronización:', error.message);
  }
}

// Sincronizar con un nodo específico
async function syncWithNode(node) {
  console.log(`Sincronizando con nodo ${node.name} (${node.address}:${node.port})...`);
  
  try {
    // Obtener usuarios del nodo remoto
    const response = await axios.get(`http://${node.address}:${node.port}/api/users/sync`, {
      timeout: 5000 // 5 segundos de timeout
    });
    
    const remoteUsers = response.data.users;
    
    if (!Array.isArray(remoteUsers)) {
      throw new Error('Formato de datos inválido recibido del nodo remoto');
    }
    
    console.log(`Recibidos ${remoteUsers.length} usuarios del nodo ${node.name}`);
    
    // Obtener usuarios locales para luego enviarlos
    const localUsers = await getAllUsers();
    
    // Procesar usuarios recibidos
    for (const user of remoteUsers) {
      try {
        // Verificar datos mínimos
        if (!user.id || !user.username || !user.public_key) {
          console.warn('Datos de usuario incompletos, omitiendo:', user);
          continue;
        }
        
        // Intentar crear el usuario (la función maneja duplicados)
        await createUser(user.id, user.username, user.public_key);
      } catch (error) {
        if (error.message.includes('UNIQUE constraint failed')) {
          // Ignorer errores de unicidad (usuario ya existe)
        } else {
          console.error('Error al guardar usuario remoto:', error.message);
        }
      }
    }
    
    // Enviar usuarios locales al nodo remoto
    await axios.post(`http://${node.address}:${node.port}/api/users/sync`, {
      users: localUsers
    }, {
      timeout: 5000
    });
    
    console.log(`Sincronización exitosa con nodo ${node.name}`);
  } catch (error) {
    console.error(`Error de comunicación con nodo ${node.name}:`, error.message);
    throw error;
  }
}

module.exports = {
  setupSync
};