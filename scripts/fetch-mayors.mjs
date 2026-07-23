#!/usr/bin/env node
// scripts/fetch-mayors.mjs
//
// Writes public/mayors.geojson — a two-point FeatureCollection (one per
// city, at its City Hall) that WardMap renders as photo pins. Neither
// city publishes a mayor API, so this is hand-transcribed from each city's
// own mayor page (linked per-entry below) — re-check after a mayoral
// election, since names, photos, and dates all change then.

import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = path.join(__dirname, "../public/mayors.geojson");

const NONPARTISAN = "Nonpartisan";

// Coordinates via OpenStreetMap/Nominatim geocoding of each City Hall
// address, not eyeballed — see git history for the lookup.
const MAYORS = [
  {
    city: "Minneapolis",
    coordinates: [-93.2650683, 44.9773133],
    repName: "Jacob Frey",
    repParty: NONPARTISAN,
    repPhotoUrl: "https://www.minneapolismn.gov/media/-www-content-assets/images/headshots/Mayor-Jacob-Frey.jpg",
    repEmail: null,
    repPhone: "612-673-2100",
    officeSince: "2018-01-01", // elected 2017, seated the following January
    committees: ["48th Mayor of Minneapolis"],
    neighborhoods: [],
    officeRoom: "Room 330, City Hall",
    profileUrl: "https://www.minneapolismn.gov/government/mayor/",
  },
  {
    city: "St. Paul",
    coordinates: [-93.093173, 44.9439666],
    repName: "Kaohly Her",
    repParty: NONPARTISAN,
    repPhotoUrl:
      "https://www.stpaul.gov/sites/default/files/styles/large/public/2025-12/Mayor-Elect%20Her%20-%20Ward%203%20Tour%20-%20December%209%202025-20-2048x2048.jpeg.webp?itok=Du3PTque",
    repEmail: "mayor@stpaul.gov",
    repPhone: "651-266-8510",
    officeSince: "2026-01-01", // elected Nov 2025, Saint Paul's first woman and first Asian American mayor
    committees: ["Mayor of Saint Paul"],
    neighborhoods: [],
    officeRoom: "Saint Paul City Hall, 15 Kellogg Blvd. West",
    profileUrl: "https://www.stpaul.gov/departments/mayors-office",
  },
];

async function main() {
  const featureCollection = {
    type: "FeatureCollection",
    features: MAYORS.map(({ city, coordinates, ...properties }) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates },
      properties: { role: "Mayor", city, ward: null, ...properties },
    })),
  };

  await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, JSON.stringify(featureCollection));
  console.log(`[done] wrote ${featureCollection.features.length} mayor feature(s) to ${OUTPUT_PATH}`);
}

main().catch((err) => {
  console.error("[fatal]", err);
  process.exit(1);
});
