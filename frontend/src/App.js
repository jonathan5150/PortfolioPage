import React from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import './App.css';
import Home from './pages/Home';
import Resume from './pages/Resume';
import ExcelProject from './pages/ExcelProject';
import AlongTheWay from './pages/AlongTheWay';
import SportsDataProject from './pages/SportsDataProject';
import Contact from './pages/Contact';
import HerbicideCalculatorParentPage from './pages/HerbicideCalculatorParentPage';
import HerbicideCalculator from './pages//HerbicideCalculator/HerbicideCalculator';
import MLBData from './pages/MLBData/MLBData';
import Header from './components/PortfolioComponents/Header';


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
          <Route path="/herbicidecalculatorparentpage" element={<HerbicideCalculatorParentPage />} />
          <Route path="/sportsdataproject" element={<SportsDataProject />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/herbicidecalculator" element={<HerbicideCalculator />} />
        </Routes>
      </div>
      <Routes>
        <Route path="/mlbdata" element={<MLBData />} />
      </Routes>
    </div>
  );
}


export default App;
