import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, NavLink, Navigate } from 'react-router-dom';
import './index.css';
import IntroPage from './components/IntroPage';
import HomePage from './components/HomePage';
import DeepAnalysisMap from './components/DeepAnalysisMap';
import AdminPanel from './components/AdminPanel';
import HistoricalData from './components/HistoricalData';
import FloodMap3D from './components/FloodMap3D';
import AlertBanner from './components/AlertBanner';
import GlobalLogin from './components/GlobalLogin';
import BhuvanSetup from './components/BhuvanSetup';
import GlobalSearchBar from './components/GlobalSearchBar';
import ErrorBoundary from './components/ErrorBoundary';
import { LocationProvider } from './context/LocationContext';
import { refreshMLParams } from './utils/floodML';

export default function App() {
  const [showApp, setShowApp] = useState(() => localStorage.getItem('jp_started') === 'true');
  const [isAuthorized, setIsAuthorized] = useState(() => localStorage.getItem('jp_authorized') === 'true');
  const [menuOpen, setMenuOpen] = useState(false);
  const [alertLevel, setAlertLevel] = useState('moderate');
  const [theme, setTheme] = useState('light');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Sync Supabase ML parameters on app load
  useEffect(() => {
    try {
      refreshMLParams();
    } catch (e) {
      console.warn('Could not sync ML params:', e);
    }
  }, []);

  const handleStart = () => {
    localStorage.setItem('jp_started', 'true');
    setShowApp(true);
  };

  const handleLoginSuccess = () => {
    localStorage.setItem('jp_authorized', 'true');
    setIsAuthorized(true);
  };

  if (!showApp) {
    return <IntroPage onStart={handleStart} />;
  }

  if (!isAuthorized) {
    return <GlobalLogin onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <LocationProvider>
      <Router>
        <nav className="navbar">
          <div className="navbar-logo">
            <img src={`${import.meta.env.BASE_URL}logo_jalpravah.png`} alt="Jal Pravah Logo" style={{ height: '36px', width: '36px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--primary-light)', background: '#fff' }} />
            <span className="text-gradient">JAL PRAVAH</span>
          </div>
          <div className={`nav-links ${menuOpen ? 'nav-open' : ''}`}>
            
            <GlobalSearchBar />

            <NavLink to="/" className={({isActive}) => `nav-link ${isActive ? 'active' : ''}`} end>
            <img src={`${import.meta.env.BASE_URL}map.jpeg`} alt="" className="nav-icon" /> Flood Map
          </NavLink>
          <NavLink to="/3d-map" className={({isActive}) => `nav-link ${isActive ? 'active' : ''}`}>
            <img src={`${import.meta.env.BASE_URL}magnifying_glass.jpeg`} alt="" className="nav-icon" /> 3D Map
          </NavLink>
          <NavLink to="/analysis" className={({isActive}) => `nav-link ${isActive ? 'active' : ''}`}>
            <img src={`${import.meta.env.BASE_URL}deep_analysis.jpeg`} alt="" className="nav-icon" /> Deep Analysis
          </NavLink>
          <NavLink to="/history" className={({isActive}) => `nav-link ${isActive ? 'active' : ''}`}>
            <img src={`${import.meta.env.BASE_URL}drainage.jpeg`} alt="" className="nav-icon" /> Historical
          </NavLink>
          <NavLink to="/my-ward" className={({isActive}) => `nav-link ${isActive ? 'active' : ''}`}>
            <img src={`${import.meta.env.BASE_URL}ward.jpeg`} alt="" className="nav-icon" /> My Ward (Delhi)
          </NavLink>
          <NavLink to="/bhuvan-setup" className={({isActive}) => `nav-link ${isActive ? 'active' : ''}`}>
            <img src={`${import.meta.env.BASE_URL}settings.jpeg`} alt="" className="nav-icon" /> Bhuvan
          </NavLink>
          
          <button onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} 
            className="nav-link" style={{ background: 'var(--bg-glass)', border: `1px solid var(--border)`, cursor: 'pointer', borderRadius: '50px' }}>
            {theme === 'light' ? '🌙 Dark' : '☀️ Light'}
          </button>
          <div style={{ display: 'flex', alignItems: 'center', marginLeft: '0.5rem', background: 'var(--bg-glass)', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.15rem 0.5rem' }}>
            <span style={{ fontSize: '1rem', marginRight: '0.3rem' }}>🌐</span>
            <div id="google_translate_element"></div>
          </div>
        </div>
        
        <button className="hamburger" onClick={() => setMenuOpen(!menuOpen)}>☰</button>
      </nav>

      <div className={`app-container ${theme}`} style={{ paddingTop: '0' }}>
        <ErrorBoundary>
          <Routes>
            <Route path="/" element={<HomePage alertLevel={alertLevel} setAlertLevel={setAlertLevel} />} />
            <Route path="/3d-map" element={<FloodMap3D />} />
            <Route path="/analysis" element={<DeepAnalysisMap />} />
            <Route path="/history" element={<HistoricalData />} />
            <Route path="/my-ward" element={<AdminPanel />} />
            <Route path="/bhuvan-setup" element={<BhuvanSetup />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ErrorBoundary>

        <footer style={{
          textAlign: 'center',
          padding: '1.25rem 1rem',
          fontSize: '0.82rem',
          color: 'var(--text-muted)',
          borderTop: '1px solid var(--border)',
          marginTop: '2rem',
          background: 'rgba(0, 0, 0, 0.12)'
        }}>
          <div><strong>Jal Pravah 2.0</strong> — Urban Flood Intelligence & Hazard Evaluation System</div>
          <div style={{ marginTop: '0.35rem' }}>
            Made by <strong style={{ color: 'var(--primary-light)' }}>Deepakkumar Prajapati</strong> (not Megalytics)
          </div>
        </footer>
      </div>
      </Router>
    </LocationProvider>
  );
}
