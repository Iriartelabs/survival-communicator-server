const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

// Ruta de la base de datos
const dbPath = process.env.DATABASE_PATH || './database/survival.db';

// Asegurarse de que el directorio existe
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Conexión a la base de datos
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error al conectar con la base de datos:', err.message);
  } else {
    console.log('Conexión exitosa con la base de datos SQLite');
  }
});

// Inicializar la base de datos
function initDatabase() {
  db.serialize(() => {
    // Tabla de usuarios
    db.run(`CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      public_key TEXT NOT NULL,
      last_seen INTEGER,
      created_at INTEGER NOT NULL,
      home_server TEXT
    )`);

    // Tabla de nodos conocidos
    db.run(`CREATE TABLE IF NOT EXISTS known_nodes (
      id TEXT PRIMARY KEY,
      name TEXT,
      address TEXT NOT NULL,
      port INTEGER NOT NULL,
      last_seen INTEGER,
      created_at INTEGER NOT NULL
    )`);

    console.log('Base de datos inicializada');
  });
}

// Obtener todos los usuarios
function getAllUsers() {
  return new Promise((resolve, reject) => {
    db.all('SELECT id, username, public_key, last_seen FROM users', [], (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
}

// Buscar usuario por nombre de usuario
function getUserByUsername(username) {
  return new Promise((resolve, reject) => {
    db.get('SELECT id, username, public_key, last_seen FROM users WHERE username = ?', [username], (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row);
      }
    });
  });
}

// Crear un nuevo usuario
function createUser(id, username, publicKey) {
  return new Promise((resolve, reject) => {
    const now = Date.now();
    db.run(
      'INSERT INTO users (id, username, public_key, last_seen, created_at, home_server) VALUES (?, ?, ?, ?, ?, ?)',
      [id, username, publicKey, now, now, process.env.NODE_NAME],
      function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ id, username, publicKey });
        }
      }
    );
  });
}

// Actualizar el timestamp de "último visto" de un usuario
function updateUserLastSeen(id) {
  return new Promise((resolve, reject) => {
    const now = Date.now();
    db.run('UPDATE users SET last_seen = ? WHERE id = ?', [now, id], function(err) {
      if (err) {
        reject(err);
      } else {
        resolve({ id, lastSeen: now });
      }
    });
  });
}

// Registrar un nuevo nodo
function registerNode(id, name, address, port) {
  return new Promise((resolve, reject) => {
    const now = Date.now();
    db.run(
      'INSERT OR REPLACE INTO known_nodes (id, name, address, port, last_seen, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [id, name, address, port, now, now],
      function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ id, name, address, port });
        }
      }
    );
  });
}

// Obtener todos los nodos conocidos
function getAllNodes() {
  return new Promise((resolve, reject) => {
    db.all('SELECT id, name, address, port, last_seen FROM known_nodes', [], (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
}

module.exports = {
  initDatabase,
  getAllUsers,
  getUserByUsername,
  createUser,
  updateUserLastSeen,
  registerNode,
  getAllNodes
};