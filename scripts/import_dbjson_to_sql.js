// Node script to read data/db.json and produce SQL inserts for migrations.
// Usage: node import_dbjson_to_sql.js > migrations/003_from_dbjson.sql
const fs = require('fs');
const path = require('path');

const dbFile = path.join(__dirname, '..', 'data', 'db.json');
if (!fs.existsSync(dbFile)) { console.error('data/db.json not found'); process.exit(1); }
const raw = JSON.parse(fs.readFileSync(dbFile,'utf8'));

function esc(s){ if (s===null||s===undefined) return 'NULL'; return "'" + String(s).replace(/'/g, "''") + "'"; }

console.log('-- Auto-generated SQL from data/db.json');
console.log('BEGIN TRANSACTION;');

if (raw.users && raw.users.length){
  raw.users.forEach(u=>{
    const id = esc(u.id || ('u_'+Math.random().toString(36).slice(2,10)));
    console.log(`INSERT OR IGNORE INTO users (id,name,email,password_hash,role,created_at) VALUES (${id},${esc(u.name)},${esc(u.email)},${esc(u.password)},${esc(u.role || 'user')},${esc(u.createdAt||new Date().toISOString())});`);
  });
}

if (raw.problems && raw.problems.length){
  raw.problems.forEach(p=>{
    console.log(`INSERT OR IGNORE INTO problems (id,title,body,topic,difficulty,source,status,created_at) VALUES (${esc(p.id)},${esc(p.title)},${esc(p.body||null)},${esc(p.topic||null)},${esc(p.difficulty||null)},${esc(p.source||null)},${esc(p.status||'published')},${esc(p.createdAt||new Date().toISOString())});`);
  });
}

if (raw.articles && raw.articles.length){
  raw.articles.forEach(a=>{
    console.log(`INSERT OR IGNORE INTO articles (id,title,excerpt,body,status,created_at) VALUES (${esc(a.id)},${esc(a.title)},${esc(a.excerpt||null)},${esc(a.body||null)},${esc(a.status||'published')},${esc(a.createdAt||new Date().toISOString())});`);
  });
}

if (raw.contests && raw.contests.length){
  raw.contests.forEach(c=>{
    console.log(`INSERT OR IGNORE INTO contests (id,title,year,type,description,status,created_at) VALUES (${esc(c.id)},${esc(c.title)},${esc(c.year||null)},${esc(c.type||null)},${esc(c.description||null)},${esc(c.status||'published')},${esc(c.createdAt||new Date().toISOString())});`);
  });
}

console.log('COMMIT;');
