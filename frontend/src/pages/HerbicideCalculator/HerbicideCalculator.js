import React, { useState, useEffect } from 'react';
import './HerbicideCalculator.css';

function HerbicideCalculator() {
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const img = new Image();
    img.src = '/images/zebra-plant-bg.jpg';
    img.onload = () => setIsLoaded(true);
  }, []);

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
      {/* Title Row */}
      <div className="dark-box">
        <h1>Herbicide Calculator</h1>
      </div>

      {/* Sprayer Info Row */}
      <div className="dark-box" style={{ position: 'relative', paddingTop: '40px' }}>
        {/* Step Header */}
        <div
          style={{
            position: 'absolute',
            top: '0',
            left: '0',
            width: '100%',
            height: '30px',
            lineHeight: '30px',
            backgroundColor: 'rgba(100, 100, 100, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 'bold',
            fontSize: '14px',
            borderTopLeftRadius: '12px',
            borderTopRightRadius: '12px'
          }}
        >
          Step 1: Select Sprayer Type
        </div>

        {/* Sprayer Options */}
        <div style={{ display: 'flex', width: '100%', marginTop: '8px', gap: '10px' }}>
          <div
            style={{
              width: '50%',
              backgroundColor: 'rgba(200, 200, 200, 0.2)',
              padding: '15px',
              borderRadius: '6px',
              boxSizing: 'border-box',
              textAlign: 'center'
            }}
          >
            <p style={{ margin: 0, fontSize: '14px', fontWeight: 'bold' }}>Backpack Sprayer</p>
            <p style={{ margin: 0, fontSize: '12px' }}>5 gallons</p>
          </div>
          <div
            style={{
              width: '50%',
              backgroundColor: 'rgba(200, 200, 200, 0.2)',
              padding: '15px',
              borderRadius: '6px',
              boxSizing: 'border-box',
              textAlign: 'center'
            }}
          >
            <p style={{ margin: 0, fontSize: '14px', fontWeight: 'bold' }}>Tank Sprayer</p>
            <p style={{ margin: 0, fontSize: '12px' }}>25 gallons</p>
          </div>
        </div>
      </div>

      {/* Input Row */}
      <div className="dark-box" style={{ position: 'relative', marginTop: '20px', paddingTop: '40px' }}>
        {/* Step Header */}
        <div
          style={{
            position: 'absolute',
            top: '0',
            left: '0',
            width: '100%',
            height: '30px',
            lineHeight: '30px',
            backgroundColor: 'rgba(100, 100, 100, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 'bold',
            fontSize: '14px',
            borderTopLeftRadius: '12px',
            borderTopRightRadius: '12px'
          }}
        >
          Step 2: Select Herbicide
        </div>

        <label htmlFor="herbicide-input"><strong>Roundup</strong></label>
      </div>

      {/* Water Needed Row */}
      <div className="dark-box" style={{ position: 'relative', marginTop: '20px', paddingTop: '40px' }}>
        {/* Step Header */}
        <div
          style={{
            position: 'absolute',
            top: '0',
            left: '0',
            width: '100%',
            height: '30px',
            lineHeight: '30px',
            backgroundColor: 'rgba(100, 100, 100, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 'bold',
            fontSize: '14px',
            borderTopLeftRadius: '12px',
            borderTopRightRadius: '12px'
          }}
        >
          RESULT
        </div>

        <label>
          <strong>
            4 Liters
          </strong>
        </label>
      </div>
    </div>
  );
}

export default HerbicideCalculator;
