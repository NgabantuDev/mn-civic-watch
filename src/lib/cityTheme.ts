export const CITY_ACCENT: Record<string, string> = {
  Minneapolis: "#0EA5E9",
  "St. Paul": "#F43F5E",
};

export const CITY_ACCENT_SOFT: Record<string, string> = {
  Minneapolis: "#E0F2FE",
  "St. Paul": "#FFE4E6",
};

export function accentFor(city: string): string {
  return CITY_ACCENT[city] ?? "#71717a";
}

export function accentSoftFor(city: string): string {
  return CITY_ACCENT_SOFT[city] ?? "#f4f4f5";
}
