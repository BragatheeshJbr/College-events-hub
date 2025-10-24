// ✅ Google Apps Script URL (Your live Sheet connection)
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxbzNUWmn-tPtKM4N8LTOmbO2Y5iRHFmKZScSK6XL5BCzLI06vAfd0MXRpQ38-FXe0lvQ/exec';

// 🧩 Helper to format headers
function formatHeader(header) {
  return header.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

/* --------- 🚀 Minimal localStorage cache (stale-while-revalidate) ---------- */
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes cache

function cacheKey(sheet) { return `vec_cache_${sheet}`; }

function saveLocal(sheet, data) {
  try {
    localStorage.setItem(cacheKey(sheet), JSON.stringify({ ts: Date.now(), data }));
  } catch (e) { console.warn('saveLocal failed', e); }
}

function loadLocal(sheet) {
  try {
    const raw = localStorage.getItem(cacheKey(sheet));
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) { return null; }
}

/* --------- ⚡ Fetch & Cache Logic ---------- */
async function getAndCache(sheetName) {
  const local = loadLocal(sheetName);
  if (local && (Date.now() - local.ts) < CACHE_TTL_MS) return local.data;

  const resp = await fetch(`${SCRIPT_URL}?sheet=${encodeURIComponent(sheetName)}`, { cache: 'no-store' });
  const data = await resp.json();
  saveLocal(sheetName, data);
  return data;
}

/* --------- 🚀 Faster Startup: Render Cached Immediately ---------- */
window.addEventListener('DOMContentLoaded', async () => {
  const local = loadLocal('Events');
  if (local?.data) {
    cache['Events'] = local.data;
    renderData(local.data, 'Events');
  } else {
    document.getElementById('events-tab').innerHTML = '<p class="loading-text">Loading...</p>';
  }

  // Fetch fresh data in background (non-blocking)
  getAndCache('Events').then(fresh => {
    if (JSON.stringify(fresh) !== JSON.stringify(cache['Events'])) {
      cache['Events'] = fresh;
      renderData(fresh, 'Events');
    }
    saveLocal('Events', fresh);
  });

  // Preload other sheets after a small delay (non-blocking)
  setTimeout(() => ['Courses', 'Winners'].forEach(s =>
    getAndCache(s).then(d => cache[s] = d).catch(() => {})
  ), 200);
});

/* --------- 🧭 Tab Switching ---------- */
const tabs = document.querySelectorAll('.tab-button');
const tabContents = document.querySelectorAll('.tab-content');

tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    const target = tab.dataset.target;
    const sheet = tab.dataset.sheet;

    // Hide all tabs
    tabContents.forEach(tc => tc.style.display = 'none');
    tabs.forEach(t => t.classList.remove('active'));

    // Show active tab
    document.getElementById(target).style.display = 'block';
    tab.classList.add('active');

    // Load data for the selected tab
    loadTabData(sheet, target);
  });
});

// 🏁 Default tab on startup
window.addEventListener('DOMContentLoaded', () => {
  document.querySelector('.tab-button[data-sheet="Events"]').classList.add('active');
  document.getElementById('events-tab').style.display = 'block';
  loadTabData('Events', 'events-tab');
});

/* --------- ⚡ Data Cache for Performance ---------- */
const cache = {};

/* --------- 📦 Load Data Dynamically ---------- */
async function loadTabData(sheetName, containerId) {
  const container = document.getElementById(containerId);

  if (sheetName === "Winners") {
    document.getElementById("leaderboard").innerHTML = '<p class="loading-text">Loading...</p>';
    document.getElementById("winners-list").innerHTML = '';
  } else {
    container.innerHTML = '<p class="loading-text">Loading...</p>';
  }

  try {
    if (cache[sheetName]) {
      renderData(cache[sheetName], sheetName);
      return;
    }
    const data = await getAndCache(sheetName);
    cache[sheetName] = data;
    renderData(data, sheetName);
  } catch (error) {
    console.error(error);
    const msg = '<p class="error-text">Failed to load data.</p>';
    if (sheetName === "Winners") document.getElementById("leaderboard").innerHTML = msg;
    else container.innerHTML = msg;
  }
}

