const Database = require('better-sqlite3');
const path = require('node:path');
const { app } = require('electron');

// Base de dados local guardada de forma segura na diretoria da aplicação do SO
const dbPath = path.join(app.getPath('userData'), 'app-data.db');
const db = new Database(dbPath);

// Otimizar a performance ativando o modo WAL
db.pragma('journal_mode = WAL');

// Proceder com as Migrações da Base de Dados
db.exec(`
  CREATE TABLE IF NOT EXISTS accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    provider TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    access_token TEXT,
    refresh_token TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS emails (
    id TEXT PRIMARY KEY,
    account_id INTEGER NOT NULL,
    subject TEXT,
    snippet TEXT,
    is_read BOOLEAN DEFAULT 0,
    timestamp DATETIME,
    FOREIGN KEY(account_id) REFERENCES accounts(id)
  );

  CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    account_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    start_time DATETIME NOT NULL,
    end_time DATETIME NOT NULL,
    recurrence_rule TEXT,
    FOREIGN KEY(account_id) REFERENCES accounts(id)
  );
`);

// Migração dinâmica para contas manuais IMAP/SMTP
try {
  db.exec("ALTER TABLE accounts ADD COLUMN password TEXT");
} catch (e) {}
try {
  db.exec("ALTER TABLE accounts ADD COLUMN imap_host TEXT");
} catch (e) {}
try {
  db.exec("ALTER TABLE accounts ADD COLUMN imap_port INTEGER");
} catch (e) {}
try {
  db.exec("ALTER TABLE accounts ADD COLUMN smtp_host TEXT");
} catch (e) {}
try {
  db.exec("ALTER TABLE accounts ADD COLUMN smtp_port INTEGER");
} catch (e) {}
try {
  db.exec("ALTER TABLE accounts ADD COLUMN calendar_url TEXT");
} catch (e) {}
try {
  db.exec("ALTER TABLE contacts ADD COLUMN avatar TEXT");
} catch (e) {}

try { db.exec("ALTER TABLE accounts ADD COLUMN google_client_id TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE accounts ADD COLUMN google_client_secret TEXT"); } catch (e) {}
try {
  db.exec("ALTER TABLE emails ADD COLUMN sender TEXT");
} catch (e) {}
try {
  db.exec("ALTER TABLE emails ADD COLUMN folder TEXT DEFAULT 'INBOX'");
} catch (e) {}
try {
  db.exec("ALTER TABLE emails ADD COLUMN is_pinned BOOLEAN DEFAULT 0");
} catch (e) {}
try {
  db.exec("ALTER TABLE emails ADD COLUMN is_important BOOLEAN DEFAULT 0");
} catch (e) {}
try {
  db.exec("ALTER TABLE emails ADD COLUMN html_body TEXT");
} catch (e) {}

try {
  db.exec(`CREATE TABLE IF NOT EXISTS todos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task TEXT NOT NULL,
    is_completed BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
} catch (e) {}

module.exports = db;

