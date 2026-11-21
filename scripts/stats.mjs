// Draws the team activity card (profile/stats.svg on the stats branch).
// The team's logins come from the TEAM variable (comma separated), so the
// public script does not list them; only totals for the whole team are drawn.
// Usage: GITHUB_TOKEN=... TEAM=a,b node scripts/stats.mjs out/stats.svg
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const token = process.env.GITHUB_TOKEN;
const team = (process.env.TEAM ?? "").split(",").map((s) => s.trim()).filter(Boolean);
const out = process.argv[2] ?? "stats.svg";
if (!token || team.length === 0) throw new Error("GITHUB_TOKEN and TEAM are required");

const query = `query($login: String!) {
  user(login: $login) {
    contributionsCollection {
      totalCommitContributions
      totalPullRequestContributions
      totalPullRequestReviewContributions
      restrictedContributionsCount
      contributionCalendar { weeks { contributionDays { date contributionCount } } }
    }
  }
}`;

async function fetchMember(login) {
  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: { Authorization: `bearer ${token}`, "Content-Type": "application/json", "User-Agent": "monorise-profile-stats" },
    body: JSON.stringify({ query, variables: { login } }),
  });
  const json = await res.json();
  if (!res.ok || json.errors) throw new Error(`GitHub GraphQL ${res.status}: ${JSON.stringify(json.errors ?? json)}`);
  return json.data.user.contributionsCollection;
}

const members = await Promise.all(team.map(fetchMember));
const byDate = new Map();
let commits = 0, prs = 0, reviews = 0, privateCount = 0;
for (const m of members) {
  commits += m.totalCommitContributions;
  prs += m.totalPullRequestContributions;
  reviews += m.totalPullRequestReviewContributions;
  privateCount += m.restrictedContributionsCount;
  for (const w of m.contributionCalendar.weeks)
    for (const d of w.contributionDays) byDate.set(d.date, (byDate.get(d.date) ?? 0) + d.contributionCount);
}
const days = [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b));
const total = days.reduce((s, [, c]) => s + c, 0);
const activeDays = days.filter(([, c]) => c > 0).length;
let longest = 0, run = 0;
for (const [, c] of days) { run = c > 0 ? run + 1 : 0; longest = Math.max(longest, run); }
let current = 0;
for (let i = days.length - 1; i >= 0; i--) {
  if (days[i][1] > 0) current++;
  else if (i === days.length - 1) continue; // today may still be empty
  else break;
}
const best = days.reduce((b, d) => (d[1] > b[1] ? d : b), ["", 0]);

// ---------- drawing ----------
const SANS = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, Helvetica, Arial, sans-serif";
const MONO = "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace";
const fmt = (n) => n.toLocaleString("pl-PL").replace(/ /g, " ");
const months = ["sty", "lut", "mar", "kwi", "maj", "cze", "lip", "sie", "wrz", "paź", "lis", "gru"];
const plDate = (iso) => { const [y, m, d] = iso.split("-"); return `${Number(d)} ${months[Number(m) - 1]} ${y}`; };

const tiles = [
  ["KONTRYBUCJE", fmt(total), "ostatnie 12 miesięcy", "#818cf8"],
  ["AKTYWNE DNI", fmt(activeDays), `z ${days.length} dni`, "#c084fc"],
  ["SERIA", `${current} ${current === 1 ? "dzień" : "dni"}`, `najdłuższa: ${longest} dni`, "#f472b6"],
  ["NAJLEPSZY DZIEŃ", fmt(best[1]), best[0] ? plDate(best[0]) : "-", "#fbbf24"],
];
const tileSvg = tiles
  .map(([label, value, sub, color], i) => {
    const x = (i % 2) * 182, y = Math.floor(i / 2) * 96;
    return `<g transform="translate(${x},${y})">
      <rect width="170" height="84" rx="14" fill="#0c0e1d" stroke="#232747"/>
      <rect x="0" y="18" width="3" height="48" rx="1.5" fill="${color}"/>
      <text x="18" y="25" fill="${color}" class="mono" font-size="10" font-weight="800" letter-spacing=".1em">${label}</text>
      <text x="18" y="56" fill="#f8fafc" class="sans" font-size="26" font-weight="900" letter-spacing="-0.02em">${value}</text>
      <text x="18" y="74" fill="#6f779c" class="sans" font-size="11.5">${sub}</text>
    </g>`;
  })
  .join("\n");

