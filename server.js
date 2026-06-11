const express = require("express");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const session = require("express-session");

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_PATH = path.join(__dirname, "data", "db.json");
const SCORING = {
  exactPoints: 3,
  tendencyPoints: 1
};
const DEFAULT_DEADLINE_MINUTES_BEFORE_KICKOFF = 0;

const GROUPS = {
  A: ["Mexico", "Zuid-Afrika", "Zuid-Korea", "Tsjechie"],
  B: ["Canada", "Bosnie en Herzegovina", "Qatar", "Zwitserland"],
  C: ["Brazilie", "Marokko", "Haiti", "Schotland"],
  D: ["Verenigde Staten", "Paraguay", "Australie", "Turkije"],
  E: ["Duitsland", "Curacao", "Ivoorkust", "Ecuador"],
  F: ["Nederland", "Japan", "Zweden", "Tunesie"],
  G: ["Belgie", "Egypte", "Iran", "Nieuw-Zeeland"],
  H: ["Spanje", "Kaapverdie", "Saoedi-Arabie", "Uruguay"],
  I: ["Frankrijk", "Senegal", "Irak", "Noorwegen"],
  J: ["Argentinie", "Algerije", "Oostenrijk", "Jordanie"],
  K: ["Portugal", "DR Congo", "Oezbekistan", "Colombia"],
  L: ["Engeland", "Kroatie", "Ghana", "Panama"]
};

const GROUP_DATES = {
  A: ["2026-06-11", "2026-06-18", "2026-06-24"],
  B: ["2026-06-12", "2026-06-18", "2026-06-24"],
  C: ["2026-06-13", "2026-06-19", "2026-06-24"],
  D: ["2026-06-12", "2026-06-19", "2026-06-25"],
  E: ["2026-06-14", "2026-06-20", "2026-06-25"],
  F: ["2026-06-14", "2026-06-20", "2026-06-25"],
  G: ["2026-06-15", "2026-06-21", "2026-06-26"],
  H: ["2026-06-15", "2026-06-21", "2026-06-26"],
  I: ["2026-06-16", "2026-06-22", "2026-06-26"],
  J: ["2026-06-16", "2026-06-22", "2026-06-27"],
  K: ["2026-06-17", "2026-06-23", "2026-06-27"],
  L: ["2026-06-17", "2026-06-23", "2026-06-27"]
};

function ensureDataFile() {
  if (!fs.existsSync(DATA_PATH)) {
    const seed = {
      users: [],
      matches: [],
      predictions: []
    };
    fs.writeFileSync(DATA_PATH, JSON.stringify(seed, null, 2), "utf8");
  }

  const db = readDb();
  let changed = false;

  if (!Array.isArray(db.users)) {
    db.users = [];
    changed = true;
  }

  if (!Array.isArray(db.matches)) {
    db.matches = [];
    changed = true;
  }

  if (!Array.isArray(db.predictions)) {
    db.predictions = [];
    changed = true;
  }

  if (!db.settings || typeof db.settings !== "object") {
    db.settings = {
      deadlineMinutesBeforeKickoff: DEFAULT_DEADLINE_MINUTES_BEFORE_KICKOFF
    };
    changed = true;
  }

  if (!Number.isInteger(db.settings.deadlineMinutesBeforeKickoff)) {
    db.settings.deadlineMinutesBeforeKickoff = DEFAULT_DEADLINE_MINUTES_BEFORE_KICKOFF;
    changed = true;
  }

  changed = syncGroupStageMatches(db) || changed;

  if (changed) {
    writeDb(db);
  }
}

function generateGroupStageMatches() {
  const fixtures = [];
  const roundTimes = ["17:00:00.000Z", "20:00:00.000Z"];

  for (const [group, teams] of Object.entries(GROUPS)) {
    const dates = GROUP_DATES[group];
    const [t1, t2, t3, t4] = teams;

    const pairings = [
      [
        { homeTeam: t1, awayTeam: t2 },
        { homeTeam: t3, awayTeam: t4 }
      ],
      [
        { homeTeam: t1, awayTeam: t3 },
        { homeTeam: t4, awayTeam: t2 }
      ],
      [
        { homeTeam: t4, awayTeam: t1 },
        { homeTeam: t2, awayTeam: t3 }
      ]
    ];

    pairings.forEach((round, roundIndex) => {
      round.forEach((game, gameIndex) => {
        fixtures.push({
          group,
          homeTeam: game.homeTeam,
          awayTeam: game.awayTeam,
          kickoff: `${dates[roundIndex]}T${roundTimes[gameIndex]}`,
          homeScore: null,
          awayScore: null
        });
      });
    });
  }

  return fixtures;
}

