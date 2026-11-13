import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import './App.css';
import Home from './pages/Home';
import Header from './components/PortfolioComponents/Header';
import SportsHub from './sports/SportsHub';
// The sports pages' shared stylesheets, loaded once here in one fixed order
// (the order they had before the pages were split into their own downloads).
// Left to the split pages, each imports them in a different order, which the
// production build refuses ("Conflicting order"). They're all scoped to the
// sports pages, so loading them up front changes nothing else.
import './pages/NFLData/NFLData.scss';
import './components/NFLDataComponents/shared/LoadingField.scss';
import './sports/SportSwitcher.scss';
import './sports/DayCalendar.scss';
import './sports/team/TeamSport.scss';
import './sports/SportTitles.scss';
import './sports/ufc/Ufc.scss';
import LoadingField from './components/NFLDataComponents/shared/LoadingField';
// Test site only (hidden on jonathanrainey.dev): font + style preview dropdowns
import StylePicker from './components/PortfolioComponents/StylePicker/StylePicker';

// Every other page is downloaded only when it's opened, so a phone opening the
// sports pages doesn't also download and parse the whole portfolio (and the
// other way round).
const Resume = lazy(() => import('./pages/Resume'));
const ExcelProject = lazy(() => import('./pages/ExcelProject'));
const AlongTheWay = lazy(() => import('./pages/AlongTheWay'));
const SportsDataProject = lazy(() => import('./pages/SportsDataProject'));
const Contact = lazy(() => import('./pages/Contact'));
const HerbicideCalculatorParentPage = lazy(() => import('./pages/HerbicideCalculatorParentPage'));
const HerbicideCalculator = lazy(() => import('./pages/HerbicideCalculator/HerbicideCalculator'));
const NFLData = lazy(() => import('./pages/NFLData/NFLData'));
const TeamSportPage = lazy(() => import('./sports/team/TeamSportPage'));
const UfcPage = lazy(() => import('./sports/ufc/UfcPage'));

// while a sports page's code arrives: the same loading screen its own data
// load shows (dark backdrop, four-sport animation)
const SportsFallback = () => (
  <div
    style={{
      position: 'fixed',
      inset: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(41, 41, 41, 1)',
    }}
  >
    <LoadingField />
  </div>
);

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
    '/herbicidecalculatorparentpage',
  ];

  const hasHeader = headerPaths.includes(location.pathname);

  return (
    <div className="App">
      {hasHeader && <Header />}
      <div className="bg"></div>
      <div className="content" style={{ marginTop: hasHeader ? '90px' : '0px' }}>
        <Suspense fallback={null}>
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
        </Suspense>
      </div>
      <Suspense fallback={<SportsFallback />}>
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
      </Suspense>
      {/* pinned on the portfolio pages, at the end of the page on the sports pages */}
      <StylePicker
        mode={hasHeader ? 'fixed' : location.pathname.toLowerCase().startsWith('/sports') ? 'inline' : 'hidden'}
      />
    </div>
  );
}

export default App;
