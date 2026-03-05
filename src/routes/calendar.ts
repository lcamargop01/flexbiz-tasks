import { Hono } from 'hono'

type Bindings = { DB: D1Database }

export const calendarRoutes = new Hono<{ Bindings: Bindings }>()

// ICS Calendar feed for Apple Reminders integration
// Subscribe to this URL in Apple Reminders/Calendar to get task due dates
calendarRoutes.get('/feed/:token', async (c) => {
  const token = c.req.param('token')

  // Validate token
  const session = await c.env.DB.prepare(
    'SELECT * FROM sessions WHERE token = ? AND expires_at > datetime("now")'
  ).bind(token).first()

  if (!session) {
    return c.text('Invalid or expired token', 401)
  }

  let tasks: any
  if (session.user_type === 'user') {
    tasks = await c.env.DB.prepare(`
      SELECT t.id, t.title, t.description, t.status, t.priority, t.due_date, t.created_at,
        p.name as project_name, cl.company_name as client_name
      FROM tasks t
      LEFT JOIN projects p ON t.project_id = p.id
      LEFT JOIN clients cl ON t.client_id = cl.id
      WHERE t.id IN (SELECT task_id FROM task_assignments WHERE user_id = ?)
        AND t.status NOT IN ('done', 'cancelled')
        AND t.due_date IS NOT NULL
      ORDER BY t.due_date ASC
    `).bind(session.user_id).all()
  } else {
    tasks = await c.env.DB.prepare(`
      SELECT t.id, t.title, t.description, t.status, t.priority, t.due_date, t.created_at,
        p.name as project_name
      FROM tasks t
      LEFT JOIN projects p ON t.project_id = p.id
      WHERE t.client_id = ? AND t.is_visible_to_client = 1
        AND t.status NOT IN ('done', 'cancelled')
        AND t.due_date IS NOT NULL
      ORDER BY t.due_date ASC
    `).bind(session.client_id).all()
  }

  // Generate ICS calendar
  const now = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  let ics = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//FlexBiz Solutions//Task Manager//EN
CALSCALE:GREGORIAN
METHOD:PUBLISH
X-WR-CALNAME:FlexBiz Tasks
X-WR-TIMEZONE:UTC
`

  for (const task of (tasks.results || [])) {
    const dueDate = new Date(task.due_date as string)
    const dtStart = dueDate.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
    const dtEnd = new Date(dueDate.getTime() + 3600000).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
    const created = new Date(task.created_at as string).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')

    const priority = task.priority === 'urgent' ? '1' : task.priority === 'high' ? '3' : task.priority === 'medium' ? '5' : '9'
    const projectInfo = task.project_name ? ` [${task.project_name}]` : ''
    const clientInfo = task.client_name ? ` - ${task.client_name}` : ''
    const description = (task.description || '').replace(/\n/g, '\\n').replace(/,/g, '\\,')

    ics += `BEGIN:VEVENT
UID:flexbiz-task-${task.id}@flexbiz.com
DTSTAMP:${now}
DTSTART:${dtStart}
DTEND:${dtEnd}
CREATED:${created}
SUMMARY:${task.title}${projectInfo}${clientInfo}
DESCRIPTION:${description}\\nStatus: ${task.status}\\nPriority: ${task.priority}
PRIORITY:${priority}
STATUS:${task.status === 'in_progress' ? 'IN-PROCESS' : 'NEEDS-ACTION'}
BEGIN:VALARM
TRIGGER:-PT60M
ACTION:DISPLAY
DESCRIPTION:Task due: ${task.title}
END:VALARM
BEGIN:VALARM
TRIGGER:-PT1440M
ACTION:DISPLAY
DESCRIPTION:Task due tomorrow: ${task.title}
END:VALARM
END:VEVENT
`
  }

  ics += 'END:VCALENDAR'

  return new Response(ics, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'attachment; filename="flexbiz-tasks.ics"',
    },
  })
})

// Generate a persistent calendar token for a user
calendarRoutes.get('/generate-token', async (c) => {
  const authHeader = c.req.header('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const token = authHeader.slice(7)
  const session = await c.env.DB.prepare(
    'SELECT * FROM sessions WHERE token = ? AND expires_at > datetime("now")'
  ).bind(token).first()

  if (!session) return c.json({ error: 'Session expired' }, 401)

  // Create a long-lived calendar token (1 year)
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let calToken = 'cal_'
  for (let i = 0; i < 32; i++) calToken += chars.charAt(Math.floor(Math.random() * chars.length))

  const expires = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()

  if (session.user_type === 'user') {
    await c.env.DB.prepare(
      'INSERT INTO sessions (token, user_id, user_type, expires_at) VALUES (?, ?, ?, ?)'
    ).bind(calToken, session.user_id, 'user', expires).run()
  } else {
    await c.env.DB.prepare(
      'INSERT INTO sessions (token, client_id, user_type, expires_at) VALUES (?, ?, ?, ?)'
    ).bind(calToken, session.client_id, 'client', expires).run()
  }

  return c.json({ calendar_token: calToken })
})
