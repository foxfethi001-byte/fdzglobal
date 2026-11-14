import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import { feature } from 'topojson-client';
import type { FeatureCollection, Geometry } from 'geojson';
import worldAtlas from 'world-atlas/countries-110m.json';

maplibregl.setWorkerUrl('/maplibre-gl-worker.mjs');
import {
  Flame,
  Layers,
  MapPin,
  Plane,
  Ship,
  X,
} from 'lucide-react';
import type {
  AircraftTrack,
  IntelCategory,
  IntelEvent,
  LayerDefinition,
  VesselTrack,
} from '../types/intelligence';
import {
  translateCategory,
  translateRegion,
  translateStatus,
  useI18n,
} from '../lib/i18n';

export interface MapLayerStatus extends LayerDefinition {
  status: 'operational' | 'degraded' | 'unavailable' | 'reference';
  statusNote: string;
  itemCount: number;
}

interface GlobalIntelMapProps {
  events: IntelEvent[];
  layers: MapLayerStatus[];
  visibleLayers: IntelCategory[];
  onToggleLayer: (id: IntelCategory) => void;
  mapStyle: 'dark' | 'osm' | 'topo';
  onChangeMapStyle: (style: 'dark' | 'osm' | 'topo') => void;
  selectedEventId?: string | null;
  onSelectEvent: (ev: IntelEvent) => void;
  onSelectCountryName?: (name: string) => void;
  flyToCoords?: { lon: number; lat: number; zoom: number } | null;
  aircraft?: AircraftTrack[];
  vessels?: VesselTrack[];
  heightClass?: string;
}

function buildRasterStyle(styleKey: 'dark' | 'osm' | 'topo'): maplibregl.StyleSpecification {
  const configs = {
    dark: {
      tiles: [
        'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
        'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
      ],
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
    },
    osm: {
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      attribution: '&copy; OpenStreetMap contributors',
    },
    topo: {
      tiles: ['https://a.tile.opentopomap.org/{z}/{x}/{y}.png'],
      attribution: '&copy; OpenStreetMap contributors &copy; OpenTopoMap (CC-BY-SA)',
    },
  };
  const cfg = configs[styleKey];
  return {
    version: 8,
    sources: {
      basemap: {
        type: 'raster',
        tiles: cfg.tiles,
        tileSize: 256,
        attribution: cfg.attribution,
      },
    },
    layers: [
      {
        id: 'basemap-layer',
        type: 'raster',
        source: 'basemap',
        minzoom: 0,
        maxzoom: 18,
      },
    ],
  };
}

const REGION_JUMPS = [
  { key: 'Global View', labelAr: 'النظرة العالمية', labelFr: 'Vue Globale', lon: 15, lat: 24, zoom: 1.5 },
  { key: 'Algeria', labelAr: 'الجزائر', labelFr: 'Algérie', lon: 2.6, lat: 28.0, zoom: 4.5 },
  { key: 'North Africa', labelAr: 'شمال أفريقيا', labelFr: 'Afrique du Nord', lon: 10.0, lat: 29.0, zoom: 3.6 },
  { key: 'Sahel', labelAr: 'الساحل', labelFr: 'Sahel', lon: 4.0, lat: 15.5, zoom: 3.8 },
  { key: 'Middle East', labelAr: 'الشرق الأوسط', labelFr: 'Moyen-Orient', lon: 44.0, lat: 28.5, zoom: 3.8 },
  { key: 'Europe', labelAr: 'أوروبا', labelFr: 'Europe', lon: 15.0, lat: 50.0, zoom: 3.4 },
  { key: 'United States', labelAr: 'الولايات المتحدة', labelFr: 'États-Unis', lon: -98.0, lat: 38.5, zoom: 3.3 },
  { key: 'Asia-Pacific', labelAr: 'آسيا والمحيط الهادئ', labelFr: 'Asie-Pacifique', lon: 118.0, lat: 22.0, zoom: 3.0 },
];

