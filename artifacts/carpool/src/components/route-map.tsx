import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { Loader2, MapPin } from "lucide-react";

declare const __MAPBOX_TOKEN__: string;

interface RouteMapProps {
  originLat: number;
  originLng: number;
  destLat: number;
  destLng: number;
  originLabel?: string;
  destLabel?: string;
  className?: string;
}

export function RouteMap({
  originLat,
  originLng,
  destLat,
  destLng,
  originLabel = "Pickup",
  destLabel = "Dropoff",
  className = "w-full h-64 rounded-xl overflow-hidden",
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
      new mapboxgl.Marker({ color: "#6366f1" })
        .setLngLat([originLng, originLat])
        .setPopup(new mapboxgl.Popup({ offset: 25 }).setText(originLabel))
        .addTo(map);

      // Add destination marker
      new mapboxgl.Marker({ color: "#f43f5e" })
        .setLngLat([destLng, destLat])
        .setPopup(new mapboxgl.Popup({ offset: 25 }).setText(destLabel))
        .addTo(map);

      // Fit bounds to show both markers
      const bounds = new mapboxgl.LngLatBounds(
        [originLng, originLat],
        [destLng, destLat]
      );
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
              "line-color": "#6366f1",
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
  }, [originLat, originLng, destLat, destLng, originLabel, destLabel]);

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
