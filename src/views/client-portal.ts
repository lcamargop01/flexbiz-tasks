export function renderClientPortal(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="icon" type="image/svg+xml" href="/favicon.svg">
  <title>FlexBiz Solutions - Client Portal</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script>tailwind.config={theme:{extend:{colors:{primary:'#0ea5e9',sidebar:'#0c4a6e'}}}}</script>
  <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
  <style>
    * { scrollbar-width: thin; scrollbar-color: #bae6fd #f0f9ff; -webkit-tap-highlight-color: transparent; }
    ::-webkit-scrollbar { width: 6px; height: 6px; }
    ::-webkit-scrollbar-track { background: #f0f9ff; }
    ::-webkit-scrollbar-thumb { background: #7dd3fc; border-radius: 3px; }
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
    .fade-in { animation: fadeIn 0.2s ease-in; }
    @keyframes fadeIn { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
    @keyframes slideUp { from{transform:translateY(100%)} to{transform:translateY(0)} }
    .slide-up { animation: slideUp 0.3s cubic-bezier(.4,0,.2,1); }
    .company-chip { font-size: 10px; padding: 2px 8px; border-radius: 6px; font-weight: 600; }
    .notification-badge { min-width: 18px; height: 18px; font-size: 10px; }
    .tag-chip { font-size: 10px; padding: 1px 6px; border-radius: 4px; }
    /* Sidebar */
    .sidebar-desktop { transform: translateX(0); transition: transform 0.25s ease; }
    .mobile-overlay { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.4); z-index: 29; }
    /* Mobile bottom nav */
    .mobile-bottom-nav { display: none; }
    @media (max-width: 768px) {
      .sidebar-desktop { transform: translateX(-100%); }
      .sidebar-desktop.open { transform: translateX(0); }
      .sidebar-desktop.open + .mobile-overlay { display: block; }
      .main-content { margin-left: 0 !important; padding-top: 56px; }
      select, input[type="text"], input[type="email"], input[type="password"],
      input[type="number"], input[type="datetime-local"], textarea, button {
        min-height: 44px; font-size: 16px !important;
      }
      .sidebar-link { padding: 12px 16px !important; }
      .status-badge { font-size: 12px; padding: 4px 10px; }
      .modal-overlay > div { max-width: 100% !important; max-height: 100vh !important; border-radius: 0 !important; height: 100vh; margin: 0 !important; }
      .modal-overlay { padding: 0 !important; align-items: stretch !important; padding-top: 0 !important; }
      .task-row { padding: 12px 16px !important; }
      /* Bottom nav */
      .mobile-bottom-nav { display: flex; position: fixed; bottom: 0; left: 0; right: 0; background: white; border-top: 1px solid #e5e7eb; z-index: 25; padding: 4px 0; padding-bottom: max(4px, env(safe-area-inset-bottom)); }
      .mobile-bottom-nav button { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 6px 0; font-size: 10px; color: #6b7280; border: none; background: none; position: relative; }
      .mobile-bottom-nav button.active { color: #0ea5e9; }
      .mobile-bottom-nav button .nav-icon { font-size: 18px; }
      .mobile-bottom-nav button .nav-badge { position: absolute; top: 2px; right: 50%; transform: translateX(14px); background: #ef4444; color: white; font-size: 9px; min-width: 16px; height: 16px; border-radius: 8px; display: flex; align-items: center; justify-content: center; }
      body { padding-bottom: env(safe-area-inset-bottom); }
    }
    @media (max-width: 480px) {
      select { font-size: 14px !important; }
    }
  </style>
</head>
<body class="bg-gray-50 text-gray-800">
<div id="app"></div>
<script>
// ==================== STATE ====================
const CS = {
  client: null, token: null, tasks: [], projects: [], notifications: [], unreadCount: 0,
  dashboard: null, selectedTask: null, showTaskModal: false, showNewTask: false,
  showQuickAdd: false, quickAddResult: null, quickAddLoading: false,
  filters: { status: '', project_id: '', company_id: '' },
  currentPage: 'dashboard', sidebarOpen: false, loading: true,
  linkedCompanies: [], allClientIds: [], hasMultiCompany: false,
  sort: 'due_date', hideDone: true, showFilters: false
};

// ==================== API ====================
const API = {
  token() { return localStorage.getItem('flexbiz_client_token'); },
  async fetch(url, opts = {}) {
    const t = this.token(); if (!t) { window.location.href = '/client/login'; return null; }
    const res = await fetch(url, { ...opts, headers: { 'Content-Type':'application/json', 'Authorization':'Bearer '+t, ...opts.headers }, body: opts.body ? JSON.stringify(opts.body) : undefined });
    if (res.status === 401) { localStorage.removeItem('flexbiz_client_token'); window.location.href = '/client/login'; return null; }
    return res.json();
  },
  get(u) { return this.fetch(u); },
  post(u, b) { return this.fetch(u, { method:'POST', body: b }); },
  put(u, b) { return this.fetch(u, { method:'PUT', body: b }); },
};

// ==================== HELPERS ====================
function esc(s) { if(!s)return''; const d=document.createElement('div'); d.textContent=s; return d.innerHTML; }
function timeAgo(d) { if(!d)return''; const s=Math.floor((Date.now()-new Date(d).getTime())/1000); if(s<60)return'just now'; if(s<3600)return Math.floor(s/60)+'m ago'; if(s<86400)return Math.floor(s/3600)+'h ago'; if(s<604800)return Math.floor(s/86400)+'d ago'; return new Date(d).toLocaleDateString(); }
function statusColor(s) { return {todo:'bg-gray-100 text-gray-700',in_progress:'bg-blue-100 text-blue-700',review:'bg-purple-100 text-purple-700',blocked:'bg-red-100 text-red-700',done:'bg-green-100 text-green-700',cancelled:'bg-gray-200 text-gray-500'}[s]||'bg-gray-100 text-gray-700'; }
function priorityIcon(p) { return {urgent:'<i class="fas fa-fire text-red-500"></i>',high:'<i class="fas fa-arrow-up text-orange-500"></i>',medium:'<i class="fas fa-minus text-yellow-500"></i>',low:'<i class="fas fa-arrow-down text-green-500"></i>'}[p]||''; }
function dueLabel(d) {
  if(!d)return'<span class="text-gray-400 text-xs">No date</span>';
  const diff=Math.ceil((new Date(d).getTime()-Date.now())/86400000);
  if(diff<0)return'<span class="text-red-600 font-semibold text-xs"><i class="fas fa-exclamation-triangle mr-1"></i>Overdue '+Math.abs(diff)+'d</span>';
  if(diff===0)return'<span class="text-orange-600 font-semibold text-xs"><i class="fas fa-clock mr-1"></i>Due today</span>';
  if(diff<=3)return'<span class="text-amber-600 text-xs"><i class="fas fa-clock mr-1"></i>'+diff+'d left</span>';
  return'<span class="text-gray-500 text-xs">'+new Date(d).toLocaleDateString('en-US',{month:'short',day:'numeric'})+'</span>';
}
function companyChip(name) {
  if (!name || !CS.hasMultiCompany) return '';
  return '<span class="company-chip bg-sky-50 text-sky-700"><i class="fas fa-building mr-1"></i>'+esc(name)+'</span>';
}
function avatar(name, size) {
  size = size || 'w-7 h-7 text-xs';
  var colors = ['bg-sky-500','bg-emerald-500','bg-amber-500','bg-rose-500','bg-violet-500','bg-teal-500'];
  var c = colors[name.charCodeAt(0) % colors.length];
  return '<div class="'+size+' '+c+' rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0" title="'+esc(name)+'">'+esc(name.charAt(0).toUpperCase())+'</div>';
}

// ==================== DATA LOADING ====================
async function loadTasks() {
  const params = new URLSearchParams(); params.set('parent_task_id', 'null');
  params.set('sort', CS.sort);
  if (CS.hideDone) params.set('hide_done', '1');
  if (CS.filters.status) params.set('status', CS.filters.status);
  if (CS.filters.project_id) params.set('project_id', CS.filters.project_id);
  if (CS.filters.company_id) params.set('client_id', CS.filters.company_id);
  const data = await API.get('/api/tasks?' + params.toString());
  if (data) CS.tasks = data.tasks;
}
async function loadProjects() { const d = await API.get('/api/projects'); if(d) CS.projects = d.projects; }
async function loadDashboard() { const d = await API.get('/api/dashboard'); if(d) CS.dashboard = d; }
async function loadNotifications() { const d = await API.get('/api/notifications'); if(d){CS.notifications=d.notifications; CS.unreadCount=d.unread_count;} }

async function loadTaskDetail(id) {
  const data = await API.get('/api/tasks/' + id);
  if (data) { CS.selectedTask = data; CS.showTaskModal = true; render(); }
}

async function init() {
  CS.token = localStorage.getItem('flexbiz_client_token');
  CS.client = JSON.parse(localStorage.getItem('flexbiz_client') || 'null');
  CS.linkedCompanies = JSON.parse(localStorage.getItem('flexbiz_linked_companies') || '[]');
  CS.allClientIds = JSON.parse(localStorage.getItem('flexbiz_all_client_ids') || '[]');
  CS.hasMultiCompany = CS.linkedCompanies.length > 0;
  if (!CS.token || !CS.client) { window.location.href = '/client/login'; return; }
  CS.loading = true; render();
  await Promise.all([loadDashboard(), loadTasks(), loadProjects(), loadNotifications()]);
  CS.loading = false; render();
  setInterval(loadNotifications, 30000);
}

function navigate(page) {
  CS.currentPage = page;
  CS.showTaskModal = false;
  CS.showNewTask = false;
  closeMobileSidebar();
  render();
  if (page === 'tasks') loadTasks();
  if (page === 'projects') loadProjects();
  if (page === 'notifications') loadNotifications();
}

// ==================== RENDER ====================
function render() {
  document.getElementById('app').innerHTML = renderSidebar() + '<div class="main-content md:ml-56 min-h-screen">' + renderTopBar() + '<div class="p-3 md:p-6">' + renderPage() + '</div></div>' + renderBottomNav() + (CS.showTaskModal ? renderTaskModal() : '') + (CS.showNewTask ? renderNewTask() : '');
  bindEvents();
}

function renderSidebar() {
  const links = [
    {id:'dashboard',icon:'fas fa-th-large',label:'Dashboard'},
    {id:'tasks',icon:'fas fa-tasks',label:'Tasks'},
    {id:'projects',icon:'fas fa-project-diagram',label:'Projects'},
    {id:'notifications',icon:'fas fa-bell',label:'Notifications'},
    {id:'settings',icon:'fas fa-cog',label:'Settings'},
  ];
  return '<div class="sidebar-desktop fixed left-0 top-0 bottom-0 w-56 bg-sidebar text-white z-30 flex flex-col">' +
    '<div class="p-5 border-b border-white/10"><div class="flex items-center gap-3"><div class="w-9 h-9 bg-sky-500 rounded-xl flex items-center justify-center"><i class="fas fa-handshake text-sm"></i></div><div><div class="font-bold text-sm">FlexBiz</div><div class="text-xs text-sky-300">Client Portal</div></div></div></div>' +
    '<nav class="flex-1 p-3 space-y-1 overflow-y-auto">' +
    links.map(function(l){ return '<a onclick="navigate(&apos;'+l.id+'&apos;)" class="sidebar-link flex items-center gap-3 px-3 py-2.5 cursor-pointer text-sm '+(CS.currentPage===l.id?'active bg-white/10 text-white':'text-sky-200 hover:text-white')+'"><i class="'+l.icon+' w-5 text-center"></i><span>'+l.label+'</span>'+(l.id==='notifications'&&CS.unreadCount>0?'<span class="ml-auto bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">'+CS.unreadCount+'</span>':'')+'</a>'; }).join('') +
    '</nav>' +
    '<div class="p-4 border-t border-white/10"><div class="flex items-center gap-3">'+avatar(CS.client?.contact_name||'C','w-9 h-9 text-sm')+'<div class="flex-1 min-w-0"><div class="text-sm font-medium truncate">'+esc(CS.client?.contact_name)+'</div><div class="text-xs text-sky-300 truncate">'+esc(CS.client?.company_name)+'</div></div><button onclick="clientLogout()" class="text-sky-300 hover:text-white" title="Logout"><i class="fas fa-sign-out-alt"></i></button></div></div>' +
    '</div>' +
    '<div class="mobile-overlay" id="mobileOverlay" onclick="closeMobileSidebar()"></div>' +
    '<div class="md:hidden fixed top-0 left-0 right-0 bg-sidebar text-white z-20 px-4 flex items-center justify-between" style="height:56px"><div class="flex items-center gap-2"><button onclick="toggleMobileSidebar()" class="text-sky-300 p-2 -ml-2" style="min-height:44px;min-width:44px"><i class="fas fa-bars text-lg"></i></button><span class="font-bold text-sm">FlexBiz</span></div><div class="flex items-center gap-1"><button onclick="CS.showNewTask=true;render()" class="bg-sky-500 text-white rounded-lg flex items-center justify-center" style="width:40px;height:40px"><i class="fas fa-plus"></i></button><button onclick="navigate(&apos;notifications&apos;)" class="relative flex items-center justify-center" style="width:40px;height:40px"><i class="fas fa-bell text-sky-300 text-lg"></i>'+(CS.unreadCount>0?'<span class="absolute -top-1 -right-1 bg-red-500 text-white rounded-full notification-badge flex items-center justify-center">'+CS.unreadCount+'</span>':'')+'</button></div></div>';
}

function renderBottomNav() {
  const navItems = [
    {id:'dashboard',icon:'fas fa-th-large',label:'Home'},
    {id:'tasks',icon:'fas fa-tasks',label:'Tasks'},
    {id:'projects',icon:'fas fa-project-diagram',label:'Projects'},
    {id:'notifications',icon:'fas fa-bell',label:'Alerts'},
    {id:'settings',icon:'fas fa-ellipsis-h',label:'More'},
  ];
  return '<div class="mobile-bottom-nav">' +
    navItems.map(function(n){ return '<button onclick="navigate(&apos;'+n.id+'&apos;)" class="'+(CS.currentPage===n.id?'active':'')+'">' +
      '<i class="'+n.icon+' nav-icon"></i>' +
      (n.id==='notifications'&&CS.unreadCount>0?'<span class="nav-badge">'+CS.unreadCount+'</span>':'') +
      '<span>'+n.label+'</span></button>'; }).join('') +
    '</div>';
}

function renderTopBar() {
  return '<div class="hidden md:flex bg-white border-b border-gray-200 px-4 md:px-6 py-3 items-center justify-between sticky top-0 z-20">' +
    '<div class="flex items-center gap-3 flex-1 min-w-0"><h1 class="text-lg font-bold text-gray-800 capitalize truncate">'+CS.currentPage.replace('-',' ')+'</h1>' +
    '<div class="flex items-center bg-gray-100 rounded-lg px-3 py-2 flex-1 max-w-md"><i class="fas fa-search text-gray-400 mr-2"></i><input type="text" placeholder="Search tasks..." class="bg-transparent outline-none text-sm flex-1" onkeyup="handleSearch(event)" value="'+esc(CS.filters.search||'')+'"></div></div>' +
    '<div class="flex items-center gap-3">' +
    '<button onclick="CS.showNewTask=true;render()" class="bg-sky-500 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-sky-600 transition-colors flex items-center gap-2"><i class="fas fa-plus"></i><span>New Task</span></button>' +
    '<button onclick="navigate(&apos;notifications&apos;)" class="relative p-2 text-gray-500 hover:text-gray-700"><i class="fas fa-bell text-lg"></i>'+(CS.unreadCount>0?'<span class="absolute top-0 right-0 bg-red-500 text-white rounded-full notification-badge flex items-center justify-center">'+CS.unreadCount+'</span>':'')+'</button>' +
    '</div></div>';
}

function renderPage() {
  if (CS.loading) return '<div class="flex items-center justify-center h-96"><div class="text-center"><i class="fas fa-spinner fa-spin text-4xl text-sky-500 mb-4"></i><p class="text-gray-500">Loading...</p></div></div>';
  var pages = { dashboard: renderDashboardPage, tasks: renderTasksPage, projects: renderProjectsPage, notifications: renderNotificationsPage, settings: renderSettingsPage };
  return (pages[CS.currentPage] || renderDashboardPage)();
}

// ==================== DASHBOARD ====================
function renderDashboardPage() {
  var d = CS.dashboard || {};
  var sc = {}; (d.tasksByStatus||[]).forEach(function(s){sc[s.status]=s.count;});
  var pc = {}; (d.tasksByPriority||[]).forEach(function(p){pc[p.priority]=p.count;});

  var companySummary = '';
  if (CS.hasMultiCompany) {
    var allNames = [CS.client?.company_name].concat(CS.linkedCompanies.map(function(c){return c.company_name;})).filter(Boolean);
    companySummary = '<div class="mb-6 bg-gradient-to-r from-sky-50 to-indigo-50 rounded-xl border border-sky-200 p-4">' +
      '<div class="flex items-center gap-2 mb-2"><i class="fas fa-building text-sky-600"></i><span class="font-semibold text-gray-800">Your Companies</span></div>' +
      '<div class="flex flex-wrap gap-2">' + allNames.map(function(n){return '<span class="bg-white border border-sky-200 text-sky-700 text-xs font-medium px-3 py-1 rounded-full"><i class="fas fa-briefcase mr-1"></i>'+esc(n)+'</span>';}).join('') + '</div></div>';
  }

  return companySummary +
    '<div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">' +
    statCard('Overdue', d.overdueTasks||0, 'fas fa-exclamation-triangle', 'bg-red-500', 'text-red-600') +
    statCard('Due Soon', d.dueSoonTasks||0, 'fas fa-clock', 'bg-amber-500', 'text-amber-600') +
    statCard('In Progress', sc['in_progress']||0, 'fas fa-spinner', 'bg-blue-500', 'text-blue-600') +
    statCard('Completed', sc['done']||0, 'fas fa-check-circle', 'bg-green-500', 'text-green-600') +
    '</div>' +
    // Quick action buttons
    '<div class="flex flex-wrap gap-3 mb-6">' +
    '<button onclick="CS.showNewTask=true;render()" class="bg-sky-600 text-white px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-sky-700 flex items-center gap-2"><i class="fas fa-plus"></i>New Task</button>' +
    '<button onclick="navigate(&apos;tasks&apos;);setTimeout(function(){CS.showQuickAdd=true;CS.quickAddResult=null;render()},100)" class="bg-white border border-sky-300 text-sky-600 px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-sky-50 flex items-center gap-2"><i class="fas fa-paste"></i>Quick Add Tasks</button>' +
    '</div>' +
    // All Open Tasks — employee-style list
    '<div class="bg-white rounded-xl shadow-sm border border-gray-200 p-5"><h3 class="font-bold text-gray-800 mb-4 flex items-center gap-2"><i class="fas fa-tasks text-sky-500"></i>All Open Tasks</h3>' +
    '<div class="space-y-1">' + (((d.openTasks||d.recentTasks)||[]).length === 0 ? '<p class="text-gray-400 text-sm py-4 text-center">No open tasks</p>' :
    ((d.openTasks||d.recentTasks)||[]).map(function(t){ return '<div class="flex items-center gap-3 p-2.5 rounded-lg hover:bg-gray-50 cursor-pointer" onclick="loadTaskDetail('+t.id+')">' +
      priorityIcon(t.priority) +
      '<div class="flex-1 min-w-0"><div class="text-sm font-medium truncate '+(t.status==='done'?'line-through text-gray-400':'')+'">'+esc(t.title)+'</div>' +
      '<div class="text-xs text-gray-400 mt-0.5">' +
      (t.due_date ? '<i class="fas fa-calendar text-gray-300 mr-1"></i>' + new Date(t.due_date).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) : '<span class="text-gray-300">No due date</span>') +
      (t.project_name ? ' &middot; ' + esc(t.project_name) : '') +
      (CS.hasMultiCompany && t.client_name ? ' &middot; ' + esc(t.client_name) : '') +
      '</div></div>' +
      '</div>'; }).join('')) +
    '</div></div>' +
    // Priority breakdown
    '<div class="mt-6 grid md:grid-cols-4 gap-4">' +
    ['urgent','high','medium','low'].map(function(p) {
      var count = pc[p] || 0;
      var colors = {urgent:'border-red-400 bg-red-50',high:'border-orange-400 bg-orange-50',medium:'border-yellow-400 bg-yellow-50',low:'border-green-400 bg-green-50'};
      return '<div class="border-l-4 '+(colors[p]||'')+' rounded-r-lg p-4 cursor-pointer hover:shadow-sm transition-shadow" onclick="CS.filters.priority=&apos;'+p+'&apos;;navigate(&apos;tasks&apos;)">' +
        '<div class="text-2xl font-bold">'+count+'</div><div class="text-sm capitalize text-gray-600">'+p+' priority</div></div>';
    }).join('') + '</div>';
}

function statCard(label, value, icon, iconBg, textColor) {
  return '<div class="bg-white rounded-xl shadow-sm border border-gray-200 p-4"><div class="flex items-center gap-3"><div class="w-10 h-10 '+iconBg+' rounded-lg flex items-center justify-center"><i class="'+icon+' text-white"></i></div><div><div class="text-2xl font-bold '+textColor+'">'+value+'</div><div class="text-xs text-gray-500">'+label+'</div></div></div></div>';
}

// ==================== QUICK ADD ====================
function renderQuickAdd() {
  var companyPicker = '';
  if (CS.hasMultiCompany) {
    var companies = [{id:CS.client.id, name:CS.client.company_name}].concat(CS.linkedCompanies.map(function(c){return {id:c.id, name:c.company_name};}));
    companyPicker = '<div><label class="text-sm font-medium text-gray-700 mb-1 block">Company</label>' +
      '<select id="qa_company" class="w-full text-sm border rounded-lg px-3 py-2">' +
      companies.map(function(c){return '<option value="'+c.id+'">'+esc(c.name)+'</option>';}).join('') +
      '</select></div>';
  }
  if (CS.quickAddResult) {
    return '<div class="bg-white rounded-2xl border shadow-sm p-5 md:p-6 mb-4"><div class="text-center py-4">' +
      '<div class="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4"><i class="fas fa-check-circle text-green-500 text-3xl"></i></div>' +
      '<h3 class="text-lg font-bold text-gray-800 mb-1">' + CS.quickAddResult.count + ' task' + (CS.quickAddResult.count !== 1 ? 's' : '') + ' created!</h3>' +
      '<div class="max-w-md mx-auto mt-4 space-y-1 text-left">' +
      CS.quickAddResult.created.map(function(t){ return '<div class="flex items-center gap-2 p-2 rounded-lg bg-gray-50"><i class="fas fa-check text-green-500 text-xs"></i><span class="text-sm">'+esc(t.title)+'</span></div>'; }).join('') +
      '</div><div class="flex flex-col sm:flex-row gap-3 justify-center mt-6">' +
      '<button onclick="CS.quickAddResult=null;render()" class="bg-sky-600 text-white px-6 py-3 rounded-lg text-sm font-semibold hover:bg-sky-700"><i class="fas fa-plus mr-2"></i>Add More</button>' +
      '<button onclick="CS.quickAddResult=null;CS.showQuickAdd=false;loadTasks().then(render)" class="border border-gray-300 text-gray-700 px-6 py-3 rounded-lg text-sm font-semibold hover:bg-gray-50"><i class="fas fa-list mr-2"></i>View Tasks</button>' +
      '</div></div></div>';
  }
  return '<div class="bg-white rounded-2xl border shadow-sm p-5 md:p-6 mb-4">' +
    '<div class="flex items-center gap-3 mb-4"><div class="w-10 h-10 bg-sky-100 rounded-xl flex items-center justify-center"><i class="fas fa-paste text-sky-600"></i></div><div><h3 class="font-bold text-gray-800">Quick Add Tasks</h3><p class="text-xs text-gray-500">Paste a bulleted list to create multiple tasks at once</p></div>' +
    '<button onclick="CS.showQuickAdd=false;render()" class="ml-auto text-gray-400 hover:text-gray-600" style="width:36px;height:36px"><i class="fas fa-times"></i></button></div>' +
    '<div class="bg-sky-50 border border-sky-200 rounded-xl p-3 mb-4 text-sm text-sky-800"><div class="font-semibold mb-1"><i class="fas fa-lightbulb text-sky-500 mr-1"></i>How it works</div><div class="text-xs text-sky-700">Type or paste one task per line. Bullets, dashes, numbers, or plain text all work.<br><span class="font-mono bg-sky-100 px-1 rounded">- Call accountant about tax forms</span><br><span class="font-mono bg-sky-100 px-1 rounded">- Review contracts for client</span><br>Indent a line (tab or 4+ spaces) to add a description.</div></div>' +
    '<div class="mb-4"><textarea id="qa_text" class="w-full border-2 border-gray-200 rounded-xl p-4 text-sm focus:border-sky-500 focus:ring-2 focus:ring-sky-200 transition-colors" rows="8" placeholder="Paste your task list here...&#10;&#10;Examples:&#10;- Review contracts for Lion MDs&#10;- File quarterly taxes&#10;    Need W2 forms from payroll&#10;- Order new office supplies" style="min-height:180px;font-size:15px !important"></textarea></div>' +
    '<div class="flex flex-col sm:flex-row gap-3 mb-4">' + companyPicker +
    '<div class="flex-1"><label class="text-sm font-medium text-gray-700 mb-1 block">Project</label><select id="qa_project" class="w-full text-sm border rounded-lg px-3 py-2"><option value="">No project</option>'+CS.projects.map(function(p){ return '<option value="'+p.id+'">'+esc(p.name)+'</option>'; }).join('')+'</select></div></div>' +
    '<button onclick="submitQuickAdd()" id="qa_submit" class="w-full bg-sky-600 text-white py-3 rounded-xl text-sm font-bold hover:bg-sky-700 transition-colors flex items-center justify-center gap-2"' +
    (CS.quickAddLoading ? ' disabled style="opacity:0.7"' : '') + '>' +
    (CS.quickAddLoading ? '<i class="fas fa-spinner fa-spin"></i><span>Creating tasks...</span>' : '<i class="fas fa-paper-plane"></i><span>Create Tasks</span>') +
    '</button></div>';
}

async function submitQuickAdd() {
  var textEl = document.getElementById('qa_text');
  if (!textEl || !textEl.value.trim()) { alert('Please paste or type your task list'); return; }
  CS.quickAddLoading = true; render();
  var savedText = textEl ? textEl.value : '';
  var payload = { text: savedText };
  var companyEl = document.getElementById('qa_company');
  if (companyEl && companyEl.value) payload.client_id = parseInt(companyEl.value);
  var projectEl = document.getElementById('qa_project');
  if (projectEl && projectEl.value) payload.project_id = parseInt(projectEl.value);
  try {
    var res = await API.post('/api/tasks/bulk', payload);
    CS.quickAddLoading = false;
    if (res && res.created) { CS.quickAddResult = res; await loadTasks(); }
    else { alert(res && res.error ? res.error : 'Something went wrong.'); }
  } catch (e) { CS.quickAddLoading = false; alert('Connection error.'); }
  render();
  if (!CS.quickAddResult) { var el = document.getElementById('qa_text'); if (el) el.value = savedText; }
}

// ==================== TASKS PAGE ====================
function renderTasksPage() {
  var activeFilterCount = Object.values(CS.filters).filter(function(v){return v;}).length;

  var quickAddSection = CS.showQuickAdd ? renderQuickAdd() :
    '<div class="bg-gradient-to-r from-sky-50 to-indigo-50 rounded-2xl border border-sky-200 p-4 mb-4 cursor-pointer" onclick="CS.showQuickAdd=true;CS.quickAddResult=null;render()">' +
    '<div class="flex items-center gap-3"><div class="w-10 h-10 bg-sky-500 rounded-xl flex items-center justify-center flex-shrink-0"><i class="fas fa-paste text-white"></i></div><div class="flex-1"><div class="font-semibold text-gray-800 text-sm">Quick Add Tasks</div><div class="text-xs text-gray-500">Paste a bulleted list to create multiple tasks at once</div></div><i class="fas fa-chevron-right text-sky-400"></i></div></div>';

  var companyFilter = '';
  if (CS.hasMultiCompany) {
    var allCo = [{id:'', name:'All Companies'}, {id:CS.client.id, name:CS.client.company_name}].concat(CS.linkedCompanies.map(function(c){return {id:c.id, name:c.company_name};}));
    companyFilter = '<select onchange="CS.filters.company_id=this.value;loadTasks().then(render)" class="text-sm border rounded-lg px-3 py-2 bg-white flex-1 md:flex-none">' +
      allCo.map(function(c){return '<option value="'+c.id+'"'+(CS.filters.company_id==c.id?' selected':'')+'>'+esc(c.name)+'</option>';}).join('') + '</select>';
  }

  return quickAddSection + '<div class="mb-4 space-y-3">' +
    '<div class="flex items-center gap-2 flex-wrap">' +
    // Sort dropdown
    '<select onchange="CS.sort=this.value;loadTasks().then(render)" class="text-sm border rounded-lg px-3 py-2 bg-white"><option value="due_date"'+(CS.sort==='due_date'?' selected':'')+'>Sort: Due Date</option><option value="priority"'+(CS.sort==='priority'?' selected':'')+'>Sort: Priority</option><option value="status"'+(CS.sort==='status'?' selected':'')+'>Sort: Status</option><option value="created"'+(CS.sort==='created'?' selected':'')+'>Sort: Newest</option><option value="title"'+(CS.sort==='title'?' selected':'')+'>Sort: A-Z</option></select>' +
    // Hide done toggle
    '<button onclick="CS.hideDone=!CS.hideDone;loadTasks().then(render)" class="flex items-center gap-1.5 px-3 py-2 border rounded-lg text-sm '+(CS.hideDone?'bg-green-50 border-green-300 text-green-700':'bg-white text-gray-500')+'" title="'+(CS.hideDone?'Completed hidden':'Showing all')+'"><i class="fas fa-'+(CS.hideDone?'eye-slash':'eye')+'"></i><span class="hidden sm:inline">'+(CS.hideDone?'Done hidden':'Showing all')+'</span></button>' +
    // Mobile search
    '<div class="md:hidden flex items-center bg-gray-100 rounded-lg px-3 py-2 flex-1"><i class="fas fa-search text-gray-400 mr-2"></i><input type="text" placeholder="Search..." class="bg-transparent outline-none text-sm flex-1" onkeyup="handleSearch(event)" value="'+esc(CS.filters.search||'')+'"></div>' +
    '<button onclick="CS.showFilters=!CS.showFilters;render()" class="md:hidden flex items-center gap-1 px-3 py-2 border rounded-lg text-sm '+(activeFilterCount>0?'bg-sky-50 border-sky-300 text-sky-700':'text-gray-500')+'"><i class="fas fa-filter"></i>'+(activeFilterCount>0?'<span class="bg-sky-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">'+activeFilterCount+'</span>':'')+'</button>' +
    '<div class="ml-auto text-sm text-gray-500 hidden sm:block">'+CS.tasks.length+' tasks</div></div>' +
    // Filter row
    '<div class="'+(CS.showFilters===false?'hidden md:flex':'flex')+' flex-wrap items-center gap-2">' +
    '<select onchange="CS.filters.status=this.value;loadTasks().then(render)" class="text-sm border rounded-lg px-3 py-2 bg-white flex-1 md:flex-none"><option value="">All Statuses</option><option value="todo"'+(CS.filters.status==='todo'?' selected':'')+'>To Do</option><option value="in_progress"'+(CS.filters.status==='in_progress'?' selected':'')+'>In Progress</option><option value="review"'+(CS.filters.status==='review'?' selected':'')+'>Review</option><option value="done"'+(CS.filters.status==='done'?' selected':'')+'>Done</option></select>' +
    '<select onchange="CS.filters.project_id=this.value;loadTasks().then(render)" class="text-sm border rounded-lg px-3 py-2 bg-white flex-1 md:flex-none"><option value="">All Projects</option>'+CS.projects.map(function(p){return '<option value="'+p.id+'"'+(CS.filters.project_id==p.id?' selected':'')+'>'+esc(p.name)+'</option>';}).join('')+'</select>' +
    companyFilter +
    (activeFilterCount>0 ? '<button onclick="clearFilters()" class="text-sm text-red-500 hover:text-red-700 px-3 py-2"><i class="fas fa-times mr-1"></i>Clear</button>' : '') +
    '</div></div>' +
    renderTaskList();
}

function renderTaskList() {
  if (CS.tasks.length === 0) return '<div class="bg-white rounded-xl border p-12 text-center"><i class="fas fa-inbox text-4xl text-gray-300 mb-3"></i><p class="text-gray-500">No tasks found</p><button onclick="CS.showNewTask=true;render()" class="mt-3 text-sky-600 hover:text-sky-800 font-medium text-sm"><i class="fas fa-plus mr-1"></i>Create a task</button></div>';

  return '<div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">' +
    // Desktop table header
    '<div class="hidden md:grid grid-cols-12 gap-2 px-4 py-2 bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b"><div class="col-span-5">Task</div><div class="col-span-2">Project</div><div class="col-span-2">Status</div><div class="col-span-2">Due Date</div><div class="col-span-1">Info</div></div>' +
    CS.tasks.map(function(t) {
      return '<!-- Desktop row -->' +
        '<div class="task-row hidden md:grid grid-cols-12 gap-2 px-4 py-3 border-b border-gray-100 items-center cursor-pointer priority-'+t.priority+'" onclick="loadTaskDetail('+t.id+')">' +
        '<div class="col-span-5"><div class="flex items-center gap-2"><button onclick="event.stopPropagation();quickStatus('+t.id+',&apos;'+t.status+'&apos;)" class="flex-shrink-0 w-5 h-5 rounded-full border-2 '+(t.status==='done'?'bg-green-500 border-green-500 text-white':'border-gray-300 hover:border-sky-400')+' flex items-center justify-center text-xs">'+(t.status==='done'?'<i class="fas fa-check"></i>':'')+'</button><div class="min-w-0"><div class="text-sm font-medium truncate '+(t.status==='done'?'line-through text-gray-400':'')+'">'+esc(t.title)+'</div></div></div></div>' +
        '<div class="col-span-2"><div class="text-xs">'+(t.project_name?'<span class="inline-flex items-center gap-1"><span class="w-2 h-2 rounded-full" style="background:'+esc(t.project_color||'#0ea5e9')+'"></span>'+esc(t.project_name)+'</span>':'<span class="text-gray-300">-</span>')+'</div>'+(CS.hasMultiCompany && t.client_name ? '<div class="text-xs text-gray-400 mt-0.5">'+esc(t.client_name)+'</div>' : '')+'</div>' +
        '<div class="col-span-2">'+priorityIcon(t.priority)+' <span class="status-badge '+statusColor(t.status)+'">'+t.status.replace('_',' ')+'</span></div>' +
        '<div class="col-span-2">'+dueLabel(t.due_date)+'</div>' +
        '<div class="col-span-1 flex items-center gap-2 text-xs text-gray-400">'+(t.subtask_count>0?'<span><i class="fas fa-sitemap mr-1"></i>'+t.subtask_done_count+'/'+t.subtask_count+'</span> ':'')+(t.comment_count>0?'<span><i class="fas fa-comment mr-1"></i>'+t.comment_count+'</span> ':'')+(t.attachment_count>0?'<span><i class="fas fa-paperclip mr-1"></i>'+t.attachment_count+'</span>':'')+'</div></div>' +
        '<!-- Mobile card -->' +
        '<div class="md:hidden task-row border-b border-gray-100 cursor-pointer priority-'+t.priority+'" onclick="loadTaskDetail('+t.id+')" style="padding:14px 16px">' +
        '<div class="flex items-start gap-3">' +
        '<button onclick="event.stopPropagation();quickStatus('+t.id+',&apos;'+t.status+'&apos;)" class="flex-shrink-0 rounded-full border-2 '+(t.status==='done'?'bg-green-500 border-green-500 text-white':'border-gray-300 active:border-sky-400')+' flex items-center justify-center" style="width:28px;height:28px;margin-top:2px">'+(t.status==='done'?'<i class="fas fa-check text-xs"></i>':'')+'</button>' +
        '<div class="flex-1 min-w-0">' +
        '<div class="text-[15px] font-medium leading-snug '+(t.status==='done'?'line-through text-gray-400':'text-gray-800')+'">'+esc(t.title)+'</div>' +
        '<div class="flex flex-wrap gap-2 mt-2 items-center">' +
        '<span class="status-badge '+statusColor(t.status)+'">'+t.status.replace('_',' ')+'</span>' +
        priorityIcon(t.priority) +
        dueLabel(t.due_date) +
        '</div>' +
        '<div class="flex flex-wrap gap-x-3 gap-y-1 mt-1.5 items-center">' +
        (t.project_name?'<span class="text-xs text-gray-400"><i class="fas fa-folder mr-0.5"></i>'+esc(t.project_name)+'</span>':'') +
        (CS.hasMultiCompany && t.client_name?'<span class="text-xs text-gray-400"><i class="fas fa-building mr-0.5"></i>'+esc(t.client_name)+'</span>':'') +
        (t.subtask_count>0?'<span class="text-xs text-gray-400"><i class="fas fa-sitemap mr-0.5"></i>'+t.subtask_done_count+'/'+t.subtask_count+'</span>':'') +
        (t.comment_count>0?'<span class="text-xs text-gray-400"><i class="fas fa-comment mr-0.5"></i>'+t.comment_count+'</span>':'') +
        '</div></div>' +
        '<i class="fas fa-chevron-right text-gray-300 mt-1 flex-shrink-0"></i>' +
        '</div></div>';
    }).join('') + '</div>';
}

async function quickStatus(id, current) {
  var next = current === 'done' ? 'todo' : 'done';
  await API.put('/api/tasks/' + id, { status: next });
  await loadTasks(); render();
}

function handleSearch(e) {
  if (e.key === 'Enter') { CS.filters.search = e.target.value; loadTasks().then(render); }
}

function clearFilters() {
  CS.filters = { status: '', project_id: '', company_id: '' };
  loadTasks().then(render);
}

// ==================== TASK DETAIL MODAL ====================
function renderTaskModal() {
  var t = CS.selectedTask; if(!t)return'';
  return '<div class="fixed inset-0 z-50 modal-overlay flex items-end md:items-start justify-center md:pt-16 px-0 md:px-4" onclick="if(event.target===this){CS.showTaskModal=false;render()}">' +
    '<div class="bg-white rounded-t-2xl md:rounded-2xl shadow-2xl w-full max-w-3xl max-h-[95vh] md:max-h-[85vh] overflow-hidden flex flex-col slide-up md:fade-in">' +
    // Header
    '<div class="px-4 md:px-6 py-3 md:py-4 border-b flex items-center justify-between bg-gray-50">' +
    '<div class="flex items-center gap-3">' +
    '<span class="status-badge '+statusColor(t.status)+' cursor-pointer" onclick="cycleStatus()">'+t.status.replace('_',' ')+'</span>' +
    priorityIcon(t.priority) +
    (t.project_name?'<span class="text-xs bg-sky-50 text-sky-600 px-2 py-1 rounded-full"><span class="w-2 h-2 rounded-full inline-block mr-1" style="background:'+esc(t.project_color||'#0ea5e9')+'"></span>'+esc(t.project_name)+'</span>':'') +
    (CS.hasMultiCompany && t.client_name?'<span class="text-xs text-gray-500">'+esc(t.client_name)+'</span>':'') +
    '</div>' +
    '<button onclick="CS.showTaskModal=false;render()" class="text-gray-400 hover:text-gray-700 flex items-center justify-center" style="width:44px;height:44px"><i class="fas fa-times text-lg"></i></button></div>' +
    // Body
    '<div class="flex-1 overflow-y-auto p-4 md:p-6" style="-webkit-overflow-scrolling:touch">' +
    // Editable title
    '<div class="mb-4"><input type="text" value="'+esc(t.title)+'" class="text-xl font-bold w-full border-0 focus:ring-0 p-0 bg-transparent" onchange="updateTaskField('+t.id+',&apos;title&apos;,this.value)"></div>' +
    // Editable description
    '<div class="mb-6"><label class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 block">Description</label><textarea class="w-full border border-gray-200 rounded-lg p-3 text-sm min-h-[80px] focus:ring-2 focus:ring-sky-200" onchange="updateTaskField('+t.id+',&apos;description&apos;,this.value)">'+esc(t.description||'')+'</textarea></div>' +
    // Meta grid
    '<div class="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">' +
    '<div><label class="text-xs font-semibold text-gray-500 mb-1 block">Status</label><select onchange="updateTaskField('+t.id+',&apos;status&apos;,this.value);CS.selectedTask.status=this.value;render()" class="w-full text-sm border rounded-lg px-3 py-2"><option value="todo"'+(t.status==='todo'?' selected':'')+'>To Do</option><option value="in_progress"'+(t.status==='in_progress'?' selected':'')+'>In Progress</option><option value="review"'+(t.status==='review'?' selected':'')+'>Review</option><option value="done"'+(t.status==='done'?' selected':'')+'>Done</option></select></div>' +
    '<div><label class="text-xs font-semibold text-gray-500 mb-1 block">Priority</label><select onchange="updateTaskField('+t.id+',&apos;priority&apos;,this.value)" class="w-full text-sm border rounded-lg px-3 py-2"><option value="urgent"'+(t.priority==='urgent'?' selected':'')+'>Urgent</option><option value="high"'+(t.priority==='high'?' selected':'')+'>High</option><option value="medium"'+(t.priority==='medium'?' selected':'')+'>Medium</option><option value="low"'+(t.priority==='low'?' selected':'')+'>Low</option></select></div>' +
    '<div><label class="text-xs font-semibold text-gray-500 mb-1 block">Due Date</label><input type="datetime-local" value="'+(t.due_date?t.due_date.slice(0,16):'')+'" onchange="updateTaskField('+t.id+',&apos;due_date&apos;,this.value)" class="w-full text-sm border rounded-lg px-3 py-2"></div></div>' +
    // Subtasks
    (t.subtasks&&t.subtasks.length?'<div class="mb-6"><label class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Subtasks ('+t.subtasks.filter(function(s){return s.status==='done';}).length+'/'+t.subtasks.length+')</label><div class="space-y-1">'+t.subtasks.map(function(st){ return '<div class="flex items-center gap-2 p-2 rounded hover:bg-gray-50"><button onclick="quickStatus('+st.id+',&apos;'+st.status+'&apos;)" class="w-5 h-5 rounded-full border-2 '+(st.status==='done'?'bg-green-500 border-green-500 text-white':'border-gray-300')+' flex items-center justify-center text-xs flex-shrink-0">'+(st.status==='done'?'<i class="fas fa-check"></i>':'')+'</button><span class="text-sm '+(st.status==='done'?'line-through text-gray-400':'')+'">'+esc(st.title)+'</span></div>'; }).join('')+'</div></div>':'') +
    // Attachments
    '<div class="mb-6"><label class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Attachments ('+((t.attachments||[]).length)+')</label>' +
    '<div class="space-y-1">'+(t.attachments||[]).map(function(a) { return '<div class="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">' +
      '<i class="fas fa-'+fileIcon(a.mime_type||a.filename)+' text-gray-400"></i>' +
      (a.file_data || (a.file_url && a.file_url.indexOf('/files/')!==-1) ?
        '<a href="/files/'+a.id+'" target="_blank" class="text-sm text-sky-600 hover:underline flex-1 truncate">'+esc(a.filename)+'</a>' :
        a.file_url ? '<a href="'+esc(a.file_url)+'" target="_blank" class="text-sm text-sky-600 hover:underline flex-1 truncate">'+esc(a.filename)+'</a>' :
        '<span class="text-sm flex-1 truncate">'+esc(a.filename)+'</span>') +
      (a.file_size ? '<span class="text-xs text-gray-400">'+formatFileSize(a.file_size)+'</span>' : '') +
      '<span class="text-xs text-gray-400">'+timeAgo(a.created_at)+'</span></div>'; }).join('')+'</div>' +
    '<div class="mt-2"><label class="flex items-center gap-2 cursor-pointer text-sm text-sky-600 hover:text-sky-800 bg-sky-50 border border-dashed border-sky-300 rounded-lg px-4 py-3 justify-center hover:bg-sky-100 transition-colors"><i class="fas fa-cloud-upload-alt"></i><span>Choose file to upload</span><input type="file" id="fileUpload" class="hidden" onchange="uploadFile('+t.id+',this)"></label>' +
    '<div id="uploadProgress" class="hidden mt-2 text-xs text-gray-500 text-center"><i class="fas fa-spinner fa-spin mr-1"></i>Uploading...</div></div></div>' +
    // Comments
    '<div><label class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Comments ('+((t.comments||[]).length)+')</label>' +
    '<div class="space-y-3 mb-3">'+(t.comments||[]).map(function(cm) { return '<div class="flex gap-3"><div class="flex-shrink-0 mt-1">'+avatar(cm.author_name||'?','w-8 h-8 text-xs')+'</div><div class="flex-1"><div class="flex items-center gap-2"><span class="text-sm font-semibold">'+esc(cm.author_name)+'</span><span class="text-xs text-gray-400">'+timeAgo(cm.created_at)+'</span></div><div class="text-sm text-gray-700 mt-1">'+esc(cm.content)+'</div></div></div>'; }).join('')+'</div>' +
    '<div class="flex gap-2"><textarea id="newComment" placeholder="Write a comment..." class="flex-1 text-sm border rounded-lg px-3 py-2 min-h-[60px]"></textarea></div>' +
    '<div class="flex items-center gap-3 mt-2"><button onclick="addComment('+t.id+')" class="bg-sky-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-sky-700"><i class="fas fa-paper-plane mr-1"></i>Comment</button></div></div>' +
    '</div></div></div>';
}

async function updateTaskField(id, field, value) {
  await API.put('/api/tasks/' + id, { [field]: value });
  if (field === 'status' || field === 'priority') { await loadTasks(); }
}

async function addComment(taskId) {
  var textarea = document.getElementById('newComment');
  if (!textarea.value.trim()) return;
  await API.post('/api/tasks/' + taskId + '/comments', { content: textarea.value.trim() });
  textarea.value = '';
  await loadTaskDetail(taskId);
}

async function uploadFile(taskId, input) {
  if (!input.files || !input.files[0]) return;
  var file = input.files[0];
  if (file.size > 25 * 1024 * 1024) { alert('File too large. Maximum 25MB.'); input.value = ''; return; }
  var prog = document.getElementById('uploadProgress');
  if (prog) prog.classList.remove('hidden');
  try {
    var fd = new FormData();
    fd.append('file', file);
    var token = localStorage.getItem('flexbiz_client_token');
    var res = await fetch('/api/tasks/' + taskId + '/attachments', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + token },
      body: fd
    });
    if (!res.ok) { var err = await res.json().catch(function(){return {};}); alert(err.error || 'Upload failed'); }
    else { await loadTaskDetail(taskId); }
  } catch(e) { alert('Upload failed. Please try again.'); }
  if (prog) prog.classList.add('hidden');
  input.value = '';
}

function fileIcon(nameOrMime) {
  if (!nameOrMime) return 'file';
  var s = nameOrMime.toLowerCase();
  if (s.indexOf('image') !== -1 || /\\.(jpg|jpeg|png|gif|svg|webp)$/i.test(s)) return 'file-image';
  if (s.indexOf('pdf') !== -1 || /\\.pdf$/i.test(s)) return 'file-pdf';
  if (s.indexOf('word') !== -1 || /\\.(doc|docx)$/i.test(s)) return 'file-word';
  if (s.indexOf('sheet') !== -1 || s.indexOf('excel') !== -1 || /\\.(xls|xlsx|csv)$/i.test(s)) return 'file-excel';
  if (s.indexOf('zip') !== -1 || /\\.(zip|rar|7z)$/i.test(s)) return 'file-archive';
  if (s.indexOf('video') !== -1 || /\\.(mp4|mov|avi)$/i.test(s)) return 'file-video';
  return 'file';
}

function formatFileSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

async function cycleStatus() {
  var order = ['todo','in_progress','review','done'];
  var idx = order.indexOf(CS.selectedTask.status);
  var next = order[(idx + 1) % order.length];
  await updateTaskField(CS.selectedTask.id, 'status', next);
  CS.selectedTask.status = next;
  render();
}

// ==================== NEW TASK MODAL ====================
function renderNewTask() {
  var companySelect = '';
  if (CS.hasMultiCompany) {
    var companies = [{id:CS.client.id, name:CS.client.company_name}].concat(CS.linkedCompanies.map(function(c){return {id:c.id, name:c.company_name};}));
    companySelect = '<div><label class="text-sm font-medium text-gray-700 mb-1 block">Company</label><select id="cnt_company" class="w-full text-sm border rounded-lg px-3 py-2">' +
      companies.map(function(c){return '<option value="'+c.id+'">'+esc(c.name)+'</option>';}).join('') + '</select></div>';
  }
  return '<div class="fixed inset-0 z-50 modal-overlay flex items-end md:items-start justify-center md:pt-16 px-0 md:px-4" onclick="if(event.target===this){CS.showNewTask=false;render()}">' +
    '<div class="bg-white rounded-t-2xl md:rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden slide-up md:fade-in">' +
    '<div class="px-4 md:px-6 py-3 md:py-4 border-b bg-gray-50 flex items-center justify-between"><h3 class="font-bold text-gray-800"><i class="fas fa-plus-circle text-sky-500 mr-2"></i>New Task</h3><button onclick="CS.showNewTask=false;render()" class="text-gray-400 hover:text-gray-700 flex items-center justify-center" style="width:44px;height:44px"><i class="fas fa-times"></i></button></div>' +
    '<form id="newTaskForm" class="p-4 md:p-6 space-y-4 overflow-y-auto" style="max-height:calc(95vh - 60px);-webkit-overflow-scrolling:touch">' +
    '<div><label class="text-sm font-medium text-gray-700 mb-1 block">Title *</label><input type="text" id="nt_title" required class="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-sky-200" placeholder="What needs to be done?"></div>' +
    '<div><label class="text-sm font-medium text-gray-700 mb-1 block">Description</label><textarea id="nt_desc" class="w-full border rounded-lg px-3 py-2 text-sm min-h-[60px]" placeholder="Add details..."></textarea></div>' +
    '<div class="grid grid-cols-2 gap-4">' +
    '<div><label class="text-sm font-medium text-gray-700 mb-1 block">Priority</label><select id="nt_priority" class="w-full text-sm border rounded-lg px-3 py-2"><option value="medium">Medium</option><option value="urgent">Urgent</option><option value="high">High</option><option value="low">Low</option></select></div>' +
    '<div><label class="text-sm font-medium text-gray-700 mb-1 block">Due Date</label><input type="datetime-local" id="nt_due" class="w-full text-sm border rounded-lg px-3 py-2"></div></div>' +
    '<div><label class="text-sm font-medium text-gray-700 mb-1 block">Project</label><select id="nt_project" class="w-full text-sm border rounded-lg px-3 py-2"><option value="">None</option>'+CS.projects.map(function(p){return '<option value="'+p.id+'">'+esc(p.name)+'</option>';}).join('')+'</select></div>' +
    companySelect +
    '<div class="flex justify-end gap-3 pt-2"><button type="button" onclick="CS.showNewTask=false;render()" class="px-4 py-2 border rounded-lg text-sm text-gray-700 hover:bg-gray-50">Cancel</button><button type="submit" class="px-6 py-2 bg-sky-600 text-white rounded-lg text-sm font-semibold hover:bg-sky-700"><i class="fas fa-plus mr-1"></i>Create Task</button></div>' +
    '</form></div></div>';
}

// ==================== PROJECTS PAGE ====================
function renderProjectsPage() {
  return '<div class="flex justify-between items-center mb-4"><h2 class="text-lg font-bold">Projects</h2></div>' +
    '<div class="grid md:grid-cols-2 lg:grid-cols-3 gap-4">' +
    CS.projects.map(function(p) {
      var pct = p.task_count > 0 ? Math.round((p.done_count / p.task_count) * 100) : 0;
      return '<div class="bg-white rounded-xl shadow-sm border border-gray-200 p-5 hover:shadow-md transition-shadow cursor-pointer" onclick="CS.filters.project_id=&apos;'+p.id+'&apos;;navigate(&apos;tasks&apos;)">' +
        '<div class="flex items-center gap-3 mb-3"><div class="w-3 h-3 rounded-full" style="background:'+esc(p.color||'#0ea5e9')+'"></div><h3 class="font-bold text-gray-800 flex-1">'+esc(p.name)+'</h3>'+(CS.hasMultiCompany && p.client_name ? companyChip(p.client_name) : '')+'</div>' +
        (p.description ? '<p class="text-sm text-gray-600 mb-3 line-clamp-2">'+esc(p.description)+'</p>' : '') +
        '<div class="flex items-center gap-4 mb-2"><div class="flex-1"><div class="bg-gray-200 rounded-full h-2"><div class="bg-sky-500 rounded-full h-2 transition-all" style="width:'+pct+'%"></div></div></div><span class="text-xs text-gray-500 font-medium">'+p.done_count+'/'+p.task_count+' tasks</span></div>' +
        '<div class="text-xs text-sky-600 mt-2"><i class="fas fa-tasks mr-1"></i>View Tasks</div></div>';
    }).join('') +
    (CS.projects.length === 0 ? '<div class="col-span-full bg-white rounded-xl border p-12 text-center"><i class="fas fa-project-diagram text-4xl text-gray-300 mb-3"></i><p class="text-gray-500">No projects yet</p></div>' : '') +
    '</div>';
}

// ==================== NOTIFICATIONS PAGE ====================
function renderNotificationsPage() {
  return '<div class="flex justify-between items-center mb-4"><h2 class="text-lg font-bold">Notifications</h2>'+(CS.unreadCount>0?'<button onclick="markAllRead()" class="text-sm text-sky-600 hover:text-sky-800"><i class="fas fa-check-double mr-1"></i>Mark all read</button>':'')+'</div>' +
    '<div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">' +
    (CS.notifications.length === 0 ? '<div class="p-12 text-center"><i class="fas fa-bell-slash text-4xl text-gray-300 mb-3"></i><p class="text-gray-500">No notifications</p></div>' :
    CS.notifications.map(function(n) { return '<div class="flex items-start gap-3 p-4 border-b border-gray-100 hover:bg-gray-50 '+(n.is_read?'opacity-60':'cursor-pointer')+'" onclick="readNotif('+n.id+','+(n.task_id||'null')+')">' +
      '<div class="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 '+(n.is_read?'bg-gray-100':'bg-sky-100')+'"><i class="fas fa-bell text-sm '+(n.is_read?'text-gray-400':'text-sky-500')+'"></i></div>' +
      '<div class="flex-1 min-w-0"><div class="text-sm font-medium '+(n.is_read?'text-gray-500':'text-gray-800')+'">'+esc(n.title)+'</div><div class="text-sm text-gray-500">'+esc(n.message)+'</div>' +
      (n.task_title?'<div class="text-xs text-sky-600 mt-1">'+esc(n.task_title)+'</div>':'') +
      '<div class="text-xs text-gray-400 mt-1">'+timeAgo(n.created_at)+'</div></div>' +
      (!n.is_read?'<div class="w-2 h-2 bg-sky-500 rounded-full mt-2 flex-shrink-0"></div>':'') +
      '</div>'; }).join('')) +
    '</div>';
}

async function readNotif(id, taskId) {
  await API.put('/api/notifications/read', {ids:[id]});
  if(taskId) loadTaskDetail(taskId); else { await loadNotifications(); render(); }
}

async function markAllRead() {
  await API.put('/api/notifications/read', {});
  await loadNotifications(); render();
}

// ==================== SETTINGS PAGE ====================
function renderSettingsPage() {
  return '<div class="max-w-2xl"><h2 class="text-lg font-bold mb-4">Settings</h2>' +
    '<div class="bg-white rounded-xl shadow-sm border p-6 mb-4"><h3 class="font-bold mb-3"><i class="fas fa-user text-sky-500 mr-2"></i>Your Account</h3>' +
    '<div class="flex items-center gap-3">'+avatar(CS.client?.contact_name||'C','w-14 h-14 text-xl')+'<div><div class="font-bold">'+esc(CS.client?.contact_name)+'</div><div class="text-sm text-gray-500">'+esc(CS.client?.company_name)+'</div><div class="text-xs text-gray-400">'+esc(CS.client?.email)+'</div></div></div></div>' +
    // Change password
    '<div class="bg-white rounded-xl shadow-sm border p-6 mb-4"><h3 class="font-bold mb-3"><i class="fas fa-lock text-sky-500 mr-2"></i>Change Password</h3>' +
    '<form onsubmit="event.preventDefault();changePassword(this)" class="space-y-3 max-w-sm">' +
    '<input type="password" id="cp_current" required class="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Current password">' +
    '<input type="password" id="cp_new" required class="w-full border rounded-lg px-3 py-2 text-sm" placeholder="New password (min 6 characters)" minlength="6">' +
    '<input type="password" id="cp_confirm" required class="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Confirm new password" minlength="6">' +
    '<div id="cpResult" class="hidden text-sm p-2 rounded-lg"></div>' +
    '<button type="submit" class="bg-sky-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-sky-700"><i class="fas fa-save mr-1"></i>Update Password</button></form></div>' +
    '<div class="bg-white rounded-xl shadow-sm border p-6"><h3 class="font-bold mb-3"><i class="fas fa-sign-out-alt text-red-500 mr-2"></i>Account</h3>' +
    '<button onclick="clientLogout()" class="bg-red-50 text-red-600 text-sm px-4 py-2 rounded-lg hover:bg-red-100 border border-red-200"><i class="fas fa-sign-out-alt mr-1"></i>Sign Out</button></div></div>';
}

async function changePassword(form) {
  var cpNew = document.getElementById('cp_new').value;
  var cpConfirm = document.getElementById('cp_confirm').value;
  var resultEl = document.getElementById('cpResult');
  if (cpNew !== cpConfirm) {
    resultEl.className = 'text-sm p-2 rounded-lg bg-red-50 text-red-600';
    resultEl.textContent = 'New passwords do not match';
    resultEl.classList.remove('hidden');
    return;
  }
  try {
    var token = localStorage.getItem('flexbiz_client_token');
    var res = await fetch('/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({ current_password: document.getElementById('cp_current').value, new_password: cpNew })
    });
    var data = await res.json();
    if (data.error) {
      resultEl.className = 'text-sm p-2 rounded-lg bg-red-50 text-red-600';
      resultEl.textContent = data.error;
    } else {
      resultEl.className = 'text-sm p-2 rounded-lg bg-green-50 text-green-600';
      resultEl.textContent = 'Password changed successfully!';
      form.reset();
    }
    resultEl.classList.remove('hidden');
  } catch(e) {
    resultEl.className = 'text-sm p-2 rounded-lg bg-red-50 text-red-600';
    resultEl.textContent = 'Connection error.';
    resultEl.classList.remove('hidden');
  }
}

// ==================== EVENT BINDINGS ====================
function bindEvents() {
  var form = document.getElementById('newTaskForm');
  if (form) {
    form.onsubmit = async function(e) {
      e.preventDefault();
      var payload = {
        title: document.getElementById('nt_title').value,
        description: document.getElementById('nt_desc').value,
        priority: document.getElementById('nt_priority').value,
        due_date: document.getElementById('nt_due').value || null,
        project_id: document.getElementById('nt_project').value || null,
      };
      var companyEl = document.getElementById('cnt_company');
      if (companyEl && companyEl.value) payload.client_id = parseInt(companyEl.value);
      await API.post('/api/tasks', payload);
      CS.showNewTask = false;
      await loadTasks(); render();
    };
  }
}

function clientLogout() {
  localStorage.removeItem('flexbiz_client_token');
  localStorage.removeItem('flexbiz_client');
  localStorage.removeItem('flexbiz_linked_companies');
  localStorage.removeItem('flexbiz_all_client_ids');
  window.location.href = '/client/login';
}

function toggleMobileSidebar() {
  var el = document.querySelector('.sidebar-desktop');
  if (el) el.classList.toggle('open');
  document.body.style.overflow = el && el.classList.contains('open') ? 'hidden' : '';
}
function closeMobileSidebar() {
  var el = document.querySelector('.sidebar-desktop');
  if (el) el.classList.remove('open');
  document.body.style.overflow = '';
}

// Boot
init();
</script>
</body>
</html>`
}
