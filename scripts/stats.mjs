// Draws the team cards on the stats branch: stats.svg, top-langs.svg,
// streak.svg and snake.svg, from real GitHub data of the whole team.
// The team's logins come from the TEAM variable (comma separated), so the
// public script does not list them; the cards show only team totals.
// Usage: GITHUB_TOKEN=... TEAM=a,b [ORG=Monorise-Team] node scripts/stats.mjs out
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const token = process.env.GITHUB_TOKEN;
const team = (process.env.TEAM ?? "").split(",").map((s) => s.trim()).filter(Boolean);
const org = process.env.ORG ?? "Monorise-Team";
const out = process.argv[2] ?? "out";
if (!token || team.length === 0) throw new Error("GITHUB_TOKEN and TEAM are required");
mkdirSync(out, { recursive: true });

async function gql(query, variables) {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch("https://api.github.com/graphql", {
      method: "POST",
      headers: { Authorization: `bearer ${token}`, "Content-Type": "application/json", "User-Agent": "monorise-profile-stats" },
      body: JSON.stringify({ query, variables }),
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok && !json.errors) return json.data;
    if (attempt >= 3) throw new Error(`GitHub GraphQL ${res.status}: ${JSON.stringify(json.errors ?? json)}`);
    await new Promise((r) => setTimeout(r, 2000 * attempt));
  }
}

const REPO_FIELDS = `nodes { nameWithOwner isFork stargazerCount languages(first: 12, orderBy: { field: SIZE, direction: DESC }) { edges { size node { name color } } } }`;

// ---------- data ----------
const repos = new Map(); // nameWithOwner -> repo (deduplicated across members and org)
const byDate = new Map();
const totals = { commits: 0, prs: 0, issues: 0, reviews: 0, privateCount: 0, followers: 0, contributedTo: 0 };

for (const login of team) {
  const base = await gql(
    `query($login: String!) { user(login: $login) {
      followers { totalCount }
      repositoriesContributedTo(contributionTypes: [COMMIT, PULL_REQUEST, ISSUE, REPOSITORY]) { totalCount }
      contributionsCollection { contributionYears }
      repositories(first: 100, ownerAffiliations: OWNER) { ${REPO_FIELDS} }
    } }`,
    { login },
  );
  const u = base.user;
  totals.followers += u.followers.totalCount;
  totals.contributedTo += u.repositoriesContributedTo.totalCount;
  for (const r of u.repositories.nodes) if (!r.isFork) repos.set(r.nameWithOwner, r);
  for (const year of u.contributionsCollection.contributionYears) {
    const from = `${year}-01-01T00:00:00Z`;
    const to = `${year}-12-31T23:59:59Z`;
    const y = await gql(
      `query($login: String!, $from: DateTime!, $to: DateTime!) { user(login: $login) { contributionsCollection(from: $from, to: $to) {
        totalCommitContributions totalPullRequestContributions totalIssueContributions totalPullRequestReviewContributions restrictedContributionsCount
        contributionCalendar { weeks { contributionDays { date contributionCount } } }
      } } }`,
      { login, from, to },
    );
    const c = y.user.contributionsCollection;
    totals.commits += c.totalCommitContributions;
    totals.prs += c.totalPullRequestContributions;
    totals.issues += c.totalIssueContributions;
    totals.reviews += c.totalPullRequestReviewContributions;
    totals.privateCount += c.restrictedContributionsCount;
    for (const w of c.contributionCalendar.weeks)
      for (const d of w.contributionDays) byDate.set(d.date, (byDate.get(d.date) ?? 0) + d.contributionCount);
  }
}
const orgData = await gql(`query($org: String!) { organization(login: $org) { repositories(first: 100) { ${REPO_FIELDS} } } }`, { org });
for (const r of orgData.organization.repositories.nodes) if (!r.isFork) repos.set(r.nameWithOwner, r);

