import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || ''
if (JWT_SECRET.length < 16) {
  throw new Error('JWT_SECRET ausente ou fraco. Defina um segredo com pelo menos 16 caracteres.')
}

export const AUTH_COOKIE_NAME = 'cashtrack_session'
// COOKIE_SECURE=true apenas quando o site rodar com HTTPS
const COOKIE_SECURE = process.env.COOKIE_SECURE === 'true'

export function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' })
}

export function setAuthCookie(res, token) {
  res.cookie(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: COOKIE_SECURE,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  })
}

export function clearAuthCookie(res) {
  res.clearCookie(AUTH_COOKIE_NAME, {
    httpOnly: true,
    secure: COOKIE_SECURE,
    sameSite: 'lax',
    path: '/',
  })
}

export function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || ''
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  const cookieToken = req.cookies?.[AUTH_COOKIE_NAME] || ''
  const token = bearerToken || cookieToken

  if (!token) {
    return res.status(401).json({ message: 'Nao autenticado' })
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET)
    req.user = decoded
    return next()
  } catch {
    return res.status(401).json({ message: 'Token invalido' })
  }
}
