import React, { useState } from 'react';

function HerbicideCalculator() {
  const [herbicideLiters, setHerbicideLiters] = useState('');

  const handleChange = (e) => {
    setHerbicideLiters(e.target.value);
  };

  // Placeholder logic: 2L herbicide = 1 gal water
  const waterGallons = herbicideLiters ? (herbicideLiters / 2).toFixed(2) : '';

  return (
    <div className="ScrollableContainer" style={{ textAlign: 'center', padding: '20px' }}>
      <h1>Herbicide Calculator</h1>

      {/* Sprayer Options */}
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: '30px', gap: '40px' }}>
        <div>
          <h3>Backpack Sprayer</h3>
          <p>3 gallons</p>
        </div>
        <div>
          <h3>Tank Sprayer</h3>
          <p>25 gallons</p>
        </div>
      </div>

      {/* Herbicide Input */}
      <div style={{ marginTop: '40px' }}>
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

      {/* Water Output */}
      <div style={{ marginTop: '30px' }}>
        <h4>Water Needed:</h4>
        <p>{waterGallons ? `${waterGallons} gallons` : '-'}</p>
      </div>
    </div>
  );
}

export default HerbicideCalculator;
