
// Use relative API base so frontend talks to Cloudflare Pages/Workers at `/api`.
// This preserves frontend behavior while routing requests to the new backend.
const API_BASE = '';

async function api(path, opts = {}) {
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`;

  const r = await fetch(url, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(opts.headers || {})
    },
    ...opts
  });

  let d = {};

  try {
    d = await r.json();
  } catch {}

  if (!r.ok) {
    throw new Error(d.error || 'Request failed');
  }

  return d;
}


function toast(msg) {
  let t = document.getElementById('toast');

  if (!t) {
    t = document.createElement('div');
    t.id = 'toast';
    t.className = 'toast';
    document.body.appendChild(t);
  }

  t.textContent = msg;
  t.classList.add('show');

  setTimeout(() => {
    t.classList.remove('show');
  }, 2600);
}


async function me() {
  try {
    return (await api('/api/me')).user;
  } catch {
    return null;
  }
}


async function logout() {
  await api('/api/logout', {
    method: 'POST'
  });

  location.href = '/';
}


async function requireUser() {
  const u = await me();

  if (!u) {
    location.href = '/login.html';
  }

  return u;
}


async function requireAdmin() {
  const u = await me();

  if (!u || u.role !== 'admin') {
    location.href = '/login.html';
  }

  return u;
}


function nav(active) {

  const links = [
    ['Problems', '/problems.html'],
    ['Contests', '/contests.html'],
    ['Articles', '/articles.html'],
    ['Archive', '/archive.html'],
    ['About', '/about.html']
  ];

  return `
    <header class="top">
      <div class="wrap nav">

        <a class="brand" href="/">
          ABLE
        </a>

        <nav class="navlinks">
          ${links.map(x => `
            <a
              class="${active === x[0] ? 'active' : ''}"
              href="${x[1]}"
            >
              ${x[0]}
            </a>
          `).join('')}
        </nav>

        <div class="actions" id="nav-actions">
          <a class="btn ghost" href="/login.html">
            Login
          </a>

          <a class="btn primary" href="/signup.html">
            Join Us
          </a>
        </div>

      </div>
    </header>
  `;
}


async function updateNavUser() {

  const box = document.getElementById('nav-actions');

  if (!box) return;

  const u = await me();

  if (!u) return;

  box.innerHTML = `
    <a class="btn ghost" href="/account.html">
      ${escapeHtml(u.name)}
    </a>

    ${
      u.role === 'admin'
        ? `<a class="btn" href="/admin.html">Admin</a>`
        : ''
    }

    <button class="btn primary" onclick="logout()">
      Log out
    </button>
  `;
}


function escapeHtml(x = '') {
  return String(x).replace(
    /[&<>"']/g,
    c => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[c])
  );
}


function shell(active, title, body) {

  document.title = `ABLE — ${title}`;

  document.body.innerHTML =
    nav(active) +
    body +
    footer();

  updateNavUser();
}


function footer() {

  return `
    <footer class="footer">

      <div class="wrap footgrid">

        <div>
          <div class="brand">
            ABLE
          </div>

          <div class="small">
            Olympiad mathematics for serious problem solvers.
          </div>
        </div>

        <div class="footlinks">
          <a href="/problems.html">Problems</a>
          <a href="/contests.html">Contests</a>
          <a href="/articles.html">Articles</a>
          <a href="/archive.html">Archive</a>
          <a href="/about.html">About Us</a>
        </div>

      </div>

    </footer>
  `;
}
