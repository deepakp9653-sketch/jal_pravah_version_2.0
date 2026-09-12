import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { hotspots, riskColors, safeZones } from '../data/hotspots';
import { DELHI_DISTRICTS_POLYGONS } from '../data/delhiDistrictPolygons';

const CESIUM_ION_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI0ZDFmNmMwYy1jNjE3LTRhNDQtYWQyZS0wZmU4MjM0MGM5NzUiLCJpZCI6NDA4NDM0LCJpYXQiOjE3NzQzNjI5ODR9.u1eKLDbrzUMi4gBgbw_hM8QAShsyAV5nsw5c0WMaMhg';

const RISK_HEIGHTS = { critical: 2000, high: 1400, moderate: 900, low: 500 };

const typeLabels = {
  embankment: '🏗️ Embankment',
  flood_2023: '🌊 Flood 2023',
  flood_1978: '📜 Flood 1978',
  waterlogging: '💧 Waterlogging',
  pumping_station: '⚙️ Pumping Station',
  regulator: '🚰 Regulator',
  village: '🏘️ Village',
};

export default function FloodMap3D() {
  const cesiumContainerRef = useRef(null);
  const viewerRef = useRef(null);
  const [selected, setSelected] = useState(null);
  const [activeFilters, setActiveFilters] = useState({ risk: 'all', type: 'all' });
  const [terrainEnabled, setTerrainEnabled] = useState(true);
  const [buildingsEnabled, setBuildingsEnabled] = useState(true);
  const [exaggeration, setExaggeration] = useState(1.5); // Default slight exaggeration
  const [isLoading, setIsLoading] = useState(true);
  const [cameraInfo, setCameraInfo] = useState({ lat: 20.59, lng: 78.96, alt: 0, heading: 0 });
  
  // Flood Simulation State
  const [simulationActive, setSimulationActive] = useState(false);
  const [rainfallMM, setRainfallMM] = useState(0); // Rainfall input
  const waterEntityRef = useRef(null);
  const tilesetRef = useRef(null);
  
  const entitiesRef = useRef([]);

  const filtered = useMemo(() => {
    return hotspots.filter(h => {
      if (activeFilters.risk !== 'all' && h.risk !== activeFilters.risk) return false;
      if (activeFilters.type !== 'all' && h.type !== activeFilters.type) return false;
      return true;
    });
  }, [activeFilters]);

  const counts = useMemo(() => {
    const c = { critical: 0, high: 0, moderate: 0, low: 0 };
    filtered.forEach(h => { if (c[h.risk] !== undefined) c[h.risk]++; });
    return c;
  }, [filtered]);

  // Initialize CesiumJS viewer
  useEffect(() => {
    let checkTimer;
    let isMounted = true;

    function initCesium() {
      if (!cesiumContainerRef.current || viewerRef.current || !isMounted) return;

      const Cesium = window.Cesium;
      if (!Cesium) {
        // Cesium CDN script still loading, retry shortly
        checkTimer = setTimeout(initCesium, 250);
        return;
      }

      try {
        Cesium.Ion.defaultAccessToken = CESIUM_ION_TOKEN;

        let terrainProvider;
        try {
          terrainProvider = Cesium.Terrain.fromWorldTerrain();
        } catch (_) {
          terrainProvider = undefined;
        }

        const viewer = new Cesium.Viewer(cesiumContainerRef.current, {
          terrain: terrainProvider,
          baseLayer: new Cesium.ImageryLayer(new Cesium.UrlTemplateImageryProvider({
            url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
            credit: 'Esri World Imagery'
          })),
          baseLayerPicker: false,
          geocoder: false,
          homeButton: false,
          sceneModePicker: false,
          navigationHelpButton: false,
          animation: false,
          timeline: false,
          fullscreenButton: false,
          selectionIndicator: true,
          infoBox: false,
          creditContainer: document.createElement('div'), // hide credits
          msaaSamples: 4,
          shadows: false, // Ensure shadows don't darken the view
          shouldAnimate: true,
        });

        viewerRef.current = viewer;

        // Apply vertical exaggeration
        viewer.scene.verticalExaggeration = 1.5;

        // Disable solar lighting to prevent pitch-black night views
        viewer.scene.globe.enableLighting = false;
        viewer.scene.globe.depthTestAgainstTerrain = true;
        viewer.scene.fog.enabled = true;
        viewer.scene.fog.density = 0.0001;

        // Sky atmosphere
        if (viewer.scene.skyAtmosphere) {
          viewer.scene.skyAtmosphere.hueShift = 0.0;
          viewer.scene.skyAtmosphere.saturationShift = 0.0;
          viewer.scene.skyAtmosphere.brightnessShift = 0.0;
        }

        // Add Google 3D Tiles or fallback to OSM buildings
        add3DTiles(viewer);

        // Fly to India / Delhi region
        viewer.camera.flyTo({
          destination: Cesium.Cartesian3.fromDegrees(77.2090, 28.6139, 45000),
          orientation: {
            heading: Cesium.Math.toRadians(-20),
            pitch: Cesium.Math.toRadians(-45),
            roll: 0,
          },
          duration: 2,
          complete: () => {
            if (isMounted) setIsLoading(false);
          },
        });

        // Track camera position
        viewer.camera.changed.addEventListener(() => {
          if (!viewer.camera) return;
          const cartographic = viewer.camera.positionCartographic;
          if (cartographic && isMounted) {
            setCameraInfo({
              lat: Cesium.Math.toDegrees(cartographic.latitude),
              lng: Cesium.Math.toDegrees(cartographic.longitude),
              alt: (cartographic.height / 1000).toFixed(1),
              heading: Cesium.Math.toDegrees(viewer.camera.heading).toFixed(0),
            });
          }
        });

        // Click handler
        const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
        handler.setInputAction((click) => {
          if (!viewer || viewer.isDestroyed()) return;
          const picked = viewer.scene.pick(click.position);
          if (Cesium.defined(picked) && picked.id && picked.id._hotspotData) {
            setSelected(picked.id._hotspotData);
          } else {
            setSelected(null);
          }
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

        // Store handler for cleanup
        viewer._clickHandler = handler;
      } catch (err) {
        console.error('Failed to initialize Cesium 3D viewer:', err);
        if (isMounted) setIsLoading(false);
      }
    }

    initCesium();

    return () => {
      isMounted = false;
      if (checkTimer) clearTimeout(checkTimer);
      if (viewerRef.current && !viewerRef.current.isDestroyed()) {
        if (viewerRef.current._clickHandler) {
          viewerRef.current._clickHandler.destroy();
        }
        viewerRef.current.destroy();
      }
      viewerRef.current = null;
    };
  }, []);

  // Add 3D Tiles (Google Photorealistic or OSM Buildings fallback)
  async function add3DTiles(viewer) {
    const Cesium = window.Cesium;
    if (!Cesium || !viewer || viewer.isDestroyed()) return;

    try {
      if (typeof Cesium.createGooglePhotorealistic3DTileset === 'function') {
        const tileset = await Cesium.createGooglePhotorealistic3DTileset();
        if (viewer && !viewer.isDestroyed() && viewer.scene && viewer.scene.primitives) {
          viewer.scene.primitives.add(tileset);
          tilesetRef.current = tileset;
          viewer.scene.globe.show = true;
          return;
        }
      }
    } catch (e) {
      console.warn('Google 3D Tiles not accessible on this token. Loading OSM 3D Buildings fallback...', e);
    }

    // Fallback: OpenStreetMap 3D Buildings
    try {
      if (typeof Cesium.createOsmBuildingsAsync === 'function') {
        const osmTileset = await Cesium.createOsmBuildingsAsync();
        if (viewer && !viewer.isDestroyed() && viewer.scene && viewer.scene.primitives) {
          viewer.scene.primitives.add(osmTileset);
          tilesetRef.current = osmTileset;
        }
      }
    } catch (osmErr) {
      console.warn('OSM Buildings also unavailable; continuing with base satellite imagery and terrain.', osmErr);
    }
  }

  // Toggle 3D Buildings overlay
  useEffect(() => {
    if (tilesetRef.current) {
      tilesetRef.current.show = buildingsEnabled;
    }
  }, [buildingsEnabled]);

  // Toggle terrain
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;
    const Cesium = window.Cesium;
    if (!Cesium) return;
    try {
      if (terrainEnabled) {
        viewer.scene.setTerrain(Cesium.Terrain.fromWorldTerrain());
      } else {
        viewer.scene.setTerrain(new Cesium.Terrain(Cesium.EllipsoidTerrainProvider.fromUrl));
      }
    } catch (_) {}
  }, [terrainEnabled]);

  // Apply terrain exaggeration
  useEffect(() => {
    if (viewerRef.current && !viewerRef.current.isDestroyed()) {
      viewerRef.current.scene.verticalExaggeration = exaggeration;
    }
  }, [exaggeration]);

  // Add hotspot entities when filters change
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;

    // Remove old entities
    entitiesRef.current.forEach(e => {
      try { viewer.entities.remove(e); } catch (_) {}
    });
    entitiesRef.current = [];

    const Cesium = window.Cesium;
    if (!Cesium) return;

    // Create PinBuilder for elegant map pointers
    const pinBuilder = new Cesium.PinBuilder();

    const hexColors = {
      critical: '#DC2626',
      high: '#F97316',
      moderate: '#EAB308',
      low: '#22C55E',
    };

    // Hotspot pointers
    filtered.forEach(h => {
      const hex = hexColors[h.risk] || '#9CA3AF';
      const pinColor = Cesium.Color.fromCssColorString(hex).withAlpha(0.85);
      const size = h.risk === 'critical' ? 56 : h.risk === 'high' ? 48 : h.risk === 'moderate' ? 40 : 36;
      
      const canvas = pinBuilder.fromColor(pinColor, size);

      const entity = viewer.entities.add({
        position: Cesium.Cartesian3.fromDegrees(h.lng, h.lat),
        billboard: {
          image: canvas,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
          scaleByDistance: new Cesium.NearFarScalar(1.5e2, 1.2, 8.0e6, 0.4),
        },
        label: {
          text: h.name,
          font: '12px Inter, sans-serif',
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          outlineWidth: 2,
          outlineColor: Cesium.Color.BLACK,
          fillColor: Cesium.Color.WHITE,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          pixelOffset: new Cesium.Cartesian2(0, -size - 5),
          distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 150000),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
        },
      });
      entity._hotspotData = h;
      entitiesRef.current.push(entity);
    });

    // Safe zones pointers - SAFE_CESIUM_COLOR defined properly
    const SAFE_CESIUM_COLOR = Cesium.Color.fromCssColorString('#10B981');
    safeZones.forEach(z => {
      const size = 44;
      const canvas = pinBuilder.fromText('✓', SAFE_CESIUM_COLOR, size);
      
      const entity = viewer.entities.add({
        position: Cesium.Cartesian3.fromDegrees(z.lng, z.lat),
        billboard: {
          image: canvas,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
          scaleByDistance: new Cesium.NearFarScalar(1.5e2, 1.0, 8.0e6, 0.3),
        },
        label: {
          text: '✅ ' + z.name,
          font: '11px Inter, sans-serif',
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          outlineWidth: 2,
          outlineColor: Cesium.Color.BLACK,
          fillColor: Cesium.Color.fromCssColorString('#34D399'),
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          pixelOffset: new Cesium.Cartesian2(0, -size - 5),
          distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 100000),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
        },
      });
      entity._hotspotData = { ...z, isSafe: true };
      entitiesRef.current.push(entity);
    });

  }, [filtered]);

  // Toggle marker visibility when simulating
  useEffect(() => {
    if (entitiesRef.current) {
      entitiesRef.current.forEach(entity => {
        if (entity.billboard || entity.label) {
          entity.show = !simulationActive;
        }
      });
    }
  }, [simulationActive]);

  // Flood Simulation Logic — Ward-wise Intelligence
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    if (simulationActive) {
      if (!waterEntityRef.current || waterEntityRef.current.length === 0) {
        waterEntityRef.current = [];
        
        DELHI_DISTRICTS_POLYGONS.forEach(zone => {
          const entity = viewer.entities.add({
            name: zone.name,
            polygon: {
              hierarchy: Cesium.Cartesian3.fromDegreesArray(zone.coords),
              height: zone.baseHeight,
              extrudedHeight: new Cesium.CallbackProperty(() => {
                const rain = (window._currentRainfallMM || 0);
                // Math: Every 50mm of rain adds roughly 1m of visible height 
                // scaled slightly by area for visual effect
                return zone.baseHeight + (rain * 0.02 * zone.areaScale);
              }, false),
              material: new Cesium.ColorMaterialProperty(
                new Cesium.CallbackProperty(() => {
                  const rain = window._currentRainfallMM || 0;
                  
                  // AI Predictor Load Calculation
                  // Load = (Rainfall * Scale Factor) / FCO Capacity
                  const loadFactor = (rain * 15 * zone.areaScale) / zone.fcoCapacity;
                  
                  // AI Predictor Intensity Colors
                  let colorHex = '#10B981'; // Green (Capacity > Load - Safe)
                  if (loadFactor >= 2.0) {
                     // Red (Critical - Load drastically exceeds capacity)
                    colorHex = '#EF4444'; 
                  } else if (loadFactor >= 0.8) {
                     // Yellow (Moderate Risk - Capacity stretched)
                    colorHex = '#F59E0B'; 
                  }
                  
                  const alpha = Math.min(0.75, 0.4 + (loadFactor * 0.15));
                  return Cesium.Color.fromCssColorString(colorHex).withAlpha(alpha);
                }, false)
              ),
              outline: true,
              outlineColor: Cesium.Color.fromCssColorString('#ffffff').withAlpha(0.6),
            }
          });
          waterEntityRef.current.push(entity);
        });

        // Fly to simulation view over entire Delhi
        viewer.camera.flyTo({
          destination: Cesium.Cartesian3.fromDegrees(77.100, 28.520, 35000),
          orientation: {
            heading: Cesium.Math.toRadians(15),
            pitch: Cesium.Math.toRadians(-55),
            roll: 0
          },
          duration: 2
        });
      }

      // Update global rainfall for CallbackProperty
      window._currentRainfallMM = rainfallMM;

    } else {
      // Remove flood polygons
      if (waterEntityRef.current && waterEntityRef.current.length > 0) {
        waterEntityRef.current.forEach(entity => {
          viewer.entities.remove(entity);
        });
        waterEntityRef.current = [];
      }
      window._currentRainfallMM = 0;
      setRainfallMM(0);
    }

    return () => {};
  }, [simulationActive, rainfallMM]);

  // Camera actions
  const flyToIndia = useCallback(() => {
    viewerRef.current?.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(78.9629, 20.5937, 4000000),
      orientation: { heading: Cesium.Math.toRadians(-15), pitch: Cesium.Math.toRadians(-45), roll: 0 },
      duration: 2,
    });
  }, []);

  const flyToDelhi = useCallback(() => {
    viewerRef.current?.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(77.2090, 28.6139, 50000),
      orientation: { heading: Cesium.Math.toRadians(-20), pitch: Cesium.Math.toRadians(-35), roll: 0 },
      duration: 2,
    });
  }, []);

  const locateUser = useCallback(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          viewerRef.current?.camera.flyTo({
            destination: Cesium.Cartesian3.fromDegrees(pos.coords.longitude, pos.coords.latitude, 5000),
            orientation: { heading: 0, pitch: Cesium.Math.toRadians(-50), roll: 0 },
            duration: 2,
          });
        },
        () => alert('Location access denied.')
      );
    }
  }, []);

  const flyToHotspot = useCallback((h) => {
    viewerRef.current?.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(h.lng, h.lat, 15000),
      orientation: { heading: Cesium.Math.toRadians(-25), pitch: Cesium.Math.toRadians(-40), roll: 0 },
      duration: 1.5,
    });
  }, []);

  // Dedicated street-level flood view
  const flyToStreetView = useCallback(() => {
    viewerRef.current?.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(77.243, 28.627, 215), // Low altitude near ITO Bridge
      orientation: { 
        heading: Cesium.Math.toRadians(100), // Facing East over the river
        pitch: Cesium.Math.toRadians(-5), // Looking slightly down/horizontally
        roll: 0 
      },
      duration: 2.5,
    });
  }, []);

  return (
    <div style={{ position: 'relative', width: '100%', height: 'calc(100vh - 80px)' }}>
      {/* Cesium Container */}
      <div ref={cesiumContainerRef} style={{ width: '100%', height: '100%' }} />

      {/* Loading overlay */}
      {isLoading && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 20,
          background: 'rgba(5,10,25,0.95)', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: '16px',
        }}>
          <div style={{ fontSize: '3rem', animation: 'spin 2s linear infinite' }}>🌍</div>
          <div style={{ color: '#93C5FD', fontWeight: 700, fontSize: '1.1rem' }}>Loading CesiumJS Globe...</div>
          <div style={{ color: '#64748B', fontSize: '0.82rem' }}>3D Terrain + Buildings + Flood Hotspots</div>
        </div>
      )}

      {/* ========== CONTROL PANEL ========== */}
      <div style={{
        position: 'absolute', top: 12, left: 12, zIndex: 10,
        display: 'flex', flexDirection: 'column', gap: '8px', maxWidth: 320,
      }}>
        {/* Title */}
        <div style={{
          background: 'rgba(10,15,30,0.92)', backdropFilter: 'blur(16px)',
          border: '1px solid rgba(96,165,250,0.3)', borderRadius: '14px', padding: '12px 16px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span style={{ fontSize: '1.2rem' }}>🌍</span>
            <span style={{ fontWeight: 800, fontSize: '1rem', background: 'linear-gradient(135deg, #60A5FA, #A78BFA)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              3D Flood Globe
            </span>
            <span style={{
              background: 'rgba(34,197,94,0.2)', border: '1px solid rgba(34,197,94,0.4)',
              color: '#6EE7B7', padding: '2px 8px', borderRadius: '50px', fontSize: '0.6rem', fontWeight: 600,
            }}>CesiumJS</span>
          </div>
          <div style={{ fontSize: '0.72rem', color: '#94A3B8', lineHeight: 1.4 }}>
            Photorealistic 3D globe with world terrain, OSM buildings, and flood hotspots. Scroll to zoom, left-drag to pan, middle/right-drag to tilt & rotate.
          </div>
        </div>

        {/* Filters */}
        <div style={{
          background: 'rgba(10,15,30,0.92)', backdropFilter: 'blur(16px)',
          border: '1px solid rgba(255,255,255,0.08)', borderRadius: '14px', padding: '10px 14px',
          display: 'flex', flexDirection: 'column', gap: '8px',
        }}>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            <select style={{ flex: 1, minWidth: 100, padding: '6px 10px', fontSize: '0.78rem', background: 'rgba(255,255,255,0.06)', color: '#e2e8f0', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '8px' }}
              onChange={e => setActiveFilters(f => ({ ...f, risk: e.target.value }))}>
              <option value="all">All Risks</option>
              <option value="critical">🔴 Critical</option>
              <option value="high">🟠 High</option>
              <option value="moderate">🟡 Moderate</option>
              <option value="low">🟢 Low</option>
            </select>
            <select style={{ flex: 1, minWidth: 100, padding: '6px 10px', fontSize: '0.78rem', background: 'rgba(255,255,255,0.06)', color: '#e2e8f0', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '8px' }}
              onChange={e => setActiveFilters(f => ({ ...f, type: e.target.value }))}>
              <option value="all">All Types</option>
              {Object.entries(typeLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>

          {/* View Mode Removed for Map Pointers */}

          {/* Height Exaggeration */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '2px', marginBottom: '4px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: '#94A3B8' }}>
              <span>⛰️ Map Height (Exaggeration):</span>
              <span style={{ fontWeight: 800, color: '#C4B5FD' }}>{exaggeration}x</span>
            </div>
            <input 
              type="range" 
              min="1" max="5" step="0.5" 
              value={exaggeration} 
              onChange={(e) => setExaggeration(Number(e.target.value))}
              style={{ width: '100%', accentColor: '#8b5cf6' }}
            />
          </div>

          {/* Toggles */}
          <div style={{ display: 'flex', gap: '6px' }}>
            <button onClick={() => setTerrainEnabled(!terrainEnabled)} style={{
              flex: 1, padding: '6px', fontSize: '0.72rem', fontWeight: 600,
              background: terrainEnabled ? 'rgba(139,92,246,0.25)' : 'rgba(255,255,255,0.04)',
              border: `1px solid ${terrainEnabled ? 'rgba(139,92,246,0.5)' : 'rgba(255,255,255,0.08)'}`,
              borderRadius: '8px', color: terrainEnabled ? '#C4B5FD' : '#94A3B8', cursor: 'pointer',
            }}>
              ⛰️ Terrain {terrainEnabled ? 'ON' : 'OFF'}
            </button>
            <button onClick={() => setBuildingsEnabled(!buildingsEnabled)} style={{
              flex: 1, padding: '6px', fontSize: '0.72rem', fontWeight: 600,
              background: buildingsEnabled ? 'rgba(59,130,246,0.25)' : 'rgba(255,255,255,0.04)',
              border: `1px solid ${buildingsEnabled ? 'rgba(59,130,246,0.5)' : 'rgba(255,255,255,0.08)'}`,
              borderRadius: '8px', color: buildingsEnabled ? '#93C5FD' : '#94A3B8', cursor: 'pointer',
            }}>
              🏢 Buildings {buildingsEnabled ? 'ON' : 'OFF'}
            </button>
          </div>

          {/* Fly-to Buttons */}
          <div style={{ display: 'flex', gap: '6px' }}>
            <button onClick={flyToIndia} style={{
              flex: 1, padding: '7px', fontSize: '0.73rem', fontWeight: 600,
              background: 'rgba(139,92,246,0.2)', border: '1px solid rgba(139,92,246,0.4)',
              borderRadius: '8px', color: '#C4B5FD', cursor: 'pointer',
            }}>🇮🇳 India</button>
            <button onClick={flyToDelhi} style={{
              flex: 1, padding: '7px', fontSize: '0.73rem', fontWeight: 600,
              background: 'rgba(220,38,38,0.2)', border: '1px solid rgba(220,38,38,0.4)',
              borderRadius: '8px', color: '#FCA5A5', cursor: 'pointer',
            }}>🏛️ Delhi</button>
            <button onClick={locateUser} style={{
              flex: 1, padding: '7px', fontSize: '0.73rem', fontWeight: 600,
              background: 'rgba(59,130,246,0.2)', border: '1px solid rgba(59,130,246,0.4)',
              borderRadius: '8px', color: '#93C5FD', cursor: 'pointer',
            }}>📍 Me</button>
          </div>

          {/* SIMULATION */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px' }}>
            <button onClick={() => setSimulationActive(!simulationActive)} style={{
              padding: '8px', fontSize: '0.75rem', fontWeight: 700,
              background: simulationActive ? 'rgba(220,38,38,0.25)' : 'rgba(59,130,246,0.25)',
              border: `1px solid ${simulationActive ? 'rgba(220,38,38,0.5)' : 'rgba(59,130,246,0.5)'}`,
              borderRadius: '8px', color: simulationActive ? '#FCA5A5' : '#93C5FD', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
            }}>
              {simulationActive ? '⏹️ Stop Flood Simulation' : '🌊 Start Flood Simulation (Delhi)'}
            </button>
            {simulationActive && (
              <div style={{ background: 'rgba(0,0,0,0.3)', padding: '10px', borderRadius: '6px', fontSize: '0.72rem', color: '#CBD5E1', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Simulated Rainfall:</span>
                  <span style={{ fontWeight: 800, color: '#93C5FD' }}>{rainfallMM} mm</span>
                </div>
                <input 
                  type="range" 
                  min="0" max="600" step="10" 
                  value={rainfallMM} 
                  onChange={(e) => setRainfallMM(Number(e.target.value))}
                  style={{ width: '100%', accentColor: '#3b82f6' }}
                />
                
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '8px' }}>
                  <span>Est. Water Level:</span>
                  {(() => {
                    const currentLevel = 202 + (rainfallMM * 0.015);
                    return (
                      <span style={{ fontWeight: 800, color: currentLevel >= 208.66 ? '#FCA5A5' : currentLevel >= 205.33 ? '#FDE047' : '#93C5FD' }}>
                        {currentLevel.toFixed(2)}m {currentLevel >= 208.66 ? '(Extreme)' : currentLevel >= 205.33 ? '(Danger)' : ''}
                      </span>
                    );
                  })()}
                </div>

                <button onClick={flyToStreetView} style={{
                  marginTop: '4px', padding: '6px', fontSize: '0.7rem', fontWeight: 700,
                  background: 'rgba(245,158,11,0.2)', border: '1px solid rgba(245,158,11,0.4)',
                  borderRadius: '6px', color: '#FCD34D', cursor: 'pointer',
                }}>👁️ View from Street Level</button>
              </div>
            )}
          </div>
        </div>

        {/* Stats */}
        <div style={{
          background: 'rgba(10,15,30,0.92)', backdropFilter: 'blur(16px)',
          border: '1px solid rgba(255,255,255,0.08)', borderRadius: '14px', padding: '10px 14px',
          display: 'flex', flexWrap: 'wrap', gap: '6px',
        }}>
          {Object.entries(counts).map(([risk, count]) => count > 0 && (
            <span key={risk} style={{
              background: `${riskColors[risk]}22`, color: riskColors[risk],
              padding: '3px 10px', borderRadius: '50px', fontSize: '0.72rem', fontWeight: 700,
              border: `1px solid ${riskColors[risk]}44`,
            }}>
              {count} {risk}
            </span>
          ))}
          <span style={{
            background: 'rgba(16,185,129,0.15)', color: '#6EE7B7',
            padding: '3px 10px', borderRadius: '50px', fontSize: '0.72rem', fontWeight: 700,
            border: '1px solid rgba(16,185,129,0.4)',
          }}>
            {safeZones.length} safe
          </span>
        </div>
      </div>

      {/* ========== SELECTED DETAIL CARD ========== */}
      {selected && (
        <div style={{
          position: 'absolute', top: 12, right: 16, zIndex: 10,
          background: 'rgba(10,15,30,0.95)', backdropFilter: 'blur(20px)',
          border: `1px solid ${selected.isSafe ? 'rgba(52,211,153,0.5)' : (riskColors[selected.risk] + '44')}`,
          borderRadius: '16px', padding: '16px 20px', maxWidth: 340,
          animation: 'fadeInScale 0.3s ease',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
            <div style={{ fontWeight: 800, fontSize: '1rem', color: selected.isSafe ? '#34D399' : '#fff', maxWidth: 260 }}>
              {selected.isSafe ? '✅ ' : ''}{selected.name}
            </div>
            <button onClick={() => setSelected(null)} style={{
              background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%',
              width: 24, height: 24, color: '#94A3B8', cursor: 'pointer', fontSize: '0.8rem',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>✕</button>
          </div>
          {!selected.isSafe && (
            <div style={{ display: 'flex', gap: '8px', marginBottom: '10px', flexWrap: 'wrap' }}>
              <span style={{
                background: `${riskColors[selected.risk]}22`, color: riskColors[selected.risk],
                padding: '3px 12px', borderRadius: '50px', fontSize: '0.75rem', fontWeight: 700,
                border: `1px solid ${riskColors[selected.risk]}55`,
              }}>● {selected.risk.toUpperCase()}</span>
              <span style={{ fontSize: '0.78rem', color: '#94A3B8' }}>{typeLabels[selected.type]}</span>
            </div>
          )}
          {selected.isSafe && (
            <div style={{ marginBottom: '10px' }}>
              <span style={{ background: 'rgba(16,185,129,0.2)', color: '#6EE7B7', padding: '3px 12px', borderRadius: '50px', fontSize: '0.75rem', fontWeight: 700, border: '1px solid rgba(16,185,129,0.4)' }}>
                ELEVATED SAFE ZONE
              </span>
            </div>
          )}
          <div style={{ fontSize: '0.82rem', color: '#CBD5E1', lineHeight: 1.5, marginBottom: '8px' }}>
            {selected.description}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: '0.75rem', color: '#64748B' }}>
              📍 {selected.district} · {selected.lat?.toFixed(4)}°N
            </div>
            <button onClick={() => flyToHotspot(selected)} style={{
              padding: '4px 12px', fontSize: '0.72rem', fontWeight: 600,
              background: 'rgba(96,165,250,0.2)', border: '1px solid rgba(96,165,250,0.4)',
              borderRadius: '6px', color: '#93C5FD', cursor: 'pointer',
            }}>🎯 Fly To</button>
          </div>
        </div>
      )}

      {/* ========== LEGEND ========== */}
      <div style={{
        position: 'absolute', bottom: 20, left: 12, zIndex: 10,
        background: 'rgba(10,15,30,0.92)', backdropFilter: 'blur(16px)',
        border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px',
        padding: '10px 14px', display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap',
      }}>
        <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>LEGEND</span>
        {Object.entries(riskColors).map(([risk, color]) => (
          <div key={risk} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: color, boxShadow: `0 0 8px ${color}66` }} />
            <span style={{ fontSize: '0.72rem', color: '#94A3B8', textTransform: 'capitalize' }}>{risk}</span>
          </div>
        ))}
        <div style={{ width: 1, height: 14, background: 'rgba(255,255,255,0.1)' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#10B981', boxShadow: '0 0 8px rgba(16,185,129,0.5)' }} />
          <span style={{ fontSize: '0.72rem', color: '#34D399', fontWeight: 600 }}>Safe Zone</span>
        </div>

      </div>

      {/* Camera info */}
      <div style={{
        position: 'absolute', bottom: 20, right: 12, zIndex: 10,
        background: 'rgba(10,15,30,0.85)', backdropFilter: 'blur(12px)',
        border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px',
        padding: '6px 12px', fontSize: '0.68rem', color: '#64748B',
        display: 'flex', gap: '12px',
      }}>
        <span>🎯 {cameraInfo.lat.toFixed ? cameraInfo.lat.toFixed(2) : cameraInfo.lat}°N, {cameraInfo.lng.toFixed ? cameraInfo.lng.toFixed(2) : cameraInfo.lng}°E</span>
        <span>🛫 {cameraInfo.alt}km</span>
        {terrainEnabled && <span>⛰️ Terrain</span>}
        {buildingsEnabled && <span>🏢 Buildings</span>}
      </div>

      <style>{`
        @keyframes fadeInScale {
          from { opacity: 0; transform: scale(0.95) translateY(-5px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .cesium-viewer .cesium-viewer-toolbar,
        .cesium-viewer .cesium-viewer-bottom {
          display: none !important;
        }
      `}</style>
    </div>
  );
}
