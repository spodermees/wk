const authView = document.getElementById("authView");
const appView = document.getElementById("appView");
const messageEl = document.getElementById("message");
const matchesEl = document.getElementById("matches");
const leaderboardEl = document.getElementById("leaderboard");
const currentUserEl = document.getElementById("currentUser");

const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");
const matchForm = document.getElementById("matchForm");
const logoutBtn = document.getElementById("logoutBtn");
const deadlineForm = document.getElementById("deadlineForm");
const deadlineInput = document.getElementById("deadlineInput");
const themeButtons = Array.from(document.querySelectorAll(".theme-btn"));
const apiBaseMeta = document.querySelector('meta[name="api-base-url"]');
const API_BASE_URL = (apiBaseMeta?.content || "").trim().replace(/\/+$/, "");

let currentUser = null;
let matches = [];
let settings = {
  scoring: {
    exactPoints: 3,
    tendencyPoints: 1
  },
  deadlineMinutesBeforeKickoff: 0
};

function applyTheme(theme) {
  const selectedTheme = theme === "light" ? "light" : "dark";
  document.body.dataset.theme = selectedTheme;
  localStorage.setItem("wk-theme", selectedTheme);

  themeButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.theme === selectedTheme);
  });
}

function initTheme() {
  const storedTheme = localStorage.getItem("wk-theme");
  applyTheme(storedTheme || "dark");
}

function showMessage(text, type = "") {
  messageEl.textContent = text;
  messageEl.className = `message ${type}`.trim();
}

