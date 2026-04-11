import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  memo,
  useRef,
  useLayoutEffect,
} from 'react';
import MLBDataNavbar from '../MLBDataNavbar/MLBDataNavbar';
import Cookies from 'js-cookie';
import TeamHistory from './MatchupCardSelections/TeamHistory/TeamHistory';
import PlayerStats from './MatchupCardSelections/PlayerStats';
import PitcherLastFive from './MatchupCardSelections/PitcherLastFive';
import BatterGamelog from './MatchupCardSelections/BatterGamelog';
import BoxScore from './MatchupCardSelections/BoxScore';
import BeforeScoreBug from './MatchupCardComponents/BeforeScoreBug/BeforeScoreBug';
import AfterScoreBug from './MatchupCardComponents/AfterScoreBug/AfterScoreBug';
import LiveScoreBug from './MatchupCardComponents/LiveScoreBug/LiveScoreBug';
//import { format } from 'date-fns';

const STAT_OPTIONS = [
  { value: 'box-score', label: 'BOX SCORE' },
  { value: 'team-history', label: 'TEAM W/L HISTORY' },
  { value: 'player-stats', label: 'PLAYER SEASON STATS' },
  { value: 'batter-gamelog', label: 'PLAYER GAME LOG' },
  { value: 'pitcher-last-5', label: 'PITCHER GAME LOG' },
];

