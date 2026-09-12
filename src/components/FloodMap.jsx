import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, WMSTileLayer, Marker, CircleMarker, Popup, LayersControl, ZoomControl, Polyline, GeoJSON, useMapEvents, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { hotspots as baseHotspots, riskColors, districts, safeZones } from '../data/hotspots';
import { useLocationContext } from '../context/LocationContext';
import { calculateUniversalPMRS } from '../utils/universalPMRS';
import { bhuvanGetLULCStats, bhuvanGetRoutingData, bhuvanGetGeoID, bhuvanExtractTerrainData } from '../utils/bhuvan-api';

import L from 'leaflet';

const hotspots = [...baseHotspots]; // Removed massiveHotspots to permanently fix extreme clutter

// Custom Polygon-Arrow SVG Icon generator
const getRiskPolygonIcon = (color, isSelected) => {
  const scale = isSelected ? 1.4 : 1.0;
  return L.divIcon({
    html: `<svg width="${24 * scale}" height="${24 * scale}" viewBox="0 0 24 24" fill="${color}" stroke="#fff" stroke-width="1.5" style="transform: translateY(-50%) drop-shadow(0px 3px 4px rgba(0,0,0,0.4));">
             <path d="M12 2L22 20H2Z" />
           </svg>`,
    className: 'custom-polygon-arrow',
    iconSize: [24 * scale, 24 * scale],
    iconAnchor: [12 * scale, 12 * scale]
  });
};

const myLocationIcon = L.divIcon({
  html: `<div style="font-size: 24px; color: #3b82f6; text-shadow: 0 2px 4px rgba(0,0,0,0.5); transform: rotate(-45deg);">➤</div>`,
  className: 'custom-loc-arrow',
  iconSize: [24, 24],
  iconAnchor: [12, 12]
});



