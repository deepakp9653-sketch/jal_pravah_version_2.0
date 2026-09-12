import React, { useState } from 'react';
import FloodMap from './FloodMap';
import WeatherWidget from './WeatherWidget';
import { hotspots } from '../data/hotspots';

const stats = [
  { value: '93', label: 'Flood Hotspots Tracked' },
  { value: '12', label: 'Critical Risk Zones' },
  { value: '56', label: 'Major Drains Monitored' },
  { value: '208.66m', label: 'HFL 2023 (Yamuna)' },
];

export default function HomePage({ alertLevel, setAlertLevel }) {
  const [tab, setTab] = useState('map');

  const criticalCount = hotspots.filter(h => h.risk === 'critical').length;
  const highCount = hotspots.filter(h => h.risk === 'high').length;

  return (
    <div style={{ padding: '1.5rem', maxWidth: 1400, margin: '0 auto' }}>

      {/* Hero Section */}
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 className="section-title">
              <span className="text-gradient">Jal Pravah</span> — National Flood Intelligence
            </h1>
            <p className="section-subtitle">Real-time flood prediction and management across India using dynamic Bhuvan & IMD Data</p>
          </div>
        </div>

        {/* Stats Row */}
        <div className="hero-stats">
          <div className="stat-card">
            <div className="stat-value">{hotspots.length}</div>
            <div className="stat-label">Total Vulnerable Zones Tracked</div>
          </div>
          <div className="stat-card" style={{ background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.25)' }}>
            <div className="stat-value" style={{ background: 'linear-gradient(135deg,#DC2626,#F97316)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>{criticalCount}</div>
            <div className="stat-label">Critical Zones Now</div>
          </div>
          <div className="stat-card" style={{ background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.25)' }}>
            <div className="stat-value" style={{ background: 'linear-gradient(135deg,#F97316,#EAB308)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>{highCount}</div>
            <div className="stat-label">High Risk Areas</div>
          </div>
        </div>
      </div>

      {/* Tab Toggle */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        {[{id:'map',label:'🗺️ Flood Map'},{id:'weather',label:'🌤️ Live Weather'}].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`btn ${tab === t.id ? 'btn-primary' : 'btn-outline'}`}
            style={{ borderRadius: '50px', padding: '0.5rem 1.25rem', fontSize: '0.88rem' }}>
            {t.label}
          </button>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Last updated: {new Date().toLocaleTimeString('en-IN')}</span>
        </div>
      </div>

      {/* Map or Weather */}
      {tab === 'map' ? <FloodMap /> : <WeatherWidget />}

      {/* Info Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginTop: '1.5rem' }}>
        <div className="glass-card" style={{ padding: '1.25rem' }}>
          <div style={{ fontSize: '1.3rem', marginBottom: '0.5rem' }}>🌊</div>
          <div style={{ fontFamily: 'Inter', fontWeight: 700, marginBottom: '0.4rem' }}>River Yamuna Watch</div>
          <div style={{ fontSize: '0.83rem', color: 'var(--text-secondary)' }}>Warning Level: <strong style={{ color: '#FDE047' }}>204.50 m</strong> | Danger Level: <strong style={{ color: '#FCA5A5' }}>205.33 m</strong></div>
          <div style={{ fontSize: '0.83rem', color: 'var(--text-secondary)', marginTop: '0.3rem' }}>All Time HFL: <strong style={{ color: '#DC2626' }}>208.66 m (Jul 2023)</strong></div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>Source: FCO 2025 / CWC Delhi</div>
        </div>
        <div className="glass-card" style={{ padding: '1.25rem' }}>
          <div style={{ fontSize: '1.3rem', marginBottom: '0.5rem' }}>🏗️</div>
          <div style={{ fontFamily: 'Inter', fontWeight: 700, marginBottom: '0.4rem' }}>Drain Network</div>
          <div style={{ fontSize: '0.83rem', color: 'var(--text-secondary)' }}>Total drain length: <strong>3,692 km</strong> across Delhi</div>
          <div style={{ fontSize: '0.83rem', color: 'var(--text-secondary)', marginTop: '0.3rem' }}>Major drains tracked: <strong>56</strong> across 5 blocks</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>Source: I&FC Dept, FCO 2025</div>
        </div>
        <div className="glass-card" style={{ padding: '1.25rem' }}>
          <div style={{ fontSize: '1.3rem', marginBottom: '0.5rem' }}>📡</div>
          <div style={{ fontFamily: 'Inter', fontWeight: 700, marginBottom: '0.4rem' }}>Monitoring Coverage</div>
          <div style={{ fontSize: '0.83rem', color: 'var(--text-secondary)' }}>Districts covered: <strong>11</strong> Delhi districts</div>
          <div style={{ fontSize: '0.83rem', color: 'var(--text-secondary)', marginTop: '0.3rem' }}>Waterlogging spots: <strong>194+</strong> locations (2024)</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>Source: FCO 2025, PWD/MCD data</div>
        </div>
      </div>

      <div style={{ textAlign: 'center', marginTop: '2.5rem', padding: '1.5rem 0', color: 'var(--text-muted)', fontSize: '0.85rem', borderTop: '1px solid var(--border)' }}>
        Jal Pravah 2.0 — Made by <strong>Deepakkumar Prajapati</strong> (not Megalytics)
      </div>
    </div>
  );
}
