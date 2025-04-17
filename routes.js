const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { 
  getAllUsers, 
  getUserByUsername, 
  createUser, 
  updateUserLastSeen,
  getAllNodes 
} = require('./database');

// Middleware para verificar JWT (opcional para algunas rutas)
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) return res.status(401).json({ error: 'Token no proporcionado' });
  
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Token inválido' });
    req.user = user;
    next();
  });
}

// Ruta para registrar un nuevo usuario
router.post('/users/register', async (req, res) => {
  try {
    const { username, publicKey } = req.body;
    
    if (!username || !publicKey) {
      return res.status(400).json({ error: 'Nombre de usuario y clave pública son requeridos' });
    }
    
    // Verificar si el usuario ya existe
    const existingUser = await getUserByUsername(username);
    if (existingUser) {
      return res.status(409).json({ error: 'El nombre de usuario ya está en uso' });
    }
    
    // Generar ID único
    const userId = crypto.randomBytes(16).toString('hex');
    
    // Crear el usuario
    const user = await createUser(userId, username, publicKey);
    
    // Generar token JWT
    const token = jwt.sign(
      { id: userId, username },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );
    
    res.status(201).json({
      message: 'Usuario registrado exitosamente',
      user: {
        id: userId,
        username,
        publicKey
      },
      token
    });
  } catch (error) {
    console.error('Error al registrar usuario:', error.message);
    res.status(500).json({ error: 'Error al registrar usuario' });
  }
});

// Ruta para autenticar un usuario existente (opcional)
router.post('/users/login', async (req, res) => {
  try {
    const { username } = req.body;
    
    if (!username) {
      return res.status(400).json({ error: 'Nombre de usuario es requerido' });
    }
    
    // Buscar el usuario
    const user = await getUserByUsername(username);
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    
    // Actualizar "último visto"
    await updateUserLastSeen(user.id);
    
    // Generar token JWT
    const token = jwt.sign(
      { id: user.id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );
    
    res.json({
      message: 'Autenticación exitosa',
      user: {
        id: user.id,
        username: user.username,
        publicKey: user.public_key
      },
      token
    });
  } catch (error) {
    console.error('Error en login:', error.message);
    res.status(500).json({ error: 'Error en la autenticación' });
  }
});

// Ruta para buscar un usuario por nombre
router.get('/users/find/:username', async (req, res) => {
  try {
    const { username } = req.params;
    
    // Buscar el usuario
    const user = await getUserByUsername(username);
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    
    res.json({
      user: {
        id: user.id,
        username: user.username,
        publicKey: user.public_key,
        lastSeen: user.last_seen
      }
    });
  } catch (error) {
    console.error('Error al buscar usuario:', error.message);
    res.status(500).json({ error: 'Error al buscar usuario' });
  }
});

// Ruta para obtener todos los usuarios (con paginación simple)
router.get('/users', async (req, res) => {
  try {
    // En una implementación real, añadiríamos paginación
    const users = await getAllUsers();
    
    res.json({
      count: users.length,
      users: users.map(user => ({
        id: user.id,
        username: user.username,
        publicKey: user.public_key,
        lastSeen: user.last_seen
      }))
    });
  } catch (error) {
    console.error('Error al obtener usuarios:', error.message);
    res.status(500).json({ error: 'Error al obtener usuarios' });
  }
});

// Ruta para sincronización de usuarios entre nodos
router.get('/users/sync', async (req, res) => {
  try {
    const users = await getAllUsers();
    
    res.json({
      count: users.length,
      users: users.map(user => ({
        id: user.id,
        username: user.username,
        public_key: user.public_key,
        last_seen: user.last_seen
      }))
    });
  } catch (error) {
    console.error('Error en sincronización de usuarios:', error.message);
    res.status(500).json({ error: 'Error en sincronización' });
  }
});

// Ruta para recibir usuarios de otros nodos
router.post('/users/sync', async (req, res) => {
  try {
    const { users } = req.body;
    
    if (!Array.isArray(users)) {
      return res.status(400).json({ error: 'Formato incorrecto, se esperaba un array de usuarios' });
    }
    
    let importedCount = 0;
    
    // Procesar cada usuario
    for (const user of users) {
      try {
        // Verificar datos mínimos
        if (!user.id || !user.username || !user.public_key) {
          continue; // Omitir usuarios incompletos
        }
        
        // Intentar guardar (la función maneja duplicados)
        await createUser(user.id, user.username, user.public_key);
        importedCount++;
      } catch (error) {
        // Ignorar errores de unicidad (usuario ya existe)
        if (!error.message.includes('UNIQUE constraint failed')) {
          console.error('Error al importar usuario:', error.message);
        }
      }
    }
    
    res.json({
      message: 'Sincronización completada',
      processed: users.length,
      imported: importedCount
    });
  } catch (error) {
    console.error('Error en importación de usuarios:', error.message);
    res.status(500).json({ error: 'Error en sincronización' });
  }
});

// Ruta para obtener nodos conocidos
router.get('/nodes', async (req, res) => {
  try {
    const nodes = await getAllNodes();
    
    res.json({
      count: nodes.length,
      nodes: nodes.map(node => ({
        id: node.id,
        name: node.name,
        address: node.address,
        port: node.port,
        lastSeen: node.last_seen
      }))
    });
  } catch (error) {
    console.error('Error al obtener nodos:', error.message);
    res.status(500).json({ error: 'Error al obtener nodos' });
  }
});

// Ruta de heartbeat/ping (útil para comprobar conectividad)
router.get('/ping', (req, res) => {
  res.json({
    timestamp: Date.now(),
    message: 'pong',
    nodeName: process.env.NODE_NAME || 'UnnamedNode'
  });
});

module.exports = router;