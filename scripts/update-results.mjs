import fs from "node:fs";
import path from "node:path";

const DATA_FILE = process.env.POULE_DATA_FILE || "public/wedstrijden-data.md";
const COMPETITION_CODE = process.env.FOOTBALL_COMPETITION_CODE || "WC";
const SEASON = process.env.FOOTBALL_SEASON || "";
const API_TOKEN = process.env.FOOTBALL_DATA_API_TOKEN;

if (!API_TOKEN) {
  console.error("Missing FOOTBALL_DATA_API_TOKEN secret.");
  process.exit(1);
}

const teamAliases = {
  "zuid afrika": "south africa",
  "zuid-korea": "south korea",
  "zuid korea": "south korea",
  "tsjechie": "czechia",
  "bosnie en herzegovina": "bosnia and herzegovina",
  "verenigde staten": "united states",
  "engeland": "england",
  "duitsland": "germany",
  "nederland": "netherlands",
  "argentinie": "argentina",
  "brazilie": "brazil",
  "spanje": "spain",
  "frankrijk": "france",
  "portugal": "portugal",
  "mexico": "mexico",
  "qatar": "qatar",
  "canada": "canada",
  "zwitserland": "switzerland"
};

function normalizeTeamName(value) {
  const normalized = String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return teamAliases[normalized] || normalized;
}

function parseScore(raw) {
  const match = String(raw || "").trim().match(/^(\d+)\s*[-\u2013]\s*(\d+)$/);
  if (!match) {
    return null;
  }

  return {
    home: Number(match[1]),
    away: Number(match[2])
  };
}

function parseDataFile(contents) {
  const blocks = contents
    .split(/\r?\n\s*\r?\n/)
    .map((block) => block.trim())
    .filter(Boolean);

  return blocks.map((block) => {
    const lines = block
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    const title = lines[0] || "";
    let home = "";
    let away = "";

    const teamMatch = title.match(/^(.+?)\s*[-\u2013]\s*(.+)$/);
    if (teamMatch) {
      home = teamMatch[1].trim();
      away = teamMatch[2].trim();
    }

    const resultLineIndex = lines.findIndex((line) => /^\s*(uitslag|result|score)\b/i.test(line));

    return {
      lines,
      title,
      home,
      away,
      resultLineIndex
    };
  });
}

function serializeBlocks(blocks) {
  return `${blocks.map((block) => block.lines.join("\n")).join("\n\n")}\n`;
}

async function fetchFinishedMatches() {
  const seasonParam = SEASON ? `&season=${encodeURIComponent(SEASON)}` : "";
  const url = `https://api.football-data.org/v4/competitions/${encodeURIComponent(COMPETITION_CODE)}/matches?status=FINISHED${seasonParam}`;

  const response = await fetch(url, {
    headers: {
      "X-Auth-Token": API_TOKEN
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`football-data API error ${response.status}: ${errorText}`);
  }

  const payload = await response.json();
  return Array.isArray(payload.matches) ? payload.matches : [];
}

function matchResultForBlock(block, apiMatches) {
  if (!block.home || !block.away) {
    return null;
  }

  const targetHome = normalizeTeamName(block.home);
  const targetAway = normalizeTeamName(block.away);

  const directMatches = apiMatches.filter((match) => {
    const home = normalizeTeamName(match.homeTeam?.name || "");
    const away = normalizeTeamName(match.awayTeam?.name || "");
    return home === targetHome && away === targetAway;
  });

  const reverseMatches = apiMatches.filter((match) => {
    const home = normalizeTeamName(match.homeTeam?.name || "");
    const away = normalizeTeamName(match.awayTeam?.name || "");
    return home === targetAway && away === targetHome;
  });

  const chosen = [...directMatches, ...reverseMatches].sort((a, b) => {
    const dateA = new Date(a.utcDate || 0).getTime();
    const dateB = new Date(b.utcDate || 0).getTime();
    return dateB - dateA;
  })[0];

  if (!chosen) {
    return null;
  }

  const fullTime = chosen.score?.fullTime;
  if (typeof fullTime?.home !== "number" || typeof fullTime?.away !== "number") {
    return null;
  }

  const chosenHome = normalizeTeamName(chosen.homeTeam?.name || "");
  const isDirect = chosenHome === targetHome;

  if (isDirect) {
    return { home: fullTime.home, away: fullTime.away };
  }

  return { home: fullTime.away, away: fullTime.home };
}

function updateBlocks(blocks, apiMatches) {
  let updates = 0;

  for (const block of blocks) {
    const result = matchResultForBlock(block, apiMatches);
    if (!result) {
      continue;
    }

    const newResultLine = `uitslag ${result.home}-${result.away}`;

    if (block.resultLineIndex >= 0) {
      const oldScore = parseScore(block.lines[block.resultLineIndex].replace(/^\s*(uitslag|result|score)\s*/i, ""));
      if (!oldScore || oldScore.home !== result.home || oldScore.away !== result.away) {
        block.lines[block.resultLineIndex] = newResultLine;
        updates += 1;
      }
    } else {
      block.lines.splice(1, 0, newResultLine);
      updates += 1;
    }
  }

  return updates;
}

async function main() {
  const filePath = path.resolve(DATA_FILE);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Data file not found: ${filePath}`);
  }

  const original = fs.readFileSync(filePath, "utf8");
  const blocks = parseDataFile(original);
  const apiMatches = await fetchFinishedMatches();
  const updates = updateBlocks(blocks, apiMatches);

  if (updates === 0) {
    console.log("No results updated.");
    return;
  }

  const next = serializeBlocks(blocks);
  fs.writeFileSync(filePath, next, "utf8");
  console.log(`Updated ${updates} match result(s) in ${DATA_FILE}.`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
