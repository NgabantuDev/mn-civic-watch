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

// Neither city's council race carries a party label — Minnesota municipal
// elections are nonpartisan by charter — confirmed by reading every one of
// both cities' own councilmember bio pages below (linked per-ward) rather
// than assumed: none state a party, so "Nonpartisan" is the accurate
// value, not a stand-in for missing data.
const NONPARTISAN = "Nonpartisan";

// --- St. Paul -----------------------------------------------------------
//
// St. Paul's ArcGIS feature service returns rep name/email/phone/photo
// directly on each ward polygon. Committees/neighborhoods/office room
// below are hand-transcribed from each member's own bio page at
// stpaul.gov/department/city-council/ward-N (ward 7's URL is the one
// exception: ward-7-cheniqua-johnson) — re-check those pages after an
// election, since this council is entirely re-elected on one citywide
// cycle and turnover can be total.
const ST_PAUL_WARDS_URL =
  "https://services1.arcgis.com/9meaaHE3uiba0zr8/arcgis/rest/services/Council_Ward_/FeatureServer/0/query?where=1%3D1&outFields=*&f=geojson";

// Current term runs Jan 2024-Dec 2027 for all 7 seats (citywide cycle).
const ST_PAUL_TERM_START = "2024-01-01";
// Ward 6 is the one exception found on the bio pages: Nelsie Yang has
// served continuously since her original swearing-in, not just the term
// that began with everyone else's in 2024.
const ST_PAUL_OFFICE_SINCE_OVERRIDES = {
  6: "2020-01-01",
};
const ST_PAUL_OFFICE_ROOM = {
  1: "Room 310-A, City Hall",
  2: "Room 310-B, City Hall",
  3: "Room 310-C, City Hall",
  4: "Room 310-D, City Hall",
  5: "Room 320-A, City Hall",
  6: "Room 320-B, City Hall",
  7: "Room 320-C, City Hall",
};
const ST_PAUL_COMMITTEES = {
  1: ["Chair, Public Safety Committee", "Vice Chair, Library Board"],
  2: ["President of the City Council", "Chair, Council Operations Committee", "Chair, Policy Committee", "Chair, Audit Committee"],
  3: ["Chair, Library Board", "Vice Chair, Housing and Redevelopment Authority"],
  4: ["Vice Chair, Public Safety Committee", "Vice Chair, Audit Committee"],
  5: ["Council Vice President (2024-2026)"],
  6: ["Council Vice President", "Vice Chair, Budget Committee", "Vice Chair, Council Operations Committee"],
  7: ["Chair, Housing and Redevelopment Authority", "Chair, Budget Committee", "Vice Chair, Policy Committee"],
};
// Every ward's bio page is /ward-N except Ward 7, whose slug includes the
// member's name.
const ST_PAUL_PROFILE_SLUG = {
  7: "ward-7-cheniqua-johnson",
};
const ST_PAUL_NEIGHBORHOODS = {
  1: ["Thomas-Dale (Frogtown)", "Summit-University", "North End", "Lexington-Hamline"],
  2: ["West 7th Street", "West Side", "Summit Hill", "Railroad Island", "Lowertown", "Downtown"],
  3: ["Highland Park", "Macalester-Groveland", "West End"],
  4: ["Hamline-Midway", "Merriam Park", "Saint Anthony Park", "Como"],
  5: ["Como", "Payne-Phalen", "North End"],
  6: ["Frost Lake", "Hayden Heights", "Hazel Park", "Payne-Phalen", "Phalen Village", "Prosperity Heights"],
  7: ["Dayton's Bluff", "Battle Creek", "Conway", "Mounds Park", "Swede Hollow"],
};

// --- Minneapolis ----------------------------------------------------------
//
// Minneapolis's ward polygons only carry a ward number (BDNUM) — no rep
// fields at all — so everything below is hand-transcribed from each
// member's own page at minneapolismn.gov/government/city-council/members/
// ward-N/. Re-check after an election; names change every 4 years and
// this covers the term that began January 2026.
const MINNEAPOLIS_WARDS_URL =
  "https://hub.arcgis.com/datasets/cityoflakes::city-council-wards.geojson";
const MINNEAPOLIS_TERM_START = "2026-01-01";
const MINNEAPOLIS_OFFICE_ROOM = "Room 370, City Hall";
const MINNEAPOLIS_PHOTO_BASE =
  "https://www.minneapolismn.gov/media/-www-content-assets/images/headshots/";

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

const MINNEAPOLIS_PHOTOS = {
  1: "Council-President-Elliott-Payne.jpg",
  2: "Ward-2-Robin-Wonsley.jpg",
  3: "Ward-3-Michael-Rainville.jpg",
  4: "Ward-4-LaTrisha-Vetaw.jpg",
  5: "Ward-5-Pearll-Warren.jpg",
  6: "Ward-6-Jamal-Osman.jpg",
  7: "Ward-7-Elizabeth-Shaffer.jpg",
  8: "Ward-8-Soren-Stevenson.jpg",
  9: "Ward-9-Jason-Chavez.jpg",
  10: "Ward-10-Aisha-Chughtai.jpg",
  11: "Ward-11-Jamison-Whiting.jpg",
  12: "Ward-12-Aurin-Chowdhury.jpg",
  13: "Ward-13-Linea-Palmisano.jpg",
};

