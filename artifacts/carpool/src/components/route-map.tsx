import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { Loader2, MapPin } from "lucide-react";

declare const __MAPBOX_TOKEN__: string;

export interface PassengerMarker {
  lat: number;
  lng: number;
  label: string;
  name: string;
}

interface RouteMapProps {
  originLat: number;
  originLng: number;
  destLat: number;
  destLng: number;
  originLabel?: string;
  destLabel?: string;
  className?: string;
  passengers?: PassengerMarker[];
}

export function RouteMap({
  originLat,
  originLng,
  destLat,
  destLng,
  originLabel = "Pickup",
  destLabel = "Dropoff",
  className = "w-full h-64 rounded-xl overflow-hidden",
  passengers = [],
}: RouteMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapRef.current) return;

    mapboxgl.accessToken = __MAPBOX_TOKEN__;

    const midLat = (originLat + destLat) / 2;
    const midLng = (originLng + destLng) / 2;

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: "mapbox://styles/mapbox/light-v11",
      center: [midLng, midLat],
      zoom: 10,
    });

    mapRef.current = map;

    map.on("load", async () => {
      // Add origin marker
      new mapboxgl.Marker({ color: "#22C55E" })
        .setLngLat([originLng, originLat])
        .setPopup(new mapboxgl.Popup({ offset: 25 }).setText(originLabel))
        .addTo(map);

      // Add destination marker
      new mapboxgl.Marker({ color: "#EF4444" })
        .setLngLat([destLng, destLat])
        .setPopup(new mapboxgl.Popup({ offset: 25 }).setText(destLabel))
        .addTo(map);

      // Add passenger markers
      if (passengers && passengers.length > 0) {
        passengers.forEach((p) => {
          const el = document.createElement("div");
          el.style.width = "24px";
          el.style.height = "24px";
          el.style.borderRadius = "50%";
          el.style.backgroundColor = "#7C3AED";
          el.style.border = "2px solid white";
          el.style.color = "white";
          el.style.display = "flex";
          el.style.alignItems = "center";
          el.style.justifyContent = "center";
          el.style.fontWeight = "900";
          el.style.fontSize = "12px";
          el.style.boxShadow = "0 2px 4px rgba(0,0,0,0.3)";
          el.className = "cursor-pointer";
          el.innerHTML = p.label;

          new mapboxgl.Marker(el)
            .setLngLat([p.lng, p.lat])
            .setPopup(new mapboxgl.Popup({ offset: 25 }).setText(`${p.name}'s Location`))
            .addTo(map);
        });
      }

      // Fit bounds to show all markers
      const bounds = new mapboxgl.LngLatBounds(
        [originLng, originLat],
        [destLng, destLat]
      );
      if (passengers && passengers.length > 0) {
        passengers.forEach((p) => {
          bounds.extend([p.lng, p.lat]);
        });
      }
      map.fitBounds(bounds, { padding: 60, maxZoom: 14, duration: 800 });

      // Fetch route from Directions API
      try {
        const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${originLng},${originLat};${destLng},${destLat}?geometries=geojson&access_token=${__MAPBOX_TOKEN__}`;
        const res = await fetch(url);
        const data = await res.json();

        if (data.routes && data.routes.length > 0) {
          const route = data.routes[0].geometry;

          map.addSource("route", {
            type: "geojson",
            data: { type: "Feature", properties: {}, geometry: route },
          });

          map.addLayer({
            id: "route-line",
            type: "line",
            source: "route",
            layout: { "line-join": "round", "line-cap": "round" },
            paint: {
              "line-color": "#7C3AED",
              "line-width": 4,
              "line-opacity": 0.85,
            },
          });
        }
      } catch {
        // Route fetch failed; markers still visible, no crash
      }

      setIsLoading(false);
    });

    map.on("error", () => {
      setError("Could not load map");
      setIsLoading(false);
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [originLat, originLng, destLat, destLng, originLabel, destLabel, passengers]);

  if (error) {
    return (
      <div className={`${className} bg-muted flex items-center justify-center`}>
        <div className="text-center text-muted-foreground">
          <MapPin className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">Map unavailable</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`} data-testid="route-map">
      {isLoading && (
        <div className="absolute inset-0 z-10 bg-muted flex items-center justify-center rounded-xl">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      )}
      <div ref={mapContainerRef} className="w-full h-full" />
    </div>
  );
}
