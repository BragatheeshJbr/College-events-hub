// ✅ Google Apps Script URL (Your live Sheet connection)
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxbzNUWmn-tPtKM4N8LTOmbO2Y5iRHFmKZScSK6XL5BCzLI06vAfd0MXRpQ38-FXe0lvQ/exec';

// 🧩 Helper to format headers
function formatHeader(header) {
  return header.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

// 🌀 Add a global loader element with animation
const loader = document.createElement("div");
loader.id = "global-loader";
loader.innerHTML = `
  <div class="loader-container">
    <div class="spinner"></div>
    <p>Loading data...</p>
  </div>
`;
document.body.appendChild(loader);

// 💫 Loader control functions with fade animation
function showLoader() {
  loader.style.display = "flex";
  loader.style.opacity = "1";
}

function hideLoader() {
  loader.style.opacity = "0";
  setTimeout(() => (loader.style.display = "none"), 500);
}

//  🧭 Tab switching logic with animated transition
const tabs = document.querySelectorAll('.tab-button');
const tabContents = document.querySelectorAll('.tab-content');

tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    const target = tab.dataset.target;
    const sheet = tab.dataset.sheet;

    // Hide all tabs
    tabContents.forEach(tc => {
      tc.classList.remove('active');
      tc.style.opacity = '0';
      setTimeout(() => (tc.style.display = 'none'), 300);
    });
    tabs.forEach(t => t.classList.remove('active'));

    // Show active tab with fade-in animation
    const activeTab = document.getElementById(target);
    activeTab.style.display = 'block';
    setTimeout(() => {
      activeTab.classList.add('active');
      activeTab.style.opacity = '1';
    }, 100);
    tab.classList.add('active');

    // Load data for the selected tab
    loadTabData(sheet, target);
  });
});

// 🏁 Load default tab (Events) on startup
window.addEventListener('DOMContentLoaded', () => {
  const defaultTab = document.querySelector('.tab-button[data-sheet="Events"]');
  if (defaultTab) {
    defaultTab.click();
  }
});

// ⚡ Data cache for performance
const cache = {};

// 📦 Load data dynamically
async function loadTabData(sheetName, containerId) {
  const container = document.getElementById(containerId);
  showLoader();

  if (sheetName === "Winners") {
    document.getElementById("leaderboard").innerHTML = '<p class="loading-text">Loading...</p>';
    document.getElementById("winners-list").innerHTML = '';
  } else {
    container.innerHTML = '<p class="loading-text">Loading...</p>';
  }

  try {
    if (cache[sheetName]) {
      renderData(cache[sheetName], sheetName);
      hideLoader();
      return;
    }

    const response = await fetch(`${SCRIPT_URL}?sheet=${sheetName}`);
    const data = await response.json();
    cache[sheetName] = data;

    renderData(data, sheetName);
    hideLoader();
  } catch (error) {
    console.error(error);
    const msg = '<p class="error-text">Failed to load data.</p>';
    if (sheetName === "Winners") {
      document.getElementById("leaderboard").innerHTML = msg;
    } else {
      container.innerHTML = msg;
    }
    hideLoader();
  }
}

// 🎨 Render data for each tab with card animations
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
    const html = reversedData.map((item, i) => {
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
      return `<div class="card fade-in" style="animation-delay:${i * 0.05}s">${fields}</div>`;
    }).join('');

    container.innerHTML = `<div class="card-container">${html}</div>`;
  }
}

// 🧮 Leaderboard Calculation
function calculateLeaderboard(winnersData) {
  const rankWeight = { "I": 3, "II": 2, "III": 1 };
  const table = {};

  winnersData.forEach(entry => {
    const names = entry["Winners Name"]?.split(",").map(n => n.trim());
    const pos = entry["Position"];

    if (names && pos) {
      names.forEach(name => {
        if (!table[name]) {
          table[name] = { count: 0, best: 0 };
        }
        table[name].count += 1;
        const weight = rankWeight[pos] || 0;
        if (weight > table[name].best) {
          table[name].best = weight;
        }
      });
    }
  });

  const sorted = Object.entries(table)
    .map(([name, data]) => ({ name, count: data.count, best: data.best }))
    .sort((a, b) => {
      if (b.count === a.count) return b.best - a.best;
      return b.count - a.count;
    });

  const finalLeaderboard = [];
  let lastCount = null, lastBest = null;

  for (const player of sorted) {
    if (finalLeaderboard.length < 3 ||
        (player.count === lastCount && player.best === lastBest)) {
      finalLeaderboard.push(player);
      lastCount = player.count;
      lastBest = player.best;
    } else break;
  }

  return finalLeaderboard;
}

// 🏆 Animated Leaderboard
function renderLeaderboard(leaderboard) {
  const container = document.getElementById("leaderboard");
  if (!container) return;

  if (leaderboard.length === 0) {
    container.innerHTML = "<p>No leaderboard yet. Keep competing!</p>";
    return;
  }

  const rankMap = { 3: "I", 2: "II", 1: "III" };
  const medalMap = { 1: "🥇", 2: "🥈", 3: "🥉" };

  let html = `<h3 class="text-xl font-bold mb-2">🏆 VEC Champions Leaderboard</h3><ul class="space-y-2">`;

  let currentRank = 1;
  for (let i = 0; i < leaderboard.length; i++) {
    const player = leaderboard[i];
    const prev = leaderboard[i - 1];

    if (i > 0 && player.count === prev.count && player.best === prev.best) {
      // same rank (tie)
    } else if (i > 0) {
      currentRank++;
    }

    const medal = medalMap[currentRank] || "";
    html += `
      <li class="flex justify-between bg-gray-100 p-2 rounded-lg shadow fade-in" style="animation-delay:${i * 0.1}s">
        <span>${medal} ${player.name}</span>
        <span class="font-semibold">
          ${player.count} ${player.count === 1 ? "win" : "wins"} 
          (Best: ${rankMap[player.best] || "-"} Place)
        </span>
      </li>`;
  }

  html += `</ul>`;
  container.innerHTML = html;
}

// 🏅 Animated Winner Cards
function renderWinnerCards(data) {
  const container = document.getElementById("winners-list");
  if (!container) return;

  const html = data.map((item, i) => {
    const fields = Object.entries(item).map(([key, value]) => {
      const formattedKey = formatHeader(key);
      return `
        <div class="card-field">
          <span class="card-key">${formattedKey}</span>
          <span class="card-colon">:</span>
          <span class="card-value">${value}</span>
        </div>`;
    }).join('');
    return `<div class="card fade-in" style="animation-delay:${i * 0.05}s">${fields}</div>`;
  }).join('');

  container.innerHTML = `<div class="card-container">${html}</div>`;
}

// ⚙️ Service Worker Registration
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("service-worker.js")
    .then(reg => console.log("✅ Service Worker registered:", reg))
    .catch(err => console.error("❌ Service Worker registration failed:", err));
}
