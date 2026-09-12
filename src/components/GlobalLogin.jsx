import React, { useState } from 'react';

// Cryptographic hashes of authorized command credentials (passwords are never stored in plaintext)
const AUTHORIZED_CREDENTIAL_HASHES = [
  '6f0beb93310552ea244b81e1b2975e404e30b9def450891ce5cb95312fbc21e3', // primary
  '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918', // admin
  '101daa59096156bddb19c0117db0fd3985b7e2632e0f65a325f811bc1660a087', // command
  '78dc25307e5de65da72e4200cff879a185acfb2df37a90101b662d73ce10b23b', // operational
];

async function sha256Hex(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export default function GlobalLogin({ onLoginSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setIsAuthenticating(true);

    try {
      const u = username.trim().toLowerCase();
      const p = password.trim();
      const validUsernames = ['meghalytics', 'deepakkumar prajapati', 'deepak', 'deepakkumar', 'admin', 'operator', 'director'];
      const passHash = await sha256Hex(p.toLowerCase());

      if (validUsernames.includes(u) && AUTHORIZED_CREDENTIAL_HASHES.includes(passHash)) {
        onLoginSuccess();
      } else {
        setError('Invalid credentials. Access denied by Jal Pravah Command Center.');
      }
    } catch (err) {
      setError('Verification failed. Please try again.');
    } finally {
      setIsAuthenticating(false);
    }
  };

  return (
    <div className="login-overlay" style={{ minHeight: '100vh', background: 'var(--bg-dark)' }}>
      <div className="login-card" style={{ maxWidth: '450px', margin: '0 auto', border: '1px solid var(--border-bright)' }}>
        
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
          <img 
            src={`${import.meta.env.BASE_URL}logo_jalpravah.png`} 
            alt="Jal Pravah Logo" 
            style={{ 
              height: '80px', width: '80px', borderRadius: '50%', objectFit: 'cover', 
              border: '3px solid var(--primary-light)', background: '#fff', 
              boxShadow: '0 0 20px rgba(59,130,246,0.4)' 
            }} 
          />
        </div>
        
        <h2 className="login-title text-gradient">System Verification</h2>
        <p className="login-subtitle">Enter your command center authorization to proceed.</p>
        
        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem', marginTop: '2rem' }}>
          <div className="form-group" style={{ textAlign: 'left' }}>
            <label className="form-label" style={{ color: 'var(--text-secondary)' }}>Operator ID / Username</label>
            <input 
              type="text" 
              className="form-input" 
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter Operator ID"
              required 
            />
          </div>
          
          <div className="form-group" style={{ textAlign: 'left' }}>
            <label className="form-label" style={{ color: 'var(--text-secondary)' }}>Master Passcode</label>
            <input 
              type="password" 
              className="form-input" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter passcode"
              required 
            />
          </div>

          {error && <div className="login-error" style={{ color: 'var(--alert-red)', fontWeight: '600' }}>⚠️ {error}</div>}

          <button 
            type="submit" 
            className="btn btn-primary btn-full" 
            style={{ marginTop: '1rem', padding: '1rem', fontSize: '1.05rem', borderRadius: '8px' }}
            disabled={isAuthenticating}
          >
            {isAuthenticating ? 'VERIFYING...' : 'AUTHORIZE ACCESS'}
          </button>
        </form>

        <div style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
          Jal Pravah 2.0 Command Center
        </div>

      </div>
    </div>
  );
}
