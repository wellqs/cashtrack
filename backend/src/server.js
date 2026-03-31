import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import bcrypt from 'bcryptjs'
import cookieParser from 'cookie-parser'
import { v4 as uuid } from 'uuid'
import { z } from 'zod'

import { loadDb, saveDb, seedBaseCategoriesForUser } from './db.js'
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

const registerSchema = z.object({
  email: z.string().trim().email().max(120),
  password: z.string().min(6).max(72),
  displayName: z.string().trim().min(2).max(80)
}).strict()

app.post('/api/auth/register', authRateLimiter, async (req, res) => {
  const parsed = registerSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Dados invalidos' })

  const db = loadDb()
  const email = parsed.data.email.toLowerCase()
  const exists = db.users.some((u) => u.email === email)
  if (exists) return res.status(409).json({ message: 'Email ja cadastrado' })

  const user = {
    id: uuid(),
    email,
    passwordHash: await bcrypt.hash(parsed.data.password, 10),
    displayName: sanitizeText(parsed.data.displayName),
    plan: 'free',
    monthlyIncome: 0,
    targetSave: 0,
    notifyLimit: true,
    weeklySummary: false,
    goal: 'Controlar meus gastos',
    createdAt: new Date().toISOString()
  }

  db.users.push(user)
  seedBaseCategoriesForUser(db, user.id)
  saveDb(db)

  const token = signToken({ uid: user.id, email: user.email })
  setAuthCookie(res, token)
  return res.status(201).json({ user: { ...user, passwordHash: undefined } })
})

const loginSchema = z.object({
  email: z.string().trim().email().max(120),
  password: z.string().min(1).max(72)
}).strict()
app.post('/api/auth/login', authRateLimiter, async (req, res) => {
  const parsed = loginSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Dados invalidos' })

  const db = loadDb()
  const user = db.users.find((u) => u.email === parsed.data.email.toLowerCase())
  if (!user) return res.status(401).json({ message: 'Credenciais invalidas' })

  const ok = await bcrypt.compare(parsed.data.password, user.passwordHash)
  if (!ok) return res.status(401).json({ message: 'Credenciais invalidas' })

  const token = signToken({ uid: user.id, email: user.email })
  setAuthCookie(res, token)
  return res.json({ user: { ...user, passwordHash: undefined } })
})

app.post('/api/auth/logout', (req, res) => {
  clearAuthCookie(res)
  return res.status(204).send()
})

app.get('/api/me', requireAuth, (req, res) => {
  const db = loadDb()
  const user = db.users.find((u) => u.id === req.user.uid)
  if (!user) return res.status(404).json({ message: 'Usuario nao encontrado' })
  return res.json({ user: { ...user, passwordHash: undefined } })
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

  const db = loadDb()
  const index = db.users.findIndex((u) => u.id === req.user.uid)
  if (index < 0) return res.status(404).json({ message: 'Usuario nao encontrado' })

  db.users[index] = { ...db.users[index], ...parsed.data }
  saveDb(db)
  return res.json({ user: { ...db.users[index], passwordHash: undefined } })
})

const passwordSchema = z.object({
  currentPassword: z.string().min(1).max(72),
  newPassword: z.string().min(6).max(72)
}).strict()

app.put('/api/me/password', requireAuth, authRateLimiter, async (req, res) => {
  const parsed = passwordSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Dados invalidos' })

  const db = loadDb()
  const index = db.users.findIndex((u) => u.id === req.user.uid)
  if (index < 0) return res.status(404).json({ message: 'Usuario nao encontrado' })

  const matches = await bcrypt.compare(parsed.data.currentPassword, db.users[index].passwordHash)
  if (!matches) return res.status(401).json({ message: 'Senha atual incorreta' })

  db.users[index].passwordHash = await bcrypt.hash(parsed.data.newPassword, 10)
  saveDb(db)
  return res.json({ ok: true })
})

app.get('/api/me/export', requireAuth, (req, res) => {
  const db = loadDb()
  const user = db.users.find((u) => u.id === req.user.uid)
  if (!user) return res.status(404).json({ message: 'Usuario nao encontrado' })

  const categories = db.categories.filter((c) => c.userId === req.user.uid)
  const transactions = db.transactions.filter((t) => t.userId === req.user.uid)

  return res.json({
    exportedAt: new Date().toISOString(),
    user: { ...user, passwordHash: undefined },
    categories,
    transactions
  })
})

app.delete('/api/me', requireAuth, authRateLimiter, (req, res) => {
  const db = loadDb()
  const exists = db.users.some((u) => u.id === req.user.uid)
  if (!exists) return res.status(404).json({ message: 'Usuario nao encontrado' })

  db.users = db.users.filter((u) => u.id !== req.user.uid)
  db.categories = db.categories.filter((c) => c.userId !== req.user.uid)
  db.transactions = db.transactions.filter((t) => t.userId !== req.user.uid)
  saveDb(db)
  return res.status(204).send()
})