export const GlobalIntelMap: React.FC<GlobalIntelMapProps> = ({
  events,
  layers,
  visibleLayers,
  onToggleLayer,
  mapStyle,
  onChangeMapStyle,
  selectedEventId,
  onSelectEvent,
  onSelectCountryName,
  flyToCoords,
  aircraft = [],
  vessels = [],
  heightClass = 'h-[560px]',
}) => {
  const { lang, t } = useI18n();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [layersOpen, setLayersOpen] = useState(false);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [selectedCountryLabel, setSelectedCountryLabel] = useState<string | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);

  const eventsRef = useRef<IntelEvent[]>(events);
  eventsRef.current = events;

  const layerColorMap = useMemo(() => {
    const m: Record<string, string> = {};
    for (const l of layers) m[l.id] = l.color;
    return m;
  }, [layers]);

  const countriesGeoJson = useMemo(() => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const topo = worldAtlas as any;
      return feature(topo, topo.objects.countries) as unknown as FeatureCollection<Geometry>;
    } catch {
      return { type: 'FeatureCollection', features: [] } as FeatureCollection<Geometry>;
    }
  }, []);

  const visibleEventsGeoJson = useMemo(() => {
    const visibleSet = new Set(visibleLayers);
    const features = events
      .filter((e) => e.lat !== null && e.lon !== null && visibleSet.has(e.category))
      .map((e) => ({
        type: 'Feature' as const,
        geometry: {
          type: 'Point' as const,
          coordinates: [e.lon as number, e.lat as number],
        },
        properties: {
          id: e.id,
          title: e.title,
          category: e.category,
          severity: e.severity,
          color: layerColorMap[e.category] || '#22d3ee',
          weight: e.severity === 'critical' ? 1.0 : e.severity === 'high' ? 0.8 : e.severity === 'medium' ? 0.5 : 0.3,
        },
      }));
    return {
      type: 'FeatureCollection' as const,
      features,
    };
  }, [events, visibleLayers, layerColorMap]);

  const aircraftGeoJson = useMemo(() => {
    const show = visibleLayers.includes('aviation');
    return {
      type: 'FeatureCollection' as const,
      features: show
        ? aircraft
            .filter((a) => Number.isFinite(a.lat) && Number.isFinite(a.lon))
            .map((a) => ({
              type: 'Feature' as const,
              geometry: { type: 'Point' as const, coordinates: [a.lon, a.lat] },
              properties: {
                callsign: a.callsign,
                icao24: a.icao24,
                originCountry: a.originCountry,
                alt: a.altitudeM ?? null,
                vel: a.velocityMs ?? null,
                source: a.source,
              },
            }))
        : [],
    };
  }, [aircraft, visibleLayers]);

  const vesselGeoJson = useMemo(() => {
    const show = visibleLayers.includes('maritime');
    return {
      type: 'FeatureCollection' as const,
      features: show
        ? vessels
            .filter((v) => Number.isFinite(v.lat) && Number.isFinite(v.lon))
            .map((v) => ({
              type: 'Feature' as const,
              geometry: { type: 'Point' as const, coordinates: [v.lon, v.lat] },
              properties: {
                mmsi: v.mmsi,
                name: v.name,
                sog: v.sogKnots ?? null,
                cog: v.cogDeg ?? null,
                region: v.region,
                source: v.source,
              },
            }))
        : [],
    };
  }, [vessels, visibleLayers]);

  // Initialize MapLibre GL JS
  useEffect(() => {
    if (!containerRef.current) return;
    let map: maplibregl.Map;
    try {
      map = new maplibregl.Map({
        container: containerRef.current,
        style: buildRasterStyle(mapStyle),
        center: [15, 24],
        zoom: 1.5,
        minZoom: 1.0,
        maxZoom: 16,
      });
    } catch (err) {
      setMapError(err instanceof Error ? err.message : 'WebGL map initialization failed');
      return;
    }

    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'top-right');
    map.addControl(new maplibregl.ScaleControl({ maxWidth: 120, unit: 'metric' }), 'bottom-right');

    const attachLayers = () => {
      if (!map.getSource('countries')) {
        map.addSource('countries', {
          type: 'geojson',
          data: countriesGeoJson,
        });
        map.addLayer({
          id: 'country-fills',
          type: 'fill',
          source: 'countries',
          paint: {
            'fill-color': '#22d3ee',
            'fill-opacity': 0.02,
          },
        });
        map.addLayer({
          id: 'country-borders',
          type: 'line',
          source: 'countries',
          paint: {
            'line-color': 'rgba(148, 163, 184, 0.24)',
            'line-width': 0.7,
          },
        });
      }

      if (!map.getSource('intel-events')) {
        map.addSource('intel-events', {
          type: 'geojson',
          data: visibleEventsGeoJson,
          cluster: true,
          clusterMaxZoom: 6,
          clusterRadius: 42,
        });

        map.addSource('intel-heatmap-src', {
          type: 'geojson',
          data: visibleEventsGeoJson,
        });

        map.addLayer({
          id: 'intel-heatmap',
          type: 'heatmap',
          source: 'intel-heatmap-src',
          layout: { visibility: showHeatmap ? 'visible' : 'none' },
          paint: {
            'heatmap-weight': ['get', 'weight'],
            'heatmap-intensity': 1.2,
            'heatmap-radius': 24,
            'heatmap-opacity': 0.65,
            'heatmap-color': [
              'interpolate',
              ['linear'],
              ['heatmap-density'],
              0, 'rgba(34,211,238,0)',
              0.25, 'rgba(34,211,238,0.45)',
              0.55, 'rgba(245,158,11,0.7)',
              0.9, 'rgba(239,68,68,0.9)',
            ],
          },
        });

        map.addLayer({
          id: 'clusters',
          type: 'circle',
          source: 'intel-events',
          filter: ['has', 'point_count'],
          paint: {
            'circle-color': [
              'step',
              ['get', 'point_count'],
              '#0891b2',
              15, '#d97706',
              40, '#dc2626',
            ],
            'circle-radius': ['step', ['get', 'point_count'], 15, 15, 20, 40, 26],
            'circle-stroke-width': 1.5,
            'circle-stroke-color': '#0b0f17',
            'circle-opacity': 0.88,
          },
        });

        map.addLayer({
          id: 'cluster-count',
          type: 'symbol',
          source: 'intel-events',
          filter: ['has', 'point_count'],
          layout: {
            'text-field': ['get', 'point_count_abbreviated'],
            'text-size': 11,
          },
          paint: {
            'text-color': '#f8fafc',
          },
        });

        map.addLayer({
          id: 'unclustered-point',
          type: 'circle',
          source: 'intel-events',
          filter: ['!', ['has', 'point_count']],
          paint: {
            'circle-color': ['get', 'color'],
            'circle-radius': 6,
            'circle-stroke-width': 1.5,
            'circle-stroke-color': '#0b0f17',
          },
        });
      }

      if (!map.getSource('aviation-src')) {
        map.addSource('aviation-src', { type: 'geojson', data: aircraftGeoJson });
        map.addLayer({
          id: 'aviation-points',
          type: 'circle',
          source: 'aviation-src',
          paint: {
            'circle-color': '#34d399',
            'circle-radius': 4.5,
            'circle-stroke-width': 1,
            'circle-stroke-color': '#064e3b',
          },
        });
      }

      if (!map.getSource('maritime-src')) {
        map.addSource('maritime-src', { type: 'geojson', data: vesselGeoJson });
        map.addLayer({
          id: 'maritime-points',
          type: 'circle',
          source: 'maritime-src',
          paint: {
            'circle-color': '#2dd4bf',
            'circle-radius': 4.5,
            'circle-stroke-width': 1,
            'circle-stroke-color': '#134e4a',
          },
        });
      }

      setMapReady(true);
    };

    map.on('load', attachLayers);
    map.on('style.load', attachLayers);

    // Click cluster to zoom
    map.on('click', 'clusters', async (e: maplibregl.MapLayerMouseEvent) => {
      const features = map.queryRenderedFeatures(e.point, { layers: ['clusters'] });
      const clusterId = features[0]?.properties?.cluster_id;
      const src = map.getSource('intel-events') as maplibregl.GeoJSONSource | undefined;
      if (src && clusterId !== undefined) {
        const zoom = await src.getClusterExpansionZoom(clusterId);
        const geom = features[0].geometry as GeoJSON.Point;
        map.easeTo({ center: geom.coordinates as [number, number], zoom });
      }
    });

    // Click unclustered marker
    map.on('click', 'unclustered-point', (e: maplibregl.MapLayerMouseEvent) => {
      const feat = e.features?.[0];
      const id = feat?.properties?.id;
      if (!id) return;
      const found = eventsRef.current.find((ev) => ev.id === id);
      if (found) onSelectEvent(found);
    });

    // Click aviation track popup
    map.on('click', 'aviation-points', (e: maplibregl.MapLayerMouseEvent) => {
      const feat = e.features?.[0];
      if (!feat || feat.geometry.type !== 'Point') return;
      const props = feat.properties ?? {};
      const box = document.createElement('div');
      box.className = 'text-xs text-slate-900 space-y-0.5 font-sans';
      const title = document.createElement('div');
      title.className = 'font-semibold';
      title.textContent = `Flight ${String(props.callsign || 'N/A')} (${String(props.icao24 || '')})`;
      const meta = document.createElement('div');
      meta.className = 'text-[11px] text-slate-600';
      const altText = props.alt !== null && props.alt !== undefined ? `${props.alt} m` : 'N/A';
      const spdText = props.vel !== null && props.vel !== undefined ? `${props.vel} m/s` : 'N/A';
      meta.textContent = `Alt: ${altText} · Speed: ${spdText} · ${String(props.originCountry || '')}`;
      const src = document.createElement('div');
      src.className = 'text-[10px] text-slate-500';
      src.textContent = String(props.source || '');
      box.append(title, meta, src);
      new maplibregl.Popup({ closeButton: true, maxWidth: '240px' })
        .setLngLat(feat.geometry.coordinates as [number, number])
        .setDOMContent(box)
        .addTo(map);
    });

    // Click maritime track popup
    map.on('click', 'maritime-points', (e: maplibregl.MapLayerMouseEvent) => {
      const feat = e.features?.[0];
      if (!feat || feat.geometry.type !== 'Point') return;
      const props = feat.properties ?? {};
      const box = document.createElement('div');
      box.className = 'text-xs text-slate-900 space-y-0.5 font-sans';
      const title = document.createElement('div');
      title.className = 'font-semibold';
      title.textContent = `${String(props.name || 'Vessel')} · MMSI ${String(props.mmsi || '')}`;
      const meta = document.createElement('div');
      meta.className = 'text-[11px] text-slate-600';
      const sogText = props.sog !== null && props.sog !== undefined ? `${props.sog} kn` : 'N/A';
      const cogText = props.cog !== null && props.cog !== undefined ? `${props.cog}°` : 'N/A';
      meta.textContent = `SOG: ${sogText} · COG: ${cogText} · ${String(props.region || '')}`;
      const src = document.createElement('div');
      src.className = 'text-[10px] text-slate-500';
      src.textContent = String(props.source || '');
      box.append(title, meta, src);
      new maplibregl.Popup({ closeButton: true, maxWidth: '240px' })
        .setLngLat(feat.geometry.coordinates as [number, number])
        .setDOMContent(box)
        .addTo(map);
    });

    // Click country boundary
    map.on('click', 'country-fills', (e: maplibregl.MapLayerMouseEvent) => {
      const eventHits = map.queryRenderedFeatures(e.point, {
        layers: ['unclustered-point', 'clusters', 'aviation-points', 'maritime-points'],
      });
      if (eventHits.length > 0) return;
      const cName = e.features?.[0]?.properties?.name;
      if (typeof cName === 'string' && cName.trim()) {
        setSelectedCountryLabel(cName);
      }
    });

    for (const interactiveLayer of ['unclustered-point', 'clusters', 'aviation-points', 'maritime-points']) {
      map.on('mouseenter', interactiveLayer, () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', interactiveLayer, () => { map.getCanvas().style.cursor = ''; });
    }

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      setMapReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update map base style dynamically
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.setStyle(buildRasterStyle(mapStyle));
  }, [mapStyle]);

  // Update GeoJSON data whenever events or visibleLayers change
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const src = map.getSource('intel-events') as maplibregl.GeoJSONSource | undefined;
    const hmSrc = map.getSource('intel-heatmap-src') as maplibregl.GeoJSONSource | undefined;
    if (src) src.setData(visibleEventsGeoJson);
    if (hmSrc) hmSrc.setData(visibleEventsGeoJson);
  }, [visibleEventsGeoJson, mapReady]);

  // Update Aviation & Maritime tracks
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const aSrc = map.getSource('aviation-src') as maplibregl.GeoJSONSource | undefined;
    const mSrc = map.getSource('maritime-src') as maplibregl.GeoJSONSource | undefined;
    if (aSrc) aSrc.setData(aircraftGeoJson);
    if (mSrc) mSrc.setData(vesselGeoJson);
  }, [aircraftGeoJson, vesselGeoJson, mapReady]);

  // Toggle Heatmap visibility
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !map.getLayer('intel-heatmap')) return;
    map.setLayoutProperty('intel-heatmap', 'visibility', showHeatmap ? 'visible' : 'none');
  }, [showHeatmap, mapReady]);

  // Fly to requested coordinates
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !flyToCoords) return;
    map.flyTo({ center: [flyToCoords.lon, flyToCoords.lat], zoom: flyToCoords.zoom, duration: 800 });
  }, [flyToCoords]);

  // Fly to selected event if it has coords
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedEventId) return;
    const ev = events.find((x) => x.id === selectedEventId);
    if (ev && ev.lat !== null && ev.lon !== null) {
      map.easeTo({ center: [ev.lon, ev.lat], zoom: Math.max(map.getZoom(), 4.5), duration: 600 });
    }
  }, [selectedEventId, events]);

  const groupedLayers = useMemo(() => {
    const groups: Record<string, MapLayerStatus[]> = {
      conflict: [],
      disaster: [],
      cyber: [],
      mobility: [],
      infrastructure: [],
    };
    for (const l of layers) {
      groups[l.group]?.push(l);
    }
    return groups;
  }, [layers]);

  if (mapError) {
    return (
      <div className={`${heightClass} flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-[#0f1623] p-6 text-center`}>
        <div>
          <p className="text-sm font-semibold text-rose-500">{t.map.rendererUnavailable}</p>
          <p className="mt-1 text-xs text-slate-500">{mapError}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative w-full ${heightClass} rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden bg-[#080c12]`}>
      <div ref={containerRef} className="w-full h-full" />

      {/* Top-Start Map Controls */}
      <div className="absolute top-3 start-3 z-10 flex flex-wrap items-center gap-2 max-w-[calc(100%-64px)]">
        <button
          type="button"
          onClick={() => setLayersOpen((o) => !o)}
          className="inline-flex items-center gap-1.5 rounded-md border border-slate-700/80 bg-[#0f172a]/90 backdrop-blur px-3 py-1.5 text-xs font-medium text-slate-100 hover:bg-slate-800 transition-colors whitespace-nowrap"
        >
          <Layers className="w-3.5 h-3.5 text-cyan-400" />
          {t.map.layersBtn} ({visibleLayers.length}/20)
        </button>

        <button
          type="button"
          onClick={() => setShowHeatmap((h) => !h)}
          className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium backdrop-blur transition-colors whitespace-nowrap ${
            showHeatmap
              ? 'border-amber-500/60 bg-amber-500/20 text-amber-200'
              : 'border-slate-700/80 bg-[#0f172a]/90 text-slate-200 hover:bg-slate-800'
          }`}
        >
          <Flame className="w-3.5 h-3.5" />
          {t.map.densityBtn}
        </button>

        <select
          aria-label="Jump to region"
          onChange={(e) => {
            const target = REGION_JUMPS.find((r) => r.key === e.target.value);
            if (target && mapRef.current) {
              mapRef.current.flyTo({ center: [target.lon, target.lat], zoom: target.zoom, duration: 750 });
            }
          }}
          className="rounded-md border border-slate-700/80 bg-[#0f172a]/90 backdrop-blur px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
          defaultValue="Global View"
        >
          {REGION_JUMPS.map((r) => (
            <option key={r.key} value={r.key}>
              {lang === 'ar'
                ? r.labelAr
                : lang === 'fr'
                ? r.labelFr
                : r.key === 'Global View'
                ? t.map.globalView
                : translateRegion(r.key, lang)}
            </option>
          ))}
        </select>

        <div className="inline-flex rounded-md border border-slate-700/80 bg-[#0f172a]/90 backdrop-blur p-0.5">
          {(['dark', 'osm', 'topo'] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onChangeMapStyle(s)}
              className={`px-2 py-1 text-[11px] font-medium rounded transition-colors ${
                mapStyle === s
                  ? 'bg-cyan-500/20 text-cyan-300'
                  : 'text-slate-400 hover:text-slate-100'
              }`}
            >
              {s.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Selected Country Boundary Prompt */}
      {selectedCountryLabel && (
        <div className="absolute bottom-3 start-3 z-10 flex items-center gap-3 rounded-md border border-slate-700 bg-[#0f172a]/95 backdrop-blur px-3 py-2 text-xs text-slate-100">
          <MapPin className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
          <span>{t.map.countryLabel}: <strong>{selectedCountryLabel}</strong></span>
          {onSelectCountryName && (
            <button
              type="button"
              onClick={() => {
                onSelectCountryName(selectedCountryLabel);
                setSelectedCountryLabel(null);
              }}
              className="text-cyan-400 hover:underline font-medium"
            >
              {t.map.openProfile}
            </button>
          )}
          <button
            type="button"
            onClick={() => setSelectedCountryLabel(null)}
            aria-label="Dismiss"
            className="text-slate-400 hover:text-slate-100"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Bottom live layer counts */}
      <div className="absolute bottom-3 end-14 z-10 hidden sm:flex items-center gap-3 rounded-md border border-slate-700/70 bg-[#0f172a]/85 backdrop-blur px-2.5 py-1 text-[11px] font-mono tabular-nums text-slate-300">
        <span>{visibleEventsGeoJson.features.length} {t.map.mappedMarkers}</span>
        {visibleLayers.includes('aviation') && (
          <span className="inline-flex items-center gap-1 text-emerald-400">
            <Plane className="w-3 h-3" /> {aircraft.length}
          </span>
        )}
        {visibleLayers.includes('maritime') && (
          <span className="inline-flex items-center gap-1 text-teal-400">
            <Ship className="w-3 h-3" /> {vessels.length}
          </span>
        )}
      </div>

      {/* 20 Independent Layers Drawer */}
      {layersOpen && (
        <div className="absolute top-14 start-3 z-20 w-80 max-w-[calc(100%-24px)] max-h-[calc(100%-70px)] overflow-y-auto rounded-lg border border-slate-700 bg-[#0f172a]/95 backdrop-blur p-3 text-xs text-slate-200 shadow-2xl">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800">
            <span className="font-semibold text-slate-100">{t.map.drawerTitle}</span>
            <button
              type="button"
              onClick={() => setLayersOpen(false)}
              aria-label="Close layers"
              className="p-1 text-slate-400 hover:text-slate-100"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          {Object.entries(groupedLayers).map(([groupKey, groupItems]) => (
            <div key={groupKey} className="mb-3 last:mb-0">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                {t.map.groups[groupKey as keyof typeof t.map.groups] ?? groupKey}
              </div>
              <div className="space-y-1">
                {groupItems.map((layer) => {
                  const active = visibleLayers.includes(layer.id);
                  const statusColor =
                    layer.status === 'operational'
                      ? 'text-emerald-400'
                      : layer.status === 'degraded'
                      ? 'text-amber-400'
                      : layer.status === 'reference'
                      ? 'text-cyan-400'
                      : 'text-rose-400';
                  return (
                    <label
                      key={layer.id}
                      className="flex items-start gap-2 rounded px-2 py-1.5 hover:bg-slate-800/70 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={active}
                        onChange={() => onToggleLayer(layer.id)}
                        className="mt-0.5 accent-cyan-500"
                      />
                      <span
                        className="mt-1.5 w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: layer.color }}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium text-slate-100 truncate">
                            {translateCategory(layer.id, lang)}
                          </span>
                          <span className={`font-mono text-[10px] uppercase ${statusColor}`}>
                            {translateStatus(layer.status, lang)}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400 truncate">
                          {layer.sourceName}
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
