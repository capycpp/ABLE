const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'site');

if (fs.existsSync(OUT)) {
  fs.rmSync(OUT, { recursive: true, force: true });
}
fs.mkdirSync(OUT, { recursive: true });

// Copy top-level static files: *.html, *.css, app.js, style.css
const files = fs.readdirSync(ROOT);
const keepExt = ['.html', '.css', '.ico', '.png', '.jpg', '.jpeg', '.svg', '.webp'];
for (const f of files) {
  const full = path.join(ROOT, f);
  const stat = fs.statSync(full);
  if (stat.isFile()) {
    const ext = path.extname(f).toLowerCase();
    if (keepExt.includes(ext) || f === 'app.js') {
      fs.copyFileSync(full, path.join(OUT, f));
    }
  }
}

// Copy optional static directories if present
const copyDir = (name) => {
  const src = path.join(ROOT, name);
  const dest = path.join(OUT, name);
  if (!fs.existsSync(src)) return;
  const copyRecursive = (s, d) => {
    fs.mkdirSync(d, { recursive: true });
    for (const it of fs.readdirSync(s)) {
      const a = path.join(s, it);
      const b = path.join(d, it);
      const st = fs.statSync(a);
      if (st.isDirectory()) copyRecursive(a, b);
      else fs.copyFileSync(a, b);
    }
  };
  copyRecursive(src, dest);
};

['assets', 'public', 'static'].forEach(copyDir);

console.log('Prepared site/ with static assets.');
