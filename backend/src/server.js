import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import bcrypt from 'bcryptjs'
import cookieParser from 'cookie-parser'
import { v4 as uuid } from 'uuid'
import { z } from 'zod'

import { db, mapCategory, mapUser, seedBaseCategoriesForUser } from './db.js'
import { clearAuthCookie, requireAuth, setAuthCookie, signToken } from './auth.js'
import { isIsoDateString, parseIsoDateParts, quarterMonths, sanitizeText } from './utils.js'

const app = express()
const PORT = Number(process.env.PORT || 3333)
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:5174'

app.use(helmet())
app.set('trust proxy', 1)
app.use(cors({ origin: FRONTEND_ORIGIN, credentials: true }))
app.use(express.json())
app.use(cookieParser())
app.use(morgan('dev'))

function createRateLimiter({ windowMs, max, keyPrefix }) {
  const buckets = new Map()
  return (req, res, next) => {
    const ip = req.ip || req.socket?.remoteAddress || 'unknown'
    const key = `${keyPrefix}:${ip}`
    const now = Date.now()
    const current = buckets.get(key)

    if (!current || now > current.resetAt) {
      buckets.set(key, { count: 1, resetAt: now + windowMs })
      return next()
    }

    if (current.count >= max) {
      const retryAfterSeconds = Math.max(1, Math.ceil((current.resetAt - now) / 1000))
      res.setHeader('Retry-After', String(retryAfterSeconds))
      return res.status(429).json({ message: 'Muitas requisicoes. Tente novamente em instantes.' })
    }

    current.count += 1
    buckets.set(key, current)
    return next()
  }
}

const authRateLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 30, keyPrefix: 'auth' })
const writeRateLimiter = createRateLimiter({ windowMs: 60 * 1000, max: 90, keyPrefix: 'write' })

app.get('/api/health', (_, res) => {
  res.json({ ok: true, service: 'cashtrack-backend', date: new Date().toISOString() })
})

app.get('/', (_, res) => {
  res.json({
    service: 'cashtrack-backend',
    ok: true,
    message: 'API online. Use as rotas em /api.',
    endpoints: {
      health: '/api/health',
      register: '/api/auth/register',
      login: '/api/auth/login'
    }
  })
})

// ─── Auth ────────────────────────────────────────────────────────────────────

const registerSchema = z.object({
  email: z.string().trim().email().max(120),
  password: z.string().min(6).max(72),
  displayName: z.string().trim().min(2).max(80)
}).strict()

