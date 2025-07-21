import React, { useState, useEffect, useRef } from 'react';
import './HerbicideCalculator.css';

function HerbicideCalculator() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [selectedSprayer, setSelectedSprayer] = useState(null);
  const [selectedHerbicide, setSelectedHerbicide] = useState(null);
  const contentRef = useRef(null);
  const wrapperRef = useRef(null);

  useEffect(() => {
    const img = new Image();
    img.src = '/images/zebra-plant-bg.jpg';
    img.onload = () => setIsLoaded(true);
  }, []);

  // Resize observer to auto-track content height
  useEffect(() => {
    const updateHeight = () => {
      if (wrapperRef.current && contentRef.current) {
        const contentHeight = contentRef.current.scrollHeight;
        const buffer = 25; // <-- Add 30px for spacing (adjust if needed)
        wrapperRef.current.style.height = contentHeight + buffer + 'px';
      }
    };

    const raf = requestAnimationFrame(updateHeight);
    return () => cancelAnimationFrame(raf);
  }, [selectedSprayer, selectedHerbicide]);

  const handleSprayerClick = (type) => {
    setSelectedSprayer((prev) => (prev === type ? null : type));
  };

  const handleHerbicideClick = (type) => {
    setSelectedHerbicide((prev) => (prev === type ? null : type));
  };

  if (!isLoaded) {
    return (
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          backgroundColor: 'black',
          width: '100vw',
          height: '100vh',
          zIndex: 9999,
        }}
      />
    );
  }

  return (
    <div
      className="HerbicideCalculatorPage fade-in"
      style={{
        backgroundImage: `url('/images/zebra-plant-bg.jpg')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        minHeight: '100vh',
        padding: '10px',
        color: 'white',
      }}
    >
      {/* Title */}
      <div className="dark-box">
        <h1>Herbicide Calculator</h1>
      </div>

      {/* Sprayer */}
      <div className="dark-box" style={{ position: 'relative', paddingTop: '40px' }}>
        <div className="section-header">Step 1: Select Sprayer Type</div>
        <div style={{ display: 'flex', width: '100%', marginTop: '8px', gap: '10px' }}>
          {['backpack', 'tank'].map((type) => (
            <div
              key={type}
              onClick={() => handleSprayerClick(type)}
              style={{
                width: '50%',
                backgroundColor: 'rgba(200, 200, 200, 0.2)',
                padding: '15px',
                borderRadius: '6px',
                textAlign: 'center',
                cursor: 'pointer',
                border: selectedSprayer === type ? '2px solid #9c9c9c' : '2px solid transparent',
                transition: 'border 0.3s',
              }}
            >
              <p style={{ margin: 0, fontSize: '14px', fontWeight: 'bold' }}>
                {type === 'backpack' ? 'Backpack' : 'Tank'}
              </p>
              <p style={{ margin: 0, fontSize: '12px' }}>
                {type === 'backpack' ? '5 gals' : '25 gals'}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Herbicide */}
      <div className="dark-box" style={{ position: 'relative', marginTop: '20px', paddingTop: '40px' }}>
        <div className="section-header">Step 2: Select Herbicide</div>
        <div style={{ display: 'flex', marginTop: '3px', fontWeight: 'bold', fontSize: '14px' }}>
          <div style={{ width: '50%', textAlign: 'center', fontSize: '12px' }}>Product</div>
          <div style={{ width: '50%', textAlign: 'center', fontSize: '12px' }}>Ratio</div>
        </div>

        {[
          { type: 'roundup', label: 'Roundup', ratio: '6 oz / gal' },
          { type: 'glysophate', label: 'Glysophate', ratio: '10 oz / gal' },
        ].map(({ type, label, ratio }) => (
          <div
            key={type}
            onClick={() => handleHerbicideClick(type)}
            style={{
              display: 'flex',
              width: '100%',
              marginTop: '10px',
              borderRadius: '6px',
              overflow: 'hidden',
              alignItems: 'center',
              cursor: 'pointer',
              border: selectedHerbicide === type ? '2px solid #9c9c9c' : '2px solid transparent',
              transition: 'border 0.3s',
            }}
          >
            <div
              style={{
                width: '50%',
                backgroundColor: 'rgba(200, 200, 200, 0.2)',
                padding: '12px 12px 14px 12px',
                textAlign: 'center',
                fontSize: '14px',
                fontWeight: 'bold',
                borderTopLeftRadius: '6px',
                borderBottomLeftRadius: '6px',
              }}
            >
              {label}
            </div>
            <div
              style={{
                width: '50%',
                backgroundColor: 'rgba(200, 200, 200, 0.2)',
                padding: '12px 12px 14px 12px',
                textAlign: 'center',
                fontSize: '14px',
                borderTopRightRadius: '6px',
                borderBottomRightRadius: '6px',
              }}
            >
              {ratio}
            </div>
          </div>
        ))}
      </div>

      {/* Result Section with animation */}
      <div className="dark-box" style={{ position: 'relative', marginTop: '40px', paddingTop: '40px' }}>
        <div className="section-header">RESULT</div>

        {/* Wrapper that animates height */}
        <div
          ref={wrapperRef}
          style={{
            height: 'auto',
            overflow: 'hidden',
            transition: 'height 0.4s ease',
          }}
        >
          {/* Inner content block we observe */}
          <div
            ref={contentRef}
            style={{
              fontSize: '15px',
              whiteSpace: 'pre-line',
              textAlign: 'center',
              lineHeight: '1.8',
              marginTop: '15px',
              marginBottom: '10px',
              opacity: 1,
              transition: 'opacity 0.3s ease',
            }}
          >
            {selectedSprayer && selectedHerbicide ? (
              <>
                {selectedSprayer === 'backpack' ? '5 gal Backpack Sprayer' : '25 gal Tank Sprayer'}
                {'\n'}x{'\n'}
                {selectedHerbicide === 'roundup' ? '6 oz / gal Roundup' : '10 oz / gal Glysophate'}
                {'\n'}
                <strong style={{ fontSize: '28px', display: 'block', marginTop: '20px' }}>
                  {selectedSprayer === 'backpack'
                    ? selectedHerbicide === 'roundup'
                      ? '= 30 oz Roundup'
                      : '= 50 oz Glysophate'
                    : selectedHerbicide === 'roundup'
                    ? '= 150 oz Roundup'
                    : '= 250 oz Glysophate'}
                </strong>
              </>
            ) : !selectedSprayer && !selectedHerbicide ? (
              <em>(Select Sprayer Type and Herbicide)</em>
            ) : !selectedSprayer ? (
              <em>(Select Sprayer Type)</em>
            ) : (
              <em>(Select Herbicide)</em>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default HerbicideCalculator;
