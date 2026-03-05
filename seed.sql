-- Seed data for FlexBiz Solutions LLC Task Manager

-- Admin user (password: admin123)
INSERT OR IGNORE INTO users (email, name, role, department, password_hash) VALUES
  ('admin@flexbiz.com', 'Admin User', 'admin', 'Management', 'admin123'),
  ('sarah@flexbiz.com', 'Sarah Johnson', 'manager', 'Project Management', 'password123'),
  ('mike@flexbiz.com', 'Mike Chen', 'employee', 'Development', 'password123'),
  ('lisa@flexbiz.com', 'Lisa Park', 'employee', 'Design', 'password123'),
  ('james@flexbiz.com', 'James Wilson', 'employee', 'Marketing', 'password123');

-- Sample clients
INSERT OR IGNORE INTO clients (company_name, contact_name, email, phone, password_hash, color) VALUES
  ('TechStart Inc', 'Alex Rivera', 'alex@techstart.com', '555-0101', 'client123', '#3b82f6'),
  ('GreenLeaf Co', 'Maya Patel', 'maya@greenleaf.com', '555-0102', 'client123', '#22c55e'),
  ('Sunrise Media', 'Tom Baker', 'tom@sunrisemedia.com', '555-0103', 'client123', '#f59e0b');

-- Sample projects
INSERT OR IGNORE INTO projects (name, description, client_id, status, color, created_by) VALUES
  ('Website Redesign', 'Complete redesign of TechStart corporate website', 1, 'active', '#3b82f6', 1),
  ('Brand Identity', 'New brand identity package for GreenLeaf', 2, 'active', '#22c55e', 2),
  ('Social Campaign Q1', 'Q1 social media campaign for Sunrise Media', 3, 'active', '#f59e0b', 1),
  ('Mobile App MVP', 'Mobile app minimum viable product for TechStart', 1, 'active', '#8b5cf6', 1);

-- Sample tasks
INSERT OR IGNORE INTO tasks (title, description, status, priority, project_id, client_id, due_date, created_by, tags) VALUES
  ('Design homepage mockup', 'Create high-fidelity mockup for the new homepage', 'in_progress', 'high', 1, 1, datetime('now', '+3 days'), 1, '["design","homepage"]'),
  ('Set up CI/CD pipeline', 'Configure GitHub Actions for automated deployment', 'todo', 'medium', 1, 1, datetime('now', '+7 days'), 1, '["devops"]'),
  ('Content audit', 'Audit all existing website content for migration', 'review', 'medium', 1, 1, datetime('now', '+5 days'), 2, '["content"]'),
  ('Logo design - 3 concepts', 'Present 3 logo concepts to client', 'in_progress', 'urgent', 2, 2, datetime('now', '+2 days'), 2, '["design","branding"]'),
  ('Brand guidelines document', 'Create comprehensive brand guidelines', 'todo', 'high', 2, 2, datetime('now', '+14 days'), 2, '["documentation"]'),
  ('Instagram content calendar', 'Plan 30 days of Instagram content', 'todo', 'high', 3, 3, datetime('now', '+5 days'), 1, '["social","planning"]'),
  ('Facebook ad creatives', 'Design 5 ad creative sets', 'blocked', 'medium', 3, 3, datetime('now', '+10 days'), 1, '["design","ads"]'),
  ('User research interviews', 'Conduct 10 user interviews for app UX', 'in_progress', 'high', 4, 1, datetime('now', '+4 days'), 1, '["research","ux"]'),
  ('Wireframe core flows', 'Wireframe the 5 core user flows', 'todo', 'urgent', 4, 1, datetime('now', '+6 days'), 1, '["design","ux"]'),
  ('API specification', 'Write OpenAPI spec for mobile app backend', 'todo', 'medium', 4, 1, datetime('now', '+8 days'), 1, '["development","api"]');

