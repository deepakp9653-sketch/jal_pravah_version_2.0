import React, { useState, useEffect } from 'react';

export default function IntroPage({ onStart }) {
  const [typedText, setTypedText] = useState('');
  const [showButton, setShowButton] = useState(false);
  
  const fullText = "Government Coordination Portal & Flood Intelligence System";

  useEffect(() => {
    let i = 0;
    const typing = setInterval(() => {
      setTypedText(fullText.slice(0, i));
      i++;
      if (i > fullText.length) {
        clearInterval(typing);
        setTimeout(() => setShowButton(true), 500);
      }
    }, 40);
    return () => clearInterval(typing);
  }, []);

  return (
    <div className="intro-container">
      {/* Background elements */}
      <div className="water-wave wave1"></div>
      <div className="water-wave wave2"></div>
      <div className="water-wave wave3"></div>
      
      <div className="intro-content">
        <div className="intro-logo-container">
          <img src={`${import.meta.env.BASE_URL}logo_jalpravah.png`} alt="Jal Pravah Logo" style={{ height: '90px', width: '90px', borderRadius: '50%', objectFit: 'cover', border: '3px solid rgba(59,130,246,0.6)', background: '#fff', boxShadow: '0 0 25px rgba(59,130,246,0.3)' }} />
        </div>
        
        <h1 className="intro-title">JAL PRAVAH COMMAND CENTER</h1>
        
        <p className="intro-subtitle">
          {typedText}
          <span className="cursor-blink">|</span>
        </p>

        <div className="intro-features">
          <div className="intro-feature">
            <span>🚨</span> Multi-Agency Coordination
          </div>
          <div className="intro-feature">
            <span>🤖</span> Deep AI Terrain Analysis
          </div>
          <div className="intro-feature">
            <span>📊</span> CWC Standard Analytics
          </div>
        </div>

        <button 
          className={`intro-start-btn ${showButton ? 'visible' : ''}`}
          onClick={onStart}
        >
          Access Command Portal <span style={{ marginLeft: '0.5rem' }}>→</span>
        </button>
      </div>
      
      <div className="intro-footer">
        <div>Strictly for use by Authorized Government Personnel & Mayors</div>
      </div>
    </div>
  );
}
