import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import Scoreboard from './Scoreboard';
import MLBDataNavbar from './MLBDataNavbar';
import Cookies from 'js-cookie';
import TeamHistory from './MatchupCardSelections/TeamHistory';
import PlayerStats from './MatchupCardSelections/PlayerStats';
import PitcherMatchup from './MatchupCardComponents/PitcherMatchup';
import PitcherLastFive from './MatchupCardSelections/PitcherLastFive';
import BatterGamelog from './MatchupCardSelections/BatterGamelog';

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
  const [contentKey, setContentKey] = useState('team-history');
  const [starredTeams, setStarredTeams] = useState(() => {
    const saved = Cookies.get('starredTeams');
    return saved ? JSON.parse(saved) : {};
  });

  const [pitcherLogs, setPitcherLogs] = useState({});
  const [contentHeights, setContentHeights] = useState({});
  const contentRefs = useRef({});

  const updateContentHeight = (gamePk) => {
    const ref = contentRefs.current[gamePk];
    if (ref) {
      setContentHeights((prev) => ({
        ...prev,
        [gamePk]: ref.scrollHeight + 'px'
      }));
    }
  };

  useLayoutEffect(() => {
    const timeout = setTimeout(() => {
      visibleGames.forEach((game) => {
        updateContentHeight(game.gamePk);
      });
    }, 10); // allow render to finish
    return () => clearTimeout(timeout);
  }, [contentKey, visibleGames, batterGameLogs, numGamesToShow]);

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

        logs[gamePk] = {
          away: awayGames,
          home: homeGames,
        };
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

  const handleDataSelect = (dataType) => {
    if (dataType !== contentKey) setContentKey(dataType);
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
            No games scheduled for this date.
          </p>
        ) : (
          visibleGames.map((game) => {
            const gamePk = game.gamePk;
            const contentRef = (el) => {
              if (el) contentRefs.current[gamePk] = el;
            };

            const contentStyle = {
              height: contentHeights[gamePk] || 'auto',
              overflow: 'hidden',
              transition: 'height 0.6s ease'
            };

            return (
              <div
                className={`game-container ${
                  selectedTeams.includes(game.teams.away.team.id) ||
                  selectedTeams.includes(game.teams.home.team.id)
                    ? 'fade-in'
                    : 'fade-out'
                }`}
                key={gamePk}
              >
                <div className="game-time-container">
                  <p className="game-time">
                    {game.gameDate ? formatTime(game.gameDate) : 'Time not available'}
                  </p>
                </div>

                <div className="matchup-group">
                  <div className="matchup-columns">
                    <div className="column1">
                      <div className="row1">
                        <div
                          className="team-logo-container"
                          onClick={() => handleStarClick(gamePk, game.teams.away.team.id)}
                        >
                          <img
                            src={getTeamLogo(game.teams.away.team.name)}
                            alt={`${game.teams.away.team.name} logo`}
                            style={{ border: `2px solid ${gameBackgroundColors[gamePk]?.away}` }}
                          />
                          {starredTeams[gamePk] === game.teams.away.team.id && (
                            <div className="star-icon">⭐</div>
                          )}
                        </div>
                      </div>
                      <div className="row2">
                        <div
                          className="team-logo-container"
                          onClick={() => handleStarClick(gamePk, game.teams.home.team.id)}
                        >
                          <img
                            src={getTeamLogo(game.teams.home.team.name)}
                            alt={`${game.teams.home.team.name} logo`}
                            style={{ border: `2px solid ${gameBackgroundColors[gamePk]?.home}` }}
                          />
                          {starredTeams[gamePk] === game.teams.home.team.id && (
                            <div className="star-icon">⭐</div>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="column2">
                      <PitcherMatchup game={game} getTeamRecord={getTeamRecord} />
                    </div>
                  </div>
                </div>

                <div className="game-data">
                  <Scoreboard
                    game={game}
                    getTeamAbbreviation={getTeamAbbreviation}
                    liveData={liveGameData[gamePk]?.liveData}
                  />

                  <div className="game-data-container stat-toggle-container">
                    <select value={contentKey} onChange={(e) => handleDataSelect(e.target.value)}>
                      <option value="team-history">TEAM W/L HISTORY</option>
                      <option value="player-stats">BATTER SEASON STATS</option>
                      <option value="batter-gamelog">BATTER GAME LOG</option>
                      <option value="pitcher-last-5">PITCHER GAME LOG</option>
                    </select>

                    <div className="stat-section" style={contentStyle}>
                      <div ref={contentRef}>
                        {contentKey === 'team-history' && (
                          <div className="fade-in">
                            <TeamHistory game={game} />
                          </div>
                        )}
                        {contentKey === 'player-stats' && (
                          <div className="fade-in">
                            <PlayerStats
                              game={game}
                              batterGameLogs={batterGameLogs}
                              playerStatsSortConfig={playerStatsSortConfig}
                              setPlayerStatsSortConfig={setPlayerStatsSortConfig}
                            />
                          </div>
                        )}
                        {contentKey === 'pitcher-last-5' && (
                          <div className="fade-in">
                            <PitcherLastFive
                              game={game}
                              awayGames={pitcherLogs[gamePk]?.away || []}
                              homeGames={pitcherLogs[gamePk]?.home || []}
                            />
                          </div>
                        )}
                        {contentKey === 'batter-gamelog' &&
                          batterGameLogs[game.teams.away.team.id] &&
                          batterGameLogs[game.teams.home.team.id] && (
                            <div className="fade-in">
                              <BatterGamelog
                                teams={[
                                  {
                                    team: game.teams.away.team,
                                    teamType: 'Away',
                                    logs: batterGameLogs[game.teams.away.team.id]?.logs,
                                    roster: batterGameLogs[game.teams.away.team.id]?.roster
                                  },
                                  {
                                    team: game.teams.home.team,
                                    teamType: 'Home',
                                    logs: batterGameLogs[game.teams.home.team.id]?.logs,
                                    roster: batterGameLogs[game.teams.home.team.id]?.roster
                                  }
                                ]}
                                gameDate={game.gameDate}
                                getTeamAbbreviation={getTeamAbbreviation}
                                numGamesToShow={numGamesToShow}
                                setNumGamesToShow={setNumGamesToShow}
                              />
                            </div>
                          )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default MatchupCard;
