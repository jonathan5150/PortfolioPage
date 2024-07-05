import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import './App.css';
import Home from './pages/Home';
import Resume from './pages/Resume';
import ExcelProject from './pages/ExcelProject';
import AlongTheWay from './pages/AlongTheWay';
import SportsDataProject from './pages/SportsDataProject';
import Contact from './pages/Contact';
import ThisWebsite from './pages/ThisWebsite';
import Header from './components/Header';

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
            <Route path="/excelproject" element={<ExcelProject />} />
            <Route path="/alongtheway" element={<AlongTheWay />} />
            <Route path="/thiswebsite" element={<ThisWebsite />} />
            <Route path="/sportsdataproject" element={<SportsDataProject />} />
            <Route path="/contact" element={<Contact />} />
          </Routes>
        </div>

      </div>
    </Router>
  );
}

export default App;