function LiveWeatherBoundsController({ weatherCache, setWeatherCache }) {
  const map = useMapEvents({
    moveend: () => checkBounds(),
    zoomend: () => checkBounds(),
  });

  const checkBounds = async () => {
    if (map.getZoom() < 9) return; // Only fetch when zoomed in (e.g. city/state level)

    const bounds = map.getBounds();
    const visibleHotspots = hotspots.filter(h => bounds.contains([h.lat, h.lng]));

    if (visibleHotspots.length === 0 || visibleHotspots.length > 30) return; // Prevent massive API spam

    // Only fetch for dots we haven't cached yet
    const toFetch = visibleHotspots.filter(h => !weatherCache[h.id]);
    if (toFetch.length === 0) return;

    try {
      const lats = toFetch.map(h => h.lat).join(',');
      const lons = toFetch.map(h => h.lng).join(',');
      
      const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lons}&current=precipitation&daily=precipitation_sum&timezone=Asia%2FKolkata&forecast_days=7&past_days=7`);
      const data = await res.json();
      
      const newCache = { ...weatherCache };
      const responses = toFetch.length === 1 ? [data] : data;

      // Fetch live Bhuvan topological/infrastructure APIs for all visible spots concurrently
      const bhuvanPayloads = await Promise.all(toFetch.map(async h => {
        const [lulc, routing, geo, terrain] = await Promise.all([
          bhuvanGetLULCStats(h.lat, h.lng),
          bhuvanGetRoutingData(h.lat, h.lng),
          bhuvanGetGeoID(h.lat, h.lng),
          bhuvanExtractTerrainData(h.lat, h.lng)
        ]);
        return { lulc, routing, geo, terrain };
      }));
      
      responses.forEach((wData, index) => {
        const h = toFetch[index];
        const b = bhuvanPayloads[index];
        const allDays = wData.daily?.precipitation_sum || [];
        const past3Rain = allDays.slice(0, 7).slice(-3).reduce((acc, val) => acc + val, 0);
        const currentRainMm = wData.current?.precipitation || 0;

        const pmrsData = calculateUniversalPMRS({
          lulcConcretePct: b.lulc.concretePct,
          slopePct: parseFloat(b.terrain.slope),
          routeToRiverKm: b.routing.routeToRiverKm,
          populationDensity: b.geo.populationDensity,
          pumpingStations: b.geo.type === 'highly_dense_urban' ? 3 : 1,
          drainCapacityM3s: 50,
          past3DayRainMm: past3Rain,
          currentRainMm: currentRainMm,
          forecast7day: allDays.slice(7, 14),
          wardName: h.district || ''
        });

        // Determine live risk color
        let liveRisk = 'low';
        if (pmrsData.floodRiskPct > 60) liveRisk = 'critical';
        else if (pmrsData.floodRiskPct > 35) liveRisk = 'high';
        else if (pmrsData.floodRiskPct > 15) liveRisk = 'moderate';

        newCache[h.id] = { risk: liveRisk, pmrs: pmrsData.pmrs, prob: pmrsData.floodRiskPct, rain: currentRainMm };
      });

      setWeatherCache(newCache);
    } catch (e) {
      console.warn('Smart Batch Weather Error:', e);
    }
  };

  useEffect(() => { checkBounds(); }, []);
  return null;
}

function MapController({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.flyTo(center, zoom, { animate: true });
    }
  }, [center, zoom, map]);
  return null;
}

const typeLabels = {
  embankment: '🏗️ Embankment',
  flood_2023: '🌊 Flood 2023',
  flood_1978: '📜 Flood 1978',
  waterlogging: '💧 Waterlogging',
  pumping_station: '⚙️ Pumping Station',
  regulator: '🚰 Regulator',
  village: '🏘️ Village',
};

const riskRadius = { critical: 14, high: 11, moderate: 9, low: 7 };

export default function FloodMap({ filterRisk, filterType }) {
  const [selectedHotspot, setSelectedHotspot] = useState(null);
  const [activeFilters, setActiveFilters] = useState({ risk: 'all', type: 'all', district: 'all' });
  const [mapCenter, setMapCenter] = useState([28.6139, 77.2090]); // Default to Delhi as requested
  const [mapZoom, setMapZoom] = useState(11);
  const [weatherCache, setWeatherCache] = useState({}); // Smart Batch cache
  const [userLocation, setUserLocation] = useState(null); // Track actual location
  
  const { globalCityData, globalOsmDrainage, isGlobalSearching } = useLocationContext();

  useEffect(() => {
    if (globalCityData && globalCityData.lat) {
      setMapCenter([globalCityData.lat, globalCityData.lon]);
      setMapZoom(13); // Zoom to city level automatically
    }
  }, [globalCityData]);
  
  const locateUser = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const loc = [position.coords.latitude, position.coords.longitude];
          setMapCenter(loc);
          setUserLocation(loc);
          setMapZoom(12);
        },
        (err) => {
          console.error("Geolocation error:", err);
          alert("Location access denied or unavailable.");
        }
      );
    } else {
      alert("Geolocation is not supported by your browser.");
    }
  };

  const filtered = hotspots.filter(h => {
    if (activeFilters.risk !== 'all' && h.risk !== activeFilters.risk) return false;
    if (activeFilters.type !== 'all' && h.type !== activeFilters.type) return false;
    if (activeFilters.district !== 'all' && h.district !== activeFilters.district) return false;
    return true;
  });

  const filteredSafeZones = safeZones.filter(z => {
    if (activeFilters.district !== 'all' && z.district !== activeFilters.district) return false;
    return true;
  });

  const counts = { critical: 0, high: 0, moderate: 0, low: 0 };
  filtered.forEach(h => { if (counts[h.risk] !== undefined) counts[h.risk]++; });

  return (
    <div>
      {/* Filter Bar */}
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem', alignItems: 'center' }}>
        
        {globalCityData && (
          <div style={{ background: 'var(--bg-glass)', padding: '0.3rem 0.8rem', borderRadius: '8px', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
             <span style={{ fontSize: '1rem' }}>📍</span> 
             <span>Tracking <strong style={{ color: 'var(--primary-light)' }}>{globalCityData.name}</strong></span>
          </div>
        )}

        {isGlobalSearching && (
           <div style={{ color: 'var(--primary-light)', fontSize: '0.85rem' }}>
             <span style={{ animation: 'pulse-water 1s infinite' }}>⏳</span> Syncing Map to City...
           </div>
        )}

        <select className="form-select" style={{ width: 'auto', padding: '0.4rem 0.75rem' }}
          onChange={e => setActiveFilters(f => ({ ...f, risk: e.target.value }))}>
          <option value="all">All Risk Levels</option>
          <option value="critical">🔴 Critical</option>
          <option value="high">🟠 High</option>
          <option value="moderate">🟡 Moderate</option>
          <option value="low">🟢 Low</option>
        </select>
        <select className="form-select" style={{ width: 'auto', padding: '0.4rem 0.75rem' }}
          onChange={e => setActiveFilters(f => ({ ...f, type: e.target.value }))}>
          <option value="all">All Types</option>
          {Object.entries(typeLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <button 
            onClick={locateUser} 
            className="btn btn-primary" 
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 0.75rem', fontSize: '0.85rem' }}
          >
            📍 Focus My Location
          </button>
          {Object.entries(counts).map(([risk, count]) => count > 0 && (
            <span key={risk} className={`risk-badge ${risk}`}>
              {count} {risk}
            </span>
          ))}
          <span style={{ background: 'rgba(5, 150, 105, 0.2)', color: '#6EE7B7', padding: '0.2rem 0.7rem', borderRadius: '50px', fontSize: '0.75rem', fontWeight: 600, border: '1px solid rgba(5, 150, 105, 0.4)' }}>
            {filteredSafeZones.length} SAFE ZONES
          </span>
        </div>
      </div>

      {/* Map */}
      <div className="map-container">
        <MapContainer
          center={mapCenter}
          zoom={mapZoom}
          style={{ height: '100%', width: '100%' }}
          zoomControl={false}
        >
          <MapController center={mapCenter} zoom={mapZoom} />
          <LiveWeatherBoundsController weatherCache={weatherCache} setWeatherCache={setWeatherCache} />
          <ZoomControl position="topright" />

          <LayersControl position="topright">
            <LayersControl.BaseLayer checked name="🇮🇳 Bhuvan Vector (ISRO)">
              <WMSTileLayer
                url="https://bhuvan-vec1.nrsc.gov.in/bhuvan/gwc/service/wms/"
                layers="india3"
                format="image/jpeg"
                transparent={false}
                attribution='&copy; ISRO Bhuvan'
              />
            </LayersControl.BaseLayer>
            <LayersControl.BaseLayer name="🗺️ Esri Street Map">
              <TileLayer
                url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}"
                attribution='&copy; Esri, HERE, Garmin'
              />
            </LayersControl.BaseLayer>
            <LayersControl.BaseLayer name="🛰️ Bhuvan Satellite (ISRO)">
              <TileLayer
                url="https://bhuvan-vec2.nrsc.gov.in/bhuvan/tms/1.0.0/bhuvan_imagery@EPSG:900913@jpg/{z}/{x}/{y}.jpg"
                attribution='&copy; ISRO Bhuvan'
                tms={true}
              />
            </LayersControl.BaseLayer>
            <LayersControl.BaseLayer name="🛰️ Bhuvan Hybrid (ISRO)">
              <TileLayer
                url="https://bhuvan-vec2.nrsc.gov.in/bhuvan/tms/1.0.0/bhuvan_hybrid@EPSG:900913@png/{z}/{x}/{y}.png"
                attribution='&copy; ISRO Bhuvan'
                tms={true}
              />
            </LayersControl.BaseLayer>
            <LayersControl.BaseLayer name="⛰️ Terrain">
              <TileLayer
                url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"
                attribution='&copy; OpenTopoMap contributors'
              />
            </LayersControl.BaseLayer>

          </LayersControl>
          
          {userLocation && (
            <Marker position={userLocation} icon={myLocationIcon}>
              <Popup>Your Location</Popup>
            </Marker>
          )}

          {filtered.map(h => {
             const isSelected = selectedHotspot?.id === h.id;
             const liveData = weatherCache[h.id];
             const currentRiskColor = riskColors[liveData ? liveData.risk : h.risk];
             return (
            <Marker
              key={h.id}
              position={[h.lat, h.lng]}
              icon={getRiskPolygonIcon(currentRiskColor, isSelected)}
              eventHandlers={{ click: () => setSelectedHotspot(h) }}
            >
              <Popup>
                <div className="popup-title">{h.name}</div>
                <div style={{ marginBottom: '0.5rem' }}>
                  <span className="risk-badge" style={{ background: currentRiskColor }}>
                    ● {(liveData ? liveData.risk : h.risk).toUpperCase()} {liveData && '(LIVE)'}
                  </span>
                  <span style={{ marginLeft: '0.5rem', fontSize: '0.78rem', color: '#94A3B8' }}>{typeLabels[h.type]}</span>
                </div>
                {liveData && (
                  <div style={{ background: 'var(--bg-card)', padding: '0.4rem', borderRadius: '4px', marginBottom: '0.4rem', fontSize: '0.75rem' }}>
                    <strong>PMRS:</strong> {liveData.pmrs}/100<br/>
                    <strong>Flood Prob:</strong> {liveData.prob}%<br/>
                    <strong>Rain:</strong> {liveData.rain}mm
                  </div>
                )}
                <div className="popup-desc">{h.description}</div>
                <div style={{ marginTop: '0.4rem', fontSize: '0.75rem', color: '#64748B' }}>📍 {h.district} District</div>
              </Popup>
            </Marker>
            );
          })}
          

          
          {filteredSafeZones.map(z => (
            <CircleMarker
              key={`safe-${z.id}`}
              center={[z.lat, z.lng]}
              radius={9}
              pathOptions={{
                fillColor: '#10B981', // Emerald green
                color: '#34D399',
                weight: 2,
                opacity: 1,
                fillOpacity: 0.9,
              }}
            >
              <Popup>
                <div className="popup-title" style={{ color: '#34D399' }}>✅ {z.name}</div>
                <div style={{ marginBottom: '0.5rem' }}>
                  <span className="risk-badge" style={{ background: 'rgba(5, 150, 105, 0.2)', color: '#6EE7B7' }}>ELEVATED SAFE ZONE</span>
                </div>
                <div className="popup-desc">{z.description}</div>
                <div style={{ marginTop: '0.4rem', fontSize: '0.75rem', color: '#64748B' }}>📍 {z.district} District</div>
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>
      </div>

      {/* Legend */}
      <div className="map-legend">
        <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', width: '100%' }}>LEGEND</div>
        {Object.entries(riskColors).map(([risk, color]) => (
          <div key={risk} className="legend-item">
            <div className="legend-dot" style={{ background: color }}></div>
            <span style={{ textTransform: 'capitalize' }}>{risk}</span>
          </div>
        ))}
        <div className="legend-item" style={{ marginLeft: '0.5rem' }}>
          <div className="legend-dot" style={{ background: '#10B981', border: '2px solid #34D399' }}></div>
          <span style={{ textTransform: 'capitalize', color: '#34D399', fontWeight: 600 }}>Safe Zone</span>
        </div>
        <div style={{ width: 1, background: 'var(--border)', margin: '0 0.5rem' }}></div>
        {Object.entries(typeLabels).slice(0, 4).map(([k, v]) => (
          <div key={k} className="legend-item"><span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{v}</span></div>
        ))}
      </div>
    </div>
  );
}
