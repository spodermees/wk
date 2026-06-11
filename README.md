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

## Belangrijke bestanden

- `server.js`: backend API en sessielogica
- `data/db.json`: opgeslagen gebruikers, wedstrijden en voorspellingen
- `public/index.html`: gebruikersinterface
- `public/app.js`: frontend logica
- `public/style.css`: styling

## Opmerking

Deze eerste versie heeft geen adminrollen. Iedereen die is ingelogd kan wedstrijden en uitslagen aanpassen. Als je wilt, kan ik daarna een adminrol toevoegen zodat alleen jij uitslagen mag invullen.
