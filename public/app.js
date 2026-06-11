// ========== THEMA ==========
const themeButtons = Array.from(document.querySelectorAll(".theme-btn"));

function applyTheme(theme) {
  const t = theme === "light" ? "light" : "dark";
  document.body.dataset.theme = t;
  localStorage.setItem("wk-theme", t);
  themeButtons.forEach((b) => b.classList.toggle("is-active", b.dataset.theme === t));
}

themeButtons.forEach((b) => b.addEventListener("click", () => applyTheme(b.dataset.theme)));
applyTheme(localStorage.getItem("wk-theme") || "dark");

// ========== DOM ==========
const importFileInput = document.getElementById("importFileInput");
const importPasteArea = document.getElementById("importPasteArea");
const loadRemoteBtn = document.getElementById("loadRemoteBtn");
const loadBtn = document.getElementById("loadBtn");
const clearBtn = document.getElementById("clearBtn");
const resultsView = document.getElementById("resultsView");
const leaderboardEl = document.getElementById("leaderboard");
const pointsTableEl = document.getElementById("pointsTable");
const matchesEl = document.getElementById("matches");
const messageEl = document.getElementById("message");

function showMessage(text, type = "") {
  messageEl.textContent = text;
  messageEl.className = `message ${type}`.trim();
}

