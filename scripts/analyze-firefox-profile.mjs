import fs from 'fs';

const path = process.argv[2] || '.profile-temp.json';
const o = JSON.parse(fs.readFileSync(path, 'utf8'));
const str = o.shared?.stringArray || [];
const getStr = (i) => (typeof i === 'number' && i >= 0 && i < str.length ? str[i] : String(i));

const urls = new Set();
let firstHome = null;
let attAfter = 0;
let prevAfter = 0;
let discordAfter = 0;

for (const t of o.threads || []) {
  const m = t.markers;
  if (!m?.name) continue;
  for (let i = 0; i < m.name.length; i++) {
    const n = getStr(m.name[i]);
    if (n.startsWith('Load ')) {
      const u = n.replace(/^Load \d+: /, '');
      if (/attachments|preview\.f95|discordapp\.com\/avatars/i.test(u)) {
        urls.add(u.split('?')[0].slice(0, 120));
      }
      if (u === 'http://localhost:5173/' || u === 'https://f95france.site/') {
        if (firstHome == null) firstHome = m.startTime[i];
      }
    }
  }
}

if (firstHome != null) {
  for (const t of o.threads || []) {
    const m = t.markers;
    if (!m?.name) continue;
    for (let i = 0; i < m.name.length; i++) {
      const st = m.startTime[i];
      if (st < firstHome || st > firstHome + 15000) continue;
      const n = getStr(m.name[i]);
      if (!n.startsWith('Load ')) continue;
      if (n.includes('attachments.f95zone')) attAfter++;
      if (n.includes('preview.f95zone')) prevAfter++;
      if (n.includes('cdn.discordapp.com/avatars')) discordAfter++;
    }
  }
}

const att = [...urls].filter((u) => u.includes('attachments'));
const prev = [...urls].filter((u) => u.includes('preview'));
const gifs = [...urls].filter((u) => /\.gif/i.test(u));

console.log(
  JSON.stringify(
    { urls: urls.size, att: att.length, prev: prev.length, gifs, firstHome, attAfter, prevAfter, discordAfter },
    null,
    2
  )
);
