import { useState, useRef, useEffect, useCallback } from "react";
import { MapPin, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

declare const __MAPBOX_TOKEN__: string;

interface GeocoderFeature {
  id: string;
  place_name: string;
  center: [number, number]; // [lng, lat]
}

export interface GeocoderResult {
  placeName: string;
  lng: number;
  lat: number;
}

interface MapboxGeocoderProps {
  placeholder?: string;
  value?: string;
  onSelect: (result: GeocoderResult) => void;
  onClear?: () => void;
  className?: string;
  "data-testid"?: string;
}

export function MapboxGeocoder({
  placeholder = "Search for a location...",
  value,
  onSelect,
  onClear,
  className,
  "data-testid": testId,
}: MapboxGeocoderProps) {
  const [query, setQuery] = useState(value ?? "");
  const [suggestions, setSuggestions] = useState<GeocoderFeature[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (value !== undefined) setQuery(value);
  }, [value]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchSuggestions = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setSuggestions([]);
      setIsOpen(false);
      return;
    }
    setIsLoading(true);
    try {
      const encoded = encodeURIComponent(q);
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encoded}.json?access_token=${__MAPBOX_TOKEN__}&autocomplete=true&limit=5&types=place,locality,neighborhood,address,poi&country=pk`;
      const res = await fetch(url);
      const data = await res.json();
      setSuggestions(data.features ?? []);
      setIsOpen(true);
    } catch {
      setSuggestions([]);
    } finally {
      setIsLoading(false);
    }
  }, []);
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value;
    setQuery(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(q), 300);
  };

  const handleSelect = (feature: GeocoderFeature) => {
    setQuery(feature.place_name);
    setSuggestions([]);
    setIsOpen(false);
    onSelect({
      placeName: feature.place_name,
      lng: feature.center[0],
      lat: feature.center[1],
    });
  };

  const handleClear = () => {
    setQuery("");
    setSuggestions([]);
    setIsOpen(false);
    onClear?.();
  };

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <div className="relative flex items-center">
        <MapPin className="absolute left-3 w-4 h-4 text-muted-foreground pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={handleChange}
          onFocus={() => suggestions.length > 0 && setIsOpen(true)}
          placeholder={placeholder}
          data-testid={testId}
          className="w-full pl-9 pr-9 py-2 text-sm border border-input rounded-md bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          autoComplete="off"
        />
        <div className="absolute right-3 flex items-center">
          {isLoading ? (
            <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />
          ) : query ? (
            <button
              type="button"
              onClick={handleClear}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          ) : null}
        </div>
      </div>

      {isOpen && suggestions.length > 0 && (
        <ul className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-md shadow-lg overflow-hidden max-h-60 overflow-y-auto">
          {suggestions.map((feature) => (
            <li key={feature.id}>
              <button
                type="button"
                className="w-full text-left px-4 py-3 text-sm hover:bg-accent hover:text-accent-foreground transition-colors flex items-start gap-3 border-b border-border/50 last:border-0"
                onClick={() => handleSelect(feature)}
              >
                <MapPin className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <span className="leading-snug">{feature.place_name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