// heatmap: one column per week, Monday on top
const first = new Date(days[0][0] + "T00:00:00Z");
const offset = (first.getUTCDay() + 6) % 7;
const nonZero = days.map(([, c]) => c).filter((c) => c > 0).sort((a, b) => a - b);
const q = (p) => nonZero[Math.min(nonZero.length - 1, Math.floor(p * nonZero.length))] ?? 1;
const steps = [q(0.25), q(0.5), q(0.75)];
const colors = ["#15182c", "#3f3d9e", "#7c5bd6", "#d063c0", "#fbbf24"];
const level = (c) => (c === 0 ? 0 : c <= steps[0] ? 1 : c <= steps[1] ? 2 : c <= steps[2] ? 3 : 4);
const CELL = 8, GAP = 2.2, STEP = CELL + GAP;
const cells = [];
const monthLabels = [];
let lastMonth = -1;
days.forEach(([date, c], i) => {
  const idx = i + offset, col = Math.floor(idx / 7), row = idx % 7;
  const m = Number(date.slice(5, 7)) - 1;
  if (row === 0 || i === 0) {
    if (m !== lastMonth && col < 52) { monthLabels.push(`<text x="${col * STEP}" y="-8" fill="#5d6590" class="mono" font-size="10">${months[m]}</text>`); lastMonth = m; }
  }
  cells.push(`<rect x="${col * STEP}" y="${row * STEP}" width="${CELL}" height="${CELL}" rx="2" fill="${colors[level(c)]}" class="c" style="animation-delay:${(col * 0.06).toFixed(2)}s"/>`);
});
const cols = Math.floor((days.length - 1 + offset) / 7) + 1;
const gridWidth = cols * STEP - GAP;
const legend = colors
  .map((c, i) => `<rect x="${gridWidth - 44 - (colors.length - i) * STEP}" y="${7 * STEP + 10}" width="${CELL}" height="${CELL}" rx="2" fill="${c}"/>`)
  .join("");
const updated = new Date().toISOString().slice(0, 10);

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 290" width="100%" height="290" fill="none">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0b0c1b"/><stop offset="1" stop-color="#06070e"/></linearGradient>
    <linearGradient id="bd" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#818cf8" stop-opacity=".85"/><stop offset=".5" stop-color="#c084fc" stop-opacity=".35"/><stop offset="1" stop-color="#fbbf24" stop-opacity=".85"/></linearGradient>
    <linearGradient id="t" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ffffff"/><stop offset=".6" stop-color="#c4b5fd"/><stop offset="1" stop-color="#f0abfc"/></linearGradient>
    <radialGradient id="g1" cx=".15" cy=".2" r=".5"><stop offset="0" stop-color="#6366f1" stop-opacity=".22"/><stop offset="1" stop-color="#6366f1" stop-opacity="0"/></radialGradient>
    <radialGradient id="g2" cx=".85" cy=".9" r=".5"><stop offset="0" stop-color="#f59e0b" stop-opacity=".12"/><stop offset="1" stop-color="#f59e0b" stop-opacity="0"/></radialGradient>
    <clipPath id="clip"><rect x="1" y="1" width="998" height="288" rx="18"/></clipPath>
  </defs>
  <style>
    .sans{font-family:${SANS}}.mono{font-family:${MONO}}
    @keyframes sweep{0%,100%{opacity:.75}12%{opacity:1}}
    @keyframes ping{0%{r:4px;opacity:.9}100%{r:12px;opacity:0}}
    .c{animation:sweep 6s ease-in-out infinite}
    .ping{animation:ping 2s ease-out infinite}
  </style>
  <g clip-path="url(#clip)"><rect width="1000" height="290" fill="url(#bg)"/><rect width="1000" height="290" fill="url(#g1)"/><rect width="1000" height="290" fill="url(#g2)"/></g>
  <rect x="1" y="1" width="998" height="288" rx="18" stroke="url(#bd)" stroke-width="1.3"/>

  <text x="30" y="42" fill="url(#t)" class="sans" font-size="22" font-weight="900" letter-spacing="-0.02em">Aktywność zespołu</text>
  <text x="30" y="62" fill="#6f779c" class="sans" font-size="12.5">Repozytoria publiczne i prywatne · ${fmt(commits + privateCount)} zmian w kodzie · ${fmt(prs)} pull requestów</text>
  <g transform="translate(830,24)">
    <rect width="142" height="26" rx="13" fill="#0a0b16" stroke="#1f2340"/>
    <circle cx="16" cy="13" r="4" fill="#34d399"/><circle cx="16" cy="13" r="4" stroke="#34d399" class="ping"/>
    <text x="28" y="17.5" fill="#94a3b8" class="mono" font-size="10.5" font-weight="700">LIVE · ${updated}</text>
  </g>

  <g transform="translate(30,88)">${tileSvg}</g>
  <g transform="translate(${Math.round(970 - gridWidth)},${118})">
    ${monthLabels.join("")}
    ${cells.join("")}
    <text x="0" y="${7 * STEP + 19}" fill="#5d6590" class="mono" font-size="10">dziennie, cały zespół</text>
    <text x="${gridWidth - 50 - colors.length * STEP}" y="${7 * STEP + 19}" text-anchor="end" fill="#5d6590" class="mono" font-size="10">mniej</text>
    ${legend}
    <text x="${gridWidth}" y="${7 * STEP + 19}" text-anchor="end" fill="#5d6590" class="mono" font-size="10">więcej</text>
  </g>
</svg>
`;
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, svg);
console.log(`stats: ${total} contributions, ${activeDays} active days, streak ${current}/${longest}`);
