// Generates the Monorise organization profile SVG assets.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const out = process.argv[2] ?? new URL("../profile/assets/", import.meta.url).pathname;
mkdirSync(out, { recursive: true });
const write = (name, svg) => writeFileSync(join(out, name), svg.trim() + "\n");

const SANS = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, Helvetica, Arial, sans-serif";
const MONO = "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace";
const fonts = `.sans{font-family:${SANS}}.mono{font-family:${MONO}}`;

// ---------- header ----------
const chips = [
  ["WEB", "#22d3ee"],
  ["DESKTOP", "#a78bfa"],
  ["API", "#f472b6"],
  ["OLKUSZ, PL", "#fbbf24"],
];
let cx = 0;
const chipSvg = chips
  .map(([label, color]) => {
    const w = 34 + label.length * 7.6;
    const g = `<g transform="translate(${cx},0)">
      <rect width="${w}" height="32" rx="9" fill="url(#chip)" stroke="#2e3350"/>
      <circle cx="16" cy="16" r="3.5" fill="${color}"/>
      <text x="27" y="20.5" fill="#e2e8f0" class="mono" font-size="11" font-weight="700" letter-spacing="0.06em">${label}</text>
    </g>`;
    cx += w + 10;
    return g;
  })
  .join("\n");

const terminal = [
  ["$", "monorise new project", "#e2e8f0"],
  ["✓", "analiza i zakres", "#34d399"],
  ["✓", "projekt UI/UX", "#34d399"],
  ["✓", "kod + testy", "#34d399"],
  ["→", "wdrożenie i opieka", "#fbbf24"],
];
const termLines = terminal
  .map(
    ([p, t, c], i) =>
      `<g>
        <text x="20" y="${70 + i * 26}" fill="${c}" class="mono" font-size="12.5" font-weight="700">${p}</text>
        <text x="40" y="${70 + i * 26}" fill="${i === 0 ? "#f8fafc" : "#94a3b8"}" class="mono" font-size="12.5">${t}</text>
      </g>`,
  )
  .join("\n");

