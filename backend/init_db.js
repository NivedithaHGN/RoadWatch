const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, 'roadwatch.db');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err);
    process.exit(1);
  }
  console.log('Connected to SQLite database at:', dbPath);
});

db.serialize(() => {
  // Drop tables if they exist
  db.run(`DROP TABLE IF EXISTS countries`);
  db.run(`DROP TABLE IF EXISTS projects`);
  db.run(`DROP TABLE IF EXISTS contractors`);
  db.run(`DROP TABLE IF EXISTS complaints`);
  db.run(`DROP TABLE IF EXISTS users`);

  // Create countries table
  db.run(`
    CREATE TABLE countries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE,
      center_lat REAL,
      center_lng REAL,
      zoom INTEGER,
      projects_count TEXT,
      health_score TEXT,
      complaints_count TEXT,
      budget_count TEXT,
      contractors_total TEXT,
      contractors_active TEXT,
      contractors_pending TEXT
    )
  `);

  // Create projects table
  db.run(`
    CREATE TABLE projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      country_name TEXT,
      name TEXT,
      lat REAL,
      lng REAL,
      status TEXT,
      is_upcoming INTEGER DEFAULT 0
    )
  `);

  // Create contractors table
  db.run(`
    CREATE TABLE contractors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      country_name TEXT,
      name TEXT,
      completed TEXT,
      status TEXT
    )
  `);

  // Create complaints table
  db.run(`
    CREATE TABLE complaints (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      country_name TEXT,
      title TEXT,
      description TEXT,
      location TEXT,
      status TEXT DEFAULT 'Pending',
      photo_path TEXT DEFAULT '',
      user_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      resolved_at DATETIME
    )
  `);

  // Create users table
  db.run(`
    CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name TEXT,
      email TEXT UNIQUE,
      password TEXT,
      role TEXT DEFAULT 'public'
    )
  `);

  console.log('Database tables created successfully.');

  // Seed default admin users for authentication
  const insertUser = db.prepare(`
    INSERT INTO users (full_name, email, password, role)
    VALUES (?, ?, ?, ?)
  `);
  insertUser.run("App Incharge", "admin@roadwatch.org", "admin123", "admin");
  insertUser.run("Govt Official", "govt@roadwatch.org", "govt123", "govt");
insertUser.run("Official Alice", "alice@gov.org", "alice123", "govt");
insertUser.run("Official Bob", "bob@gov.org", "bob123", "govt");
insertUser.run("Official Carol", "carol@gov.org", "carol123", "govt");
  insertUser.run("Public User", "user@roadwatch.org", "user123", "public");
  insertUser.finalize();
  console.log('Seeded admin, govt & public test users successfully.');
});

db.close((err) => {
  if (err) {
    console.error('Error closing database:', err);
  } else {
    console.log('Database initialized successfully.');
  }
});
