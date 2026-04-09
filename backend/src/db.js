import Database from 'better-sqlite3'
import fs from 'node:fs'
import path from 'node:path'

const DB_DIR = path.resolve(process.cwd(), 'data')
const DB_PATH = path.join(DB_DIR, 'cashtrack.db')

if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true })

export const db = new Database(DB_PATH)

db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    passwordHash TEXT NOT NULL,
    displayName TEXT NOT NULL,
    plan TEXT NOT NULL DEFAULT 'free',
    monthlyIncome REAL NOT NULL DEFAULT 0,
    targetSave REAL NOT NULL DEFAULT 0,
    notifyLimit INTEGER NOT NULL DEFAULT 1,
    weeklySummary INTEGER NOT NULL DEFAULT 0,
    goal TEXT NOT NULL DEFAULT 'Controlar meus gastos',
    createdAt TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    icon TEXT NOT NULL,
    predefined INTEGER NOT NULL DEFAULT 0,
    createdAt TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    type TEXT NOT NULL,
    amount REAL NOT NULL,
    description TEXT NOT NULL,
    categoryId TEXT NOT NULL,
    date TEXT NOT NULL,
    account TEXT,
    recurrence TEXT,
    note TEXT,
    createdAt TEXT NOT NULL
  );
`)

const BASE_CATEGORIES = [
  { id: 'base-expense-food', name: 'Alimentacao', type: 'expense', icon: '🍔' },
  { id: 'base-expense-transport', name: 'Transporte', type: 'expense', icon: '🚗' },
  { id: 'base-expense-home', name: 'Moradia', type: 'expense', icon: '🏠' },
  { id: 'base-expense-health', name: 'Saude', type: 'expense', icon: '💊' },
  { id: 'base-expense-education', name: 'Educacao', type: 'expense', icon: '📚' },
  { id: 'base-expense-leisure', name: 'Lazer', type: 'expense', icon: '🎬' },
  { id: 'base-expense-subscriptions', name: 'Assinaturas', type: 'expense', icon: '📱' },
  { id: 'base-income-salary', name: 'Salario', type: 'income', icon: '💼' },
  { id: 'base-income-freelance', name: 'Freelance', type: 'income', icon: '💻' },
  { id: 'base-income-investments', name: 'Investimentos', type: 'income', icon: '📈' },
]

const insertCategory = db.prepare(
  'INSERT OR IGNORE INTO categories (id, userId, name, type, icon, predefined, createdAt) VALUES (?, ?, ?, ?, ?, 1, ?)'
)
const seedMany = db.transaction((userId, now) => {
  for (const c of BASE_CATEGORIES) {
    insertCategory.run(`${c.id}-${userId}`, userId, c.name, c.type, c.icon, now)
  }
})

export function seedBaseCategoriesForUser(userId) {
  const existing = db.prepare('SELECT id FROM categories WHERE userId = ? AND predefined = 1 LIMIT 1').get(userId)
  if (existing) return
  seedMany(userId, new Date().toISOString())
}

export function mapUser(row) {
  if (!row) return null
  const { passwordHash: _hash, ...rest } = row
  return {
    ...rest,
    notifyLimit: rest.notifyLimit === 1,
    weeklySummary: rest.weeklySummary === 1,
  }
}

export function mapCategory(row) {
  if (!row) return null
  return { ...row, predefined: row.predefined === 1 }
}
