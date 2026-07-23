#!/usr/bin/env node
// scripts/fetch-wards.mjs
//
// Pulls current ward boundaries + council member info from each city's own
// open-data portal and writes one combined FeatureCollection to
// public/wards.geojson (served as a static asset, fetched client-side by
// the map component). Re-run this periodically (council rosters change
// after every municipal election) — it always re-fetches live, never reads
// the previous output.

import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = path.join(__dirname, "../public/wards.geojson");

// St. Paul's ArcGIS feature service returns rep name/email/phone/photo
// directly on each ward polygon — no separate roster needed.
const ST_PAUL_WARDS_URL =
  "https://services1.arcgis.com/9meaaHE3uiba0zr8/arcgis/rest/services/Council_Ward_/FeatureServer/0/query?where=1%3D1&outFields=*&f=geojson";

// Minneapolis's ward polygons only carry a ward number (BDNUM) — no rep
// fields — so the roster below fills in names for the term that began
// January 2026. All 13 seats share the same term (citywide election),
// unlike staggered legislative seats, so one shared officeSince applies.
// Source: minneapolismn.gov/government/city-council/ (verify before reuse
// past the current term, since names change every 4 years).
const MINNEAPOLIS_WARDS_URL =
  "https://hub.arcgis.com/datasets/cityoflakes::city-council-wards.geojson";
const MINNEAPOLIS_TERM_START = "2026-01-01";
const MINNEAPOLIS_ROSTER = {
  1: "Elliott Payne",
  2: "Robin Wonsley",
  3: "Michael Rainville",
  4: "LaTrisha Vetaw",
  5: "Pearll Warren",
  6: "Jamal Osman",
  7: "Elizabeth Shaffer",
  8: "Soren Stevenson",
  9: "Jason Chavez",
  10: "Aisha Chughtai",
  11: "Jamison Whiting",
  12: "Aurin Chowdhury",
  13: "Linea Palmisano",
};

// St. Paul's dataset says "Updated 2023" and the current term runs
// Jan 2024-Dec 2027 (also citywide, so one shared date for all 7 seats).
const ST_PAUL_TERM_START = "2024-01-01";

async function fetchJson(url) {
  const res = await fetch(url, { headers: { "User-Agent": "mn-civic-map-etl/0.1" } });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText} for ${url}`);
  return res.json();
}

async function fetchMinneapolisWards() {
  console.log("[wards] fetching Minneapolis...");
  const geojson = await fetchJson(MINNEAPOLIS_WARDS_URL);
  const features = (geojson.features ?? []).map((feature) => {
    const wardNum = Number(feature.properties?.BDNUM);
    return {
      type: "Feature",
      geometry: feature.geometry,
      properties: {
        city: "Minneapolis",
        ward: wardNum,
        repName: MINNEAPOLIS_ROSTER[wardNum] ?? null,
        repParty: "Nonpartisan",
        repPhotoUrl: null,
        repEmail: null,
        repPhone: null,
        officeSince: MINNEAPOLIS_TERM_START,
      },
    };
  });
  console.log(`[wards] Minneapolis: ${features.length} ward(s)`);
  return features;
}

async function fetchStPaulWards() {
  console.log("[wards] fetching St. Paul...");
  const geojson = await fetchJson(ST_PAUL_WARDS_URL);
  const features = (geojson.features ?? []).map((feature) => {
    const props = feature.properties ?? {};
    const wardNum = Number(String(props.ward ?? "").replace(/\D/g, ""));
    return {
      type: "Feature",
      geometry: feature.geometry,
      properties: {
        city: "St. Paul",
        ward: wardNum,
        repName: props.name ?? null,
        repParty: "Nonpartisan",
        repPhotoUrl: props.imgpath ?? null,
        repEmail: props.email ?? null,
        repPhone: props.phone ?? null,
        officeSince: ST_PAUL_TERM_START,
      },
    };
  });
  console.log(`[wards] St. Paul: ${features.length} ward(s)`);
  return features;
}

async function main() {
  const [mpls, stPaul] = await Promise.all([fetchMinneapolisWards(), fetchStPaulWards()]);
  const featureCollection = {
    type: "FeatureCollection",
    features: [...mpls, ...stPaul],
  };

  await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, JSON.stringify(featureCollection));
  console.log(`[done] wrote ${featureCollection.features.length} ward feature(s) to ${OUTPUT_PATH}`);
}

main().catch((err) => {
  console.error("[fatal]", err);
  process.exit(1);
});