app.get('/api/categories', requireAuth, (req, res) => {
  const db = loadDb()
  const categories = db.categories.filter((c) => c.userId === req.user.uid)
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

  const db = loadDb()
  const duplicated = db.categories.some(
    (c) => c.userId === req.user.uid && c.type === parsed.data.type && c.name.toLowerCase() === parsed.data.name.toLowerCase()
  )
  if (duplicated) return res.status(409).json({ message: 'Categoria ja existe' })

  const category = {
    id: uuid(),
    userId: req.user.uid,
    name: parsed.data.name,
    type: parsed.data.type,
    icon: parsed.data.icon,
    predefined: false,
    createdAt: new Date().toISOString()
  }

  db.categories.push(category)
  saveDb(db)
  return res.status(201).json({ category })
})

app.put('/api/categories/:id', requireAuth, writeRateLimiter, (req, res) => {
  const parsed = categorySchema.partial().safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Dados invalidos' })

  const db = loadDb()
  const index = db.categories.findIndex((c) => c.id === req.params.id && c.userId === req.user.uid)
  if (index < 0) return res.status(404).json({ message: 'Categoria nao encontrada' })
  if (db.categories[index].predefined) return res.status(403).json({ message: 'Categoria base nao pode ser editada' })

  db.categories[index] = { ...db.categories[index], ...parsed.data }
  saveDb(db)
  return res.json({ category: db.categories[index] })
})

app.delete('/api/categories/:id', requireAuth, writeRateLimiter, (req, res) => {
  const db = loadDb()
  const category = db.categories.find((c) => c.id === req.params.id && c.userId === req.user.uid)
  if (!category) return res.status(404).json({ message: 'Categoria nao encontrada' })
  if (category.predefined) return res.status(403).json({ message: 'Categoria base nao pode ser excluida' })

  db.categories = db.categories.filter((c) => c.id !== req.params.id)
  saveDb(db)
  return res.status(204).send()
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

app.get('/api/transactions', requireAuth, (req, res) => {
  const db = loadDb()
  const categories = db.categories.filter((c) => c.userId === req.user.uid)
  const tx = db.transactions
    .filter((t) => t.userId === req.user.uid)
    .map((t) => {
      const category = categories.find((c) => c.id === t.categoryId)
      return { ...t, categoryName: category?.name || 'Sem categoria', categoryIcon: category?.icon || '•' }
    })
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))
  res.json({ transactions: tx })
})

app.post('/api/transactions', requireAuth, writeRateLimiter, (req, res) => {
  const parsed = transactionSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Dados invalidos' })

  const db = loadDb()
  const category = db.categories.find((c) => c.id === parsed.data.categoryId && c.userId === req.user.uid)
  if (!category) return res.status(404).json({ message: 'Categoria nao encontrada' })

  const tx = {
    id: uuid(),
    userId: req.user.uid,
    ...parsed.data,
    createdAt: new Date().toISOString()
  }
  db.transactions.push(tx)
  saveDb(db)
  return res.status(201).json({ transaction: tx })
})

app.put('/api/transactions/:id', requireAuth, writeRateLimiter, (req, res) => {
  const parsed = transactionSchema.partial().safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Dados invalidos' })

  const db = loadDb()
  const index = db.transactions.findIndex((t) => t.id === req.params.id && t.userId === req.user.uid)
  if (index < 0) return res.status(404).json({ message: 'Transacao nao encontrada' })

  db.transactions[index] = { ...db.transactions[index], ...parsed.data }
  saveDb(db)
  return res.json({ transaction: db.transactions[index] })
})

app.delete('/api/transactions/:id', requireAuth, writeRateLimiter, (req, res) => {
  const db = loadDb()
  const exists = db.transactions.some((t) => t.id === req.params.id && t.userId === req.user.uid)
  if (!exists) return res.status(404).json({ message: 'Transacao nao encontrada' })

  db.transactions = db.transactions.filter((t) => !(t.id === req.params.id && t.userId === req.user.uid))
  saveDb(db)
  return res.status(204).send()
})

app.get('/api/dashboard/summary', requireAuth, (req, res) => {
  const month = String(req.query.month || '')
  const db = loadDb()
  let tx = db.transactions.filter((t) => t.userId === req.user.uid)

  if (month) {
    tx = tx.filter((t) => String(t.date).startsWith(month))
  }

  const income = tx.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const expense = tx.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0)

  const expenseByCategory = tx
    .filter((t) => t.type === 'expense')
    .reduce((acc, t) => {
      acc[t.categoryId] = (acc[t.categoryId] || 0) + t.amount
      return acc
    }, {})

  return res.json({
    month,
    income,
    expense,
    balance: income - expense,
    expenseByCategory
  })
})

app.get('/api/reports/overview', requireAuth, (req, res) => {
  const year = Number(req.query.year || new Date().getUTCFullYear())
  const period = String(req.query.period || 'ALL')
  const months = quarterMonths(period)
  const db = loadDb()
  const tx = db.transactions.filter((t) => {
    if (t.userId !== req.user.uid) return false
    const parts = parseIsoDateParts(t.date)
    if (!parts) return false
    return parts.year === year && months.includes(parts.month)
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
