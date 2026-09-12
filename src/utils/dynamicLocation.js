import { bhuvanExtractTerrainData } from './bhuvan-api';
import { isPointInIndia } from '../data/indiaBoundary';

/**
 * Geocodes an Indian city, fetches its Bhuvan terrain data,
 * and calls the OSM Overpass API to assess drainage infrastructure.
 * 
 * Returns a complete 'districtData' object matching exactly what floodML.js expects.
 */
export async function searchAndAnalyzeCity(cityName) {
    // 1. Geocode via OSM Nominatim (strictly restricted to India)
    const encodedCity = encodeURIComponent(cityName);
    const geoRes = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodedCity}&countrycodes=in&format=json&limit=1`);
    const geoData = await geoRes.json();
    
    if (!geoData || geoData.length === 0) {
        throw new Error("Location not found in India. Deep Analysis is exclusively available for India.");
    }
    
    const location = geoData[0];
    const lat = parseFloat(location.lat);
    const lon = parseFloat(location.lon);

    if (!isPointInIndia(lat, lon)) {
        throw new Error("Selected city is outside sovereign Indian territory. Deep Analysis is only available within India.");
    }

    const bbox = location.boundingbox; // [south, north, west, east] - Note Nominatim returns string arrays

    // 2. Extract terrain & slope via Bhuvan / Open-Elevation fallback
    const terrain = await bhuvanExtractTerrainData(lat, lon);
    
    // 3. OSM Overpass API - Drainage Extractor
    // Query waterways (drains, canals, rivers) in the exact bounding box
    const overpassQuery = `
        [out:json][timeout:15];
        (
            way["waterway"="drain"](${bbox[0]},${bbox[2]},${bbox[1]},${bbox[3]});
            way["waterway"="canal"](${bbox[0]},${bbox[2]},${bbox[1]},${bbox[3]});
            way["waterway"="river"](${bbox[0]},${bbox[2]},${bbox[1]},${bbox[3]});
        );
        out body;
        >;
        out skel qt;
    `;
    
    let drainageFeatures = [];
    let estimatedDrainLengthKm = 60; // default fallback
    
    try {
        const opRes = await fetch("https://overpass-api.de/api/interpreter", {
            method: "POST",
            body: overpassQuery
        });
        
        if (opRes.ok) {
            const opData = await opRes.json();
            const ways = opData.elements.filter(e => e.type === "way");
            const nodes = opData.elements.filter(e => e.type === "node");
            
            // Build geometry for the Map UI
            const nodeMap = new Map();
            nodes.forEach(n => nodeMap.set(n.id, [n.lat, n.lon]));
            
            drainageFeatures = ways.map(way => ({
                id: way.id,
                tags: way.tags,
                coordinates: way.nodes.map(nodeId => nodeMap.get(nodeId)).filter(c => c)
            })).filter(way => way.coordinates.length > 1);

            // Rough heuristic: each OSM 'way' polygon segment in Indian cities is ~200m on average
            estimatedDrainLengthKm = Math.max(15, ways.length * 0.2); 
        }
    } catch (e) {
        console.warn("OSM Overpass API extraction failed. Using heuristic defaults based on terrain.", e);
    }

    // 4. Transform into ML District Data structure
    const terrainType = terrain ? terrain.terrain : 'Plains';
    const rawSlope = terrain && terrain.slope ? parseFloat(terrain.slope) : 2.0;

    let imperviousPct = 60;
    if (terrainType === "High Mountains") imperviousPct = 25;
    else if (terrainType === "Hilly Terrain") imperviousPct = 40;
    else if (terrainType === "Plateau") imperviousPct = 55;
    
    const drainCount = Math.max(1, Math.round(estimatedDrainLengthKm / 5));

    const finalDistrictData = {
        name: location.display_name.split(',')[0],
        displayName: location.display_name,
        lat, 
        lon, 
        bbox,
        drainCount: drainCount,
        drainLengthKm: estimatedDrainLengthKm,
        pumpingStations: Math.round(drainCount / 3),
        avgSlope: rawSlope / 100, // convert degree slope to a rough percentage/decimal metric for the ML
        imperviousPct: imperviousPct,
        elevation_m: terrain ? terrain.elevation : 200,
        yamunaProximity: 0.1, // Not near Yamuna outside Delhi
        historicalFloodFreq: 0.5,
        drainCapacityM3s: estimatedDrainLengthKm * 3.5, // estimate capacity
        underpasses: ['City center underpass', 'Main junction'],
        populationDensity: 15000,
        drainageFeatures // The raw extracted OSM polylines for the Map UI
    };

    return finalDistrictData;
}

export async function reverseGeocodeAndAnalyze(lat, lon) {
    if (!isPointInIndia(lat, lon)) {
        throw new Error("Coordinates are outside sovereign Indian territory. Deep Analysis is only available within India.");
    }

    const geoRes = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`);
    const geoData = await geoRes.json();
    
    if (!geoData || geoData.error) {
        throw new Error("Could not reverse geocode this location.");
    }

    if (geoData.address && geoData.address.country_code && geoData.address.country_code !== 'in') {
        throw new Error("Location belongs to another country. Deep Analysis is exclusively restricted to India.");
    }
    
    // Fallback bounding box if Nominatim doesn't provide a tight one for reverse lookup
    const bbox = geoData.boundingbox || [lat - 0.05, lat + 0.05, lon - 0.05, lon + 0.05];
    
    const terrain = await bhuvanExtractTerrainData(lat, lon);
    
    const overpassQuery = `
        [out:json][timeout:15];
        (
            way["waterway"="drain"](${bbox[0]},${bbox[2]},${bbox[1]},${bbox[3]});
            way["waterway"="canal"](${bbox[0]},${bbox[2]},${bbox[1]},${bbox[3]});
            way["waterway"="river"](${bbox[0]},${bbox[2]},${bbox[1]},${bbox[3]});
        );
        out body;
        >;
        out skel qt;
    `;
    
    let drainageFeatures = [];
    let estimatedDrainLengthKm = 60;
    
    try {
        const opRes = await fetch("https://overpass-api.de/api/interpreter", {
            method: "POST",
            body: overpassQuery
        });
        
        if (opRes.ok) {
            const opData = await opRes.json();
            const ways = opData.elements.filter(e => e.type === "way");
            const nodes = opData.elements.filter(e => e.type === "node");
            const nodeMap = new Map();
            nodes.forEach(n => nodeMap.set(n.id, [n.lat, n.lon]));
            
            drainageFeatures = ways.map(way => ({
                id: way.id,
                tags: way.tags,
                coordinates: way.nodes.map(nodeId => nodeMap.get(nodeId)).filter(c => c)
            })).filter(way => way.coordinates.length > 1);

            estimatedDrainLengthKm = Math.max(15, ways.length * 0.2); 
        }
    } catch (e) {
        console.warn("OSM Overpass extraction failed:", e);
    }

    const terrainType = terrain ? terrain.terrain : 'Plains';
    const rawSlope = terrain && terrain.slope ? parseFloat(terrain.slope) : 2.0;

    let imperviousPct = 60;
    if (terrainType === "High Mountains") imperviousPct = 25;
    else if (terrainType === "Hilly Terrain") imperviousPct = 40;
    else if (terrainType === "Plateau") imperviousPct = 55;
    
    const drainCount = Math.max(1, Math.round(estimatedDrainLengthKm / 5));
    const nameStr = geoData.address?.city || geoData.address?.town || geoData.address?.village || geoData.address?.county || geoData.display_name.split(',')[0];

    return {
        name: nameStr,
        displayName: geoData.display_name,
        lat, 
        lon, 
        bbox,
        drainCount: drainCount,
        drainLengthKm: estimatedDrainLengthKm,
        pumpingStations: Math.round(drainCount / 3),
        avgSlope: rawSlope / 100,
        imperviousPct: imperviousPct,
        elevation_m: terrain ? terrain.elevation : 200,
        yamunaProximity: 0.1,
        historicalFloodFreq: 0.5,
        drainCapacityM3s: estimatedDrainLengthKm * 3.5,
        underpasses: ['Local intersection'],
        populationDensity: 15000,
        drainageFeatures
    };
}
