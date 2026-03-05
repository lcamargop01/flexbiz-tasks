export function renderClientPortal(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>FlexBiz Solutions - Client Portal</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script>tailwind.config={theme:{extend:{colors:{primary:'#0ea5e9'}}}}</script>
  <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
  <style>
    * { scrollbar-width: thin; scrollbar-color: #bae6fd #f0f9ff; }
    .task-card:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
    .task-card { transition: all 0.2s; }
    .status-badge { font-size: 11px; padding: 2px 8px; border-radius: 10px; font-weight: 600; }
    .modal-overlay { background: rgba(0,0,0,0.5); backdrop-filter: blur(4px); }
    .fade-in { animation: fadeIn 0.2s ease-in; }
    @keyframes fadeIn { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
  </style>
</head>
<body class="bg-gray-50 min-h-screen">
<div id="app"></div>
<script>
const CS = { client: null, token: null, tasks: [], projects: [], notifications: [], unreadCount: 0, dashboard: null, selectedTask: null, showTaskModal: false, showNewTask: false, filters: { status: '', project_id: '' }, tab: 'tasks' };

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

async function init() {
  CS.token = localStorage.getItem('flexbiz_client_token');
  CS.client = JSON.parse(localStorage.getItem('flexbiz_client') || 'null');
  if (!CS.token || !CS.client) { window.location.href = '/client/login'; return; }
  render();
  await Promise.all([loadTasks(), loadProjects(), loadDashboard(), loadNotifications()]);
  render();
}

async function loadTasks() {
  const params = new URLSearchParams(); params.set('parent_task_id', 'null');
  if (CS.filters.status) params.set('status', CS.filters.status);
  if (CS.filters.project_id) params.set('project_id', CS.filters.project_id);
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
  document.getElementById('app').innerHTML = renderHeader() + '<div class="max-w-6xl mx-auto px-4 py-6">' + renderTabs() + renderContent() + '</div>' + (CS.showTaskModal ? renderTaskDetail() : '') + (CS.showNewTask ? renderNewTask() : '');
  bindEvents();
}

function renderHeader() {
  return '<header class="bg-white border-b shadow-sm sticky top-0 z-20"><div class="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">' +
    '<div class="flex items-center gap-3"><div class="w-9 h-9 bg-sky-600 rounded-lg flex items-center justify-center"><i class="fas fa-handshake text-white text-sm"></i></div><div><div class="font-bold text-gray-800 text-sm">FlexBiz Solutions</div><div class="text-xs text-gray-500">Client Portal</div></div></div>' +
    '<div class="flex items-center gap-4"><span class="text-sm font-medium text-gray-700 hidden md:block">'+esc(CS.client?.company_name)+'</span>' +
    '<button onclick="CS.tab=\'notifications\';render()" class="relative p-2"><i class="fas fa-bell text-gray-500"></i>'+(CS.unreadCount>0?'<span class="absolute top-0 right-0 bg-red-500 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center">'+CS.unreadCount+'</span>':'')+'</button>' +
    '<button onclick="clientLogout()" class="text-gray-400 hover:text-gray-600"><i class="fas fa-sign-out-alt"></i></button></div></div></header>';
}

function renderTabs() {
  const tabs = [{id:'dashboard',icon:'fas fa-th-large',label:'Overview'},{id:'tasks',icon:'fas fa-tasks',label:'Tasks'},{id:'projects',icon:'fas fa-project-diagram',label:'Projects'},{id:'notifications',icon:'fas fa-bell',label:'Notifications'}];
  return '<div class="flex gap-1 mb-6 border-b"><div class="flex overflow-x-auto">'+tabs.map(t=>'<button onclick="CS.tab=\''+t.id+'\';render()" class="px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors '+(CS.tab===t.id?'border-sky-500 text-sky-600':'border-transparent text-gray-500 hover:text-gray-700')+'"><i class="'+t.icon+' mr-2"></i>'+t.label+(t.id==='notifications'&&CS.unreadCount>0?' <span class="bg-red-500 text-white text-[10px] px-1.5 rounded-full ml-1">'+CS.unreadCount+'</span>':'')+'</button>').join('')+'</div></div>';
}

function renderContent() {
  if (CS.tab === 'dashboard') return renderClientDashboard();
  if (CS.tab === 'tasks') return renderClientTasks();
  if (CS.tab === 'projects') return renderClientProjects();
  if (CS.tab === 'notifications') return renderClientNotifications();
  return '';
}

function renderClientDashboard() {
  const d = CS.dashboard || {};
  const sc = {}; (d.tasksByStatus||[]).forEach(s=>sc[s.status]=s.count);
  return '<div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">' +
    '<div class="bg-white rounded-xl border p-4"><div class="text-2xl font-bold text-red-600">'+(d.overdueTasks||0)+'</div><div class="text-xs text-gray-500">Overdue</div></div>' +
    '<div class="bg-white rounded-xl border p-4"><div class="text-2xl font-bold text-blue-600">'+(sc['in_progress']||0)+'</div><div class="text-xs text-gray-500">In Progress</div></div>' +
    '<div class="bg-white rounded-xl border p-4"><div class="text-2xl font-bold text-purple-600">'+(sc['review']||0)+'</div><div class="text-xs text-gray-500">In Review</div></div>' +
    '<div class="bg-white rounded-xl border p-4"><div class="text-2xl font-bold text-green-600">'+(sc['done']||0)+'</div><div class="text-xs text-gray-500">Completed</div></div></div>' +
    '<div class="bg-white rounded-xl border p-6"><h3 class="font-bold mb-4">Recent Tasks</h3><div class="space-y-2">'+(d.recentTasks||[]).map(t=>'<div class="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer" onclick="loadTaskDetail('+t.id+')">'+priorityIcon(t.priority)+'<span class="text-sm flex-1">'+esc(t.title)+'</span><span class="status-badge '+statusColor(t.status)+'">'+t.status.replace('_',' ')+'</span>'+dueLabel(t.due_date)+'</div>').join('')+'</div></div>';
}

function renderClientTasks() {
  return '<div class="flex flex-wrap items-center gap-3 mb-4">' +
    '<select onchange="CS.filters.status=this.value;loadTasks().then(render)" class="text-sm border rounded-lg px-3 py-2"><option value="">All Statuses</option><option value="todo">To Do</option><option value="in_progress">In Progress</option><option value="review">Review</option><option value="done">Done</option></select>' +
    '<select onchange="CS.filters.project_id=this.value;loadTasks().then(render)" class="text-sm border rounded-lg px-3 py-2"><option value="">All Projects</option>'+CS.projects.map(p=>'<option value="'+p.id+'">'+esc(p.name)+'</option>').join('')+'</select>' +
    '<button onclick="CS.showNewTask=true;render()" class="ml-auto bg-sky-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-sky-700"><i class="fas fa-plus mr-1"></i>Request Task</button></div>' +
    '<div class="space-y-3">' +
    CS.tasks.map(t => '<div class="task-card bg-white rounded-xl border p-4 cursor-pointer" onclick="loadTaskDetail('+t.id+')">' +
      '<div class="flex items-center gap-3 mb-2"><div class="flex-1"><h3 class="font-semibold text-sm">'+esc(t.title)+'</h3>'+(t.project_name?'<span class="text-xs text-gray-500"><i class="fas fa-folder mr-1"></i>'+esc(t.project_name)+'</span>':'')+'</div>'+priorityIcon(t.priority)+'<span class="status-badge '+statusColor(t.status)+'">'+t.status.replace('_',' ')+'</span></div>' +
      '<div class="flex items-center gap-4 text-xs text-gray-500">'+dueLabel(t.due_date)+(t.comment_count>0?'<span><i class="fas fa-comment mr-1"></i>'+t.comment_count+'</span>':'')+(t.subtask_count>0?'<span><i class="fas fa-sitemap mr-1"></i>'+t.subtask_done_count+'/'+t.subtask_count+'</span>':'')+'</div></div>').join('') +
    (CS.tasks.length===0?'<div class="bg-white rounded-xl border p-12 text-center"><i class="fas fa-inbox text-4xl text-gray-300 mb-3"></i><p class="text-gray-500">No tasks found</p></div>':'') +
    '</div>';
}

function renderClientProjects() {
  return '<div class="grid md:grid-cols-2 gap-4">' +
    CS.projects.map(p => {
      const pct = p.task_count > 0 ? Math.round((p.done_count / p.task_count) * 100) : 0;
      return '<div class="bg-white rounded-xl border p-5 cursor-pointer hover:shadow-md transition-shadow" onclick="CS.filters.project_id=\''+p.id+'\';CS.tab=\'tasks\';loadTasks().then(render)">' +
        '<h3 class="font-bold mb-2" style="color:'+esc(p.color||'#0ea5e9')+'">'+esc(p.name)+'</h3>' +
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
  return '<div class="fixed inset-0 z-50 modal-overlay flex items-start justify-center pt-8 px-4" onclick="if(event.target===this){CS.showTaskModal=false;render()}">' +
    '<div class="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col fade-in">' +
    '<div class="px-6 py-4 border-b flex items-center justify-between bg-gray-50"><div class="flex items-center gap-2"><span class="status-badge '+statusColor(t.status)+'">'+t.status.replace('_',' ')+'</span>'+priorityIcon(t.priority)+(t.project_name?'<span class="text-xs text-gray-500">'+esc(t.project_name)+'</span>':'')+'</div><button onclick="CS.showTaskModal=false;render()" class="text-gray-400 hover:text-gray-700"><i class="fas fa-times"></i></button></div>' +
    '<div class="flex-1 overflow-y-auto p-6">' +
    '<h2 class="text-xl font-bold mb-3">'+esc(t.title)+'</h2>' +
    (t.description?'<p class="text-sm text-gray-600 mb-4 whitespace-pre-wrap">'+esc(t.description)+'</p>':'') +
    '<div class="grid grid-cols-2 gap-4 mb-6">' +
    '<div><label class="text-xs font-semibold text-gray-500 block mb-1">Status</label><select onchange="updateClientTask('+t.id+',\'status\',this.value)" class="w-full text-sm border rounded-lg px-3 py-2"><option value="todo"'+(t.status==='todo'?' selected':'')+'>To Do</option><option value="in_progress"'+(t.status==='in_progress'?' selected':'')+'>In Progress</option><option value="review"'+(t.status==='review'?' selected':'')+'>Review</option><option value="done"'+(t.status==='done'?' selected':'')+'>Done</option></select></div>' +
    '<div><label class="text-xs font-semibold text-gray-500 block mb-1">Due Date</label><div class="text-sm">'+dueLabel(t.due_date)+'</div></div></div>' +
    // Subtasks
    (t.subtasks?.length?'<div class="mb-6"><h3 class="text-sm font-bold text-gray-700 mb-2">Subtasks</h3><div class="space-y-1">'+t.subtasks.map(s=>'<div class="flex items-center gap-2 p-2 rounded bg-gray-50"><div class="w-4 h-4 rounded-full border '+(s.status==='done'?'bg-green-500 border-green-500':'border-gray-300')+'"></div><span class="text-sm '+(s.status==='done'?'line-through text-gray-400':'')+'">'+esc(s.title)+'</span></div>').join('')+'</div></div>':'') +
    // Attachments
    (t.attachments?.length?'<div class="mb-6"><h3 class="text-sm font-bold text-gray-700 mb-2">Files</h3><div class="space-y-1">'+t.attachments.map(a=>'<div class="flex items-center gap-2 p-2 bg-gray-50 rounded"><i class="fas fa-file text-gray-400"></i><span class="text-sm">'+esc(a.filename)+'</span></div>').join('')+'</div></div>':'') +
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

function renderNewTask() {
  return '<div class="fixed inset-0 z-50 modal-overlay flex items-start justify-center pt-12 px-4" onclick="if(event.target===this){CS.showNewTask=false;render()}">' +
    '<div class="bg-white rounded-2xl shadow-2xl w-full max-w-md fade-in"><div class="px-6 py-4 border-b"><h3 class="font-bold"><i class="fas fa-plus-circle text-sky-500 mr-2"></i>Request a Task</h3></div>' +
    '<form id="clientNewTask" class="p-6 space-y-4">' +
    '<input type="text" id="cnt_title" required class="w-full border rounded-lg px-3 py-2 text-sm" placeholder="What do you need?">' +
    '<textarea id="cnt_desc" class="w-full border rounded-lg px-3 py-2 text-sm min-h-[80px]" placeholder="Describe the task in detail..."></textarea>' +
    '<div class="grid grid-cols-2 gap-4"><div><select id="cnt_priority" class="w-full text-sm border rounded-lg px-3 py-2"><option value="medium">Medium</option><option value="urgent">Urgent</option><option value="high">High</option><option value="low">Low</option></select></div>' +
    '<div><select id="cnt_project" class="w-full text-sm border rounded-lg px-3 py-2"><option value="">Select Project</option>'+CS.projects.map(p=>'<option value="'+p.id+'">'+esc(p.name)+'</option>').join('')+'</select></div></div>' +
    '<div class="flex justify-end gap-3"><button type="button" onclick="CS.showNewTask=false;render()" class="px-4 py-2 border rounded-lg text-sm">Cancel</button><button type="submit" class="px-6 py-2 bg-sky-600 text-white rounded-lg text-sm font-semibold">Submit Request</button></div></form></div></div>';
}

function bindEvents() {
  const form = document.getElementById('clientNewTask');
  if (form) form.onsubmit = async(e) => {
    e.preventDefault();
    await API.post('/api/tasks', {
      title: document.getElementById('cnt_title').value,
      description: document.getElementById('cnt_desc').value,
      priority: document.getElementById('cnt_priority').value,
      project_id: document.getElementById('cnt_project').value || null,
    });
    CS.showNewTask = false;
    await loadTasks(); render();
  };
}

function clientLogout() {
  localStorage.removeItem('flexbiz_client_token');
  localStorage.removeItem('flexbiz_client');
  window.location.href = '/client/login';
}

init();
</script>
</body>
</html>`
}