function syncGroupStageMatches(db) {
  const templates = generateGroupStageMatches();
  let nextId = db.matches.length > 0 ? Math.max(...db.matches.map((m) => m.id || 0)) + 1 : 1;
  let changed = false;

  for (const template of templates) {
    const existing = db.matches.find(
      (m) =>
        m.group === template.group &&
        m.homeTeam === template.homeTeam &&
        m.awayTeam === template.awayTeam
    );

    const fallback = db.matches.find(
      (m) =>
        (!m.group || m.group === null) &&
        m.homeTeam === template.homeTeam &&
        m.awayTeam === template.awayTeam
    );

    if (!existing && !fallback) {
      db.matches.push({
        id: nextId,
        ...template
      });
      nextId += 1;
      changed = true;
      continue;
    }

    const target = existing || fallback;

    if (!target.group || target.group !== template.group) {
      target.group = template.group;
      changed = true;
    }

    if (!target.kickoff || target.kickoff.slice(0, 10) !== template.kickoff.slice(0, 10)) {
      target.kickoff = template.kickoff;
      changed = true;
    }
  }

  return changed;
}

function getDeadlineMinutes(db) {
  if (!db.settings || !Number.isInteger(db.settings.deadlineMinutesBeforeKickoff)) {
    return DEFAULT_DEADLINE_MINUTES_BEFORE_KICKOFF;
  }
  return db.settings.deadlineMinutesBeforeKickoff;
}

function readDb() {
  return JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));
}

function writeDb(db) {
  fs.writeFileSync(DATA_PATH, JSON.stringify(db, null, 2), "utf8");
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(":");
  const check = crypto.scryptSync(password, salt, 64).toString("hex");
  return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(check, "hex"));
}

function sanitizeUser(user) {
  return {
    id: user.id,
    username: user.username
  };
}

function calculatePredictionPoints(match, prediction) {
  if (match.homeScore === null || match.awayScore === null) {
    return 0;
  }

  if (prediction.homeScore === match.homeScore && prediction.awayScore === match.awayScore) {
    return SCORING.exactPoints;
  }

  const actualDiff = match.homeScore - match.awayScore;
  const predictedDiff = prediction.homeScore - prediction.awayScore;

  const sameTendency =
    (actualDiff > 0 && predictedDiff > 0) ||
    (actualDiff < 0 && predictedDiff < 0) ||
    (actualDiff === 0 && predictedDiff === 0);

  return sameTendency ? SCORING.tendencyPoints : 0;
}

function isPredictionLocked(match, deadlineMinutesBeforeKickoff) {
  const kickoffTime = new Date(match.kickoff).getTime();
  const deadlineTime = kickoffTime - deadlineMinutesBeforeKickoff * 60 * 1000;
  return Date.now() >= deadlineTime;
}

function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Niet ingelogd" });
  }
  return next();
}

ensureDataFile();

app.use(express.json());
app.use(
  session({
    secret: process.env.SESSION_SECRET || "wk-super-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax"
    }
  })
);

app.use(express.static(path.join(__dirname, "public")));

app.get("/api/settings", (req, res) => {
  const db = readDb();
  return res.json({
    scoring: SCORING,
    deadlineMinutesBeforeKickoff: getDeadlineMinutes(db)
  });
});

app.patch("/api/settings", requireAuth, (req, res) => {
  const { deadlineMinutesBeforeKickoff } = req.body;

  if (!Number.isInteger(deadlineMinutesBeforeKickoff) || deadlineMinutesBeforeKickoff < 0 || deadlineMinutesBeforeKickoff > 1440) {
    return res.status(400).json({ error: "Deadline moet een geheel getal tussen 0 en 1440 minuten zijn" });
  }

  const db = readDb();
  db.settings.deadlineMinutesBeforeKickoff = deadlineMinutesBeforeKickoff;
  writeDb(db);

  return res.json({
    scoring: SCORING,
    deadlineMinutesBeforeKickoff: db.settings.deadlineMinutesBeforeKickoff
  });
});

app.get("/api/me", (req, res) => {
  const db = readDb();
  const user = db.users.find((u) => u.id === req.session.userId);

  if (!user) {
    return res.json({ user: null });
  }

  return res.json({ user: sanitizeUser(user) });
});

app.post("/api/register", (req, res) => {
  const { username, password } = req.body;

  if (!username || !password || username.trim().length < 3 || password.length < 4) {
    return res.status(400).json({ error: "Gebruikersnaam of wachtwoord ongeldig" });
  }

  const db = readDb();
  const normalized = username.trim().toLowerCase();

  if (db.users.some((u) => u.username.toLowerCase() === normalized)) {
    return res.status(409).json({ error: "Gebruikersnaam bestaat al" });
  }

  const user = {
    id: db.users.length > 0 ? Math.max(...db.users.map((u) => u.id)) + 1 : 1,
    username: username.trim(),
    passwordHash: hashPassword(password)
  };

  db.users.push(user);
  writeDb(db);

  req.session.userId = user.id;

  return res.status(201).json({ user: sanitizeUser(user) });
});

app.post("/api/login", (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: "Vul gebruikersnaam en wachtwoord in" });
  }

  const db = readDb();
  const user = db.users.find((u) => u.username.toLowerCase() === username.trim().toLowerCase());

  if (!user || !verifyPassword(password, user.passwordHash)) {
    return res.status(401).json({ error: "Inloggen mislukt" });
  }

  req.session.userId = user.id;
  return res.json({ user: sanitizeUser(user) });
});

