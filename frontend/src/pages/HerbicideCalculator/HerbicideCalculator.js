import React, { useState, useEffect } from 'react';
import './HerbicideCalculator.css';

function HerbicideCalculator() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [selectedSprayer, setSelectedSprayer] = useState(null);
  const [selectedHerbicide, setSelectedHerbicide] = useState(null);

  useEffect(() => {
    const img = new Image();
    img.src = '/images/zebra-plant-bg.jpg';
    img.onload = () => setIsLoaded(true);
  }, []);

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
      {/* Title Row */}
      <div className="dark-box">
        <h1>Herbicide Calculator</h1>
      </div>

      {/* Sprayer Info Row */}
      <div className="dark-box" style={{ position: 'relative', paddingTop: '40px' }}>
        <div className="section-header">Step 1: Select Sprayer Type</div>
        <div style={{ display: 'flex', width: '100%', marginTop: '8px', gap: '10px' }}>
          <div
            onClick={() => handleSprayerClick('backpack')}
            style={{
              width: '50%',
              backgroundColor: 'rgba(200, 200, 200, 0.2)',
              padding: '15px',
              borderRadius: '6px',
              boxSizing: 'border-box',
              textAlign: 'center',
              cursor: 'pointer',
              border: selectedSprayer === 'backpack' ? '2px solid white' : '2px solid transparent',
              transition: 'border 0.3s',
            }}
          >
            <p style={{ margin: 0, fontSize: '14px', fontWeight: 'bold' }}>Backpack</p>
            <p style={{ margin: 0, fontSize: '12px' }}>5 gals</p>
          </div>
          <div
            onClick={() => handleSprayerClick('tank')}
            style={{
              width: '50%',
              backgroundColor: 'rgba(200, 200, 200, 0.2)',
              padding: '15px',
              borderRadius: '6px',
              boxSizing: 'border-box',
              textAlign: 'center',
              cursor: 'pointer',
              border: selectedSprayer === 'tank' ? '2px solid white' : '2px solid transparent',
              transition: 'border 0.3s',
            }}
          >
            <p style={{ margin: 0, fontSize: '14px', fontWeight: 'bold' }}>Tank</p>
            <p style={{ margin: 0, fontSize: '12px' }}>25 gals</p>
          </div>
        </div>
      </div>

      {/* Herbicide Row */}
      <div className="dark-box" style={{ position: 'relative', marginTop: '20px', paddingTop: '40px' }}>
        <div className="section-header">Step 2: Select Herbicide</div>
        <div style={{ display: 'flex', marginTop: '3px', fontWeight: 'bold', fontSize: '14px' }}>
          <div style={{ width: '50%', textAlign: 'center', fontSize: '12px' }}>Product</div>
          <div style={{ width: '50%', textAlign: 'center', fontSize: '12px' }}>Ratio</div>
        </div>

        {/* Roundup */}
        <div
          onClick={() => handleHerbicideClick('roundup')}
          style={{
            display: 'flex',
            width: '100%',
            marginTop: '10px',
            borderRadius: '6px',
            overflow: 'hidden',
            alignItems: 'center',
            cursor: 'pointer',
            border: selectedHerbicide === 'roundup' ? '2px solid white' : '2px solid transparent',
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
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            Roundup
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
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            6 oz / gal
          </div>
        </div>

        {/* Glysophate */}
        <div
          onClick={() => handleHerbicideClick('glysophate')}
          style={{
            display: 'flex',
            width: '100%',
            marginTop: '10px',
            borderRadius: '6px',
            overflow: 'hidden',
            alignItems: 'center',
            cursor: 'pointer',
            border: selectedHerbicide === 'glysophate' ? '2px solid white' : '2px solid transparent',
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
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            Glysophate
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
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            10 oz / gal
          </div>
        </div>
      </div>

      {/* Result Row */}
      <div className="dark-box" style={{ position: 'relative', marginTop: '40px', paddingTop: '40px' }}>
        <div className="section-header">RESULT</div>
        <div style={{ fontSize: '15px', whiteSpace: 'pre-line', textAlign: 'center', lineHeight: '1.8', marginTop: '15px', marginBottom: '10px' }}>
          {selectedSprayer && selectedHerbicide ? (
            <>
              {selectedSprayer === 'backpack' ? '5 gal Backpack Sprayer' : '25 gal Tank Sprayer'}
              {'\n'}x{'\n'}
              {selectedHerbicide === 'roundup' ? '6 oz / gal Roundup' : '10 oz / gal Glysophate'}
              {'\n'}
              <strong style={{ fontSize: '28px', marginTop: '20px', marginBottom: '10px', display: 'block' }}>
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
  );
}

export default HerbicideCalculator;
