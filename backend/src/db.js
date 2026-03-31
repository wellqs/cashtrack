import fs from 'node:fs'
import path from 'node:path'

const DB_PATH = path.resolve(process.cwd(), 'data', 'db.json')

const BASE_CATEGORIES = [
  { id: 'base-expense-food', name: 'Alimentacao', type: 'expense', icon: '🍔', predefined: true },
  { id: 'base-expense-transport', name: 'Transporte', type: 'expense', icon: '🚗', predefined: true },
  { id: 'base-expense-home', name: 'Moradia', type: 'expense', icon: '🏠', predefined: true },
  { id: 'base-expense-health', name: 'Saude', type: 'expense', icon: '💊', predefined: true },
  { id: 'base-expense-education', name: 'Educacao', type: 'expense', icon: '📚', predefined: true },
  { id: 'base-expense-leisure', name: 'Lazer', type: 'expense', icon: '🎬', predefined: true },
  { id: 'base-expense-subscriptions', name: 'Assinaturas', type: 'expense', icon: '📱', predefined: true },
  { id: 'base-income-salary', name: 'Salario', type: 'income', icon: '💼', predefined: true },
  { id: 'base-income-freelance', name: 'Freelance', type: 'income', icon: '💻', predefined: true },
  { id: 'base-income-investments', name: 'Investimentos', type: 'income', icon: '📈', predefined: true }
]

const EMPTY_DB = {
  users: [],
  categories: [],
  transactions: []
}

function ensureDbFile() {
  const dir = path.dirname(DB_PATH)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify(EMPTY_DB, null, 2), 'utf8')
  }
}

export function loadDb() {
  ensureDbFile()
  const raw = fs.readFileSync(DB_PATH, 'utf8')
  try {
    const parsed = JSON.parse(raw)
    return {
      users: parsed.users || [],
      categories: parsed.categories || [],
      transactions: parsed.transactions || []
    }
  } catch {
    return structuredClone(EMPTY_DB)
  }
}

export function saveDb(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf8')
}

export function seedBaseCategoriesForUser(db, userId) {
  const exists = db.categories.some((c) => c.userId === userId && c.predefined)
  if (exists) return
  for (const c of BASE_CATEGORIES) {
    db.categories.push({
      ...c,
      id: `${c.id}-${userId}`,
      userId,
      createdAt: new Date().toISOString()
    })
  }
}