app.post("/api/logout", (req, res) => {
  req.session.destroy(() => {
    res.json({ success: true });
  });
});

app.get("/api/matches", requireAuth, (req, res) => {
  const db = readDb();
  const deadlineMinutes = getDeadlineMinutes(db);
  const mine = db.predictions.filter((p) => p.userId === req.session.userId);
  const byMatch = new Map(mine.map((p) => [p.matchId, p]));

  const list = db.matches.map((match) => ({
    ...match,
    myPrediction: byMatch.get(match.id) || null,
    myPoints: byMatch.get(match.id) ? calculatePredictionPoints(match, byMatch.get(match.id)) : 0,
    predictionLocked: isPredictionLocked(match, deadlineMinutes)
  }));

  return res.json({ matches: list });
});

app.post("/api/matches", requireAuth, (req, res) => {
  const { group, homeTeam, awayTeam, kickoff } = req.body;

  if (!homeTeam || !awayTeam || !kickoff) {
    return res.status(400).json({ error: "Vul thuisteam, uitteam en aftrap in" });
  }

  const db = readDb();
  const match = {
    id: db.matches.length > 0 ? Math.max(...db.matches.map((m) => m.id)) + 1 : 1,
    group: group ? String(group).trim().toUpperCase() : null,
    homeTeam: String(homeTeam).trim(),
    awayTeam: String(awayTeam).trim(),
    kickoff: new Date(kickoff).toISOString(),
    homeScore: null,
    awayScore: null
  };

  db.matches.push(match);
  writeDb(db);

  return res.status(201).json({ match });
});

app.patch("/api/matches/:id/result", requireAuth, (req, res) => {
  const matchId = Number(req.params.id);
  const { homeScore, awayScore } = req.body;

  if (!Number.isInteger(homeScore) || !Number.isInteger(awayScore) || homeScore < 0 || awayScore < 0) {
    return res.status(400).json({ error: "Score moet een geheel getal vanaf 0 zijn" });
  }

  const db = readDb();
  const match = db.matches.find((m) => m.id === matchId);

  if (!match) {
    return res.status(404).json({ error: "Wedstrijd niet gevonden" });
  }

  match.homeScore = homeScore;
  match.awayScore = awayScore;
  writeDb(db);

  return res.json({ match });
});

app.post("/api/predictions", requireAuth, (req, res) => {
  const { matchId, homeScore, awayScore } = req.body;
  const numericMatchId = Number(matchId);

  if (!Number.isInteger(numericMatchId)) {
    return res.status(400).json({ error: "Ongeldige wedstrijd" });
  }

  if (!Number.isInteger(homeScore) || !Number.isInteger(awayScore) || homeScore < 0 || awayScore < 0) {
    return res.status(400).json({ error: "Voorspelling moet uit hele getallen bestaan" });
  }

  const db = readDb();
  const match = db.matches.find((m) => m.id === numericMatchId);

  if (!match) {
    return res.status(404).json({ error: "Wedstrijd niet gevonden" });
  }

  const deadlineMinutes = getDeadlineMinutes(db);
  if (isPredictionLocked(match, deadlineMinutes)) {
    return res.status(409).json({ error: "Deadline voorbij: voorspellen is gesloten voor deze wedstrijd" });
  }

  const predictionIndex = db.predictions.findIndex(
    (p) => p.userId === req.session.userId && p.matchId === numericMatchId
  );

  const prediction = {
    userId: req.session.userId,
    matchId: numericMatchId,
    homeScore,
    awayScore,
    updatedAt: new Date().toISOString()
  };

  if (predictionIndex >= 0) {
    db.predictions[predictionIndex] = prediction;
  } else {
    db.predictions.push(prediction);
  }

  writeDb(db);

  return res.json({ prediction });
});

app.get("/api/leaderboard", requireAuth, (req, res) => {
  const db = readDb();

  const rows = db.users.map((user) => {
    const userPredictions = db.predictions.filter((p) => p.userId === user.id);
    let points = 0;
    let exactHits = 0;
    let exactPoints = 0;
    let tendencyHits = 0;

    for (const prediction of userPredictions) {
      const match = db.matches.find((m) => m.id === prediction.matchId);
      if (!match) {
        continue;
      }

      const pts = calculatePredictionPoints(match, prediction);
      points += pts;

      if (prediction.homeScore === match.homeScore && prediction.awayScore === match.awayScore) {
        exactHits += 1;
        exactPoints += SCORING.exactPoints;
      } else if (pts > 0) {
        tendencyHits += 1;
      }
    }

    return {
      userId: user.id,
      username: user.username,
      points,
      exactHits,
      exactPoints,
      tendencyHits
    };
  });

  rows.sort(
    (a, b) =>
      b.points - a.points ||
      b.exactHits - a.exactHits ||
      b.tendencyHits - a.tendencyHits ||
      a.username.localeCompare(b.username)
  );

  return res.json({ leaderboard: rows });
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`WK tracker draait op http://localhost:${PORT}`);
});
