# WK Poule Tracker

Kleine webapp om per wedstrijd voorspellingen bij te houden met meerdere gebruikers, inclusief login en ranglijst.

## Functies

- Registreren en inloggen met sessies
- Wedstrijden toevoegen
- Per gebruiker voorspellingen invullen per wedstrijd
- Uitslagen invullen
- Automatische puntentelling en ranglijst
- Deadline op voorspellen (standaard: tot aftrap)
- Deadline instelbaar in de interface (0-1440 minuten voor aftrap)
- Exacte punten zichtbaar in ranglijst
- Automatisch alle poulewedstrijden toegevoegd (A t/m L, 72 groepswedstrijden)

## Puntensysteem

- Exacte uitslag goed: 3 punten
- Alleen winnaar/gelijkspel goed: 1 punt
- Anders: 0 punten

## Deadlines

- Voorspellen kan tot de aftrap van een wedstrijd
- Na deadline zijn voorspellingen voor die wedstrijd geblokkeerd

## Poules

- Bij opstarten worden alle poulewedstrijden automatisch toegevoegd als ze nog ontbreken
- Officiele WK 2026 groepsindeling A t/m L zit in de seeddata
- Groepswedstrijden krijgen de echte speeldatums van de groepsfase

## Installatie

1. Installeer Node.js 20+ (met npm)
2. Open een terminal in deze map
3. Voer uit:

```bash
npm install
npm start
```

1. Open in je browser:

```text
http://localhost:3000
```

## Online met vrienden (GitHub publish)

GitHub Pages kan alleen statische bestanden hosten. Deze app heeft ook een backend (API + login), dus je deployt:

- Frontend: GitHub Pages
- Backend: bijvoorbeeld Render/Railway/Fly.io

### 0. GitHub Pages automatisch publiceren

Deze repo bevat nu een workflow op [ .github/workflows/deploy-pages.yml ](.github/workflows/deploy-pages.yml) die automatisch de [public](public) map publiceert naar GitHub Pages bij push naar `main`.

Zet in GitHub eenmalig:

1. Ga naar Settings > Pages
1. Source: GitHub Actions

### 1. Backend deployen (voorbeeld: Render)

1. Push deze repo naar GitHub
2. Maak op Render een nieuwe Web Service van je repo
3. Build command: `npm install`
4. Start command: `npm start`
5. Zet environment variables:
   - `NODE_ENV=production`
   - `SESSION_SECRET=<kies een lange geheime string>`
   - `ALLOWED_ORIGINS=https://<jouw-gebruikersnaam>.github.io`

Resultaat: je krijgt een backend URL zoals `https://wk-poule.onrender.com`.

Sneller: deze repo bevat nu ook [render.yaml](render.yaml). Op Render kun je daardoor direct een Blueprint deploy doen.

### 1b. Backend deployen (Railway)

Deze repo bevat [railway.json](railway.json), zodat Railway automatisch `npm start` gebruikt.

1. Maak in Railway een nieuw project van je GitHub repo
2. Zet deze environment variables:
   - `NODE_ENV=production`
   - `SESSION_SECRET=<kies een lange geheime string>`
   - `ALLOWED_ORIGINS=https://<jouw-gebruikersnaam>.github.io`
3. Deploy

Tip: begin met [.env.example](.env.example) als checklist van alle variabelen.

### 2. Frontend op GitHub Pages

1. Zet in [public/index.html](public/index.html#L1) de meta-tag `api-base-url` op je backend URL:

```html
<meta name="api-base-url" content="https://wk-poule.onrender.com" />
```

1. Push naar `main` en de workflow publiceert de frontend automatisch.

Alternatief zonder codewijziging in index:

1. Open je Pages URL met query parameter `api`, bijvoorbeeld:
1. `https://spodermees.github.io/wk/?api=https://wk-poule.onrender.com`

De app onthoudt deze backend URL lokaal in de browser.

### 3. Wat er nu al in code geregeld is

- Frontend gebruikt automatisch de ingestelde `api-base-url` voor alle API-calls
- API-calls sturen cookies mee (`credentials: include`)
- Backend ondersteunt CORS met credentials via `ALLOWED_ORIGINS`
- Productiecookies staan op `SameSite=None; Secure` zodat login werkt tussen GitHub Pages en backend

### Belangrijk

- `express-session` gebruikt nu nog memory store. Voor serieuzer gebruik (en herstarts) is Redis of database session store beter.
- `data/db.json` is bestand-opslag. Op sommige hosts is disk niet blijvend. Voor echte betrouwbaarheid: Postgres/SQLite met persistent storage.

## Belangrijke bestanden

- `server.js`: backend API en sessielogica
- `data/db.json`: opgeslagen gebruikers, wedstrijden en voorspellingen
- `public/index.html`: gebruikersinterface
- `public/app.js`: frontend logica
- `public/style.css`: styling

## Opmerking

Deze eerste versie heeft geen adminrollen. Iedereen die is ingelogd kan wedstrijden en uitslagen aanpassen. Als je wilt, kan ik daarna een adminrol toevoegen zodat alleen jij uitslagen mag invullen.
