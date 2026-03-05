# FlexBiz Solutions - Task Management Platform

## Project Overview
- **Name**: FlexBiz Task Manager
- **Company**: FlexBiz Solutions LLC
- **Goal**: Monday.com-style task management platform with client portal, Gmail integration, and Apple Reminders sync
- **Stack**: Hono + TypeScript + Cloudflare Pages + D1 Database + Tailwind CSS

## Live URLs
- **Production**: https://flexbiz-tasks.pages.dev
- **Sandbox (dev)**: https://3000-i78b84joeftjm66z7eurf-5185f4aa.sandbox.novita.ai

## Features

### Completed
- **Dashboard** - Overview with task stats, priority breakdown, my tasks, activity feed
- **Task Management** - Full CRUD with list view and kanban board with drag-and-drop
- **Task Details** - Status, priority, due dates, estimated hours, tags, subtasks, comments, attachments, activity log
- **Project Management** - Create/edit projects, link to clients, progress tracking
- **Client Management** - Full client database with portal access control
- **Team Management** - Add/manage employees with roles (admin, manager, employee)
- **Process Templates** - Create reusable workflow templates that generate task sequences
- **Client Portal** - Separate login and interface for clients to view/add/update their tasks and comment
- **Notification System** - In-app notifications for task assignments, status changes, comments, due dates
- **Gmail Quick-Add** - API endpoint + bookmarklet for creating tasks directly from Gmail emails
- **Apple Reminders/Calendar Sync** - ICS calendar feed with task due dates for iPhone integration
- **Role-Based Access** - Admins, managers, employees, and clients each see appropriate data
- **Filtering** - Filter tasks by status, priority, client, project, assignee, and search
- **Bulk Operations** - Support for bulk task updates

### API Endpoints

#### Authentication
| Method | Path | Description |
|--------|------|-------------|
| POST | `/auth/login` | Employee login |
| POST | `/auth/client/login` | Client portal login |
| GET | `/auth/me` | Verify session |
| POST | `/auth/logout` | Logout |

#### Tasks
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/tasks` | List tasks (with filters: status, priority, client_id, project_id, assigned_to, search) |
| GET | `/api/tasks/:id` | Get task details (with comments, attachments, subtasks, activity) |
| POST | `/api/tasks` | Create task |
| PUT | `/api/tasks/:id` | Update task |
| DELETE | `/api/tasks/:id` | Delete task |
| POST | `/api/tasks/bulk` | Bulk update tasks |
| POST | `/api/tasks/email-add` | Create task from email (uses X-API-Key header) |

#### Comments & Attachments
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/tasks/:id/comments` | Add comment (supports internal notes) |
| POST | `/api/tasks/:id/attachments` | Add attachment |
| DELETE | `/api/attachments/:id` | Remove attachment |

#### Projects, Clients, Users
| Method | Path | Description |
|--------|------|-------------|
| GET/POST | `/api/projects` | List/Create projects |
| PUT/DELETE | `/api/projects/:id` | Update/Delete project |
| GET/POST | `/api/clients` | List/Create clients |
| PUT | `/api/clients/:id` | Update client |
| GET/POST | `/api/users` | List/Create team members |
| PUT | `/api/users/:id` | Update user |

#### Processes
| Method | Path | Description |
|--------|------|-------------|
| GET/POST | `/api/processes` | List/Create process templates |
| PUT/DELETE | `/api/processes/:id` | Update/Delete process |
| POST | `/api/processes/:id/apply` | Apply process template (creates tasks from steps) |

#### Notifications
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/notifications` | Get notifications |
| PUT | `/api/notifications/read` | Mark notifications as read |

#### Dashboard & Integrations
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/dashboard` | Dashboard stats |
| GET | `/api/email-integration` | Get Gmail integration status |
| POST | `/api/email-integration/generate-key` | Generate API key for email |
| GET | `/cal/feed/:token` | ICS calendar feed for Apple Reminders |
| GET | `/cal/generate-token` | Generate calendar subscription token |

### Pages
| Path | Description |
|------|-------------|
| `/` | Main dashboard (redirects to /login if not authenticated) |
| `/login` | Employee login |
| `/tasks` | Task list/board view |
| `/projects` | Projects overview |
| `/clients` | Client management |
| `/team` | Team members |
| `/processes` | Process templates |
| `/notifications` | Notification center |
| `/settings` | User settings + calendar sync |
| `/gmail-setup` | Gmail integration setup |
| `/client/login` | Client portal login |
| `/client/portal` | Client portal dashboard |

## Demo Credentials

### Employee Accounts
| Email | Password | Role |
|-------|----------|------|
| admin@flexbiz.com | admin123 | Admin |
| sarah@flexbiz.com | password123 | Manager |
| mike@flexbiz.com | password123 | Employee |
| lisa@flexbiz.com | password123 | Employee |
| james@flexbiz.com | password123 | Employee |

### Client Accounts
| Email | Password | Company |
|-------|----------|---------|
| alex@techstart.com | client123 | TechStart Inc |
| maya@greenleaf.com | client123 | GreenLeaf Co |
| tom@sunrisemedia.com | client123 | Sunrise Media |

## Data Architecture
- **Database**: Cloudflare D1 (SQLite)
- **Tables**: org_settings, users, clients, projects, processes, tasks, task_assignments, comments, attachments, activity_log, notifications, email_integrations, sessions, custom_fields, custom_field_values
- **Auth**: Simple token-based sessions stored in D1

## Gmail Integration Setup
1. Go to **Gmail Setup** page in the app
2. Click **Generate New API Key**
3. Option A: Drag the **bookmarklet** to your bookmarks bar, click it when viewing a Gmail email
4. Option B: Use the **API endpoint** with tools like Zapier, Google Apps Script, or any HTTP client

## Apple Reminders Setup
1. Go to **Settings** page
2. Click **Generate Calendar URL**
3. On your iPhone: Settings > Calendar > Accounts > Add Account > Other > Add Subscribed Calendar
4. Paste the calendar URL
5. Tasks with due dates will appear as calendar events with reminders

## Deployment
- **Platform**: Cloudflare Pages
- **Tech Stack**: Hono + TypeScript + D1 + Tailwind CSS (CDN)
- **Cloudflare Project**: flexbiz-tasks
- **Status**: ✅ Active (Production)
- **Last Updated**: 2026-03-05
