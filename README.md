# 🌊 JAL PRAVAH 2.0 (जल प्रवाह)
### Next-Generation Urban Flood Intelligence, 3D Digital Twin & MCD Municipal Command System

[![React](https://img.shields.io/badge/React-19.2-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-8.0-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![CesiumJS](https://img.shields.io/badge/CesiumJS-1.113-4B82C3?style=for-the-badge&logo=cesium&logoColor=white)](https://cesium.com/)
[![Leaflet](https://img.shields.io/badge/Leaflet-1.9-199900?style=for-the-badge&logo=leaflet&logoColor=white)](https://leafletjs.com/)
[![Google Gemini](https://img.shields.io/badge/Google_Gemini-2.5_Flash-8E75B2?style=for-the-badge&logo=google&logoColor=white)](https://ai.google.dev/)
[![Vapi AI](https://img.shields.io/badge/Vapi_AI-Voice_SOS-000000?style=for-the-badge)](https://vapi.ai/)
[![ISRO Bhuvan](https://img.shields.io/badge/ISRO-Bhuvan_NRSC-FF9933?style=for-the-badge)](https://bhuvan.nrsc.gov.in/)

---

## 📌 Executive Overview

**Jal Pravah 2.0 (जल प्रवाह)** is an advanced, AI-powered national flood intelligence and urban flood hazard evaluation platform made and engineered by **Deepakkumar Prajapati** (and not Megalytics). Built specifically with a high-resolution focus on the National Capital Territory (NCT) of Delhi and multi-state flood vulnerabilities across India, the platform bridges the gap between raw meteorological/satellite data, ground-level municipal infrastructure, and citizen disaster response.

By harmonizing **Central Water Commission (CWC)** hydrological benchmarks, **Delhi Flood Control Order (FCO 2025)** drainage records, **ISRO Bhuvan** satellite Land Use/Land Cover (LULC) and Digital Elevation Models (DEM), **Open-Meteo** live rainfall telemetry, **CesiumJS 3D geospatial simulation**, and **Google Gemini Generative AI**, Jal Pravah delivers hyper-local predictive flood analytics and actionable mitigation strategies for all **250 Municipal Corporation of Delhi (MCD) wards**.

---

## 🔑 Access & Authentication

The application features role-based access control across multiple administrative and operational tiers:

| Tier / Portal | Component | Description |
| :--- | :--- | :--- |
| **Global Command Center Gateway** | [`GlobalLogin.jsx`](file:///c:/Users/heena/Downloads/jal_pravah_version_2.0-main/jal_pravah_version_2.0-main/src/components/GlobalLogin.jsx) | Unlocks system-wide access upon application initialization. |
| **ISRO Bhuvan API Configuration** | [`BhuvanSetup.jsx`](file:///c:/Users/heena/Downloads/jal_pravah_version_2.0-main/jal_pravah_version_2.0-main/src/components/BhuvanSetup.jsx) | Management interface for NRSC Bhuvan API tokens and spatial keys. |
| **Municipal Ward Heads (MCD Portal)** | [`AdminPanel.jsx`](file:///c:/Users/heena/Downloads/jal_pravah_version_2.0-main/jal_pravah_version_2.0-main/src/components/AdminPanel.jsx) | Grants administrative access to the ward-level command dashboard, AI Strategy Advisor, department coordination, citizen reports, and emergency SOS dispatch across all **250 Wards**. |

> [!NOTE]
> **Database & Municipal Ward Authentication:**
> - The database is powered by **Neon Serverless PostgreSQL** (Project: `jal-pravah`, Region: AWS `us-west-2`).
> - All **250 MCD Wards** are pre-seeded in the Neon database with authorized personnel passcodes.
> - Departmental officer records, citizen incident reports, and emergency SOS alerts persist live in Neon PostgreSQL via `@neondatabase/serverless`.

---

## 🚀 Key Features & Architectural Modules

### 1. 🌐 National 2D Flood Intelligence Map (`HomePage.jsx` & `FloodMap.jsx`)
- **Macro & Micro Hotspot Coverage:** Integrates 93 primary high-vulnerability hotspots across Delhi and **2,500+ nationwide micro-hotspots** spanning 25+ Indian states (Assam, Bihar, UP, Maharashtra, Kerala, Odisha, etc.).
- **Vulnerability Classification:** Categorizes assets by risk severity (*Critical*, *High*, *Moderate*, *Low*) and typology (*Embankments, Historical 1978 & 2023 Flood Plains, Waterlogging Hotspots, Pumping Stations, Regulators, and Rural Settlements*).
- **Dynamic Weather Overlays:** Live Open-Meteo precipitation tracking and 7-day predictive rainfall forecasts.

### 2. 🏙️ CesiumJS 3D Digital Twin & Inundation Simulation (`FloodMap3D.jsx`)
- **Photorealistic Geospatial 3D Viewer:** Built with CesiumJS utilizing global terrain elevation models and realistic 3D building geometry.
- **Dynamic Water Inundation Simulator:** Interactive rainfall slider (0–300 mm) simulating real-time hydraulic ponding, surface runoff accumulation, and rising water levels across urban topography.
- **Extruded Risk Columns & Polygon Boundaries:** 3D extruded volumetric markers representing hazard severity at key urban intersections and official revenue district polygon boundaries (`DELHI_DISTRICTS_POLYGONS`).

### 3. 🔬 Deep Hydrological Analysis & Universal PMRS Engine (`DeepAnalysisMap.jsx`, `universalPMRS.js`, `floodML.js`)
- **Preparedness & Mitigation Readiness Score (PMRS v2):** A composite index (0–100) combining:
  - **Rational Method Runoff:** Runoff coefficient derived from LULC concrete/impervious percentage ($Q = c \cdot I \cdot A$).
  - **Antecedent Moisture Index (AMI):** Cumulative 3-day rainfall saturation index.
  - **Terrain Slope & Elevation:** Digital Elevation Model data extracted from ISRO Bhuvan.
  - **Hydraulic Capacity:** Drain conveyance capacity (m³/s) versus discharge requirements.
  - **Drainage Proximity:** Distance from the micro-catchment to the nearest major outfall or the Yamuna River.
- **Precautionary Decision Advisory:** Automatic generation of action checklists based on real-time calculated threat tiers.

### 4. 📈 62-Year Historical Flood Analytics (`HistoricalData.jsx`)
- **Comprehensive River Gauge History:** Longitudinal tracking of the River Yamuna at the Old Railway Bridge (ORB) from 1963 to 2024.
- **Key Hydrological Benchmarks:**
  - **Warning Level:** 204.50 m
  - **Danger Level:** 205.33 m
  - **1978 Historic Flood Peak:** 207.49 m
  - **July 2023 All-Time Record High Flood Level (HFL):** 208.66 m
- **Drainage Infrastructure Telemetry:** In-depth breakdown of Delhi's 56+ primary drains, including Najafgarh Drain, Supplementary Drain, Barapullah Drain, Shahdara Outfall, and Trans-Yamuna channels.

### 5. 🏛️ MCD 250-Ward Municipal Portal & AI Advisor (`AdminPanel.jsx`, `mcdWards.js`)
- **250 Official MCD Wards:** Full indexed registry across 12 zones (*Narela, Civil Line, Rohini, Keshavpuram, City S.P., Karolbagh, West, Najafgarh, Central, South, Shahdara South, Shahdara North*).
- **Google Gemini Hydrological AI Advisor (`gemini.js`):**
  - Synthesizes ward-specific metrics (impervious percentage, drain capacity, slope, antecedent rainfall, population density).
  - Formulates space-constrained urban flood mitigation strategies tailored for dense settlements (<50 sqm footprint), drawing on proven civil engineering blueprints from Tokyo, Rotterdam, Singapore, and Seoul.
  - Outlines 30-day "quick wins" for ward commissioners with existing municipal budgets.
- **Inter-Departmental Coordination:** Role-based dispatch for *Municipal Heads (Mayors), Drainage/PWD, Electricity, Dam Control, NDRF, and Health & Sanitation*.
- **Citizen Grievance & SOS Feed:** Real-time triage interface to verify citizen infrastructure reports and dispatch relief teams.

### 6. 🎙️ Voice-Activated Citizen SOS & Crowdsourcing (`VapiSOSButton.jsx`, `CitizenReport.jsx`, `CitizenRisk.jsx`)
- **Vapi AI Conversational Voice Widget:** Hands-free emergency voice calling assistant for citizens in flood distress.
- **Crowdsourced Incident Reporting:** Community-submitted reports with category tags (*Drainage Blockage, Waterlogging, Infrastructure Damage*), severity levels, and geographic coordinates.
- **Browser Geolocation Risk Check:** Instant 1-click risk assessment that geolocates the citizen, performs Bhuvan reverse geocoding, and calculates hazard proximity.

### 7. ⚙️ Automated Monitoring & Alerting Workflows (`Jal Pravah Flood Alert System.json`)
- **n8n Automation Architecture:** Scheduled cron workflow executing every 30 minutes to fetch live Open-Meteo meteorological data across Delhi districts, evaluate drain capacity saturation thresholds, and dispatch alerts.

---

## 🛠️ Technology Stack

| Domain | Technology / Library | Description |
| :--- | :--- | :--- |
| **Core Framework** | React 19.2, Vite 8.0 | High-performance modern web framework with fast HMR |
| **Routing & State** | React Router v7 (HashRouter), Context API | Single-page application routing and global location state |
| **3D Geospatial Engine** | CesiumJS 1.113 | 3D Digital Twin, Cesium World Terrain, dynamic water rendering |
| **2D Mapping** | Leaflet 1.9, React-Leaflet 5.0, Deck.gl 9.2, MapLibre GL | Interactive mapping, vector layers, and spatial overlays |
| **Charts & Analytics** | Recharts 3.8 | Historical time series, area charts, and gauge visualizers |
| **Generative AI** | Google Gemini API (`gemini-2.5-flash`, `2.0-flash`) | Automated urban hydrological advisory with dual-key failover |
| **Voice AI** | Vapi AI Web SDK (`@vapi-ai/web`) | Conversational voicebot for hands-free emergency SOS calls |
| **Data Sources** | ISRO Bhuvan NRSC API, Open-Meteo REST API | Satellite LULC, DEM terrain elevation, and live weather telemetry |
| **Data Layer** | Neon Serverless PostgreSQL (`@neondatabase/serverless`) | Serverless PostgreSQL database for 250 wards, officers, reports, and SOS records |
| **Workflow Engine** | n8n (`.n8n` workflow definition) | Automated 30-minute weather polling and flood alert pipeline |

---

## 📂 Project Directory Structure

```text
jal_pravah_version_2.0-main/
├── FloodAffectedAreaAtlas_Digital.pdf    # National flood atlas reference document
├── Jal Pravah Flood Alert System.json    # n8n automated workflow definition
├── mcd_map_full_zone_image_cd_...txt     # MCD official 250 ward baseline data
├── index.html                            # Root HTML template with Cesium & Google Translate
├── package.json                          # Dependencies and npm build scripts
├── vite.config.js                        # Vite bundler configuration
│
├── public/                               # Static imagery, icons, and branding
│   ├── logo_jalpravah.png
│   ├── map.jpeg
│   ├── deep_analysis.jpeg
│   └── ...
│
└── src/
    ├── App.jsx                           # Application router and navigation bar
    ├── index.css                         # Core glassmorphic design system and responsive styles
    ├── main.jsx                          # React application entrypoint
    │
    ├── components/                       # UI Modules
    │   ├── AdminPanel.jsx                # MCD 250 Ward Government Command Portal
    │   ├── AlertBanner.jsx               # High-priority alert notification strip
    │   ├── BhuvanSetup.jsx               # ISRO Bhuvan API key configuration interface
    │   ├── CitizenReport.jsx             # Public infrastructure grievance reporting form
    │   ├── CitizenRisk.jsx               # One-click GPS citizen vulnerability lookup
    │   ├── DeepAnalysisMap.jsx           # PMRS calculation and multi-factor analytical map
    │   ├── EmergencyButton.jsx           # Immediate emergency dispatch trigger
    │   ├── ErrorBoundary.jsx             # React error boundary fallback handler
    │   ├── FloodMap.jsx                  # Interactive 2D nationwide flood risk map
    │   ├── FloodMap3D.jsx                # CesiumJS 3D Digital Twin with rainfall simulation
    │   ├── GlobalLogin.jsx               # Master system authentication gateway
    │   ├── GlobalSearchBar.jsx           # Universal ward & hotspot search bar
    │   ├── HistoricalData.jsx            # 62-year Yamuna water levels & drainage analytics
    │   ├── HomePage.jsx                  # Executive flood intelligence dashboard
    │   ├── IntroPage.jsx                 # Landing hero page and feature walkthrough
    │   ├── VapiSOSButton.jsx             # Voice-enabled SOS distress caller overlay
    │   └── WeatherWidget.jsx             # Live Open-Meteo weather telemetry widget
    │
    ├── context/
    │   └── LocationContext.jsx           # Shared geospatial context provider
    │
    ├── data/                             # Hydrological datasets & geospatial boundaries
    │   ├── delhiDistrictPolygons.js      # Delhi revenue district GeoJSON coordinates
    │   ├── drains.js                     # Delhi primary drain infrastructure records
    │   ├── hotspots.js                   # Primary Delhi flood hotspots and safe zones
    │   ├── massiveHotspots.js            # 2,500+ nationwide micro-hotspot dataset
    │   ├── mcdWards.js                   # 250 MCD wards registry and zone-to-district mappings
    │   └── yamunaHistory.js              # 1963–2024 Yamuna water level and discharge records
    │
    └── utils/                            # Algorithms, integrations, and ML models
        ├── bhuvan-api.js                 # ISRO Bhuvan NRSC REST endpoint handlers
        ├── dynamicLocation.js            # Reverse geocoding and nearest-catchment analytics
        ├── floodML.js                    # Rational runoff & rain-gated multi-factor ML engine
        ├── gemini.js                     # Google Gemini AI failover integration
        ├── supabase.js                   # Supabase database client initialization
        └── universalPMRS.js              # Universal PMRS v2 hydrological formula calculator
```

---

## 💻 Installation & Local Development

### Prerequisites
- **Node.js**: Version `18.x` or higher (Node 20+ recommended)
- **npm**: Version `9.x` or higher

### 1. Clone or Extract the Repository
```bash
cd jal_pravah_version_2.0-main/jal_pravah_version_2.0-main
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Start the Development Server
```bash
npm run dev
```
The application will launch locally at `http://localhost:5173/` (or the port indicated in your console).

### 4. Build for Production
To create an optimized production bundle:
```bash
npm run build
```
The compiled output will be generated in the `dist/` directory.

---

## 🔒 Configuration & Environment Setup

### 1. Command Center Authorization
Upon starting the web app, click **"Enter Command Center"** and authenticate using your assigned authorized operator credentials.

### 2. ISRO Bhuvan API Tokens
Navigate to the **Bhuvan** tab in the navigation bar to configure or inspect tokens for:
- `geoid`: Digital Elevation Model Token
- `routing`: Geospatial Routing Token
- `lulcAOI` & `lulcStats`: Land Use / Land Cover Analysis Tokens
- `villageRevGeo` & `villageGeo`: Geocoding Tokens

### 3. Google Gemini API
The Gemini integration in `src/utils/gemini.js` is equipped with a tri-key failover array. To provide your own Google Gemini API key, update the `GEMINI_KEYS` array in [`src/utils/gemini.js`](file:///c:/Users/heena/Downloads/jal_pravah_version_2.0-main/jal_pravah_version_2.0-main/src/utils/gemini.js).

---

## 📊 Scientific Methodology & Mathematical Models

### 1. The Rational Runoff Method ($Q = c \cdot I \cdot A$)
Jal Pravah estimates peak urban stormwater discharge using the standard hydrological Rational Equation:
$$Q = 0.278 \times c \times I \times A$$
Where:
- $Q$: Peak runoff rate ($\text{m}^3/\text{s}$)
- $c$: Runoff coefficient derived from LULC impervious surface percentage ($\% \text{Concrete} / 100$)
- $I$: Live and forecasted rainfall intensity ($\text{mm}/\text{hr}$ from Open-Meteo)
- $A$: Micro-catchment drainage area ($\text{km}^2$)

### 2. Antecedent Moisture Index (AMI)
Soil saturation is computed across a rolling 72-hour antecedent rainfall window:
$$\text{AMI} = \min\left(100, \frac{\sum_{t=1}^{3} R_t}{150} \times 100\right)$$
Where $R_t$ is rainfall in mm recorded on day $t$. Saturated soil significantly reduces natural infiltration, scaling up the calculated flood risk score.

### 3. Universal PMRS v2 (Preparedness & Mitigation Readiness Score)
$$\text{PMRS} = \text{Readiness}_{\text{drainage}} - \text{HydroLoad}_{\text{penalty}} - \text{Slope}_{\text{penalty}}$$
A score above **70** reflects robust preparedness, **45–70** requires active monitoring, and below **45** triggers critical municipal emergency alerts.

---

## 👥 Authors & Acknowledgments

- **Deepakkumar Prajapati** — Lead Creator, System Architect, Geospatial Engineer & ML Model Developer (Made by Deepakkumar Prajapati, not Megalytics).
- **National Remote Sensing Centre (NRSC / ISRO)** for Bhuvan Geoportal spatial datasets.
- **Central Water Commission (CWC)** & **Delhi Irrigation and Flood Control Department (I&FC)** for historical flood data and FCO records.
- **Open-Meteo** for high-resolution meteorological forecast APIs.
