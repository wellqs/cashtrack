import { useEffect, useMemo, useState } from 'react'
import { CATEGORY_PRESETS, ICON_LIBRARY, type CategoryType, getCategoryIcon } from './icons/categoryIcons'
import './App.css'

type Stage = 'welcome' | 'onboarding' | 'app'
type Page = 'dashboard' | 'transactions' | 'add' | 'categories' | 'reports' | 'profile' | 'premium'
type AuthView = 'none' | 'signup' | 'login'
type ReportPeriod = 'ALL' | 'Q1' | 'Q2' | 'Q3' | 'Q4'
type ProfilePanel = 'none' | 'edit' | 'notifications' | 'security'

type Transaction = {
  id: string
  description: string
  category: string
  categoryId?: string
  amount: number
  type: 'income' | 'expense'
  date: string
  account?: string
  recurrence?: string
  note?: string
}

type Category = {
  id: string
  name: string
  type: CategoryType
  icon: string
  predefined: boolean
}

type ApiUser = {
  id: string
  email: string
  displayName: string
  plan: 'free' | 'premium'
  monthlyIncome: number
  targetSave: number
  notifyLimit: boolean
  weeklySummary: boolean
  goal: string
}

type ApiCategory = {
  id: string
  name: string
  type: CategoryType
  icon: string
  predefined: boolean
}

type ApiTransaction = {
  id: string
  type: 'income' | 'expense'
  amount: number
  description: string
  categoryId: string
  categoryName?: string
  categoryIcon?: string
  date: string
  account?: string
  recurrence?: string
  note?: string
}

type ReportOverview = {
  period: ReportPeriod
  year: number
  income: number
  expense: number
  balance: number
  transactions: number
}

type ProfilePatch = Partial<{
  displayName: string
  monthlyIncome: number
  targetSave: number
  notifyLimit: boolean
  weeklySummary: boolean
  goal: string
}>

const rawApiBaseUrl = (import.meta.env.VITE_API_URL || 'http://localhost:3333').replace(/\/$/, '')
const API_BASE_URL = rawApiBaseUrl.endsWith('/api') ? rawApiBaseUrl : `${rawApiBaseUrl}/api`

const goalOptions = [
  {
    id: 'controlar',
    emoji: '💰',
    title: 'Controlar meus gastos',
    text: 'Quero saber para onde meu dinheiro vai',
  },
  {
    id: 'guardar',
    emoji: '🎯',
    title: 'Guardar dinheiro',
    text: 'Quero criar uma reserva financeira',
  },
  {
    id: 'dividas',
    emoji: '💳',
    title: 'Sair das dividas',
    text: 'Quero organizar minhas contas',
  },
  {
    id: 'investir',
    emoji: '📈',
    title: 'Investir melhor',
    text: 'Quero entender meu potencial de investimento',
  },
  {
    id: 'sonho',
    emoji: '🏠',
    title: 'Realizar um sonho',
    text: 'Casa propria, viagem, casamento...',
  },
]

const initialTransactions: Transaction[] = []

const initialCategories: Category[] = CATEGORY_PRESETS.map((preset, index) => ({
  id: `c${index + 1}`,
  name: preset.name,
  type: preset.type,
  icon: preset.icon,
  predefined: true,
}))

function parseQuickInput(input: string) {
  const m = input.match(/^\s*(\d+(?:[.,]\d{1,2})?)\s+(.+)$/)
  if (!m) return null

  const amount = Number(m[1].replace(',', '.'))
  const description = m[2].trim()
  const normalized = description
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

  const categoryMap: { key: string; category: string }[] = [
    { key: 'almoco', category: 'Alimentacao' },
    { key: 'mercado', category: 'Alimentacao' },
    { key: 'uber', category: 'Transporte' },
    { key: 'gasolina', category: 'Transporte' },
    { key: 'aluguel', category: 'Moradia' },
    { key: 'cinema', category: 'Lazer' },
  ]

  const found = categoryMap.find((item) => normalized.includes(item.key))
  return { amount, description, category: found?.category ?? 'Outros' }
}

function money(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatInputDateToBR(inputDate: string) {
  if (!inputDate) return new Date().toLocaleDateString('pt-BR')
  const [year, month, day] = inputDate.split('-')
  if (!year || !month || !day) return new Date().toLocaleDateString('pt-BR')
  return `${day}/${month}/${year}`
}

function getTodayInputDate() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getCurrentMonthYearLabel() {
  const now = new Date()
  const months = [
    'Janeiro',
    'Fevereiro',
    'Marco',
    'Abril',
    'Maio',
    'Junho',
    'Julho',
    'Agosto',
    'Setembro',
    'Outubro',
    'Novembro',
    'Dezembro',
  ]
  return `${months[now.getMonth()]} ${now.getFullYear()}`
}

function getMonthYearLabelFromInputDate(inputDate: string) {
  const [yearRaw, monthRaw] = inputDate.split('-')
  const year = Number(yearRaw)
  const month = Number(monthRaw)
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) return ''
  const months = [
    'Janeiro',
    'Fevereiro',
    'Marco',
    'Abril',
    'Maio',
    'Junho',
    'Julho',
    'Agosto',
    'Setembro',
    'Outubro',
    'Novembro',
    'Dezembro',
  ]
  return `${months[month - 1]}/${year}`
}

function getMonthYearLabelFromKey(monthKey: string) {
  const [yearRaw, monthRaw] = monthKey.split('-')
  const year = Number(yearRaw)
  const month = Number(monthRaw)
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) return monthKey
  const months = [
    'Janeiro',
    'Fevereiro',
    'Marco',
    'Abril',
    'Maio',
    'Junho',
    'Julho',
    'Agosto',
    'Setembro',
    'Outubro',
    'Novembro',
    'Dezembro',
  ]
  return `${months[month - 1]}/${year}`
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function parseBRDateToDate(dateValue: string) {
  if (!dateValue) return null
  const parts = dateValue.split('/')
  if (parts.length < 2) return null
  const day = Number(parts[0])
  const month = Number(parts[1])
  const year = Number(parts[2] || new Date().getFullYear())
  if (!Number.isFinite(day) || !Number.isFinite(month) || !Number.isFinite(year)) return null
  if (day < 1 || day > 31 || month < 1 || month > 12) return null
  return new Date(year, month - 1, day)
}

function getWeekdayIndexFromTransactionDate(dateValue: string) {
  const parsed = parseBRDateToDate(dateValue)
  if (!parsed) return null
  const weekDay = parsed.getDay()
  return weekDay === 0 ? 6 : weekDay - 1
}

function monthShortLabel(index: number) {
  const labels = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
  return labels[index] || '---'
}

function periodMonths(period: ReportPeriod) {
  if (period === 'Q1') return [1, 2, 3]
  if (period === 'Q2') return [4, 5, 6]
  if (period === 'Q3') return [7, 8, 9]
  if (period === 'Q4') return [10, 11, 12]
  return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
}

function formatApiDateToBR(value: string) {
  if (!value) return new Date().toLocaleDateString('pt-BR')
  if (value.includes('/')) return value
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return formatInputDateToBR(value)
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleDateString('pt-BR')
}

function parseCurrencyInputToNumber(value: string) {
  const cleaned = value.replace(/[^\d,.-]/g, '').trim()
  if (!cleaned) return 0
  const normalized = cleaned.includes('.') && cleaned.includes(',')
    ? cleaned.replace(/\./g, '').replace(',', '.')
    : cleaned.replace(',', '.')
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : 0
}

function formatCurrencyFromNumber(value: number) {
  if (!Number.isFinite(value) || value <= 0) return ''
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function formatCurrencyTyping(value: string) {
  const digits = value.replace(/\D/g, '')
  if (!digits) return ''
  const cents = Number(digits)
  if (!Number.isFinite(cents)) return ''
  return (cents / 100).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

async function apiRequest<T>(path: string, init: RequestInit = {}, token?: string): Promise<T> {
  const headers = new Headers(init.headers || {})
  if (!headers.has('Content-Type') && init.body) headers.set('Content-Type', 'application/json')
  if (token && token !== 'session') headers.set('Authorization', `Bearer ${token}`)

  const response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers, credentials: 'include' })
  const hasJson = response.headers.get('content-type')?.includes('application/json')
  const data = hasJson ? await response.json() : null

  if (!response.ok) {
    const message = (data as { message?: string } | null)?.message || `Erro ${response.status}`
    throw new Error(message)
  }
  return data as T
}

function mapApiCategory(category: ApiCategory): Category {
  return {
    id: category.id,
    name: category.name,
    type: category.type,
    icon: category.icon,
    predefined: Boolean(category.predefined),
  }
}

function mapApiTransaction(transaction: ApiTransaction): Transaction {
  return {
    id: transaction.id,
    description: transaction.description,
    category: transaction.categoryName || 'Sem categoria',
    categoryId: transaction.categoryId,
    amount: transaction.amount,
    type: transaction.type,
    date: formatApiDateToBR(transaction.date),
    account: transaction.account,
    recurrence: transaction.recurrence,
    note: transaction.note,
  }
}

