"use client";

import type { Hearing, WardProperties } from "@/lib/types";

function formatOfficeSince(iso: string): string {
  // timeZone: "UTC" matters here — these dates are stored as bare
  // YYYY-MM-DD (midnight UTC), and formatting in the browser's local zone
  // rolls them back a day/month for anyone west of UTC.
  return new Date(iso).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
}

function formatHearingDate(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// St. Paul's source data includes a "Councilmember " prefix in the name
// field; the ward/city label above already establishes the role, so it's
// just redundant text eating into the truncated name display.
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

export interface WardModalProps {
  ward: WardProperties;
  hearings: Hearing[];
  pinned: boolean;
  onClose: () => void;
}

export default function WardModal({ ward, hearings, pinned, onClose }: WardModalProps) {
  const nextHearing = hearings[0] ?? null;
  const repName = displayName(ward.repName);

  return (
    <div
      className="pointer-events-auto w-full sm:w-80 max-w-md rounded-xl border border-neutral-200 bg-white shadow-2xl overflow-hidden max-h-[60vh] sm:max-h-[80vh] overflow-y-auto"
      role="dialog"
      aria-label={`Ward ${ward.ward} representative info`}
    >
      <div className="flex items-start gap-3 p-4 border-b border-neutral-100">
        {ward.repPhotoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={ward.repPhotoUrl}
            alt={repName ?? "Representative photo"}
            className="h-16 w-16 rounded-full object-cover shrink-0 bg-neutral-100"
          />
        ) : (
          <div className="h-16 w-16 rounded-full shrink-0 bg-neutral-200 flex items-center justify-center text-lg font-semibold text-neutral-500">
            {initials(repName)}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            {ward.city} &middot; Ward {ward.ward}
          </div>
          <div className="text-base font-semibold text-neutral-900 truncate">
            {repName ?? "Vacant / TBD"}
          </div>
          <div className="text-xs text-neutral-500 mt-0.5">
            {ward.repParty} &middot; in office since {formatOfficeSince(ward.officeSince)}
          </div>
        </div>
        {pinned && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 h-6 w-6 flex items-center justify-center rounded-full text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
          >
            &times;
          </button>
        )}
      </div>

      {(ward.repEmail || ward.repPhone) && (
        <div className="px-4 py-2 text-xs text-neutral-500 border-b border-neutral-100 space-y-0.5">
          {ward.repEmail && <div>{ward.repEmail}</div>}
          {ward.repPhone && <div>{ward.repPhone}</div>}
        </div>
      )}

      <div className="p-4">
        <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500 mb-2">
          This &amp; next week
        </div>
        {hearings.length === 0 ? (
          <p className="text-sm text-neutral-500">No hearings or meetings scheduled.</p>
        ) : (
          <ul className="space-y-3">
            {hearings.map((hearing) => (
              <li key={`${hearing.title}-${hearing.datetime}`} className="text-sm">
                <div className="font-medium text-neutral-900">{hearing.title}</div>
                <div className="text-neutral-500">{formatHearingDate(hearing.datetime)}</div>
                <div className="text-neutral-500">{hearing.location}</div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {nextHearing && (
        <div className="px-4 pb-4 text-xs text-neutral-400">
          Next: {nextHearing.location}
        </div>
      )}
    </div>
  );
}
