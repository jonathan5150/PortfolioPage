import React, { useState, useEffect } from 'react';
import Scoreboard from './Scoreboard';
import MLBDataNavbar from './MLBDataNavbar';
import Cookies from 'js-cookie';
import TeamHistory from './MatchupCardSelections/TeamHistory';
import PlayerStats from './MatchupCardSelections/PlayerStats';
import PitcherMatchup from './MatchupCardComponents/PitcherMatchup'; // Adjust path if needed


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
  gameBackgroundColors
}) => {
  const [delayOver, setDelayOver] = useState(false);
  const [fadeIn, setFadeIn] = useState(false);
  const [selectedData, setSelectedData] = useState('team-history');
  const [starredTeams, setStarredTeams] = useState(() => {
    const saved = Cookies.get('starredTeams');
    return saved ? JSON.parse(saved) : {};
  });

  useEffect(() => {
    let timer;
    if (!loading) {
      timer = setTimeout(() => {
        setDelayOver(true);
        setFadeIn(true);
      }, 2000);
    } else {
      setDelayOver(false);
      setFadeIn(false);
    }
    return () => clearTimeout(timer);
  }, [loading]);

  useEffect(() => {
    let timer;
    if (visibleGames.length > 0) {
      timer = setTimeout(() => {}, 1000);
    }
    return () => clearTimeout(timer);
  }, [visibleGames]);

  const handleDataSelect = (dataType) => {
    setSelectedData(dataType);
  };

  const handleStarClick = (gamePk, teamId) => {
    setStarredTeams((prev) => {
      let updated;
      if (prev[gamePk] === teamId) {
        updated = { ...prev };
        delete updated[gamePk];
      } else {
        updated = {
          ...prev,
          [gamePk]: teamId,
        };
      }

      Cookies.set('starredTeams', JSON.stringify(updated), { expires: 365 });
      return updated;
    });
  };

  return (
    <div className={`matchup-card fade-in`}>
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
            style={{
              opacity: fadeIn ? 1 : 0,
              transition: 'opacity 0.5s ease-in',
            }}
          >
            No games scheduled for this date.
          </p>
        ) : (
          <>
            {visibleGames.map((game) => (
              <div
                className={`game-container ${
                  selectedTeams.includes(game.teams.away.team.id) ||
                  selectedTeams.includes(game.teams.home.team.id)
                    ? 'fade-in'
                    : 'fade-out'
                }`}
                key={game.gamePk}
              >
                <div className="game-time-container">
                  <p className="game-time">
                    {game.gameDate
                      ? formatTime(game.gameDate)
                      : 'Time not available'}
                  </p>
                </div>
                <div className="matchup-group">
                  <div className="column1">
                    <div className="row1">
                      <div
                        className="team-logo-container"
                        onClick={() => handleStarClick(game.gamePk, game.teams.away.team.id)}
                      >
                        <img
                          src={getTeamLogo(game.teams.away.team.name)}
                          alt={`${game.teams.away.team.name} logo`}
                          style={{
                            border: `2px solid ${gameBackgroundColors[game.gamePk]?.away}`,
                            position: 'relative',
                          }}
                        />
                        {starredTeams[game.gamePk] === game.teams.away.team.id && (
                          <div className="star-icon">⭐</div>
                        )}
                      </div>
                    </div>
                    <div className="row2">
                      <div
                        className="team-logo-container"
                        onClick={() => handleStarClick(game.gamePk, game.teams.home.team.id)}
                      >
                        <img
                          src={getTeamLogo(game.teams.home.team.name)}
                          alt={`${game.teams.home.team.name} logo`}
                          style={{
                            border: `2px solid ${gameBackgroundColors[game.gamePk]?.home}`,
                            position: 'relative',
                          }}
                        />
                        {starredTeams[game.gamePk] === game.teams.home.team.id && (
                          <div className="star-icon">⭐</div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="column2">
                    <PitcherMatchup game={game} getTeamRecord={getTeamRecord} />
                  </div>
                </div>
                <div className="game-data">
                  <Scoreboard
                    game={game}
                    getTeamAbbreviation={getTeamAbbreviation}
                    liveData={liveGameData[game.gamePk]?.liveData}
                  />
                  <div className="game-data-container stat-toggle-container">
                    <select
                      value={selectedData}
                      onChange={(e) => handleDataSelect(e.target.value)}
                    >
                      <option value="team-history">TEAM W/L HISTORY</option>
                      <option value="player-stats">2025 PLAYER STATS</option>
                    </select>
                    {selectedData === 'team-history' && <TeamHistory game={game} />}
                    {selectedData === 'player-stats' && <PlayerStats game={game} />}
                  </div>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
};

export default MatchupCard;
