import React from 'react';
import './App.css';
import NavBar from './NavBar'; // Import the NavBar component
import Game from './Game';

function App() {
  return (
      <div className="App">
        <NavBar />
        <Game />
      </div>
  );
}

export default App;
