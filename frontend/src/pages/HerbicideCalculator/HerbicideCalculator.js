import React, { useState, useEffect } from 'react';
import './HerbicideCalculator.css';

function HerbicideCalculator() {
  const [herbicideLiters, setHerbicideLiters] = useState('');
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const img = new Image();
    img.src = '/images/zebra-plant-bg.jpg';
    img.onload = () => setIsLoaded(true);
  }, []);

  const handleChange = (e) => {
    setHerbicideLiters(e.target.value);
  };

  const waterGallons = herbicideLiters ? (herbicideLiters / 2).toFixed(2) : '';

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
      <div className="dark-box">
        <div style={{ display: 'flex', justifyContent: 'center', gap: '50px' }}>
          <div>
            <h3>Backpack Sprayer</h3>
            <p>3 gallons</p>
          </div>
          <div>
            <h3>Tank Sprayer</h3>
            <p>25 gallons</p>
          </div>
        </div>
      </div>

      {/* Input Row */}
      <div className="dark-box" style={{ marginTop: '20px' }}>
        <label htmlFor="herbicide-input"><strong>Herbicide Amount (Liters):</strong></label>
        <br />
        <input
          id="herbicide-input"
          type="number"
          value={herbicideLiters}
          onChange={handleChange}
          placeholder="Enter amount in liters"
          style={{ marginTop: '10px', padding: '8px', width: '200px' }}
        />
      </div>

      {/* Water Needed Row */}
      <div className="dark-box" style={{ marginTop: '20px' }}>
        <h4>Water Needed:</h4>
        <p>{waterGallons ? `${waterGallons} gallons` : '-'}</p>
      </div>
    </div>
  );
}

export default HerbicideCalculator;
