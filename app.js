// Your single Google Apps Script URL
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxbzNUWmn-tPtKM4N8LTOmbO2Y5iRHFmKZScSK6XL5BCzLI06vAfd0MXRpQ38-FXe0lvQ/exec';

// Helper function to format header nicely
function formatHeader(header) {
  return header
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

// Tab switching logic
const tabs = document.querySelectorAll('.tab-button');
const tabContents = document.querySelectorAll('.tab-content');

tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    const target = tab.dataset.target;
    const sheet = tab.dataset.sheet;

    // Hide all tab contents
    tabContents.forEach(tc => tc.style.display = 'none');

    // Remove active class
    tabs.forEach(t => t.classList.remove('active'));

    // Show selected tab
    document.getElementById(target).style.display = 'block';
    tab.classList.add('active');

    // Load data
    loadTabData(sheet, target);
  });
});

// Load default tab (Events) on page load
window.addEventListener('DOMContentLoaded', () => {
  document.querySelector('.tab-button[data-sheet="Events"]').classList.add('active');
  document.getElementById('events-tab').style.display = 'block';
  loadTabData('Events', 'events-tab');
});

// Cache object
const cache = {};

// Load data function with caching
async function loadTabData(sheetName, containerId) {
  const container = document.getElementById(containerId);

  // Special handling for Winners tab
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

    const response = await fetch(`${SCRIPT_URL}?sheet=${sheetName}`);
    const data = await response.json();
    cache[sheetName] = data;

    renderData(data, sheetName);
  } catch (error) {
    console.error(error);
    if (sheetName === "Winners") {
      document.getElementById("leaderboard").innerHTML = '<p class="error-text">Failed to load data.</p>';
    } else {
      container.innerHTML = '<p class="error-text">Failed to load data.</p>';
    }
  }
}

// Render data
function renderData(data, sheetName) {
  if (!data || data.length === 0) {
    if (sheetName === "Winners") {
      document.getElementById("leaderboard").innerHTML = '<p class="empty-text">No data available.</p>';
      document.getElementById("winners-list").innerHTML = '';
    } else {
      document.getElementById(sheetName.toLowerCase() + "-tab").innerHTML = '<p class="empty-text">No data available.</p>';
    }
    return;
  }

  const reversedData = [...data].reverse();

  if (sheetName === "Winners") {
    // Leaderboard
    const leaderboard = calculateLeaderboard(reversedData);
    renderLeaderboard(leaderboard);

    // Winner cards
    renderWinnerCards(reversedData);
  } else {
    // Events / Courses cards
    const container = document.getElementById(sheetName.toLowerCase() + "-tab");

    const html = reversedData.map(item => {
      let fields = Object.entries(item).map(([key, value]) => {
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

// 🧮 Leaderboard calculation (with fair tie handling)
function calculateLeaderboard(winnersData) {
  const rankWeight = { "I": 3, "II": 2, "III": 1 }; // higher = better
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
          table[name].best = weight; // track best rank
        }
      });
    }
  });

  const leaderboard = Object.entries(table)
    .map(([name, data]) => ({ name, count: data.count, best: data.best }))
    .sort((a, b) => {
      if (b.count === a.count) return b.best - a.best; // tie → best rank wins
      return b.count - a.count;
    });

  // 🟢 Fair Logic for Ties:
  // Take top 3, but include everyone who ties with 3rd place
  if (leaderboard.length > 3) {
    const thirdPlace = leaderboard[2];
    return leaderboard.filter(player =>
      player.count > thirdPlace.count ||
      (player.count === thirdPlace.count && player.best >= thirdPlace.best)
    );
  }

  return leaderboard;
}

// Render leaderboard
function renderLeaderboard(leaderboard) {
  const container = document.getElementById("leaderboard");
  if (!container) return;

  if (leaderboard.length === 0) {
    container.innerHTML = "<p>No leaderboard yet. Keep competing!</p>";
    return;
  }

  let medals = ["🥇", "🥈", "🥉"];
  let rankMap = { 3: "I", 2: "II", 1: "III" };

  container.innerHTML = `
    <h3 class="text-xl font-bold mb-2">🏆 VEC Champions Leaderboard</h3>
    <ul class="space-y-2">
      ${leaderboard.map((player, i) => `
        <li class="flex justify-between bg-gray-100 p-2 rounded-lg shadow">
          <span>${medals[i] || ""} ${player.name}</span>
          <span class="font-semibold">
            ${player.count} ${player.count === 1 ? "win" : "wins"} 
            (Best: ${rankMap[player.best] || "-"} Place)
          </span>
        </li>
      `).join("")}
    </ul>
  `;
}

// Render winners list cards
function renderWinnerCards(data) {
  const container = document.getElementById("winners-list");
  if (!container) return;

  const html = data.map(item => {
    let fields = Object.entries(item).map(([key, value]) => {
      const formattedKey = formatHeader(key);
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

// Service Worker Registration
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("service-worker.js")
    .then(reg => console.log("✅ Service Worker registered:", reg))
    .catch(err => console.error("❌ Service Worker registration failed:", err));
}