const GameCard = memo(function GameCard({
  game,
  selectedDate,
  formatTime,
  getTeamLogo,
  getTeamAbbreviation,
  liveData,
  gameBackgroundColors,
  batterGameLogs,
  playerStatsSortConfig,
  setPlayerStatsSortConfig,
}) {
  const gamePk = game.gamePk;

  const [contentKey, setContentKey] = useState(() => {
    const saved = Cookies.get('contentKeys');
    if (!saved) return 'team-history';

    try {
      const parsed = JSON.parse(saved);
      return parsed?.[gamePk] || 'team-history';
    } catch {
      return 'team-history';
    }
  });

  const [isExpanded, setIsExpanded] = useState(() => {
    const saved = Cookies.get('expandedGames');
    if (!saved) return false;

    try {
      const parsed = JSON.parse(saved);
      return !!parsed?.[gamePk];
    } catch {
      return false;
    }
  });

  const [boxScoreView, setBoxScoreView] = useState(() => {
    const saved = Cookies.get('boxScoreViews');
    if (!saved) return 'away';

    try {
      const parsed = JSON.parse(saved);
      return parsed?.[gamePk] || 'away';
    } catch {
      return 'away';
    }
  });

  const [numGamesToShow, setNumGamesToShow] = useState(() => {
    const saved = Cookies.get('numGamesToShowByGame');
    if (!saved) return 5;

    try {
      const parsed = JSON.parse(saved);
      return parsed?.[gamePk] || 5;
    } catch {
      return 5;
    }
  });

  const contentInnerRef = useRef(null);
  const resizeObserverRef = useRef(null);
  const animationFrameRef = useRef(null);
  const isTransitioningRef = useRef(false);
  const [animatedHeight, setAnimatedHeight] = useState(isExpanded ? 'auto' : '0px');

  const measureInnerHeight = useCallback(() => {
    const inner = contentInnerRef.current;
    if (!inner) return 0;
    return inner.scrollHeight;
  }, []);

  const handleContentChange = useCallback(
    (newKey) => {
      const inner = contentInnerRef.current;

      if (inner && isExpanded) {
        const currentHeight =
          animatedHeight === 'auto'
            ? inner.scrollHeight
            : parseFloat(animatedHeight) || inner.scrollHeight;

        setAnimatedHeight(`${currentHeight}px`);
        isTransitioningRef.current = true;

        requestAnimationFrame(() => {
          setContentKey(newKey);
        });
      } else {
        setContentKey(newKey);
      }

      try {
        const existing = JSON.parse(Cookies.get('contentKeys') || '{}');
        Cookies.set(
          'contentKeys',
          JSON.stringify({
            ...existing,
            [gamePk]: newKey,
          }),
          { expires: 365 }
        );
      } catch {
        Cookies.set('contentKeys', JSON.stringify({ [gamePk]: newKey }), {
          expires: 365,
        });
      }
    },
    [gamePk, isExpanded, animatedHeight]
  );

  const toggleGameData = useCallback(() => {
    const nextExpanded = !isExpanded;
    setIsExpanded(nextExpanded);

    try {
      const existing = JSON.parse(Cookies.get('expandedGames') || '{}');
      Cookies.set(
        'expandedGames',
        JSON.stringify({
          ...existing,
          [gamePk]: nextExpanded,
        }),
        { expires: 365 }
      );
    } catch {
      Cookies.set('expandedGames', JSON.stringify({ [gamePk]: nextExpanded }), {
        expires: 365,
      });
    }
  }, [gamePk, isExpanded]);

  const handleBoxScoreViewChange = useCallback(
    (newView) => {
      setBoxScoreView(newView);

      try {
        const existing = JSON.parse(Cookies.get('boxScoreViews') || '{}');
        Cookies.set(
          'boxScoreViews',
          JSON.stringify({
            ...existing,
            [gamePk]: newView,
          }),
          { expires: 365 }
        );
      } catch {
        Cookies.set('boxScoreViews', JSON.stringify({ [gamePk]: newView }), {
          expires: 365,
        });
      }
    },
    [gamePk]
  );

  const handleNumGamesToShowChange = useCallback(
    (valueOrUpdater) => {
      setNumGamesToShow((prev) => {
        const nextValue =
          typeof valueOrUpdater === 'function'
            ? valueOrUpdater(prev)
            : valueOrUpdater;

        try {
          const existing = JSON.parse(Cookies.get('numGamesToShowByGame') || '{}');
          Cookies.set(
            'numGamesToShowByGame',
            JSON.stringify({
              ...existing,
              [gamePk]: nextValue,
            }),
            { expires: 365 }
          );
        } catch {
          Cookies.set(
            'numGamesToShowByGame',
            JSON.stringify({ [gamePk]: nextValue }),
            { expires: 365 }
          );
        }

        return nextValue;
      });
    },
    [gamePk]
  );

  const detailedState = liveData?.gameData?.status?.detailedState ?? '';
  const abstractGameState = liveData?.gameData?.status?.abstractGameState ?? '';

  const isLive = abstractGameState === 'Live';
  const isFinal =
    abstractGameState === 'Final' ||
    detailedState === 'Final' ||
    detailedState === 'Completed Early' ||
    detailedState === 'Game Over';

  const isPostponed = detailedState.includes('Postponed');
  const now = new Date();
  const scheduledTime = new Date(game.gameDate);
  const hasGameStarted = !isPostponed && now >= scheduledTime;

  const awayTeamId = game.teams.away.team.id;
  const homeTeamId = game.teams.home.team.id;

  const awayBatterData = batterGameLogs?.[awayTeamId];
  const homeBatterData = batterGameLogs?.[homeTeamId];

  const statContent = useMemo(() => {
    switch (contentKey) {
      case 'box-score':
        return (
          <BoxScore
            liveData={liveData}
            gamePk={gamePk}
            initialShowing={boxScoreView}
            onShowingChange={handleBoxScoreViewChange}
          />
        );

      case 'team-history':
        return <TeamHistory game={game} />;

      case 'player-stats':
        return (
          <PlayerStats
            game={game}
            batterGameLogs={batterGameLogs}
            playerStatsSortConfig={playerStatsSortConfig}
            setPlayerStatsSortConfig={setPlayerStatsSortConfig}
            setSelectedPlayers={(teamId, playerName) => {
              const updated = {
                ...JSON.parse(Cookies.get('selectedPlayers') || '{}'),
                [teamId]: playerName,
              };
              Cookies.set('selectedPlayers', JSON.stringify(updated), {
                expires: 365,
              });
            }}
          />
        );

      case 'pitcher-last-5':
        return (
          <PitcherLastFive
            game={game}
            awayGames={game.teams.away.probablePitcher?.lastFiveStarts || []}
            homeGames={game.teams.home.probablePitcher?.lastFiveStarts || []}
          />
        );

      case 'batter-gamelog':
        if (!awayBatterData || !homeBatterData) return null;

        return (
          <BatterGamelog
            teams={[
              {
                team: game.teams.away.team,
                teamType: 'Away',
                logs: awayBatterData.logs,
                roster: awayBatterData.roster,
              },
              {
                team: game.teams.home.team,
                teamType: 'Home',
                logs: homeBatterData.logs,
                roster: homeBatterData.roster,
              },
            ]}
            gameDate={game.gameDate}
            getTeamAbbreviation={getTeamAbbreviation}
            numGamesToShow={numGamesToShow}
            setNumGamesToShow={handleNumGamesToShowChange}
          />
        );

      default:
        return <TeamHistory game={game} />;
    }
  }, [
    batterGameLogs,
    boxScoreView,
    contentKey,
    game,
    gamePk,
    getTeamAbbreviation,
    handleBoxScoreViewChange,
    homeBatterData,
    awayBatterData,
    liveData,
    numGamesToShow,
    playerStatsSortConfig,
    setPlayerStatsSortConfig,
    handleNumGamesToShowChange,
  ]);

  useLayoutEffect(() => {
    const inner = contentInnerRef.current;
    if (!inner) return;

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (!isExpanded) {
      const currentHeight =
        animatedHeight === 'auto'
          ? inner.scrollHeight
          : parseFloat(animatedHeight) || inner.scrollHeight;

      setAnimatedHeight(`${currentHeight}px`);

      animationFrameRef.current = requestAnimationFrame(() => {
        animationFrameRef.current = requestAnimationFrame(() => {
          setAnimatedHeight('0px');
        });
      });

      return;
    }

    const nextHeight = `${measureInnerHeight()}px`;
    setAnimatedHeight(nextHeight);
    isTransitioningRef.current = true;
  }, [isExpanded, contentKey, numGamesToShow, boxScoreView, statContent, animatedHeight, measureInnerHeight]);

  useEffect(() => {
    const inner = contentInnerRef.current;
    if (!inner || !isExpanded) return;

    if (resizeObserverRef.current) {
      resizeObserverRef.current.disconnect();
    }

    resizeObserverRef.current = new ResizeObserver(() => {
      const currentInner = contentInnerRef.current;
      if (!currentInner || !isExpanded) return;

      const nextHeight = `${currentInner.scrollHeight}px`;

      if (animatedHeight === 'auto') {
        setAnimatedHeight(nextHeight);

        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            if (isExpanded) {
              isTransitioningRef.current = true;
            }
          });
        });
      } else {
        setAnimatedHeight(nextHeight);
        isTransitioningRef.current = true;
      }
    });

    resizeObserverRef.current.observe(inner);

    return () => {
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
        resizeObserverRef.current = null;
      }
    };
  }, [isExpanded, animatedHeight]);

  useEffect(() => {
    return () => {
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  const handleHeightTransitionEnd = useCallback((e) => {
    if (e.propertyName !== 'height') return;

    if (isExpanded) {
      setAnimatedHeight('auto');
    }

    isTransitioningRef.current = false;
  }, [isExpanded]);

  return (
    <div className="game-container" style={{ position: 'relative' }}>
      <div>
        {isLive && hasGameStarted ? (
          <LiveScoreBug
            game={game}
            gamePk={gamePk}
            getTeamLogo={getTeamLogo}
            gameBackgroundColors={gameBackgroundColors}
            getTeamAbbreviation={getTeamAbbreviation}
            liveData={liveData?.liveData}
            showScoreboard={isExpanded}
            onToggleStats={toggleGameData}
          />
        ) : isFinal ? (
          <AfterScoreBug
            game={game}
            gamePk={gamePk}
            getTeamLogo={getTeamLogo}
            gameBackgroundColors={gameBackgroundColors}
            getTeamAbbreviation={getTeamAbbreviation}
            liveData={liveData}
            showScoreboard={isExpanded}
            onToggleStats={toggleGameData}
          />
        ) : (
          <div onClick={toggleGameData} style={{ cursor: 'pointer' }}>
            <BeforeScoreBug
              game={game}
              gamePk={gamePk}
              getTeamLogo={getTeamLogo}
              gameBackgroundColors={gameBackgroundColors}
              getTeamAbbreviation={getTeamAbbreviation}
              liveData={liveData}
            />
          </div>
        )}
      </div>

      <div
        className="game-data-container stat-toggle-container"
        onTransitionEnd={handleHeightTransitionEnd}
        style={{
          overflow: 'hidden',
          height: isExpanded ? animatedHeight : '0px',
          opacity: isExpanded ? 1 : 0,
          transform: isExpanded ? 'translateY(0)' : 'translateY(-6px)',
          padding: isExpanded ? '5px' : '0 5px',
          marginTop: isExpanded ? '0px' : '0',
          marginBottom: isExpanded ? '7px' : '0',
          pointerEvents: isExpanded ? 'auto' : 'none',
          transition:
            'height 0.35s ease, opacity 0.25s ease, transform 0.25s ease, padding 0.25s ease, margin 0.25s ease',
          willChange: 'height, opacity, transform',
        }}
      >
        <div ref={contentInnerRef}>
          <select
            value={contentKey}
            onChange={(e) => handleContentChange(e.target.value)}
          >
            {STAT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <div
            className="stat-section"
            style={{
              marginBottom: '0px',
            }}
          >
            <div
              style={{
                opacity: isExpanded ? 1 : 0,
                transition: 'opacity 0.2s ease',
              }}
            >
              {statContent}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

const MatchupCard = ({
  loading,
  visibleGames,
  selectedTeams,
  getTeamLogo,
  getTeamRecord,
  formatTime,
  getTeamAbbreviation,
  liveGameData,
  selectedDate,
  setSelectedDate,
  isCalendarOpen,
  setIsCalendarOpen,
  isTeamsMenuOpen,
  setIsTeamsMenuOpen,
  mlbTeams,
  handleTeamChange,
  handleSelectAll,
  handleDeselectAll,
  teamsMenuRef,
  todayGames,
  gameBackgroundColors,
  batterGameLogs,
  playerStatsSortConfig,
  setPlayerStatsSortConfig,
}) => {
  const [delayOver, setDelayOver] = useState(false);
  const [fadeIn, setFadeIn] = useState(false);

  useEffect(() => {
    if (!loading) {
      const timer = setTimeout(() => {
        setDelayOver(true);
        setFadeIn(true);
      }, 2000);

      return () => clearTimeout(timer);
    }

    setDelayOver(false);
    setFadeIn(false);
  }, [loading]);

  return (
    <div className="matchup-card fade-in">
      <MLBDataNavbar
        selectedDate={selectedDate}
        setSelectedDate={setSelectedDate}
        isCalendarOpen={isCalendarOpen}
        setIsCalendarOpen={setIsCalendarOpen}
        isTeamsMenuOpen={isTeamsMenuOpen}
        setIsTeamsMenuOpen={setIsTeamsMenuOpen}
        mlbTeams={mlbTeams}
        selectedTeams={selectedTeams}
        handleTeamChange={handleTeamChange}
        handleSelectAll={handleSelectAll}
        handleDeselectAll={handleDeselectAll}
        teamsMenuRef={teamsMenuRef}
      />

      <div className="matchup-container">
        {loading ? (
          <div className="loading">
            <img src={`${process.env.PUBLIC_URL}/baseball.gif`} alt="Loading..." />
            <p>loading...</p>
          </div>
        ) : delayOver && visibleGames.length === 0 ? (
          <p
            className="noGames"
            style={{ opacity: fadeIn ? 1 : 0, transition: 'opacity 0.7s ease-in' }}
          >
            Either no teams are selected or no games are scheduled for this date.
          </p>
        ) : (
          visibleGames.map((game) => (
            <GameCard
              key={game.gamePk}
              game={game}
              selectedDate={selectedDate}
              formatTime={formatTime}
              getTeamLogo={getTeamLogo}
              getTeamRecord={getTeamRecord}
              getTeamAbbreviation={getTeamAbbreviation}
              liveData={liveGameData[game.gamePk]}
              gameBackgroundColors={gameBackgroundColors}
              batterGameLogs={batterGameLogs}
              playerStatsSortConfig={playerStatsSortConfig}
              setPlayerStatsSortConfig={setPlayerStatsSortConfig}
            />
          ))
        )}
      </div>

      <div
        style={{
          padding: '4px',
          border: '1px solid #555555',
          borderRadius: '8px',
          backgroundColor: 'rgba(41, 41, 41, 0.85)',
          display: 'inline-block',
          marginBottom: '15px',
        }}
      >
        <div
          style={{
            padding: '6px 12px',
            border: '2px solid rgb(85, 85, 85)',
            borderRadius: '6px',
            backgroundColor: 'rgba(70, 70, 70, 0.8)',
            color: 'white',
            fontSize: '12px',
            textAlign: 'center',
          }}
        >
          Games Displayed: {visibleGames.length}/{Object.keys(liveGameData).length}
        </div>
      </div>
    </div>
  );
};

export default MatchupCard;