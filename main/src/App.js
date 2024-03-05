import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import './App.css';
import Home from './Home';
import NavBar from './NavBar';
import Resume from './Resume';
import LastCommitTimer from './LastCommitTimer';

function App() {
  return (
    <Router>
      <div className="App">
        <NavBar />
        <div className="content">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/home" element={<Home />} />
            <Route path="/resume" element={<Resume />} />
          </Routes>
        </div>
        <div className ="footer">
            <LastCommitTimer />
        </div>
      </div>
    </Router>
  );
}

export default App;