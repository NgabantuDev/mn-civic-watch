import type { Hearing } from "./types";

// Placeholder meeting data — no city publishes a combined Minneapolis +
// St. Paul hearings feed, so this stands in until a real source (e.g.
// Legistar/Granicus per city) is wired up. Deterministic per city+ward
// (not random) so the same ward always shows the same mock schedule
// within a given week, and some wards intentionally get zero hearings to
// exercise the "nothing scheduled" empty state.
const MEETING_TYPES = [
  "Full City Council Meeting",
  "Zoning & Planning Committee",
  "Public Safety Committee",
  "Ward Community Listening Session",
];

const CITY_HALL_LOCATION: Record<string, string> = {
  Minneapolis: "Minneapolis City Hall, 350 S 5th St, Room 317",
  "St. Paul": "Saint Paul City Hall, 15 W Kellogg Blvd, Council Chambers",
};

function hashSeed(city: string, ward: number): number {
  let hash = ward;
  for (let i = 0; i < city.length; i++) hash = (hash * 31 + city.charCodeAt(i)) % 997;
  return hash;
}

function atDaysFromNow(now: Date, days: number, hour: number, minute: number): Date {
  const d = new Date(now);
  d.setDate(d.getDate() + days);
  d.setHours(hour, minute, 0, 0);
  return d;
}

export function getMockHearings(city: string, ward: number, now: Date = new Date()): Hearing[] {
  const seed = hashSeed(city, ward);
  // ~1 in 5 wards has nothing on the books this stretch.
  if (seed % 5 === 0) return [];

  const hearings: Hearing[] = [];

  const councilOffsetDays = seed % 6; // 0-5 days out
  hearings.push({
    title: MEETING_TYPES[0],
    datetime: atDaysFromNow(now, councilOffsetDays, 18, 30).toISOString(),
    location: CITY_HALL_LOCATION[city] ?? "City Hall",
  });

  if (seed % 3 !== 0) {
    const committeeIndex = 1 + (seed % 2);
    const committeeOffsetDays = 2 + (seed % 7);
    hearings.push({
      title: MEETING_TYPES[committeeIndex],
      datetime: atDaysFromNow(now, committeeOffsetDays, 16, 0).toISOString(),
      location: CITY_HALL_LOCATION[city] ?? "City Hall",
    });
  }

  if (seed % 4 === 0) {
    const listeningOffsetDays = 3 + (seed % 8);
    hearings.push({
      title: MEETING_TYPES[3],
      datetime: atDaysFromNow(now, listeningOffsetDays, 18, 0).toISOString(),
      location: `Ward ${ward} Community Center, ${city}`,
    });
  }

  return hearings.sort((a, b) => a.datetime.localeCompare(b.datetime));
}

// Monday of the current week through Sunday of next week (end of day) —
// matches "current and upcoming week" rather than a rolling 7/14-day window.
function getCurrentAndUpcomingWeekEnd(now: Date): Date {
  const dayOfWeek = now.getDay(); // 0 = Sunday
  const daysUntilSundayNextWeek = ((7 - dayOfWeek) % 7) + 7;
  const end = new Date(now);
  end.setDate(end.getDate() + daysUntilSundayNextWeek);
  end.setHours(23, 59, 59, 999);
  return end;
}

export function getUpcomingHearings(city: string, ward: number, now: Date = new Date()): Hearing[] {
  const windowEnd = getCurrentAndUpcomingWeekEnd(now);
  return getMockHearings(city, ward, now).filter((h) => {
    const t = new Date(h.datetime);
    return t >= now && t <= windowEnd;
  });
}
