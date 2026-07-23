"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import type { RepProperties } from "@/lib/types";
import { getUpcomingHearings } from "@/lib/hearings";
import { CITY_ACCENT, accentFor, accentSoftFor } from "@/lib/cityTheme";
import WardModal from "./WardModal";

// Matches the OpenFreeMap "Liberty" style used by the get-flocked project,
// for visual consistency across these MN civic-data map tools.
const LIBERTY_STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";

const WARDS_SOURCE_ID = "wards-source";
const WARDS_FILL_LAYER_ID = "wards-fill";
const WARDS_OUTLINE_LAYER_ID = "wards-outline";
const WARDS_LABEL_LAYER_ID = "wards-label";

const CITIES = ["Minneapolis", "St. Paul"] as const;
type City = (typeof CITIES)[number];

// Two distinct hue families (cool for Minneapolis, warm for St. Paul) so the
// two cities read apart at a glance, cycled by ward number within each city
// so adjoining wards inside one city still land on different shades.
const CITY_PALETTES: Record<City, string[]> = {
  Minneapolis: ["#93C5FD", "#67E8F9", "#7DD3FC", "#A5B4FC", "#5EEAD4", "#7DD3C0", "#38BDF8", "#A78BFA", "#38DED0", "#60A5FA", "#2DD4BF", "#818CF8", "#22D3EE"],
  "St. Paul": ["#FDBA74", "#FCA5A5", "#FDE68A", "#FB923C", "#F87171", "#FACC15", "#FB7185"],
};
const WARD_OUTLINE_COLOR = "#44403c";

function cityMatchExpression(city: City): unknown[] {
  const palette = CITY_PALETTES[city];
  return [
    "match",
    ["%", ["to-number", ["coalesce", ["get", "ward"], 0]], palette.length],
    ...palette.flatMap((color, i) => [i, color]),
    palette[0],
  ];
}

const WARD_FILL_COLOR_EXPRESSION = [
  "case",
  ["==", ["get", "city"], "Minneapolis"],
  cityMatchExpression("Minneapolis"),
  ["==", ["get", "city"], "St. Paul"],
  cityMatchExpression("St. Paul"),
  "#e5e7eb",
] as unknown as maplibregl.ExpressionSpecification;

const TWIN_CITIES_CENTER: [number, number] = [-93.185, 44.955];
const DEFAULT_ZOOM = 10.4;
// How far around a point marker (mayor pin) to pad when "zooming to" it —
// there's no polygon to fitBounds to, so this fakes one.
const POINT_ZOOM_PADDING_DEGREES = 0.01;

interface SelectedRep {
  properties: RepProperties;
  pinned: boolean;
}

interface MayorMarker {
  marker: maplibregl.Marker;
  properties: RepProperties;
}

function boundsFromFeature(feature: Feature<Geometry>): maplibregl.LngLatBounds {
  const bounds = new maplibregl.LngLatBounds();
  const geom = feature.geometry;
  const polygons = geom.type === "Polygon" ? [geom.coordinates] : geom.type === "MultiPolygon" ? geom.coordinates : [];
  for (const rings of polygons) {
    for (const ring of rings) {
      for (const [lng, lat] of ring as [number, number][]) {
        bounds.extend([lng, lat]);
      }
    }
  }
  return bounds;
}

function boundsAroundPoint(lng: number, lat: number): maplibregl.LngLatBounds {
  return new maplibregl.LngLatBounds(
    [lng - POINT_ZOOM_PADDING_DEGREES, lat - POINT_ZOOM_PADDING_DEGREES],
    [lng + POINT_ZOOM_PADDING_DEGREES, lat + POINT_ZOOM_PADDING_DEGREES],
  );
}

function isMobileViewport(): boolean {
  return window.innerWidth < 768;
}

