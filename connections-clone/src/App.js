import React from 'react';
import './App.css';
import NavBar from './NavBar'; // Import the NavBar component

function App() {
  return (
      <div className="App">
        {/* Include the NavBar component */}
        <NavBar />

        <header className="App-header">
          {/* Remove the title from here */}
        </header>
      </div>
  );
}

export default App;