/* --------- 🎨 Render Data ---------- */
function renderData(data, sheetName) {
  if (!data || data.length === 0) {
    const msg = '<p class="empty-text">No data available.</p>';
    if (sheetName === "Winners") {
      document.getElementById("leaderboard").innerHTML = msg;
      document.getElementById("winners-list").innerHTML = '';
    } else {
      document.getElementById(sheetName.toLowerCase() + "-tab").innerHTML = msg;
    }
    return;
  }

  const reversedData = [...data].reverse();

  if (sheetName === "Winners") {
    const leaderboard = calculateLeaderboard(reversedData);
    renderLeaderboard(leaderboard);
    renderWinnerCards(reversedData);
  } else {
    const container = document.getElementById(sheetName.toLowerCase() + "-tab");
    const html = reversedData.map(item => {
      const fields = Object.entries(item).map(([key, value]) => {
        const formattedKey = formatHeader(key);
        if (typeof value === "string" && value.startsWith("http")) {
          return `
            <div class="card-field">
              <span class="card-key">${formattedKey}</span>
              <span class="card-value"><a href="${value}" target="_blank">${value}</a></span>
            </div>`;
        }
        return `
          <div class="card-field">
            <span class="card-key">${formattedKey}</span>
            <span class="card-value">${value}</span>
          </div>`;
      }).join('');
      return `<div class="card">${fields}</div>`;
    }).join('');

    container.innerHTML = `<div class="card-container">${html}</div>`;
  }
}

/* --------- 🧮 Leaderboard Calculation (Handles Ties) ---------- */
function calculateLeaderboard(winnersData) {
  const rankWeight = { "I": 3, "II": 2, "III": 1 };
  const table = {};

  winnersData.forEach(entry => {
    const names = entry["Winners Name"]?.split(",").map(n => n.trim());
    const pos = entry["Position"];

    if (names && pos) {
      names.forEach(name => {
        if (!table[name]) table[name] = { count: 0, best: 0 };
        table[name].count += 1;
        const weight = rankWeight[pos] || 0;
        if (weight > table[name].best) table[name].best = weight;
      });
    }
  });

  const sorted = Object.entries(table)
    .map(([name, data]) => ({ name, count: data.count, best: data.best }))
    .sort((a, b) => (b.count === a.count ? b.best - a.best : b.count - a.count));

  // Fair ties
  const finalLeaderboard = [];
  let lastCount = null, lastBest = null;

  for (const player of sorted) {
    if (finalLeaderboard.length < 3 || (player.count === lastCount && player.best === lastBest)) {
      finalLeaderboard.push(player);
      lastCount = player.count;
      lastBest = player.best;
    } else break;
  }
  return finalLeaderboard;
}

/* --------- 🏆 Render Leaderboard ---------- */
function renderLeaderboard(leaderboard) {
  const container = document.getElementById("leaderboard");
  if (!container) return;

  if (leaderboard.length === 0) {
    container.innerHTML = "<p>No leaderboard yet. Keep competing!</p>";
    return;
  }

  const medalMap = { 1: "🥇", 2: "🥈", 3: "🥉" };
  let html = `<h3 class="text-xl font-bold mb-2">🏆 VEC Champions Leaderboard</h3><ul class="space-y-2">`;

  let currentRank = 1;
  for (let i = 0; i < leaderboard.length; i++) {
    const player = leaderboard[i];
    const prev = leaderboard[i - 1];

    if (i > 0 && player.count === prev.count && player.best === prev.best) {
      // Tie → same rank
    } else if (i > 0) currentRank++;

    const medal = medalMap[currentRank] || "";
    html += `
      <li class="flex justify-between bg-gray-100 p-2 rounded-lg shadow">
        <span>${medal} ${player.name}</span>
        <span class="font-semibold">
          ${player.count} ${player.count === 1 ? "win" : "wins"} 
          (Best: ${player.best === 3 ? "I" : player.best === 2 ? "II" : "III"} Place)
        </span>
      </li>`;
  }

  html += `</ul>`;
  container.innerHTML = html;
}

/* --------- 🏅 Render Winner Cards ---------- */
function renderWinnerCards(data) {
  const container = document.getElementById("winners-list");
  if (!container) return;

  const html = data.map(item => {
    const fields = Object.entries(item).map(([key, value]) => {
      const formattedKey = formatHeader(key);
      return `
        <div class="card-field">
          <span class="card-key">${formattedKey}</span>
          <span class="card-value">${value}</span>
        </div>`;
    }).join('');
    return `<div class="card">${fields}</div>`;
  }).join('');

  container.innerHTML = `<div class="card-container">${html}</div>`;
}

/* --------- ⚙️ Service Worker (Offline Cache) ---------- */
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("service-worker.js")
    .then(reg => console.log("✅ Service Worker registered:", reg))
    .catch(err => console.error("❌ Service Worker registration failed:", err));
}