write(
  "header.svg",
  `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 320" width="100%" height="320" fill="none">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#07080f"/><stop offset=".55" stop-color="#0d0f1f"/><stop offset="1" stop-color="#06070d"/>
    </linearGradient>
    <linearGradient id="border" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#818cf8" stop-opacity=".95"/><stop offset=".35" stop-color="#c084fc" stop-opacity=".45"/>
      <stop offset=".7" stop-color="#f472b6" stop-opacity=".6"/><stop offset="1" stop-color="#fbbf24" stop-opacity=".95"/>
    </linearGradient>
    <linearGradient id="name" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#ffffff"/><stop offset=".3" stop-color="#c4b5fd"/>
      <stop offset=".65" stop-color="#f0abfc"/><stop offset="1" stop-color="#fbbf24"/>
    </linearGradient>
    <linearGradient id="sub" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#818cf8"/><stop offset=".5" stop-color="#c084fc"/><stop offset="1" stop-color="#f472b6"/>
    </linearGradient>
    <linearGradient id="chip" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#1a1d33" stop-opacity=".9"/><stop offset="1" stop-color="#0e1022" stop-opacity=".9"/>
    </linearGradient>
    <linearGradient id="mark" x1="0" y1="1" x2="1" y2="0">
      <stop offset="0" stop-color="#6366f1"/><stop offset=".55" stop-color="#c084fc"/><stop offset="1" stop-color="#fbbf24"/>
    </linearGradient>
    <radialGradient id="sun" cx=".5" cy=".5" r=".5">
      <stop offset="0" stop-color="#fde68a"/><stop offset=".6" stop-color="#fbbf24"/><stop offset="1" stop-color="#f59e0b" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="a1" cx=".18" cy=".35" r=".55"><stop offset="0" stop-color="#6366f1" stop-opacity=".32"/><stop offset="1" stop-color="#6366f1" stop-opacity="0"/></radialGradient>
    <radialGradient id="a2" cx=".82" cy=".28" r=".55"><stop offset="0" stop-color="#c026d3" stop-opacity=".24"/><stop offset="1" stop-color="#c026d3" stop-opacity="0"/></radialGradient>
    <radialGradient id="a3" cx=".5" cy="1" r=".5"><stop offset="0" stop-color="#f59e0b" stop-opacity=".2"/><stop offset="1" stop-color="#f59e0b" stop-opacity="0"/></radialGradient>
    <pattern id="dots" width="24" height="24" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1" fill="#4b5275" fill-opacity=".3"/></pattern>
    <clipPath id="card"><rect x="2" y="2" width="996" height="316" rx="20"/></clipPath>
  </defs>
  <style>
    ${fonts}
    @keyframes breathe1{0%,100%{opacity:.6;transform:translate(0,0)}50%{opacity:1;transform:translate(24px,-8px)}}
    @keyframes breathe2{0%,100%{opacity:1;transform:translate(0,0)}50%{opacity:.55;transform:translate(-26px,10px)}}
    @keyframes rise{0%,100%{transform:translateY(6px)}50%{transform:translateY(-6px)}}
    @keyframes glow{0%,100%{opacity:.55}50%{opacity:1}}
    @keyframes ping{0%{r:4px;opacity:.9}100%{r:13px;opacity:0}}
    @keyframes blink{0%,49%{opacity:1}50%,100%{opacity:0}}
    @keyframes type{from{opacity:0;transform:translateX(-6px)}to{opacity:1;transform:translateX(0)}}
    @keyframes shimmer{0%{transform:translateX(-300px)}100%{transform:translateX(1300px)}}
    .a1{animation:breathe1 9s ease-in-out infinite}
    .a2{animation:breathe2 11s ease-in-out infinite}
    .sun{animation:rise 5s ease-in-out infinite}
    .halo{animation:glow 5s ease-in-out infinite}
    .ping{animation:ping 2s ease-out infinite}
    .cursor{animation:blink 1s step-end infinite}
    .line{opacity:0;animation:type .45s ease-out forwards}
    .shine{animation:shimmer 7s ease-in-out infinite}
  </style>

  <g clip-path="url(#card)">
    <rect width="1000" height="320" fill="url(#bg)"/>
    <rect width="1000" height="320" fill="url(#dots)"/>
    <rect width="1000" height="320" fill="url(#a1)" class="a1"/>
    <rect width="1000" height="320" fill="url(#a2)" class="a2"/>
    <rect width="1000" height="320" fill="url(#a3)"/>
    <rect x="0" y="0" width="160" height="320" fill="#ffffff" fill-opacity=".025" transform="skewX(-20)" class="shine"/>
  </g>
  <rect x="2" y="2" width="996" height="316" rx="20" stroke="url(#border)" stroke-width="1.5"/>

  <!-- window bar -->
  <path d="M2 44 H998" stroke="#1c1f36"/>
  <circle cx="28" cy="23" r="6" fill="#ff5f57"/><circle cx="48" cy="23" r="6" fill="#febc2e"/><circle cx="68" cy="23" r="6" fill="#28c840"/>
  <g transform="translate(400,11)">
    <rect width="200" height="24" rx="12" fill="#0a0b16" stroke="#1f2340"/>
    <path d="M16 10.5v-2a3 3 0 0 1 6 0v2" stroke="#64748b" stroke-width="1.4"/><rect x="14.5" y="10.5" width="9" height="6.5" rx="1.5" fill="#64748b"/>
    <text x="106" y="16.5" fill="#94a3b8" text-anchor="middle" class="mono" font-size="11.5" letter-spacing=".04em">monorise.studio</text>
  </g>
  <g transform="translate(790,11)">
    <rect width="186" height="24" rx="12" fill="#0a0b16" stroke="#1f2340"/>
    <circle cx="16" cy="12" r="4" fill="#34d399"/><circle cx="16" cy="12" r="4" stroke="#34d399" class="ping"/>
    <text x="28" y="16.5" fill="#cbd5e1" class="mono" font-size="10.5" font-weight="700" letter-spacing=".06em">MONORISE TEAM · PL</text>
  </g>

  <!-- mark: a sunrise over an M-shaped ridge -->
  <g transform="translate(52,92)">
    <rect width="128" height="128" rx="30" fill="#0c0e1d" stroke="url(#mark)" stroke-width="1.6"/>
    <circle cx="64" cy="58" r="34" fill="url(#sun)" opacity=".35" class="halo"/>
    <g class="sun"><circle cx="64" cy="56" r="13" fill="url(#sun)"/></g>
    <rect x="18" y="74" width="92" height="40" fill="#0c0e1d"/>
    <path d="M22 100 V52 L64 84 L106 52 V100" stroke="url(#mark)" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M30 108 H98" stroke="#2e3350" stroke-width="3" stroke-linecap="round"/>
  </g>

  <!-- copy -->
  <g transform="translate(212,86)">
    <text x="0" y="16" fill="url(#sub)" class="mono" font-size="12.5" font-weight="700" letter-spacing=".22em">SOFTWARE HOUSE</text>
    <text x="-3" y="80" fill="url(#name)" class="sans" font-size="66" font-weight="900" letter-spacing="-0.035em">Monorise</text>
    <text x="0" y="116" fill="#f1f5f9" class="sans" font-size="19" font-weight="600">Web i desktop, od pomysłu do wdrożenia.</text>
    <text x="0" y="141" fill="#8b93b5" class="sans" font-size="14.5">Szybkie, prywatne i dopracowane w każdym pikselu.</text>
    <g transform="translate(0,160)">${chipSvg}</g>
  </g>

  <!-- terminal -->
  <g transform="translate(726,70)">
    <rect width="250" height="200" rx="14" fill="#0a0b16" fill-opacity=".88" stroke="#22264a"/>
    <path d="M0 36 H250" stroke="#1a1d36"/>
    <circle cx="18" cy="18" r="4" fill="#2e3350"/><circle cx="32" cy="18" r="4" fill="#2e3350"/><circle cx="46" cy="18" r="4" fill="#2e3350"/>
    <text x="232" y="22" fill="#4b5275" text-anchor="end" class="mono" font-size="10.5">~/monorise</text>
    ${termLines}
    <rect x="20" y="${70 + terminal.length * 26 - 11}" width="8" height="14" rx="1.5" fill="#c084fc" class="cursor"/>
  </g>
</svg>`,
);