// A circular headshot "pin" for a mayor at City Hall — plain DOM rather
// than a symbol-layer icon, since clipping a photo to a circle with a
// colored ring is trivial in CSS and painful to pre-bake into a sprite.
function createMayorMarkerElement(rep: RepProperties): HTMLDivElement {
  const accent = accentFor(rep.city);
  const el = document.createElement("div");
  el.setAttribute("role", "button");
  el.setAttribute("aria-label", `${rep.city} Mayor ${rep.repName ?? ""}`);
  el.style.cssText = `
    width: 44px; height: 44px; border-radius: 9999px;
    border: 3px solid ${accent}; box-shadow: 0 2px 8px rgba(0,0,0,0.35);
    background: ${accentSoftFor(rep.city)}; overflow: hidden; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    transition: transform 0.15s ease; background-size: cover; background-position: center;
  `;
  if (rep.repPhotoUrl) {
    const img = document.createElement("img");
    img.src = rep.repPhotoUrl;
    img.alt = rep.repName ?? "Mayor photo";
    img.style.cssText = "width: 100%; height: 100%; object-fit: cover;";
    el.appendChild(img);
  } else {
    el.textContent = (rep.repName ?? "?").slice(0, 1).toUpperCase();
    el.style.color = accent;
    el.style.fontWeight = "700";
  }
  el.addEventListener("mouseenter", () => {
    el.style.transform = "scale(1.08)";
  });
  el.addEventListener("mouseleave", () => {
    el.style.transform = "scale(1)";
  });
  return el;
}

