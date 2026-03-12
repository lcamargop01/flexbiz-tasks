import { Hono } from 'hono'

type Bindings = { DB: D1Database }
type Variables = { userId: number; userRole: string; userType: string; entityId: number; clientIds: number[] }

export const apiRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// Auth middleware
apiRoutes.use('*', async (c, next) => {
  // Allow email quick-add with API key
  const apiKey = c.req.header('X-API-Key')
  if (apiKey) {
    const integration = await c.env.DB.prepare(
      'SELECT user_id FROM email_integrations WHERE api_key = ? AND is_active = 1'
    ).bind(apiKey).first()
    if (integration) {
      c.set('userId', integration.user_id as number)
      c.set('userRole', 'admin')
      c.set('userType', 'user')
      c.set('entityId', integration.user_id as number)
      c.set('clientIds', [])
      return next()
    }
  }

  const authHeader = c.req.header('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  const token = authHeader.slice(7)
  const session = await c.env.DB.prepare(
    'SELECT * FROM sessions WHERE token = ? AND expires_at > datetime("now")'
  ).bind(token).first()
  if (!session) return c.json({ error: 'Session expired' }, 401)

  if (session.user_type === 'user') {
    const user = await c.env.DB.prepare('SELECT id, role FROM users WHERE id = ?').bind(session.user_id).first()
    if (!user) return c.json({ error: 'User not found' }, 404)
    c.set('userId', user.id as number)
    c.set('userRole', user.role as string)
    c.set('userType', 'user')
    c.set('entityId', user.id as number)
    c.set('clientIds', [])
  } else {
    const clientId = session.client_id as number
    c.set('userId', clientId)
    c.set('userRole', 'client')
    c.set('userType', 'client')
    c.set('entityId', clientId)
    // Resolve linked client IDs (self + linked companies)
    const linked = await c.env.DB.prepare(
      'SELECT linked_client_id FROM linked_clients WHERE primary_client_id = ?'
    ).bind(clientId).all()
    const allIds = [clientId, ...linked.results.map((r: any) => r.linked_client_id as number)]
    c.set('clientIds', allIds)
  }
  return next()
})

// ==================== TASKS ====================

// List tasks with filters
apiRoutes.get('/tasks', async (c) => {
  const { status, priority, client_id, project_id, assigned_to, search, parent_task_id, page = '1', limit = '50', sort = 'due_date', hide_done } = c.req.query()
  let where: string[] = []
  let params: any[] = []

  // Clients can only see tasks for their companies (including linked) that are visible
  if (c.get('userType') === 'client') {
    const cIds = c.get('clientIds') || [c.get('entityId')]
    const ph = cIds.map(() => '?').join(',')
    where.push(`t.client_id IN (${ph})`)
    params.push(...cIds)
    where.push('t.is_visible_to_client = 1')
  }

  // Employees can only see tasks assigned to them, or unassigned tasks they created
  if (c.get('userRole') === 'employee') {
    where.push('(t.id IN (SELECT task_id FROM task_assignments WHERE user_id = ?) OR (t.created_by = ? AND t.id NOT IN (SELECT task_id FROM task_assignments)))')
    params.push(c.get('entityId'), c.get('entityId'))
  }

  if (hide_done === '1') { where.push('t.status NOT IN ("done","cancelled")') }
  if (status) { where.push('t.status = ?'); params.push(status) }
  if (priority) { where.push('t.priority = ?'); params.push(priority) }
  if (client_id) { where.push('t.client_id = ?'); params.push(parseInt(client_id)) }
  if (project_id) { where.push('t.project_id = ?'); params.push(parseInt(project_id)) }
  if (parent_task_id === 'null') { where.push('t.parent_task_id IS NULL') }
  else if (parent_task_id) { where.push('t.parent_task_id = ?'); params.push(parseInt(parent_task_id)) }
  if (search) { where.push('(t.title LIKE ? OR t.description LIKE ?)'); params.push(`%${search}%`, `%${search}%`) }
  if (assigned_to) {
    where.push('t.id IN (SELECT task_id FROM task_assignments WHERE user_id = ?)')
    params.push(parseInt(assigned_to))
  }

  const whereClause = where.length > 0 ? 'WHERE ' + where.join(' AND ') : ''
  const offset = (parseInt(page) - 1) * parseInt(limit)

  const countResult = await c.env.DB.prepare(
    `SELECT COUNT(*) as total FROM tasks t ${whereClause}`
  ).bind(...params).first()

  const tasks = await c.env.DB.prepare(`
    SELECT t.*, 
      p.name as project_name, p.color as project_color,
      cl.company_name as client_name, cl.color as client_color,
      (SELECT COUNT(*) FROM tasks st WHERE st.parent_task_id = t.id) as subtask_count,
      (SELECT COUNT(*) FROM tasks st WHERE st.parent_task_id = t.id AND st.status = 'done') as subtask_done_count,
      (SELECT COUNT(*) FROM comments cm WHERE cm.task_id = t.id) as comment_count,
      (SELECT COUNT(*) FROM attachments at WHERE at.task_id = t.id) as attachment_count,
      (SELECT MAX(st.due_date) FROM tasks st WHERE st.parent_task_id = t.id AND st.due_date IS NOT NULL) as subtask_last_due,
      (SELECT GROUP_CONCAT(DISTINCT u2.name) FROM tasks st2 JOIN task_assignments ta2 ON ta2.task_id = st2.id JOIN users u2 ON ta2.user_id = u2.id WHERE st2.parent_task_id = t.id AND ta2.role = 'assignee') as subtask_assignee_names,
      pt.title as parent_task_title
    FROM tasks t
    LEFT JOIN projects p ON t.project_id = p.id
    LEFT JOIN clients cl ON t.client_id = cl.id
    LEFT JOIN tasks pt ON t.parent_task_id = pt.id
    ${whereClause}
    ORDER BY
      ${sort === 'priority' ? "CASE t.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 END, t.due_date ASC NULLS LAST" : sort === 'status' ? "CASE t.status WHEN 'blocked' THEN 0 WHEN 'in_progress' THEN 1 WHEN 'review' THEN 2 WHEN 'todo' THEN 3 WHEN 'done' THEN 4 WHEN 'cancelled' THEN 5 END, t.due_date ASC NULLS LAST" : sort === 'created' ? 't.created_at DESC' : sort === 'title' ? 't.title ASC' : 't.due_date ASC NULLS LAST, t.created_at DESC'}
    LIMIT ? OFFSET ?
  `).bind(...params, parseInt(limit), offset).all()

  // Get assignments for each task
  const taskIds = tasks.results.map((t: any) => t.id)
  let assignments: any[] = []
  if (taskIds.length > 0) {
    const placeholders = taskIds.map(() => '?').join(',')
    const assignResult = await c.env.DB.prepare(`
      SELECT ta.*, u.name as user_name, u.email as user_email, u.avatar_url
      FROM task_assignments ta
      JOIN users u ON ta.user_id = u.id
      WHERE ta.task_id IN (${placeholders})
    `).bind(...taskIds).all()
    assignments = assignResult.results
  }

  const enrichedTasks = tasks.results.map((task: any) => ({
    ...task,
    tags: task.tags ? JSON.parse(task.tags) : [],
    assignments: assignments.filter((a: any) => a.task_id === task.id),
  }))

  return c.json({
    tasks: enrichedTasks,
    total: countResult?.total || 0,
    page: parseInt(page),
    limit: parseInt(limit),
  })
})

// Get single task with full details
apiRoutes.get('/tasks/:id', async (c) => {
  const id = parseInt(c.req.param('id'))

  const task = await c.env.DB.prepare(`
    SELECT t.*, 
      p.name as project_name, p.color as project_color,
      cl.company_name as client_name, cl.color as client_color,
      creator.name as created_by_name,
      pt.title as parent_task_title
    FROM tasks t
    LEFT JOIN projects p ON t.project_id = p.id
    LEFT JOIN clients cl ON t.client_id = cl.id
    LEFT JOIN users creator ON t.created_by = creator.id
    LEFT JOIN tasks pt ON t.parent_task_id = pt.id
    WHERE t.id = ?
  `).bind(id).first()

  if (!task) return c.json({ error: 'Task not found' }, 404)

  // Client access check (including linked companies)
  if (c.get('userType') === 'client') {
    const cIds = c.get('clientIds') || [c.get('entityId')]
    if (!cIds.includes(task.client_id as number) || !task.is_visible_to_client) {
      return c.json({ error: 'Access denied' }, 403)
    }
  }

  // Employee access check: must be assigned to or have created the task
  if (c.get('userRole') === 'employee') {
    const isAssigned = await c.env.DB.prepare(
      'SELECT 1 FROM task_assignments WHERE task_id = ? AND user_id = ?'
    ).bind(id, c.get('entityId')).first()
    if (!isAssigned && task.created_by !== c.get('entityId')) {
      return c.json({ error: 'Access denied' }, 403)
    }
  }

  const [assignments, comments, attachments, subtasks, activity] = await Promise.all([
    c.env.DB.prepare(`
      SELECT ta.*, u.name as user_name, u.email as user_email, u.avatar_url
      FROM task_assignments ta JOIN users u ON ta.user_id = u.id
      WHERE ta.task_id = ?
    `).bind(id).all(),
    c.env.DB.prepare(`
      SELECT c.*, 
        CASE WHEN c.author_type = 'user' THEN u.name WHEN c.author_type = 'client' THEN cl.contact_name ELSE 'System' END as author_name,
        CASE WHEN c.author_type = 'user' THEN u.avatar_url ELSE cl.logo_url END as author_avatar
      FROM comments c
      LEFT JOIN users u ON c.author_type = 'user' AND c.author_id = u.id
      LEFT JOIN clients cl ON c.author_type = 'client' AND c.author_id = cl.id
      WHERE c.task_id = ? ${c.get('userType') === 'client' ? 'AND c.is_internal = 0' : ''}
      ORDER BY c.created_at ASC
    `).bind(id).all(),
    c.env.DB.prepare('SELECT * FROM attachments WHERE task_id = ? ORDER BY created_at DESC').bind(id).all(),
    c.env.DB.prepare(`
      SELECT t.*, 
        (SELECT GROUP_CONCAT(u.name) FROM task_assignments ta JOIN users u ON ta.user_id = u.id WHERE ta.task_id = t.id AND ta.role = 'assignee') as assignee_names
      FROM tasks t WHERE t.parent_task_id = ? ORDER BY t.sort_order, t.created_at
    `).bind(id).all(),
    c.env.DB.prepare('SELECT * FROM activity_log WHERE task_id = ? ORDER BY created_at DESC LIMIT 50').bind(id).all(),
  ])

  return c.json({
    ...task,
    tags: task.tags ? JSON.parse(task.tags) : [],
    assignments: assignments.results,
    comments: comments.results,
    attachments: attachments.results,
    subtasks: subtasks.results.map((s: any) => ({ ...s, tags: s.tags ? JSON.parse(s.tags) : [] })),
    activity: activity.results.map((a: any) => ({ ...a, details: a.details ? JSON.parse(a.details) : {} })),
  })
})

// Create task
apiRoutes.post('/tasks', async (c) => {
  const body = await c.req.json()
  const { title, description, status = 'todo', priority = 'medium', project_id, client_id, due_date, start_date,
    estimated_hours, tags, parent_task_id, is_visible_to_client = 1, assignees = [], process_id,
    is_recurring = 0, recurrence_rule = null } = body

  // If client is creating task, force client_id
  const effectiveClientId = c.get('userType') === 'client' ? c.get('entityId') : client_id
  const createdByType = c.get('userType') === 'client' ? 'client' : 'user'

  const result = await c.env.DB.prepare(`
    INSERT INTO tasks (title, description, status, priority, project_id, client_id, due_date, start_date,
      estimated_hours, tags, parent_task_id, is_visible_to_client, process_id, created_by, created_by_type,
      is_recurring, recurrence_rule)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    title, description || null, status, priority, project_id || null, effectiveClientId || null,
    due_date || null, start_date || null, estimated_hours || null,
    tags ? JSON.stringify(tags) : null, parent_task_id || null, is_visible_to_client,
    process_id || null, c.get('entityId'), createdByType,
    is_recurring ? 1 : 0, recurrence_rule ? JSON.stringify(recurrence_rule) : null
  ).run()

  const taskId = result.meta.last_row_id

  // Assign employees
  if (assignees.length > 0 && c.get('userType') === 'user') {
    for (const assignee of assignees) {
      await c.env.DB.prepare(
        'INSERT OR IGNORE INTO task_assignments (task_id, user_id, role, assigned_by) VALUES (?, ?, ?, ?)'
      ).bind(taskId, assignee.user_id, assignee.role || 'assignee', c.get('entityId')).run()

      // Create notification
      await c.env.DB.prepare(
        'INSERT INTO notifications (recipient_id, recipient_type, type, title, message, task_id) VALUES (?, ?, ?, ?, ?, ?)'
      ).bind(assignee.user_id, 'user', 'task_assigned', 'New task assigned', `You've been assigned to "${title}"`, taskId).run()
    }
  }

  // Activity log
  await c.env.DB.prepare(
    'INSERT INTO activity_log (task_id, actor_id, actor_type, action, details) VALUES (?, ?, ?, ?, ?)'
  ).bind(taskId, c.get('entityId'), createdByType, 'created', JSON.stringify({ title })).run()

  return c.json({ id: taskId, title }, 201)
})