const today = new Date().toISOString().slice(0, 10);
const days = [...byDate.entries()].filter(([d]) => d <= today).sort(([a], [b]) => a.localeCompare(b));
const allTotal = days.reduce((s, [, c]) => s + c, 0);
const stars = [...repos.values()].reduce((s, r) => s + r.stargazerCount, 0);
const commitsAll = totals.commits + totals.privateCount;

// streaks
const firstActive = days.find(([, c]) => c > 0)?.[0] ?? today;
let longest = { len: 0, start: "", end: "" };
let runStart = "", run = 0;
for (const [d, c] of days) {
  if (c > 0) { if (run === 0) runStart = d; run++; if (run > longest.len) longest = { len: run, start: runStart, end: d }; }
  else run = 0;
}
let current = { len: 0, start: "", end: "" };
for (let i = days.length - 1; i >= 0; i--) {
  const [d, c] = days[i];
  if (c > 0) { current = { len: current.len + 1, start: d, end: current.end || d }; }
  else if (i === days.length - 1) continue; // today may still be empty
  else break;
}

// languages by code size
const langs = new Map();
for (const r of repos.values())
  for (const e of r.languages.edges) {
    const l = langs.get(e.node.name) ?? { size: 0, color: e.node.color ?? "#8b93b5" };
    l.size += e.size;
    langs.set(e.node.name, l);
  }
const langTotal = [...langs.values()].reduce((s, l) => s + l.size, 0) || 1;
const topLangs = [...langs.entries()].sort((a, b) => b[1].size - a[1].size).slice(0, 8)
  .map(([name, l]) => ({ name, color: l.color, pct: (l.size / langTotal) * 100 }));

// rank, the github-readme-stats formula
const expCdf = (x) => 1 - 2 ** -x;
const logCdf = (x) => x / (1 + x);
const W = { commits: 2, prs: 3, issues: 1, reviews: 1, stars: 4, followers: 1 };
const score =
  W.commits * expCdf(commitsAll / 1000) + W.prs * expCdf(totals.prs / 50) + W.issues * expCdf(totals.issues / 25) +
  W.reviews * expCdf(totals.reviews / 2) + W.stars * logCdf(stars / 50) + W.followers * logCdf(totals.followers / 10);
const percentile = (1 - score / Object.values(W).reduce((a, b) => a + b, 0)) * 100;
const levels = [[1, "S"], [12.5, "A+"], [25, "A"], [37.5, "A-"], [50, "B+"], [62.5, "B"], [75, "B-"], [87.5, "C+"], [100, "C"]];
const grade = levels.find(([t]) => percentile <= t)?.[1] ?? "C";

