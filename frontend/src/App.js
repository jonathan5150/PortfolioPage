import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import './App.css';
import Home from './pages/Home';
import Resume from './pages/Resume';
import ExcelProject from './pages/ExcelProject';
import AlongTheWay from './pages/AlongTheWay';
import SportsDataProject from './pages/SportsDataProject';
import Contact from './pages/Contact';
import HerbicideCalculatorParentPage from './pages/HerbicideCalculatorParentPage';
import HerbicideCalculator from './pages//HerbicideCalculator/HerbicideCalculator';
import NFLData from './pages/NFLData/NFLData';
import Header from './components/PortfolioComponents/Header';
import SportsHub from './sports/SportsHub';
import TeamSportPage from './sports/team/TeamSportPage';
import UfcPage from './sports/ufc/UfcPage';


function App() {
  return (
    <Router>
      <Main />
    </Router>
  );
}

function Main() {
  const location = useLocation();
  const headerPaths = [
    '/',
    '/home',
    '/resume',
    '/excelproject',
    '/alongtheway',
    '/sportsdataproject',
    '/contact',
    '/herbicidecalculatorparentpage'
  ];

  const hasHeader = headerPaths.includes(location.pathname);

  return (
    <div className="App">
      {hasHeader && <Header />}
      <div className="bg"></div>
      <div
        className="content"
        style={{ marginTop: hasHeader ? '90px' : '0px' }}
      >
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/home" element={<Home />} />
          <Route path="/resume" element={<Resume />} />
          <Route path="/excelproject" element={<ExcelProject />} />
          <Route path="/alongtheway" element={<AlongTheWay />} />
          <Route path="/herbicidecalculator" element={<HerbicideCalculator />} />
          <Route path="/herbicidecalculatorparentpage" element={<HerbicideCalculatorParentPage />} />
          <Route path="/sportsdataproject" element={<SportsDataProject />} />
          <Route path="/contact" element={<Contact />} />
        </Routes>
      </div>
      <Routes>
        {/* the sports data project: /sports opens the saved or in-season sport */}
        <Route path="/sports" element={<SportsHub />} />
        <Route path="/sports/nfl" element={<NFLData />} />
        <Route path="/sports/mlb" element={<TeamSportPage key="mlb" lg="mlb" />} />
        <Route path="/sports/nba" element={<TeamSportPage key="nba" lg="nba" />} />
        <Route path="/sports/ufc" element={<UfcPage />} />
        {/* old addresses */}
        <Route path="/nfldata" element={<Navigate to="/sports/nfl" replace />} />
        <Route path="/mlbdata" element={<Navigate to="/sports/mlb" replace />} />
      </Routes>
    </div>
  );
}


export default App;
