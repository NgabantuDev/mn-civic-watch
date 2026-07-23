"use client";

import type { Hearing, RepProperties } from "@/lib/types";
import { accentFor, accentSoftFor } from "@/lib/cityTheme";

function formatOfficeSince(iso: string): string {
  // timeZone: "UTC" matters here — these dates are stored as bare
  // YYYY-MM-DD (midnight UTC), and formatting in the browser's local zone
  // rolls them back a day/month for anyone west of UTC.
  return new Date(iso).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
}

function formatHearingBadge(iso: string): { weekday: string; day: string } {
  const d = new Date(iso);
  return {
    weekday: d.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase(),
    day: d.toLocaleDateString("en-US", { day: "numeric" }),
  };
}

function formatHearingTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

// St. Paul's source data includes a "Councilmember " prefix in the name
// field; the role/city label above already establishes that, so it's just
// redundant text eating into the truncated name display.
function displayName(name: string | null): string | null {
  return name?.replace(/^councilmember\s+/i, "") ?? null;
}

function initials(name: string | null): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function roleLabel(rep: RepProperties): string {
  return rep.ward !== null ? `Ward ${rep.ward}` : "Mayor";
}

function IconCalendar() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4 shrink-0">
      <rect x="3" y="4.5" width="14" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M3 8h14M7 2.5v3M13 2.5v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function IconPin() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4 shrink-0">
      <path
        d="M10 18s6-5.2 6-9.6A6 6 0 0 0 4 8.4C4 12.8 10 18 10 18Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <circle cx="10" cy="8.2" r="2" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function IconMail() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4 shrink-0">
      <rect x="2.5" y="4.5" width="15" height="11" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="m3 5.5 7 5.5 7-5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconPhone() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4 shrink-0">
      <path
        d="M4.5 3.5h2.7l1 3.6-1.8 1.4a9 9 0 0 0 4.6 4.6l1.4-1.8 3.6 1v2.7c0 .8-.7 1.4-1.5 1.3C8.6 15.7 4.3 11.4 3.2 5.6c-.1-.8.5-1.6 1.3-1.6Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconBuilding() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4 shrink-0">
      <rect x="4" y="2.5" width="12" height="15" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <path d="M7 6h1.5M11.5 6H13M7 9.5h1.5M11.5 9.5H13M7 13h1.5M11.5 13H13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function IconExternal() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-3.5 w-3.5 shrink-0">
      <path d="M8 5H5.5a1.5 1.5 0 0 0-1.5 1.5v7A1.5 1.5 0 0 0 5.5 15h7a1.5 1.5 0 0 0 1.5-1.5V11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M11 4h5v5M15.5 4.5 9 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export interface WardModalProps {
  ward: RepProperties;
  hearings: Hearing[];
  pinned: boolean;
  onClose: () => void;
}