// Bulk create tasks from pasted text (bulleted list)
apiRoutes.post('/tasks/bulk', async (c) => {
  const body = await c.req.json()
  const { text, client_id, project_id } = body

  if (!text || typeof text !== 'string' || !text.trim()) {
    return c.json({ error: 'Please paste a list of tasks' }, 400)
  }

  // Determine client_id: client users get their own ID (or selected company), admin can specify
  let effectiveClientId = c.get('userType') === 'client' ? c.get('entityId') : (client_id || null)
  // For client users who pick a specific company from their linked list
  if (c.get('userType') === 'client' && client_id) {
    const cIds = c.get('clientIds') || [c.get('entityId')]
    if (cIds.includes(parseInt(client_id))) {
      effectiveClientId = parseInt(client_id)
    }
  }

  const createdByType = c.get('userType') === 'client' ? 'client' : 'user'

  // Parse the bulleted list
  // Supports: "• Task", "- Task", "* Task", "1. Task", "1) Task", plain "Task"
  // If a line starts with spaces/tab after a bullet line, treat it as the description of the previous task
  const lines = text.split(/\n/)
  const tasks: { title: string; description: string }[] = []

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]
    // Skip completely empty lines
    if (!raw.trim()) continue

    // Check if this line is indented (description of previous task)
    const isIndented = /^[\t]/.test(raw) || /^[ ]{4,}/.test(raw)
    if (isIndented && tasks.length > 0) {
      // Append as description to the previous task
      const desc = raw.trim()
      if (desc) {
        tasks[tasks.length - 1].description += (tasks[tasks.length - 1].description ? '\n' : '') + desc
      }
      continue
    }

    // Strip common bullet prefixes
    let title = raw.trim()
      .replace(/^[\u2022\u2023\u25E6\u2043\u2219\u25AA\u25AB\u25CF\u25CB\u2013\u2014]\s*/, '') // unicode bullets
      .replace(/^[-*+]\s+/, '')           // - * +
      .replace(/^\d+[.)]\s+/, '')         // 1. or 1)
      .replace(/^[a-zA-Z][.)]\s+/, '')    // a. or a)
      .replace(/^\[[ x]?\]\s*/i, '')      // [ ] or [x] checkboxes
      .trim()

    if (!title) continue

    // Check if next line looks like a description (indented or starting with description-like pattern)
    let description = ''
    if (i + 1 < lines.length) {
      const nextRaw = lines[i + 1]
      const nextIsIndented = /^[\t]/.test(nextRaw) || /^[ ]{4,}/.test(nextRaw)
      if (nextIsIndented && nextRaw.trim()) {
        description = nextRaw.trim()
        i++ // skip description line
        // Keep consuming consecutive indented lines
        while (i + 1 < lines.length && (/^[\t]/.test(lines[i + 1]) || /^[ ]{4,}/.test(lines[i + 1])) && lines[i + 1].trim()) {
          description += '\n' + lines[i + 1].trim()
          i++
        }
      }
    }

    tasks.push({ title, description })
  }

  if (tasks.length === 0) {
    return c.json({ error: 'No tasks found in the text. Try pasting a list like:\\n- Task one\\n- Task two' }, 400)
  }

  if (tasks.length > 50) {
    return c.json({ error: 'Maximum 50 tasks at a time. You pasted ' + tasks.length + ' tasks.' }, 400)
  }

  // Insert all tasks
  const created: { id: number; title: string }[] = []
  for (const task of tasks) {
    const result = await c.env.DB.prepare(`
      INSERT INTO tasks (title, description, status, priority, project_id, client_id,
        is_visible_to_client, created_by, created_by_type)
      VALUES (?, ?, 'todo', 'medium', ?, ?, 1, ?, ?)
    `).bind(
      task.title, task.description || null, project_id || null, effectiveClientId,
      c.get('entityId'), createdByType
    ).run()

    const taskId = result.meta.last_row_id
    created.push({ id: taskId as number, title: task.title })

    // Activity log
    await c.env.DB.prepare(
      'INSERT INTO activity_log (task_id, actor_id, actor_type, action, details) VALUES (?, ?, ?, ?, ?)'
    ).bind(taskId, c.get('entityId'), createdByType, 'created', JSON.stringify({ title: task.title, source: 'bulk_paste' })).run()
  }

  return c.json({ created, count: created.length }, 201)
})