function App() {
  const [stage, setStage] = useState<Stage>('welcome')
  const [onboardingStep, setOnboardingStep] = useState(1)
  const [selectedGoal, setSelectedGoal] = useState(goalOptions[0].id)
  const [displayName, setDisplayName] = useState('')
  const [monthlyIncome, setMonthlyIncome] = useState('')
  const [targetSave, setTargetSave] = useState('')
  const [notifyLimit, setNotifyLimit] = useState(true)
  const [weeklySummary, setWeeklySummary] = useState(false)
  const [activePage, setActivePage] = useState<Page>('dashboard')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [quickInput, setQuickInput] = useState('')
  const [addType, setAddType] = useState<CategoryType>('expense')
  const [addDate, setAddDate] = useState(getTodayInputDate())
  const [addCategoryIdSelected, setAddCategoryIdSelected] = useState('')
  const [addAmount, setAddAmount] = useState('')
  const [addDescription, setAddDescription] = useState('')
  const [addAccount, setAddAccount] = useState('Conta corrente')
  const [addRecurrence, setAddRecurrence] = useState('Unica')
  const [addNote, setAddNote] = useState('')
  const [addNotify, setAddNotify] = useState(false)
  const [transactions, setTransactions] = useState<Transaction[]>(initialTransactions)
  const [toastVisible, setToastVisible] = useState(false)
  const [categories, setCategories] = useState<Category[]>(initialCategories)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [newCategoryType, setNewCategoryType] = useState<CategoryType>('expense')
  const [newCategoryIcon, setNewCategoryIcon] = useState(ICON_LIBRARY.expense[0])
  const [isAddCategoryModalOpen, setIsAddCategoryModalOpen] = useState(false)
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null)
  const [editingCategoryName, setEditingCategoryName] = useState('')
  const [editingCategoryIcon, setEditingCategoryIcon] = useState('')
  const [authToken, setAuthToken] = useState('')
  const [syncError, setSyncError] = useState('')
  const [syncing, setSyncing] = useState(false)
  const [authView, setAuthView] = useState<AuthView>('none')
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authDisplayName, setAuthDisplayName] = useState('')
  const [authSubmitting, setAuthSubmitting] = useState(false)
  const [authError, setAuthError] = useState('')
  const [reportPeriod, setReportPeriod] = useState<ReportPeriod>('ALL')
  const [reportYear, setReportYear] = useState(new Date().getFullYear())
  const [reportOverview, setReportOverview] = useState<ReportOverview | null>(null)
  const [reportLoading, setReportLoading] = useState(false)
  const [reportError, setReportError] = useState('')
  const [profilePanel, setProfilePanel] = useState<ProfilePanel>('none')
  const [profileBusy, setProfileBusy] = useState(false)
  const [profileNotice, setProfileNotice] = useState('')
  const [profilePanelError, setProfilePanelError] = useState('')
  const [editProfileName, setEditProfileName] = useState('')
  const [editProfileIncome, setEditProfileIncome] = useState('')
  const [editProfileTarget, setEditProfileTarget] = useState('')
  const [editProfileGoal, setEditProfileGoal] = useState(goalOptions[0].id)
  const [panelNotifyLimit, setPanelNotifyLimit] = useState(true)
  const [panelWeeklySummary, setPanelWeeklySummary] = useState(false)
  const [currentPasswordInput, setCurrentPasswordInput] = useState('')
  const [newPasswordInput, setNewPasswordInput] = useState('')
  const [transactionMonthFilter, setTransactionMonthFilter] = useState('')
  const [hoveredDonutSlice, setHoveredDonutSlice] = useState<string | null>(null)
  const [hoveredWeekDay, setHoveredWeekDay] = useState<string | null>(null)
  const [hoveredReportMonth, setHoveredReportMonth] = useState<number | null>(null)
  const [hoveredReportCategory, setHoveredReportCategory] = useState<string | null>(null)

  const parsedQuick = useMemo(() => parseQuickInput(quickInput), [quickInput])
  const now = new Date()
  const currentMonth = now.getMonth()
  const currentYear = now.getFullYear()
  const currentMonthKey = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`
  const transactionMonthOptions = useMemo(() => {
    const seen = new Set<string>()
    const options: { value: string; label: string }[] = []
    for (const tx of transactions) {
      const parsed = parseBRDateToDate(tx.date)
      if (!parsed) continue
      const key = `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}`
      if (seen.has(key)) continue
      seen.add(key)
      options.push({ value: key, label: getMonthYearLabelFromKey(key) })
    }
    return options.sort((a, b) => b.value.localeCompare(a.value))
  }, [transactions])
  const transactionsFilteredByMonth = useMemo(() => {
    if (!transactionMonthFilter || transactionMonthFilter === 'all') return transactions
    return transactions.filter((tx) => {
      const parsed = parseBRDateToDate(tx.date)
      if (!parsed) return false
      const key = `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}`
      return key === transactionMonthFilter
    })
  }, [transactions, transactionMonthFilter])
  const transactionMonthLabel =
    transactionMonthFilter && transactionMonthFilter !== 'all'
      ? getMonthYearLabelFromKey(transactionMonthFilter)
      : 'Todos os meses'
  const dashboardTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      const parsed = parseBRDateToDate(tx.date)
      return parsed ? parsed.getMonth() === currentMonth && parsed.getFullYear() === currentYear : false
    })
  }, [transactions, currentMonth, currentYear])
  const incomeTotal = dashboardTransactions.filter((t) => t.type === 'income').reduce((sum, t) => sum + t.amount, 0)
  const expenseTotal = dashboardTransactions.filter((t) => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0)
  const balance = incomeTotal - expenseTotal
  const expenseByCategory = useMemo(() => {
    const grouped = dashboardTransactions
      .filter((t) => t.type === 'expense')
      .reduce<Record<string, number>>((acc, t) => {
        acc[t.category] = (acc[t.category] ?? 0) + t.amount
        return acc
      }, {})
    return Object.entries(grouped)
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5)
  }, [dashboardTransactions])
  const expenseByCategoryChart = useMemo(() => {
    const categoryNameById = categories.reduce<Record<string, string>>((acc, category) => {
      acc[category.id] = category.name
      return acc
    }, {})

    const grouped = transactions
      .filter((transaction) => transaction.type === 'expense')
      .reduce<Record<string, number>>((acc, transaction) => {
        const resolvedCategory = transaction.categoryId
          ? categoryNameById[transaction.categoryId] || transaction.category || 'Sem categoria'
          : transaction.category || 'Sem categoria'
        acc[resolvedCategory] = (acc[resolvedCategory] ?? 0) + transaction.amount
        return acc
      }, {})

    return Object.entries(grouped)
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 8)
  }, [transactions, categories])
  const expenseTotalChart = expenseByCategoryChart.reduce((sum, item) => sum + item.amount, 0)
  const expenseCategories = categories.filter((c) => c.type === 'expense')
  const incomeCategories = categories.filter((c) => c.type === 'income')
  const addCategoryOptions = categories.filter((c) => c.type === addType)
  const pageTitle: Record<Page, string> = {
    dashboard: 'Dashboard',
    transactions: 'Transacoes',
    add: 'Adicionar',
    categories: 'Categorias',
    reports: 'Relatorios',
    profile: 'Perfil',
    premium: 'Premium',
  }
  const iconOptions = ICON_LIBRARY[newCategoryType]
  const chartColors = ['#e11d48', '#f59e0b', '#8b5cf6', '#14b8a6', '#3b82f6']
  const categorySlices = expenseByCategoryChart.map((item, index) => ({
    ...item,
    color: chartColors[index % chartColors.length],
    pct: expenseTotalChart > 0 ? (item.amount / expenseTotalChart) * 100 : 0,
  }))
  const donutBackground =
    categorySlices.length > 0
      ? `conic-gradient(${categorySlices
          .map((slice, index) => {
            const start = categorySlices.slice(0, index).reduce((sum, s) => sum + s.pct, 0)
            const end = start + slice.pct
            return `${slice.color} ${start.toFixed(2)}% ${end.toFixed(2)}%`
          })
          .join(', ')})`
      : 'conic-gradient(#334155 0% 100%)'
  const donutKpi = categorySlices.find((slice) => slice.category === hoveredDonutSlice) || null
  const biggestExpense = expenseByCategory[0]
  const economyInsightTitle = balance >= 0 ? 'Boa economia!' : 'Atencao ao saldo'
  const economyInsightText =
    balance >= 0
      ? `Voce guardou ${money(balance)} neste mes.`
      : `Voce gastou ${money(Math.abs(balance))} acima da sua renda no mes.`
  const spendingInsightTitle = biggestExpense
    ? `${biggestExpense.category} acima do normal`
    : 'Sem gastos relevantes'
  const spendingInsightText = biggestExpense
    ? `Maior gasto em ${biggestExpense.category}: ${money(biggestExpense.amount)}.`
    : 'Adicione transacoes para liberar insights de gastos.'
  const foodExpense = expenseByCategory.find((item) => normalizeText(item.category) === 'alimentacao')?.amount ?? 0
  const foodPctIncome = incomeTotal > 0 ? Math.round((foodExpense / incomeTotal) * 100) : 0
  const weeklyLabels = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab', 'Dom']
  const dashboardWeeklyAmounts = dashboardTransactions
    .filter((tx) => tx.type === 'expense')
    .reduce<number[]>((acc, tx) => {
      const weekIndex = getWeekdayIndexFromTransactionDate(tx.date)
      if (weekIndex === null) return acc
      acc[weekIndex] += tx.amount
      return acc
    }, [0, 0, 0, 0, 0, 0, 0])
  const weeklySpending = weeklyLabels.map((day, index) => ({
    day,
    amount: Math.round(dashboardWeeklyAmounts[index] ?? 0),
  }))
  const weeklyKpi = weeklySpending.find((item) => item.day === hoveredWeekDay) || null
  const highestWeeklyExpense = weeklySpending.reduce((top, item) => (item.amount > top.amount ? item : top), {
    day: '',
    amount: 0,
  })
  const hasWeeklyData = highestWeeklyExpense.amount > 0
  const maxWeekly = Math.max(...weeklySpending.map((item) => item.amount), 1)
  const weeklyColor = (amount: number) => {
    if (amount >= maxWeekly * 0.86) return '#f43f5e'
    if (amount >= maxWeekly * 0.64) return '#fbbf24'
    return '#7c6fff'
  }
  const monthlyIncomeNumber = parseCurrencyInputToNumber(monthlyIncome)
  const targetSaveNumber = parseCurrencyInputToNumber(targetSave)
  const expenseRate = monthlyIncomeNumber > 0 ? (expenseTotal / monthlyIncomeNumber) * 100 : 0
  const activeSubscriptions = categories.filter((c) => normalizeText(c.name).includes('assin')).length
  const travelGoalMonths = balance > 0 ? Math.max(1, Math.ceil((Number(targetSave || '1000') || 1000) / balance)) : 0
  const hasProfileInputs = monthlyIncomeNumber > 0 || targetSaveNumber > 0 || transactions.length > 0
  const budgetHealthTip = (() => {
    if (monthlyIncomeNumber <= 0) {
      return { dot: 'green', title: 'Informe sua renda mensal.', text: 'Com esse dado, as dicas ficam realmente personalizadas.' }
    }
    if (expenseRate >= 110) {
      return {
        dot: 'pink',
        title: `Seus gastos estao em ${Math.round(expenseRate)}% da renda.`,
        text: 'Ajuste despesas fixas e variaveis para voltar a um nivel saudavel.',
      }
    }
    if (expenseRate >= 95) {
      return {
        dot: 'pink',
        title: `Voce esta no limite (${Math.round(expenseRate)}% da renda).`,
        text: 'Qualquer gasto extra pode virar deficit. Revise despesas opcionais.',
      }
    }
    if (expenseRate >= 80) {
      return {
        dot: 'amber',
        title: `Gastos altos: ${Math.round(expenseRate)}% da renda.`,
        text: 'Tente manter abaixo de 75% para criar mais folga mensal.',
      }
    }
    if (expenseRate >= 65) {
      return {
        dot: 'amber',
        title: `Boa base de controle (${Math.round(expenseRate)}%).`,
        text: 'Com pequenos cortes, voce pode acelerar sua reserva.',
      }
    }
    if (expenseRate >= 50) {
      return {
        dot: 'green',
        title: `Saude financeira boa (${Math.round(expenseRate)}%).`,
        text: 'Voce tem margem para investir ou antecipar metas.',
      }
    }
    return {
      dot: 'green',
      title: `Excelente eficiencia (${Math.round(expenseRate)}% da renda).`,
      text: 'Considere dividir a folga entre reserva, investimento e qualidade de vida.',
    }
  })()
  const foodTip = (() => {
    if (monthlyIncomeNumber <= 0) {
      return { dot: 'pink', title: 'Preencha sua renda para calibrar alimentacao.', text: 'Sem renda, nao conseguimos medir o peso real desse gasto.' }
    }
    if (foodExpense <= 0) {
      return { dot: 'green', title: 'Sem gastos com alimentacao registrados.', text: 'Ao lancar refeicoes, o app mostra oportunidades reais de economia.' }
    }
    if (foodPctIncome >= 35) {
      return { dot: 'pink', title: `Alimentacao em ${foodPctIncome}% da renda.`, text: 'Alto para o mes. Planeje cardapio e limite delivery para reduzir rapido.' }
    }
    if (foodPctIncome >= 28) {
      return { dot: 'pink', title: `Alimentacao em ${foodPctIncome}% da renda.`, text: 'Comeca a pressionar o orcamento. Defina teto semanal para refeicoes fora.' }
    }
    if (foodPctIncome >= 20) {
      return { dot: 'amber', title: `Alimentacao em ${foodPctIncome}% da renda.`, text: 'Faixa moderada. Compras planejadas podem gerar economia adicional.' }
    }
    if (foodPctIncome >= 12) {
      return { dot: 'green', title: `Alimentacao equilibrada (${foodPctIncome}%).`, text: 'Bom controle. Mantenha comparacao mercado x restaurante.' }
    }
    return { dot: 'green', title: `Alimentacao muito eficiente (${foodPctIncome}%).`, text: 'Parabens. Aproveite essa margem para reforcar sua meta de reserva.' }
  })()
  const subscriptionTip = (() => {
    if (activeSubscriptions >= 8) {
      return { dot: 'pink', title: `Voce tem ${activeSubscriptions} assinaturas ativas.`, text: 'Volume alto. Corte duplicadas e renegocie anuais para reduzir custo fixo.' }
    }
    if (activeSubscriptions >= 6) {
      return { dot: 'pink', title: `${activeSubscriptions} assinaturas no seu cadastro.`, text: 'Priorize as que voce usa toda semana e pause o restante.' }
    }
    if (activeSubscriptions >= 4) {
      return { dot: 'amber', title: `${activeSubscriptions} assinaturas registradas.`, text: 'Boa hora para revisar custo-beneficio antes da renovacao.' }
    }
    if (activeSubscriptions >= 2) {
      return { dot: 'amber', title: `${activeSubscriptions} assinaturas em andamento.`, text: 'Controle razoavel. Agrupe vencimentos para facilitar revisao mensal.' }
    }
    if (activeSubscriptions === 1) {
      return { dot: 'green', title: 'Apenas 1 assinatura ativa.', text: 'Estrutura enxuta. Mantenha monitoramento para evitar custos invisiveis.' }
    }
    return { dot: 'green', title: 'Nenhuma assinatura detectada.', text: 'Excelente para reduzir despesas fixas recorrentes.' }
  })()
  const goalTip = (() => {
    if (targetSaveNumber <= 0) {
      return { dot: 'violet', title: 'Defina uma meta mensal de economia.', text: 'Metas claras melhoram foco e frequencia de registro.' }
    }
    if (balance <= 0) {
      return { dot: 'pink', title: `Meta atual ${money(targetSaveNumber)} com saldo negativo.`, text: 'Primeiro estabilize gastos para retomar acumulacao com consistencia.' }
    }
    if (travelGoalMonths > 12) {
      return { dot: 'amber', title: `No ritmo atual, meta em cerca de ${travelGoalMonths} meses.`, text: 'Reduzir despesas de maior peso acelera bastante esse prazo.' }
    }
    if (travelGoalMonths > 8) {
      return { dot: 'amber', title: `Meta prevista para ${travelGoalMonths} meses.`, text: 'Bom progresso, mas ainda ha espaco para otimizar categorias-chave.' }
    }
    if (travelGoalMonths > 4) {
      return { dot: 'green', title: `Meta projetada em ${travelGoalMonths} meses.`, text: 'Ritmo saudavel. Mantenha constancia nas semanas de maior gasto.' }
    }
    if (travelGoalMonths > 1) {
      return { dot: 'green', title: `Voce chega na meta em ${travelGoalMonths} meses.`, text: 'Excelente velocidade. Evite elevar gastos fixos nesse periodo.' }
    }
    return { dot: 'green', title: 'Meta mensal alcancavel no curto prazo.', text: 'Parabens, voce esta em fase forte de acumulacao.' }
  })()
  const alertTip = (() => {
    if (!notifyLimit && expenseRate >= 95) {
      return { dot: 'pink', title: 'Alertas desligados em momento de risco.', text: 'Ative para receber aviso antes de ultrapassar sua renda.' }
    }
    if (!notifyLimit && expenseRate >= 75) {
      return { dot: 'amber', title: 'Alertas desligados.', text: 'Com gastos altos, alertas ajudam a corrigir rota mais cedo.' }
    }
    if (!notifyLimit && expenseRate > 0) {
      return { dot: 'amber', title: 'Alertas de gasto estao desativados.', text: 'Ative para evitar surpresas perto do fim do mes.' }
    }
    if (!notifyLimit) {
      return { dot: 'violet', title: 'Alertas desativados.', text: 'Ative quando comecar a registrar despesas para ganhar previsibilidade.' }
    }
    if (notifyLimit && expenseRate >= 90) {
      return { dot: 'green', title: 'Alertas ativos em fase critica.', text: 'Boa decisao. Isso reduz risco de ultrapassar sua renda.' }
    }
    return { dot: 'green', title: 'Alertas ativos e saudaveis.', text: 'Mantenha para preservar controle continuo do orcamento.' }
  })()
  const consistencyTip = (() => {
    if (transactions.length === 0) {
      return { dot: 'violet', title: 'Sem registros suficientes para tendencia.', text: 'Lance receitas e despesas para liberar dicas cada vez mais precisas.' }
    }
    if (!weeklySummary && transactions.length >= 25) {
      return { dot: 'amber', title: 'Resumo semanal desativado com alto volume de lancamentos.', text: 'Ative para revisar tendencia sem abrir cada transacao.' }
    }
    if (!weeklySummary && transactions.length >= 10) {
      return { dot: 'amber', title: 'Resumo semanal pode ajudar.', text: 'Com mais movimentos no mes, ele acelera sua leitura financeira.' }
    }
    if (!weeklySummary) {
      return { dot: 'violet', title: 'Resumo semanal desativado.', text: 'Ative quando quiser acompanhar progresso com menos esforco.' }
    }
    if (weeklySummary && transactions.length >= 25) {
      return { dot: 'green', title: 'Resumo semanal ativo com base robusta.', text: 'Excelente: sua rotina de acompanhamento esta madura.' }
    }
    return { dot: 'green', title: 'Resumo semanal ativo.', text: 'Otimo para manter disciplina e detectar desvios cedo.' }
  })()
  const personalizedTips = hasProfileInputs
    ? [foodTip, budgetHealthTip, goalTip, consistencyTip, subscriptionTip, alertTip].slice(0, 4)
    : []
  const isAddDateCurrentMonth = addDate.startsWith(currentMonthKey)
  const addDateMonthLabel = getMonthYearLabelFromInputDate(addDate)
  const profileName = displayName || 'Usuario'
  const profileInitials = profileName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')
  const customCategoriesCount = categories.filter((category) => !category.predefined).length
  const frequentQuickPresets = useMemo(() => {
    const grouped = transactions.reduce<
      Record<
        string,
        { description: string; category: string; type: 'income' | 'expense'; count: number; totalAmount: number; firstIndex: number }
      >
    >((acc, tx, index) => {
      const key = `${normalizeText(tx.description)}|${normalizeText(tx.category)}|${tx.type}`
      if (!acc[key]) {
        acc[key] = {
          description: tx.description,
          category: tx.category,
          type: tx.type,
          count: 0,
          totalAmount: 0,
          firstIndex: index,
        }
      }
      acc[key].count += 1
      acc[key].totalAmount += tx.amount
      return acc
    }, {})

    const frequent = Object.values(grouped)
      .sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count
        return a.firstIndex - b.firstIndex
      })
      .slice(0, 6)
      .map((item) => {
        const avgAmount = item.totalAmount / item.count
        const normalizedDescription = item.description.trim().toLowerCase()
        return {
          icon: getIconByCategoryName(item.category, item.type),
          name: item.description,
          value: money(avgAmount),
          raw: `${avgAmount.toFixed(2)} ${normalizedDescription}`,
        }
      })

    return frequent
  }, [transactions])
  const reportPeriods: ReportPeriod[] = ['ALL', 'Q1', 'Q2', 'Q3', 'Q4']
  const reportMonths = periodMonths(reportPeriod)
  const reportTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      const parsed = parseBRDateToDate(tx.date)
      if (!parsed) return false
      const txYear = parsed.getFullYear()
      const txMonth = parsed.getMonth() + 1
      return txYear === reportYear && reportMonths.includes(txMonth)
    })
  }, [transactions, reportYear, reportMonths])
  const reportExpenseByCategory = useMemo(() => {
    const grouped = reportTransactions
      .filter((tx) => tx.type === 'expense')
      .reduce<Record<string, number>>((acc, tx) => {
        acc[tx.category] = (acc[tx.category] || 0) + tx.amount
        return acc
      }, {})
    const total = Object.values(grouped).reduce((sum, amount) => sum + amount, 0)
    return Object.entries(grouped)
      .map(([name, amount]) => ({
        name,
        amount,
        pct: total > 0 ? (amount / total) * 100 : 0,
      }))
      .sort((a, b) => b.amount - a.amount)
  }, [reportTransactions])
  const monthlyReportBars = useMemo(() => {
    return reportMonths.map((month) => {
      const monthTx = reportTransactions.filter((tx) => {
        const parsed = parseBRDateToDate(tx.date)
        return parsed ? parsed.getMonth() + 1 === month : false
      })
      const inc = monthTx.filter((tx) => tx.type === 'income').reduce((sum, tx) => sum + tx.amount, 0)
      const exp = monthTx.filter((tx) => tx.type === 'expense').reduce((sum, tx) => sum + tx.amount, 0)
      const eco = Math.max(0, inc - exp)
      return { month, inc, exp, eco }
    })
  }, [reportTransactions, reportMonths])
  const monthlyKpi = monthlyReportBars.find((item) => item.month === hoveredReportMonth) || null
  const reportCategoryKpi = reportExpenseByCategory.find((item) => item.name === hoveredReportCategory) || null
  const monthlyBarMax = Math.max(1, ...monthlyReportBars.map((item) => Math.max(item.inc, item.exp, item.eco)))
  const reportIncome = reportOverview?.income ?? reportTransactions.filter((tx) => tx.type === 'income').reduce((sum, tx) => sum + tx.amount, 0)
  const reportExpense =
    reportOverview?.expense ?? reportTransactions.filter((tx) => tx.type === 'expense').reduce((sum, tx) => sum + tx.amount, 0)
  const reportBalance = reportOverview?.balance ?? reportIncome - reportExpense
  const reportTxCount = reportOverview?.transactions ?? reportTransactions.length
  const reportTopCategory = reportExpenseByCategory[0]
  const reportAvgTicket = reportTxCount > 0 ? (reportIncome + reportExpense) / reportTxCount : 0
  const recurrenceOptions = ['Unica', 'Semanal', 'Quinzenal', 'Mensal', 'Anual']

  useEffect(() => {
    let cancelled = false

    async function restoreSession() {
      try {
        setSyncing(true)
        setSyncError('')
        try {
          const me = await apiRequest<{ user: ApiUser }>('/me')
          if (cancelled) return
          setAuthToken('session')
          hydrateUserFromApi(me.user)
          setStage('app')
        } catch {
          setAuthToken('')
        }
      } catch (error) {
        if (cancelled) return
        setSyncError(error instanceof Error ? error.message : 'Falha ao conectar com o backend')
      } finally {
        if (!cancelled) setSyncing(false)
      }
    }

    restoreSession()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!authToken) return
    void loadUserData(authToken)
  }, [authToken])

  useEffect(() => {
    if (!authToken) return
    let cancelled = false

    async function loadReportOverview() {
      try {
        setReportLoading(true)
        setReportError('')
        const response = await apiRequest<ReportOverview>(
          `/reports/overview?year=${reportYear}&period=${reportPeriod}`,
          {},
          authToken,
        )
        if (cancelled) return
        setReportOverview(response)
      } catch (error) {
        if (cancelled) return
        setReportError(error instanceof Error ? error.message : 'Falha ao carregar relatorios')
      } finally {
        if (!cancelled) setReportLoading(false)
      }
    }

    void loadReportOverview()
    return () => {
      cancelled = true
    }
  }, [authToken, reportYear, reportPeriod, transactions.length])

  useEffect(() => {
    if (!addCategoryOptions.length) {
      setAddCategoryIdSelected('')
      return
    }
    const stillExists = addCategoryOptions.some((item) => item.id === addCategoryIdSelected)
    if (!stillExists) {
      setAddCategoryIdSelected(addCategoryOptions[0].id)
    }
  }, [addType, addCategoryOptions, addCategoryIdSelected])

  useEffect(() => {
    if (!parsedQuick) return
    setAddAmount(formatCurrencyFromNumber(parsedQuick.amount))
    setAddDescription(parsedQuick.description)
  }, [parsedQuick])

  useEffect(() => {
    if (!transactionMonthFilter) {
      setTransactionMonthFilter(currentMonthKey)
      return
    }
    const filterExists =
      transactionMonthFilter === 'all' || transactionMonthOptions.some((option) => option.value === transactionMonthFilter)
    if (!filterExists) {
      setTransactionMonthFilter(currentMonthKey)
    }
  }, [transactionMonthFilter, transactionMonthOptions, currentMonthKey])

  function hydrateUserFromApi(user: ApiUser) {
    setDisplayName(user.displayName || '')
    setMonthlyIncome(formatCurrencyFromNumber(user.monthlyIncome))
    setTargetSave(formatCurrencyFromNumber(user.targetSave))
    setNotifyLimit(Boolean(user.notifyLimit))
    setWeeklySummary(Boolean(user.weeklySummary))
    const matchedGoal = goalOptions.find((goal) => normalizeText(goal.title) === normalizeText(user.goal || ''))
    if (matchedGoal) setSelectedGoal(matchedGoal.id)
  }

  async function loadUserData(token: string) {
    try {
      setSyncing(true)
      setSyncError('')
      const [categoriesResponse, transactionsResponse] = await Promise.all([
        apiRequest<{ categories: ApiCategory[] }>('/categories', {}, token),
        apiRequest<{ transactions: ApiTransaction[] }>('/transactions', {}, token),
      ])
      setCategories(categoriesResponse.categories.map(mapApiCategory))
      setTransactions(transactionsResponse.transactions.map(mapApiTransaction))
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : 'Falha ao carregar dados')
    } finally {
      setSyncing(false)
    }
  }

  async function updateProfileOnBackend(patch: ProfilePatch) {
    if (!authToken) return
    try {
      const response = await apiRequest<{ user: ApiUser }>(
        '/me/profile',
        {
          method: 'PUT',
          body: JSON.stringify(patch),
        },
        authToken,
      )
      hydrateUserFromApi(response.user)
      setSyncError('')
      setProfileNotice('Perfil atualizado com sucesso.')
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : 'Falha ao salvar perfil')
      setProfileNotice('')
      throw error
    }
  }

  async function syncProfileToBackend() {
    const payload: ProfilePatch = {
      displayName: displayName || 'Usuario',
      monthlyIncome: parseCurrencyInputToNumber(monthlyIncome),
      targetSave: parseCurrencyInputToNumber(targetSave),
      notifyLimit,
      weeklySummary,
      goal: goalOptions.find((goal) => goal.id === selectedGoal)?.title || '',
    }
    try {
      await updateProfileOnBackend(payload)
    } catch {
      // handled by updateProfileOnBackend
    }
  }

  function openProfilePanel(panel: Exclude<ProfilePanel, 'none'>) {
    setProfilePanel(panel)
    setProfilePanelError('')
    if (panel === 'edit') {
      setEditProfileName(displayName || '')
      setEditProfileIncome(monthlyIncome || '')
      setEditProfileTarget(targetSave || '')
      setEditProfileGoal(selectedGoal)
    }
    if (panel === 'notifications') {
      setPanelNotifyLimit(notifyLimit)
      setPanelWeeklySummary(weeklySummary)
    }
    if (panel === 'security') {
      setCurrentPasswordInput('')
      setNewPasswordInput('')
    }
  }

  function closeProfilePanel() {
    setProfilePanel('none')
    setProfilePanelError('')
  }

  async function saveProfileEditPanel() {
    try {
      setProfileBusy(true)
      const nextName = editProfileName.trim() || 'Usuario'
      const nextIncome = parseCurrencyInputToNumber(editProfileIncome)
      const nextTarget = parseCurrencyInputToNumber(editProfileTarget)
      const nextGoalTitle = goalOptions.find((goal) => goal.id === editProfileGoal)?.title || goalOptions[0].title

      setDisplayName(nextName)
      setMonthlyIncome(formatCurrencyFromNumber(nextIncome))
      setTargetSave(formatCurrencyFromNumber(nextTarget))
      setSelectedGoal(editProfileGoal)

      await updateProfileOnBackend({
        displayName: nextName,
        monthlyIncome: nextIncome,
        targetSave: nextTarget,
        goal: nextGoalTitle,
      })
      closeProfilePanel()
    } catch (error) {
      setProfilePanelError(error instanceof Error ? error.message : 'Falha ao salvar edicao de perfil')
    } finally {
      setProfileBusy(false)
    }
  }

  async function saveNotificationPanel() {
    try {
      setProfileBusy(true)
      setNotifyLimit(panelNotifyLimit)
      setWeeklySummary(panelWeeklySummary)
      await updateProfileOnBackend({
        notifyLimit: panelNotifyLimit,
        weeklySummary: panelWeeklySummary,
      })
      closeProfilePanel()
    } catch (error) {
      setProfilePanelError(error instanceof Error ? error.message : 'Falha ao atualizar notificacoes')
    } finally {
      setProfileBusy(false)
    }
  }

  async function saveSecurityPanel() {
    if (!currentPasswordInput.trim() || !newPasswordInput.trim()) {
      setProfilePanelError('Informe a senha atual e a nova senha.')
      return
    }
    try {
      setProfileBusy(true)
      await apiRequest(
        '/me/password',
        {
          method: 'PUT',
          body: JSON.stringify({
            currentPassword: currentPasswordInput.trim(),
            newPassword: newPasswordInput.trim(),
          }),
        },
        authToken,
      )
      setProfileNotice('Senha atualizada com sucesso.')
      closeProfilePanel()
    } catch (error) {
      setProfilePanelError(error instanceof Error ? error.message : 'Falha ao atualizar senha')
    } finally {
      setProfileBusy(false)
    }
  }

  async function toggleAlertPreference() {
    const next = !notifyLimit
    try {
      setNotifyLimit(next)
      await updateProfileOnBackend({ notifyLimit: next })
    } catch {
      setNotifyLimit(!next)
    }
  }

  async function toggleWeeklyPreference() {
    const next = !weeklySummary
    try {
      setWeeklySummary(next)
      await updateProfileOnBackend({ weeklySummary: next })
    } catch {
      setWeeklySummary(!next)
    }
  }

  async function exportUserData() {
    if (!authToken) return
    try {
      setProfileBusy(true)
      const data = await apiRequest<Record<string, unknown>>('/me/export', {}, authToken)
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `cashtrack-export-${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
      setProfileNotice('Dados exportados com sucesso.')
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : 'Falha ao exportar dados')
    } finally {
      setProfileBusy(false)
    }
  }

  function logoutUser() {
    void apiRequest('/auth/logout', { method: 'POST' }).catch(() => {})
    setAuthToken('')
    setTransactions([])
    setCategories(initialCategories)
    setStage('welcome')
    setActivePage('dashboard')
    setProfileNotice('')
  }

  async function deleteAccount() {
    if (!authToken) return
    const confirmed = window.confirm('Tem certeza que deseja excluir sua conta? Esta acao e permanente.')
    if (!confirmed) return
    try {
      setProfileBusy(true)
      await apiRequest('/me', { method: 'DELETE' }, authToken)
      logoutUser()
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : 'Falha ao excluir conta')
    } finally {
      setProfileBusy(false)
    }
  }

  function openAuth(view: AuthView) {
    setAuthView(view)
    setAuthError('')
    if (view === 'signup' && !authDisplayName) setAuthDisplayName(displayName || '')
  }

  function closeAuth() {
    setAuthView('none')
    setAuthError('')
    setAuthPassword('')
  }

  async function submitAuth() {
    if (!authEmail.trim() || !authPassword.trim()) {
      setAuthError('Informe email e senha.')
      return
    }
    if (authView === 'signup' && !authDisplayName.trim()) {
      setAuthError('Informe como deseja ser chamado.')
      return
    }

    try {
      setAuthSubmitting(true)
      setAuthError('')
      const endpoint = authView === 'signup' ? '/auth/register' : '/auth/login'
      const body =
        authView === 'signup'
          ? {
              email: authEmail.trim(),
              password: authPassword.trim(),
              displayName: authDisplayName.trim(),
            }
          : {
              email: authEmail.trim(),
              password: authPassword.trim(),
            }

      const authData = await apiRequest<{ user: ApiUser }>(endpoint, {
        method: 'POST',
        body: JSON.stringify(body),
      })

      setAuthToken('session')
      hydrateUserFromApi(authData.user)
      setSyncError('')
      closeAuth()
      if (authView === 'signup') {
        setStage('onboarding')
        setOnboardingStep(1)
      } else {
        setStage('app')
      }
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Falha na autenticacao')
    } finally {
      setAuthSubmitting(false)
    }
  }

  function getIconByCategoryName(name: string, type?: CategoryType) {
    const found = categories.find((category) => normalizeText(category.name) === normalizeText(name))
    return found?.icon ?? getCategoryIcon(name, type)
  }

  async function handleNextOnboarding() {
    if (onboardingStep < 3) {
      setOnboardingStep((s) => s + 1)
      return
    }
    await syncProfileToBackend()
    setStage('app')
  }

  async function saveTransaction() {
    const parsedAmount = Number(addAmount.replace(',', '.'))
    const amount = parsedQuick?.amount ?? (Number.isFinite(parsedAmount) ? parsedAmount : 0)
    const description = addDescription.trim() || parsedQuick?.description || ''
    const selectedCategory = addCategoryOptions.find((category) => category.id === addCategoryIdSelected)

    if (!amount || !description) return
    if (!selectedCategory || !authToken) return

    try {
      setSyncing(true)
      await apiRequest(
        '/transactions',
        {
          method: 'POST',
          body: JSON.stringify({
            type: addType,
            amount,
            description,
            categoryId: selectedCategory.id,
            date: addDate,
            account: addAccount,
            recurrence: addRecurrence,
            note: addNote.trim() || undefined,
          }),
        },
        authToken,
      )
      await loadUserData(authToken)
      setQuickInput('')
      setAddAmount('')
      setAddDescription('')
      setAddRecurrence('Unica')
      setAddNote('')
      setToastVisible(true)
      setTimeout(() => setToastVisible(false), 2200)
      setActivePage('dashboard')
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : 'Falha ao salvar transacao')
    } finally {
      setSyncing(false)
    }
  }

  async function handleAddCategory() {
    const name = newCategoryName.trim()
    if (!name) return

    const exists = categories.some((c) => c.type === newCategoryType && c.name.toLowerCase() === name.toLowerCase())
    if (exists) return

    if (!authToken) return
    try {
      setSyncing(true)
      await apiRequest(
        '/categories',
        {
          method: 'POST',
          body: JSON.stringify({
            name,
            type: newCategoryType,
            icon: newCategoryIcon,
          }),
        },
        authToken,
      )
      await loadUserData(authToken)
      setNewCategoryName('')
      setNewCategoryType('expense')
      setNewCategoryIcon(ICON_LIBRARY.expense[0])
      setIsAddCategoryModalOpen(false)
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : 'Falha ao adicionar categoria')
    } finally {
      setSyncing(false)
    }
  }

  async function removeCategory(id: string) {
    if (!authToken) return
    try {
      setSyncing(true)
      await apiRequest(`/categories/${id}`, { method: 'DELETE' }, authToken)
      await loadUserData(authToken)
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : 'Falha ao excluir categoria')
    } finally {
      setSyncing(false)
    }
  }

  function startEditCategory(category: Category) {
    setEditingCategoryId(category.id)
    setEditingCategoryName(category.name)
    setEditingCategoryIcon(category.icon)
  }

  async function saveEditCategory() {
    if (!editingCategoryId) return
    const name = editingCategoryName.trim()
    if (!name) return
    if (!authToken) return
    try {
      setSyncing(true)
      await apiRequest(
        `/categories/${editingCategoryId}`,
        {
          method: 'PUT',
          body: JSON.stringify({
            name,
            icon: editingCategoryIcon,
          }),
        },
        authToken,
      )
      await loadUserData(authToken)
      setEditingCategoryId(null)
      setEditingCategoryName('')
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : 'Falha ao editar categoria')
    } finally {
      setSyncing(false)
    }
  }

  function cancelEditCategory() {
    setEditingCategoryId(null)
    setEditingCategoryName('')
    setEditingCategoryIcon('')
  }

  return (
    <>
      {stage === 'welcome' && (
        <div className="insp-wbg">
          <div className="insp-wi">
            <div className="insp-whero">
              <div className="insp-wbadge">
                <span className="insp-wdot" />
                CashTrack
              </div>
              <h1 className="insp-wh1">
                CashTrack - <span>Controle financeiro</span> sem complicacao.
              </h1>
              <p className="insp-wp">
                Registro rapido, visual limpo e insights automaticos para voce nunca mais depender de planilhas.
              </p>
              <div className="insp-wbtns">
                <button className="insp-btnp" onClick={() => openAuth('signup')}>
                  Criar conta gratis
                </button>
                <button className="insp-btng" onClick={() => openAuth('login')}>
                  Ja tenho conta
                </button>
              </div>
            </div>

            <div className="insp-fgrid">
              <div className="insp-fcard">
                <div className="insp-ficon">{'\u26A1'}</div>
                <h4>Registro ultrarrapido</h4>
                <p>Digite "50 almoco" e o app interpreta valor, categoria e descricao automaticamente.</p>
              </div>
              <div className="insp-fcard">
                <div className="insp-ficon">{'\uD83D\uDCCA'}</div>
                <h4>Dashboard inteligente</h4>
                <p>Saldo, categorias e tendencias num relance com visual claro.</p>
              </div>
              <div className="insp-fcard">
                <div className="insp-ficon">{'\uD83D\uDCA1'}</div>
                <h4>Insights automaticos</h4>
                <p>Descubra oportunidades de economia sem precisar procurar.</p>
              </div>
            </div>
          </div>

          {authView !== 'none' && (
            <div className="auth-modal-wrap" onClick={closeAuth}>
              <div className="auth-modal" onClick={(event) => event.stopPropagation()}>
                <h3>{authView === 'signup' ? 'Criar conta' : 'Entrar na sua conta'}</h3>
                <p>
                  {authView === 'signup'
                    ? 'Use seus dados para criar a conta e iniciar a personalizacao.'
                    : 'Acesse com o email e senha da conta que voce ja criou.'}
                </p>
                {authView === 'signup' && (
                  <label className="auth-field">
                    <small>Como deseja ser chamado</small>
                    <input
                      className="insp-input"
                      value={authDisplayName}
                      onChange={(event) => setAuthDisplayName(event.target.value)}
                      placeholder="Ex: Joao"
                    />
                  </label>
                )}
                <label className="auth-field">
                  <small>Email</small>
                  <input
                    className="insp-input"
                    type="email"
                    value={authEmail}
                    onChange={(event) => setAuthEmail(event.target.value)}
                    placeholder="seu@email.com"
                  />
                </label>
                <label className="auth-field">
                  <small>Senha</small>
                  <input
                    className="insp-input"
                    type="password"
                    value={authPassword}
                    onChange={(event) => setAuthPassword(event.target.value)}
                    placeholder="Minimo 6 caracteres"
                  />
                </label>
                {authError && <div className="auth-error">{authError}</div>}
                <div className="auth-actions">
                  <button className="auth-btn ghost" onClick={closeAuth} disabled={authSubmitting}>
                    Cancelar
                  </button>
                  <button className="auth-btn" onClick={submitAuth} disabled={authSubmitting}>
                    {authSubmitting ? 'Processando...' : authView === 'signup' ? 'Criar conta' : 'Entrar'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {stage === 'onboarding' && (
        <div className="insp-oshell">
          <div className="insp-ocard">
            <div className="insp-sbar">
              <span className={`insp-seg ${onboardingStep > 1 ? 'done' : onboardingStep === 1 ? 'act' : ''}`} />
              <span className={`insp-seg ${onboardingStep > 2 ? 'done' : onboardingStep === 2 ? 'act' : ''}`} />
              <span className={`insp-seg ${onboardingStep === 3 ? 'act' : ''}`} />
            </div>

            {onboardingStep === 1 && (
              <>
                <h2 className="insp-otitle">Qual e seu objetivo?</h2>
                <p className="insp-osub">Escolha o que melhor descreve sua situacao. Personalizamos a experiencia para voce.</p>
                {goalOptions.map((goal) => (
                  <button
                    key={goal.id}
                    className={`insp-gopt ${selectedGoal === goal.id ? 'sel' : ''}`}
                    onClick={() => setSelectedGoal(goal.id)}
                  >
                    <span className="insp-gemo">{goal.emoji}</span>
                    <span className="insp-gtxt">
                      <strong>{goal.title}</strong>
                      <small>{goal.text}</small>
                    </span>
                    <span className={`insp-gchk ${selectedGoal === goal.id ? 'on' : ''}`}>
                      <span />
                    </span>
                  </button>
                ))}
              </>
            )}

            {onboardingStep === 2 && (
              <>
                <h2 className="insp-otitle">Monte seu perfil</h2>
                <p className="insp-osub">Essas informacoes nos ajudam a dar insights mais precisos.</p>
                <label className="insp-flbl">Como deseja ser chamado</label>
                <input
                  className="insp-finp"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  placeholder="Ex: Joao Silva"
                />
                <label className="insp-flbl">Renda mensal aproximada</label>
                <input
                  className="insp-finp"
                  value={monthlyIncome}
                  onChange={(event) => setMonthlyIncome(formatCurrencyTyping(event.target.value))}
                  placeholder="R$ 0,00"
                />
                <label className="insp-flbl">Quanto quer guardar por mes?</label>
                <input
                  className="insp-finp"
                  value={targetSave}
                  onChange={(event) => setTargetSave(formatCurrencyTyping(event.target.value))}
                  placeholder="R$ 0,00"
                />

                <div className="insp-trow">
                  <div className="insp-trtxt">
                    <strong>Alertas de gastos excessivos</strong>
                    <small>Avise quando gastar mais de 70% da renda</small>
                  </div>
                  <button className={`insp-tog ${notifyLimit ? 'on' : ''}`} onClick={() => setNotifyLimit((v) => !v)} />
                </div>

                <div className="insp-trow">
                  <div className="insp-trtxt">
                    <strong>Resumo semanal</strong>
                    <small>Receba um resumo toda segunda-feira</small>
                  </div>
                  <button
                    className={`insp-tog ${weeklySummary ? 'on' : ''}`}
                    onClick={() => setWeeklySummary((v) => !v)}
                  />
                </div>
              </>
            )}

            {onboardingStep === 3 && (
              <>
                <h2 className="insp-otitle">Suas categorias</h2>
                <p className="insp-osub">Ja preparamos as mais comuns para voce. Personalize depois.</p>
                <div className="insp-ready">
                  <strong>✨ Tudo pronto para voce!</strong>
                  <small>Ja preparamos as categorias mais comuns. Personalize depois.</small>
                </div>
                <div className="insp-catslbl">Despesas</div>
                <div className="insp-cgrid insp-cgrid-exp">
                  {CATEGORY_PRESETS.filter((preset) => preset.type === 'expense').map((preset) => (
                    <div key={preset.name} className="insp-cchip">
                      <span className="insp-cic">{preset.icon}</span>
                      <span className="insp-cnm">{preset.name}</span>
                    </div>
                  ))}
                </div>
                <div className="insp-catslbl">Receitas</div>
                <div className="insp-cgrid insp-cgrid-inc">
                  {CATEGORY_PRESETS.filter((preset) => preset.type === 'income').map((preset) => (
                    <div key={preset.name} className="insp-cchip">
                      <span className="insp-cic">{preset.icon}</span>
                      <span className="insp-cnm">{preset.name}</span>
                    </div>
                  ))}
                </div>
              </>
            )}

            <button className="insp-obtn" onClick={handleNextOnboarding}>
              {onboardingStep < 3 ? 'Avancar ->' : 'Comecar agora ✓'}
            </button>
          </div>
        </div>
      )}

      {stage === 'app' && (
        <div className="insp-app">
          <div className="insp-shell">
            <aside className={`insp-sb ${sidebarCollapsed ? 'col' : ''}`}>
              <div className="insp-logo">
                <div className="insp-mark">CT</div>
                <div className="insp-word">
                  Cash<span>Track</span>
                </div>
              </div>

              <nav className="insp-nav">
                {!sidebarCollapsed && <p className="insp-navcap">Principal</p>}
                <button className={activePage === 'dashboard' ? 'act' : ''} onClick={() => setActivePage('dashboard')}>
                  {sidebarCollapsed ? 'D' : 'Dashboard'}
                </button>
                <button className={activePage === 'transactions' ? 'act' : ''} onClick={() => setActivePage('transactions')}>
                  {sidebarCollapsed ? 'T' : 'Transacoes'}
                  {!sidebarCollapsed && transactions.length > 0 && <span className="insp-badge">{transactions.length}</span>}
                </button>
                <button className={activePage === 'add' ? 'act' : ''} onClick={() => setActivePage('add')}>
                  {sidebarCollapsed ? '+' : 'Adicionar'}
                </button>
                <button className={activePage === 'categories' ? 'act' : ''} onClick={() => setActivePage('categories')}>
                  {sidebarCollapsed ? 'C' : 'Categorias'}
                </button>
                {!sidebarCollapsed && <p className="insp-navcap">Analise</p>}
                <button className={activePage === 'reports' ? 'act' : ''} onClick={() => setActivePage('reports')}>
                  {sidebarCollapsed ? 'R' : 'Relatorios'}
                </button>
                {!sidebarCollapsed && <p className="insp-navcap">Conta</p>}
                <button className={activePage === 'profile' ? 'act' : ''} onClick={() => setActivePage('profile')}>
                  {sidebarCollapsed ? 'P' : 'Perfil'}
                </button>
              </nav>

              {!sidebarCollapsed && (
                <div className="insp-premium">
                  <strong>Ir Premium</strong>
                  <small>Metas, relatorios avancados e insights exclusivos.</small>
                  <button onClick={() => setActivePage('premium')}>Ver planos</button>
                </div>
              )}
            </aside>

            <main className="insp-main">
              <header className="insp-topbar">
                <div className="insp-tleft">
                  <button className="insp-menbtn" onClick={() => setSidebarCollapsed((v) => !v)}>
                    {sidebarCollapsed ? '>>' : '<<'}
                  </button>
                  <div className="insp-title">{pageTitle[activePage]}</div>
                </div>
                <div className="insp-tright">
                  <input className="insp-search" placeholder="Buscar..." />
                  <div className="insp-meta">{getCurrentMonthYearLabel()}</div>
                  <div className="insp-user">{profileInitials || 'CT'}</div>
                </div>
              </header>

              <div className={`insp-content ${activePage === 'add' ? 'add-page' : ''}`}>
                {(syncError || syncing) && (
                  <div className="insp-sync-status">
                    {syncing ? 'Sincronizando com o backend...' : `Erro de sincronizacao: ${syncError}`}
                  </div>
                )}
                {activePage === 'dashboard' && (
                  <>
                    <section className="dash2-top">
                      <article className={`dash2-stat is-balance ${balance >= 0 ? 'is-positive' : 'is-negative'}`}>
                        <small>Saldo atual</small>
                        <strong>{money(balance)}</strong>
                      </article>
                      <article className="dash2-stat">
                        <small>Receitas</small>
                        <strong className="insp-inc">{money(incomeTotal)}</strong>
                      </article>
                      <article className="dash2-stat">
                        <small>Despesas</small>
                        <strong className="insp-exp">{money(expenseTotal)}</strong>
                      </article>
                    </section>

                    <section className="dash2-grid">
                      <article className="dash2-panel">
                        <h3>Gastos por categoria</h3>
                        <div className="dash2-category-wrap chart-has-tooltip">
                          <div className="dash2-donut" style={{ background: donutBackground }} />
                          {donutKpi && (
                            <div className="chart-tip chart-tip-floating">
                              <strong>{donutKpi.category}</strong>
                              <small>
                                {money(donutKpi.amount)} · {Math.round(donutKpi.pct)}%
                              </small>
                            </div>
                          )}
                          <ul className="dash2-legend">
                            {categorySlices.length > 0 ? (
                              categorySlices.map((slice) => (
                                <li
                                  key={slice.category}
                                  onMouseEnter={() => setHoveredDonutSlice(slice.category)}
                                  onMouseLeave={() => setHoveredDonutSlice(null)}
                                >
                                  <span className="dash2-dot" style={{ background: slice.color }} />
                                  <p>{slice.category}</p>
                                  <strong>{money(slice.amount)}</strong>
                                </li>
                              ))
                            ) : (
                              <li className="insp-empty">Sem despesas registradas ainda.</li>
                            )}
                          </ul>
                        </div>
                      </article>

                      <article className="dash2-panel">
                        <h3>Ultimas transacoes</h3>
                        <ul className="dash-last">
                          {dashboardTransactions.length > 0 ? (
                            dashboardTransactions.slice(0, 5).map((tx) => (
                              <li key={tx.id}>
                                <div className="dash-last-left">
                                  <span className="dash-ico">{getIconByCategoryName(tx.category, tx.type)}</span>
                                  <div>
                                    <p>{tx.description}</p>
                                    <small>{tx.date}</small>
                                  </div>
                                </div>
                                <span className={tx.type === 'expense' ? 'insp-exp' : 'insp-inc'}>
                                  {tx.type === 'expense' ? '-' : '+'}
                                  {money(tx.amount)}
                                </span>
                              </li>
                            ))
                          ) : (
                            <li className="insp-empty">Nenhuma transacao no mes atual. Use a aba Adicionar para comecar.</li>
                          )}
                        </ul>
                      </article>
                    </section>

                    <div className="dash-head">
                      <h3>Insights do mes</h3>
                      <button>Ver todos</button>
                    </div>
                    <section className="dash2-insight-grid">
                      <article className="dash2-insight-card spend">
                        <span>🍔</span>
                        <div>
                          <p>{spendingInsightTitle}</p>
                          <small>{spendingInsightText}</small>
                        </div>
                      </article>
                      <article className="dash2-insight-card eco">
                        <span>✅</span>
                        <div>
                          <p>{economyInsightTitle}</p>
                          <small>{economyInsightText}</small>
                        </div>
                      </article>
                    </section>

                    <div className="dash-head">
                      <h3>Comportamento Financeiro</h3>
                    </div>
                    <section className="dash2-bottom">
                      <article className="dash2-weekly">
                        <h3>📊 Gastos por dia da semana</h3>
                        <p>
                          Padrao de gastos ao longo da semana. Voce descobre quando gasta mais e pode ajustar seu
                          comportamento.
                        </p>
                        <div className="dash2-week-grid">
                          {weeklySpending.map((item) => {
                            const pct = item.amount > 0 ? Math.max(18, Math.round((item.amount / maxWeekly) * 100)) : 8
                            return (
                              <div
                                key={item.day}
                                className="dash2-week-item"
                                onMouseEnter={() => setHoveredWeekDay(item.day)}
                                onMouseLeave={() => setHoveredWeekDay(null)}
                              >
                                <small>{item.day}</small>
                                {weeklyKpi?.day === item.day && (
                                  <div className="chart-tip chart-tip-inline">
                                    <strong>{item.day}</strong>
                                    <small>{money(item.amount)}</small>
                                  </div>
                                )}
                                <div className="dash2-week-track">
                                  <span style={{ height: `${pct}%`, background: weeklyColor(item.amount) }} />
                                </div>
                                <strong>{money(item.amount)}</strong>
                              </div>
                            )
                          })}
                        </div>
                        <div className="dash2-week-note">
                          {hasWeeklyData
                            ? `${highestWeeklyExpense.day}-feira e seu dia de maior gasto desta semana.`
                            : 'Sem despesas registradas nesta semana.'}
                        </div>
                      </article>

                      <article className="dash2-tips">
                        <h3>💡 Dicas financeiras personalizadas</h3>
                        {personalizedTips.length > 0 ? (
                          <ul>
                            {personalizedTips.map((tip, index) => (
                              <li key={`${tip.title}-${index}`}>
                                <span className={`dot ${tip.dot}`} />
                                <div className="tip-copy">
                                  <strong>{tip.title}</strong>
                                  <small>{tip.text}</small>
                                </div>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <div className="tip-copy">
                            <strong>Preencha renda, meta e primeiras transacoes.</strong>
                            <small>As dicas aparecem automaticamente conforme voce alimenta seus dados.</small>
                          </div>
                        )}
                      </article>
                    </section>
                  </>
                )}

                {activePage === 'transactions' && (
                  <article className="insp-card tx-page">
                    <div className="tx-head">
                      <div className="tx-month">{transactionMonthLabel.toUpperCase()}</div>
                      <label className="tx-filter">
                        <span>Filtrar mes</span>
                        <select value={transactionMonthFilter} onChange={(event) => setTransactionMonthFilter(event.target.value)}>
                          <option value="all">Todos os meses</option>
                          {transactionMonthOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <ul className="tx-list">
                      {transactionsFilteredByMonth.length > 0 ? (
                        transactionsFilteredByMonth.map((tx) => (
                          <li key={tx.id}>
                            <div className="tx-left">
                              <span className="tx-icon">{getIconByCategoryName(tx.category, tx.type)}</span>
                              <div>
                                <p className="tx-title">{tx.description}</p>
                                <p className="tx-meta">
                                  {tx.type === 'income' ? 'Receita' : tx.category}
                                  {' · '}
                                  {tx.date}
                                  {tx.account ? ` · ${tx.account}` : ''}
                                  {tx.recurrence && tx.recurrence !== 'Unica' ? ` · ${tx.recurrence}` : ''}
                                </p>
                              </div>
                            </div>
                            <span className={tx.type === 'expense' ? 'insp-exp' : 'insp-inc'}>
                              {tx.type === 'expense' ? '-' : '+'}
                              {money(tx.amount)}
                            </span>
                          </li>
                        ))
                      ) : (
                        <li className="insp-empty">Sem transacoes no mes selecionado.</li>
                      )}
                    </ul>
                  </article>
                )}

                {activePage === 'add' && (
                  <article className="insp-card addx-wrap">
                    <div className="addx-type-toggle">
                      <button
                        className={`addx-tt-btn ${addType === 'expense' ? 'exp-on' : 'exp'}`}
                        onClick={() => setAddType('expense')}
                        type="button"
                      >
                        💸 Despesa
                      </button>
                      <button
                        className={`addx-tt-btn ${addType === 'income' ? 'inc-on' : 'inc'}`}
                        onClick={() => setAddType('income')}
                        type="button"
                      >
                        💰 Receita
                      </button>
                    </div>

                    <div className="addx-quick-card">
                      <div className="addx-quick-lbl">⚡ Modo rapido</div>
                      <input
                        className="addx-quick-input"
                        value={quickInput}
                        onChange={(event) => setQuickInput(event.target.value)}
                        placeholder="50 almoco"
                      />
                      <div className="addx-quick-hint">Digite valor + descricao · Ex: "38,50 gasolina" · "1200 aluguel"</div>
                    </div>

                    {parsedQuick && (
                      <div className="addx-parsed">
                        <div className="addx-parsed-lbl">Interpretado automaticamente</div>
                        <div className="addx-pills">
                          <div className="addx-pill">
                            <span>Valor</span>
                            <b>{money(parsedQuick.amount)}</b>
                          </div>
                          <div className="addx-pill">
                            <span>Descricao</span>
                            <b>{parsedQuick.description}</b>
                          </div>
                          <div className="addx-pill">
                            <span>Categoria</span>
                            <b>{parsedQuick.category}</b>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="addx-divider">ou preencha manualmente</div>

                    <div className="addx-grid two">
                      <label className="addx-field">
                        <small>Valor (R$)</small>
                        <input
                          className="insp-input"
                          value={addAmount}
                          onChange={(event) => setAddAmount(formatCurrencyTyping(event.target.value))}
                          placeholder="0,00"
                        />
                      </label>
                      <label className="addx-field">
                        <small>Descricao</small>
                        <input
                          className="insp-input"
                          value={addDescription}
                          onChange={(event) => setAddDescription(event.target.value)}
                          placeholder="Ex: almoco, uber, aluguel..."
                        />
                      </label>
                    </div>

                    <div className="addx-grid three">
                      <label className="addx-field">
                        <small>Data</small>
                        <input
                          className="insp-input"
                          type="date"
                          value={addDate}
                          onChange={(event) => setAddDate(event.target.value)}
                        />
                      </label>
                      <label className="addx-field">
                        <small>Categoria</small>
                        <select
                          className="cats-select add-select"
                          value={addCategoryIdSelected}
                          onChange={(event) => setAddCategoryIdSelected(event.target.value)}
                        >
                          {addCategoryOptions.map((category) => (
                            <option key={category.id} value={category.id}>
                              {category.icon} {category.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="addx-field">
                        <small>Conta</small>
                        <select className="cats-select add-select" value={addAccount} onChange={(event) => setAddAccount(event.target.value)}>
                          <option>Conta corrente</option>
                          <option>Cartao de credito</option>
                          <option>Dinheiro</option>
                          <option>Pix</option>
                        </select>
                      </label>
                    </div>
                    {!isAddDateCurrentMonth && addDateMonthLabel && (
                      <div className="addx-date-note">
                        Esse lancamento sera contabilizado em <strong>{addDateMonthLabel}</strong> e nao no painel do mes atual.
                      </div>
                    )}

                    <div className="addx-field">
                      <small>Recorrencia</small>
                      <div className="addx-recur-row">
                        {recurrenceOptions.map((option) => (
                          <button
                            key={option}
                            type="button"
                            className={`addx-recur-chip ${addRecurrence === option ? 'on' : ''}`}
                            onClick={() => setAddRecurrence(option)}
                          >
                            {option}
                          </button>
                        ))}
                      </div>
                    </div>

                    <label className="addx-field">
                      <small>Nota (opcional)</small>
                      <textarea
                        className="insp-input addx-note"
                        value={addNote}
                        onChange={(event) => setAddNote(event.target.value.slice(0, 120))}
                        rows={3}
                        placeholder="Adicione um lembrete ou detalhe sobre esta transacao..."
                      />
                      <span className="addx-note-count">{addNote.length}/120</span>
                    </label>

                    <div className="addx-switch-row">
                      <div>
                        <h4>Notificar quando lancado</h4>
                        <p>Receber confirmacao por notificacao push</p>
                      </div>
                      <button type="button" className={`insp-tog ${addNotify ? 'on' : ''}`} onClick={() => setAddNotify((v) => !v)} />
                    </div>

                    <button className={`insp-save add-save ${addType}`} onClick={saveTransaction}>
                      {addType === 'expense' ? 'Salvar despesa' : 'Salvar receita'}
                    </button>
                    <div className={`insp-toast ${toastVisible ? 'on' : ''}`}>Transacao registrada com sucesso!</div>

                    <div className="addx-recent">
                      <div className="addx-recent-title">Lancamentos rapidos frequentes</div>
                      <div className="addx-recent-grid">
                        {frequentQuickPresets.length > 0 ? (
                          frequentQuickPresets.map((preset) => (
                            <button
                              key={preset.raw}
                              type="button"
                              className="addx-recent-chip"
                              onClick={() => setQuickInput(preset.raw)}
                            >
                              <div className="addx-recent-icon">{preset.icon}</div>
                              <div className="addx-recent-name">{preset.name}</div>
                              <div className="addx-recent-val">{preset.value}</div>
                            </button>
                          ))
                        ) : (
                          <p className="insp-empty">Os lancamentos frequentes aparecem aqui apos seus primeiros registros reais.</p>
                        )}
                      </div>
                    </div>
                  </article>
                )}

                {activePage === 'reports' && (
                  <section className="reportx">
                    <div className="reportx-top">
                      <div>
                        <h2>Relatorios financeiros</h2>
                        <p>Dados reais consolidados da sua conta para apoiar decisoes mensais.</p>
                      </div>
                      <button className="reportx-export" type="button" onClick={() => setActivePage('transactions')}>
                        Ver transacoes
                      </button>
                    </div>

                    <div className="reportx-filters">
                      {reportPeriods.map((period) => (
                        <button
                          key={period}
                          type="button"
                          className={reportPeriod === period ? 'on' : ''}
                          onClick={() => setReportPeriod(period)}
                        >
                          {period === 'ALL' ? 'Ano todo' : period}
                        </button>
                      ))}
                      <button type="button" onClick={() => setReportYear((year) => year - 1)}>
                        {reportYear - 1}
                      </button>
                      <button type="button" className="on">
                        {reportYear}
                      </button>
                      <button type="button" onClick={() => setReportYear((year) => year + 1)}>
                        {reportYear + 1}
                      </button>
                    </div>

                    <section className="reportx-kpi">
                      <article>
                        <small>Receitas no periodo</small>
                        <strong className="insp-inc">{money(reportIncome)}</strong>
                      </article>
                      <article>
                        <small>Despesas no periodo</small>
                        <strong className="insp-exp">{money(reportExpense)}</strong>
                      </article>
                      <article>
                        <small>Saldo no periodo</small>
                        <strong>{money(reportBalance)}</strong>
                      </article>
                      <article>
                        <small>Transacoes</small>
                        <strong>{reportTxCount}</strong>
                      </article>
                    </section>

                    <article className="reportx-card">
                      <div className="reportx-card-head">
                        <h3>Evolucao mensal</h3>
                        <p className="reportx-legend">
                          Verde: Ganhos · Vermelho: Gastos · Azul: Saldo positivo (ganhos - gastos, quando maior que zero)
                        </p>
                      </div>
                      <div className="reportx-bars">
                        {monthlyReportBars.map((item) => (
                          <div
                            key={`${reportYear}-${item.month}`}
                            className="reportx-bar-col"
                            onMouseEnter={() => setHoveredReportMonth(item.month)}
                            onMouseLeave={() => setHoveredReportMonth(null)}
                          >
                            {monthlyKpi?.month === item.month && (
                              <div className="chart-tip chart-tip-inline">
                                <strong>{monthShortLabel(item.month - 1)}</strong>
                                <small className="reportx-tip-line gain">Ganhos: {money(item.inc)}</small>
                                <small className="reportx-tip-line expense">Gastos: {money(item.exp)}</small>
                                <small className="reportx-tip-line balance">
                                  Azul (saldo positivo): {money(item.eco)}
                                </small>
                              </div>
                            )}
                            <div className="reportx-bar-stack">
                              <span className="inc" style={{ height: `${Math.max(4, (item.inc / monthlyBarMax) * 100)}%` }} />
                              <span className="exp" style={{ height: `${Math.max(4, (item.exp / monthlyBarMax) * 100)}%` }} />
                              <span className="eco" style={{ height: `${Math.max(4, (item.eco / monthlyBarMax) * 100)}%` }} />
                            </div>
                            <small>{monthShortLabel(item.month - 1)}</small>
                          </div>
                        ))}
                      </div>
                    </article>

                    <section className="reportx-insights">
                      <article>
                        <strong>Maior categoria de gasto</strong>
                        <p>
                          {reportTopCategory
                            ? `${reportTopCategory.name} representa ${Math.round(reportTopCategory.pct)}% dos gastos do periodo.`
                            : 'Sem despesas suficientes para identificar categoria dominante.'}
                        </p>
                      </article>
                      <article>
                        <strong>Ticket medio</strong>
                        <p>{reportTxCount > 0 ? `${money(reportAvgTicket)} por transacao.` : 'Sem transacoes no periodo selecionado.'}</p>
                      </article>
                      <article>
                        <strong>Status do periodo</strong>
                        <p>
                          {reportBalance >= 0
                            ? `Saldo positivo de ${money(reportBalance)}.`
                            : `Saldo negativo de ${money(Math.abs(reportBalance))}.`}
                        </p>
                      </article>
                    </section>

                    <article className="reportx-card">
                      <div className="reportx-card-head">
                        <h3>Distribuicao por categoria</h3>
                      </div>
                      <ul className="reportx-cat-list">
                        {reportExpenseByCategory.length > 0 ? (
                          reportExpenseByCategory.slice(0, 8).map((item, index) => (
                            <li
                              key={item.name}
                              onMouseEnter={() => setHoveredReportCategory(item.name)}
                              onMouseLeave={() => setHoveredReportCategory(null)}
                            >
                              <span className="dot" style={{ background: chartColors[index % chartColors.length] }} />
                              <span className="name">{item.name}</span>
                              <span className="pct">{Math.round(item.pct)}%</span>
                              <span className="amt">{money(item.amount)}</span>
                              {reportCategoryKpi?.name === item.name && (
                                <div className="chart-tip chart-tip-row">
                                  <strong>{item.name}</strong>
                                  <small>
                                    {Math.round(item.pct)}% · {money(item.amount)}
                                  </small>
                                </div>
                              )}
                            </li>
                          ))
                        ) : (
                          <li className="insp-empty">Sem despesas no periodo para montar distribuicao.</li>
                        )}
                      </ul>
                    </article>

                    {(reportLoading || reportError) && (
                      <div className="insp-sync-status">
                        {reportLoading ? 'Atualizando relatorios...' : `Erro ao carregar relatorios: ${reportError}`}
                      </div>
                    )}
                  </section>
                )}

                {activePage === 'categories' && (
                  <article className="insp-card cats-page">
                    <div className="cats-head">
                      <div className="insp-section-title">Categorias</div>
                      <button className="insp-save" onClick={() => setIsAddCategoryModalOpen(true)}>
                        Adicionar categoria
                      </button>
                    </div>

                    <div className="cats-grid">
                      <section className="cats-section">
                        <h4>Despesas</h4>
                        <ul>
                          {expenseCategories.map((category) => (
                            <li key={category.id}>
                              {editingCategoryId === category.id ? (
                                <>
                                  <input
                                    className="insp-input"
                                    value={editingCategoryName}
                                    onChange={(event) => setEditingCategoryName(event.target.value)}
                                  />
                                  <div className="cats-icon-picker inline">
                                    {ICON_LIBRARY[category.type].map((icon) => (
                                      <button
                                        type="button"
                                        key={`${category.id}-${icon}`}
                                        className={`cats-pick ${editingCategoryIcon === icon ? 'on' : ''}`}
                                        onClick={() => setEditingCategoryIcon(icon)}
                                      >
                                        {icon}
                                      </button>
                                    ))}
                                  </div>
                                  <div className="cats-actions">
                                    <button className="cats-btn ok" onClick={saveEditCategory}>
                                      Salvar
                                    </button>
                                    <button className="cats-btn" onClick={cancelEditCategory}>
                                      Cancelar
                                    </button>
                                  </div>
                                </>
                              ) : (
                                <>
                                  <div className="cats-item-left">
                                    <span className="cats-icon">{category.icon}</span>
                                    <strong>{category.name}</strong>
                                    <small>{category.predefined ? 'Predefinida' : 'Personalizada'}</small>
                                  </div>
                                  {!category.predefined && (
                                    <div className="cats-actions">
                                      <button className="cats-btn" onClick={() => startEditCategory(category)}>
                                        Editar
                                      </button>
                                      <button className="cats-btn danger" onClick={() => removeCategory(category.id)}>
                                        Excluir
                                      </button>
                                    </div>
                                  )}
                                </>
                              )}
                            </li>
                          ))}
                        </ul>
                      </section>

                      <section className="cats-section">
                        <h4>Receitas</h4>
                        <ul>
                          {incomeCategories.map((category) => (
                            <li key={category.id}>
                              {editingCategoryId === category.id ? (
                                <>
                                  <input
                                    className="insp-input"
                                    value={editingCategoryName}
                                    onChange={(event) => setEditingCategoryName(event.target.value)}
                                  />
                                  <div className="cats-icon-picker inline">
                                    {ICON_LIBRARY[category.type].map((icon) => (
                                      <button
                                        type="button"
                                        key={`${category.id}-${icon}`}
                                        className={`cats-pick ${editingCategoryIcon === icon ? 'on' : ''}`}
                                        onClick={() => setEditingCategoryIcon(icon)}
                                      >
                                        {icon}
                                      </button>
                                    ))}
                                  </div>
                                  <div className="cats-actions">
                                    <button className="cats-btn ok" onClick={saveEditCategory}>
                                      Salvar
                                    </button>
                                    <button className="cats-btn" onClick={cancelEditCategory}>
                                      Cancelar
                                    </button>
                                  </div>
                                </>
                              ) : (
                                <>
                                  <div className="cats-item-left">
                                    <span className="cats-icon">{category.icon}</span>
                                    <strong>{category.name}</strong>
                                    <small>{category.predefined ? 'Predefinida' : 'Personalizada'}</small>
                                  </div>
                                  {!category.predefined && (
                                    <div className="cats-actions">
                                      <button className="cats-btn" onClick={() => startEditCategory(category)}>
                                        Editar
                                      </button>
                                      <button className="cats-btn danger" onClick={() => removeCategory(category.id)}>
                                        Excluir
                                      </button>
                                    </div>
                                  )}
                                </>
                              )}
                            </li>
                          ))}
                        </ul>
                      </section>
                    </div>

                    {isAddCategoryModalOpen && (
                      <div className="cats-modal-wrap" onClick={() => setIsAddCategoryModalOpen(false)}>
                        <div className="cats-modal" onClick={(event) => event.stopPropagation()}>
                          <h3>Nova categoria</h3>
                          <input
                            className="insp-input"
                            value={newCategoryName}
                            onChange={(event) => setNewCategoryName(event.target.value)}
                            placeholder="Nome da categoria"
                          />
                          <select
                            className="cats-select"
                            value={newCategoryType}
                            onChange={(event) => {
                              const nextType = event.target.value as CategoryType
                              setNewCategoryType(nextType)
                              setNewCategoryIcon(ICON_LIBRARY[nextType][0])
                            }}
                          >
                            <option value="expense">Despesa</option>
                            <option value="income">Receita</option>
                          </select>
                          <div className="cats-icon-picker">
                            {iconOptions.map((icon) => (
                              <button
                                type="button"
                                key={`new-${icon}`}
                                className={`cats-pick ${newCategoryIcon === icon ? 'on' : ''}`}
                                onClick={() => setNewCategoryIcon(icon)}
                              >
                                {icon}
                              </button>
                            ))}
                          </div>
                          <div className="cats-modal-actions">
                            <button className="cats-btn" onClick={() => setIsAddCategoryModalOpen(false)}>
                              Cancelar
                            </button>
                            <button className="cats-btn ok" onClick={handleAddCategory}>
                              Salvar categoria
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </article>
                )}

                {activePage === 'profile' && (
                  <section className="profilex">
                    <article className="profilex-head">
                      <div className="profilex-id">
                        <div className="profilex-avatar">{profileInitials || 'JS'}</div>
                        <div>
                          <h3>{profileName}</h3>
                          <span>Plano Gratuito</span>
                        </div>
                      </div>
                      <div className="profilex-stats">
                        <div>
                          <small>Objetivo atual</small>
                          <strong>{goalOptions.find((g) => g.id === selectedGoal)?.title}</strong>
                        </div>
                        <div>
                          <small>Meta mensal</small>
                          <strong>{money(Number(targetSave) || 0)}</strong>
                        </div>
                      </div>
                    </article>

                    <article className="profilex-premium">
                      <div>
                        <h4>✨ Torne-se Premium</h4>
                        <p>Metas, relatorios avancados e insights exclusivos.</p>
                      </div>
                      <button onClick={() => setActivePage('premium')}>Ver planos</button>
                    </article>

                    <button className="insp-save" onClick={syncProfileToBackend}>
                      Salvar alteracoes do perfil
                    </button>
                    {profileNotice && <div className="insp-sync-status">{profileNotice}</div>}

                    <div className="profilex-group">
                      <p>Conta</p>
                      <button onClick={() => openProfilePanel('edit')}>
                        <span>👤 Editar perfil</span>
                        <i>›</i>
                      </button>
                      <button onClick={() => openProfilePanel('notifications')}>
                        <span>🔔 Notificacoes</span>
                        <i>›</i>
                      </button>
                      <button onClick={() => openProfilePanel('security')}>
                        <span>🔐 Seguranca</span>
                        <i>›</i>
                      </button>
                    </div>

                    <div className="profilex-group">
                      <p>Dados</p>
                      <button onClick={() => openProfilePanel('edit')}>
                        <span>💼 Renda mensal: {money(Number(monthlyIncome) || 0)}</span>
                        <i>›</i>
                      </button>
                      <button onClick={() => setActivePage('categories')}>
                        <span>🗂 Categorias personalizadas: {customCategoriesCount}</span>
                        <i>›</i>
                      </button>
                      <button onClick={exportUserData}>
                        <span>📤 Exportar dados</span>
                        <i>›</i>
                      </button>
                      <button className="danger" onClick={deleteAccount}>
                        <span>🗑 Excluir conta</span>
                        <i>›</i>
                      </button>
                    </div>

                    <div className="profilex-group">
                      <p>Preferencias</p>
                      <button onClick={toggleAlertPreference}>
                        <span>⚠ Alertas de gasto: {notifyLimit ? 'Ativo' : 'Desativado'}</span>
                        <i>›</i>
                      </button>
                      <button onClick={toggleWeeklyPreference}>
                        <span>📬 Resumo semanal: {weeklySummary ? 'Ativo' : 'Desativado'}</span>
                        <i>›</i>
                      </button>
                      <button onClick={() => window.open('https://github.com', '_blank')}>
                        <span>⭐ Avaliar o app</span>
                        <i>›</i>
                      </button>
                      <button onClick={logoutUser}>
                        <span>🚪 Sair da conta</span>
                        <i>›</i>
                      </button>
                    </div>
                  </section>
                )}

                {activePage === 'premium' && (
                  <section className="premiumx">
                    <article className="premiumx-hero">
                      <p className="premiumx-kicker">Plano Premium CashTrack</p>
                      <h2>Tenha mais controle, previsao e velocidade nas suas decisoes financeiras.</h2>
                      <p>
                        Desbloqueie recursos avancados para transformar seus dados em acoes objetivas no dia a dia.
                      </p>
                      <div className="premiumx-badges">
                        <span>Insights avancados</span>
                        <span>Relatorios detalhados</span>
                        <span>Metas inteligentes</span>
                        <span>Suporte prioritario</span>
                      </div>
                    </article>

                    <article className="premiumx-notice">
                      <strong>✅ Funcionalidades Premium Liberadas</strong>
                      <p>
                        No momento, todas as funcionalidades premium estão liberadas para sua conta, sem custo algum.
                      </p>
                      <p className="premiumx-testers-note">
                        Aproveite para explorar, testar, clicar em tudo, quebrar o sistema (de preferência sem quebrar muito 😅) e experimentar todos os recursos avançados enquanto essa liberação estiver ativa.
                      </p>
                      <p className="premiumx-testers-note">
                        💜 Recado para nossos queridos testers:
                        <br />
                        Vocês foram cuidadosamente selecionados por critérios extremamente rigorosos e científicos... basicamente porque são lindos, incríveis e o Quintão ama muito todos vocês.
                      </p>
                      <p>
                        Obrigado por ajudarem o CashTrack a ficar cada vez melhor. 🚀
                      </p>
                    </article>

                    <div className="premiumx-grid">
                      <article className="premiumx-card">
                        <h3>Analise completa</h3>
                        <ul>
                          <li>Relatorios com comparativo por periodos</li>
                          <li>Leitura por categorias e tendencias</li>
                          <li>Visao rapida de risco e oportunidades</li>
                        </ul>
                      </article>
                      <article className="premiumx-card">
                        <h3>Planejamento inteligente</h3>
                        <ul>
                          <li>Metas com acompanhamento continuo</li>
                          <li>Alertas de gasto personalizados</li>
                          <li>Resumo semanal para tomada de decisao</li>
                        </ul>
                      </article>
                      <article className="premiumx-card">
                        <h3>Produtividade financeira</h3>
                        <ul>
                          <li>Fluxo rapido para lancamentos</li>
                          <li>Organizacao com categorias personalizadas</li>
                          <li>Exportacao de dados para auditoria</li>
                        </ul>
                      </article>
                    </div>

                    <article className="premiumx-cta">
                      <div>
                        <h3>Seu plano atual: Premium liberado</h3>
                        <p>Continue usando normalmente e aproveite todos os recursos sem bloqueios.</p>
                      </div>
                      <button className="premiumx-btn" onClick={() => setActivePage('dashboard')}>
                        Ir para Dashboard
                      </button>
                    </article>
                  </section>
                )}
              </div>

              <footer className="insp-bottombar">
                <button className={activePage === 'dashboard' ? 'act' : ''} onClick={() => setActivePage('dashboard')}>
                  <span className="nav-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none">
                      <rect x="4" y="4" width="6" height="6" rx="1.2" />
                      <rect x="14" y="4" width="6" height="6" rx="1.2" />
                      <rect x="4" y="14" width="6" height="6" rx="1.2" />
                      <rect x="14" y="14" width="6" height="6" rx="1.2" />
                    </svg>
                  </span>
                  <small className="nav-label">Inicio</small>
                </button>
                <button className={activePage === 'transactions' ? 'act' : ''} onClick={() => setActivePage('transactions')}>
                  <span className="nav-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none">
                      <rect x="6" y="4" width="12" height="16" rx="2" />
                      <path d="M9 9h6M9 13h6M9 17h4" />
                      <path d="M10 4h4" />
                    </svg>
                  </span>
                  <small className="nav-label">Transacoes</small>
                </button>
                <button className={`insp-plus ${activePage === 'add' ? 'act' : ''}`} onClick={() => setActivePage('add')}>
                  <span className="nav-icon nav-icon-plus" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none">
                      <path d="M12 7v10M7 12h10" />
                    </svg>
                  </span>
                  <small className="nav-label">Adicionar</small>
                </button>
                <button className={activePage === 'reports' ? 'act' : ''} onClick={() => setActivePage('reports')}>
                  <span className="nav-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none">
                      <path d="M4 14c2 0 2-6 4-6s2 8 4 8 2-10 4-10 2 6 4 6" />
                    </svg>
                  </span>
                  <small className="nav-label">Relatorios</small>
                </button>
                <button className={activePage === 'profile' ? 'act' : ''} onClick={() => setActivePage('profile')}>
                  <span className="nav-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="8" r="3.2" />
                      <path d="M6.5 18.5c1.1-2.4 3.1-3.6 5.5-3.6s4.4 1.2 5.5 3.6" />
                    </svg>
                  </span>
                  <small className="nav-label">Perfil</small>
                </button>
              </footer>
            </main>

            {profilePanel !== 'none' && (
              <div className="auth-modal-wrap" onClick={closeProfilePanel}>
                <div className="auth-modal profile-panel-modal" onClick={(event) => event.stopPropagation()}>
                  {profilePanel === 'edit' && (
                    <>
                      <h3>Editar perfil</h3>
                      <p>Atualize suas informacoes principais e sincronize com o sistema.</p>
                      <label className="auth-field">
                        <small>Como deseja ser chamado</small>
                        <input
                          className="insp-input"
                          value={editProfileName}
                          onChange={(event) => setEditProfileName(event.target.value)}
                        />
                      </label>
                      <label className="auth-field">
                        <small>Renda mensal</small>
                        <input
                          className="insp-input"
                          value={editProfileIncome}
                          onChange={(event) => setEditProfileIncome(formatCurrencyTyping(event.target.value))}
                          placeholder="R$ 0,00"
                        />
                      </label>
                      <label className="auth-field">
                        <small>Meta mensal</small>
                        <input
                          className="insp-input"
                          value={editProfileTarget}
                          onChange={(event) => setEditProfileTarget(formatCurrencyTyping(event.target.value))}
                          placeholder="R$ 0,00"
                        />
                      </label>
                      <label className="auth-field">
                        <small>Objetivo atual</small>
                        <select className="insp-input" value={editProfileGoal} onChange={(event) => setEditProfileGoal(event.target.value)}>
                          {goalOptions.map((goal) => (
                            <option key={goal.id} value={goal.id}>
                              {goal.title}
                            </option>
                          ))}
                        </select>
                      </label>
                    </>
                  )}

                  {profilePanel === 'notifications' && (
                    <>
                      <h3>Notificacoes</h3>
                      <p>Defina quais alertas voce deseja receber no dia a dia.</p>
                      <div className="insp-trow">
                        <div className="insp-trtxt">
                          <strong>Alertas de gasto</strong>
                          <small>Avisa quando seus gastos fogem da meta.</small>
                        </div>
                        <button
                          className={`insp-tog ${panelNotifyLimit ? 'on' : ''}`}
                          onClick={() => setPanelNotifyLimit((value) => !value)}
                        />
                      </div>
                      <div className="insp-trow">
                        <div className="insp-trtxt">
                          <strong>Resumo semanal</strong>
                          <small>Receba visao geral toda semana.</small>
                        </div>
                        <button
                          className={`insp-tog ${panelWeeklySummary ? 'on' : ''}`}
                          onClick={() => setPanelWeeklySummary((value) => !value)}
                        />
                      </div>
                    </>
                  )}

                  {profilePanel === 'security' && (
                    <>
                      <h3>Seguranca</h3>
                      <p>Atualize sua senha para manter sua conta protegida.</p>
                      <label className="auth-field">
                        <small>Senha atual</small>
                        <input
                          type="password"
                          className="insp-input"
                          value={currentPasswordInput}
                          onChange={(event) => setCurrentPasswordInput(event.target.value)}
                        />
                      </label>
                      <label className="auth-field">
                        <small>Nova senha</small>
                        <input
                          type="password"
                          className="insp-input"
                          value={newPasswordInput}
                          onChange={(event) => setNewPasswordInput(event.target.value)}
                          placeholder="Minimo 6 caracteres"
                        />
                      </label>
                    </>
                  )}

                  {profilePanelError && <div className="auth-error">{profilePanelError}</div>}

                  <div className="auth-actions">
                    <button className="auth-btn ghost" onClick={closeProfilePanel} disabled={profileBusy}>
                      Cancelar
                    </button>
                    <button
                      className="auth-btn"
                      disabled={profileBusy}
                      onClick={
                        profilePanel === 'edit'
                          ? saveProfileEditPanel
                          : profilePanel === 'notifications'
                            ? saveNotificationPanel
                            : saveSecurityPanel
                      }
                    >
                      {profileBusy ? 'Salvando...' : 'Salvar'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}

export default App