app.post('/api/auth/register', authRateLimiter, async (req, res) => {
  const parsed = registerSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Dados invalidos' })

  const email = parsed.data.email.toLowerCase()
  const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(email)
  if (exists) return res.status(409).json({ message: 'Email ja cadastrado' })

  const user = {
    id: uuid(),
    email,
    passwordHash: await bcrypt.hash(parsed.data.password, 10),
    displayName: sanitizeText(parsed.data.displayName),
    plan: 'free',
    monthlyIncome: 0,
    targetSave: 0,
    notifyLimit: 1,
    weeklySummary: 0,
    goal: 'Controlar meus gastos',
    createdAt: new Date().toISOString()
  }

  db.prepare(`
    INSERT INTO users (id, email, passwordHash, displayName, plan, monthlyIncome, targetSave, notifyLimit, weeklySummary, goal, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(user.id, user.email, user.passwordHash, user.displayName, user.plan,
    user.monthlyIncome, user.targetSave, user.notifyLimit, user.weeklySummary, user.goal, user.createdAt)

  seedBaseCategoriesForUser(user.id)

  const token = signToken({ uid: user.id, email: user.email })
  setAuthCookie(res, token)
  return res.status(201).json({ user: mapUser(user) })
})

const loginSchema = z.object({
  email: z.string().trim().email().max(120),
  password: z.string().min(1).max(72)
}).strict()

app.post('/api/auth/login', authRateLimiter, async (req, res) => {
  const parsed = loginSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Dados invalidos' })

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(parsed.data.email.toLowerCase())
  if (!user) return res.status(401).json({ message: 'Credenciais invalidas' })

  const ok = await bcrypt.compare(parsed.data.password, user.passwordHash)
  if (!ok) return res.status(401).json({ message: 'Credenciais invalidas' })

  const token = signToken({ uid: user.id, email: user.email })
  setAuthCookie(res, token)
  return res.json({ user: mapUser(user) })
})

app.post('/api/auth/logout', (req, res) => {
  clearAuthCookie(res)
  return res.status(204).send()
})

// ─── Perfil ───────────────────────────────────────────────────────────────────

app.get('/api/me', requireAuth, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.uid)
  if (!user) return res.status(404).json({ message: 'Usuario nao encontrado' })
  return res.json({ user: mapUser(user) })
})

const profileSchema = z.object({
  displayName: z.string().trim().min(2).max(80).optional(),
  monthlyIncome: z.number().nonnegative().optional(),
  targetSave: z.number().nonnegative().optional(),
  notifyLimit: z.boolean().optional(),
  weeklySummary: z.boolean().optional(),
  goal: z.string().trim().min(2).max(120).optional()
}).strict()

app.put('/api/me/profile', requireAuth, writeRateLimiter, (req, res) => {
  const parsed = profileSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Dados invalidos' })

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.uid)
  if (!user) return res.status(404).json({ message: 'Usuario nao encontrado' })

  const data = parsed.data
  const updates = []
  const values = []

  if (data.displayName !== undefined) { updates.push('displayName = ?'); values.push(data.displayName) }
  if (data.monthlyIncome !== undefined) { updates.push('monthlyIncome = ?'); values.push(data.monthlyIncome) }
  if (data.targetSave !== undefined) { updates.push('targetSave = ?'); values.push(data.targetSave) }
  if (data.notifyLimit !== undefined) { updates.push('notifyLimit = ?'); values.push(data.notifyLimit ? 1 : 0) }
  if (data.weeklySummary !== undefined) { updates.push('weeklySummary = ?'); values.push(data.weeklySummary ? 1 : 0) }
  if (data.goal !== undefined) { updates.push('goal = ?'); values.push(data.goal) }

  if (updates.length > 0) {
    values.push(req.user.uid)
    db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...values)
  }

  const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.uid)
  return res.json({ user: mapUser(updated) })
})

const passwordSchema = z.object({
  currentPassword: z.string().min(1).max(72),
  newPassword: z.string().min(6).max(72)
}).strict()

app.put('/api/me/password', requireAuth, authRateLimiter, async (req, res) => {
  const parsed = passwordSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Dados invalidos' })

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.uid)
  if (!user) return res.status(404).json({ message: 'Usuario nao encontrado' })

  const matches = await bcrypt.compare(parsed.data.currentPassword, user.passwordHash)
  if (!matches) return res.status(401).json({ message: 'Senha atual incorreta' })

  const newHash = await bcrypt.hash(parsed.data.newPassword, 10)
  db.prepare('UPDATE users SET passwordHash = ? WHERE id = ?').run(newHash, req.user.uid)
  return res.json({ ok: true })
})

app.get('/api/me/export', requireAuth, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.uid)
  if (!user) return res.status(404).json({ message: 'Usuario nao encontrado' })

  const categories = db.prepare('SELECT * FROM categories WHERE userId = ?').all(req.user.uid).map(mapCategory)
  const transactions = db.prepare('SELECT * FROM transactions WHERE userId = ?').all(req.user.uid)

  return res.json({
    exportedAt: new Date().toISOString(),
    user: mapUser(user),
    categories,
    transactions
  })
})

app.delete('/api/me', requireAuth, authRateLimiter, (req, res) => {
  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(req.user.uid)
  if (!user) return res.status(404).json({ message: 'Usuario nao encontrado' })

  db.prepare('DELETE FROM transactions WHERE userId = ?').run(req.user.uid)
  db.prepare('DELETE FROM categories WHERE userId = ?').run(req.user.uid)
  db.prepare('DELETE FROM users WHERE id = ?').run(req.user.uid)
  clearAuthCookie(res)
  return res.status(204).send()
})

// ─── Categorias ───────────────────────────────────────────────────────────────

app.get('/api/categories', requireAuth, (req, res) => {
  const categories = db.prepare('SELECT * FROM categories WHERE userId = ?').all(req.user.uid).map(mapCategory)
  res.json({ categories })
})

const categorySchema = z.object({
  name: z.string().trim().min(2).max(40),
  type: z.enum(['income', 'expense']),
  icon: z.string().min(1).max(8)
}).strict()

app.post('/api/categories', requireAuth, writeRateLimiter, (req, res) => {
  const parsed = categorySchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Dados invalidos' })

  const duplicated = db.prepare(
    'SELECT id FROM categories WHERE userId = ? AND type = ? AND LOWER(name) = LOWER(?)'
  ).get(req.user.uid, parsed.data.type, parsed.data.name)
  if (duplicated) return res.status(409).json({ message: 'Categoria ja existe' })

  const category = {
    id: uuid(),
    userId: req.user.uid,
    name: parsed.data.name,
    type: parsed.data.type,
    icon: parsed.data.icon,
    predefined: 0,
    createdAt: new Date().toISOString()
  }

  db.prepare('INSERT INTO categories (id, userId, name, type, icon, predefined, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
    category.id, category.userId, category.name, category.type, category.icon, category.predefined, category.createdAt
  )
  return res.status(201).json({ category: mapCategory(category) })
})

app.put('/api/categories/:id', requireAuth, writeRateLimiter, (req, res) => {
  const parsed = categorySchema.partial().safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Dados invalidos' })

  const category = db.prepare('SELECT * FROM categories WHERE id = ? AND userId = ?').get(req.params.id, req.user.uid)
  if (!category) return res.status(404).json({ message: 'Categoria nao encontrada' })
  if (category.predefined) return res.status(403).json({ message: 'Categoria base nao pode ser editada' })

  const data = parsed.data
  const updates = []
  const values = []
  if (data.name !== undefined) { updates.push('name = ?'); values.push(data.name) }
  if (data.type !== undefined) { updates.push('type = ?'); values.push(data.type) }
  if (data.icon !== undefined) { updates.push('icon = ?'); values.push(data.icon) }

  if (updates.length > 0) {
    values.push(req.params.id)
    db.prepare(`UPDATE categories SET ${updates.join(', ')} WHERE id = ?`).run(...values)
  }

  const updated = db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id)
  return res.json({ category: mapCategory(updated) })
})

app.delete('/api/categories/:id', requireAuth, writeRateLimiter, (req, res) => {
  const category = db.prepare('SELECT * FROM categories WHERE id = ? AND userId = ?').get(req.params.id, req.user.uid)
  if (!category) return res.status(404).json({ message: 'Categoria nao encontrada' })
  if (category.predefined) return res.status(403).json({ message: 'Categoria base nao pode ser excluida' })

  db.prepare('DELETE FROM categories WHERE id = ?').run(req.params.id)
  return res.status(204).send()
})

// ─── Transações ───────────────────────────────────────────────────────────────

app.get('/api/transactions', requireAuth, (req, res) => {
  const transactions = db.prepare(`
    SELECT t.*, c.name AS categoryName, c.icon AS categoryIcon
    FROM transactions t
    LEFT JOIN categories c ON t.categoryId = c.id
    WHERE t.userId = ?
    ORDER BY t.date DESC, t.createdAt DESC
  `).all(req.user.uid)
  res.json({ transactions })
})

const transactionSchema = z.object({
  type: z.enum(['income', 'expense']),
  amount: z.number().positive(),
  description: z.string().trim().min(1).max(120),
  categoryId: z.string().min(1),
  date: z.string().refine((value) => isIsoDateString(value), 'Data invalida'),
  account: z.string().trim().max(50).optional(),
  recurrence: z.string().trim().max(30).optional(),
  note: z.string().trim().max(240).optional()
}).strict()

app.post('/api/transactions', requireAuth, writeRateLimiter, (req, res) => {
  const parsed = transactionSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Dados invalidos' })

  const category = db.prepare('SELECT id FROM categories WHERE id = ? AND userId = ?').get(parsed.data.categoryId, req.user.uid)
  if (!category) return res.status(404).json({ message: 'Categoria nao encontrada' })

  const tx = {
    id: uuid(),
    userId: req.user.uid,
    type: parsed.data.type,
    amount: parsed.data.amount,
    description: parsed.data.description,
    categoryId: parsed.data.categoryId,
    date: parsed.data.date,
    account: parsed.data.account || 'Conta corrente',
    recurrence: parsed.data.recurrence || null,
    note: parsed.data.note || null,
    createdAt: new Date().toISOString()
  }

  db.prepare(`
    INSERT INTO transactions (id, userId, type, amount, description, categoryId, date, account, recurrence, note, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(tx.id, tx.userId, tx.type, tx.amount, tx.description, tx.categoryId, tx.date,
    tx.account, tx.recurrence, tx.note, tx.createdAt)

  return res.status(201).json({ transaction: tx })
})

app.put('/api/transactions/:id', requireAuth, writeRateLimiter, (req, res) => {
  const parsed = transactionSchema.partial().safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Dados invalidos' })

  const tx = db.prepare('SELECT * FROM transactions WHERE id = ? AND userId = ?').get(req.params.id, req.user.uid)
  if (!tx) return res.status(404).json({ message: 'Transacao nao encontrada' })

  const data = parsed.data
  const updates = []
  const values = []
  const fields = ['type', 'amount', 'description', 'categoryId', 'date', 'account', 'recurrence', 'note']
  for (const field of fields) {
    if (data[field] !== undefined) {
      updates.push(`${field} = ?`)
      values.push(data[field])
    }
  }

  if (updates.length > 0) {
    values.push(req.params.id)
    db.prepare(`UPDATE transactions SET ${updates.join(', ')} WHERE id = ?`).run(...values)
  }

  const updated = db.prepare('SELECT * FROM transactions WHERE id = ?').get(req.params.id)
  return res.json({ transaction: updated })
})

app.delete('/api/transactions/:id', requireAuth, writeRateLimiter, (req, res) => {
  const tx = db.prepare('SELECT id FROM transactions WHERE id = ? AND userId = ?').get(req.params.id, req.user.uid)
  if (!tx) return res.status(404).json({ message: 'Transacao nao encontrada' })

  db.prepare('DELETE FROM transactions WHERE id = ?').run(req.params.id)
  return res.status(204).send()
})

// ─── Dashboard e Relatórios ───────────────────────────────────────────────────

app.get('/api/dashboard/summary', requireAuth, (req, res) => {
  const month = String(req.query.month || '')

  let query = 'SELECT * FROM transactions WHERE userId = ?'
  const params = [req.user.uid]
  if (month) {
    query += ' AND date LIKE ?'
    params.push(`${month}%`)
  }

  const tx = db.prepare(query).all(...params)

  const income = tx.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const expense = tx.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0)

  const expenseByCategory = tx
    .filter((t) => t.type === 'expense')
    .reduce((acc, t) => {
      acc[t.categoryId] = (acc[t.categoryId] || 0) + t.amount
      return acc
    }, {})

  return res.json({ month, income, expense, balance: income - expense, expenseByCategory })
})

app.get('/api/reports/overview', requireAuth, (req, res) => {
  const year = Number(req.query.year || new Date().getUTCFullYear())
  const period = String(req.query.period || 'ALL')
  const months = quarterMonths(period)

  const tx = db.prepare('SELECT * FROM transactions WHERE userId = ? AND date LIKE ?').all(req.user.uid, `${year}-%`)
    .filter((t) => {
      const parts = parseIsoDateParts(t.date)
      return parts && months.includes(parts.month)
    })

  const totals = tx.reduce(
    (acc, t) => {
      if (t.type === 'income') acc.income += t.amount
      else acc.expense += t.amount
      return acc
    },
    { income: 0, expense: 0 }
  )

  return res.json({
    period,
    year,
    income: totals.income,
    expense: totals.expense,
    balance: totals.income - totals.expense,
    transactions: tx.length
  })
})

app.use((_, res) => {
  res.status(404).json({ message: 'Rota nao encontrada' })
})

app.listen(PORT, () => {
  console.log(`[cashtrack-backend] running on http://localhost:${PORT}`)
})
