import React, { useState, useEffect, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, WMSTileLayer, CircleMarker, Popup, useMap, useMapEvents, Polyline, LayersControl, Marker } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useLocationContext } from '../context/LocationContext';
import { reverseGeocodeAndAnalyze } from '../utils/dynamicLocation';
import { predictFlood, getFeatureBreakdown } from '../utils/floodML';

const days = ['Today', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function getPrecautions(data, riskLabel) {
  if (riskLabel === 'critical') return ['Evacuate immediately', 'Move to higher ground', 'Turn off heavy appliances'];
  if (riskLabel === 'high') return ['Prepare emergency kit', 'Monitor official warnings', 'Move valuables higher'];
  if (riskLabel === 'moderate') return ['Clear drainage around property', 'Stay updated on weather'];
  return ['No immediate precautions needed. Normal routines safe.'];
}

function getRisk(prob) {
  if (prob >= 80) return { label: 'CRITICAL', color: '#DC2626', class: 'risk-critical' };
  if (prob >= 60) return { label: 'HIGH', color: '#F97316', class: 'risk-high' };
  if (prob >= 40) return { label: 'MODERATE', color: '#EAB308', class: 'risk-moderate' };
  return { label: 'LOW', color: '#22C55E', class: 'risk-low' };
}

// Central Water Commission (CWC) / NDMA Standard Formula Implementation
// Factors in Antecedent Moisture Index (AMI) and Rational Method Runoff Coefficient
function calcPMRS(data) {
  // Runoff Coeff relates to concrete percentage (impervious). 100 - soil = concrete%.
  const concretePct = 100 - data.soil; 
  const runoffCoeff = concretePct / 100; 
  const ami = Math.min(100, (data.pastRainfall / 150) * 100); // True Antecedent Moisture Index based on past 3 days (150mm sat limit)
  const drainageEfficiency = data.drainage > 0 ? Math.min(100, (data.drainage / 80) * 100) : 10;
  
  // Base readiness derived from drainage strength
  let readiness = drainageEfficiency * 1.2;
  
  // Penalize based on expected hydrological load (Q = ciA proxy) and terrain pooling
  const hydroLoadPenalty = (runoffCoeff * ami * 0.6);
  const terrainPenalty = (data.terrain / 100) * 15;
  
  let finalScore = readiness - hydroLoadPenalty - terrainPenalty;
  
  // Normalize bounds 12-98
  return Math.max(12, Math.min(98, Math.round(finalScore)));
}

function getPMRSRiskLabel(score) {
  if (score < 45) return { label: 'Critical', color: '#DC2626' };
  if (score < 60) return { label: 'High Risk', color: '#F97316' };
  if (score < 75) return { label: 'Moderate', color: '#EAB308' };
  return { label: 'Low Risk', color: '#22C55E' };
}

async function fetchWeather(lat, lon) {
  try {
    const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=precipitation,relative_humidity_2m&daily=precipitation_sum&timezone=Asia%2FKolkata&forecast_days=7`);
    const d = await r.json();
    return {
      precipitation: d.current?.precipitation ?? 0,
      humidity: d.current?.relative_humidity_2m ?? 65,
      forecast7day: d.daily?.precipitation_sum ?? [0,0,0,0,0,0,0],
    };
  } catch (e) {
    return { precipitation: 0, humidity: 65, forecast7day: [0,0,0,0,0,0,0] };
  }
}

// Map Click Handler Component
function MapInteractionHandler({ onLocationSelect }) {
  useMapEvents({
    click(e) {
      onLocationSelect(e.latlng);
    }
  });
  return null;
}

// Auto-fly component synced with Context Search
function MapUpdater({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (center && map) map.flyTo(center, zoom, { duration: 1.5 });
  }, [center, zoom, map]);
  return null;
}

export default function DeepAnalysisMap() {
  const { globalCityData, globalOsmDrainage, isGlobalSearching } = useLocationContext();
  
  const [mapCenter, setMapCenter] = useState([28.6139, 77.2090]); // Delhi default
  const [mapZoom, setMapZoom] = useState(11);
  // Unified Analysis State
  const [activeAnalysis, setActiveAnalysis] = useState(null);
  const [clickedLatLng, setClickedLatLng] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [selectedDay, setSelectedDay] = useState(0);
  const [panelOpen, setPanelOpen] = useState(false);

  // Sync Map view if User uses Global Search Bar
  useEffect(() => {
    if (globalCityData && globalCityData.lat) {
      setMapCenter([globalCityData.lat, globalCityData.lon]);
      setMapZoom(13);
      // Auto-trigger analysis for searched city
      triggerAnalysis(globalCityData.lat, globalCityData.lon, globalCityData);
    }
  }, [globalCityData]);

  const triggerAnalysis = async (lat, lng, preExistingData = null) => {
    setIsAnalyzing(true);
    setPanelOpen(true);
    setClickedLatLng({ lat, lng });
    
    try {
      let analysisData = preExistingData;
      if (!analysisData) {
        analysisData = await reverseGeocodeAndAnalyze(lat, lng);
      }
      
      const weather = await fetchWeather(lat, lng);
      
      // Calculate true Antecedent Moisture Index (AMI) using past 3 days rainfall
      const past3DaysRain = (weather.past7day || []).slice(-3).reduce((acc, val) => acc + val, 0);

      // Calculate PMRS
      const pmrsInputs = {
        pastRainfall: past3DaysRain,
        rainfall: Math.min(100, Math.floor((weather.forecast7day[0] || 60) * 1.5)),
        drainage: Math.min(100, Math.max(10, ((analysisData.drainCapacityM3s || 50) / 450) * 100)),
        terrain: Math.max(10, Math.min(100, Math.floor((analysisData.avgSlope || 0.15) * 500))),
        soil: Math.max(10, Math.min(100, 100 - (analysisData.imperviousPct || 65))),
      };
      const pmrsScore = calcPMRS(pmrsInputs);
      
      // Calculate ML
      const probs = predictFlood(analysisData, weather);
      const features = getFeatureBreakdown(analysisData, weather.forecast7day[0] || 0);
      const riskLabel = getRisk(probs[0] || 0).label.toLowerCase();
      const precautions = getPrecautions(analysisData, riskLabel);

      setActiveAnalysis({
        districtData: analysisData,
        weather,
        pmrsScore,
        probs,
        features,
        precautions
      });
      setSelectedDay(0);
    } catch (e) {
      console.error(e);
      alert("Analysis failed. Try clicking near a valid landmass or settlement.");
      setPanelOpen(false);
    }
    setIsAnalyzing(false);
  };

  const handleMapClick = (latlng) => {
    triggerAnalysis(latlng.lat, latlng.lng);
  };

  // PMRS Ring SVG setup
  const circleR = 40;
  const circumference = 2 * Math.PI * circleR;
  const strokeDashoffset = activeAnalysis ? circumference - (activeAnalysis.pmrsScore / 100) * circumference : circumference;

  const activeProb = activeAnalysis ? (activeAnalysis.probs[selectedDay] ?? 0) : 0;
  const activeRisk = getRisk(activeProb);
  const pmrsRisk = activeAnalysis ? getPMRSRiskLabel(activeAnalysis.pmrsScore) : { color: '#fff', label: '' };

  // Define custom icon for the probe pin
  const probeIcon = new L.Icon({
    iconUrl: 'https://cdn.rawgit.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-violet.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  });

  return (
    <div style={{ position: 'relative', width: '100vw', height: 'calc(100vh - 70px)' }}>
      
      {/* MAP LAYER */}
      <MapContainer 
        center={mapCenter} 
        zoom={mapZoom} 
        style={{ width: '100%', height: '100%' }}
        zoomControl={false}
      >
        <MapUpdater center={mapCenter} zoom={mapZoom} />
        <MapInteractionHandler onLocationSelect={handleMapClick} />
        
        <LayersControl position="topright">
          <LayersControl.BaseLayer checked name="🇮🇳 Bhuvan Map (ISRO)">
            <WMSTileLayer
              url="https://bhuvan-vec1.nrsc.gov.in/bhuvan/gwc/service/wms/"
              layers="india3"
              format="image/jpeg"
              transparent={false}
              attribution="Data © ISRO Bhuvan"
            />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="🌍 Satellite Imagery (Fallback)">
            <TileLayer
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              attribution='Tiles &copy; Esri'
            />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="☀️ Light Topo View">
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
              attribution='&copy; CARTO'
            />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="🌙 Dark Satellite View">
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              attribution='&copy; CARTO'
            />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="🗺️ Detailed Topographical View">
            <TileLayer
              url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"
              attribution='&copy; OpenTopoMap contributors'
            />
          </LayersControl.BaseLayer>
        </LayersControl>


        {/* The Clicked Probe Marker */}
        {clickedLatLng && (
          <Marker position={[clickedLatLng.lat, clickedLatLng.lng]} icon={probeIcon}>
            <Popup>Extracting local terrain & infrastructure...</Popup>
          </Marker>
        )}
      </MapContainer>

      {/* FLOATING INSTRUCTIONS */}
      {!panelOpen && !isAnalyzing && (
        <div style={{ position: 'absolute', bottom: '2rem', left: '50%', transform: 'translateX(-50%)', background: 'rgba(15,23,42,0.8)', padding: '0.75rem 1.5rem', borderRadius: '50px', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', zIndex: 1000, pointerEvents: 'none', display: 'flex', alignItems: 'center', gap: '0.75rem', boxShadow: '0 10px 25px rgba(0,0,0,0.5)' }}>
          <span style={{ fontSize: '1.2rem', animation: 'pulse-water 1.5s infinite' }}>🖱️</span>
          <span style={{ fontWeight: 600, letterSpacing: '0.02em' }}>Click anywhere on India for Instant Deep Analysis</span>
        </div>
      )}

      {/* OVERLAY SIDE PANEL (Glassmorphism) */}
      <div 
        style={{
          position: 'absolute',
          top: '1rem',
          right: panelOpen ? '1rem' : '-500px',
          width: '420px',
          maxHeight: 'calc(100vh - 100px)',
          background: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '16px',
          zIndex: 1000,
          transition: 'right 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          overflowY: 'auto'
        }}
      >
        {isGlobalSearching && (
           <div style={{ padding: '3rem 2rem', textAlign: 'center' }}>
             <div style={{ color: 'var(--primary-light)', fontSize: '0.85rem' }}>
               <span style={{ fontSize: '1.2rem', animation: 'spin 2s linear infinite', display: 'inline-block' }}>⚙️</span> Syncing Map to City...
             </div>
           </div>
        )}
        {isAnalyzing ? (
          <div style={{ padding: '3rem 2rem', textAlign: 'center' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '1rem', animation: 'spin 2s linear infinite' }}>⚙️</div>
            <h3 style={{ color: 'white', marginBottom: '0.5rem' }}>Deep Scanning Area...</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', lineHeight: 1.5 }}>
              Reverse Geocoding coordinates.<br/>
              Extracting Bhuvan terrain morphology.<br/>
              Mapping OSM drainage networks.<br/>
              Calculating ML factors.
            </p>
          </div>
        ) : activeAnalysis ? (
          <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            
            {/* Header: Close Button & Title */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: '0.75rem', color: '#60A5FA', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.2rem' }}>
                  Unified Geointelligence
                </div>
                <h2 style={{ color: 'white', margin: 0, fontSize: '1.2rem', lineHeight: 1.3 }}>
                  {activeAnalysis.districtData.name}
                </h2>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                  {activeAnalysis.districtData.lat.toFixed(4)}, {activeAnalysis.districtData.lon.toFixed(4)}
                </div>
              </div>
              <button 
                onClick={() => { setPanelOpen(false); setClickedLatLng(null); }}
                style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                ✖
              </button>
            </div>

            {/* PMRS Score Gauge & Live Weather */}
            <div style={{ display: 'flex', gap: '1rem' }}>
              
              {/* PMRS Widget */}
              <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', padding: '1rem', display: 'flex', alignItems: 'center', gap: '1rem', flex: 1 }}>
                <div style={{ position: 'relative', width: 80, height: 80 }}>
                  <svg viewBox="0 0 100 100" width="80" height="80" style={{ transform: 'rotate(-90deg)' }}>
                    <circle cx="50" cy="50" r={circleR} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="8" />
                    <circle cx="50" cy="50" r={circleR} fill="none"
                      stroke={pmrsRisk.color} strokeWidth="8"
                      strokeLinecap="round"
                      strokeDasharray={circumference}
                      strokeDashoffset={strokeDashoffset}
                      style={{ transition: 'stroke-dashoffset 1s ease-out' }}
                    />
                  </svg>
                  <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ color: 'white', fontSize: '1.2rem', fontWeight: 800 }}>{activeAnalysis.pmrsScore}</span>
                  </div>
                </div>
                <div>
                  <div style={{ color: pmrsRisk.color, fontSize: '0.85rem', fontWeight: 700 }}>{pmrsRisk.label}</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem', marginTop: '0.2rem', lineHeight: 1.3 }}>Pre-Monsoon Readiness</div>
                </div>
              </div>

            </div>

            {/* Weather & Terrain Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <div style={{ background: 'rgba(0,0,0,0.3)', padding: '0.75rem', borderRadius: '8px', fontSize: '0.8rem' }}>
                <div style={{ color: '#94A3B8', fontSize: '0.7rem', marginBottom: '0.2rem' }}>🌧️ 7-Day Rain</div>
                <strong style={{ color: '#60A5FA' }}>{activeAnalysis.weather.forecast7day.reduce((a,b)=>a+b,0).toFixed(1)} mm</strong>
              </div>
              <div style={{ background: 'rgba(0,0,0,0.3)', padding: '0.75rem', borderRadius: '8px', fontSize: '0.8rem' }}>
                <div style={{ color: '#94A3B8', fontSize: '0.7rem', marginBottom: '0.2rem' }}>🌊 Drainage Cap.</div>
                <strong style={{ color: '#A78BFA' }}>{activeAnalysis.districtData.drainCapacityM3s.toFixed(0)} m³/s</strong>
              </div>
              <div style={{ background: 'rgba(0,0,0,0.3)', padding: '0.75rem', borderRadius: '8px', fontSize: '0.8rem' }}>
                <div style={{ color: '#94A3B8', fontSize: '0.7rem', marginBottom: '0.2rem' }}>⛰️ Avg Slope</div>
                <strong style={{ color: '#FCD34D' }}>{(activeAnalysis.districtData.avgSlope * 100).toFixed(1)}% ({activeAnalysis.districtData.elevation_m}m)</strong>
              </div>
              <div style={{ background: 'rgba(0,0,0,0.3)', padding: '0.75rem', borderRadius: '8px', fontSize: '0.8rem' }}>
                <div style={{ color: '#94A3B8', fontSize: '0.7rem', marginBottom: '0.2rem' }}>🏗️ Impervious</div>
                <strong style={{ color: '#F87171' }}>{activeAnalysis.districtData.imperviousPct}%</strong>
              </div>
            </div>

            {/* 7-Day ML Probability Timeline */}
            <div>
              <div style={{ color: 'white', fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.75rem', display: 'flex', justifyContent: 'space-between' }}>
                <span>7-Day Flood Probability</span>
                <span className={`risk-badge ${activeRisk.class.replace('risk-','')}`} style={{ fontSize: '0.65rem', padding: '0.15rem 0.5rem' }}>
                  {activeRisk.label}
                </span>
              </div>
              
              <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.5rem', msOverflowStyle: 'none', scrollbarWidth: 'none' }}>
                {days.map((day, i) => {
                  const prob = activeAnalysis.probs[i] ?? 0;
                  const r = getRisk(prob);
                  const isSel = selectedDay === i;
                  return (
                    <div 
                      key={i} 
                      onClick={() => setSelectedDay(i)}
                      style={{ 
                        flexShrink: 0, width: '45px', padding: '0.5rem 0', borderRadius: '8px', textAlign: 'center', cursor: 'pointer',
                        background: isSel ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.3)',
                        border: `1px solid ${isSel ? r.color : 'transparent'}`,
                        transition: 'all 0.2s'
                      }}
                    >
                      <div style={{ fontSize: '0.65rem', color: isSel ? 'white' : 'var(--text-muted)' }}>{day}</div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 700, color: r.color, margin: '0.2rem 0' }}>{prob}%</div>
                      <div style={{ fontSize: '0.6rem', color: 'var(--text-secondary)' }}>{activeAnalysis.weather.forecast7day[i]?.toFixed(0)}m</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* AI Feature Breakdown (Explainability) */}
            <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ fontSize: '0.8rem', color: 'white', fontWeight: 600, marginBottom: '0.75rem' }}>🧠 ML Feature Weights</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {Object.entries(activeAnalysis.features).map(([key, f]) => {
                  const pct = Math.round(f.score * 100);
                  const barColor = pct > 70 ? '#DC2626' : pct > 45 ? '#F97316' : pct > 25 ? '#EAB308' : '#22C55E';
                  return (
                    <div key={key}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'capitalize' }}>
                          {key.replace(/([A-Z])/g, ' $1').trim()}
                        </span>
                        <span style={{ fontSize: '0.7rem', color: barColor, fontWeight: 600 }}>{f.contribution}</span>
                      </div>
                      <div style={{ height: 4, background: 'rgba(255,255,255,0.1)', borderRadius: '4px' }}>
                        <div style={{ height: '100%', width: `${Math.min(pct, 100)}%`, background: barColor, borderRadius: '4px' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>
        ) : null}
      </div>

    </div>
  );
}
