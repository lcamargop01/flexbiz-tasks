-- FlexBiz Solutions LLC - Task Management Platform
-- Initial Database Schema

-- Organization settings
CREATE TABLE IF NOT EXISTS org_settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  name TEXT NOT NULL DEFAULT 'FlexBiz Solutions LLC',
  logo_url TEXT,
  primary_color TEXT DEFAULT '#6366f1',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO org_settings (name) VALUES ('FlexBiz Solutions LLC');

-- Users (employees + admins)
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'employee' CHECK(role IN ('admin','manager','employee')),
  avatar_url TEXT,
  phone TEXT,
  department TEXT,
  password_hash TEXT NOT NULL,
  is_active INTEGER DEFAULT 1,
  notification_prefs TEXT DEFAULT '{"email":true,"inapp":true,"due_reminder_hours":24}',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Clients
CREATE TABLE IF NOT EXISTS clients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_name TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  address TEXT,
  logo_url TEXT,
  password_hash TEXT NOT NULL,
  portal_access INTEGER DEFAULT 1,
  color TEXT DEFAULT '#6366f1',
  notes TEXT,
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Projects (group tasks under projects per client)
CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  client_id INTEGER,
  status TEXT DEFAULT 'active' CHECK(status IN ('active','on_hold','completed','archived')),
  color TEXT DEFAULT '#6366f1',
  start_date DATE,
  end_date DATE,
  created_by INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Processes / Workflows (templates for recurring task flows)
CREATE TABLE IF NOT EXISTS processes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  steps TEXT, -- JSON array of step definitions
  is_template INTEGER DEFAULT 1,
  created_by INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Tasks
CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'todo' CHECK(status IN ('todo','in_progress','review','blocked','done','cancelled')),
  priority TEXT DEFAULT 'medium' CHECK(priority IN ('urgent','high','medium','low')),
  project_id INTEGER,
  client_id INTEGER,
  process_id INTEGER,
  process_step INTEGER,
  parent_task_id INTEGER,
  due_date DATETIME,
  start_date DATETIME,
  completed_at DATETIME,
  estimated_hours REAL,
  actual_hours REAL DEFAULT 0,
  tags TEXT, -- JSON array
  is_recurring INTEGER DEFAULT 0,
  recurrence_rule TEXT, -- JSON: {frequency, interval, end_date}
  created_by INTEGER,
  created_by_type TEXT DEFAULT 'user' CHECK(created_by_type IN ('user','client','email','api')),
  is_visible_to_client INTEGER DEFAULT 1,
  sort_order INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id),
  FOREIGN KEY (client_id) REFERENCES clients(id),
  FOREIGN KEY (process_id) REFERENCES processes(id),
  FOREIGN KEY (parent_task_id) REFERENCES tasks(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Task assignments (many-to-many)
CREATE TABLE IF NOT EXISTS task_assignments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  role TEXT DEFAULT 'assignee' CHECK(role IN ('assignee','reviewer','watcher')),
  assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  assigned_by INTEGER,
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (assigned_by) REFERENCES users(id),
  UNIQUE(task_id, user_id, role)
);

-- Comments
CREATE TABLE IF NOT EXISTS comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id INTEGER NOT NULL,
  author_id INTEGER,
  author_type TEXT DEFAULT 'user' CHECK(author_type IN ('user','client','system')),
  content TEXT NOT NULL,
  is_internal INTEGER DEFAULT 0, -- 1 = not visible to client
  parent_comment_id INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  FOREIGN KEY (parent_comment_id) REFERENCES comments(id)
);

-- File attachments
CREATE TABLE IF NOT EXISTS attachments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id INTEGER,
  comment_id INTEGER,
  filename TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  uploaded_by INTEGER,
  uploaded_by_type TEXT DEFAULT 'user' CHECK(uploaded_by_type IN ('user','client')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE
);

-- Activity log
CREATE TABLE IF NOT EXISTS activity_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id INTEGER,
  actor_id INTEGER,
  actor_type TEXT DEFAULT 'user' CHECK(actor_type IN ('user','client','system')),
  action TEXT NOT NULL, -- created, updated, status_changed, assigned, commented, file_uploaded
  details TEXT, -- JSON with change details
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  recipient_id INTEGER NOT NULL,
  recipient_type TEXT DEFAULT 'user' CHECK(recipient_type IN ('user','client')),
  type TEXT NOT NULL, -- task_assigned, due_soon, overdue, comment_added, status_changed, task_created
  title TEXT NOT NULL,
  message TEXT,
  task_id INTEGER,
  is_read INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
);

-- Email integration tokens (for Gmail)
CREATE TABLE IF NOT EXISTS email_integrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  provider TEXT DEFAULT 'gmail',
  api_key TEXT, -- user-generated quick-add API key
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Sessions (simple token-based auth)
CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token TEXT UNIQUE NOT NULL,
  user_id INTEGER,
  client_id INTEGER,
  user_type TEXT DEFAULT 'user' CHECK(user_type IN ('user','client')),
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (client_id) REFERENCES clients(id)
);

-- Custom fields (for extensibility)
CREATE TABLE IF NOT EXISTS custom_fields (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  field_type TEXT DEFAULT 'text' CHECK(field_type IN ('text','number','date','select','checkbox','url')),
  options TEXT, -- JSON array for select type
  is_required INTEGER DEFAULT 0,
  applies_to TEXT DEFAULT 'task' CHECK(applies_to IN ('task','project','client')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS custom_field_values (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  field_id INTEGER NOT NULL,
  entity_id INTEGER NOT NULL,
  entity_type TEXT NOT NULL,
  value TEXT,
  FOREIGN KEY (field_id) REFERENCES custom_fields(id) ON DELETE CASCADE,
  UNIQUE(field_id, entity_id, entity_type)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_client ON tasks(client_id);
CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
CREATE INDEX IF NOT EXISTS idx_tasks_parent ON tasks(parent_task_id);
CREATE INDEX IF NOT EXISTS idx_task_assignments_task ON task_assignments(task_id);
CREATE INDEX IF NOT EXISTS idx_task_assignments_user ON task_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_comments_task ON comments(task_id);
CREATE INDEX IF NOT EXISTS idx_attachments_task ON attachments(task_id);
CREATE INDEX IF NOT EXISTS idx_activity_task ON activity_log(task_id);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient_id, recipient_type);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(recipient_id, is_read);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
