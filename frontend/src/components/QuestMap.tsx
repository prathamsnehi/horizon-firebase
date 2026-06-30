import { MapContainer, TileLayer, Marker } from "react-leaflet";
import L from "leaflet";
import { ExternalLink } from "lucide-react";
import type { LocationInformation } from "../types";

// A lightweight pin so we don't depend on Leaflet's default marker assets.
const pinIcon = L.divIcon({
  className: "",
  html: `<div style="
    width:22px;height:22px;border-radius:9999px;
    background:#FFB693;border:3px solid #1C1B1B;
    box-shadow:0 2px 6px rgba(0,0,0,0.35);"></div>`,
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

/**
 * Inline, low-interaction map preview (the web stand-in for the app's
 * MapKit snapshot). Clicking opens the place in Google Maps.
 */
export function QuestMap({ location }: { location: LocationInformation }) {
  const center: [number, number] = [location.latitude, location.longitude];
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border">
      <MapContainer
        center={center}
        zoom={14}
        scrollWheelZoom={false}
        dragging={false}
        doubleClickZoom={false}
        zoomControl={false}
        attributionControl={false}
        style={{ height: "200px", width: "100%" }}
      >
        <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" />
        <Marker position={center} icon={pinIcon} />
      </MapContainer>
      <a
        href={location.googleMapsURL}
        target="_blank"
        rel="noreferrer"
        className="absolute bottom-3 right-3 z-[400] inline-flex items-center gap-1.5 rounded-full bg-surface/95 px-3 py-1.5 text-footnote font-semibold text-foreground shadow-card backdrop-blur hover:bg-surface"
      >
        <ExternalLink className="h-3.5 w-3.5" />
        Open in Google Maps
      </a>
    </div>
  );
}