// ---------- rising skyline divider ----------
const bars = [];
const n = 61;
for (let i = 0; i < n; i++) {
  const d = Math.abs(i - (n - 1) / 2) / ((n - 1) / 2);
  const h = Math.round(8 + (1 - d) * 34 + ((i * 37) % 11));
  const x = 450 + (i - (n - 1) / 2) * 13 - 3;
  bars.push(
    `<rect x="${x.toFixed(1)}" y="${56 - h}" width="6" height="${h}" rx="3" fill="url(#eq)" class="b" style="animation-delay:-${((i * 0.37) % 2.4).toFixed(2)}s;animation-duration:${(1.8 + ((i * 7) % 9) / 10).toFixed(1)}s"/>`,
  );
}
write(
  "rise.svg",
  `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 64" width="100%" height="64" fill="none">
  <defs>
    <linearGradient id="eq" x1="0" y1="1" x2="0" y2="0">
      <stop offset="0" stop-color="#6366f1" stop-opacity=".15"/><stop offset=".55" stop-color="#a78bfa"/><stop offset="1" stop-color="#fbbf24"/>
    </linearGradient>
    <radialGradient id="c" cx=".5" cy=".9" r=".5"><stop offset="0" stop-color="#c084fc" stop-opacity=".25"/><stop offset="1" stop-color="#c084fc" stop-opacity="0"/></radialGradient>
  </defs>
  <style>
    @keyframes grow{0%,100%{transform:scaleY(.35)}50%{transform:scaleY(1)}}
    .b{transform-box:fill-box;transform-origin:50% 100%;animation:grow 2s ease-in-out infinite}
  </style>
  <rect width="900" height="64" fill="url(#c)"/>
  ${bars.join("\n  ")}
  <path d="M40 58 H860" stroke="#2e3350" stroke-linecap="round"/>
</svg>`,
);

// ---------- how we work ----------
const steps = [
  ["01", "Analiza", "cele, zakres, wycena", "#818cf8"],
  ["02", "Projekt", "UX, UI, prototyp", "#c084fc"],
  ["03", "Kod", "web, desktop, API", "#f472b6"],
  ["04", "Wdrożenie", "wydania i opieka", "#fbbf24"],
];
const stepSvg = steps
  .map(([n2, t, s, c], i) => {
    const x = 30 + i * 215;
    return `<g transform="translate(${x},34)">
      <rect width="195" height="96" rx="14" fill="#0c0e1d" stroke="#232747"/>
      <rect width="195" height="96" rx="14" stroke="${c}" class="hl" style="animation-delay:${i * 1}s"/>
      <text x="18" y="32" fill="${c}" class="mono" font-size="12" font-weight="800" letter-spacing=".12em">${n2}</text>
      <text x="18" y="60" fill="#f1f5f9" class="sans" font-size="19" font-weight="800">${t}</text>
      <text x="18" y="81" fill="#7c84a8" class="sans" font-size="12.5">${s}</text>
    </g>`;
  })
  .join("\n");