// Members serving continuously since before the current 2026-2029 term.
// Where the bio page states only an election year (not an exact swearing-
// in date), this uses January 1 of the following year as an approximation
// (Minnesota's regular cycle seats winners the January after a November
// election) — flagged per entry since two special-election seats (6, 12)
// may be off by a few months. Wards not listed here either started with
// the current term (elected 2025) or didn't state a date on their page,
// so they fall back to MINNEAPOLIS_TERM_START.
const MINNEAPOLIS_OFFICE_SINCE_OVERRIDES = {
  1: "2022-01-01", // Payne, first elected 2021
  3: "2022-01-01", // Rainville, first elected 2021
  6: "2020-01-01", // Osman, won a 2020 special election — exact date unconfirmed
  9: "2022-01-01", // Chavez, first elected 2021
  10: "2022-01-01", // Chughtai, first elected 2021
  12: "2023-01-01", // Chowdhury, first elected 2023 (off-cycle/special) — exact date unconfirmed
  13: "2014-01-01", // Palmisano, first elected 2013
};

const MINNEAPOLIS_COMMITTEES = {
  1: ["Council President"],
  6: ["Council Vice-President"],
};

const MINNEAPOLIS_NEIGHBORHOODS = {
  1: ["Audubon Park", "Bottineau", "Columbia Park", "Como", "Holland", "Logan Park", "Northeast Park", "Waite Park", "Windom Park"],
  2: ["Cedar Riverside", "Como", "Marcy Holmes", "Prospect Park", "Seward", "University of Minnesota"],
  3: ["Downtown East", "Downtown West", "Marcy Holmes", "North Loop", "Nicollet Island", "St. Anthony East", "St. Anthony West"],
  4: ["Camden Industrial", "Cleveland", "Folwell", "Jordan", "Lind-Bohanon", "McKinley", "Victory", "Webber-Camden", "Willard-Hay"],
  5: ["Harrison", "Hawthorne", "Jordan", "Near-North", "North Loop", "Sumner-Glenwood", "Willard-Hay"],
  6: ["Cedar Riverside", "Elliot Park", "Phillips West", "Seward", "Stevens Square-Loring Heights", "Ventura Village"],
  7: ["Bryn Mawr", "Cedar-Isles-Dean", "Downtown West", "East Isles", "Kenwood", "Linden Hills", "Loring Park", "Lowry Hill"],
  8: ["Bancroft", "Bryant", "Central", "Field", "King Field", "Lyndale", "Northrop", "Regina"],
  9: ["Central", "Corcoran", "East Phillips", "Midtown Phillips", "Howe", "Longfellow", "Powderhorn Park"],
  10: ["East Bde Maka Ska", "East Isles", "Lowry Hill East", "South Uptown", "Whittier"],
  11: ["Diamond Lake", "Field", "Hale", "Keewaydin", "Northrop", "Page", "Tangletown", "Wenonah", "Windom"],
  12: ["Cooper", "Ericsson", "Hiawatha", "Howe", "Keewaydin", "Minnehaha", "Morris Park", "Standish"],
  13: ["Armatage", "East Harriet", "Fulton", "Kenny", "Linden Hills", "Lynnhurst"],
};

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
    const photo = MINNEAPOLIS_PHOTOS[wardNum];
    return {
      type: "Feature",
      geometry: feature.geometry,
      properties: {
        role: "Council Member",
        city: "Minneapolis",
        ward: wardNum,
        repName: MINNEAPOLIS_ROSTER[wardNum] ?? null,
        repParty: NONPARTISAN,
        repPhotoUrl: photo ? `${MINNEAPOLIS_PHOTO_BASE}${photo}` : null,
        repEmail: null,
        repPhone: null,
        officeSince: MINNEAPOLIS_OFFICE_SINCE_OVERRIDES[wardNum] ?? MINNEAPOLIS_TERM_START,
        committees: MINNEAPOLIS_COMMITTEES[wardNum] ?? [],
        neighborhoods: MINNEAPOLIS_NEIGHBORHOODS[wardNum] ?? [],
        officeRoom: MINNEAPOLIS_OFFICE_ROOM,
        profileUrl: `https://www.minneapolismn.gov/government/city-council/members/ward-${wardNum}/`,
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
        role: "Council Member",
        city: "St. Paul",
        ward: wardNum,
        repName: props.name ?? null,
        repParty: NONPARTISAN,
        repPhotoUrl: props.imgpath ?? null,
        repEmail: props.email ?? null,
        repPhone: props.phone ?? null,
        officeSince: ST_PAUL_OFFICE_SINCE_OVERRIDES[wardNum] ?? ST_PAUL_TERM_START,
        committees: ST_PAUL_COMMITTEES[wardNum] ?? [],
        neighborhoods: ST_PAUL_NEIGHBORHOODS[wardNum] ?? [],
        officeRoom: ST_PAUL_OFFICE_ROOM[wardNum] ?? null,
        profileUrl: `https://www.stpaul.gov/department/city-council/${ST_PAUL_PROFILE_SLUG[wardNum] ?? `ward-${wardNum}`}`,
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
