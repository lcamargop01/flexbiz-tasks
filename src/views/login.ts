export function renderLogin(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="icon" type="image/svg+xml" href="/favicon.svg">
  <title>FlexBiz Solutions - Login</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
  <style>
    body { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh; }
  </style>
</head>
<body class="flex items-center justify-center p-4">
  <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
    <div class="text-center mb-8">
      <div class="w-16 h-16 bg-indigo-600 rounded-xl flex items-center justify-center mx-auto mb-4">
        <i class="fas fa-tasks text-white text-2xl"></i>
      </div>
      <h1 class="text-2xl font-bold text-gray-800">FlexBiz Solutions</h1>
      <p class="text-gray-500 mt-1">Task Management Platform</p>
    </div>
    <form id="loginForm" class="space-y-4">
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Email</label>
        <input type="email" id="email" required class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent" placeholder="you@flexbiz.com">
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Password</label>
        <input type="password" id="password" required class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent" placeholder="Enter your password">
      </div>
      <div id="error" class="hidden text-red-600 text-sm bg-red-50 p-3 rounded-lg"></div>
      <button type="submit" class="w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 transition-colors">
        <i class="fas fa-sign-in-alt mr-2"></i>Sign In
      </button>
    </form>
    <div class="mt-6 text-center">
      <a href="/client/login" class="text-indigo-600 hover:text-indigo-800 text-sm font-medium">
        <i class="fas fa-external-link-alt mr-1"></i>Client Portal Login
      </a>
    </div>
  </div>
  <script>
    if (localStorage.getItem('flexbiz_token')) window.location.href = '/';
    document.getElementById('loginForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const errEl = document.getElementById('error');
      errEl.classList.add('hidden');
      try {
        const res = await fetch('/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: document.getElementById('email').value,
            password: document.getElementById('password').value
          })
        });
        const data = await res.json();
        if (data.error) { errEl.textContent = data.error; errEl.classList.remove('hidden'); return; }
        localStorage.setItem('flexbiz_token', data.token);
        localStorage.setItem('flexbiz_user', JSON.stringify(data.user));
        window.location.href = '/';
      } catch (err) { errEl.textContent = 'Connection error'; errEl.classList.remove('hidden'); }
    });
  </script>
</body>
</html>`
}