async function loadRemoteData(auto = false) {
  try {
    const response = await fetch(`./wedstrijden-data.md?v=${Date.now()}`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const text = await response.text();
    if (!text.trim()) {
      throw new Error("Bestand is leeg");
    }

    importPasteArea.value = text;
    loadAndRender(text);

    if (!auto) {
      showMessage("GitHub data geladen.", "success");
    }
    return true;
  } catch (error) {
    if (!auto) {
      showMessage(`GitHub data laden mislukt: ${error.message}`, "error");
    }
    return false;
  }
}

// ========== PARSER ==========
// Format: blokken gescheiden door lege regels.
// Eerste regel van elk blok = wedstrijdnaam.
// Daarna per regel: "naam score"  bv "mees 3-1"
// "uitslag 2-1" = de echte uitslag van die wedstrijd.
// Spelers worden automatisch herkend.

function parseScore(str) {
  if (!str) return null;
  const m = String(str).trim().match(/^(\d+)\s*[-\u2013]\s*(\d+)$/);
  if (!m) return null;
  return { home: Number(m[1]), away: Number(m[2]) };
}

function parsePredLine(line) {
  const m = line.match(/^(.+?)\s+(\d+\s*[-\u2013]\s*\d+)$/);
  if (!m) return null;
  return { name: m[1].trim(), score: parseScore(m[2]) };
}

function parseFile(text) {
  const blocks = text.split(/\n\s*\n/).map(function(b){ return b.trim(); }).filter(Boolean);
  const matches = [];
  const allPredNames = [];

  for (var bi = 0; bi < blocks.length; bi++) {
    var lines = blocks[bi].split("\n").map(function(l){ return l.trim(); }).filter(Boolean);
    if (!lines.length) continue;

    var titleLine = null;
    var startIdx = 0;
    for (var i = 0; i < lines.length; i++) {
      if (lines[i].startsWith("#")) continue;
      if (parsePredLine(lines[i])) continue; // score-regel, geen titel
      titleLine = lines[i];
      startIdx = i + 1;
      break;
    }
    if (!titleLine) continue;

    var title = titleLine.replace(/^#+\s*/, "").trim();
    var result = null;
    var predictions = {};

    for (var j = startIdx; j < lines.length; j++) {
      var line = lines[j];
      if (line.startsWith("#")) continue;
      var parsed = parsePredLine(line);
      if (!parsed) continue;
      var nameLower = parsed.name.toLowerCase();
      if (nameLower === "uitslag" || nameLower === "result" || nameLower === "score") {
        result = parsed.score;
      } else {
        predictions[parsed.name] = parsed.score;
        if (allPredNames.indexOf(parsed.name) === -1) allPredNames.push(parsed.name);
      }
    }

    if (Object.keys(predictions).length > 0 || result) {
      matches.push({ title: title, result: result, predictions: predictions });
    }
  }

  return { players: allPredNames, matches: matches };
}
// ========== PUNTEN ==========
const EXACT = 3;
const TENDENCY = 1;

function calcPoints(result, prediction) {
  if (!result || !prediction) return null;
  if (prediction.home === result.home && prediction.away === result.away) return EXACT;
  if (Math.sign(prediction.home - prediction.away) === Math.sign(result.home - result.away)) return TENDENCY;
  return 0;
}

function computeLeaderboard(players, matches) {
  return players
    .map((player) => {
      let points = 0;
      let exact = 0;
      matches.forEach((m) => {
        const pts = calcPoints(m.result, m.predictions[player]);
        if (pts !== null) {
          points += pts;
          if (pts === EXACT) exact++;
        }
      });
      return { player, points, exact };
    })
    .sort((a, b) => b.points - a.points);
}

// ========== RENDEREN ==========
function formatDate(iso) {
  return new Intl.DateTimeFormat("nl-NL", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
}

function renderLeaderboard(rows) {
  leaderboardEl.innerHTML = rows
    .map(
      (row, i) => `
      <div class="leaderboard-row">
        <span class="rank">#${i + 1}</span>
        <span>${row.player}<br /><small>Exact: ${row.exact}× (${row.exact * EXACT} pt)</small></span>
        <strong>${row.points} pt</strong>
      </div>`
    )
    .join("");
}

function renderPointsTable(players, matches) {
  const played = matches.filter((m) => m.result);
  if (!played.length) {
    pointsTableEl.innerHTML = "<p class='meta'>Nog geen uitslagen.</p>";
    return;
  }
  const header = `<tr><th>Wedstrijd</th>${players.map((p) => `<th>${p}</th>`).join("")}</tr>`;
  const rows = played
    .map((m) => {
      const cells = players
        .map((p) => {
          const pts = calcPoints(m.result, m.predictions[p]);
          const pred = m.predictions[p];
          const predStr = pred ? `${pred.home}-${pred.away}` : "-";
          const cls = pts === EXACT ? "pts-exact" : pts === TENDENCY ? "pts-tendency" : pts === 0 ? "pts-zero" : "";
          return `<td class="${cls}">${predStr}<br/><small>${pts !== null ? pts + " pt" : "-"}</small></td>`;
        })
        .join("");
      return `<tr><td><strong>${m.title}</strong><br/><small>${m.result.home}-${m.result.away}</small></td>${cells}</tr>`;
    })
    .join("");
  pointsTableEl.innerHTML = `<div class="table-wrap"><table class="pts-table">${header}${rows}</table></div>`;
}

function renderMatches(players, matches) {
  matchesEl.innerHTML = matches
    
    .map((m) => {
      const resultText = m.result ? `Uitslag: ${m.result.home}-${m.result.away}` : "Nog geen uitslag";
      const predsHtml = players.length
        ? players
            .map((p) => {
              const pred = m.predictions[p];
              const pts = calcPoints(m.result, pred);
              const predStr = pred ? `${pred.home}-${pred.away}` : "-";
              const badge =
                pts === EXACT
                  ? `<span class="badge badge-ok">Exact +${EXACT}</span>`
                  : pts === TENDENCY
                  ? `<span class="badge badge-warn">Neiging +${TENDENCY}</span>`
                  : pts === 0
                  ? `<span class="badge badge-danger">0 pt</span>`
                  : "";
              return `<span class="pred-chip">${p}: <strong>${predStr}</strong> ${badge}</span>`;
            })
            .join("")
        : "";
      return `
        <article class="match-card">
          <div class="match-head">
            <div class="teams">${m.title}</div>
          </div>
          <div class="meta">${resultText}</div>
          <div class="pred-row">${predsHtml}</div>
        </article>`;
    })
    .join("");
}

// ========== LADEN ==========
function loadAndRender(text) {
  const { players, matches } = parseFile(text);
  if (!matches.length) {
    showMessage("Geen geldige wedstrijden gevonden. Controleer het format.", "error");
    return;
  }
  if (!players.length) {
    showMessage("Geen spelers gevonden. Zorg dat voorspellingen op een nieuwe regel staan: naam score (bv: mees 3-1)", "error");
    return;
  }

  const lb = computeLeaderboard(players, matches);
  renderLeaderboard(lb);
  renderPointsTable(players, matches);
  renderMatches(players, matches);
  resultsView.classList.remove("hidden");
  showMessage(`${matches.length} wedstrijden geladen voor ${players.length} spelers.`, "success");

  // Sla tekst op zodat hij na refresh bewaard blijft
  localStorage.setItem("wk-poule-text", text);
}

loadBtn.addEventListener("click", () => {
  const text = importPasteArea.value.trim();
  if (!text) { showMessage("Geen tekst om te laden.", "error"); return; }
  loadAndRender(text);
});

if (loadRemoteBtn) {
  loadRemoteBtn.addEventListener("click", () => {
    loadRemoteData(false);
  });
}

clearBtn.addEventListener("click", () => {
  importPasteArea.value = "";
  resultsView.classList.add("hidden");
  messageEl.textContent = "";
  localStorage.removeItem("wk-poule-text");
});

importFileInput.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => { importPasteArea.value = ev.target.result; };
  reader.readAsText(file);
});

// Herstel vorige sessie
const saved = localStorage.getItem("wk-poule-text");
if (saved) {
  importPasteArea.value = saved;
  loadAndRender(saved);
} else {
  loadRemoteData(true);
}