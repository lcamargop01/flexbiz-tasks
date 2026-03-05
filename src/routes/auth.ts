import { Hono } from 'hono'

type Bindings = { DB: D1Database }

export const authRoutes = new Hono<{ Bindings: Bindings }>()

// Simple token generation
function generateToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let token = ''
  for (let i = 0; i < 64; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return token
}

// Helper: get all client IDs this client can see (self + linked)
async function getLinkedClientIds(db: D1Database, clientId: number): Promise<number[]> {
  const ids = [clientId]
  const linked = await db.prepare(
    'SELECT linked_client_id FROM linked_clients WHERE primary_client_id = ?'
  ).bind(clientId).all()
  for (const row of linked.results) {
    ids.push(row.linked_client_id as number)
  }
  return ids
}

// Helper: get all companies info for a client (self + linked)
async function getLinkedCompanies(db: D1Database, clientId: number): Promise<any[]> {
  const linkedIds = await getLinkedClientIds(db, clientId)
  if (linkedIds.length <= 1) return []
  const placeholders = linkedIds.map(() => '?').join(',')
  const companies = await db.prepare(
    `SELECT id, company_name, contact_name, email FROM clients WHERE id IN (${placeholders})`
  ).bind(...linkedIds).all()
  return companies.results
}

// Employee login
authRoutes.post('/login', async (c) => {
  const { email, password } = await c.req.json()
  const user = await c.env.DB.prepare(
    'SELECT id, email, name, role, department, avatar_url FROM users WHERE email = ? AND password_hash = ? AND is_active = 1'
  ).bind(email, password).first()

  if (!user) {
    return c.json({ error: 'Invalid credentials' }, 401)
  }

  const token = generateToken()
  const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

  await c.env.DB.prepare(
    'INSERT INTO sessions (token, user_id, user_type, expires_at) VALUES (?, ?, ?, ?)'
  ).bind(token, user.id, 'user', expires).run()

  return c.json({ token, user })
})

// Client login
authRoutes.post('/client/login', async (c) => {
  const { email, password } = await c.req.json()
  const client = await c.env.DB.prepare(
    'SELECT id, company_name, contact_name, email, phone, logo_url FROM clients WHERE email = ? AND password_hash = ? AND is_active = 1 AND portal_access = 1'
  ).bind(email, password).first()

  if (!client) {
    return c.json({ error: 'Invalid credentials or portal access disabled' }, 401)
  }

  const token = generateToken()
  const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

  await c.env.DB.prepare(
    'INSERT INTO sessions (token, client_id, user_type, expires_at) VALUES (?, ?, ?, ?)'
  ).bind(token, client.id, 'client', expires).run()

  // Fetch linked companies
  const linkedCompanies = await getLinkedCompanies(c.env.DB, client.id as number)
  const allClientIds = await getLinkedClientIds(c.env.DB, client.id as number)

  return c.json({ token, client, linked_companies: linkedCompanies, all_client_ids: allClientIds })
})

// Verify session
authRoutes.get('/me', async (c) => {
  const authHeader = c.req.header('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const token = authHeader.slice(7)
  const session = await c.env.DB.prepare(
    'SELECT * FROM sessions WHERE token = ? AND expires_at > datetime("now")'
  ).bind(token).first()

  if (!session) {
    return c.json({ error: 'Session expired' }, 401)
  }

  if (session.user_type === 'user') {
    const user = await c.env.DB.prepare(
      'SELECT id, email, name, role, department, avatar_url, notification_prefs FROM users WHERE id = ?'
    ).bind(session.user_id).first()
    return c.json({ type: 'user', user })
  } else {
    const client = await c.env.DB.prepare(
      'SELECT id, company_name, contact_name, email, phone, logo_url FROM clients WHERE id = ?'
    ).bind(session.client_id).first()
    const linkedCompanies = await getLinkedCompanies(c.env.DB, session.client_id as number)
    const allClientIds = await getLinkedClientIds(c.env.DB, session.client_id as number)
    return c.json({ type: 'client', client, linked_companies: linkedCompanies, all_client_ids: allClientIds })
  }
})

// Logout
authRoutes.post('/logout', async (c) => {
  const authHeader = c.req.header('Authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7)
    await c.env.DB.prepare('DELETE FROM sessions WHERE token = ?').bind(token).run()
  }
  return c.json({ success: true })
})
