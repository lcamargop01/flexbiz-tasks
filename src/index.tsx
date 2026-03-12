import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { apiRoutes } from './routes/api'
import { authRoutes } from './routes/auth'
import { clientPortalRoutes } from './routes/client-portal'
import { calendarRoutes } from './routes/calendar'
import { renderDashboard } from './views/dashboard'
import { renderLogin } from './views/login'
import { renderClientPortal } from './views/client-portal'
import { renderClientLogin } from './views/client-login'

type Bindings = {
  DB: D1Database
}

const app = new Hono<{ Bindings: Bindings }>()

app.use('*', cors())

// Serve favicon
const FAVICON_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="20" fill="#6366f1"/><text x="50" y="68" font-size="50" fill="white" text-anchor="middle" font-family="Arial" font-weight="bold">F</text></svg>'
app.get('/favicon.svg', (c) => new Response(FAVICON_SVG, { headers: { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'public, max-age=86400' } }))
app.get('/favicon.ico', (c) => new Response(FAVICON_SVG, { headers: { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'public, max-age=86400' } }))

// Auth routes
app.route('/auth', authRoutes)

// API routes (protected)
app.route('/api', apiRoutes)

// Client portal routes
app.route('/client', clientPortalRoutes)

// Calendar feed (for Apple Reminders)
app.route('/cal', calendarRoutes)

// Public file download (no auth required, files are accessed by direct ID)
app.get('/files/:id', async (c) => {
  const id = parseInt(c.req.param('id'))
  try { await c.env.DB.prepare("SELECT file_data, storage_type FROM attachments LIMIT 0").all() } catch { return c.json({ error: 'Not available' }, 404) }
  const att = await c.env.DB.prepare(
    'SELECT filename, mime_type, file_data, storage_type FROM attachments WHERE id = ?'
  ).bind(id).first() as any
  if (!att) return c.json({ error: 'File not found' }, 404)

  function b64toBytes(b64: string): Uint8Array {
    const binary = atob(b64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    return bytes
  }

  let finalBytes: Uint8Array
  if (att.storage_type === 'chunked') {
    try { await c.env.DB.prepare("SELECT id FROM file_chunks LIMIT 0").all() } catch { return c.json({ error: 'Not available' }, 404) }
    const chunks = await c.env.DB.prepare(
      'SELECT data FROM file_chunks WHERE attachment_id = ? ORDER BY chunk_index ASC'
    ).bind(id).all()
    if (!chunks.results || chunks.results.length === 0) return c.json({ error: 'File data not found' }, 404)
    const decodedChunks: Uint8Array[] = chunks.results.map((ch: any) => b64toBytes(ch.data))
    const totalLen = decodedChunks.reduce((sum, c) => sum + c.length, 0)
    finalBytes = new Uint8Array(totalLen)
    let offset = 0
    for (const chunk of decodedChunks) { finalBytes.set(chunk, offset); offset += chunk.length }
  } else {
    if (!att.file_data) return c.json({ error: 'File not found' }, 404)
    finalBytes = b64toBytes(att.file_data)
  }

  return new Response(finalBytes.buffer, {
    headers: {
      'Content-Type': att.mime_type || 'application/octet-stream',
      'Content-Disposition': 'inline; filename="' + (att.filename || 'file') + '"',
      'Cache-Control': 'private, max-age=3600',
    },
  })
})

// Pages
app.get('/login', (c) => c.html(renderLogin()))
app.get('/client/login', (c) => c.html(renderClientLogin()))
app.get('/client/portal', (c) => c.html(renderClientPortal()))
app.get('/client/portal/*', (c) => c.html(renderClientPortal()))

// Main dashboard (catch-all for SPA)
app.get('/', (c) => c.html(renderDashboard()))
app.get('/tasks', (c) => c.html(renderDashboard()))
app.get('/tasks/*', (c) => c.html(renderDashboard()))
app.get('/projects', (c) => c.html(renderDashboard()))
app.get('/projects/*', (c) => c.html(renderDashboard()))
app.get('/clients', (c) => c.html(renderDashboard()))
app.get('/clients/*', (c) => c.html(renderDashboard()))
app.get('/processes', (c) => c.html(renderDashboard()))
app.get('/team', (c) => c.html(renderDashboard()))
app.get('/notifications', (c) => c.html(renderDashboard()))
app.get('/settings', (c) => c.html(renderDashboard()))
app.get('/gmail-setup', (c) => c.html(renderDashboard()))
app.get('/siri-setup', (c) => c.html(renderDashboard()))
app.get('/api-integration', (c) => c.html(renderDashboard()))

export default app