async function api(path, options = {}) {
  const targetPath = path.startsWith("/") ? path : `/${path}`;
  const response = await fetch(`${API_BASE_URL}${targetPath}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json"
    },
    ...options
  });

  let payload = {};
  try {
    payload = await response.json();
  } catch {
    payload = {};
  }

  if (!response.ok) {
    throw new Error(payload.error || "Er ging iets mis");
  }

  return payload;
}

function formatDate(iso) {
  return new Intl.DateTimeFormat("nl-NL", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(iso));
}

function renderMatches() {
  if (matches.length === 0) {
    matchesEl.innerHTML = "<p>Geen wedstrijden toegevoegd.</p>";
    return;
  }

  matchesEl.innerHTML = matches
    .sort((a, b) => new Date(a.kickoff) - new Date(b.kickoff))
    .map((match) => {
      const prediction = match.myPrediction;
      const isLocked = Boolean(match.predictionLocked);
      const lockLabel = isLocked ? "Deadline voorbij" : "Open voor voorspellen";
      const lockClass = isLocked ? "badge badge-danger" : "badge";
      const disabledAttr = isLocked ? "disabled" : "";
      const predictionText = prediction
        ? `Mijn voorspelling: ${prediction.homeScore}-${prediction.awayScore}`
        : "Nog geen voorspelling";

      const resultText =
        match.homeScore === null || match.awayScore === null
          ? "Nog geen uitslag"
          : `Uitslag: ${match.homeScore}-${match.awayScore}`;

      const pointsText =
        match.homeScore === null || match.awayScore === null
          ? "Punten: nog niet berekend"
          : `Punten op deze wedstrijd: ${match.myPoints}`;

      const groupText = match.group ? `Poule ${match.group}` : "Losse wedstrijd";
      const deadlineText = `${settings.deadlineMinutesBeforeKickoff} min voor aftrap`;

      return `
        <article class="match-card" data-match-id="${match.id}">
          <div class="match-head">
            <div>
              <div class="teams">${match.homeTeam} - ${match.awayTeam}</div>
              <div class="meta">${groupText} | Aftrap: ${formatDate(match.kickoff)} | Deadline: ${deadlineText}</div>
            </div>
            <span class="${lockClass}">${lockLabel}</span>
          </div>

          <div class="meta">${resultText}</div>

          <div class="score-row">
            <input type="number" min="0" step="1" class="pred-home" placeholder="Thuis" value="${prediction ? prediction.homeScore : ""}" ${disabledAttr} />
            <input type="number" min="0" step="1" class="pred-away" placeholder="Uit" value="${prediction ? prediction.awayScore : ""}" ${disabledAttr} />
            <button class="save-prediction" ${disabledAttr}>Voorspelling opslaan</button>
          </div>

          <div class="score-row">
            <input type="number" min="0" step="1" class="res-home" placeholder="Uitslag thuis" value="${match.homeScore ?? ""}" />
            <input type="number" min="0" step="1" class="res-away" placeholder="Uitslag uit" value="${match.awayScore ?? ""}" />
            <button class="save-result secondary">Uitslag opslaan</button>
          </div>

          <div class="meta">${predictionText} | ${pointsText}</div>
        </article>
      `;
    })
    .join("");
}

function renderLeaderboard(rows) {
  if (rows.length === 0) {
    leaderboardEl.innerHTML = "<p>Nog geen spelers.</p>";
    return;
  }

  leaderboardEl.innerHTML = rows
    .map(
      (row, index) => `
      <div class="leaderboard-row">
        <span class="rank">#${index + 1}</span>
        <span>${row.username}<br /><small>Exact: ${row.exactHits} (${row.exactPoints} pt)</small></span>
        <strong>${row.points} pt</strong>
      </div>
    `
    )
    .join("");
}

async function refreshData() {
  const [settingsPayload, matchesPayload, leaderboardPayload] = await Promise.all([
    api("/api/settings"),
    api("/api/matches"),
    api("/api/leaderboard")
  ]);

  settings = settingsPayload;
  deadlineInput.value = settings.deadlineMinutesBeforeKickoff;
  matches = matchesPayload.matches;
  renderMatches();
  renderLeaderboard(leaderboardPayload.leaderboard);
}

function toggleViews() {
  if (currentUser) {
    authView.classList.add("hidden");
    appView.classList.remove("hidden");
    currentUserEl.textContent = currentUser.username;
  } else {
    appView.classList.add("hidden");
    authView.classList.remove("hidden");
    currentUserEl.textContent = "";
  }
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(loginForm);

  try {
    const payload = await api("/api/login", {
      method: "POST",
      body: JSON.stringify({
        username: formData.get("username"),
        password: formData.get("password")
      })
    });

    currentUser = payload.user;
    toggleViews();
    await refreshData();
    showMessage("Je bent ingelogd.", "success");
    loginForm.reset();
  } catch (error) {
    showMessage(error.message, "error");
  }
});

registerForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(registerForm);

  try {
    const payload = await api("/api/register", {
      method: "POST",
      body: JSON.stringify({
        username: formData.get("username"),
        password: formData.get("password")
      })
    });

    currentUser = payload.user;
    toggleViews();
    await refreshData();
    showMessage("Account aangemaakt en ingelogd.", "success");
    registerForm.reset();
  } catch (error) {
    showMessage(error.message, "error");
  }
});

logoutBtn.addEventListener("click", async () => {
  try {
    await api("/api/logout", { method: "POST" });
    currentUser = null;
    matches = [];
    toggleViews();
    matchesEl.innerHTML = "";
    leaderboardEl.innerHTML = "";
    showMessage("Uitgelogd.", "success");
  } catch (error) {
    showMessage(error.message, "error");
  }
});

matchForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(matchForm);

  try {
    await api("/api/matches", {
      method: "POST",
      body: JSON.stringify({
        homeTeam: formData.get("homeTeam"),
        awayTeam: formData.get("awayTeam"),
        kickoff: formData.get("kickoff")
      })
    });

    await refreshData();
    showMessage("Wedstrijd toegevoegd.", "success");
    matchForm.reset();
  } catch (error) {
    showMessage(error.message, "error");
  }
});

deadlineForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  try {
    const deadlineMinutesBeforeKickoff = Number(deadlineInput.value);
    await api("/api/settings", {
      method: "PATCH",
      body: JSON.stringify({ deadlineMinutesBeforeKickoff })
    });

    await refreshData();
    showMessage("Deadline instellingen opgeslagen.", "success");
  } catch (error) {
    showMessage(error.message, "error");
  }
});

matchesEl.addEventListener("click", async (event) => {
  const card = event.target.closest(".match-card");
  if (!card) {
    return;
  }

  const matchId = Number(card.dataset.matchId);

  try {
    if (event.target.classList.contains("save-prediction")) {
      if (event.target.disabled) {
        showMessage("Deadline voorbij voor deze wedstrijd.", "error");
        return;
      }

      const homeScore = Number(card.querySelector(".pred-home").value);
      const awayScore = Number(card.querySelector(".pred-away").value);

      await api("/api/predictions", {
        method: "POST",
        body: JSON.stringify({ matchId, homeScore, awayScore })
      });

      await refreshData();
      showMessage("Voorspelling opgeslagen.", "success");
    }

    if (event.target.classList.contains("save-result")) {
      const homeScore = Number(card.querySelector(".res-home").value);
      const awayScore = Number(card.querySelector(".res-away").value);

      await api(`/api/matches/${matchId}/result`, {
        method: "PATCH",
        body: JSON.stringify({ homeScore, awayScore })
      });

      await refreshData();
      showMessage("Uitslag opgeslagen en ranglijst bijgewerkt.", "success");
    }
  } catch (error) {
    showMessage(error.message, "error");
  }
});

themeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    applyTheme(button.dataset.theme || "dark");
  });
});

async function bootstrap() {
  try {
    const payload = await api("/api/me");
    currentUser = payload.user;
    toggleViews();

    if (currentUser) {
      await refreshData();
    }
  } catch (error) {
    showMessage(error.message, "error");
  }
}

initTheme();
bootstrap();