// Update task
apiRoutes.put('/tasks/:id', async (c) => {
  const id = parseInt(c.req.param('id'))
  const body = await c.req.json()

  const task = await c.env.DB.prepare('SELECT * FROM tasks WHERE id = ?').bind(id).first()
  if (!task) return c.json({ error: 'Task not found' }, 404)

  // Client can only update their own tasks (including linked companies)
  if (c.get('userType') === 'client') {
    const cIds = c.get('clientIds') || [c.get('entityId')]
    if (!cIds.includes(task.client_id as number)) {
      return c.json({ error: 'Access denied' }, 403)
    }
  }

  const fields: string[] = []
  const values: any[] = []
  const changes: any = {}

  const updatable = ['title', 'description', 'status', 'priority', 'project_id', 'client_id',
    'due_date', 'start_date', 'estimated_hours', 'actual_hours', 'tags', 'is_visible_to_client',
    'sort_order', 'is_recurring', 'recurrence_rule']

  // Clients can only update certain fields
  const clientUpdatable = ['title', 'description', 'status', 'priority', 'due_date']

  for (const key of (c.get('userType') === 'client' ? clientUpdatable : updatable)) {
    if (body[key] !== undefined) {
      fields.push(`${key} = ?`)
      const value = key === 'tags' ? JSON.stringify(body[key]) :
        key === 'recurrence_rule' ? JSON.stringify(body[key]) : body[key]
      values.push(value)
      changes[key] = { from: (task as any)[key], to: body[key] }
    }
  }

  if (body.status === 'done' && task.status !== 'done') {
    fields.push('completed_at = datetime("now")')
  }

  // Auto-generate next occurrence for recurring tasks when marked done
  let nextTaskId: number | null = null
  if (body.status === 'done' && task.status !== 'done' && task.is_recurring && task.recurrence_rule) {
    try {
      const rule = typeof task.recurrence_rule === 'string' ? JSON.parse(task.recurrence_rule) : task.recurrence_rule
      // rule: { frequency: 'daily'|'weekly'|'biweekly'|'monthly'|'quarterly'|'yearly', endDate?: string }
      const now = new Date()
      const baseDue = task.due_date ? new Date(task.due_date) : now
      let nextDue = new Date(baseDue)

      switch (rule.frequency) {
        case 'daily': nextDue.setDate(nextDue.getDate() + 1); break
        case 'weekly': nextDue.setDate(nextDue.getDate() + 7); break
        case 'biweekly': nextDue.setDate(nextDue.getDate() + 14); break
        case 'monthly': nextDue.setMonth(nextDue.getMonth() + 1); break
        case 'quarterly': nextDue.setMonth(nextDue.getMonth() + 3); break
        case 'yearly': nextDue.setFullYear(nextDue.getFullYear() + 1); break
        default: nextDue.setDate(nextDue.getDate() + 7); break
      }

      // Check if next due is past the end date
      const shouldCreate = !rule.endDate || nextDue <= new Date(rule.endDate)

      if (shouldCreate) {
        const nextDueStr = nextDue.toISOString().slice(0, 16)
        const newTask = await c.env.DB.prepare(`
          INSERT INTO tasks (title, description, status, priority, project_id, client_id, due_date,
            estimated_hours, tags, is_visible_to_client, process_id, created_by, created_by_type,
            is_recurring, recurrence_rule)
          VALUES (?, ?, 'todo', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
        `).bind(
          task.title, task.description || null, task.priority,
          task.project_id, task.client_id, nextDueStr,
          task.estimated_hours, task.tags, task.is_visible_to_client,
          task.process_id, c.get('entityId'),
          c.get('userType') === 'client' ? 'client' : 'user',
          task.recurrence_rule
        ).run()
        nextTaskId = newTask.meta.last_row_id as number

        // Copy assignees to the new task
        const assigneeRows = await c.env.DB.prepare(
          'SELECT user_id, role FROM task_assignments WHERE task_id = ?'
        ).bind(id).all()
        for (const a of assigneeRows.results) {
          await c.env.DB.prepare(
            'INSERT OR IGNORE INTO task_assignments (task_id, user_id, role, assigned_by) VALUES (?, ?, ?, ?)'
          ).bind(nextTaskId, (a as any).user_id, (a as any).role, c.get('entityId')).run()
        }

        // Activity log for auto-generated task
        await c.env.DB.prepare(
          'INSERT INTO activity_log (task_id, actor_id, actor_type, action, details) VALUES (?, ?, ?, ?, ?)'
        ).bind(nextTaskId, c.get('entityId'), c.get('userType') === 'client' ? 'client' : 'user',
          'created', JSON.stringify({ title: task.title, recurring_from: id })).run()
      }
    } catch (e) {
      // Don't fail the status update if recurring generation fails
      console.error('Failed to generate next recurring task:', e)
    }
  }

  fields.push('updated_at = datetime("now")')

  if (fields.length > 1) {
    await c.env.DB.prepare(`UPDATE tasks SET ${fields.join(', ')} WHERE id = ?`).bind(...values, id).run()
  }

  // Handle assignee changes
  if (body.assignees && c.get('userType') === 'user') {
    await c.env.DB.prepare('DELETE FROM task_assignments WHERE task_id = ?').bind(id).run()
    for (const assignee of body.assignees) {
      await c.env.DB.prepare(
        'INSERT OR IGNORE INTO task_assignments (task_id, user_id, role, assigned_by) VALUES (?, ?, ?, ?)'
      ).bind(id, assignee.user_id, assignee.role || 'assignee', c.get('entityId')).run()
    }
  }

  // Notify on status change
  if (body.status && body.status !== task.status) {
    const assignees = await c.env.DB.prepare(
      'SELECT user_id FROM task_assignments WHERE task_id = ?'
    ).bind(id).all()
    for (const a of assignees.results) {
      if (a.user_id !== c.get('entityId')) {
        await c.env.DB.prepare(
          'INSERT INTO notifications (recipient_id, recipient_type, type, title, message, task_id) VALUES (?, ?, ?, ?, ?, ?)'
        ).bind(a.user_id, 'user', 'status_changed', 'Task status updated',
          `"${task.title}" changed from ${task.status} to ${body.status}`, id).run()
      }
    }
  }

  // Activity log
  const actorType = c.get('userType') === 'client' ? 'client' : 'user'
  await c.env.DB.prepare(
    'INSERT INTO activity_log (task_id, actor_id, actor_type, action, details) VALUES (?, ?, ?, ?, ?)'
  ).bind(id, c.get('entityId'), actorType, 'updated', JSON.stringify(changes)).run()

  return c.json({ success: true, nextRecurringTaskId: nextTaskId })
})

// Delete task
apiRoutes.delete('/tasks/:id', async (c) => {
  const id = parseInt(c.req.param('id'))
  if (c.get('userType') === 'client') return c.json({ error: 'Clients cannot delete tasks' }, 403)
  // Delete subtasks first (they reference parent_task_id)
  await c.env.DB.prepare('DELETE FROM tasks WHERE parent_task_id = ?').bind(id).run()
  // Clean up related data
  await c.env.DB.prepare('DELETE FROM task_assignments WHERE task_id = ?').bind(id).run()
  await c.env.DB.prepare('DELETE FROM comments WHERE task_id = ?').bind(id).run()
  await c.env.DB.prepare('DELETE FROM attachments WHERE task_id = ?').bind(id).run()
  await c.env.DB.prepare('DELETE FROM activity_log WHERE task_id = ?').bind(id).run()
  await c.env.DB.prepare('DELETE FROM notifications WHERE task_id = ?').bind(id).run()
  await c.env.DB.prepare('DELETE FROM tasks WHERE id = ?').bind(id).run()
  return c.json({ success: true })
})

// Bulk update tasks
apiRoutes.post('/tasks/bulk', async (c) => {
  if (c.get('userType') === 'client') return c.json({ error: 'Access denied' }, 403)
  const { task_ids, updates } = await c.req.json()

  for (const id of task_ids) {
    const fields: string[] = []
    const values: any[] = []
    for (const [key, value] of Object.entries(updates)) {
      fields.push(`${key} = ?`)
      values.push(value)
    }
    fields.push('updated_at = datetime("now")')
    await c.env.DB.prepare(`UPDATE tasks SET ${fields.join(', ')} WHERE id = ?`).bind(...values, id).run()
  }

  return c.json({ success: true, updated: task_ids.length })
})

