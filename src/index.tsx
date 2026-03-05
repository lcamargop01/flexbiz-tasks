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

export default app
