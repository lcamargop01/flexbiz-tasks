export function renderDashboard(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="icon" type="image/svg+xml" href="/favicon.svg">
  <title>FlexBiz Solutions - Task Manager</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script>tailwind.config={theme:{extend:{colors:{primary:'#6366f1',sidebar:'#1e1b4b'}}}}</script>
  <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
  <style>
    * { scrollbar-width: thin; scrollbar-color: #c7d2fe #f1f5f9; }
    ::-webkit-scrollbar { width: 6px; height: 6px; }
    ::-webkit-scrollbar-track { background: #f1f5f9; }
    ::-webkit-scrollbar-thumb { background: #c7d2fe; border-radius: 3px; }
    .task-row:hover { background: #f8fafc; }
    .task-row { transition: all 0.15s; }
    .priority-urgent { border-left: 3px solid #ef4444; }
    .priority-high { border-left: 3px solid #f97316; }
    .priority-medium { border-left: 3px solid #eab308; }
    .priority-low { border-left: 3px solid #22c55e; }
    .status-badge { font-size: 11px; padding: 2px 8px; border-radius: 10px; font-weight: 600; }
    .modal-overlay { background: rgba(0,0,0,0.5); backdrop-filter: blur(4px); }
    .sidebar-link { transition: all 0.15s; border-radius: 8px; }
    .sidebar-link:hover, .sidebar-link.active { background: rgba(255,255,255,0.1); }
    .pulse-dot { animation: pulse 2s infinite; }
    @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
    .kanban-col { min-width: 280px; max-width: 320px; }
    .drop-zone { transition: background 0.2s; }
    .drop-zone.drag-over { background: #e0e7ff; border: 2px dashed #6366f1; }
    [x-cloak] { display: none !important; }
    .fade-in { animation: fadeIn 0.2s ease-in; }
    @keyframes fadeIn { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
    .tag-chip { font-size: 10px; padding: 1px 6px; border-radius: 4px; }
    .avatar-stack > div:not(:first-child) { margin-left: -8px; }
    .notification-badge { min-width: 18px; height: 18px; font-size: 10px; }
    @media (max-width: 768px) {
      .sidebar-desktop { display: none; }
      .main-content { margin-left: 0 !important; }
    }
  </style>
</head>
<body class="bg-gray-50 text-gray-800">
<div id="app"></div>
<script>
// ==================== STATE ====================
const S = {
  user: null, token: null, currentPage: 'dashboard', tasks: [], projects: [], clients: [], 
  users: [], processes: [], notifications: [], unreadCount: 0, dashboard: null,
  filters: { status: '', priority: '', client_id: '', project_id: '', assigned_to: '', search: '' },
  viewMode: 'list', selectedTask: null, showTaskModal: false, showNewTaskModal: false,
  sidebarOpen: false, loading: true, editingProject: null, editingClient: null,
};

// ==================== API ====================
const API = {
  token() { return localStorage.getItem('flexbiz_token'); },
  async fetch(url, opts = {}) {
    const token = this.token();
    if (!token) { window.location.href = '/login'; return null; }
    const res = await fetch(url, {
      ...opts,
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token, ...opts.headers },
      body: opts.body ? JSON.stringify(opts.body) : undefined
    });
    if (res.status === 401) { localStorage.removeItem('flexbiz_token'); window.location.href = '/login'; return null; }
    return res.json();
  },
  get(url) { return this.fetch(url); },
  post(url, body) { return this.fetch(url, { method: 'POST', body }); },
  put(url, body) { return this.fetch(url, { method: 'PUT', body }); },
  del(url) { return this.fetch(url, { method: 'DELETE' }); },
};

// ==================== DATA LOADING ====================
async function loadDashboard() {
  const data = await API.get('/api/dashboard');
  if (data) S.dashboard = data;
}

async function loadTasks() {
  const params = new URLSearchParams();
  Object.entries(S.filters).forEach(([k, v]) => { if (v) params.set(k, v); });
  params.set('parent_task_id', 'null');
  const data = await API.get('/api/tasks?' + params.toString());
  if (data) S.tasks = data.tasks;
}

async function loadProjects() {
  const data = await API.get('/api/projects');
  if (data) S.projects = data.projects;
}

async function loadClients() {
  const data = await API.get('/api/clients');
  if (data) S.clients = data.clients;
}

async function loadUsers() {
  const data = await API.get('/api/users');
  if (data) S.users = data.users;
}

async function loadProcesses() {
  const data = await API.get('/api/processes');
  if (data) S.processes = data.processes;
}

async function loadNotifications() {
  const data = await API.get('/api/notifications');
  if (data) { S.notifications = data.notifications; S.unreadCount = data.unread_count; }
}

async function loadTaskDetail(id) {
  const data = await API.get('/api/tasks/' + id);
  if (data) { S.selectedTask = data; S.showTaskModal = true; render(); }
}

async function init() {
  S.token = localStorage.getItem('flexbiz_token');
  S.user = JSON.parse(localStorage.getItem('flexbiz_user') || 'null');
  if (!S.token || !S.user) { window.location.href = '/login'; return; }
  
  const path = window.location.pathname;
  if (path.startsWith('/tasks')) S.currentPage = 'tasks';
  else if (path.startsWith('/projects')) S.currentPage = 'projects';
  else if (path.startsWith('/clients')) S.currentPage = 'clients';
  else if (path.startsWith('/team')) S.currentPage = 'team';
  else if (path.startsWith('/processes')) S.currentPage = 'processes';
  else if (path.startsWith('/notifications')) S.currentPage = 'notifications';
  else if (path.startsWith('/settings')) S.currentPage = 'settings';
  else if (path.startsWith('/gmail-setup')) S.currentPage = 'gmail-setup';
  else S.currentPage = 'dashboard';

  S.loading = true; render();
  await Promise.all([loadDashboard(), loadTasks(), loadProjects(), loadClients(), loadUsers(), loadProcesses(), loadNotifications()]);
  S.loading = false; render();
  
  // Poll notifications every 30s
  setInterval(loadNotifications, 30000);
}

function navigate(page) {
  S.currentPage = page;
  S.showTaskModal = false;
  S.showNewTaskModal = false;
  const urlMap = { dashboard: '/', tasks: '/tasks', projects: '/projects', clients: '/clients', team: '/team', processes: '/processes', notifications: '/notifications', settings: '/settings', 'gmail-setup': '/gmail-setup' };
  history.pushState(null, '', urlMap[page] || '/');
  render();
  if (page === 'tasks') loadTasks();
  if (page === 'projects') loadProjects();
  if (page === 'clients') loadClients();
  if (page === 'team') loadUsers();
  if (page === 'notifications') loadNotifications();
}

window.addEventListener('popstate', () => { const p = window.location.pathname; navigate(p === '/' ? 'dashboard' : p.slice(1).split('/')[0]); });

// ==================== HELPERS ====================
function esc(s) { if (!s) return ''; const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
function timeAgo(d) {
  if (!d) return '';
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return 'just now'; if (s < 3600) return Math.floor(s/60)+'m ago';
  if (s < 86400) return Math.floor(s/3600)+'h ago'; if (s < 604800) return Math.floor(s/86400)+'d ago';
  return new Date(d).toLocaleDateString();
}
function dueLabel(d) {
  if (!d) return '<span class="text-gray-400 text-xs">No date</span>';
  const diff = Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
  if (diff < 0) return '<span class="text-red-600 font-semibold text-xs"><i class="fas fa-exclamation-triangle mr-1"></i>Overdue ' + Math.abs(diff) + 'd</span>';
  if (diff === 0) return '<span class="text-orange-600 font-semibold text-xs"><i class="fas fa-clock mr-1"></i>Due today</span>';
  if (diff <= 3) return '<span class="text-amber-600 text-xs"><i class="fas fa-clock mr-1"></i>' + diff + 'd left</span>';
  return '<span class="text-gray-500 text-xs">' + new Date(d).toLocaleDateString('en-US', {month:'short',day:'numeric'}) + '</span>';
}
function statusColor(s) {
  const m = {todo:'bg-gray-100 text-gray-700',in_progress:'bg-blue-100 text-blue-700',review:'bg-purple-100 text-purple-700',blocked:'bg-red-100 text-red-700',done:'bg-green-100 text-green-700',cancelled:'bg-gray-200 text-gray-500'};
  return m[s] || m.todo;
}
function priorityIcon(p) {
  const m = {urgent:'<i class="fas fa-fire text-red-500"></i>',high:'<i class="fas fa-arrow-up text-orange-500"></i>',medium:'<i class="fas fa-minus text-yellow-500"></i>',low:'<i class="fas fa-arrow-down text-green-500"></i>'};
  return m[p] || m.medium;
}
function avatar(name, size = 'w-7 h-7 text-xs') {
  const colors = ['bg-indigo-500','bg-sky-500','bg-emerald-500','bg-amber-500','bg-rose-500','bg-violet-500','bg-teal-500'];
  const c = colors[name.charCodeAt(0) % colors.length];
  return '<div class="'+size+' '+c+' rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0" title="'+esc(name)+'">'+esc(name.charAt(0).toUpperCase())+'</div>';
}

// ==================== RENDER ====================
function render() {
  document.getElementById('app').innerHTML = renderSidebar() + '<div class="main-content md:ml-64 min-h-screen">' + renderTopBar() + '<div class="p-4 md:p-6">' + renderPage() + '</div></div>' + (S.showTaskModal ? renderTaskModal() : '') + (S.showNewTaskModal ? renderNewTaskModal() : '');
  bindEvents();
}

function renderSidebar() {
  const links = [
    {id:'dashboard',icon:'fas fa-th-large',label:'Dashboard'},
    {id:'tasks',icon:'fas fa-tasks',label:'Tasks'},
    {id:'projects',icon:'fas fa-project-diagram',label:'Projects'},
    {id:'clients',icon:'fas fa-building',label:'Clients'},
    {id:'team',icon:'fas fa-users',label:'Team'},
    {id:'processes',icon:'fas fa-sitemap',label:'Processes'},
    {id:'gmail-setup',icon:'fab fa-google',label:'Gmail Setup'},
    {id:'settings',icon:'fas fa-cog',label:'Settings'},
  ];
  return '<div class="sidebar-desktop fixed left-0 top-0 bottom-0 w-64 bg-sidebar text-white z-30 flex flex-col">' +
    '<div class="p-5 border-b border-white/10"><div class="flex items-center gap-3"><div class="w-10 h-10 bg-indigo-500 rounded-xl flex items-center justify-center"><i class="fas fa-tasks text-lg"></i></div><div><div class="font-bold text-sm">FlexBiz Solutions</div><div class="text-xs text-indigo-300">Task Manager</div></div></div></div>' +
    '<nav class="flex-1 p-3 space-y-1 overflow-y-auto">' +
    links.map(l => '<a onclick="navigate(&apos;'+l.id+'&apos;)" class="sidebar-link flex items-center gap-3 px-3 py-2.5 cursor-pointer text-sm '+(S.currentPage===l.id?'active bg-white/10 text-white':'text-indigo-200 hover:text-white')+'"><i class="'+l.icon+' w-5 text-center"></i><span>'+l.label+'</span></a>').join('') +
    '</nav>' +
    '<div class="p-4 border-t border-white/10"><div class="flex items-center gap-3">'+avatar(S.user?.name || 'U', 'w-9 h-9 text-sm')+'<div class="flex-1 min-w-0"><div class="text-sm font-medium truncate">'+esc(S.user?.name)+'</div><div class="text-xs text-indigo-300 truncate">'+esc(S.user?.role)+'</div></div><button onclick="logout()" class="text-indigo-300 hover:text-white" title="Logout"><i class="fas fa-sign-out-alt"></i></button></div></div>' +
    '</div>' +
    // Mobile hamburger
    '<div class="md:hidden fixed top-0 left-0 right-0 bg-sidebar text-white z-40 px-4 py-3 flex items-center justify-between"><div class="flex items-center gap-2"><i class="fas fa-tasks text-indigo-400"></i><span class="font-bold text-sm">FlexBiz</span></div><div class="flex items-center gap-3"><button onclick="navigate(&apos;notifications&apos;)" class="relative"><i class="fas fa-bell text-indigo-300"></i>'+(S.unreadCount>0?'<span class="absolute -top-1 -right-1 bg-red-500 text-white rounded-full notification-badge flex items-center justify-center">'+S.unreadCount+'</span>':'')+'</button><button onclick="toggleMobileSidebar()" class="text-indigo-300"><i class="fas fa-bars text-lg"></i></button></div></div>';
}

function renderTopBar() {
  return '<div class="bg-white border-b border-gray-200 px-4 md:px-6 py-3 flex items-center justify-between sticky top-0 z-20 mt-12 md:mt-0">' +
    '<div class="flex items-center gap-4 flex-1"><h1 class="text-lg font-bold text-gray-800 capitalize">'+S.currentPage.replace('-',' ')+'</h1>' +
    '<div class="hidden md:flex items-center bg-gray-100 rounded-lg px-3 py-2 flex-1 max-w-md"><i class="fas fa-search text-gray-400 mr-2"></i><input type="text" placeholder="Search tasks..." class="bg-transparent outline-none text-sm flex-1" onkeyup="handleSearch(event)" value="'+esc(S.filters.search)+'"></div></div>' +
    '<div class="flex items-center gap-3">' +
    '<button onclick="S.showNewTaskModal=true;render()" class="bg-primary text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors flex items-center gap-2"><i class="fas fa-plus"></i><span class="hidden md:inline">New Task</span></button>' +
    '<button onclick="navigate(&apos;notifications&apos;)" class="relative p-2 text-gray-500 hover:text-gray-700"><i class="fas fa-bell text-lg"></i>'+(S.unreadCount>0?'<span class="absolute top-0 right-0 bg-red-500 text-white rounded-full notification-badge flex items-center justify-center">'+S.unreadCount+'</span>':'')+'</button>' +
    '</div></div>';
}

function renderPage() {
  if (S.loading) return '<div class="flex items-center justify-center h-96"><div class="text-center"><i class="fas fa-spinner fa-spin text-4xl text-indigo-500 mb-4"></i><p class="text-gray-500">Loading...</p></div></div>';
  const pages = { dashboard: renderDashboardPage, tasks: renderTasksPage, projects: renderProjectsPage, clients: renderClientsPage, team: renderTeamPage, processes: renderProcessesPage, notifications: renderNotificationsPage, settings: renderSettingsPage, 'gmail-setup': renderGmailSetupPage };
  return (pages[S.currentPage] || renderDashboardPage)();
}

// ==================== DASHBOARD ====================
function renderDashboardPage() {
  if (!S.dashboard) return '<p>Loading dashboard...</p>';
  const d = S.dashboard;
  const statusCounts = {};
  (d.tasksByStatus || []).forEach(s => statusCounts[s.status] = s.count);
  const priorityCounts = {};
  (d.tasksByPriority || []).forEach(p => priorityCounts[p.priority] = p.count);

  return '<div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">' +
    statCard('Overdue', d.overdueTasks || 0, 'fas fa-exclamation-triangle', 'bg-red-500', 'text-red-600') +
    statCard('Due Soon', d.dueSoonTasks || 0, 'fas fa-clock', 'bg-amber-500', 'text-amber-600') +
    statCard('In Progress', statusCounts['in_progress'] || 0, 'fas fa-spinner', 'bg-blue-500', 'text-blue-600') +
    statCard('Completed', statusCounts['done'] || 0, 'fas fa-check-circle', 'bg-green-500', 'text-green-600') +
    '</div>' +
    '<div class="grid md:grid-cols-2 gap-6">' +
    // My tasks (admin sees all, others see assigned)
    '<div class="bg-white rounded-xl shadow-sm border border-gray-200 p-5"><h3 class="font-bold text-gray-800 mb-4 flex items-center gap-2"><i class="fas fa-'+(S.user?.role==='admin'?'tasks':'user-check')+' text-indigo-500"></i>'+(S.user?.role==='admin'?'All Open Tasks':'My Tasks')+'</h3>' +
    '<div class="space-y-2">' + ((d.myTasks || []).length === 0 ? '<p class="text-gray-400 text-sm py-4 text-center">No open tasks</p>' :
    (d.myTasks || []).map(t => '<div class="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer" onclick="loadTaskDetail('+t.id+')">' +
      priorityIcon(t.priority) +
      '<div class="flex-1 min-w-0"><div class="text-sm font-medium truncate">'+esc(t.title)+'</div><div class="text-xs text-gray-400">'+(t.assignee_names ? '<i class="fas fa-user text-gray-300 mr-1"></i>'+esc(t.assignee_names) : '<span class="text-gray-300">Unassigned</span>')+(t.project_name ? ' &middot; '+esc(t.project_name) : '')+(t.client_name ? ' &middot; '+esc(t.client_name) : '')+'</div></div>' +
      '<div>'+dueLabel(t.due_date)+'</div>' +
      '<span class="status-badge '+statusColor(t.status)+'">'+esc(t.status)+'</span></div>').join('')) +
    '</div></div>' +
    // Recent activity
    '<div class="bg-white rounded-xl shadow-sm border border-gray-200 p-5"><h3 class="font-bold text-gray-800 mb-4 flex items-center gap-2"><i class="fas fa-history text-indigo-500"></i>Recent Activity</h3>' +
    '<div class="space-y-3 max-h-96 overflow-y-auto">' + ((d.recentActivity || []).length === 0 ? '<p class="text-gray-400 text-sm py-4 text-center">No recent activity</p>' :
    (d.recentActivity || []).map(a => '<div class="flex items-start gap-3 text-sm"><div class="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"><i class="fas fa-'+activityIcon(a.action)+' text-indigo-500 text-xs"></i></div><div class="flex-1 min-w-0"><span class="font-medium">'+esc(a.actor_name)+'</span> <span class="text-gray-500">'+activityText(a)+'</span>' +
      (a.task_title ? ' <a class="text-indigo-600 hover:underline cursor-pointer" onclick="loadTaskDetail('+a.task_id+')">'+esc(a.task_title)+'</a>' : '') +
      '<div class="text-xs text-gray-400 mt-0.5">'+timeAgo(a.created_at)+'</div></div></div>').join('')) +
    '</div></div>' +
    '</div>' +
    // Priority breakdown
    '<div class="mt-6 grid md:grid-cols-4 gap-4">' +
    ['urgent','high','medium','low'].map(p => {
      const count = priorityCounts[p] || 0;
      const colors = {urgent:'border-red-400 bg-red-50',high:'border-orange-400 bg-orange-50',medium:'border-yellow-400 bg-yellow-50',low:'border-green-400 bg-green-50'};
      return '<div class="border-l-4 '+colors[p]+' rounded-r-lg p-4 cursor-pointer hover:shadow-sm transition-shadow" onclick="S.filters.priority=&apos;'+p+'&apos;;navigate(&apos;tasks&apos;)">' +
        '<div class="text-2xl font-bold">'+count+'</div><div class="text-sm capitalize text-gray-600">'+p+' priority</div></div>';
    }).join('') + '</div>';
}

function statCard(label, value, icon, iconBg, textColor) {
  return '<div class="bg-white rounded-xl shadow-sm border border-gray-200 p-4"><div class="flex items-center gap-3"><div class="w-10 h-10 '+iconBg+' rounded-lg flex items-center justify-center"><i class="'+icon+' text-white"></i></div><div><div class="text-2xl font-bold '+textColor+'">'+value+'</div><div class="text-xs text-gray-500">'+label+'</div></div></div></div>';
}

function activityIcon(a) { return {created:'plus',updated:'edit',status_changed:'exchange-alt',assigned:'user-plus',commented:'comment',file_uploaded:'paperclip'}[a]||'circle'; }
function activityText(a) { return {created:'created',updated:'updated',status_changed:'changed status of',assigned:'was assigned to',commented:'commented on',file_uploaded:'uploaded file to'}[a.action]||a.action; }

// ==================== TASKS PAGE ====================
function renderTasksPage() {
  return '<div class="mb-4 flex flex-wrap items-center gap-3">' +
    // View mode toggle
    '<div class="flex bg-white border rounded-lg overflow-hidden"><button onclick="S.viewMode=&apos;list&apos;;render()" class="px-3 py-2 text-sm '+(S.viewMode==='list'?'bg-indigo-100 text-indigo-700':'text-gray-500 hover:bg-gray-50')+'"><i class="fas fa-list mr-1"></i>List</button><button onclick="S.viewMode=&apos;kanban&apos;;render()" class="px-3 py-2 text-sm '+(S.viewMode==='kanban'?'bg-indigo-100 text-indigo-700':'text-gray-500 hover:bg-gray-50')+'"><i class="fas fa-columns mr-1"></i>Board</button></div>' +
    // Filters
    '<select onchange="S.filters.status=this.value;loadTasks().then(render)" class="text-sm border rounded-lg px-3 py-2 bg-white"><option value="">All Statuses</option><option value="todo"'+(S.filters.status==='todo'?' selected':'')+'>To Do</option><option value="in_progress"'+(S.filters.status==='in_progress'?' selected':'')+'>In Progress</option><option value="review"'+(S.filters.status==='review'?' selected':'')+'>Review</option><option value="blocked"'+(S.filters.status==='blocked'?' selected':'')+'>Blocked</option><option value="done"'+(S.filters.status==='done'?' selected':'')+'>Done</option></select>' +
    '<select onchange="S.filters.priority=this.value;loadTasks().then(render)" class="text-sm border rounded-lg px-3 py-2 bg-white"><option value="">All Priorities</option><option value="urgent"'+(S.filters.priority==='urgent'?' selected':'')+'>Urgent</option><option value="high"'+(S.filters.priority==='high'?' selected':'')+'>High</option><option value="medium"'+(S.filters.priority==='medium'?' selected':'')+'>Medium</option><option value="low"'+(S.filters.priority==='low'?' selected':'')+'>Low</option></select>' +
    '<select onchange="S.filters.client_id=this.value;loadTasks().then(render)" class="text-sm border rounded-lg px-3 py-2 bg-white"><option value="">All Clients</option>'+S.clients.map(c=>'<option value="'+c.id+'"'+(S.filters.client_id==c.id?' selected':'')+'>'+esc(c.company_name)+'</option>').join('')+'</select>' +
    '<select onchange="S.filters.project_id=this.value;loadTasks().then(render)" class="text-sm border rounded-lg px-3 py-2 bg-white"><option value="">All Projects</option>'+S.projects.map(p=>'<option value="'+p.id+'"'+(S.filters.project_id==p.id?' selected':'')+'>'+esc(p.name)+'</option>').join('')+'</select>' +
    '<select onchange="S.filters.assigned_to=this.value;loadTasks().then(render)" class="text-sm border rounded-lg px-3 py-2 bg-white"><option value="">All Assignees</option>'+S.users.map(u=>'<option value="'+u.id+'"'+(S.filters.assigned_to==u.id?' selected':'')+'>'+esc(u.name)+'</option>').join('')+'</select>' +
    (Object.values(S.filters).some(v=>v) ? '<button onclick="clearFilters()" class="text-sm text-red-500 hover:text-red-700"><i class="fas fa-times mr-1"></i>Clear</button>' : '') +
    '<div class="ml-auto text-sm text-gray-500">'+S.tasks.length+' tasks</div></div>' +
    (S.viewMode === 'list' ? renderTaskList() : renderKanban());
}

function renderTaskList() {
  if (S.tasks.length === 0) return '<div class="bg-white rounded-xl border p-12 text-center"><i class="fas fa-inbox text-4xl text-gray-300 mb-3"></i><p class="text-gray-500">No tasks found</p><button onclick="S.showNewTaskModal=true;render()" class="mt-3 text-indigo-600 hover:text-indigo-800 font-medium text-sm"><i class="fas fa-plus mr-1"></i>Create a task</button></div>';
  
  return '<div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">' +
    '<div class="hidden md:grid grid-cols-12 gap-2 px-4 py-2 bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b"><div class="col-span-4">Task</div><div class="col-span-2">Project / Client</div><div class="col-span-1">Priority</div><div class="col-span-1">Status</div><div class="col-span-2">Assignees</div><div class="col-span-1">Due Date</div><div class="col-span-1">Info</div></div>' +
    S.tasks.map(t => {
      const assignees = t.assignments?.filter(a => a.role === 'assignee') || [];
      return '<div class="task-row grid grid-cols-12 gap-2 px-4 py-3 border-b border-gray-100 items-center cursor-pointer priority-'+t.priority+'" onclick="loadTaskDetail('+t.id+')">' +
        '<div class="col-span-12 md:col-span-4"><div class="flex items-center gap-2"><button onclick="event.stopPropagation();quickStatus('+t.id+',&apos;'+t.status+'&apos;)" class="flex-shrink-0 w-5 h-5 rounded-full border-2 '+(t.status==='done'?'bg-green-500 border-green-500 text-white':'border-gray-300 hover:border-indigo-400')+' flex items-center justify-center text-xs">'+(t.status==='done'?'<i class="fas fa-check"></i>':'')+'</button><div class="min-w-0"><div class="text-sm font-medium truncate">'+esc(t.title)+'</div>'+(t.tags?.length?'<div class="flex gap-1 mt-0.5">'+t.tags.slice(0,3).map(tag=>'<span class="tag-chip bg-indigo-50 text-indigo-600">'+esc(tag)+'</span>').join('')+'</div>':'')+'</div></div></div>' +
        '<div class="hidden md:block col-span-2"><div class="text-xs">'+(t.project_name?'<span class="inline-flex items-center gap-1"><span class="w-2 h-2 rounded-full" style="background:'+esc(t.project_color||'#6366f1')+'"></span>'+esc(t.project_name)+'</span>':'')+'</div><div class="text-xs text-gray-400">'+(t.client_name||'')+'</div></div>' +
        '<div class="hidden md:block col-span-1">'+priorityIcon(t.priority)+' <span class="text-xs capitalize text-gray-500">'+t.priority+'</span></div>' +
        '<div class="hidden md:block col-span-1"><span class="status-badge '+statusColor(t.status)+'">'+t.status.replace('_',' ')+'</span></div>' +
        '<div class="hidden md:block col-span-2"><div class="avatar-stack flex">'+(assignees.length>0 ? assignees.slice(0,3).map(a=>avatar(a.user_name)).join('') + (assignees.length>3?'<div class="w-7 h-7 bg-gray-200 rounded-full flex items-center justify-center text-xs text-gray-600">+'+( assignees.length-3)+'</div>':'') : '<span class="text-xs text-gray-400">Unassigned</span>')+'</div></div>' +
        '<div class="hidden md:block col-span-1">'+dueLabel(t.due_date)+'</div>' +
        '<div class="hidden md:block col-span-1 flex items-center gap-2 text-xs text-gray-400">'+(t.subtask_count>0?'<span title="Subtasks"><i class="fas fa-sitemap mr-1"></i>'+t.subtask_done_count+'/'+t.subtask_count+'</span> ':'')+(t.comment_count>0?'<span title="Comments"><i class="fas fa-comment mr-1"></i>'+t.comment_count+'</span> ':'')+(t.attachment_count>0?'<span title="Files"><i class="fas fa-paperclip mr-1"></i>'+t.attachment_count+'</span>':'')+'</div>' +
        '</div>';
    }).join('') + '</div>';
}

function renderKanban() {
  const statuses = ['todo','in_progress','review','blocked','done'];
  const statusLabels = {todo:'To Do',in_progress:'In Progress',review:'Review',blocked:'Blocked',done:'Done'};
  const statusIcons = {todo:'fas fa-circle text-gray-400',in_progress:'fas fa-play-circle text-blue-500',review:'fas fa-eye text-purple-500',blocked:'fas fa-ban text-red-500',done:'fas fa-check-circle text-green-500'};

  return '<div class="flex gap-4 overflow-x-auto pb-4">' +
    statuses.map(status => {
      const tasks = S.tasks.filter(t => t.status === status);
      return '<div class="kanban-col flex-shrink-0"><div class="bg-gray-100 rounded-xl p-3">' +
        '<div class="flex items-center justify-between mb-3 px-1"><div class="flex items-center gap-2"><i class="'+statusIcons[status]+' text-sm"></i><span class="font-semibold text-sm">'+statusLabels[status]+'</span></div><span class="bg-white text-gray-500 text-xs font-semibold px-2 py-0.5 rounded-full">'+tasks.length+'</span></div>' +
        '<div class="space-y-2 min-h-[100px] drop-zone" data-status="'+status+'" ondragover="event.preventDefault();this.classList.add(&apos;drag-over&apos;)" ondragleave="this.classList.remove(&apos;drag-over&apos;)" ondrop="handleDrop(event,&apos;'+status+'&apos;)">' +
        tasks.map(t => {
          const assignees = t.assignments?.filter(a => a.role === 'assignee') || [];
          return '<div class="bg-white rounded-lg p-3 shadow-sm border border-gray-200 cursor-pointer hover:shadow-md transition-shadow priority-'+t.priority+'" draggable="true" ondragstart="event.dataTransfer.setData(&apos;text/plain&apos;,'+t.id+')" onclick="loadTaskDetail('+t.id+')">' +
            '<div class="text-sm font-medium mb-2">'+esc(t.title)+'</div>' +
            (t.project_name?'<div class="flex items-center gap-1 mb-2"><span class="w-2 h-2 rounded-full" style="background:'+esc(t.project_color||'#6366f1')+'"></span><span class="text-xs text-gray-500">'+esc(t.project_name)+'</span></div>':'') +
            '<div class="flex items-center justify-between">' +
            '<div class="flex items-center gap-2">'+priorityIcon(t.priority)+' '+dueLabel(t.due_date)+'</div>' +
            '<div class="avatar-stack flex">'+assignees.slice(0,2).map(a=>avatar(a.user_name,'w-6 h-6 text-[10px]')).join('')+'</div>' +
            '</div>' +
            (t.subtask_count>0?'<div class="mt-2 bg-gray-100 rounded-full h-1.5"><div class="bg-indigo-500 rounded-full h-1.5" style="width:'+Math.round((t.subtask_done_count/t.subtask_count)*100)+'%"></div></div>':'') +
            '</div>';
        }).join('') +
        '</div></div></div>';
    }).join('') + '</div>';
}

async function handleDrop(e, newStatus) {
  e.preventDefault();
  e.currentTarget.classList.remove('drag-over');
  const taskId = parseInt(e.dataTransfer.getData('text/plain'));
  await API.put('/api/tasks/' + taskId, { status: newStatus });
  await loadTasks(); render();
}

async function quickStatus(id, current) {
  const next = current === 'done' ? 'todo' : 'done';
  await API.put('/api/tasks/' + id, { status: next });
  await loadTasks(); render();
}

function handleSearch(e) {
  if (e.key === 'Enter') { S.filters.search = e.target.value; loadTasks().then(render); }
}

function clearFilters() {
  S.filters = { status: '', priority: '', client_id: '', project_id: '', assigned_to: '', search: '' };
  loadTasks().then(render);
}

// ==================== TASK DETAIL MODAL ====================
function renderTaskModal() {
  const t = S.selectedTask;
  if (!t) return '';
  const assignees = t.assignments?.filter(a => a.role === 'assignee') || [];
  const watchers = t.assignments?.filter(a => a.role === 'watcher') || [];

  return '<div class="fixed inset-0 z-50 modal-overlay flex items-start justify-center pt-8 md:pt-16 px-4" onclick="if(event.target===this){S.showTaskModal=false;render()}">' +
    '<div class="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] overflow-hidden flex flex-col fade-in">' +
    // Header
    '<div class="px-6 py-4 border-b flex items-center justify-between bg-gray-50">' +
    '<div class="flex items-center gap-3">' +
    '<span class="status-badge '+statusColor(t.status)+' cursor-pointer" onclick="cycleStatus()">'+t.status.replace('_',' ')+'</span>' +
    priorityIcon(t.priority) +
    (t.project_name?'<span class="text-xs bg-indigo-50 text-indigo-600 px-2 py-1 rounded-full"><span class="w-2 h-2 rounded-full inline-block mr-1" style="background:'+esc(t.project_color)+'"></span>'+esc(t.project_name)+'</span>':'') +
    (t.client_name?'<span class="text-xs text-gray-500">'+esc(t.client_name)+'</span>':'') +
    '</div>' +
    '<div class="flex items-center gap-2"><button onclick="deleteTask('+t.id+')" class="text-gray-400 hover:text-red-500 p-1" title="Delete"><i class="fas fa-trash text-sm"></i></button><button onclick="S.showTaskModal=false;render()" class="text-gray-400 hover:text-gray-700 p-1"><i class="fas fa-times text-lg"></i></button></div></div>' +
    // Body
    '<div class="flex-1 overflow-y-auto p-6">' +
    // Title (editable)
    '<div class="mb-4"><input type="text" value="'+esc(t.title)+'" class="text-xl font-bold w-full border-0 focus:ring-0 p-0 bg-transparent" onchange="updateTaskField('+t.id+',&apos;title&apos;,this.value)"></div>' +
    // Description
    '<div class="mb-6"><label class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 block">Description</label><textarea class="w-full border border-gray-200 rounded-lg p-3 text-sm min-h-[80px] focus:ring-2 focus:ring-indigo-200" onchange="updateTaskField('+t.id+',&apos;description&apos;,this.value)">'+esc(t.description||'')+'</textarea></div>' +
    // Meta grid
    '<div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">' +
    '<div><label class="text-xs font-semibold text-gray-500 mb-1 block">Status</label><select onchange="updateTaskField('+t.id+',&apos;status&apos;,this.value);S.selectedTask.status=this.value;render()" class="w-full text-sm border rounded-lg px-3 py-2"><option value="todo"'+(t.status==='todo'?' selected':'')+'>To Do</option><option value="in_progress"'+(t.status==='in_progress'?' selected':'')+'>In Progress</option><option value="review"'+(t.status==='review'?' selected':'')+'>Review</option><option value="blocked"'+(t.status==='blocked'?' selected':'')+'>Blocked</option><option value="done"'+(t.status==='done'?' selected':'')+'>Done</option></select></div>' +
    '<div><label class="text-xs font-semibold text-gray-500 mb-1 block">Priority</label><select onchange="updateTaskField('+t.id+',&apos;priority&apos;,this.value)" class="w-full text-sm border rounded-lg px-3 py-2"><option value="urgent"'+(t.priority==='urgent'?' selected':'')+'>Urgent</option><option value="high"'+(t.priority==='high'?' selected':'')+'>High</option><option value="medium"'+(t.priority==='medium'?' selected':'')+'>Medium</option><option value="low"'+(t.priority==='low'?' selected':'')+'>Low</option></select></div>' +
    '<div><label class="text-xs font-semibold text-gray-500 mb-1 block">Due Date</label><input type="datetime-local" value="'+(t.due_date?t.due_date.slice(0,16):'')+'" onchange="updateTaskField('+t.id+',&apos;due_date&apos;,this.value)" class="w-full text-sm border rounded-lg px-3 py-2"></div>' +
    '<div><label class="text-xs font-semibold text-gray-500 mb-1 block">Est. Hours</label><input type="number" value="'+(t.estimated_hours||'')+'" onchange="updateTaskField('+t.id+',&apos;estimated_hours&apos;,parseFloat(this.value))" class="w-full text-sm border rounded-lg px-3 py-2" step="0.5"></div></div>' +
    // Assignees
    '<div class="mb-6"><label class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Assignees</label><div class="flex flex-wrap gap-2">' +
    assignees.map(a => '<div class="flex items-center gap-2 bg-gray-100 rounded-full px-3 py-1.5">'+avatar(a.user_name,'w-6 h-6 text-[10px]')+'<span class="text-sm">'+esc(a.user_name)+'</span><button onclick="removeAssignee('+t.id+','+a.user_id+')" class="text-gray-400 hover:text-red-500 text-xs"><i class="fas fa-times"></i></button></div>').join('') +
    '<select onchange="addAssignee('+t.id+',this.value);this.selectedIndex=0" class="text-sm border rounded-full px-3 py-1.5 bg-white"><option value="">+ Add assignee</option>'+S.users.filter(u=>!assignees.find(a=>a.user_id===u.id)).map(u=>'<option value="'+u.id+'">'+esc(u.name)+'</option>').join('')+'</select></div></div>' +
    // Subtasks
    '<div class="mb-6"><label class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Subtasks '+(t.subtasks?.length?'('+t.subtasks.filter(s=>s.status==='done').length+'/'+t.subtasks.length+')':'')+'</label>' +
    '<div class="space-y-1">' + (t.subtasks||[]).map(st => '<div class="flex items-center gap-2 p-2 rounded hover:bg-gray-50"><button onclick="quickStatus('+st.id+',&apos;'+st.status+'&apos;)" class="w-5 h-5 rounded-full border-2 '+(st.status==='done'?'bg-green-500 border-green-500 text-white':'border-gray-300')+' flex items-center justify-center text-xs flex-shrink-0">'+(st.status==='done'?'<i class="fas fa-check"></i>':'')+'</button><span class="text-sm '+(st.status==='done'?'line-through text-gray-400':'')+'">'+esc(st.title)+'</span><span class="text-xs text-gray-400 ml-auto">'+(st.assignee_names||'')+'</span></div>').join('') +
    '</div><div class="mt-2 flex gap-2"><input type="text" id="newSubtask" placeholder="Add subtask..." class="flex-1 text-sm border rounded-lg px-3 py-2" onkeyup="if(event.key===&apos;Enter&apos;)addSubtask('+t.id+')"><button onclick="addSubtask('+t.id+')" class="text-sm text-indigo-600 hover:text-indigo-800 px-3"><i class="fas fa-plus mr-1"></i>Add</button></div></div>' +
    // Attachments
    '<div class="mb-6"><label class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Attachments ('+((t.attachments||[]).length)+')</label>' +
    '<div class="space-y-1">'+(t.attachments||[]).map(a => '<div class="flex items-center gap-2 p-2 bg-gray-50 rounded-lg"><i class="fas fa-file text-gray-400"></i><span class="text-sm">'+esc(a.filename)+'</span><span class="text-xs text-gray-400 ml-auto">'+timeAgo(a.created_at)+'</span></div>').join('')+'</div>' +
    '<div class="mt-2"><input type="text" id="attachUrl" placeholder="Paste file URL..." class="w-full text-sm border rounded-lg px-3 py-2" onkeyup="if(event.key===&apos;Enter&apos;)addAttachment('+t.id+')"></div></div>' +
    // Comments
    '<div><label class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Comments ('+((t.comments||[]).length)+')</label>' +
    '<div class="space-y-3 mb-3">'+(t.comments||[]).map(cm => '<div class="flex gap-3'+(cm.is_internal?' bg-yellow-50 -mx-2 px-2 py-1 rounded-lg border border-yellow-200':'')+'"><div class="flex-shrink-0 mt-1">'+avatar(cm.author_name||'U','w-8 h-8 text-xs')+'</div><div class="flex-1"><div class="flex items-center gap-2"><span class="text-sm font-semibold">'+esc(cm.author_name)+'</span>'+(cm.is_internal?'<span class="text-xs bg-yellow-200 text-yellow-800 px-1.5 rounded">Internal</span>':'')+'<span class="text-xs text-gray-400">'+timeAgo(cm.created_at)+'</span></div><div class="text-sm text-gray-700 mt-1">'+esc(cm.content)+'</div></div></div>').join('')+'</div>' +
    '<div class="flex gap-2"><textarea id="newComment" placeholder="Write a comment..." class="flex-1 text-sm border rounded-lg px-3 py-2 min-h-[60px]"></textarea></div>' +
    '<div class="flex items-center gap-3 mt-2"><button onclick="addComment('+t.id+',false)" class="bg-indigo-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-indigo-700"><i class="fas fa-paper-plane mr-1"></i>Comment</button><button onclick="addComment('+t.id+',true)" class="text-sm text-gray-500 hover:text-gray-700 px-3 py-2 border rounded-lg"><i class="fas fa-lock mr-1"></i>Internal Note</button></div></div>' +
    // Activity log
    (t.activity?.length ? '<div class="mt-6 border-t pt-4"><label class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Activity Log</label><div class="space-y-2">'+(t.activity||[]).slice(0,10).map(a=>'<div class="text-xs text-gray-500"><i class="fas fa-'+activityIcon(a.action)+' text-gray-400 mr-2"></i>'+activityText(a)+' &middot; '+timeAgo(a.created_at)+'</div>').join('')+'</div></div>':'') +
    '</div></div></div>';
}

async function updateTaskField(id, field, value) {
  await API.put('/api/tasks/' + id, { [field]: value });
  if (field === 'status' || field === 'priority') { await loadTasks(); }
}

async function addAssignee(taskId, userId) {
  if (!userId) return;
  const current = S.selectedTask.assignments.filter(a => a.role === 'assignee');
  const assignees = [...current.map(a => ({user_id: a.user_id, role: 'assignee'})), {user_id: parseInt(userId), role: 'assignee'}];
  await API.put('/api/tasks/' + taskId, { assignees });
  await loadTaskDetail(taskId);
}

async function removeAssignee(taskId, userId) {
  const assignees = S.selectedTask.assignments.filter(a => !(a.user_id === userId && a.role === 'assignee')).map(a => ({user_id: a.user_id, role: a.role}));
  await API.put('/api/tasks/' + taskId, { assignees });
  await loadTaskDetail(taskId);
}

async function addSubtask(parentId) {
  const input = document.getElementById('newSubtask');
  if (!input.value.trim()) return;
  await API.post('/api/tasks', { title: input.value.trim(), parent_task_id: parentId, client_id: S.selectedTask.client_id, project_id: S.selectedTask.project_id });
  input.value = '';
  await loadTaskDetail(parentId);
}

async function addComment(taskId, isInternal) {
  const textarea = document.getElementById('newComment');
  if (!textarea.value.trim()) return;
  await API.post('/api/tasks/' + taskId + '/comments', { content: textarea.value.trim(), is_internal: isInternal ? 1 : 0 });
  textarea.value = '';
  await loadTaskDetail(taskId);
}

async function addAttachment(taskId) {
  const input = document.getElementById('attachUrl');
  if (!input.value.trim()) return;
  const url = input.value.trim();
  const filename = url.split('/').pop() || 'attachment';
  await API.post('/api/tasks/' + taskId + '/attachments', { filename, file_url: url });
  input.value = '';
  await loadTaskDetail(taskId);
}

async function deleteTask(id) {
  if (!confirm('Delete this task? This cannot be undone.')) return;
  await API.del('/api/tasks/' + id);
  S.showTaskModal = false;
  await loadTasks(); render();
}

async function cycleStatus() {
  const order = ['todo','in_progress','review','done'];
  const idx = order.indexOf(S.selectedTask.status);
  const next = order[(idx + 1) % order.length];
  await updateTaskField(S.selectedTask.id, 'status', next);
  S.selectedTask.status = next;
  render();
}

// ==================== NEW TASK MODAL ====================
function renderNewTaskModal() {
  return '<div class="fixed inset-0 z-50 modal-overlay flex items-start justify-center pt-8 md:pt-16 px-4" onclick="if(event.target===this){S.showNewTaskModal=false;render()}">' +
    '<div class="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden fade-in">' +
    '<div class="px-6 py-4 border-b bg-gray-50 flex items-center justify-between"><h3 class="font-bold text-gray-800"><i class="fas fa-plus-circle text-indigo-500 mr-2"></i>New Task</h3><button onclick="S.showNewTaskModal=false;render()" class="text-gray-400 hover:text-gray-700"><i class="fas fa-times"></i></button></div>' +
    '<form id="newTaskForm" class="p-6 space-y-4">' +
    '<div><label class="text-sm font-medium text-gray-700 mb-1 block">Title *</label><input type="text" id="nt_title" required class="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-200" placeholder="What needs to be done?"></div>' +
    '<div><label class="text-sm font-medium text-gray-700 mb-1 block">Description</label><textarea id="nt_desc" class="w-full border rounded-lg px-3 py-2 text-sm min-h-[60px]" placeholder="Add details..."></textarea></div>' +
    '<div class="grid grid-cols-2 gap-4">' +
    '<div><label class="text-sm font-medium text-gray-700 mb-1 block">Priority</label><select id="nt_priority" class="w-full text-sm border rounded-lg px-3 py-2"><option value="medium">Medium</option><option value="urgent">Urgent</option><option value="high">High</option><option value="low">Low</option></select></div>' +
    '<div><label class="text-sm font-medium text-gray-700 mb-1 block">Due Date</label><input type="datetime-local" id="nt_due" class="w-full text-sm border rounded-lg px-3 py-2"></div></div>' +
    '<div class="grid grid-cols-2 gap-4">' +
    '<div><label class="text-sm font-medium text-gray-700 mb-1 block">Client</label><select id="nt_client" class="w-full text-sm border rounded-lg px-3 py-2"><option value="">None</option>'+S.clients.map(c=>'<option value="'+c.id+'">'+esc(c.company_name)+'</option>').join('')+'</select></div>' +
    '<div><label class="text-sm font-medium text-gray-700 mb-1 block">Project</label><select id="nt_project" class="w-full text-sm border rounded-lg px-3 py-2"><option value="">None</option>'+S.projects.map(p=>'<option value="'+p.id+'">'+esc(p.name)+'</option>').join('')+'</select></div></div>' +
    '<div><label class="text-sm font-medium text-gray-700 mb-1 block">Assign To</label><select id="nt_assignee" class="w-full text-sm border rounded-lg px-3 py-2"><option value="">Unassigned</option>'+S.users.map(u=>'<option value="'+u.id+'">'+esc(u.name)+' ('+esc(u.department||u.role)+')</option>').join('')+'</select></div>' +
    '<div><label class="text-sm font-medium text-gray-700 mb-1 block">Tags</label><input type="text" id="nt_tags" class="w-full text-sm border rounded-lg px-3 py-2" placeholder="design, urgent, frontend (comma separated)"></div>' +
    '<div class="flex justify-end gap-3 pt-2"><button type="button" onclick="S.showNewTaskModal=false;render()" class="px-4 py-2 border rounded-lg text-sm text-gray-700 hover:bg-gray-50">Cancel</button><button type="submit" class="px-6 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700"><i class="fas fa-plus mr-1"></i>Create Task</button></div>' +
    '</form></div></div>';
}

// ==================== PROJECTS PAGE ====================
function renderProjectsPage() {
  return '<div class="flex justify-between items-center mb-4"><h2 class="text-lg font-bold">Projects</h2><button onclick="showProjectForm()" class="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-700"><i class="fas fa-plus mr-1"></i>New Project</button></div>' +
    '<div class="grid md:grid-cols-2 lg:grid-cols-3 gap-4">' +
    S.projects.map(p => {
      const pct = p.task_count > 0 ? Math.round((p.done_count / p.task_count) * 100) : 0;
      return '<div class="bg-white rounded-xl shadow-sm border border-gray-200 p-5 hover:shadow-md transition-shadow">' +
        '<div class="flex items-center gap-3 mb-3"><div class="w-3 h-3 rounded-full" style="background:'+esc(p.color||'#6366f1')+'"></div><h3 class="font-bold text-gray-800 flex-1 cursor-pointer" onclick="S.filters.project_id=&apos;'+p.id+'&apos;;navigate(&apos;tasks&apos;)">'+esc(p.name)+'</h3><span class="status-badge '+statusColor(p.status === 'active' ? 'in_progress' : p.status === 'completed' ? 'done' : 'todo')+'">'+esc(p.status)+'</span></div>' +
        (p.client_name ? '<div class="text-sm text-gray-500 mb-3"><i class="fas fa-building mr-1"></i>'+esc(p.client_name)+'</div>' : '') +
        (p.description ? '<p class="text-sm text-gray-600 mb-3 line-clamp-2">'+esc(p.description)+'</p>' : '') +
        '<div class="flex items-center gap-4 mb-3"><div class="flex-1"><div class="bg-gray-200 rounded-full h-2"><div class="bg-indigo-500 rounded-full h-2 transition-all" style="width:'+pct+'%"></div></div></div><span class="text-xs text-gray-500 font-medium">'+p.done_count+'/'+p.task_count+' tasks</span></div>' +
        '<div class="flex items-center gap-2 pt-2 border-t border-gray-100">' +
        '<button onclick="S.filters.project_id=&apos;'+p.id+'&apos;;navigate(&apos;tasks&apos;)" class="text-xs text-indigo-600 hover:text-indigo-800"><i class="fas fa-tasks mr-1"></i>View Tasks</button>' +
        '<button onclick="event.stopPropagation();showProjectForm(S.projects.find(x=>x.id==='+p.id+'))" class="text-xs text-gray-500 hover:text-gray-700 ml-auto"><i class="fas fa-edit mr-1"></i>Edit</button>' +
        '<button onclick="event.stopPropagation();deleteProject('+p.id+')" class="text-xs text-gray-400 hover:text-red-500"><i class="fas fa-trash mr-1"></i>Delete</button>' +
        '</div></div>';
    }).join('') +
    (S.projects.length === 0 ? '<div class="col-span-full bg-white rounded-xl border p-12 text-center"><i class="fas fa-project-diagram text-4xl text-gray-300 mb-3"></i><p class="text-gray-500">No projects yet</p></div>' : '') +
    '</div>';
}

function showProjectForm(project = null) {
  const title = project ? 'Edit Project' : 'New Project';
  const btnText = project ? 'Save Changes' : 'Create Project';
  const html = '<div class="fixed inset-0 z-50 modal-overlay flex items-center justify-center px-4" onclick="if(event.target===this)this.remove()"><div class="bg-white rounded-2xl shadow-2xl w-full max-w-md fade-in"><div class="px-6 py-4 border-b"><h3 class="font-bold">'+title+'</h3></div><form class="p-6 space-y-4" onsubmit="event.preventDefault();saveProject('+(project?project.id:'null')+',this)">' +
    '<input type="text" name="name" value="'+esc(project?.name||'')+'" required class="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Project name">' +
    '<textarea name="description" class="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Description">'+esc(project?.description||'')+'</textarea>' +
    '<select name="client_id" class="w-full text-sm border rounded-lg px-3 py-2"><option value="">No client</option>'+S.clients.map(c=>'<option value="'+c.id+'"'+(project?.client_id==c.id?' selected':'')+'>'+esc(c.company_name)+'</option>').join('')+'</select>' +
    (project ? '<select name="status" class="w-full text-sm border rounded-lg px-3 py-2"><option value="active"'+(project.status==='active'?' selected':'')+'>Active</option><option value="on_hold"'+(project.status==='on_hold'?' selected':'')+'>On Hold</option><option value="completed"'+(project.status==='completed'?' selected':'')+'>Completed</option><option value="cancelled"'+(project.status==='cancelled'?' selected':'')+'>Cancelled</option></select>' : '') +
    '<div class="flex items-center gap-3"><label class="text-sm text-gray-600">Color:</label><input type="color" name="color" value="'+(project?.color||'#6366f1')+'" class="w-12 h-10 border rounded cursor-pointer"></div>' +
    '<div class="flex justify-end gap-3"><button type="button" onclick="this.closest(&apos;.modal-overlay&apos;).remove()" class="px-4 py-2 border rounded-lg text-sm">Cancel</button><button type="submit" class="px-6 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold">'+btnText+'</button></div></form></div></div>';
  document.body.insertAdjacentHTML('beforeend', html);
}

async function saveProject(id, form) {
  const fd = new FormData(form);
  const data = { name: fd.get('name'), description: fd.get('description'), client_id: fd.get('client_id') || null, color: fd.get('color') };
  if (fd.get('status')) data.status = fd.get('status');
  if (id) await API.put('/api/projects/' + id, data); else await API.post('/api/projects', data);
  form.closest('.modal-overlay').remove();
  await loadProjects(); render();
}

// ==================== CLIENTS PAGE ====================
function renderClientsPage() {
  return '<div class="flex justify-between items-center mb-4"><h2 class="text-lg font-bold">Clients</h2><button onclick="showClientForm()" class="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-700"><i class="fas fa-plus mr-1"></i>New Client</button></div>' +
    '<div class="grid md:grid-cols-2 lg:grid-cols-3 gap-4">' +
    S.clients.map(cl => 
      '<div class="bg-white rounded-xl shadow-sm border border-gray-200 p-5 hover:shadow-md transition-shadow">' +
      '<div class="flex items-center gap-3 mb-3"><div class="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold" style="background:'+esc(cl.color||'#6366f1')+'">'+esc((cl.company_name||'C').charAt(0))+'</div><div><h3 class="font-bold text-gray-800">'+esc(cl.company_name)+'</h3><div class="text-sm text-gray-500">'+esc(cl.contact_name)+'</div></div></div>' +
      '<div class="space-y-1 text-sm text-gray-600 mb-3"><div><i class="fas fa-envelope w-5 text-gray-400"></i>'+esc(cl.email)+'</div>'+(cl.phone?'<div><i class="fas fa-phone w-5 text-gray-400"></i>'+esc(cl.phone)+'</div>':'')+'</div>' +
      '<div class="flex items-center gap-4 text-xs"><span class="bg-indigo-50 text-indigo-700 px-2 py-1 rounded-full">'+cl.project_count+' projects</span><span class="bg-amber-50 text-amber-700 px-2 py-1 rounded-full">'+cl.open_task_count+' open tasks</span>' +
      '<span class="ml-auto '+(cl.portal_access?'text-green-500':'text-gray-400')+'" title="Portal access"><i class="fas fa-'+(cl.portal_access?'check-circle':'times-circle')+'"></i></span>' +
      '</div>' +
      '<div class="mt-3 flex gap-2 pt-2 border-t border-gray-100"><button onclick="S.filters.client_id=&apos;'+cl.id+'&apos;;navigate(&apos;tasks&apos;)" class="text-xs text-indigo-600 hover:text-indigo-800"><i class="fas fa-tasks mr-1"></i>View Tasks</button><button onclick="showClientForm('+cl.id+')" class="text-xs text-gray-500 hover:text-gray-700 ml-auto"><i class="fas fa-edit mr-1"></i>Edit</button><button onclick="deleteClient('+cl.id+')" class="text-xs text-gray-400 hover:text-red-500"><i class="fas fa-trash mr-1"></i>Delete</button></div></div>'
    ).join('') +
    (S.clients.length === 0 ? '<div class="col-span-full bg-white rounded-xl border p-12 text-center"><i class="fas fa-building text-4xl text-gray-300 mb-3"></i><p class="text-gray-500">No clients yet</p></div>' : '') +
    '</div>';
}

function showClientForm(clientId = null) {
  const cl = clientId ? S.clients.find(c => c.id === clientId) : null;
  const title = cl ? 'Edit Client' : 'New Client';
  const html = '<div class="fixed inset-0 z-50 modal-overlay flex items-center justify-center px-4" onclick="if(event.target===this)this.remove()"><div class="bg-white rounded-2xl shadow-2xl w-full max-w-md fade-in"><div class="px-6 py-4 border-b"><h3 class="font-bold">'+title+'</h3></div><form class="p-6 space-y-3" onsubmit="event.preventDefault();saveClient('+(cl?cl.id:'null')+',this)">' +
    '<input type="text" name="company_name" value="'+esc(cl?.company_name||'')+'" required class="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Company name">' +
    '<input type="text" name="contact_name" value="'+esc(cl?.contact_name||'')+'" required class="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Contact name">' +
    '<input type="email" name="email" value="'+esc(cl?.email||'')+'" required class="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Email">' +
    '<input type="tel" name="phone" value="'+esc(cl?.phone||'')+'" class="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Phone">' +
    '<input type="text" name="password" value="" class="w-full border rounded-lg px-3 py-2 text-sm" placeholder="'+(cl?'New password (leave blank to keep)':'Portal password')+'">' +
    '<input type="color" name="color" value="'+(cl?.color||'#6366f1')+'" class="w-12 h-10 border rounded cursor-pointer">' +
    '<div class="flex justify-end gap-3"><button type="button" onclick="this.closest(&apos;.modal-overlay&apos;).remove()" class="px-4 py-2 border rounded-lg text-sm">Cancel</button><button type="submit" class="px-6 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold">Save</button></div></form></div></div>';
  document.body.insertAdjacentHTML('beforeend', html);
}

async function saveClient(id, form) {
  const fd = new FormData(form);
  const data = { company_name: fd.get('company_name'), contact_name: fd.get('contact_name'), email: fd.get('email'), phone: fd.get('phone'), color: fd.get('color') };
  if (fd.get('password')) data.password = fd.get('password');
  if (id) await API.put('/api/clients/' + id, data); else await API.post('/api/clients', data);
  form.closest('.modal-overlay').remove();
  await loadClients(); render();
}

// ==================== TEAM PAGE ====================
function renderTeamPage() {
  return '<div class="flex justify-between items-center mb-4"><h2 class="text-lg font-bold">Team Members</h2><button onclick="showUserForm()" class="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-700"><i class="fas fa-plus mr-1"></i>Add Member</button></div>' +
    '<div class="grid md:grid-cols-2 lg:grid-cols-3 gap-4">' +
    S.users.map(u =>
      '<div class="bg-white rounded-xl shadow-sm border border-gray-200 p-5">' +
      '<div class="flex items-center gap-3 mb-3">'+avatar(u.name, 'w-12 h-12 text-lg')+'<div><h3 class="font-bold text-gray-800">'+esc(u.name)+'</h3><div class="text-sm text-gray-500">'+esc(u.email)+'</div></div></div>' +
      '<div class="flex items-center gap-2 mb-3"><span class="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded-full capitalize">'+esc(u.role)+'</span>'+(u.department?'<span class="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">'+esc(u.department)+'</span>':'')+'</div>' +
      '<div class="flex items-center gap-4 text-sm"><span class="text-gray-600"><i class="fas fa-tasks text-gray-400 mr-1"></i>'+u.open_tasks+' open tasks</span></div>' +
      '<div class="flex items-center gap-2 mt-3 pt-2 border-t border-gray-100">' +
      '<button onclick="S.filters.assigned_to=&apos;'+u.id+'&apos;;navigate(&apos;tasks&apos;)" class="text-xs text-indigo-600 hover:text-indigo-800"><i class="fas fa-eye mr-1"></i>View Tasks</button>' +
      '<button onclick="showUserForm(S.users.find(x=>x.id==='+u.id+'))" class="text-xs text-gray-500 hover:text-gray-700 ml-auto"><i class="fas fa-edit mr-1"></i>Edit</button>' +
      '<button onclick="deleteUser('+u.id+')" class="text-xs text-gray-400 hover:text-red-500"><i class="fas fa-trash mr-1"></i>Delete</button>' +
      '</div></div>'
    ).join('') + '</div>';
}

function showUserForm(user = null) {
  const title = user ? 'Edit Team Member' : 'Add Team Member';
  const btnText = user ? 'Save Changes' : 'Add Member';
  const html = '<div class="fixed inset-0 z-50 modal-overlay flex items-center justify-center px-4" onclick="if(event.target===this)this.remove()"><div class="bg-white rounded-2xl shadow-2xl w-full max-w-md fade-in"><div class="px-6 py-4 border-b"><h3 class="font-bold">'+title+'</h3></div><form class="p-6 space-y-3" onsubmit="event.preventDefault();saveUser('+(user?user.id:'null')+',this)">' +
    '<input type="text" name="name" value="'+esc(user?.name||'')+'" required class="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Full name">' +
    '<input type="email" name="email" value="'+esc(user?.email||'')+'" required class="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Email">' +
    '<select name="role" class="w-full text-sm border rounded-lg px-3 py-2"><option value="employee"'+(user?.role==='employee'?' selected':'')+'>Employee</option><option value="manager"'+(user?.role==='manager'?' selected':'')+'>Manager</option><option value="admin"'+(user?.role==='admin'?' selected':'')+'>Admin</option></select>' +
    '<input type="text" name="department" value="'+esc(user?.department||'')+'" class="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Department">' +
    '<input type="tel" name="phone" value="'+esc(user?.phone||'')+'" class="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Phone">' +
    '<input type="text" name="password" value="'+(user?'':'changeme123')+'" class="w-full border rounded-lg px-3 py-2 text-sm" placeholder="'+(user?'New password (leave blank to keep)':'Password')+'">' +
    '<div class="flex justify-end gap-3"><button type="button" onclick="this.closest(&apos;.modal-overlay&apos;).remove()" class="px-4 py-2 border rounded-lg text-sm">Cancel</button><button type="submit" class="px-6 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold">'+btnText+'</button></div></form></div></div>';
  document.body.insertAdjacentHTML('beforeend', html);
}

async function saveUser(id, form) {
  const fd = new FormData(form);
  const data = { name: fd.get('name'), email: fd.get('email'), role: fd.get('role'), department: fd.get('department'), phone: fd.get('phone') };
  if (fd.get('password')) data.password = fd.get('password');
  if (id) await API.put('/api/users/' + id, data); else await API.post('/api/users', data);
  form.closest('.modal-overlay').remove();
  await loadUsers(); render();
}

async function deleteUser(id) {
  if (!confirm('Delete this team member? Their task assignments will also be removed.')) return;
  await API.del('/api/users/' + id);
  await loadUsers(); render();
}

async function deleteClient(id) {
  if (!confirm('Delete this client? Tasks and projects will be unlinked from this client.')) return;
  await API.del('/api/clients/' + id);
  await loadClients(); render();
}

async function deleteProject(id) {
  if (!confirm('Delete this project? Tasks will remain but be unlinked from this project.')) return;
  await API.del('/api/projects/' + id);
  await loadProjects(); render();
}

// ==================== PROCESSES PAGE ====================
function renderProcessesPage() {
  return '<div class="flex justify-between items-center mb-4"><h2 class="text-lg font-bold">Process Templates</h2><button onclick="showProcessForm()" class="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-700"><i class="fas fa-plus mr-1"></i>New Process</button></div>' +
    '<div class="grid md:grid-cols-2 gap-4">' +
    S.processes.map(p =>
      '<div class="bg-white rounded-xl shadow-sm border border-gray-200 p-5">' +
      '<div class="flex items-center justify-between mb-3"><h3 class="font-bold text-gray-800"><i class="fas fa-sitemap text-indigo-500 mr-2"></i>'+esc(p.name)+'</h3><div class="flex gap-2"><button onclick="applyProcess('+p.id+')" class="text-xs bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full hover:bg-indigo-200"><i class="fas fa-play mr-1"></i>Apply</button><button onclick="showProcessForm(S.processes.find(x=>x.id==='+p.id+'))" class="text-xs text-gray-400 hover:text-gray-700"><i class="fas fa-edit"></i></button><button onclick="deleteProcess('+p.id+')" class="text-xs text-gray-400 hover:text-red-500"><i class="fas fa-trash"></i></button></div></div>' +
      (p.description ? '<p class="text-sm text-gray-600 mb-3">'+esc(p.description)+'</p>' : '') +
      '<div class="space-y-2">'+(p.steps||[]).map((s,i) => '<div class="flex items-center gap-3"><div class="w-6 h-6 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center text-xs font-bold">'+(i+1)+'</div><div class="text-sm"><span class="font-medium">'+esc(s.title)+'</span>'+(s.description?'<span class="text-gray-400 ml-1">- '+esc(s.description)+'</span>':'')+'</div></div>').join('')+'</div></div>'
    ).join('') +
    (S.processes.length === 0 ? '<div class="col-span-full bg-white rounded-xl border p-12 text-center"><i class="fas fa-sitemap text-4xl text-gray-300 mb-3"></i><p class="text-gray-500">No process templates yet</p><p class="text-xs text-gray-400 mt-1">Create reusable task workflows</p></div>' : '') +
    '</div>';
}

function showProcessForm(process = null) {
  const title = process ? 'Edit Process Template' : 'New Process Template';
  const btnText = process ? 'Save Changes' : 'Create';
  const html = '<div class="fixed inset-0 z-50 modal-overlay flex items-center justify-center px-4" onclick="if(event.target===this)this.remove()"><div class="bg-white rounded-2xl shadow-2xl w-full max-w-lg fade-in max-h-[80vh] overflow-y-auto"><div class="px-6 py-4 border-b sticky top-0 bg-white z-10"><h3 class="font-bold">'+title+'</h3></div><form class="p-6 space-y-4" onsubmit="event.preventDefault();saveProcess('+(process?process.id:'null')+',this)">' +
    '<input type="text" name="name" value="'+esc(process?.name||'')+'" required class="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Process name">' +
    '<textarea name="description" class="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Description">'+esc(process?.description||'')+'</textarea>' +
    '<div><label class="text-sm font-medium mb-2 block">Steps</label><div id="processSteps" class="space-y-2"></div><button type="button" onclick="addProcessStep()" class="mt-2 text-sm text-indigo-600 hover:text-indigo-800"><i class="fas fa-plus mr-1"></i>Add Step</button></div>' +
    '<div class="flex justify-end gap-3"><button type="button" onclick="this.closest(&apos;.modal-overlay&apos;).remove()" class="px-4 py-2 border rounded-lg text-sm">Cancel</button><button type="submit" class="px-6 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold">'+btnText+'</button></div></form></div></div>';
  document.body.insertAdjacentHTML('beforeend', html);
  if (process && process.steps && process.steps.length > 0) {
    process.steps.forEach(function(s) { addProcessStep(s.title, s.description); });
  } else {
    addProcessStep();
  }
}

function addProcessStep(title, desc) {
  const container = document.getElementById('processSteps');
  const idx = container.children.length + 1;
  container.insertAdjacentHTML('beforeend', '<div class="flex gap-2 items-start"><span class="w-6 h-6 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center text-xs font-bold mt-2 flex-shrink-0">'+idx+'</span><div class="flex-1"><input type="text" name="step_title_'+idx+'" value="'+esc(title||'')+'" required class="w-full border rounded-lg px-3 py-2 text-sm mb-1" placeholder="Step title"><input type="text" name="step_desc_'+idx+'" value="'+esc(desc||'')+'" class="w-full border rounded-lg px-3 py-1.5 text-xs" placeholder="Description (optional)"></div><button type="button" onclick="this.parentElement.remove()" class="text-gray-400 hover:text-red-500 mt-2 flex-shrink-0"><i class="fas fa-times"></i></button></div>');
}

async function saveProcess(id, form) {
  const fd = new FormData(form);
  const steps = [];
  let i = 1;
  while (fd.get('step_title_' + i)) {
    steps.push({ step: i, title: fd.get('step_title_' + i), description: fd.get('step_desc_' + i) || '' });
    i++;
  }
  const data = { name: fd.get('name'), description: fd.get('description'), steps };
  if (id) await API.put('/api/processes/' + id, data); else await API.post('/api/processes', data);
  form.closest('.modal-overlay').remove();
  await loadProcesses(); render();
}

async function applyProcess(processId) {
  const html = '<div class="fixed inset-0 z-50 modal-overlay flex items-center justify-center px-4" onclick="if(event.target===this)this.remove()"><div class="bg-white rounded-2xl shadow-2xl w-full max-w-md fade-in"><div class="px-6 py-4 border-b"><h3 class="font-bold">Apply Process Template</h3></div><form class="p-6 space-y-4" onsubmit="event.preventDefault();doApplyProcess('+processId+',this)">' +
    '<select name="project_id" class="w-full text-sm border rounded-lg px-3 py-2"><option value="">Select Project</option>'+S.projects.map(p=>'<option value="'+p.id+'">'+esc(p.name)+'</option>').join('')+'</select>' +
    '<select name="client_id" class="w-full text-sm border rounded-lg px-3 py-2"><option value="">Select Client</option>'+S.clients.map(c=>'<option value="'+c.id+'">'+esc(c.company_name)+'</option>').join('')+'</select>' +
    '<div><label class="text-sm font-medium mb-1 block">Base Due Date</label><input type="date" name="base_due_date" class="w-full text-sm border rounded-lg px-3 py-2"></div>' +
    '<div class="flex justify-end gap-3"><button type="button" onclick="this.closest(&apos;.modal-overlay&apos;).remove()" class="px-4 py-2 border rounded-lg text-sm">Cancel</button><button type="submit" class="px-6 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold">Create Tasks</button></div></form></div></div>';
  document.body.insertAdjacentHTML('beforeend', html);
}

async function doApplyProcess(processId, form) {
  const fd = new FormData(form);
  await API.post('/api/processes/' + processId + '/apply', { project_id: fd.get('project_id') || null, client_id: fd.get('client_id') || null, base_due_date: fd.get('base_due_date') || null });
  form.closest('.modal-overlay').remove();
  await loadTasks(); navigate('tasks');
}

async function deleteProcess(id) {
  if (!confirm('Delete this process template?')) return;
  await API.del('/api/processes/' + id);
  await loadProcesses(); render();
}

// ==================== NOTIFICATIONS PAGE ====================
function renderNotificationsPage() {
  return '<div class="flex justify-between items-center mb-4"><h2 class="text-lg font-bold">Notifications</h2>'+(S.unreadCount>0?'<button onclick="markAllRead()" class="text-sm text-indigo-600 hover:text-indigo-800"><i class="fas fa-check-double mr-1"></i>Mark all read</button>':'')+'</div>' +
    '<div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">' +
    (S.notifications.length === 0 ? '<div class="p-12 text-center"><i class="fas fa-bell-slash text-4xl text-gray-300 mb-3"></i><p class="text-gray-500">No notifications</p></div>' :
    S.notifications.map(n => '<div class="flex items-start gap-3 p-4 border-b border-gray-100 hover:bg-gray-50 '+(n.is_read?'opacity-60':'cursor-pointer')+'" onclick="markRead('+n.id+','+(n.task_id||'null')+')">' +
      '<div class="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 '+(n.is_read?'bg-gray-100':'bg-indigo-100')+'"><i class="fas fa-'+notifIcon(n.type)+' text-sm '+(n.is_read?'text-gray-400':'text-indigo-500')+'"></i></div>' +
      '<div class="flex-1 min-w-0"><div class="text-sm font-medium '+(n.is_read?'text-gray-500':'text-gray-800')+'">'+esc(n.title)+'</div><div class="text-sm text-gray-500">'+esc(n.message)+'</div>' +
      (n.task_title?'<div class="text-xs text-indigo-600 mt-1">'+esc(n.task_title)+'</div>':'') +
      '<div class="text-xs text-gray-400 mt-1">'+timeAgo(n.created_at)+'</div></div>' +
      (!n.is_read?'<div class="w-2 h-2 bg-indigo-500 rounded-full pulse-dot mt-2 flex-shrink-0"></div>':'') +
      '</div>').join('')) +
    '</div>';
}

function notifIcon(t) { return {task_assigned:'user-plus',due_soon:'clock',overdue:'exclamation-triangle',comment_added:'comment',status_changed:'exchange-alt',task_created:'plus-circle'}[t]||'bell'; }

async function markRead(id, taskId) {
  await API.put('/api/notifications/read', { ids: [id] });
  await loadNotifications();
  if (taskId) loadTaskDetail(taskId); else render();
}

async function markAllRead() {
  await API.put('/api/notifications/read', {});
  await loadNotifications(); render();
}

// ==================== SETTINGS PAGE ====================
function renderSettingsPage() {
  return '<div class="max-w-2xl"><h2 class="text-lg font-bold mb-4">Settings</h2>' +
    '<div class="bg-white rounded-xl shadow-sm border p-6 mb-4"><h3 class="font-bold mb-3"><i class="fas fa-user text-indigo-500 mr-2"></i>Your Profile</h3>' +
    '<div class="space-y-3"><div class="flex items-center gap-3">'+avatar(S.user?.name||'U','w-16 h-16 text-2xl')+'<div><div class="font-bold">'+esc(S.user?.name)+'</div><div class="text-sm text-gray-500">'+esc(S.user?.email)+'</div><div class="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full capitalize inline-block mt-1">'+esc(S.user?.role)+'</div></div></div></div></div>' +
    '<div class="bg-white rounded-xl shadow-sm border p-6 mb-4"><h3 class="font-bold mb-3"><i class="fas fa-calendar text-indigo-500 mr-2"></i>Apple Reminders / Calendar Sync</h3>' +
    '<p class="text-sm text-gray-600 mb-3">Subscribe to your task calendar in Apple Calendar or Reminders to get automatic due date alerts on your iPhone.</p>' +
    '<button onclick="generateCalendarLink()" class="bg-indigo-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-indigo-700"><i class="fas fa-link mr-1"></i>Generate Calendar URL</button>' +
    '<div id="calendarLink" class="mt-3 hidden"><div class="bg-gray-50 border rounded-lg p-3"><code id="calUrl" class="text-xs break-all text-indigo-600"></code></div><p class="text-xs text-gray-500 mt-2"><strong>How to use:</strong> Copy this URL, then on your iPhone go to Settings > Calendar > Accounts > Add Account > Other > Add Subscribed Calendar, and paste this URL.</p></div></div>' +
    '<div class="bg-white rounded-xl shadow-sm border p-6"><h3 class="font-bold mb-3"><i class="fas fa-sign-out-alt text-red-500 mr-2"></i>Account</h3>' +
    '<button onclick="logout()" class="bg-red-50 text-red-600 text-sm px-4 py-2 rounded-lg hover:bg-red-100 border border-red-200"><i class="fas fa-sign-out-alt mr-1"></i>Sign Out</button></div></div>';
}

async function generateCalendarLink() {
  const data = await API.get('/cal/generate-token');
  if (data?.calendar_token) {
    const url = window.location.origin + '/cal/feed/' + data.calendar_token;
    document.getElementById('calUrl').textContent = url;
    document.getElementById('calendarLink').classList.remove('hidden');
  }
}

// ==================== GMAIL SETUP PAGE ====================
function renderGmailSetupPage() {
  return '<div class="max-w-2xl"><h2 class="text-lg font-bold mb-4"><i class="fab fa-google text-red-500 mr-2"></i>Gmail Quick-Add Setup</h2>' +
    '<div class="bg-white rounded-xl shadow-sm border p-6 mb-4"><h3 class="font-bold mb-3">How It Works</h3>' +
    '<div class="space-y-3 text-sm text-gray-600">' +
    '<div class="flex gap-3"><div class="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center flex-shrink-0"><span class="text-red-600 font-bold">1</span></div><div><strong>Generate your API key</strong> below to authenticate email-to-task requests.</div></div>' +
    '<div class="flex gap-3"><div class="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center flex-shrink-0"><span class="text-red-600 font-bold">2</span></div><div><strong>Install the bookmarklet</strong> - drag it to your bookmarks bar. When viewing a Gmail email, click the bookmarklet to instantly create a task from that email.</div></div>' +
    '<div class="flex gap-3"><div class="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center flex-shrink-0"><span class="text-red-600 font-bold">3</span></div><div><strong>Or use the API directly</strong> - integrate with Zapier, Google Apps Script, or any automation tool to automatically create tasks from emails.</div></div></div></div>' +
    // API Key section
    '<div class="bg-white rounded-xl shadow-sm border p-6 mb-4"><h3 class="font-bold mb-3"><i class="fas fa-key text-amber-500 mr-2"></i>Your API Key</h3>' +
    '<div id="apiKeySection"><button onclick="generateApiKey()" class="bg-indigo-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-indigo-700"><i class="fas fa-sync mr-1"></i>Generate New API Key</button><div id="apiKeyDisplay" class="mt-3 hidden"><div class="bg-gray-50 border rounded-lg p-3"><code id="apiKeyValue" class="text-sm text-indigo-600 break-all"></code></div><p class="text-xs text-red-500 mt-1"><i class="fas fa-exclamation-triangle mr-1"></i>Save this key! It won&apos;t be shown again.</p></div></div></div>' +
    // Bookmarklet
    '<div class="bg-white rounded-xl shadow-sm border p-6 mb-4"><h3 class="font-bold mb-3"><i class="fas fa-bookmark text-blue-500 mr-2"></i>Gmail Bookmarklet</h3>' +
    '<p class="text-sm text-gray-600 mb-3">Drag this button to your bookmarks bar, then click it while viewing a Gmail email:</p>' +
    '<div class="bg-gray-100 rounded-lg p-4 text-center"><a id="bookmarklet" href="#" class="inline-block bg-red-500 text-white px-6 py-3 rounded-lg font-bold text-sm hover:bg-red-600 cursor-move no-underline"><i class="fab fa-google mr-2"></i>Add to FlexBiz</a><p class="text-xs text-gray-500 mt-2">Drag me to your bookmarks bar</p></div></div>' +
    // API docs
    '<div class="bg-white rounded-xl shadow-sm border p-6"><h3 class="font-bold mb-3"><i class="fas fa-code text-green-500 mr-2"></i>API Endpoint</h3>' +
    '<div class="bg-gray-900 rounded-lg p-4 text-sm font-mono text-green-400 overflow-x-auto"><pre id="apiEndpointPre"></pre></div>' +
    '<div class="mt-4"><h4 class="font-semibold text-sm mb-2">Google Apps Script Example:</h4>' +
    '<div class="bg-gray-900 rounded-lg p-4 text-sm font-mono text-blue-400 overflow-x-auto"><pre id="gasExamplePre"></pre></div></div></div></div>';
}

async function generateApiKey() {
  const data = await API.post('/api/email-integration/generate-key');
  if (data?.api_key) {
    document.getElementById('apiKeyValue').textContent = data.api_key;
    document.getElementById('apiKeyDisplay').classList.remove('hidden');
    // Update bookmarklet
    const baseUrl = window.location.origin;
    const bmCode = "javascript:void((function(){var s=document.querySelector('h2.hP');var b=document.querySelector('.a3s');if(!s){alert('Open a Gmail email first!');return;}var t=s?s.innerText:'';var d=b?b.innerText.substring(0,500):'';fetch('"+baseUrl+"/api/tasks/email-add',{method:'POST',headers:{'X-API-Key':'"+data.api_key+"','Content-Type':'application/json'},body:JSON.stringify({subject:t,body:d,from:''})}).then(r=>r.json()).then(d=>{alert('Task created: '+t)}).catch(e=>alert('Error: '+e))})())";
    document.getElementById('bookmarklet').href = bmCode;
  }
}

// ==================== EVENT BINDINGS ====================
function bindEvents() {
  // Populate code blocks on Gmail setup page
  var apiPre = document.getElementById('apiEndpointPre');
  if (apiPre) {
    apiPre.textContent = 'POST ' + window.location.origin + '/api/tasks/email-add\\n\\nHeaders:\\n  X-API-Key: your_api_key_here\\n  Content-Type: application/json\\n\\nBody:\\n{\\n  "subject": "Email subject -> task title",\\n  "body": "Email body -> task description",\\n  "from": "sender@email.com",\\n  "client_id": 1,  // optional\\n  "project_id": 1  // optional\\n}';
  }
  var gasPre = document.getElementById('gasExamplePre');
  if (gasPre) {
    gasPre.textContent = 'function createTaskFromEmail() {\\n  const thread = GmailApp.getInboxThreads(0,1)[0];\\n  const msg = thread.getMessages()[0];\\n  UrlFetchApp.fetch("' + window.location.origin + '/api/tasks/email-add", {\\n    method: "POST",\\n    headers: {\\n      "X-API-Key": "YOUR_KEY",\\n      "Content-Type": "application/json"\\n    },\\n    payload: JSON.stringify({\\n      subject: msg.getSubject(),\\n      body: msg.getPlainBody().substring(0, 500),\\n      from: msg.getFrom()\\n    })\\n  });\\n}';
  }

  const form = document.getElementById('newTaskForm');
  if (form) {
    form.onsubmit = async (e) => {
      e.preventDefault();
      const assigneeId = document.getElementById('nt_assignee').value;
      const tagsStr = document.getElementById('nt_tags').value;
      const tags = tagsStr ? tagsStr.split(',').map(t => t.trim()).filter(Boolean) : [];
      
      await API.post('/api/tasks', {
        title: document.getElementById('nt_title').value,
        description: document.getElementById('nt_desc').value,
        priority: document.getElementById('nt_priority').value,
        due_date: document.getElementById('nt_due').value || null,
        client_id: document.getElementById('nt_client').value || null,
        project_id: document.getElementById('nt_project').value || null,
        tags,
        assignees: assigneeId ? [{ user_id: parseInt(assigneeId), role: 'assignee' }] : [],
      });
      S.showNewTaskModal = false;
      await loadTasks(); render();
    };
  }
}

function logout() {
  API.post('/auth/logout');
  localStorage.removeItem('flexbiz_token');
  localStorage.removeItem('flexbiz_user');
  window.location.href = '/login';
}

function toggleMobileSidebar() {
  // Simple toggle for mobile
  const el = document.querySelector('.sidebar-desktop');
  if (el) el.classList.toggle('sidebar-desktop');
}

// Boot
init();
</script>
</body>
</html>`
}