export default function WardModal({ ward: rep, hearings, pinned, onClose }: WardModalProps) {
  const repName = displayName(rep.repName);
  const accent = accentFor(rep.city);
  const accentSoft = accentSoftFor(rep.city);
  const isWard = rep.ward !== null;
  // Defends against a browser-cached wards.geojson response from before
  // these fields existed (fetch is cache: "no-store" now, but a tab left
  // open from before that change could still be holding one in memory).
  const committees = Array.isArray(rep.committees) ? rep.committees : [];
  const neighborhoods = Array.isArray(rep.neighborhoods) ? rep.neighborhoods : [];

  const avatar = rep.repPhotoUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={rep.repPhotoUrl}
      alt={repName ?? "Representative photo"}
      className="h-full w-full rounded-full object-cover shrink-0 bg-neutral-100"
    />
  ) : (
    <div
      className="h-full w-full rounded-full shrink-0 flex items-center justify-center font-semibold text-neutral-500"
      style={{ backgroundColor: accentSoft }}
    >
      {initials(repName)}
    </div>
  );

  // Hover-only preview (desktop, unpinned): a light glance — who, and
  // what's the very next thing on their calendar — not the full profile.
  // Modeled on map "place card" hover states rather than dumping every
  // field into a fleeting mouseover.
  if (!pinned) {
    const next = hearings[0];
    return (
      <div
        className="pointer-events-auto w-72 rounded-xl border border-neutral-200 bg-white shadow-xl overflow-hidden"
        role="dialog"
        aria-label={`${rep.city} ${roleLabel(rep)} preview`}
      >
        <div className="flex items-center gap-3 p-3">
          <div className="h-11 w-11 text-base">{avatar}</div>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: accent }}>
              {rep.city} &middot; {roleLabel(rep)}
            </div>
            <div className="text-sm font-semibold text-neutral-900 truncate">{repName ?? "Vacant / TBD"}</div>
          </div>
        </div>
        {isWard && (
          <div className="px-3 pb-3 -mt-1 flex items-center gap-1.5 text-xs text-neutral-500">
            <IconCalendar />
            {next ? (
              <span className="truncate">
                Next: {formatHearingBadge(next.datetime).weekday} {formatHearingBadge(next.datetime).day}, {formatHearingTime(next.datetime)}
              </span>
            ) : (
              <span>No hearings this week</span>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className="pointer-events-auto w-full sm:w-[380px] max-h-[75vh] sm:max-h-[80vh] flex flex-col rounded-t-2xl sm:rounded-2xl border border-neutral-200 bg-white shadow-2xl overflow-hidden"
      role="dialog"
      aria-label={`${rep.city} ${roleLabel(rep)} info`}
    >
      {/* Drag-handle affordance — bottom-sheet convention, mobile only */}
      <div className="sm:hidden flex justify-center pt-2 pb-1 shrink-0">
        <div className="h-1 w-9 rounded-full bg-neutral-300" />
      </div>

      <div className="overflow-y-auto">
        <div className="flex items-start gap-3 px-4 pt-2 pb-3 sm:pt-4">
          <div className="h-16 w-16 text-xl">{avatar}</div>
          <div className="min-w-0 flex-1 pt-0.5">
            <div
              className="inline-block text-[11px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full mb-1"
              style={{ color: accent, backgroundColor: accentSoft }}
            >
              {rep.city} &middot; {roleLabel(rep)}
            </div>
            <div className="text-lg font-bold text-neutral-900 leading-tight truncate">
              {repName ?? "Vacant / TBD"}
            </div>
            <div className="text-xs text-neutral-500 mt-0.5">
              {rep.repParty} &middot; in office since {formatOfficeSince(rep.officeSince)}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 -mr-1 -mt-1 h-10 w-10 flex items-center justify-center rounded-full text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 active:bg-neutral-200"
          >
            <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4">
              <path d="m5 5 10 10M15 5 5 15" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {committees.length > 0 && (
          <div className="px-4 pb-3 flex flex-wrap gap-1.5">
            {committees.map((role) => (
              <span
                key={role}
                className="text-[11px] font-medium px-2 py-1 rounded-full border"
                style={{ color: accent, borderColor: accentSoft, backgroundColor: accentSoft }}
              >
                {role}
              </span>
            ))}
          </div>
        )}

        {(rep.repEmail || rep.repPhone) && (
          <div className="px-4 pb-3 flex items-center gap-2">
            {rep.repEmail && (
              <a
                href={`mailto:${rep.repEmail}`}
                className="flex items-center gap-1.5 text-xs font-medium text-neutral-600 border border-neutral-200 rounded-full px-3 py-1.5 hover:bg-neutral-50 active:bg-neutral-100"
              >
                <IconMail />
                Email
              </a>
            )}
            {rep.repPhone && (
              <a
                href={`tel:${rep.repPhone.replace(/[^\d+]/g, "")}`}
                className="flex items-center gap-1.5 text-xs font-medium text-neutral-600 border border-neutral-200 rounded-full px-3 py-1.5 hover:bg-neutral-50 active:bg-neutral-100"
              >
                <IconPhone />
                {rep.repPhone}
              </a>
            )}
          </div>
        )}

        {/* Hearings are tracked per-ward (see src/lib/hearings.ts) — the
            mayor's office doesn't have an equivalent public schedule in
            this data model, so showing an empty state here would imply a
            real check that never happened. */}
        {isWard && (
          <div className="border-t border-neutral-100 px-4 py-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-500 mb-2.5">
              <IconCalendar />
              This &amp; next week
            </div>
            {hearings.length === 0 ? (
              <p className="text-sm text-neutral-500">No hearings or meetings scheduled.</p>
            ) : (
              <ul className="space-y-2.5">
                {hearings.map((hearing) => {
                  const badge = formatHearingBadge(hearing.datetime);
                  return (
                    <li key={`${hearing.title}-${hearing.datetime}`} className="flex gap-3">
                      <div
                        className="shrink-0 w-11 h-11 rounded-lg flex flex-col items-center justify-center leading-none"
                        style={{ backgroundColor: accentSoft, color: accent }}
                      >
                        <span className="text-[9px] font-bold tracking-wide">{badge.weekday}</span>
                        <span className="text-base font-bold">{badge.day}</span>
                      </div>
                      <div className="min-w-0 flex-1 pt-0.5">
                        <div className="text-sm font-medium text-neutral-900">{hearing.title}</div>
                        <div className="text-xs text-neutral-500">{formatHearingTime(hearing.datetime)}</div>
                        <div className="text-xs text-neutral-500 flex items-start gap-1 mt-0.5">
                          <span className="mt-0.5"><IconPin /></span>
                          <span>{hearing.location}</span>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}

        {(rep.officeRoom || neighborhoods.length > 0 || rep.profileUrl) && (
          <div className="border-t border-neutral-100 px-4 py-3 space-y-1.5 text-xs text-neutral-500">
            {rep.officeRoom && (
              <div className="flex items-start gap-1.5">
                <span className="mt-0.5"><IconBuilding /></span>
                <span>{rep.officeRoom}</span>
              </div>
            )}
            {neighborhoods.length > 0 && (
              <div className="flex items-start gap-1.5">
                <span className="mt-0.5"><IconPin /></span>
                <span>{neighborhoods.join(", ")}</span>
              </div>
            )}
            {rep.profileUrl && (
              <a
                href={rep.profileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-medium hover:underline pt-0.5"
                style={{ color: accent }}
              >
                View official profile
                <IconExternal />
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
