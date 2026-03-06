export function renderClientPortal(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="icon" type="image/svg+xml" href="/favicon.svg">
  <title>FlexBiz Solutions - Client Portal</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script>tailwind.config={theme:{extend:{colors:{primary:'#0ea5e9'}}}}</script>
  <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
  <style>
    * { scrollbar-width: thin; scrollbar-color: #bae6fd #f0f9ff; -webkit-tap-highlight-color: transparent; }
    .task-card:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
    .task-card { transition: all 0.2s; }
    .status-badge { font-size: 11px; padding: 2px 8px; border-radius: 10px; font-weight: 600; }
    .modal-overlay { background: rgba(0,0,0,0.5); backdrop-filter: blur(4px); }
    .fade-in { animation: fadeIn 0.2s ease-in; }
    @keyframes fadeIn { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
    @keyframes slideUp { from{transform:translateY(100%)} to{transform:translateY(0)} }
    .slide-up { animation: slideUp 0.3s cubic-bezier(.4,0,.2,1); }
    .company-chip { font-size: 10px; padding: 2px 8px; border-radius: 6px; font-weight: 600; }
    /* Mobile bottom tabs */
    .client-bottom-tabs { display: none; }
    @media (max-width: 768px) {
      /* Touch-friendly targets */
      select, input[type="text"], input[type="email"], input[type="password"],
      input[type="number"], input[type="datetime-local"], textarea {
        min-height: 44px; font-size: 16px !important;
      }
      button { min-height: 44px; }
      .status-badge { font-size: 12px; padding: 4px 10px; }
      /* Full-screen modals */
      .modal-overlay > div { max-width: 100% !important; border-radius: 16px 16px 0 0 !important; margin: 0 !important; }
      .modal-overlay { padding: 0 !important; display: flex !important; flex-direction: column !important; justify-content: flex-end !important; }
      .modal-overlay > div { max-height: 95vh; }
      /* Bottom tabs */
      .client-bottom-tabs { display: flex; position: fixed; bottom: 0; left: 0; right: 0; background: white; border-top: 1px solid #e5e7eb; z-index: 25; padding: 4px 0; padding-bottom: max(4px, env(safe-area-inset-bottom)); }
      .client-bottom-tabs button { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 6px 0; font-size: 10px; color: #6b7280; border: none; background: none; position: relative; }
      .client-bottom-tabs button.active { color: #0ea5e9; }
      .client-bottom-tabs button .tab-icon { font-size: 18px; }
      .client-bottom-tabs button .tab-badge { position: absolute; top: 2px; right: 50%; transform: translateX(14px); background: #ef4444; color: white; font-size: 9px; min-width: 16px; height: 16px; border-radius: 8px; display: flex; align-items: center; justify-content: center; }
      /* Hide desktop tabs on mobile */
      .desktop-tabs { display: none !important; }
      /* Add bottom padding for bottom nav */
      .client-main-content { padding-bottom: 72px !important; }
      body { padding-bottom: env(safe-area-inset-bottom); }
    }
    @media (max-width: 480px) {
      select { font-size: 14px !important; }
      .modal-overlay > div { max-height: 100vh; border-radius: 0 !important; }
    }
  </style>
</head>
<body class="bg-gray-50 min-h-screen">
<div id="app"></div>
<script>
const CS = {
  client: null, token: null, tasks: [], projects: [], notifications: [], unreadCount: 0,
  dashboard: null, selectedTask: null, showTaskModal: false, showNewTask: false,
  showQuickAdd: false, quickAddResult: null, quickAddLoading: false,
  filters: { status: '', project_id: '', company_id: '' }, tab: 'tasks',
  linkedCompanies: [], allClientIds: [], hasMultiCompany: false,
  sort: 'due_date', hideDone: true
};

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

function esc(s) { if(!s)return''; const d=document.createElement('div'); d.textContent=s; return d.innerHTML; }
function timeAgo(d) { if(!d)return''; const s=Math.floor((Date.now()-new Date(d).getTime())/1000); if(s<60)return'just now'; if(s<3600)return Math.floor(s/60)+'m ago'; if(s<86400)return Math.floor(s/3600)+'h ago'; return new Date(d).toLocaleDateString(); }
function statusColor(s) { return {todo:'bg-gray-100 text-gray-700',in_progress:'bg-blue-100 text-blue-700',review:'bg-purple-100 text-purple-700',blocked:'bg-red-100 text-red-700',done:'bg-green-100 text-green-700',cancelled:'bg-gray-200 text-gray-500'}[s]||'bg-gray-100 text-gray-700'; }
function priorityIcon(p) { return {urgent:'<i class="fas fa-fire text-red-500"></i>',high:'<i class="fas fa-arrow-up text-orange-500"></i>',medium:'<i class="fas fa-minus text-yellow-500"></i>',low:'<i class="fas fa-arrow-down text-green-500"></i>'}[p]||''; }
function dueLabel(d) { if(!d)return'<span class="text-gray-400 text-xs">No date</span>'; const diff=Math.ceil((new Date(d).getTime()-Date.now())/86400000); if(diff<0)return'<span class="text-red-600 font-semibold text-xs">Overdue</span>'; if(diff===0)return'<span class="text-orange-600 text-xs">Due today</span>'; if(diff<=3)return'<span class="text-amber-600 text-xs">'+diff+'d left</span>'; return'<span class="text-gray-500 text-xs">'+new Date(d).toLocaleDateString('en-US',{month:'short',day:'numeric'})+'</span>'; }

// Get a short label for a company
function companyChip(name) {
  if (!name || !CS.hasMultiCompany) return '';
  return '<span class="company-chip bg-indigo-50 text-indigo-700"><i class="fas fa-building mr-1"></i>'+esc(name)+'</span>';
}

// Get company name by client_id
function companyName(clientId) {
  if (!clientId) return '';
  const all = [CS.client, ...(CS.linkedCompanies||[])];
  const found = all.find(c => c && c.id === clientId);
  return found ? (found.company_name || found.contact_name) : '';
}

async function init() {
  CS.token = localStorage.getItem('flexbiz_client_token');
  CS.client = JSON.parse(localStorage.getItem('flexbiz_client') || 'null');
  CS.linkedCompanies = JSON.parse(localStorage.getItem('flexbiz_linked_companies') || '[]');
  CS.allClientIds = JSON.parse(localStorage.getItem('flexbiz_all_client_ids') || '[]');
  CS.hasMultiCompany = CS.linkedCompanies.length > 0;
  if (!CS.token || !CS.client) { window.location.href = '/client/login'; return; }
  render();
  await Promise.all([loadTasks(), loadProjects(), loadDashboard(), loadNotifications()]);
  render();
}

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

function render() {
  document.getElementById('app').innerHTML = renderHeader() + '<div class="client-main-content max-w-6xl mx-auto px-3 md:px-4 py-4 md:py-6">' + renderTabs() + renderContent() + '</div>' + renderBottomTabs() + (CS.showTaskModal ? renderTaskDetail() : '') + (CS.showNewTask ? renderNewTask() : '');
  bindEvents();
}

function renderBottomTabs() {
  const tabs = [{id:'dashboard',icon:'fas fa-th-large',label:'Overview'},{id:'tasks',icon:'fas fa-tasks',label:'Tasks'},{id:'projects',icon:'fas fa-project-diagram',label:'Projects'},{id:'notifications',icon:'fas fa-bell',label:'Alerts'},{id:'settings',icon:'fas fa-cog',label:'Settings'}];
  return '<div class="client-bottom-tabs">' +
    tabs.map(t=>'<button onclick="CS.tab=&#39;'+t.id+'&#39;;render()" class="'+(CS.tab===t.id?'active':'')+'">' +
      '<i class="'+t.icon+' tab-icon"></i>' +
      (t.id==='notifications'&&CS.unreadCount>0?'<span class="tab-badge">'+CS.unreadCount+'</span>':'') +
      '<span>'+t.label+'</span></button>').join('') +
    '</div>';
}

function renderHeader() {
  // If multi-company, show all company names
  let companyLabel = esc(CS.client?.company_name);
  if (CS.hasMultiCompany) {
    const names = [CS.client?.company_name, ...CS.linkedCompanies.map(c=>c.company_name)].filter(Boolean);
    companyLabel = '<span class="text-sm font-medium text-gray-700">'+esc(CS.client?.contact_name)+'</span>' +
      '<span class="text-xs text-gray-400 ml-1">(' + names.length + ' companies)</span>';
  }

  return '<header class="bg-white border-b shadow-sm sticky top-0 z-20"><div class="max-w-6xl mx-auto px-3 md:px-4 py-2 md:py-3 flex items-center justify-between">' +
    '<div class="flex items-center gap-2 md:gap-3"><div class="w-8 h-8 md:w-9 md:h-9 bg-sky-600 rounded-lg flex items-center justify-center"><i class="fas fa-handshake text-white text-xs md:text-sm"></i></div><div><div class="font-bold text-gray-800 text-sm">FlexBiz</div><div class="text-[10px] md:text-xs text-gray-500">Client Portal</div></div></div>' +
    '<div class="flex items-center gap-2 md:gap-4"><div class="hidden md:block">'+companyLabel+'</div>' +
    '<button onclick="CS.tab=&#39;notifications&#39;;render()" class="relative flex items-center justify-center" style="width:40px;height:40px"><i class="fas fa-bell text-gray-500"></i>'+(CS.unreadCount>0?'<span class="absolute top-0 right-0 bg-red-500 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center">'+CS.unreadCount+'</span>':'')+'</button>' +
    '<button onclick="clientLogout()" class="text-gray-400 hover:text-gray-600 flex items-center justify-center" style="width:40px;height:40px"><i class="fas fa-sign-out-alt"></i></button></div></div></header>';
}

function renderTabs() {
  const tabs = [{id:'dashboard',icon:'fas fa-th-large',label:'Overview'},{id:'tasks',icon:'fas fa-tasks',label:'Tasks'},{id:'projects',icon:'fas fa-project-diagram',label:'Projects'},{id:'notifications',icon:'fas fa-bell',label:'Notifications'},{id:'settings',icon:'fas fa-cog',label:'Settings'}];
  return '<div class="desktop-tabs flex gap-1 mb-6 border-b"><div class="flex overflow-x-auto">'+tabs.map(t=>'<button onclick="CS.tab=&#39;'+t.id+'&#39;;render()" class="px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors '+(CS.tab===t.id?'border-sky-500 text-sky-600':'border-transparent text-gray-500 hover:text-gray-700')+'"><i class="'+t.icon+' mr-2"></i>'+t.label+(t.id==='notifications'&&CS.unreadCount>0?' <span class="bg-red-500 text-white text-[10px] px-1.5 rounded-full ml-1">'+CS.unreadCount+'</span>':'')+'</button>').join('')+'</div></div>';
}

function renderContent() {
  if (CS.tab === 'dashboard') return renderClientDashboard();
  if (CS.tab === 'tasks') return renderClientTasks();
  if (CS.tab === 'projects') return renderClientProjects();
  if (CS.tab === 'notifications') return renderClientNotifications();
  if (CS.tab === 'settings') return renderClientSettings();
  return '';
}

function renderCompanyFilter() {
  if (!CS.hasMultiCompany) return '';
  const all = [{id:'', name:'All Companies'}, {id:CS.client.id, name:CS.client.company_name}, ...CS.linkedCompanies.map(c=>({id:c.id, name:c.company_name}))];
  return '<select onchange="CS.filters.company_id=this.value;loadTasks().then(render)" class="text-sm border rounded-lg px-3 py-2">' +
    all.map(c=>'<option value="'+c.id+'"'+(CS.filters.company_id==c.id?' selected':'')+'>'+esc(c.name)+'</option>').join('') + '</select>';
}

function renderClientDashboard() {
  const d = CS.dashboard || {};
  const sc = {}; (d.tasksByStatus||[]).forEach(s=>sc[s.status]=s.count);

  // Multi-company summary at top
  let companySummary = '';
  if (CS.hasMultiCompany) {
    const allNames = [CS.client?.company_name, ...CS.linkedCompanies.map(c=>c.company_name)].filter(Boolean);
    companySummary = '<div class="mb-6 bg-gradient-to-r from-sky-50 to-indigo-50 rounded-xl border border-sky-200 p-4">' +
      '<div class="flex items-center gap-2 mb-2"><i class="fas fa-building text-sky-600"></i><span class="font-semibold text-gray-800">Your Companies</span></div>' +
      '<div class="flex flex-wrap gap-2">' + allNames.map(n=>'<span class="bg-white border border-sky-200 text-sky-700 text-xs font-medium px-3 py-1 rounded-full"><i class="fas fa-briefcase mr-1"></i>'+esc(n)+'</span>').join('') + '</div>' +
      '<div class="text-xs text-gray-500 mt-2">Viewing tasks and projects across all your companies</div></div>';
  }

  return companySummary +
    '<div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">' +
    '<div class="bg-white rounded-xl border p-4"><div class="text-2xl font-bold text-red-600">'+(d.overdueTasks||0)+'</div><div class="text-xs text-gray-500">Overdue</div></div>' +
    '<div class="bg-white rounded-xl border p-4"><div class="text-2xl font-bold text-blue-600">'+(sc['in_progress']||0)+'</div><div class="text-xs text-gray-500">In Progress</div></div>' +
    '<div class="bg-white rounded-xl border p-4"><div class="text-2xl font-bold text-purple-600">'+(sc['review']||0)+'</div><div class="text-xs text-gray-500">In Review</div></div>' +
    '<div class="bg-white rounded-xl border p-4"><div class="text-2xl font-bold text-green-600">'+(sc['done']||0)+'</div><div class="text-xs text-gray-500">Completed</div></div></div>' +
    '<div class="bg-white rounded-xl border p-6"><h3 class="font-bold mb-4">Recent Tasks</h3><div class="space-y-2">'+(d.recentTasks||[]).map(t=>'<div class="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer" onclick="loadTaskDetail('+t.id+')">'+priorityIcon(t.priority)+'<span class="text-sm flex-1">'+esc(t.title)+'</span>'+(CS.hasMultiCompany && t.client_name ? companyChip(t.client_name) : '')+'<span class="status-badge '+statusColor(t.status)+'">'+t.status.replace('_',' ')+'</span>'+dueLabel(t.due_date)+'</div>').join('')+'</div></div>';
}

function renderQuickAdd() {
  // Company picker for multi-company clients
  let companyPicker = '';
  if (CS.hasMultiCompany) {
    const companies = [{id:CS.client.id, name:CS.client.company_name}, ...CS.linkedCompanies.map(c=>({id:c.id, name:c.company_name}))];
    companyPicker = '<div><label class="text-sm font-medium text-gray-700 mb-1 block">Company</label>' +
      '<select id="qa_company" class="w-full text-sm border rounded-lg px-3 py-2">' +
      companies.map(c=>'<option value="'+c.id+'">'+esc(c.name)+'</option>').join('') +
      '</select></div>';
  }

  // Success state
  if (CS.quickAddResult) {
    return '<div class="bg-white rounded-2xl border p-5 md:p-6 mb-4">' +
      '<div class="text-center py-4">' +
      '<div class="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4"><i class="fas fa-check-circle text-green-500 text-3xl"></i></div>' +
      '<h3 class="text-lg font-bold text-gray-800 mb-1">' + CS.quickAddResult.count + ' task' + (CS.quickAddResult.count !== 1 ? 's' : '') + ' created!</h3>' +
      '<div class="max-w-md mx-auto mt-4 space-y-1 text-left">' +
      CS.quickAddResult.created.map(t => '<div class="flex items-center gap-2 p-2 rounded-lg bg-gray-50"><i class="fas fa-check text-green-500 text-xs"></i><span class="text-sm">'+esc(t.title)+'</span></div>').join('') +
      '</div>' +
      '<div class="flex flex-col sm:flex-row gap-3 justify-center mt-6">' +
      '<button onclick="CS.quickAddResult=null;render()" class="bg-sky-600 text-white px-6 py-3 rounded-lg text-sm font-semibold hover:bg-sky-700"><i class="fas fa-plus mr-2"></i>Add More Tasks</button>' +
      '<button onclick="CS.quickAddResult=null;CS.showQuickAdd=false;CS.tab=&#39;tasks&#39;;loadTasks().then(render)" class="border border-gray-300 text-gray-700 px-6 py-3 rounded-lg text-sm font-semibold hover:bg-gray-50"><i class="fas fa-list mr-2"></i>View Tasks</button>' +
      '</div></div></div>';
  }

  return '<div class="bg-white rounded-2xl border p-5 md:p-6 mb-4">' +
    '<div class="flex items-center gap-3 mb-4"><div class="w-10 h-10 bg-sky-100 rounded-xl flex items-center justify-center"><i class="fas fa-paste text-sky-600"></i></div><div><h3 class="font-bold text-gray-800">Quick Add Tasks</h3><p class="text-xs text-gray-500">Paste your list from Google Sheets, Notes, or just type it</p></div></div>' +
    // Example hint
    '<div class="bg-sky-50 border border-sky-200 rounded-xl p-3 mb-4 text-sm text-sky-800">' +
    '<div class="font-semibold mb-1"><i class="fas fa-lightbulb text-sky-500 mr-1"></i>How it works</div>' +
    '<div class="text-xs text-sky-700">Type or paste one task per line. Use bullets, dashes, or just plain text:<br>' +
    '<span class="font-mono bg-sky-100 px-1 rounded">- Call accountant about tax forms</span><br>' +
    '<span class="font-mono bg-sky-100 px-1 rounded">- Send invoice to client</span><br>' +
    '<span class="font-mono bg-sky-100 px-1 rounded">- Schedule meeting with bank</span><br>' +
    'Indent a line with tab/spaces to add a description to the task above it.</div></div>' +
    // Textarea
    '<div class="mb-4">' +
    '<textarea id="qa_text" class="w-full border-2 border-gray-200 rounded-xl p-4 text-sm focus:border-sky-500 focus:ring-2 focus:ring-sky-200 transition-colors" rows="8" placeholder="Paste your task list here...&#10;&#10;Examples:&#10;- Review contracts for Lion MDs&#10;- File quarterly taxes&#10;    Need W2 forms from payroll&#10;- Order new office supplies&#10;- Schedule dentist appointment" style="min-height:180px;font-size:15px !important"></textarea>' +
    '</div>' +
    // Options row
    '<div class="flex flex-col sm:flex-row gap-3 mb-4">' +
    companyPicker +
    '<div class="flex-1"><label class="text-sm font-medium text-gray-700 mb-1 block">Project (optional)</label><select id="qa_project" class="w-full text-sm border rounded-lg px-3 py-2"><option value="">No project</option>'+CS.projects.map(p=>'<option value="'+p.id+'">'+esc(p.name)+'</option>').join('')+'</select></div>' +
    '</div>' +
    // Submit
    '<button onclick="submitQuickAdd()" id="qa_submit" class="w-full bg-sky-600 text-white py-3 rounded-xl text-sm font-bold hover:bg-sky-700 transition-colors flex items-center justify-center gap-2"' +
    (CS.quickAddLoading ? ' disabled style="opacity:0.7"' : '') + '>' +
    (CS.quickAddLoading ? '<i class="fas fa-spinner fa-spin"></i><span>Creating tasks...</span>' : '<i class="fas fa-paper-plane"></i><span>Create Tasks</span>') +
    '</button>' +
    '</div>';
}

async function submitQuickAdd() {
  const textEl = document.getElementById('qa_text');
  if (!textEl || !textEl.value.trim()) { alert('Please paste or type your task list'); return; }

  CS.quickAddLoading = true; render();
  // Keep text in textarea during loading
  const savedText = textEl ? textEl.value : '';

  const payload = { text: savedText };
  const companyEl = document.getElementById('qa_company');
  if (companyEl && companyEl.value) payload.client_id = parseInt(companyEl.value);
  const projectEl = document.getElementById('qa_project');
  if (projectEl && projectEl.value) payload.project_id = parseInt(projectEl.value);

  try {
    const res = await API.post('/api/tasks/bulk', payload);
    CS.quickAddLoading = false;
    if (res && res.created) {
      CS.quickAddResult = res;
      await loadTasks();
    } else {
      alert(res?.error || 'Something went wrong. Please try again.');
    }
  } catch (e) {
    CS.quickAddLoading = false;
    alert('Connection error. Please try again.');
  }
  render();
  // Restore text if still on the form
  if (!CS.quickAddResult) {
    const el = document.getElementById('qa_text');
    if (el) el.value = savedText;
  }
}

function renderClientTasks() {
  // Quick Add section at top (always visible, collapsible)
  const quickAddSection = CS.showQuickAdd ? renderQuickAdd() :
    '<div class="bg-gradient-to-r from-sky-50 to-indigo-50 rounded-2xl border border-sky-200 p-4 mb-4 cursor-pointer" onclick="CS.showQuickAdd=true;CS.quickAddResult=null;render()">' +
    '<div class="flex items-center gap-3">' +
    '<div class="w-10 h-10 bg-sky-500 rounded-xl flex items-center justify-center flex-shrink-0"><i class="fas fa-paste text-white"></i></div>' +
    '<div class="flex-1"><div class="font-semibold text-gray-800 text-sm">Quick Add Tasks</div>' +
    '<div class="text-xs text-gray-500">Paste a list from Google Sheets or type tasks one per line</div></div>' +
    '<i class="fas fa-chevron-right text-sky-400"></i>' +
    '</div></div>';

  return quickAddSection +
    '<div class="flex flex-wrap items-center gap-2 md:gap-3 mb-4">' +
    // Sort dropdown
    '<select onchange="CS.sort=this.value;loadTasks().then(render)" class="text-sm border rounded-lg px-3 py-2 flex-1 md:flex-none"><option value="due_date"'+(CS.sort==='due_date'?' selected':'')+'>Sort: Due Date</option><option value="priority"'+(CS.sort==='priority'?' selected':'')+'>Sort: Priority</option><option value="status"'+(CS.sort==='status'?' selected':'')+'>Sort: Status</option><option value="created"'+(CS.sort==='created'?' selected':'')+'>Sort: Newest</option></select>' +
    // Hide done toggle
    '<button onclick="CS.hideDone=!CS.hideDone;loadTasks().then(render)" class="flex items-center gap-1.5 px-3 py-2 border rounded-lg text-sm '+(CS.hideDone?'bg-green-50 border-green-300 text-green-700':'bg-white text-gray-500')+'" title="'+(CS.hideDone?'Completed hidden - tap to show':'Showing all - tap to hide completed')+'"><i class="fas fa-'+(CS.hideDone?'eye-slash':'eye')+'"></i><span class="hidden sm:inline">'+(CS.hideDone?'Done hidden':'Showing all')+'</span></button>' +
    '<select onchange="CS.filters.status=this.value;loadTasks().then(render)" class="text-sm border rounded-lg px-3 py-2 flex-1 md:flex-none"><option value="">All Statuses</option><option value="todo"'+(CS.filters.status==='todo'?' selected':'')+'>To Do</option><option value="in_progress"'+(CS.filters.status==='in_progress'?' selected':'')+'>In Progress</option><option value="review"'+(CS.filters.status==='review'?' selected':'')+'>Review</option><option value="done"'+(CS.filters.status==='done'?' selected':'')+'>Done</option></select>' +
    '<select onchange="CS.filters.project_id=this.value;loadTasks().then(render)" class="text-sm border rounded-lg px-3 py-2 flex-1 md:flex-none"><option value="">All Projects</option>'+CS.projects.map(p=>'<option value="'+p.id+'"'+(CS.filters.project_id==p.id?' selected':'')+'>'+esc(p.name)+'</option>').join('')+'</select>' +
    renderCompanyFilter() +
    '<button onclick="CS.showNewTask=true;render()" class="w-full md:w-auto md:ml-auto bg-sky-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-sky-700 flex items-center justify-center gap-1"><i class="fas fa-plus"></i><span>Request Task</span></button></div>' +
    '<div class="space-y-3">' +
    CS.tasks.map(t => '<div class="task-card bg-white rounded-xl border p-3 md:p-4 cursor-pointer" onclick="loadTaskDetail('+t.id+')">' +
      '<div class="flex items-start gap-2 md:gap-3 mb-2"><div class="flex-1 min-w-0"><h3 class="font-semibold text-sm leading-snug">'+esc(t.title)+'</h3><div class="flex flex-wrap items-center gap-2 mt-1.5">'+(t.project_name?'<span class="text-xs text-gray-500"><i class="fas fa-folder mr-1"></i>'+esc(t.project_name)+'</span>':'')+(CS.hasMultiCompany && t.client_name ? companyChip(t.client_name) : '')+'</div></div><div class="flex items-center gap-2 flex-shrink-0">'+priorityIcon(t.priority)+'<span class="status-badge '+statusColor(t.status)+'">'+t.status.replace('_',' ')+'</span></div></div>' +
      '<div class="flex flex-wrap items-center gap-3 text-xs text-gray-500">'+dueLabel(t.due_date)+(t.comment_count>0?'<span><i class="fas fa-comment mr-1"></i>'+t.comment_count+'</span>':'')+(t.subtask_count>0?'<span><i class="fas fa-sitemap mr-1"></i>'+t.subtask_done_count+'/'+t.subtask_count+'</span>':'')+'</div></div>').join('') +
    (CS.tasks.length===0?'<div class="bg-white rounded-xl border p-12 text-center"><i class="fas fa-inbox text-4xl text-gray-300 mb-3"></i><p class="text-gray-500">No tasks found</p></div>':'') +
    '</div>';
}

function renderClientProjects() {
  return '<div class="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">' +
    CS.projects.map(p => {
      const pct = p.task_count > 0 ? Math.round((p.done_count / p.task_count) * 100) : 0;
      return '<div class="bg-white rounded-xl border p-5 cursor-pointer hover:shadow-md transition-shadow" onclick="CS.filters.project_id=&#39;'+p.id+'&#39;;CS.tab=&#39;tasks&#39;;loadTasks().then(render)">' +
        '<div class="flex items-center gap-2 mb-2"><h3 class="font-bold flex-1" style="color:'+esc(p.color||'#0ea5e9')+'">'+esc(p.name)+'</h3>'+(CS.hasMultiCompany && p.client_name ? companyChip(p.client_name) : '')+'</div>' +
        (p.description?'<p class="text-sm text-gray-600 mb-3">'+esc(p.description)+'</p>':'') +
        '<div class="flex items-center gap-3"><div class="flex-1 bg-gray-200 rounded-full h-2"><div class="bg-sky-500 rounded-full h-2" style="width:'+pct+'%"></div></div><span class="text-xs text-gray-500">'+pct+'%</span></div>' +
        '<div class="text-xs text-gray-500 mt-2">'+p.done_count+' of '+p.task_count+' tasks complete</div></div>';
    }).join('') + '</div>';
}

function renderClientNotifications() {
  return '<div class="bg-white rounded-xl border overflow-hidden">'+(CS.notifications.length===0?'<div class="p-12 text-center text-gray-500">No notifications</div>':CS.notifications.map(n=>'<div class="p-4 border-b hover:bg-gray-50 '+(n.is_read?'opacity-60':'')+' cursor-pointer" onclick="readNotif('+n.id+','+(n.task_id||'null')+')"><div class="text-sm font-medium">'+esc(n.title)+'</div><div class="text-sm text-gray-500">'+esc(n.message)+'</div><div class="text-xs text-gray-400 mt-1">'+timeAgo(n.created_at)+'</div></div>').join(''))+'</div>';
}

async function readNotif(id, taskId) {
  await API.put('/api/notifications/read', {ids:[id]});
  if(taskId) loadTaskDetail(taskId); else { await loadNotifications(); render(); }
}

function renderTaskDetail() {
  const t = CS.selectedTask; if(!t)return'';
  return '<div class="fixed inset-0 z-50 modal-overlay flex items-end md:items-start justify-center md:pt-16 px-0 md:px-4" onclick="if(event.target===this){CS.showTaskModal=false;render()}">' +
    '<div class="bg-white rounded-t-2xl md:rounded-2xl shadow-2xl w-full max-w-2xl max-h-[95vh] md:max-h-[85vh] overflow-hidden flex flex-col slide-up md:fade-in">' +
    '<div class="px-4 md:px-6 py-3 md:py-4 border-b flex items-center justify-between bg-gray-50"><div class="flex items-center gap-2 flex-1 min-w-0"><span class="status-badge '+statusColor(t.status)+'">'+t.status.replace('_',' ')+'</span>'+priorityIcon(t.priority)+(t.project_name?'<span class="text-xs text-gray-500 truncate">'+esc(t.project_name)+'</span>':'')+(CS.hasMultiCompany && t.client_name ? companyChip(t.client_name) : '')+'</div><button onclick="CS.showTaskModal=false;render()" class="text-gray-400 hover:text-gray-700 flex items-center justify-center flex-shrink-0" style="width:44px;height:44px"><i class="fas fa-times text-lg"></i></button></div>' +
    '<div class="flex-1 overflow-y-auto p-4 md:p-6" style="-webkit-overflow-scrolling:touch">' +
    // Editable title
    '<div class="mb-3"><input type="text" value="'+esc(t.title)+'" class="text-xl font-bold w-full border-0 border-b-2 border-transparent focus:border-sky-500 focus:ring-0 p-0 bg-transparent" onchange="updateClientTask('+t.id+',&#39;title&#39;,this.value)"></div>' +
    // Editable description
    '<div class="mb-4"><label class="text-xs font-semibold text-gray-500 block mb-1">Description</label><textarea class="w-full border border-gray-200 rounded-lg p-3 text-sm min-h-[60px] focus:ring-2 focus:ring-sky-200" onchange="updateClientTask('+t.id+',&#39;description&#39;,this.value)">'+esc(t.description||'')+'</textarea></div>' +
    '<div class="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">' +
    '<div><label class="text-xs font-semibold text-gray-500 block mb-1">Status</label><select onchange="updateClientTask('+t.id+',&#39;status&#39;,this.value)" class="w-full text-sm border rounded-lg px-3 py-2"><option value="todo"'+(t.status==='todo'?' selected':'')+'>To Do</option><option value="in_progress"'+(t.status==='in_progress'?' selected':'')+'>In Progress</option><option value="review"'+(t.status==='review'?' selected':'')+'>Review</option><option value="done"'+(t.status==='done'?' selected':'')+'>Done</option></select></div>' +
    '<div><label class="text-xs font-semibold text-gray-500 block mb-1">Priority</label><select onchange="updateClientTask('+t.id+',&#39;priority&#39;,this.value)" class="w-full text-sm border rounded-lg px-3 py-2"><option value="urgent"'+(t.priority==='urgent'?' selected':'')+'>Urgent</option><option value="high"'+(t.priority==='high'?' selected':'')+'>High</option><option value="medium"'+(t.priority==='medium'?' selected':'')+'>Medium</option><option value="low"'+(t.priority==='low'?' selected':'')+'>Low</option></select></div>' +
    '<div><label class="text-xs font-semibold text-gray-500 block mb-1">Due Date</label><input type="datetime-local" value="'+(t.due_date?t.due_date.slice(0,16):'')+'" onchange="updateClientTask('+t.id+',&#39;due_date&#39;,this.value)" class="w-full text-sm border rounded-lg px-3 py-2"></div></div>' +
    // Subtasks
    (t.subtasks?.length?'<div class="mb-6"><h3 class="text-sm font-bold text-gray-700 mb-2">Subtasks</h3><div class="space-y-1">'+t.subtasks.map(s=>'<div class="flex items-center gap-2 p-2 rounded bg-gray-50"><div class="w-4 h-4 rounded-full border '+(s.status==='done'?'bg-green-500 border-green-500':'border-gray-300')+'"></div><span class="text-sm '+(s.status==='done'?'line-through text-gray-400':'')+'">'+esc(s.title)+'</span></div>').join('')+'</div></div>':'') +
    // Attachments
    '<div class="mb-6"><h3 class="text-sm font-bold text-gray-700 mb-2">Files ('+((t.attachments||[]).length)+')</h3>' +
    '<div class="space-y-1">'+(t.attachments||[]).map(a=>'<div class="flex items-center gap-2 p-2 bg-gray-50 rounded">' +
      '<i class="fas fa-'+clientFileIcon(a.mime_type||a.filename)+' text-gray-400"></i>' +
      (a.file_data || (a.file_url && a.file_url.indexOf('/files/')!==-1) ?
        '<a href="/files/'+a.id+'" target="_blank" class="text-sm text-sky-600 hover:underline flex-1 truncate">'+esc(a.filename)+'</a>' :
        a.file_url ? '<a href="'+esc(a.file_url)+'" target="_blank" class="text-sm text-sky-600 hover:underline flex-1 truncate">'+esc(a.filename)+'</a>' :
        '<span class="text-sm flex-1 truncate">'+esc(a.filename)+'</span>') +
      (a.file_size ? '<span class="text-xs text-gray-400">'+clientFormatSize(a.file_size)+'</span>' : '') +
      '</div>').join('')+'</div>' +
    '<div class="mt-2"><label class="flex items-center gap-2 cursor-pointer text-sm text-sky-600 hover:text-sky-800 bg-sky-50 border border-dashed border-sky-300 rounded-lg px-4 py-3 justify-center hover:bg-sky-100 transition-colors"><i class="fas fa-cloud-upload-alt"></i><span>Attach a file</span><input type="file" id="clientFileUpload" class="hidden" onchange="clientUploadFile('+t.id+',this)"></label>' +
    '<div id="clientUploadProgress" class="hidden mt-2 text-xs text-gray-500 text-center"><i class="fas fa-spinner fa-spin mr-1"></i>Uploading...</div></div></div>' +
    // Comments
    '<div class="mb-4"><h3 class="text-sm font-bold text-gray-700 mb-2">Comments</h3><div class="space-y-3 mb-3">' +
    (t.comments||[]).map(cm=>'<div class="flex gap-3"><div class="w-8 h-8 bg-sky-100 rounded-full flex items-center justify-center text-sky-700 text-xs font-bold flex-shrink-0">'+esc((cm.author_name||'?').charAt(0))+'</div><div><div class="flex items-center gap-2"><span class="text-sm font-semibold">'+esc(cm.author_name)+'</span><span class="text-xs text-gray-400">'+timeAgo(cm.created_at)+'</span></div><div class="text-sm text-gray-700 mt-1">'+esc(cm.content)+'</div></div></div>').join('') +
    '</div><div class="flex gap-2"><textarea id="clientComment" placeholder="Add a comment..." class="flex-1 text-sm border rounded-lg px-3 py-2 min-h-[50px]"></textarea></div><button onclick="addClientComment('+t.id+')" class="mt-2 bg-sky-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-sky-700"><i class="fas fa-paper-plane mr-1"></i>Comment</button></div>' +
    '</div></div></div>';
}

async function updateClientTask(id, field, value) {
  await API.put('/api/tasks/'+id, {[field]:value});
  await loadTasks(); await loadTaskDetail(id);
}

async function addClientComment(taskId) {
  const el = document.getElementById('clientComment');
  if(!el.value.trim())return;
  await API.post('/api/tasks/'+taskId+'/comments', {content:el.value.trim()});
  el.value='';
  await loadTaskDetail(taskId);
}

async function clientUploadFile(taskId, input) {
  if (!input.files || !input.files[0]) return;
  var file = input.files[0];
  if (file.size > 25 * 1024 * 1024) { alert('File too large. Maximum 25MB.'); input.value = ''; return; }
  var prog = document.getElementById('clientUploadProgress');
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
    if (!res.ok) { var err = await res.json().catch(function(){return {}}); alert(err.error || 'Upload failed'); }
    else { await loadTaskDetail(taskId); }
  } catch(e) { alert('Upload failed. Please try again.'); }
  if (prog) prog.classList.add('hidden');
  input.value = '';
}

function clientFileIcon(nameOrMime) {
  if (!nameOrMime) return 'file';
  var s = nameOrMime.toLowerCase();
  if (s.indexOf('image') !== -1 || /\.(jpg|jpeg|png|gif|svg|webp)$/i.test(s)) return 'file-image';
  if (s.indexOf('pdf') !== -1 || /\.pdf$/i.test(s)) return 'file-pdf';
  if (s.indexOf('word') !== -1 || /\.(doc|docx)$/i.test(s)) return 'file-word';
  if (s.indexOf('sheet') !== -1 || s.indexOf('excel') !== -1 || /\.(xls|xlsx|csv)$/i.test(s)) return 'file-excel';
  if (s.indexOf('zip') !== -1 || /\.(zip|rar|7z)$/i.test(s)) return 'file-archive';
  if (s.indexOf('video') !== -1 || /\.(mp4|mov|avi)$/i.test(s)) return 'file-video';
  return 'file';
}

function clientFormatSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

function renderNewTask() {
  // Build company selector for multi-company clients
  let companySelect = '';
  if (CS.hasMultiCompany) {
    const companies = [{id:CS.client.id, name:CS.client.company_name}, ...CS.linkedCompanies.map(c=>({id:c.id, name:c.company_name}))];
    companySelect = '<div><label class="text-sm font-medium text-gray-700 mb-1 block">Company</label><select id="cnt_company" class="w-full text-sm border rounded-lg px-3 py-2">' +
      companies.map(c=>'<option value="'+c.id+'">'+esc(c.name)+'</option>').join('') + '</select></div>';
  }

  return '<div class="fixed inset-0 z-50 modal-overlay flex items-end md:items-start justify-center md:pt-12 px-0 md:px-4" onclick="if(event.target===this){CS.showNewTask=false;render()}">' +
    '<div class="bg-white rounded-t-2xl md:rounded-2xl shadow-2xl w-full max-w-md slide-up md:fade-in"><div class="px-4 md:px-6 py-3 md:py-4 border-b flex items-center justify-between"><h3 class="font-bold"><i class="fas fa-plus-circle text-sky-500 mr-2"></i>Request a Task</h3><button onclick="CS.showNewTask=false;render()" class="text-gray-400 hover:text-gray-700 flex items-center justify-center" style="width:44px;height:44px"><i class="fas fa-times"></i></button></div>' +
    '<form id="clientNewTask" class="p-4 md:p-6 space-y-4 overflow-y-auto" style="max-height:calc(95vh - 60px);-webkit-overflow-scrolling:touch">' +
    '<input type="text" id="cnt_title" required class="w-full border rounded-lg px-3 py-2 text-sm" placeholder="What do you need?">' +
    '<textarea id="cnt_desc" class="w-full border rounded-lg px-3 py-2 text-sm min-h-[80px]" placeholder="Describe the task in detail..."></textarea>' +
    '<div class="grid grid-cols-2 gap-4"><div><select id="cnt_priority" class="w-full text-sm border rounded-lg px-3 py-2"><option value="medium">Medium</option><option value="urgent">Urgent</option><option value="high">High</option><option value="low">Low</option></select></div>' +
    '<div><select id="cnt_project" class="w-full text-sm border rounded-lg px-3 py-2"><option value="">Select Project</option>'+CS.projects.map(p=>'<option value="'+p.id+'">'+esc(p.name)+'</option>').join('')+'</select></div></div>' +
    companySelect +
    '<div class="flex justify-end gap-3"><button type="button" onclick="CS.showNewTask=false;render()" class="px-4 py-2 border rounded-lg text-sm">Cancel</button><button type="submit" class="px-6 py-2 bg-sky-600 text-white rounded-lg text-sm font-semibold">Submit Request</button></div></form></div></div>';
}

function bindEvents() {
  const form = document.getElementById('clientNewTask');
  if (form) form.onsubmit = async(e) => {
    e.preventDefault();
    const payload = {
      title: document.getElementById('cnt_title').value,
      description: document.getElementById('cnt_desc').value,
      priority: document.getElementById('cnt_priority').value,
      project_id: document.getElementById('cnt_project').value || null,
    };
    // If multi-company and a company is selected, pass client_id
    const companyEl = document.getElementById('cnt_company');
    if (companyEl && companyEl.value) {
      payload.client_id = parseInt(companyEl.value);
    }
    await API.post('/api/tasks', payload);
    CS.showNewTask = false;
    await loadTasks(); render();
  };
}

function renderClientSettings() {
  return '<div class="max-w-lg">' +
    '<div class="bg-white rounded-xl border p-6 mb-4"><h3 class="font-bold mb-3"><i class="fas fa-user text-sky-500 mr-2"></i>Your Account</h3>' +
    '<div class="flex items-center gap-3"><div class="w-12 h-12 bg-sky-100 rounded-full flex items-center justify-center text-sky-700 text-lg font-bold">'+esc((CS.client?.contact_name||'?').charAt(0))+'</div><div><div class="font-bold">'+esc(CS.client?.contact_name)+'</div><div class="text-sm text-gray-500">'+esc(CS.client?.company_name)+'</div><div class="text-xs text-gray-400">'+esc(CS.client?.email)+'</div></div></div></div>' +
    '<div class="bg-white rounded-xl border p-6 mb-4"><h3 class="font-bold mb-3"><i class="fas fa-lock text-sky-500 mr-2"></i>Change Password</h3>' +
    '<form onsubmit="event.preventDefault();clientChangePassword(this)" class="space-y-3">' +
    '<input type="password" id="ccp_current" required class="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Current password">' +
    '<input type="password" id="ccp_new" required class="w-full border rounded-lg px-3 py-2 text-sm" placeholder="New password (min 6 characters)" minlength="6">' +
    '<input type="password" id="ccp_confirm" required class="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Confirm new password" minlength="6">' +
    '<div id="ccpResult" class="hidden text-sm p-2 rounded-lg"></div>' +
    '<button type="submit" class="bg-sky-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-sky-700"><i class="fas fa-save mr-1"></i>Update Password</button></form></div>' +
    '<div class="bg-white rounded-xl border p-6"><button onclick="clientLogout()" class="bg-red-50 text-red-600 text-sm px-4 py-2 rounded-lg hover:bg-red-100 border border-red-200"><i class="fas fa-sign-out-alt mr-1"></i>Sign Out</button></div></div>';
}

async function clientChangePassword(form) {
  var cpNew = document.getElementById('ccp_new').value;
  var cpConfirm = document.getElementById('ccp_confirm').value;
  var resultEl = document.getElementById('ccpResult');
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
      body: JSON.stringify({ current_password: document.getElementById('ccp_current').value, new_password: cpNew })
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
    resultEl.textContent = 'Connection error. Please try again.';
    resultEl.classList.remove('hidden');
  }
}

function clientLogout() {
  localStorage.removeItem('flexbiz_client_token');
  localStorage.removeItem('flexbiz_client');
  localStorage.removeItem('flexbiz_linked_companies');
  localStorage.removeItem('flexbiz_all_client_ids');
  window.location.href = '/client/login';
}

init();
</script>
</body>
</html>`
}