// ---------- drawing ----------
const SANS = "'Segoe UI', Ubuntu, -apple-system, BlinkMacSystemFont, Inter, Helvetica, Arial, sans-serif";
const C = { bg: "#0d1117", title: "#a78bfa", icon: "#f472b6", text: "#c0caf5", muted: "#7c84a8", ring: "#818cf8", fire: "#fbbf24" };
const fmt = (n) => n.toLocaleString("pl-PL").replace(/\s/g, " ");
const months = ["sty", "lut", "mar", "kwi", "maj", "cze", "lip", "sie", "wrz", "paź", "lis", "gru"];
const plDate = (iso, withYear = true) => { const [y, m, d] = iso.split("-"); return `${Number(d)} ${months[Number(m) - 1]}${withYear ? ` ${y}` : ""}`; };
const range = (a, b) => (a ? `${plDate(a, a.slice(0, 4) !== b.slice(0, 4))} - ${b === today ? "dziś" : plDate(b)}` : "-");
const style = `<style>
  .t{font:600 18px ${SANS};fill:${C.title}}
  .s{font:600 14px ${SANS};fill:${C.text}}
  .b{font:700 14px ${SANS};fill:${C.text}}
  .m{font:400 12px ${SANS};fill:${C.muted}}
  .f{opacity:0;animation:fade .3s ease-in-out forwards}
  @keyframes fade{to{opacity:1}}
  @keyframes ring{from{stroke-dashoffset:251.3}}
  @keyframes pop{0%{transform:scale(0)}100%{transform:scale(1)}}
</style>`;
const card = (w, h, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" fill="none">${style}
  <rect x=".5" y=".5" width="${w - 1}" height="${h - 1}" rx="4.5" fill="${C.bg}"/>${body}</svg>\n`;

// icons (octicons, 16px)
const ICON = {
  star: "M8 .25a.75.75 0 01.673.418l1.882 3.815 4.21.612a.75.75 0 01.416 1.279l-3.046 2.97.719 4.192a.75.75 0 01-1.088.791L8 12.347l-3.766 1.98a.75.75 0 01-1.088-.79l.72-4.194L.818 6.374a.75.75 0 01.416-1.28l4.21-.611L7.327.668A.75.75 0 018 .25z",
  commit: "M1.643 3.143L.427 1.927A.25.25 0 000 2.104V5.75c0 .138.112.25.25.25h3.646a.25.25 0 00.177-.427L2.715 4.215a6.5 6.5 0 11-1.18 4.458.75.75 0 10-1.493.154 8.001 8.001 0 101.6-5.684zM7.75 4a.75.75 0 01.75.75v2.992l2.028.812a.75.75 0 01-.557 1.392l-2.5-1A.75.75 0 017 8.25v-3.5A.75.75 0 017.75 4z",
  pr: "M7.177 3.073L9.573.677A.25.25 0 0110 .854v4.792a.25.25 0 01-.427.177L7.177 3.427a.25.25 0 010-.354zM3.75 2.5a.75.75 0 100 1.5.75.75 0 000-1.5zm-2.25.75a2.25 2.25 0 113 2.122v5.256a2.251 2.251 0 11-1.5 0V5.372A2.25 2.25 0 011.5 3.25zM11 2.5h-1V4h1a1 1 0 011 1v5.628a2.251 2.251 0 101.5 0V5A2.5 2.5 0 0011 2.5zm1 10.25a.75.75 0 111.5 0 .75.75 0 01-1.5 0zM3.75 12a.75.75 0 100 1.5.75.75 0 000-1.5z",
  issue: "M8 9.5a1.5 1.5 0 100-3 1.5 1.5 0 000 3zM8 0a8 8 0 100 16A8 8 0 008 0zM1.5 8a6.5 6.5 0 1113 0 6.5 6.5 0 01-13 0z",
  repo: "M2 2.5A2.5 2.5 0 014.5 0h8.75a.75.75 0 01.75.75v12.5a.75.75 0 01-.75.75h-2.5a.75.75 0 110-1.5h1.75v-2h-8a1 1 0 00-.714 1.7.75.75 0 01-1.072 1.05A2.495 2.495 0 012 11.5v-9zm10.5-1V9h-8c-.356 0-.694.074-1 .208V2.5a1 1 0 011-1h8zM5 12.25v3.25a.25.25 0 00.4.2l1.45-1.087a.25.25 0 01.3 0L8.6 15.7a.25.25 0 00.4-.2v-3.25a.25.25 0 00-.25-.25h-3.5a.25.25 0 00-.25.25z",
};

// stats.svg
const rows = [
  ["star", "Gwiazdki łącznie", fmt(stars)],
  ["commit", "Commity (wszystkie lata)", fmt(commitsAll)],
  ["pr", "Pull requesty", fmt(totals.prs)],
  ["issue", "Zgłoszenia (issues)", fmt(totals.issues)],
  ["repo", "Repozytoria z wkładem", fmt(totals.contributedTo)],
];
const ringPct = Math.max(0.05, Math.min(1, 1 - percentile / 100));
const statsBody = `
  <text x="25" y="35" class="t f">Statystyki zespołu Monorise</text>
  ${rows.map(([icon, label, value], i) => `<g transform="translate(25,${62 + i * 25})" class="f" style="animation-delay:${(i + 3) * 150}ms">
    <svg width="16" height="16" viewBox="0 0 16 16" y="-12.5"><path fill="${C.icon}" d="${ICON[icon]}"/></svg>
    <text x="25" class="s">${label}:</text><text x="230" class="b">${value}</text></g>`).join("")}
  <g transform="translate(400,97)">
    <circle r="40" stroke="${C.ring}" stroke-opacity=".2" stroke-width="6"/>
    <circle r="40" stroke="${C.ring}" stroke-width="6" stroke-linecap="round" transform="rotate(-90)"
      stroke-dasharray="251.3" stroke-dashoffset="${(251.3 * (1 - ringPct)).toFixed(1)}" style="animation:ring 1s ease-in-out forwards"/>
    <text text-anchor="middle" dominant-baseline="central" style="font:800 24px ${SANS};fill:${C.text}">${grade}</text>
  </g>`;
writeFileSync(join(out, "stats.svg"), card(495, 195, statsBody));

// top-langs.svg (compact layout)
let barX = 0;
const bar = topLangs.map((l) => { const w = (l.pct / 100) * 300; const r = `<rect x="${barX.toFixed(2)}" width="${w.toFixed(2)}" height="8" fill="${l.color}"/>`; barX += w; return r; }).join("");
const langBody = `
  <text x="25" y="35" class="t f">Najczęstsze języki</text>
  <mask id="bar"><rect width="300" height="8" rx="5" fill="#fff"/></mask>
  <g transform="translate(25,55)" mask="url(#bar)">${bar}</g>
  ${topLangs.map((l, i) => `<g transform="translate(${25 + (i % 2) * 150},${90 + Math.floor(i / 2) * 25})" class="f" style="animation-delay:${(i + 3) * 150}ms">
    <circle cx="5" cy="6" r="5" fill="${l.color}"/><text x="15" y="10" class="m" style="fill:${C.text};font-size:11px">${l.name} ${l.pct.toFixed(2)}%</text></g>`).join("")}`;
writeFileSync(join(out, "top-langs.svg"), card(350, 195, langBody));

// streak.svg
const streakBody = `
  <path d="M165 28 V170 M330 28 V170" stroke="#2a2e45"/>
  <g transform="translate(82.5,0)" class="f" style="animation-delay:.2s">
    <text y="80" text-anchor="middle" style="font:700 28px ${SANS};fill:${C.title}">${fmt(allTotal)}</text>
    <text y="118" text-anchor="middle" class="s">Kontrybucje łącznie</text>
    <text y="142" text-anchor="middle" class="m">${range(firstActive, today)}</text>
  </g>
  <g transform="translate(247.5,0)">
    <circle cy="71" r="40" stroke="${C.icon}" stroke-width="5"/>
    <g transform="translate(-9,13)"><path fill="${C.fire}" d="M9 0c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 2-5 3-6 0 2 1 3 2 3 0-3-1-6 1-9z"/></g>
    <text y="80" text-anchor="middle" style="font:700 28px ${SANS};fill:${C.text}">${current.len}</text>
    <text y="138" text-anchor="middle" style="font:700 14px ${SANS};fill:${C.fire}">Obecna seria</text>
    <text y="160" text-anchor="middle" class="m">${current.len ? range(current.start, current.end) : "-"}</text>
  </g>
  <g transform="translate(412.5,0)" class="f" style="animation-delay:.4s">
    <text y="80" text-anchor="middle" style="font:700 28px ${SANS};fill:${C.title}">${longest.len}</text>
    <text y="118" text-anchor="middle" class="s">Najdłuższa seria</text>
    <text y="142" text-anchor="middle" class="m">${longest.len ? range(longest.start, longest.end) : "-"}</text>
  </g>`;
writeFileSync(join(out, "streak.svg"), card(495, 195, streakBody));

// snake.svg: the last 53 weeks; the snake winds through every column and eats the busy days
const last = days.slice(-371);
const offset = (new Date(last[0][0] + "T00:00:00Z").getUTCDay() + 7) % 7; // Sunday on top, as on GitHub
const nonZero = last.map(([, c]) => c).filter((c) => c > 0).sort((a, b) => a - b);
const q = (p) => nonZero[Math.min(nonZero.length - 1, Math.floor(p * nonZero.length))] ?? 1;
const steps = [q(0.25), q(0.5), q(0.75)];
const palette = ["#161b22", "#3b3a8f", "#6d4fd1", "#c060c8", "#fbbf24"];
const lvl = (c) => (c === 0 ? 0 : c <= steps[0] ? 1 : c <= steps[1] ? 2 : c <= steps[2] ? 3 : 4);
const S = 16, CELL = 12;
const cols = Math.ceil((last.length + offset) / 7);
const grid = [];
last.forEach(([, c], i) => { const k = i + offset; grid.push({ col: Math.floor(k / 7), row: k % 7, level: lvl(c) }); });
// serpentine route: down the even columns, up the odd ones
const route = [];
for (let col = -1; col <= cols; col++)
  for (let r = 0; r < 7; r++) route.push({ col, row: col % 2 === 0 || col < 0 ? r : 6 - r });
const TICK = 0.06; // seconds per cell
const DUR = (route.length * TICK).toFixed(2);
const at = new Map(route.map((p, i) => [`${p.col}:${p.row}`, i]));
const pathD = route.map((p, i) => `${i ? "L" : "M"}${p.col * S + CELL / 2} ${p.row * S + CELL / 2}`).join(" ");
const cellSvg = grid
  .map(({ col, row, level }) => {
    const x = col * S, y = row * S;
    if (level === 0) return `<rect x="${x}" y="${y}" width="${CELL}" height="${CELL}" rx="2" fill="${palette[0]}"/>`;
    const t = ((at.get(`${col}:${row}`) ?? 0) / route.length).toFixed(4);
    const t2 = Math.min(0.9999, Number(t) + 0.0005).toFixed(4);
    return `<rect x="${x}" y="${y}" width="${CELL}" height="${CELL}" rx="2" fill="${palette[level]}"><animate attributeName="fill" dur="${DUR}s" repeatCount="indefinite" calcMode="discrete" keyTimes="0;${t2};1" values="${palette[level]};${palette[0]};${palette[0]}"/></rect>`;
  })
  .join("");
const snakeLen = 5;
const snakeSvg = Array.from({ length: snakeLen }, (_, i) => {
  const size = CELL - i * 1.4;
  return `<rect x="${-size / 2}" y="${-size / 2}" width="${size.toFixed(1)}" height="${size.toFixed(1)}" rx="${(size / 3).toFixed(1)}" fill="#a78bfa" fill-opacity="${(1 - i * 0.15).toFixed(2)}">
    <animateMotion dur="${DUR}s" repeatCount="indefinite" begin="-${((snakeLen - i) * TICK * 1.2).toFixed(2)}s" path="${pathD}"/></rect>`;
}).reverse().join("");
const W2 = cols * S + 32;
writeFileSync(
  join(out, "snake.svg"),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-16 -16 ${W2} ${7 * S + 32}" width="${W2}" height="${7 * S + 32}" fill="none">
  <defs><clipPath id="g"><rect x="-16" y="-16" width="${W2}" height="${7 * S + 32}"/></clipPath></defs>
  <g clip-path="url(#g)">${cellSvg}${snakeSvg}</g></svg>\n`,
);

console.log(`stats: ${allTotal} contributions since ${firstActive}, ${commitsAll} commits, ${totals.prs} PRs, ${stars} stars, ${repos.size} repos, ${topLangs.length} languages, rank ${grade}, streak ${current.len}/${longest.len}`);
