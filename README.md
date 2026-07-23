# mn-civic-watch

A map of Minneapolis and St. Paul city council wards. Click a ward to see its representative — photo, party, term start, contact info — plus any hearings or meetings scheduled for the current and upcoming week.

Built with Next.js + TypeScript, MapLibre GL (OpenFreeMap "Liberty" style), and Tailwind CSS.

## Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Data

Ward boundaries and rep info come from each city's own open-data portal:

```bash
npm run data:wards
```

This re-fetches live from Minneapolis' and St. Paul's ArcGIS feature services and writes `public/wards.geojson`. Re-run it after an election or council reshuffle — Minneapolis' roster (`scripts/fetch-wards.mjs`) is currently maintained by hand since its ward layer doesn't carry rep names.

Hearing/meeting data (`src/lib/hearings.ts`) is placeholder — no combined Minneapolis + St. Paul meetings feed exists yet, so it's mocked deterministically per ward until a real source (Legistar/Granicus per city) is wired up.
