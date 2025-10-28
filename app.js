// ✅ Google Apps Script URL (Your live Sheet connection)
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxbzNUWmn-tPtKM4N8LTOmbO2Y5iRHFmKZScSK6XL5BCzLI06vAfd0MXRpQ38-FXe0lvQ/exec';

// 🧩 Helper to format headers
function formatHeader(header) {
  return header.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

// 🧭 Tab switching logic
const tabs = document.querySelectorAll('.tab-button');
const tabContents = document.querySelectorAll('.tab-content');

tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    const target = tab.dataset.target;
    const sheet = tab.dataset.sheet;

    tabContents.forEach(tc => tc.style.display = 'none');
    tabs.forEach(t => t.classList.remove('active'));

    document.getElementById(target).style.display = 'block';
    tab.classList.add('active');

    loadTabData(sheet, target);
  });
});

// 🏁 Load default tab (External Events)
window.addEventListener('DOMContentLoaded', () => {
  document.querySelector('.tab-button[data-sheet="Events"]').classList.add('active');
  document.getElementById('events-tab').style.display = 'block';
  loadTabData('Events', 'events-tab');
});

// ⚡ Cache for quick re-render
const cache = {};

// 📦 Load Data (UPDATED with safe sheet name encoding)
async function loadTabData(sheetName, containerId) {
  const container = document.getElementById(containerId);

  if (sheetName.includes("Winners")) {
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

    // ✅ Encode sheet name to handle spaces, slashes, etc.
    const encodedSheet = encodeURIComponent(sheetName);

    // ✅ Safe fetch URL
    const response = await fetch(`${SCRIPT_URL}?sheet=${encodedSheet}`);

    const data = await response.json();
    cache[sheetName] = data;
    renderData(data, sheetName);
  } catch (error) {
    console.error(error);
    const msg = '<p class="error-text">Failed to load data.</p>';
    if (sheetName.includes("Winners")) {
      document.getElementById("leaderboard").innerHTML = msg;
    } else {
      container.innerHTML = msg;
    }
  }
}

// 🎨 Render Tab Data
function renderData(data, sheetName) {
  if (!data || data.length === 0) {
    const msg = '<p class="empty-text">No data available.</p>';
    if (sheetName.includes("Winners")) {
      document.getElementById("leaderboard").innerHTML = msg;
      document.getElementById("winners-list").innerHTML = '';
    } else {
      document.getElementById(sheetName.toLowerCase().replace(/ /g, '-') + "-tab").innerHTML = msg;
    }
    return;
  }

  const reversedData = [...data].reverse();

  if (sheetName.includes("Winners")) {
    const leaderboard = calculateLeaderboard(reversedData);
    renderLeaderboard(leaderboard);
    renderWinnerCards(reversedData);
  } else {
    const container = document.getElementById(sheetName.toLowerCase().replace(/ /g, '-') + "-tab");
    const html = reversedData.map(item => {
      const fields = Object.entries(item).map(([key, value]) => {
        const formattedKey = formatHeader(key);
        if (typeof value === "string" && value.startsWith("http")) {
          return `
            <div class="card-field">
              <span class="card-key">${formattedKey}</span>
              <span class="card-colon">:</span>
              <span class="card-value"><a href="${value}" target="_blank">${value}</a></span>
            </div>`;
        }
        return `
          <div class="card-field">
            <span class="card-key">${formattedKey}</span>
            <span class="card-colon">:</span>
            <span class="card-value">${value}</span>
          </div>`;
      }).join('');
      return `<div class="card">${fields}</div>`;
    }).join('');

    container.innerHTML = `<div class="card-container">${html}</div>`;
  }
}

// 🧮 Leaderboard Logic
function calculateLeaderboard(winnersData) {
  const rankWeight = { "I": 3, "II": 2, "III": 1 };
  const table = {};

  winnersData.forEach(entry => {
    const names = entry["Winners Name"]?.split(",").map(n => n.trim());
    const pos = entry["Position"];

    if (names && pos) {
      names.forEach(name => {
        if (!table[name]) {
          table[name] = { wins: 0, totalPoints: 0, bestPositions: [] };
        }
        const weight = rankWeight[pos] || 0;
        table[name].wins += 1;
        table[name].totalPoints += weight;
        table[name].bestPositions.push(weight);
      });
    }
  });

  const leaderboard = Object.entries(table).map(([name, stats]) => ({
    name,
    wins: stats.wins,
    totalPoints: stats.totalPoints,
    best: Math.max(...stats.bestPositions)
  }));

  leaderboard.sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
    if (b.best !== a.best) return b.best - a.best;
    return a.name.localeCompare(b.name);
  });

  const final = [];
  let prev = null;
  let rank = 1;

  leaderboard.forEach((player) => {
    if (
      prev &&
      player.wins === prev.wins &&
      player.totalPoints === prev.totalPoints &&
      player.best === prev.best
    ) {
      player.rank = prev.rank;
    } else {
      player.rank = rank;
    }
    final.push(player);
    prev = player;
    rank++;
  });

  return final.filter(p => p.rank <= 3);
}

// 🏆 Render Leaderboard
function renderLeaderboard(leaderboard) {
  const container = document.getElementById("leaderboard");
  if (!container) return;

  if (leaderboard.length === 0) {
    container.innerHTML = "<p>No leaderboard yet. Keep competing!</p>";
    return;
  }

  const medals = { 1: "🥇", 2: "🥈", 3: "🥉" };

  let html = `<h3 class="text-xl font-bold mb-2">🏆 VEC Champions Leaderboard</h3><ul class="space-y-2">`;

  leaderboard.forEach(player => {
    const medal = medals[player.rank] || "🏅";
    const bestRoman = player.best === 3 ? "I" : player.best === 2 ? "II" : player.best === 1 ? "III" : "-";
    html += `
      <li class="flex justify-between items-center bg-gray-100 p-2 rounded-lg shadow">
        <span style="font-weight:bold;">${medal} ${player.name}</span>
        <span class="font-semibold text-gray-800">${player.wins} wins (Best: ${bestRoman} Place)</span>
      </li>`;
  });

  html += `</ul>`;
  container.innerHTML = html;
}

// 🏅 Render Winner Cards
function renderWinnerCards(data) {
  const container = document.getElementById("winners-list");
  if (!container) return;

  const html = data.map(item => {
    const fields = Object.entries(item).map(([key, value]) => `
      <div class="card-field">
        <span class="card-key">${formatHeader(key)}</span>
        <span class="card-colon">:</span>
        <span class="card-value">${value}</span>
      </div>
    `).join('');
    return `<div class="card">${fields}</div>`;
  }).join('');

  container.innerHTML = `<div class="card-container">${html}</div>`;
}

// ⚙️ Register Service Worker
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("service-worker.js")
    .then(reg => console.log("✅ Service Worker registered"))
    .catch(err => console.error("❌ SW registration failed", err));
}
