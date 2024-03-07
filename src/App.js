import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import './App.css';
import Home from './pages/Home';
import Resume from './pages/Resume';
import Projects from './pages/Projects';
import Contact from './pages/Contact';
import Header from './components/Header';
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
            <Route path="/contact" element={<Contact />} />
            <Route path="/projects" element={<Projects />} />
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