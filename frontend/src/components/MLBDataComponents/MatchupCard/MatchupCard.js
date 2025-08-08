import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import MLBDataNavbar from '../MLBDataNavbar/MLBDataNavbar';
import Cookies from 'js-cookie';
import TeamHistory from './MatchupCardSelections/TeamHistory/TeamHistory';
import PlayerStats from './MatchupCardSelections/PlayerStats';
import PitcherLastFive from './MatchupCardSelections/PitcherLastFive';
import BatterGamelog from './MatchupCardSelections/BatterGamelog';
import BoxScore from './MatchupCardSelections/BoxScore';
import BeforeAfterScoreBug from './MatchupCardComponents/BeforeAfterScoreBug/BeforeAfterScoreBug';
import LiveScoreBug from './MatchupCardComponents/LiveScoreBug/LiveScoreBug';
import { format } from 'date-fns';

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
  setPlayerStatsSortConfig
}) => {
  const [delayOver, setDelayOver] = useState(false);
  const [fadeIn, setFadeIn] = useState(false);
  const [numGamesToShow, setNumGamesToShow] = useState(5);

  const [contentKeys, setContentKeys] = useState(() => {
    const saved = Cookies.get('contentKeys');
    return saved ? JSON.parse(saved) : {};
  });

  const [starredTeams, setStarredTeams] = useState(() => {
    const saved = Cookies.get('starredTeams');
    return saved ? JSON.parse(saved) : {};
  });

  const [expandedGames, setExpandedGames] = useState(() => {
    const saved = Cookies.get('expandedGames');
    return saved ? JSON.parse(saved) : {};
  });

  const [pitcherLogs, setPitcherLogs] = useState({});
  const contentRefs = useRef({});
  const cardRefs = useRef({});
  const [boxScoreViews, setBoxScoreViews] = useState({});

  const updateContentHeight = (gamePk) => {
    const outer = document.querySelector(`[data-gamepk="${gamePk}"]`);
    const inner = contentRefs.current[gamePk];
    if (outer && inner) {
      outer.style.height = `${inner.offsetHeight}px`;
    }
  };

  useLayoutEffect(() => {
    const timeout = setTimeout(() => {
      visibleGames.forEach((game) => {
        updateContentHeight(game.gamePk);
      });
    }, 10);
    return () => clearTimeout(timeout);
  }, [contentKeys, visibleGames, batterGameLogs, numGamesToShow]);

  useEffect(() => {
    const fetchPitcherGameLog = async (playerId, getTeamAbbreviation, beforeDate) => {
      try {
        const url = `https://statsapi.mlb.com/api/v1/people/${playerId}/stats?stats=gameLog&group=pitching&season=2025`;
        const res = await fetch(url);
        const data = await res.json();
        const splits = data.stats?.[0]?.splits || [];

        const beforeDay = new Date(beforeDate).toISOString().split('T')[0];

        const filtered = splits
          .filter(game => game.date <= beforeDay)
          .sort((a, b) => new Date(b.date) - new Date(a.date))
          .slice(0, 10);

        return filtered.map((game) => ({
          date: game.date,
          opponent: getTeamAbbreviation(game.opponent?.id) || 'N/A',
          inningsPitched: game.stat?.inningsPitched ?? 'N/A',
          hits: game.stat?.hits ?? 'N/A',
          earnedRuns: game.stat?.earnedRuns ?? 'N/A',
          walks: game.stat?.baseOnBalls ?? 'N/A',
          strikeouts: game.stat?.strikeOuts ?? 'N/A',
          result: game.isWin === true ? 'W' : game.isWin === false ? 'L' : 'ND',
        }));
      } catch (err) {
        console.error('Error fetching pitcher game log:', err);
        return [];
      }
    };

    const preloadPitcherData = async () => {
      const logs = {};
      for (const game of visibleGames) {
        const gamePk = game.gamePk;
        const [awayId, homeId] = [
          game.teams.away.probablePitcher?.id,
          game.teams.home.probablePitcher?.id,
        ];
        const [awayGames, homeGames] = await Promise.all([
          awayId ? fetchPitcherGameLog(awayId, getTeamAbbreviation, game.gameDate) : [],
          homeId ? fetchPitcherGameLog(homeId, getTeamAbbreviation, game.gameDate) : [],
        ]);
        logs[gamePk] = { away: awayGames, home: homeGames };
      }
      setPitcherLogs(logs);
    };

    if (!loading && visibleGames.length > 0) {
      preloadPitcherData();
    }
  }, [visibleGames, loading, getTeamAbbreviation]);

  useEffect(() => {
    if (!loading) {
      const timer = setTimeout(() => {
        setDelayOver(true);
        setFadeIn(true);
      }, 2000);
      return () => clearTimeout(timer);
    } else {
      setDelayOver(false);
      setFadeIn(false);
    }
  }, [loading]);

  const handleDataSelectWithAnchor = (newKey, gamePk) => {
    const anchor = cardRefs.current[gamePk];
    const prevY = anchor?.getBoundingClientRect().top;

    setContentKeys((prev) => {
      const updated = { ...prev, [gamePk]: newKey };
      Cookies.set('contentKeys', JSON.stringify(updated), { expires: 365 });
      return updated;
    });

    requestAnimationFrame(() => {
      const newY = anchor?.getBoundingClientRect().top;
      const deltaY = newY - prevY;
      window.scrollBy({ top: deltaY });
    });
  };

  const handleStarClick = (gamePk, teamId) => {
    setStarredTeams((prev) => {
      const updated = prev[gamePk] === teamId
        ? { ...prev, [gamePk]: undefined }
        : { ...prev, [gamePk]: teamId };
      Cookies.set('starredTeams', JSON.stringify(updated), { expires: 365 });
      return updated;
    });
  };

  const toggleGameData = (gamePk) => {
    setExpandedGames((prev) => {
      const updated = { ...prev, [gamePk]: !prev[gamePk] };
      Cookies.set('expandedGames', JSON.stringify(updated), { expires: 365 });
      return updated;
    });
  };

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
            <p className="noGames" style={{ opacity: fadeIn ? 1 : 0, transition: 'opacity 0.5s ease-in' }}>
              Either no teams are selected or no games are scheduled for this date.
            </p>
          ) : (
            <>
              {visibleGames.map((game) => {
                const gamePk = game.gamePk;
                const contentRef = (el) => {
                  if (el) contentRefs.current[gamePk] = el;
                };
                const cardRef = (el) => {
                  if (el) cardRefs.current[gamePk] = el;
                };

                const contentKey = contentKeys[gamePk] || 'team-history';

                const isExpanded = expandedGames[gamePk];
                const contentStyle = {
                  maxHeight: isExpanded ? '1000px' : '0px',
                  overflow: 'hidden',
                  transition: 'max-height 0.7s ease, padding 0.5s ease, opacity 0.5s ease',
                  padding: isExpanded ? '5px' : '0',
                  marginTop: isExpanded ? '5px' : '0',
                  marginBottom: isExpanded ? '12px' : '0',
                  opacity: isExpanded ? 1 : 0,
                };

                const liveData = liveGameData[gamePk];
                const detailedState = liveData?.gameData?.status?.detailedState;
                const isLive = liveData?.gameData?.status?.abstractGameState === 'Live';
                const isPostponed = detailedState === 'Postponed: Rain';
                const now = new Date();
                const scheduledTime = new Date(game.gameDate);
                const hasGameStarted = !isPostponed && now >= scheduledTime;

                return (
                  <div
                    className={`game-container ${
                      selectedTeams.includes(game.teams.away.team.id) ||
                      selectedTeams.includes(game.teams.home.team.id)
                        ? 'fade-in'
                        : 'fade-out'
                    }`}
                    key={gamePk}
                    ref={cardRef}
                  >
                    <div className="game-time-container" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <p className="game-time" style={{ margin: 0 }}>
                        {(() => {
                          const originalDateStr = liveData?.gameData?.datetime?.originalDate;
                          const selected = format(new Date(selectedDate), 'yyyy-MM-dd');
                          const original = originalDateStr ? format(new Date(originalDateStr), 'yyyy-MM-dd') : null;
                          const detailedState = liveData?.gameData?.status?.detailedState ?? '';
                          const isPostponed = detailedState.includes('Postponed') && selected === original;

                          const displayTime = isPostponed
                            ? new Date(originalDateStr)
                            : new Date(game.gameDate);

                          const suffix = isPostponed
                            ? ' (POSTPONED)'
                            : /Delayed/i.test(detailedState)
                            ? ' (DELAYED)'
                            : '';

                          return `${formatTime(displayTime)}${suffix}`;
                        })()}
                      </p>
                      {isLive && (
                        <div className="live-indicator" style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: 'red' }} />
                      )}
                    </div>

                    <div>
                      {isLive && hasGameStarted ? (
                        <LiveScoreBug {...{ game, gamePk, handleStarClick, getTeamLogo, gameBackgroundColors, starredTeams, getTeamRecord, getTeamAbbreviation, liveData: liveData?.liveData }} />
                      ) : (
                        <BeforeAfterScoreBug {...{ game, gamePk, handleStarClick, getTeamLogo, gameBackgroundColors, starredTeams, getTeamRecord, getTeamAbbreviation, liveData }} />
                      )}

                      <div style={{ display: 'flex', justifyContent: 'center', marginTop: '2px' }}>
                        <button
                          onClick={() => toggleGameData(gamePk)}
                          style={{
                            color: 'white',
                            background: 'none',
                            border: 'none',
                            fontSize: '0.6rem',
                            cursor: 'pointer',
                            margin: '1px 0 0 0',
                            padding: 0,
                            transform: isExpanded ? 'rotate(270deg)' : 'rotate(90deg)',
                            transition: 'transform 0.5s',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '12px',
                            height: '12px',
                            lineHeight: '1',
                            overflow: 'hidden',
                          }}
                          aria-label="Toggle Stats"
                        >
                          ▶
                        </button>
                      </div>
                    </div>

                    <div className="game-data-container stat-toggle-container" style={contentStyle}>
                      <select value={contentKey} onChange={(e) => handleDataSelectWithAnchor(e.target.value, gamePk)}>
                        <option value="box-score">BOX SCORE</option>
                        <option value="team-history">TEAM W/L HISTORY</option>
                        <option value="player-stats">PLAYER SEASON STATS</option>
                        <option value="batter-gamelog">PLAYER GAME LOG</option>
                        <option value="pitcher-last-5">PITCHER GAME LOG</option>
                      </select>

                      <div
                        className="stat-section"
                        data-gamepk={gamePk}
                        ref={(el) => {
                          if (el && contentRefs.current[gamePk]) {
                            const inner = contentRefs.current[gamePk];
                            const height = inner.offsetHeight;
                            el.style.height = `${height}px`;
                            el.style.transition = 'height 0.7s ease';
                            requestAnimationFrame(() => {
                              el.style.height = `${height}px`;
                            });
                          }
                        }}
                        style={{
                          overflow: 'hidden',
                          transition: 'height 0.7s ease',
                        }}
                      >
                        <div
                          ref={contentRef}
                          key={contentKey}
                          style={{
                            opacity: 0,
                            animation: 'fadeIn 1.2s ease forwards',
                          }}
                        >
                          {contentKey === 'box-score' && <BoxScore
                                                           liveData={liveData}
                                                           gamePk={gamePk}
                                                           initialShowing={boxScoreViews[gamePk] || 'away'}
                                                           onShowingChange={(newView) =>
                                                             setBoxScoreViews((prev) => ({ ...prev, [gamePk]: newView }))
                                                           }
                                                         />}
                          {contentKey === 'team-history' && <TeamHistory game={game} />}
                          {contentKey === 'player-stats' && (
                            <PlayerStats
                              game={game}
                              batterGameLogs={batterGameLogs}
                              playerStatsSortConfig={playerStatsSortConfig}
                              setPlayerStatsSortConfig={setPlayerStatsSortConfig}
                              setSelectedPlayers={(teamId, playerName) => {
                                const updated = {
                                  ...JSON.parse(Cookies.get('selectedPlayers') || '{}'),
                                  [teamId]: playerName
                                };
                                Cookies.set('selectedPlayers', JSON.stringify(updated), { expires: 365 });
                              }}
                            />
                          )}
                          {contentKey === 'pitcher-last-5' && (
                            <PitcherLastFive
                              game={game}
                              awayGames={pitcherLogs[gamePk]?.away || []}
                              homeGames={pitcherLogs[gamePk]?.home || []}
                            />
                          )}
                          {contentKey === 'batter-gamelog' &&
                            batterGameLogs[game.teams.away.team.id] &&
                            batterGameLogs[game.teams.home.team.id] && (
                              <BatterGamelog
                                teams={[
                                  {
                                    team: game.teams.away.team,
                                    teamType: 'Away',
                                    logs: batterGameLogs[game.teams.away.team.id]?.logs,
                                    roster: batterGameLogs[game.teams.away.team.id]?.roster,
                                  },
                                  {
                                    team: game.teams.home.team,
                                    teamType: 'Home',
                                    logs: batterGameLogs[game.teams.home.team.id]?.logs,
                                    roster: batterGameLogs[game.teams.home.team.id]?.roster,
                                  },
                                ]}
                                gameDate={game.gameDate}
                                getTeamAbbreviation={getTeamAbbreviation}
                                numGamesToShow={numGamesToShow}
                                setNumGamesToShow={setNumGamesToShow}
                              />
                            )}
                        </div>
                      </div>
                    </div>

                  </div>
                );
              })}
            </>
          )}
        </div>
        <div
          style={{
            padding: '4px',
            border: '1px solid #555555',
            borderRadius: '8px',
            backgroundColor: 'rgba(41, 41, 41, 0.85)',
            display: 'inline-block',
            marginBottom: '15px'
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
