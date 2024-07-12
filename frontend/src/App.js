import React from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import './App.css';
import Home from './pages/Home';
import Resume from './pages/Resume';
import ExcelProject from './pages/ExcelProject';
import AlongTheWay from './pages/AlongTheWay';
import VehicleSearch from './pages/VehicleSearch';
import SportsDataProject from './pages/SportsDataProject';
import Contact from './pages/Contact';
import ThisWebsite from './pages/ThisWebsite';
import MLBData from './pages/MLBData';
import Header from './components/Header';


function App() {
  return (
    <Router>
      <Main />
    </Router>
  );
}

function Main() {
  const location = useLocation();
  const headerPaths = ['/', '/home', '/resume', '/excelproject', '/alongtheway', '/thiswebsite', '/sportsdataproject', '/vehiclesearch', '/contact'];

  return (
    <div className="App">
      {headerPaths.includes(location.pathname) && <Header />}
      <div className="bg"></div>
      <div className="content">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/home" element={<Home />} />
          <Route path="/resume" element={<Resume />} />
          <Route path="/excelproject" element={<ExcelProject />} />
          <Route path="/alongtheway" element={<AlongTheWay />} />
          <Route path="/thiswebsite" element={<ThisWebsite />} />
          <Route path="/sportsdataproject" element={<SportsDataProject />} />
          <Route path="/vehiclesearch" element={<VehicleSearch />} />
          <Route path="/contact" element={<Contact />} />
        </Routes>
      </div>
        <Routes>
            <Route path="/mlbdata" element={<MLBData />} />
        </Routes>
    </div>
  );
}

export default App;
