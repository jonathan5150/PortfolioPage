import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import './App.css';
import Home from './pages/Home';
import Header from './components/Header';
import Resume from './pages/Resume';
import LastCommitTimer from './components/LastCommitTimer';

function App() {
  return (
    <Router>
      <div className="App">
        <Header />
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