write(
  "flow.svg",
  `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 160" width="100%" height="160" fill="none">
  <defs>
    <linearGradient id="ln" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#818cf8"/><stop offset=".5" stop-color="#f472b6"/><stop offset="1" stop-color="#fbbf24"/></linearGradient>
  </defs>
  <style>
    ${fonts}
    @keyframes dash{to{stroke-dashoffset:-48}}
    @keyframes hl{0%,100%{opacity:0}10%,25%{opacity:1}35%{opacity:0}}
    .dash{stroke-dasharray:6 10;animation:dash 1.4s linear infinite}
    .hl{opacity:0;animation:hl 4s ease-in-out infinite}
  </style>
  <path d="M30 82 H870" stroke="url(#ln)" stroke-width="2" class="dash" opacity=".7"/>
  ${stepSvg}
</svg>`,
);

// ---------- buttons ----------
const button = (name, label, color, icon, width) =>
  write(
    name,
    `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} 42" width="${width}" height="42" fill="none">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#11132a"/><stop offset="1" stop-color="#07080f"/></linearGradient>
    <linearGradient id="gl" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${color}" stop-opacity=".95"/><stop offset="1" stop-color="${color}" stop-opacity=".35"/></linearGradient>
  </defs>
  <rect x="1" y="1" width="${width - 2}" height="40" rx="20" fill="url(#bg)" stroke="url(#gl)" stroke-width="1.2"/>
  <g transform="translate(22,11)">${icon(color)}</g>
  <text x="50" y="25.5" fill="#f8fafc" font-family="${SANS}" font-size="12" font-weight="700" letter-spacing="0.08em">${label}</text>
  <text x="${width - 26}" y="25.5" fill="${color}" font-family="${MONO}" font-size="13" font-weight="700">↗</text>
</svg>`,
  );
const globe = (c) =>
  `<circle cx="10" cy="10" r="8.5" stroke="${c}" stroke-width="1.6"/><path d="M1.5 10h17M10 1.5c2.6 2.4 3.8 5.2 3.8 8.5s-1.2 6.1-3.8 8.5c-2.6-2.4-3.8-5.2-3.8-8.5s1.2-6.1 3.8-8.5z" stroke="${c}" stroke-width="1.4"/>`;
const mail = (c) =>
  `<rect x="1" y="3.5" width="18" height="13" rx="2.5" stroke="${c}" stroke-width="1.6"/><path d="M2 5l8 6 8-6" stroke="${c}" stroke-width="1.6" stroke-linejoin="round"/>`;
const gh = (c) =>
  `<path fill="${c}" d="M10 0.8a9.2 9.2 0 0 0-2.9 17.9c.46.08.63-.2.63-.44v-1.6c-2.56.56-3.1-1.1-3.1-1.1-.42-1.06-1.02-1.35-1.02-1.35-.84-.57.06-.56.06-.56.92.07 1.4.95 1.4.95.83 1.41 2.17 1 2.7.77.08-.6.32-1.01.59-1.24-2.04-.23-4.19-1.02-4.19-4.54 0-1 .36-1.83.95-2.47-.1-.23-.41-1.17.09-2.43 0 0 .77-.25 2.53.94a8.7 8.7 0 0 1 4.6 0c1.76-1.19 2.53-.94 2.53-.94.5 1.26.19 2.2.09 2.43.59.64.95 1.46.95 2.47 0 3.53-2.15 4.3-4.2 4.53.33.29.62.85.62 1.71v2.54c0 .25.17.53.64.44A9.2 9.2 0 0 0 10 .8z"/>`;
button("btn-website.svg", "MONORISE.STUDIO", "#a78bfa", globe, 214);
button("btn-email.svg", "NAPISZ DO NAS", "#f472b6", mail, 200);
button("btn-github.svg", "ZESPÓŁ", "#fbbf24", gh, 140);