-- Subtasks
INSERT OR IGNORE INTO tasks (title, description, status, priority, project_id, client_id, parent_task_id, due_date, created_by) VALUES
  ('Desktop mockup', 'Desktop version of homepage', 'in_progress', 'high', 1, 1, 1, datetime('now', '+2 days'), 1),
  ('Mobile mockup', 'Mobile responsive version', 'todo', 'high', 1, 1, 1, datetime('now', '+3 days'), 1),
  ('Tablet mockup', 'Tablet version', 'todo', 'medium', 1, 1, 1, datetime('now', '+3 days'), 1);

-- Task assignments
INSERT OR IGNORE INTO task_assignments (task_id, user_id, role, assigned_by) VALUES
  (1, 4, 'assignee', 1), -- Lisa on homepage mockup
  (1, 2, 'reviewer', 1), -- Sarah reviews
  (2, 3, 'assignee', 1), -- Mike on CI/CD
  (3, 5, 'assignee', 2), -- James on content audit
  (4, 4, 'assignee', 2), -- Lisa on logo
  (5, 4, 'assignee', 2), -- Lisa on brand guidelines
  (6, 5, 'assignee', 1), -- James on Instagram
  (7, 4, 'assignee', 1), -- Lisa on FB ads
  (8, 2, 'assignee', 1), -- Sarah on research
  (9, 4, 'assignee', 1), -- Lisa on wireframes
  (10, 3, 'assignee', 1); -- Mike on API spec

-- Sample comments
INSERT OR IGNORE INTO comments (task_id, author_id, author_type, content, is_internal) VALUES
  (1, 1, 'user', 'I''ve started the initial concepts. Will share by end of day.', 0),
  (1, 2, 'user', 'Make sure to follow the new design system we agreed on.', 0),
  (4, 2, 'user', 'Client wants earth tones incorporated into the logo.', 0),
  (4, 4, 'user', 'Working on concepts now. Should have 3 ready by tomorrow.', 0),
  (7, 1, 'user', 'Blocked waiting on brand guidelines to be finalized.', 1),
  (8, 2, 'user', 'Completed 6 out of 10 interviews so far. Great insights on onboarding flow.', 0);

-- Sample notifications
INSERT OR IGNORE INTO notifications (recipient_id, recipient_type, type, title, message, task_id) VALUES
  (4, 'user', 'task_assigned', 'New task assigned', 'You have been assigned to "Design homepage mockup"', 1),
  (3, 'user', 'task_assigned', 'New task assigned', 'You have been assigned to "Set up CI/CD pipeline"', 2),
  (4, 'user', 'due_soon', 'Task due soon', '"Logo design - 3 concepts" is due in 2 days', 4),
  (2, 'user', 'comment_added', 'New comment', 'Lisa commented on "Logo design - 3 concepts"', 4);

-- Sample process template
INSERT OR IGNORE INTO processes (name, description, steps, created_by) VALUES
  ('Client Onboarding', 'Standard process for onboarding new clients', '[{"step":1,"title":"Initial Consultation","description":"Schedule and conduct initial meeting"},{"step":2,"title":"Requirements Gathering","description":"Document all client requirements"},{"step":3,"title":"Proposal & Quote","description":"Create and send project proposal"},{"step":4,"title":"Contract Signing","description":"Get contract signed and deposit"},{"step":5,"title":"Kickoff Meeting","description":"Schedule project kickoff with team"}]', 1),
  ('Website Launch', 'Pre-launch checklist for website projects', '[{"step":1,"title":"Content Review","description":"Final review of all content"},{"step":2,"title":"QA Testing","description":"Complete QA across browsers/devices"},{"step":3,"title":"Performance Audit","description":"Run lighthouse and optimize"},{"step":4,"title":"Client Approval","description":"Get final sign-off from client"},{"step":5,"title":"DNS & Deploy","description":"Update DNS and deploy to production"},{"step":6,"title":"Post-Launch Check","description":"Verify everything works in production"}]', 1);