// Siri quick-add — accepts dictated text, creates a task
apiRoutes.post('/tasks/siri-add', async (c) => {
  const body = await c.req.json()
  let { text, priority, project_id, client_id } = body
  if (!text || !text.trim()) return c.json({ error: 'No task text provided' }, 400)
  text = text.trim()

  // Smart parsing: detect priority keywords
  let detectedPriority = priority || 'medium'
  const lowerText = text.toLowerCase()
  if (!priority) {
    if (lowerText.includes('urgent') || lowerText.includes('asap') || lowerText.includes('emergency')) detectedPriority = 'urgent'
    else if (lowerText.includes('high priority') || lowerText.includes('important')) detectedPriority = 'high'
    else if (lowerText.includes('low priority') || lowerText.includes('whenever') || lowerText.includes('not urgent')) detectedPriority = 'low'
  }

  // Smart parsing: detect client name from text (fuzzy match against known clients)
  let detectedClientId = client_id || null
  if (!client_id) {
    const clients = await c.env.DB.prepare('SELECT id, company_name FROM clients').all()
    for (const cl of (clients.results || []) as any[]) {
      if (lowerText.includes(cl.company_name.toLowerCase())) {
        detectedClientId = cl.id
        break
      }
    }
  }

  // Clean up the title — remove priority keywords for a cleaner task name
  let title = text
    .replace(/\b(urgent|asap|emergency|high priority|important|low priority|not urgent|whenever)\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
  // Capitalize first letter
  if (title.length > 0) title = title.charAt(0).toUpperCase() + title.slice(1)

  const result = await c.env.DB.prepare(`
    INSERT INTO tasks (title, status, priority, client_id, project_id, created_by, created_by_type)
    VALUES (?, 'todo', ?, ?, ?, ?, 'api')
  `).bind(
    title || text,
    detectedPriority,
    detectedClientId,
    project_id || null,
    c.get('entityId')
  ).run()

  // Log activity
  await c.env.DB.prepare(
    `INSERT INTO activity_log (task_id, actor_id, actor_type, action, details) VALUES (?, ?, 'user', 'created', ?)`
  ).bind(result.meta.last_row_id, c.get('entityId'), JSON.stringify({ source: 'siri', original_text: text })).run()

  return c.json({
    id: result.meta.last_row_id,
    title: title || text,
    priority: detectedPriority,
    client_id: detectedClientId,
    message: 'Task created: ' + (title || text)
  }, 201)
})

// Email quick-add
apiRoutes.post('/tasks/email-add', async (c) => {
  const body = await c.req.json()
  const { subject, body: emailBody, from, client_id, project_id } = body

  const result = await c.env.DB.prepare(`
    INSERT INTO tasks (title, description, status, priority, client_id, project_id, created_by, created_by_type)
    VALUES (?, ?, 'todo', 'medium', ?, ?, ?, 'email')
  `).bind(
    subject || 'Task from email',
    `From: ${from || 'unknown'}\n\n${emailBody || ''}`,
    client_id || null,
    project_id || null,
    c.get('entityId')
  ).run()

  return c.json({ id: result.meta.last_row_id, title: subject }, 201)
})

// ==================== EXTERNAL API INTEGRATION ====================

// General-purpose task creation for external applications
apiRoutes.post('/tasks/api-add', async (c) => {
  const body = await c.req.json()
  const {
    title,
    description,
    status = 'todo',
    priority = 'medium',
    due_date,
    start_date,
    client_id,
    project_id,
    tags,
    assignees,       // array of user IDs or [{user_id, role}]
    estimated_hours,
    is_recurring,
    recurrence_rule,
  } = body

  if (!title || !title.trim()) {
    return c.json({ error: 'Title is required' }, 400)
  }

  const validStatuses = ['todo', 'in_progress', 'review', 'blocked', 'done', 'cancelled']
  const validPriorities = ['urgent', 'high', 'medium', 'low']
  if (!validStatuses.includes(status)) return c.json({ error: `Invalid status. Use: ${validStatuses.join(', ')}` }, 400)
  if (!validPriorities.includes(priority)) return c.json({ error: `Invalid priority. Use: ${validPriorities.join(', ')}` }, 400)

  const tagsJson = tags ? (Array.isArray(tags) ? JSON.stringify(tags) : JSON.stringify(tags.split(',').map((t: string) => t.trim()).filter(Boolean))) : null
  const recurrenceJson = recurrence_rule ? (typeof recurrence_rule === 'string' ? recurrence_rule : JSON.stringify(recurrence_rule)) : null

  const result = await c.env.DB.prepare(`
    INSERT INTO tasks (title, description, status, priority, due_date, start_date, client_id, project_id, tags, estimated_hours, is_recurring, recurrence_rule, created_by, created_by_type)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'api')
  `).bind(
    title.trim(),
    description || null,
    status,
    priority,
    due_date || null,
    start_date || null,
    client_id || null,
    project_id || null,
    tagsJson,
    estimated_hours || null,
    is_recurring ? 1 : 0,
    recurrenceJson,
    c.get('entityId')
  ).run()

  const taskId = result.meta.last_row_id

  // Handle assignees - accept array of IDs or array of {user_id, role}
  const assigneeList = assignees || []
  for (const a of assigneeList) {
    const userId = typeof a === 'number' ? a : (a.user_id || a.id)
    const role = (typeof a === 'object' && a.role) ? a.role : 'assignee'
    if (userId) {
      await c.env.DB.prepare(
        'INSERT INTO task_assignments (task_id, user_id, role, assigned_by) VALUES (?, ?, ?, ?)'
      ).bind(taskId, userId, role, c.get('entityId')).run()
    }
  }

  // Log activity
  await c.env.DB.prepare(
    'INSERT INTO activity_log (task_id, actor_id, actor_type, action, details) VALUES (?, ?, ?, ?, ?)'
  ).bind(taskId, c.get('entityId'), 'system', 'created', JSON.stringify({ source: 'external_api', title: title.trim() })).run()

  // Fetch created task to return full details
  const task = await c.env.DB.prepare(`
    SELECT t.id, t.title, t.status, t.priority, t.due_date, t.start_date, t.client_id, t.project_id, t.tags, t.estimated_hours, t.is_recurring, t.created_at,
      p.name as project_name, cl.company_name as client_name,
      (SELECT GROUP_CONCAT(u.name) FROM task_assignments ta JOIN users u ON ta.user_id = u.id WHERE ta.task_id = t.id AND ta.role = 'assignee') as assignee_names
    FROM tasks t
    LEFT JOIN projects p ON t.project_id = p.id
    LEFT JOIN clients cl ON t.client_id = cl.id
    WHERE t.id = ?
  `).bind(taskId).first()

  return c.json({
    success: true,
    task: {
      ...task,
      tags: task?.tags ? JSON.parse(task.tags as string) : [],
    }
  }, 201)
})

// List projects (for API consumers to discover IDs)
apiRoutes.get('/integration/projects', async (c) => {
  const projects = await c.env.DB.prepare('SELECT id, name, status, color FROM projects ORDER BY name').all()
  return c.json({ projects: projects.results })
})

// List clients (for API consumers to discover IDs)
apiRoutes.get('/integration/clients', async (c) => {
  const clients = await c.env.DB.prepare('SELECT id, company_name, contact_name FROM clients ORDER BY company_name').all()
  return c.json({ clients: clients.results })
})

// List users (for API consumers to discover assignee IDs)
apiRoutes.get('/integration/users', async (c) => {
  const users = await c.env.DB.prepare('SELECT id, name, email, role, department FROM users WHERE is_active = 1 ORDER BY name').all()
  return c.json({ users: users.results })
})

// ==================== COMMENTS ====================

apiRoutes.post('/tasks/:id/comments', async (c) => {
  const taskId = parseInt(c.req.param('id'))
  const { content, is_internal = 0, parent_comment_id } = await c.req.json()
  const authorType = c.get('userType') === 'client' ? 'client' : 'user'

  const result = await c.env.DB.prepare(
    'INSERT INTO comments (task_id, author_id, author_type, content, is_internal, parent_comment_id) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(taskId, c.get('entityId'), authorType, content, authorType === 'client' ? 0 : is_internal, parent_comment_id || null).run()

  // Notify task assignees about new comment
  const task = await c.env.DB.prepare('SELECT title, client_id FROM tasks WHERE id = ?').bind(taskId).first()
  const assignees = await c.env.DB.prepare(
    'SELECT user_id FROM task_assignments WHERE task_id = ?'
  ).bind(taskId).all()

  for (const a of assignees.results) {
    if (a.user_id !== c.get('entityId') || authorType !== 'user') {
      await c.env.DB.prepare(
        'INSERT INTO notifications (recipient_id, recipient_type, type, title, message, task_id) VALUES (?, ?, ?, ?, ?, ?)'
      ).bind(a.user_id, 'user', 'comment_added', 'New comment', `New comment on "${task?.title}"`, taskId).run()
    }
  }

  // Notify client if internal user comments on their task
  if (authorType === 'user' && !is_internal && task?.client_id) {
    await c.env.DB.prepare(
      'INSERT INTO notifications (recipient_id, recipient_type, type, title, message, task_id) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(task.client_id, 'client', 'comment_added', 'New comment', `New comment on "${task.title}"`, taskId).run()
  }

  await c.env.DB.prepare(
    'INSERT INTO activity_log (task_id, actor_id, actor_type, action, details) VALUES (?, ?, ?, ?, ?)'
  ).bind(taskId, c.get('entityId'), authorType, 'commented', JSON.stringify({ content: content.substring(0, 100) })).run()

  return c.json({ id: result.meta.last_row_id }, 201)
})

// ==================== PROJECTS ====================

apiRoutes.get('/projects', async (c) => {
  const { client_id, status } = c.req.query()
  let where: string[] = []
  let params: any[] = []

  if (c.get('userType') === 'client') {
    const cIds = c.get('clientIds') || [c.get('entityId')]
    const ph = cIds.map(() => '?').join(',')
    where.push(`p.client_id IN (${ph})`)
    params.push(...cIds)
  }

  // Employees only see projects that have tasks assigned to them
  if (c.get('userRole') === 'employee') {
    where.push('p.id IN (SELECT DISTINCT t.project_id FROM tasks t JOIN task_assignments ta ON ta.task_id = t.id WHERE ta.user_id = ? AND t.project_id IS NOT NULL UNION SELECT DISTINCT t2.project_id FROM tasks t2 WHERE t2.created_by = ? AND t2.project_id IS NOT NULL)')
    params.push(c.get('entityId'), c.get('entityId'))
  }

  if (client_id) { where.push('p.client_id = ?'); params.push(parseInt(client_id)) }
  if (status) { where.push('p.status = ?'); params.push(status) }

  const whereClause = where.length > 0 ? 'WHERE ' + where.join(' AND ') : ''

  const projects = await c.env.DB.prepare(`
    SELECT p.*, cl.company_name as client_name, cl.color as client_color,
      (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id) as task_count,
      (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id AND t.status = 'done') as done_count
    FROM projects p
    LEFT JOIN clients cl ON p.client_id = cl.id
    ${whereClause}
    ORDER BY p.created_at DESC
  `).bind(...params).all()

  return c.json({ projects: projects.results })
})

apiRoutes.post('/projects', async (c) => {
  if (c.get('userType') === 'client') return c.json({ error: 'Access denied' }, 403)
  const { name, description, client_id, color, start_date, end_date } = await c.req.json()

  const result = await c.env.DB.prepare(
    'INSERT INTO projects (name, description, client_id, color, start_date, end_date, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).bind(name, description || null, client_id || null, color || '#6366f1', start_date || null, end_date || null, c.get('entityId')).run()

  return c.json({ id: result.meta.last_row_id }, 201)
})

apiRoutes.put('/projects/:id', async (c) => {
  if (c.get('userType') === 'client') return c.json({ error: 'Access denied' }, 403)
  const id = parseInt(c.req.param('id'))
  const body = await c.req.json()

  const fields: string[] = []
  const values: any[] = []
  for (const key of ['name', 'description', 'client_id', 'status', 'color', 'start_date', 'end_date']) {
    if (body[key] !== undefined) {
      fields.push(`${key} = ?`)
      values.push(body[key])
    }
  }
  fields.push('updated_at = datetime("now")')

  await c.env.DB.prepare(`UPDATE projects SET ${fields.join(', ')} WHERE id = ?`).bind(...values, id).run()
  return c.json({ success: true })
})

apiRoutes.delete('/projects/:id', async (c) => {
  if (c.get('userType') === 'client') return c.json({ error: 'Access denied' }, 403)
  const id = parseInt(c.req.param('id'))
  // Unlink tasks from this project
  await c.env.DB.prepare('UPDATE tasks SET project_id = NULL WHERE project_id = ?').bind(id).run()
  await c.env.DB.prepare('DELETE FROM projects WHERE id = ?').bind(id).run()
  return c.json({ success: true })
})

// ==================== CLIENTS ====================

apiRoutes.get('/clients', async (c) => {
  if (c.get('userType') === 'client' || c.get('userRole') === 'employee') return c.json({ error: 'Access denied' }, 403)

  const clients = await c.env.DB.prepare(`
    SELECT c.*,
      (SELECT COUNT(*) FROM projects p WHERE p.client_id = c.id) as project_count,
      (SELECT COUNT(*) FROM tasks t WHERE t.client_id = c.id) as task_count,
      (SELECT COUNT(*) FROM tasks t WHERE t.client_id = c.id AND t.status NOT IN ('done','cancelled')) as open_task_count
    FROM clients c ORDER BY c.company_name
  `).all()

  return c.json({ clients: clients.results })
})

apiRoutes.post('/clients', async (c) => {
  if (c.get('userType') === 'client') return c.json({ error: 'Access denied' }, 403)
  const { company_name, contact_name, email, phone, address, color, password, notes } = await c.req.json()

  const result = await c.env.DB.prepare(
    'INSERT INTO clients (company_name, contact_name, email, phone, address, color, password_hash, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(company_name, contact_name, email, phone || null, address || null, color || '#6366f1', password || 'changeme123', notes || null).run()

  return c.json({ id: result.meta.last_row_id }, 201)
})

apiRoutes.put('/clients/:id', async (c) => {
  if (c.get('userType') === 'client') return c.json({ error: 'Access denied' }, 403)
  const id = parseInt(c.req.param('id'))
  const body = await c.req.json()

  const fields: string[] = []
  const values: any[] = []
  for (const key of ['company_name', 'contact_name', 'email', 'phone', 'address', 'color', 'notes', 'portal_access', 'is_active']) {
    if (body[key] !== undefined) { fields.push(`${key} = ?`); values.push(body[key]) }
  }
  if (body.password) { fields.push('password_hash = ?'); values.push(body.password) }
  fields.push('updated_at = datetime("now")')

  await c.env.DB.prepare(`UPDATE clients SET ${fields.join(', ')} WHERE id = ?`).bind(...values, id).run()
  return c.json({ success: true })
})

apiRoutes.delete('/clients/:id', async (c) => {
  if (c.get('userRole') !== 'admin') return c.json({ error: 'Admin only' }, 403)
  const id = parseInt(c.req.param('id'))
  // Remove client references from tasks and projects
  await c.env.DB.prepare('UPDATE tasks SET client_id = NULL WHERE client_id = ?').bind(id).run()
  await c.env.DB.prepare('UPDATE projects SET client_id = NULL WHERE client_id = ?').bind(id).run()
  // Clean up sessions, notifications, and linked_clients
  await c.env.DB.prepare('DELETE FROM sessions WHERE client_id = ?').bind(id).run()
  await c.env.DB.prepare('DELETE FROM notifications WHERE recipient_id = ? AND recipient_type = ?').bind(id, 'client').run()
  await c.env.DB.prepare('DELETE FROM linked_clients WHERE primary_client_id = ? OR linked_client_id = ?').bind(id, id).run()
  await c.env.DB.prepare('DELETE FROM clients WHERE id = ?').bind(id).run()
  return c.json({ success: true })
})

// ==================== LINKED CLIENTS (Multi-Company) ====================

// Get linked companies for a client
apiRoutes.get('/clients/:id/linked', async (c) => {
  if (c.get('userRole') !== 'admin' && c.get('userType') !== 'client') return c.json({ error: 'Access denied' }, 403)
  const id = parseInt(c.req.param('id'))
  const linked = await c.env.DB.prepare(`
    SELECT lc.id as link_id, lc.linked_client_id, c.company_name, c.contact_name, c.email
    FROM linked_clients lc
    JOIN clients c ON lc.linked_client_id = c.id
    WHERE lc.primary_client_id = ?
    ORDER BY c.company_name
  `).bind(id).all()
  return c.json({ linked: linked.results })
})

// Link a company to a client login
apiRoutes.post('/clients/:id/linked', async (c) => {
  if (c.get('userRole') !== 'admin') return c.json({ error: 'Admin only' }, 403)
  const primaryId = parseInt(c.req.param('id'))
  const { linked_client_id } = await c.req.json()
  if (primaryId === linked_client_id) return c.json({ error: 'Cannot link a client to itself' }, 400)
  try {
    await c.env.DB.prepare(
      'INSERT INTO linked_clients (primary_client_id, linked_client_id) VALUES (?, ?)'
    ).bind(primaryId, linked_client_id).run()
    return c.json({ success: true }, 201)
  } catch (e) {
    return c.json({ error: 'Link already exists' }, 409)
  }
})

// Remove a linked company
apiRoutes.delete('/clients/:id/linked/:linkId', async (c) => {
  if (c.get('userRole') !== 'admin') return c.json({ error: 'Admin only' }, 403)
  const linkId = parseInt(c.req.param('linkId'))
  await c.env.DB.prepare('DELETE FROM linked_clients WHERE id = ?').bind(linkId).run()
  return c.json({ success: true })
})

// ==================== USERS / TEAM ====================

apiRoutes.get('/users', async (c) => {
  // Employees can only see users for task assignment purposes (limited fields)
  if (c.get('userType') === 'client') return c.json({ error: 'Access denied' }, 403)
  if (c.get('userRole') === 'employee') {
    const users = await c.env.DB.prepare('SELECT id, name, avatar_url FROM users WHERE is_active = 1 ORDER BY name').all()
    return c.json({ users: users.results })
  }

  const users = await c.env.DB.prepare(`
    SELECT u.id, u.email, u.name, u.role, u.department, u.avatar_url, u.phone, u.is_active,
      (SELECT COUNT(*) FROM task_assignments ta WHERE ta.user_id = u.id) as assigned_tasks,
      (SELECT COUNT(*) FROM task_assignments ta JOIN tasks t ON ta.task_id = t.id WHERE ta.user_id = u.id AND t.status NOT IN ('done','cancelled')) as open_tasks
    FROM users u ORDER BY u.name
  `).all()

  return c.json({ users: users.results })
})

apiRoutes.post('/users', async (c) => {
  if (c.get('userRole') !== 'admin') return c.json({ error: 'Admin only' }, 403)
  const { email, name, role = 'employee', department, phone, password } = await c.req.json()

  const result = await c.env.DB.prepare(
    'INSERT INTO users (email, name, role, department, phone, password_hash) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(email, name, role, department || null, phone || null, password || 'changeme123').run()

  return c.json({ id: result.meta.last_row_id }, 201)
})

apiRoutes.put('/users/:id', async (c) => {
  if (c.get('userRole') !== 'admin' && c.get('entityId') !== parseInt(c.req.param('id'))) {
    return c.json({ error: 'Access denied' }, 403)
  }
  const id = parseInt(c.req.param('id'))
  const body = await c.req.json()

  const fields: string[] = []
  const values: any[] = []
  for (const key of ['name', 'email', 'role', 'department', 'phone', 'is_active', 'notification_prefs']) {
    if (body[key] !== undefined) { fields.push(`${key} = ?`); values.push(typeof body[key] === 'object' ? JSON.stringify(body[key]) : body[key]) }
  }
  if (body.password) { fields.push('password_hash = ?'); values.push(body.password) }
  fields.push('updated_at = datetime("now")')

  await c.env.DB.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`).bind(...values, id).run()
  return c.json({ success: true })
})

apiRoutes.delete('/users/:id', async (c) => {
  if (c.get('userRole') !== 'admin') return c.json({ error: 'Admin only' }, 403)
  const id = parseInt(c.req.param('id'))
  // Don't allow deleting yourself
  if (id === c.get('entityId')) return c.json({ error: 'Cannot delete your own account' }, 400)
  // Clean up all references to this user
  await c.env.DB.prepare('DELETE FROM task_assignments WHERE user_id = ?').bind(id).run()
  await c.env.DB.prepare('DELETE FROM task_assignments WHERE assigned_by = ?').bind(id).run()
  await c.env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(id).run()
  await c.env.DB.prepare('DELETE FROM email_integrations WHERE user_id = ?').bind(id).run()
  await c.env.DB.prepare('DELETE FROM notifications WHERE recipient_id = ? AND recipient_type = ?').bind(id, 'user').run()
  // Nullify created_by references
  await c.env.DB.prepare('UPDATE tasks SET created_by = NULL WHERE created_by = ? AND created_by_type = ?').bind(id, 'user').run()
  await c.env.DB.prepare('UPDATE projects SET created_by = NULL WHERE created_by = ?').bind(id).run()
  await c.env.DB.prepare('UPDATE processes SET created_by = NULL WHERE created_by = ?').bind(id).run()
  await c.env.DB.prepare('DELETE FROM users WHERE id = ?').bind(id).run()
  return c.json({ success: true })
})

// ==================== PROCESSES ====================

apiRoutes.get('/processes', async (c) => {
  if (c.get('userType') === 'client' || c.get('userRole') === 'employee') return c.json({ error: 'Access denied' }, 403)
  const processes = await c.env.DB.prepare(`
    SELECT p.*, u.name as created_by_name FROM processes p LEFT JOIN users u ON p.created_by = u.id ORDER BY p.name
  `).all()
  return c.json({
    processes: processes.results.map((p: any) => ({ ...p, steps: p.steps ? JSON.parse(p.steps) : [] }))
  })
})

apiRoutes.post('/processes', async (c) => {
  if (c.get('userType') === 'client' || c.get('userRole') === 'employee') return c.json({ error: 'Access denied' }, 403)
  const { name, description, steps } = await c.req.json()
  const result = await c.env.DB.prepare(
    'INSERT INTO processes (name, description, steps, created_by) VALUES (?, ?, ?, ?)'
  ).bind(name, description || null, JSON.stringify(steps || []), c.get('entityId')).run()
  return c.json({ id: result.meta.last_row_id }, 201)
})

apiRoutes.put('/processes/:id', async (c) => {
  if (c.get('userType') === 'client' || c.get('userRole') === 'employee') return c.json({ error: 'Access denied' }, 403)
  const id = parseInt(c.req.param('id'))
  const { name, description, steps } = await c.req.json()
  await c.env.DB.prepare(
    'UPDATE processes SET name = ?, description = ?, steps = ? WHERE id = ?'
  ).bind(name, description || null, JSON.stringify(steps || []), id).run()
  return c.json({ success: true })
})

apiRoutes.delete('/processes/:id', async (c) => {
  if (c.get('userType') === 'client' || c.get('userRole') === 'employee') return c.json({ error: 'Access denied' }, 403)
  const id = parseInt(c.req.param('id'))
  // Unlink tasks from this process
  await c.env.DB.prepare('UPDATE tasks SET process_id = NULL WHERE process_id = ?').bind(id).run()
  await c.env.DB.prepare('DELETE FROM processes WHERE id = ?').bind(id).run()
  return c.json({ success: true })
})

// Apply process template - creates tasks from process steps
apiRoutes.post('/processes/:id/apply', async (c) => {
  if (c.get('userType') === 'client' || c.get('userRole') === 'employee') return c.json({ error: 'Access denied' }, 403)
  const processId = parseInt(c.req.param('id'))
  const { project_id, client_id, base_due_date } = await c.req.json()

  const process = await c.env.DB.prepare('SELECT * FROM processes WHERE id = ?').bind(processId).first()
  if (!process) return c.json({ error: 'Process not found' }, 404)

  const steps = JSON.parse(process.steps as string || '[]')
  const createdTasks: any[] = []

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i]
    const dueDate = base_due_date ? new Date(new Date(base_due_date).getTime() + (i + 1) * 3 * 24 * 60 * 60 * 1000).toISOString() : null

    const result = await c.env.DB.prepare(`
      INSERT INTO tasks (title, description, status, priority, project_id, client_id, process_id, process_step, due_date, created_by, sort_order)
      VALUES (?, ?, 'todo', 'medium', ?, ?, ?, ?, ?, ?, ?)
    `).bind(step.title, step.description || null, project_id || null, client_id || null, processId, step.step, dueDate, c.get('entityId'), i).run()

    createdTasks.push({ id: result.meta.last_row_id, title: step.title })
  }

  return c.json({ tasks: createdTasks }, 201)
})

// ==================== NOTIFICATIONS ====================

apiRoutes.get('/notifications', async (c) => {
  const recipientType = c.get('userType') === 'client' ? 'client' : 'user'
  const notifications = await c.env.DB.prepare(`
    SELECT n.*, t.title as task_title
    FROM notifications n
    LEFT JOIN tasks t ON n.task_id = t.id
    WHERE n.recipient_id = ? AND n.recipient_type = ?
    ORDER BY n.created_at DESC LIMIT 50
  `).bind(c.get('entityId'), recipientType).all()

  const unreadCount = await c.env.DB.prepare(
    'SELECT COUNT(*) as count FROM notifications WHERE recipient_id = ? AND recipient_type = ? AND is_read = 0'
  ).bind(c.get('entityId'), recipientType).first()

  return c.json({ notifications: notifications.results, unread_count: unreadCount?.count || 0 })
})

apiRoutes.put('/notifications/read', async (c) => {
  const { ids } = await c.req.json()
  const recipientType = c.get('userType') === 'client' ? 'client' : 'user'

  if (ids && ids.length > 0) {
    const placeholders = ids.map(() => '?').join(',')
    await c.env.DB.prepare(
      `UPDATE notifications SET is_read = 1 WHERE id IN (${placeholders}) AND recipient_id = ? AND recipient_type = ?`
    ).bind(...ids, c.get('entityId'), recipientType).run()
  } else {
    await c.env.DB.prepare(
      'UPDATE notifications SET is_read = 1 WHERE recipient_id = ? AND recipient_type = ?'
    ).bind(c.get('entityId'), recipientType).run()
  }

  return c.json({ success: true })
})

// ==================== GMAIL INTEGRATION ====================

apiRoutes.get('/email-integration', async (c) => {
  if (c.get('userRole') === 'employee') return c.json({ error: 'Access denied' }, 403)
  if (c.get('userType') === 'client') return c.json({ error: 'Access denied' }, 403)

  const integration = await c.env.DB.prepare(
    'SELECT id, api_key, is_active, created_at FROM email_integrations WHERE user_id = ?'
  ).bind(c.get('entityId')).first()

  return c.json({ integration })
})

apiRoutes.post('/email-integration/generate-key', async (c) => {
  if (c.get('userRole') === 'employee') return c.json({ error: 'Access denied' }, 403)
  if (c.get('userType') === 'client') return c.json({ error: 'Access denied' }, 403)

  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let apiKey = 'fbk_'
  for (let i = 0; i < 32; i++) apiKey += chars.charAt(Math.floor(Math.random() * chars.length))

  // Delete existing and create new
  await c.env.DB.prepare('DELETE FROM email_integrations WHERE user_id = ?').bind(c.get('entityId')).run()
  await c.env.DB.prepare(
    'INSERT INTO email_integrations (user_id, api_key) VALUES (?, ?)'
  ).bind(c.get('entityId'), apiKey).run()

  return c.json({ api_key: apiKey })
})

// ==================== DASHBOARD STATS ====================

apiRoutes.get('/dashboard', async (c) => {
  if (c.get('userType') === 'client') {
    const cIds = c.get('clientIds') || [c.get('entityId')]
    const ph = cIds.map(() => '?').join(',')
    const [tasksByStatus, tasksByPriority, recentTasks, overdueTasks, dueSoonTasks, openTasks] = await Promise.all([
      c.env.DB.prepare(`SELECT status, COUNT(*) as count FROM tasks WHERE client_id IN (${ph}) AND is_visible_to_client = 1 GROUP BY status`).bind(...cIds).all(),
      c.env.DB.prepare(`SELECT priority, COUNT(*) as count FROM tasks WHERE client_id IN (${ph}) AND is_visible_to_client = 1 AND status NOT IN ("done","cancelled") GROUP BY priority`).bind(...cIds).all(),
      c.env.DB.prepare(`SELECT t.id, t.title, t.status, t.priority, t.due_date, cl.company_name as client_name, p.name as project_name FROM tasks t LEFT JOIN clients cl ON t.client_id = cl.id LEFT JOIN projects p ON t.project_id = p.id WHERE t.client_id IN (${ph}) AND t.is_visible_to_client = 1 ORDER BY t.updated_at DESC LIMIT 10`).bind(...cIds).all(),
      c.env.DB.prepare(`SELECT COUNT(*) as count FROM tasks WHERE client_id IN (${ph}) AND is_visible_to_client = 1 AND due_date < datetime("now") AND status NOT IN ("done","cancelled")`).bind(...cIds).first(),
      c.env.DB.prepare(`SELECT COUNT(*) as count FROM tasks WHERE client_id IN (${ph}) AND is_visible_to_client = 1 AND due_date BETWEEN datetime("now") AND datetime("now", "+3 days") AND status NOT IN ("done","cancelled")`).bind(...cIds).first(),
      c.env.DB.prepare(`SELECT t.id, t.title, t.status, t.priority, t.due_date, cl.company_name as client_name, p.name as project_name FROM tasks t LEFT JOIN clients cl ON t.client_id = cl.id LEFT JOIN projects p ON t.project_id = p.id WHERE t.client_id IN (${ph}) AND t.is_visible_to_client = 1 AND t.parent_task_id IS NULL AND t.status NOT IN ('done','cancelled') ORDER BY t.due_date ASC NULLS LAST LIMIT 20`).bind(...cIds).all(),
    ])
    return c.json({ tasksByStatus: tasksByStatus.results, tasksByPriority: tasksByPriority.results, recentTasks: recentTasks.results, overdueTasks: overdueTasks?.count || 0, dueSoonTasks: dueSoonTasks?.count || 0, openTasks: openTasks.results })
  }

  const isEmployee = c.get('userRole') === 'employee'
  const uid = c.get('entityId')
  // Dashboard: ALL users see only tasks assigned to them, OR unassigned tasks they created
  // If a task has assignees, only those assignees see it — the creator does NOT unless also assigned
  const myFilter = ' AND (id IN (SELECT task_id FROM task_assignments WHERE user_id = ' + uid + ') OR (created_by = ' + uid + ' AND id NOT IN (SELECT task_id FROM task_assignments)))'
  const myFilterAlias = ' AND (t.id IN (SELECT task_id FROM task_assignments WHERE user_id = ' + uid + ') OR (t.created_by = ' + uid + ' AND t.id NOT IN (SELECT task_id FROM task_assignments)))'

  // Optional client filter for admin/manager dashboard
  const clientFilter = c.req.query('client_id')
  const clientWhere = clientFilter ? ' AND client_id = ' + parseInt(clientFilter) : ''
  const clientWhereAlias = clientFilter ? ' AND t.client_id = ' + parseInt(clientFilter) : ''

  const [tasksByStatus, tasksByPriority, overdueTasks, dueSoonTasks, myTasks, recentActivity] = await Promise.all([
    c.env.DB.prepare('SELECT status, COUNT(*) as count FROM tasks WHERE parent_task_id IS NULL' + myFilter + clientWhere + ' GROUP BY status').all(),
    c.env.DB.prepare('SELECT priority, COUNT(*) as count FROM tasks WHERE status NOT IN ("done","cancelled") AND parent_task_id IS NULL' + myFilter + clientWhere + ' GROUP BY priority').all(),
    c.env.DB.prepare('SELECT COUNT(*) as count FROM tasks WHERE due_date < datetime("now") AND status NOT IN ("done","cancelled")' + myFilter + clientWhere).first(),
    c.env.DB.prepare('SELECT COUNT(*) as count FROM tasks WHERE due_date BETWEEN datetime("now") AND datetime("now", "+3 days") AND status NOT IN ("done","cancelled")' + myFilter + clientWhere).first(),
    c.env.DB.prepare(`
      SELECT t.id, t.title, t.status, t.priority, t.due_date, t.parent_task_id, t.is_recurring, t.recurrence_rule,
        p.name as project_name, cl.company_name as client_name,
        (SELECT GROUP_CONCAT(u.name) FROM task_assignments ta JOIN users u ON ta.user_id = u.id WHERE ta.task_id = t.id AND ta.role = 'assignee') as assignee_names,
        pt.title as parent_task_title
      FROM tasks t
      LEFT JOIN projects p ON t.project_id = p.id
      LEFT JOIN clients cl ON t.client_id = cl.id
      LEFT JOIN tasks pt ON t.parent_task_id = pt.id
      WHERE t.status NOT IN ('done','cancelled') ${myFilterAlias} ${clientWhereAlias}
      ORDER BY t.due_date ASC NULLS LAST LIMIT 30
    `).all(),
    // Activity: all users see only activity on their assigned/created tasks
    c.env.DB.prepare(`
      SELECT al.*, t.title as task_title,
        CASE WHEN al.actor_type = 'user' THEN u.name WHEN al.actor_type = 'client' THEN cl.contact_name ELSE 'System' END as actor_name
      FROM activity_log al
      LEFT JOIN tasks t ON al.task_id = t.id
      LEFT JOIN users u ON al.actor_type = 'user' AND al.actor_id = u.id
      LEFT JOIN clients cl ON al.actor_type = 'client' AND al.actor_id = cl.id
      WHERE al.task_id IN (SELECT task_id FROM task_assignments WHERE user_id = ?) OR al.task_id IN (SELECT id FROM tasks WHERE created_by = ? AND id NOT IN (SELECT task_id FROM task_assignments))
      ORDER BY al.created_at DESC LIMIT 20
    `).bind(uid, uid).all(),
  ])

  return c.json({
    tasksByStatus: tasksByStatus.results,
    tasksByPriority: tasksByPriority.results,
    overdueTasks: overdueTasks?.count || 0,
    dueSoonTasks: dueSoonTasks?.count || 0,
    myTasks: myTasks.results,
    recentActivity: recentActivity.results.map((a: any) => ({ ...a, details: a.details ? JSON.parse(a.details) : {} })),
  })
})

// Calendar / Agenda view — returns tasks for a date range, scoped to assigned user
apiRoutes.get('/dashboard/calendar', async (c) => {
  const { start, end } = c.req.query()
  if (!start || !end) return c.json({ error: 'start and end dates required' }, 400)
  
  const uid = c.get('entityId')
  const isClient = c.get('userType') === 'client'
  const clientFilter = c.req.query('client_id')
  const clientExtra = clientFilter ? ' AND t.client_id = ' + parseInt(clientFilter) : ''
  
  let whereClause: string
  let params: any[]

  if (isClient) {
    const cIds = c.get('clientIds') || [uid]
    const ph = cIds.map(() => '?').join(',')
    whereClause = `t.client_id IN (${ph}) AND t.is_visible_to_client = 1 AND t.due_date IS NOT NULL AND t.due_date BETWEEN ? AND ?`
    params = [...cIds, start, end]
  } else {
    // ALL users (even admin) see only their assigned tasks, or unassigned tasks they created
    whereClause = `(t.id IN (SELECT task_id FROM task_assignments WHERE user_id = ?) OR (t.created_by = ? AND t.id NOT IN (SELECT task_id FROM task_assignments))) AND t.due_date IS NOT NULL AND t.due_date BETWEEN ? AND ?${clientExtra}`
    params = [uid, uid, start, end]
  }

  const tasks = await c.env.DB.prepare(`
    SELECT t.id, t.title, t.status, t.priority, t.due_date, t.client_id,
      t.is_recurring, t.recurrence_rule, t.parent_task_id,
      p.name as project_name, p.color as project_color,
      cl.company_name as client_name,
      (SELECT GROUP_CONCAT(u.name) FROM task_assignments ta JOIN users u ON ta.user_id = u.id WHERE ta.task_id = t.id AND ta.role = 'assignee') as assignee_names,
      pt.title as parent_task_title
    FROM tasks t
    LEFT JOIN projects p ON t.project_id = p.id
    LEFT JOIN clients cl ON t.client_id = cl.id
    LEFT JOIN tasks pt ON t.parent_task_id = pt.id
    WHERE ${whereClause}
    ORDER BY t.due_date ASC, CASE t.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 END
  `).bind(...params).all()

  // Also fetch tasks with no due date (for agenda "unscheduled" section)
  let noDateWhere: string
  let noDateParams: any[]
  if (isClient) {
    const cIds = c.get('clientIds') || [uid]
    const ph = cIds.map(() => '?').join(',')
    noDateWhere = `t.client_id IN (${ph}) AND t.is_visible_to_client = 1 AND t.due_date IS NULL AND t.status NOT IN ('done','cancelled')`
    noDateParams = [...cIds]
  } else {
    noDateWhere = `(t.id IN (SELECT task_id FROM task_assignments WHERE user_id = ?) OR (t.created_by = ? AND t.id NOT IN (SELECT task_id FROM task_assignments))) AND t.due_date IS NULL AND t.status NOT IN ('done','cancelled')${clientExtra}`
    noDateParams = [uid, uid]
  }

  const unscheduled = await c.env.DB.prepare(`
    SELECT t.id, t.title, t.status, t.priority, t.due_date, t.client_id,
      t.is_recurring, t.recurrence_rule, t.parent_task_id,
      p.name as project_name, p.color as project_color,
      cl.company_name as client_name,
      (SELECT GROUP_CONCAT(u.name) FROM task_assignments ta JOIN users u ON ta.user_id = u.id WHERE ta.task_id = t.id AND ta.role = 'assignee') as assignee_names,
      pt.title as parent_task_title
    FROM tasks t
    LEFT JOIN projects p ON t.project_id = p.id
    LEFT JOIN clients cl ON t.client_id = cl.id
    LEFT JOIN tasks pt ON t.parent_task_id = pt.id
    WHERE ${noDateWhere}
    ORDER BY CASE t.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 END
    LIMIT 30
  `).bind(...noDateParams).all()

  return c.json({ tasks: tasks.results, unscheduled: unscheduled.results })
})

// ==================== ATTACHMENTS ====================

// Ensure schema is ready for file storage
async function ensureFileSchema(db: D1Database) {
  // Ensure file_data column exists on attachments
  try { await db.prepare("SELECT file_data FROM attachments LIMIT 0").all() } catch {
    await db.prepare("ALTER TABLE attachments ADD COLUMN file_data TEXT").run()
  }
  // Ensure storage_type column exists
  try { await db.prepare("SELECT storage_type FROM attachments LIMIT 0").all() } catch {
    await db.prepare("ALTER TABLE attachments ADD COLUMN storage_type TEXT DEFAULT 'inline'").run()
  }
  // Ensure file_chunks table exists
  try { await db.prepare("SELECT id FROM file_chunks LIMIT 0").all() } catch {
    await db.prepare(`CREATE TABLE IF NOT EXISTS file_chunks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      attachment_id INTEGER NOT NULL,
      chunk_index INTEGER NOT NULL,
      data TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (attachment_id) REFERENCES attachments(id) ON DELETE CASCADE
    )`).run()
    await db.prepare("CREATE INDEX IF NOT EXISTS idx_file_chunks_attachment ON file_chunks(attachment_id, chunk_index)").run()
  }
}

// Max chunk size: ~750KB of base64 data per row (well under D1's 1MB row limit)
const CHUNK_SIZE_BYTES = 560000  // raw bytes -> ~750KB base64

// Upload attachment
apiRoutes.post('/tasks/:id/attachments', async (c) => {
  const taskId = parseInt(c.req.param('id'))
  const contentType = c.req.header('Content-Type') || ''

  // Handle file upload (multipart/form-data)
  if (contentType.includes('multipart/form-data')) {
    await ensureFileSchema(c.env.DB)
    const formData = await c.req.formData()
    const file = formData.get('file') as File | null
    if (!file || !(file instanceof File)) {
      return c.json({ error: 'No file provided' }, 400)
    }

    // Limit to 10MB (safe for D1 chunked storage)
    if (file.size > 10 * 1024 * 1024) {
      return c.json({ error: 'File too large. Maximum 10MB.' }, 400)
    }

    const uploaderType = c.get('userType') === 'client' ? 'client' : 'user'
    const arrayBuf = await file.arrayBuffer()
    const bytes = new Uint8Array(arrayBuf)

    // Convert to base64 in chunks to avoid memory issues
    function uint8ToBase64(u8: Uint8Array): string {
      let binary = ''
      const chunkLen = 8192
      for (let i = 0; i < u8.length; i += chunkLen) {
        const slice = u8.subarray(i, Math.min(i + chunkLen, u8.length))
        for (let j = 0; j < slice.length; j++) {
          binary += String.fromCharCode(slice[j])
        }
      }
      return btoa(binary)
    }

    try {
      // Insert attachment record first (without file_data)
      const result = await c.env.DB.prepare(
        'INSERT INTO attachments (task_id, filename, file_url, file_size, mime_type, uploaded_by, uploaded_by_type, storage_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      ).bind(
        taskId, file.name, 'pending',
        file.size, file.type || 'application/octet-stream',
        c.get('entityId'), uploaderType, 'chunked'
      ).run()

      const attachId = result.meta.last_row_id

      // Split file into chunks and store each
      let chunkIndex = 0
      for (let offset = 0; offset < bytes.length; offset += CHUNK_SIZE_BYTES) {
        const chunkBytes = bytes.subarray(offset, Math.min(offset + CHUNK_SIZE_BYTES, bytes.length))
        const chunkBase64 = uint8ToBase64(chunkBytes)
        await c.env.DB.prepare(
          'INSERT INTO file_chunks (attachment_id, chunk_index, data) VALUES (?, ?, ?)'
        ).bind(attachId, chunkIndex, chunkBase64).run()
        chunkIndex++
      }

      // Update file_url with download path
      const downloadUrl = '/api/attachments/' + attachId + '/download'
      await c.env.DB.prepare('UPDATE attachments SET file_url = ? WHERE id = ?')
        .bind(downloadUrl, attachId).run()

      return c.json({ id: attachId, filename: file.name, file_url: downloadUrl }, 201)
    } catch (err: any) {
      // Clean up partial upload
      return c.json({ error: 'Upload failed: ' + (err.message || 'Unknown error') }, 500)
    }
  }

  // Fallback: JSON body with URL reference
  const { filename, file_url, file_size, mime_type } = await c.req.json()
  const uploaderType = c.get('userType') === 'client' ? 'client' : 'user'

  const result = await c.env.DB.prepare(
    'INSERT INTO attachments (task_id, filename, file_url, file_size, mime_type, uploaded_by, uploaded_by_type) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).bind(taskId, filename, file_url, file_size || null, mime_type || null, c.get('entityId'), uploaderType).run()

  return c.json({ id: result.meta.last_row_id }, 201)
})

// Download attachment file (reassemble from chunks)
apiRoutes.get('/attachments/:id/download', async (c) => {
  const id = parseInt(c.req.param('id'))
  await ensureFileSchema(c.env.DB)

  const att = await c.env.DB.prepare(
    'SELECT filename, mime_type, file_data, storage_type, file_size FROM attachments WHERE id = ?'
  ).bind(id).first() as any

  if (!att) return c.json({ error: 'Attachment not found' }, 404)

  // Helper: decode base64 to Uint8Array
  function b64toBytes(b64: string): Uint8Array {
    const binary = atob(b64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i)
    }
    return bytes
  }

  let finalBytes: Uint8Array

  if (att.storage_type === 'chunked') {
    // Decode each chunk separately to avoid memory limits on large base64 strings
    const chunks = await c.env.DB.prepare(
      'SELECT data FROM file_chunks WHERE attachment_id = ? ORDER BY chunk_index ASC'
    ).bind(id).all()

    if (!chunks.results || chunks.results.length === 0) {
      return c.json({ error: 'File data not found' }, 404)
    }

    // Decode each chunk into a Uint8Array
    const decodedChunks: Uint8Array[] = chunks.results.map((ch: any) => b64toBytes(ch.data))

    // Calculate total length and merge
    const totalLen = decodedChunks.reduce((sum, c) => sum + c.length, 0)
    finalBytes = new Uint8Array(totalLen)
    let offset = 0
    for (const chunk of decodedChunks) {
      finalBytes.set(chunk, offset)
      offset += chunk.length
    }
  } else {
    // Legacy inline storage
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

// Delete attachment (chunks auto-deleted via CASCADE or manual cleanup)
apiRoutes.delete('/attachments/:id', async (c) => {
  const id = parseInt(c.req.param('id'))
  // Delete chunks first (in case CASCADE isn't set up)
  await c.env.DB.prepare('DELETE FROM file_chunks WHERE attachment_id = ?').bind(id).run()
  await c.env.DB.prepare('DELETE FROM attachments WHERE id = ?').bind(id).run()
  return c.json({ success: true })
})