export default function WardMap() {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const defaultBoundsRef = useRef<maplibregl.LngLatBounds | null>(null);
  // The untouched fetch result, kept around so a click can look up a
  // ward's true full geometry — see the comment on the click handler for
  // why queryRenderedFeatures's own geometry isn't good enough for that.
  const wardsDataRef = useRef<FeatureCollection | null>(null);
  const mayorMarkersRef = useRef<MayorMarker[]>([]);
  const [selected, setSelected] = useState<SelectedRep | null>(null);
  const selectedRef = useRef<SelectedRep | null>(null);
  const [visibleCities, setVisibleCities] = useState<Record<City, boolean>>({
    Minneapolis: true,
    "St. Paul": true,
  });
  const visibleCitiesRef = useRef(visibleCities);

  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);

  useEffect(() => {
    visibleCitiesRef.current = visibleCities;
  }, [visibleCities]);

  const zoomToBounds = (bounds: maplibregl.LngLatBounds) => {
    const map = mapRef.current;
    if (!map) return;
    // The modal sits bottom-left (a bottom sheet on mobile), so padding is
    // reserved on that side — otherwise fitBounds centers the target in
    // the *full* viewport and the modal ends up covering it.
    map.fitBounds(bounds, {
      padding: isMobileViewport() ? { top: 60, bottom: 260, left: 40, right: 40 } : { top: 80, bottom: 300, left: 420, right: 80 },
      duration: 600,
    });
  };

  const zoomToDefault = () => {
    const map = mapRef.current;
    const bounds = defaultBoundsRef.current;
    if (!map || !bounds) return;
    map.fitBounds(bounds, { padding: 40, duration: 600 });
  };

  const deselect = () => {
    setSelected(null);
    zoomToDefault();
  };

  const applyCityFilter = (cities: Record<City, boolean>) => {
    const map = mapRef.current;
    if (map) {
      const visible = CITIES.filter((c) => cities[c]);
      const filter = ["in", ["get", "city"], ["literal", visible]] as unknown as maplibregl.FilterSpecification;
      for (const layerId of [WARDS_FILL_LAYER_ID, WARDS_OUTLINE_LAYER_ID, WARDS_LABEL_LAYER_ID]) {
        if (map.getLayer(layerId)) map.setFilter(layerId, filter);
      }
    }
    for (const { marker, properties } of mayorMarkersRef.current) {
      marker.getElement().style.display = cities[properties.city as City] ? "" : "none";
    }
  };

  const toggleCity = (city: City) => {
    setVisibleCities((prev) => {
      const next = { ...prev, [city]: !prev[city] };
      applyCityFilter(next);
      // If the pinned/hovered rep belongs to a city that just got hidden,
      // clear it rather than leave a modal open for something invisible.
      if (!next[city] && selectedRef.current?.properties.city === city) {
        deselect();
      }
      return next;
    });
  };

  useEffect(() => {
    if (!mapContainerRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: LIBERTY_STYLE_URL,
      center: TWIN_CITIES_CENTER,
      zoom: DEFAULT_ZOOM,
      attributionControl: { compact: true },
      cooperativeGestures: isMobileViewport(),
    });
    mapRef.current = map;

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");

    const isDesktopHover = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

    map.on("error", (e) => {
      console.error("[MapLibre ERROR]", e.error?.message ?? e);
    });

    map.on("load", async () => {
      // The canvas's WebGL drawing buffer is sized from the container at
      // construction time; if layout settles a beat after that (webfonts,
      // flex sizing), the buffer is left smaller than the CSS box and only
      // that top-left region ever gets painted. Forcing a resize once the
      // container has its final size fixes that.
      setTimeout(() => map.resize(), 100);

      // no-store: this is static JSON re-fetched every ward/mayoral
      // election cycle (see scripts/fetch-wards.mjs, fetch-mayors.mjs) — a
      // browser-cached copy from before a field got added, like a stale
      // `committees`-less response, crashes the modal on a field the
      // current component code expects to exist.
      const [wardsRes, mayorsRes] = await Promise.all([
        fetch("/wards.geojson", { cache: "no-store" }),
        fetch("/mayors.geojson", { cache: "no-store" }),
      ]);
      const data: FeatureCollection = await wardsRes.json();
      const mayorsData: FeatureCollection = await mayorsRes.json();
      wardsDataRef.current = data;

      // Guards the whole "add sources/layers/markers" block as a unit —
      // without it, a second 'load' firing would duplicate every mayor
      // marker on top of itself (Marker instances aren't deduped the way
      // map.addSource/addLayer already are below).
      if (map.getSource(WARDS_SOURCE_ID)) return;

      for (const feature of mayorsData.features) {
        if (feature.geometry.type !== "Point") continue;
        const properties = feature.properties as RepProperties;
        const [lng, lat] = feature.geometry.coordinates as [number, number];
        const el = createMayorMarkerElement(properties);
        const marker = new maplibregl.Marker({ element: el, anchor: "center" }).setLngLat([lng, lat]).addTo(map);

        el.addEventListener("mouseenter", () => {
          if (!isDesktopHover || selectedRef.current?.pinned) return;
          setSelected({ properties, pinned: false });
        });
        el.addEventListener("mouseleave", () => {
          if (!isDesktopHover || selectedRef.current?.pinned) return;
          setSelected(null);
        });
        el.addEventListener("click", (e) => {
          e.stopPropagation();
          setSelected({ properties, pinned: true });
          zoomToBounds(boundsAroundPoint(lng, lat));
        });

        mayorMarkersRef.current.push({ marker, properties });
      }

      map.addSource(WARDS_SOURCE_ID, { type: "geojson", data });

      map.addLayer({
        id: WARDS_FILL_LAYER_ID,
        type: "fill",
        source: WARDS_SOURCE_ID,
        paint: {
          "fill-color": WARD_FILL_COLOR_EXPRESSION,
          "fill-opacity": 0.6,
        },
      });

      map.addLayer({
        id: WARDS_OUTLINE_LAYER_ID,
        type: "line",
        source: WARDS_SOURCE_ID,
        paint: {
          "line-color": WARD_OUTLINE_COLOR,
          "line-width": 1.5,
        },
      });

      map.addLayer({
        id: WARDS_LABEL_LAYER_ID,
        type: "symbol",
        source: WARDS_SOURCE_ID,
        layout: {
          "text-field": ["concat", "Ward ", ["to-string", ["get", "ward"]]],
          "text-font": ["Noto Sans Bold"],
          "text-size": 12,
        },
        paint: {
          "text-color": "#1f2937",
          "text-halo-color": "#ffffff",
          "text-halo-width": 1.4,
        },
      });

      applyCityFilter(visibleCitiesRef.current);

      // Fit the map to both cities' actual ward extent rather than a
      // hardcoded bounding box, so this keeps working if either city's
      // ward boundaries shift. Stored so clicking away from a ward can
      // fly back to this same view.
      const bounds = new maplibregl.LngLatBounds();
      for (const feature of data.features) {
        if (feature.geometry.type !== "Polygon" && feature.geometry.type !== "MultiPolygon") continue;
        const rings =
          feature.geometry.type === "Polygon" ? feature.geometry.coordinates : feature.geometry.coordinates.flat();
        for (const ring of rings) {
          for (const [lng, lat] of ring as [number, number][]) {
            bounds.extend([lng, lat]);
          }
        }
      }
      if (!bounds.isEmpty()) {
        defaultBoundsRef.current = bounds;
        map.fitBounds(bounds, { padding: 40, duration: 0 });
      }
    });

    map.on("mousemove", WARDS_FILL_LAYER_ID, (e: maplibregl.MapLayerMouseEvent) => {
      if (!isDesktopHover) return;
      // A click-pinned modal stays put; hover shouldn't swap its content
      // out from under the user while it's pinned open.
      if (selectedRef.current?.pinned) return;
      map.getCanvas().style.cursor = "pointer";
      const feature = e.features?.[0];
      if (!feature) return;
      setSelected({ properties: feature.properties as RepProperties, pinned: false });
    });

    map.on("mouseleave", WARDS_FILL_LAYER_ID, () => {
      if (!isDesktopHover) return;
      map.getCanvas().style.cursor = "";
      if (selectedRef.current?.pinned) return;
      setSelected(null);
    });

    // A single, unscoped click handler (rather than one bound to
    // WARDS_FILL_LAYER_ID) so a click that misses every ward can be told
    // apart from a click that hits one — that's what lets "tap away"
    // zoom back out instead of just doing nothing.
    map.on("click", (e: maplibregl.MapMouseEvent) => {
      const features = map.queryRenderedFeatures(e.point, { layers: [WARDS_FILL_LAYER_ID] });
      const hit = features[0];
      if (!hit) {
        if (selectedRef.current?.pinned) deselect();
        return;
      }
      const hitProps = hit.properties as RepProperties;
      setSelected({ properties: hitProps, pinned: true });

      // queryRenderedFeatures returns geometry clipped to whichever
      // internal tile the click landed in, not the ward's true full
      // shape — fitBounds on that would center on the click point rather
      // than the ward, especially for large wards near a tile edge. Look
      // the same ward up in the untiled source data fetched at load time
      // for its real geometry instead.
      const fullFeature = wardsDataRef.current?.features.find(
        (f) => f.properties?.city === hitProps.city && f.properties?.ward === hitProps.ward,
      );
      zoomToBounds(boundsFromFeature((fullFeature ?? hit) as Feature<Geometry>));
    });

    const handleResize = () => map.resize();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      for (const { marker } of mayorMarkersRef.current) marker.remove();
      mayorMarkersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hearings =
    selected && selected.properties.ward !== null
      ? getUpcomingHearings(selected.properties.city, selected.properties.ward)
      : [];

  return (
    <div className="relative w-full h-dvh overflow-hidden">
      <div ref={mapContainerRef} className="absolute inset-0 w-full h-full" />

      <div
        role="group"
        aria-label="Filter by city"
        className="absolute left-3 top-3 z-20 rounded-lg bg-white/90 backdrop-blur-sm border border-neutral-200 shadow-lg divide-y divide-neutral-100 text-sm text-neutral-700 font-sans"
      >
        {CITIES.map((city) => (
          <label key={city} className="flex items-center gap-2 px-3 py-2.5 sm:py-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={visibleCities[city]}
              onChange={() => toggleCity(city)}
              className="cursor-pointer"
            />
            <span
              className="h-2.5 w-2.5 rounded-full shrink-0"
              style={{ backgroundColor: CITY_ACCENT[city] }}
            />
            {city}
          </label>
        ))}
      </div>

      {selected && (
        <div className="absolute inset-x-0 bottom-0 z-10 flex justify-center pointer-events-none pb-[env(safe-area-inset-bottom)] sm:inset-x-auto sm:justify-start sm:left-4 sm:bottom-4 sm:pb-0">
          <WardModal
            ward={selected.properties}
            hearings={hearings}
            pinned={selected.pinned}
            onClose={deselect}
          />
        </div>
      )}
    </div>
  );
}
