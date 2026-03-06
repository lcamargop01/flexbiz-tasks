export function renderClientLogin(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="icon" type="image/svg+xml" href="/favicon.svg">
  <title>FlexBiz Solutions - Client Portal</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
  <style>
    body { background: linear-gradient(135deg, #0ea5e9 0%, #6366f1 100%); min-height: 100vh; }
  </style>
</head>
<body class="flex items-center justify-center p-4">
  <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
    <div class="text-center mb-8">
      <div class="w-16 h-16 bg-sky-600 rounded-xl flex items-center justify-center mx-auto mb-4">
        <i class="fas fa-handshake text-white text-2xl"></i>
      </div>
      <h1 class="text-2xl font-bold text-gray-800">Client Portal</h1>
      <p class="text-gray-500 mt-1">FlexBiz Solutions LLC</p>
    </div>
    <form id="loginForm" class="space-y-4">
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Email</label>
        <input type="email" id="email" required class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent" placeholder="you@yourcompany.com">
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Password</label>
        <input type="password" id="password" required class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent" placeholder="Enter your password">
      </div>
      <div id="error" class="hidden text-red-600 text-sm bg-red-50 p-3 rounded-lg"></div>
      <button type="submit" class="w-full bg-sky-600 text-white py-3 rounded-lg font-semibold hover:bg-sky-700 transition-colors">
        <i class="fas fa-sign-in-alt mr-2"></i>Access Portal
      </button>
    </form>
    <div class="mt-6 text-center">
      <a href="/login" class="text-sky-600 hover:text-sky-800 text-sm font-medium">
        <i class="fas fa-arrow-left mr-1"></i>Employee Login
      </a>
    </div>
  </div>
  <script>
    if (localStorage.getItem('flexbiz_client_token')) window.location.href = '/client/portal';
    document.getElementById('loginForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const errEl = document.getElementById('error');
      errEl.classList.add('hidden');
      try {
        const res = await fetch('/auth/client/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: document.getElementById('email').value,
            password: document.getElementById('password').value
          })
        });
        const data = await res.json();
        if (data.error) { errEl.textContent = data.error; errEl.classList.remove('hidden'); return; }
        localStorage.setItem('flexbiz_client_token', data.token);
        localStorage.setItem('flexbiz_client', JSON.stringify(data.client));
        localStorage.setItem('flexbiz_linked_companies', JSON.stringify(data.linked_companies || []));
        localStorage.setItem('flexbiz_all_client_ids', JSON.stringify(data.all_client_ids || [data.client.id]));
        window.location.href = '/client/portal';
      } catch (err) { errEl.textContent = 'Connection error'; errEl.classList.remove('hidden'); }
    });
  </script>
</body>
</html>`
}
