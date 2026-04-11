import React, { useEffect, useState, useRef } from 'react';
import Cookies from 'js-cookie';

const BatterGamelog = ({
  teams = [],
  gameDate,
  getTeamAbbreviation,
  numGamesToShow,
  setNumGamesToShow
}) => {
  const [selectedPlayers, setSelectedPlayers] = useState(() => {
    const saved = Cookies.get('selectedPlayers');
    return saved ? JSON.parse(saved) : {};
  });

  const [showing, setShowing] = useState('away');
  const touchStartX = useRef(null);
  const dragDeltaX = useRef(0);

  useEffect(() => {
    const savedGames = Cookies.get('numGamesToShow');
    if (savedGames) {
      const parsed = parseInt(savedGames, 10);
      if (!isNaN(parsed)) {
        setNumGamesToShow(parsed);
      }
    }
  }, [setNumGamesToShow]);

  const getInitialSelected = (logs = {}) => {
    const leader = Object.entries(logs)
      .map(([name, logs]) => ({
        name,
        homeRuns: logs.reduce((sum, g) => sum + (parseInt(g.homeRuns, 10) || 0), 0),
      }))
      .sort((a, b) => b.homeRuns - a.homeRuns)[0];

    return leader?.name || '';
  };

  useEffect(() => {
    setSelectedPlayers((prev) => {
      const initial = { ...prev };
      let updated = false;

      for (const { team, logs } of teams) {
        if (!initial[team.id] && logs && Object.keys(logs).length > 0) {
          initial[team.id] = getInitialSelected(logs);
          updated = true;
        }
      }

      if (updated) {
        Cookies.set('selectedPlayers', JSON.stringify(initial), { expires: 365 });
      }

      return initial;
    });
  }, [teams]);

  const handleSelectChange = (teamId, playerName) => {
    setSelectedPlayers((prev) => {
      const updated = {
        ...prev,
        [teamId]: playerName,
      };
      Cookies.set('selectedPlayers', JSON.stringify(updated), { expires: 365 });
      return updated;
    });
  };

  const handleSetShowing = (next) => {
    setShowing(next);
  };

  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
    dragDeltaX.current = 0;
  };

  const handleTouchMove = (e) => {
    if (touchStartX.current == null) return;

    const currentX = e.touches[0].clientX;
    dragDeltaX.current = currentX - touchStartX.current;

    if (dragDeltaX.current > 30 && showing === 'home') {
      handleSetShowing('away');
      dragDeltaX.current = 0;
    } else if (dragDeltaX.current < -30 && showing === 'away') {
      handleSetShowing('home');
      dragDeltaX.current = 0;
    }
  };

  const handleTouchEnd = () => {
    touchStartX.current = null;
    dragDeltaX.current = 0;
  };

  const renderTeam = ({ team, teamType, logs = {}, roster = [] }) => {
    const selectedPlayer = selectedPlayers[team.id] || '';
    const playerGames = logs[selectedPlayer]?.slice(0, numGamesToShow) || [];

    return (
      <div style={{ width: '100%', flexShrink: 0 }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr auto',
            alignItems: 'center',
            columnGap: '8px',
            marginBottom: '6px',
            width: '100%',
          }}
        >
          <h3
            style={{
              margin: 0,
              height: '100%',
              display: 'flex',
              padding: '0',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              lineHeight: 1,
            }}
          >
            {team.name}

            <button
              onClick={() => handleSetShowing(showing === 'away' ? 'home' : 'away')}
              style={{
                position: 'absolute',
                right: '0.5rem',
                marginBottom: '-12px',
                transform: `translateY(-50%) ${showing === 'away' ? 'scaleX(1)' : 'scaleX(-1)'}`,
                fontSize: '0.6rem',
                background: 'transparent',
                color: 'white',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              ▶
            </button>
          </h3>

          <select
            value={numGamesToShow}
            onChange={(e) => {
              const value = parseInt(e.target.value, 10);
              setNumGamesToShow(value);
              Cookies.set('numGamesToShow', value, { expires: 365 });
            }}
            style={{
              height: '100%',
              margin: 0,
              padding: '0',
              boxSizing: 'border-box',
            }}
          >
            <option value={5}>5</option>
            <option value={10}>10</option>
            <option value={20}>20</option>
          </select>
        </div>

        {roster.length > 0 && (
          <select
            value={selectedPlayer}
            onChange={(e) => handleSelectChange(team.id, e.target.value)}
            style={{ marginBottom: '5px', padding: '4px', width: '100%' }}
          >
            {[...roster]
              .filter((player) => {
                const playerName = player.person.fullName;
                const games = logs[playerName];
                return games && games.length > 0;
              })
              .sort((a, b) => {
                const aLast = a.person.fullName.split(' ').slice(-1)[0];
                const bLast = b.person.fullName.split(' ').slice(-1)[0];
                return aLast.localeCompare(bLast);
              })
              .map((player) => {
                const position = player.position?.abbreviation || 'N/A';
                return (
                  <option key={player.person.fullName} value={player.person.fullName}>
                    {player.person.fullName} ({position})
                  </option>
                );
              })}
          </select>
        )}

        {playerGames.length === 0 ? (
          <p>No recent games found for {selectedPlayer}.</p>
        ) : (
          <table style={{ fontSize: '12px', width: '100%', tableLayout: 'fixed' }}>
            <thead>
              <tr>
                <th style={{ width: '12%' }}>DATE</th>
                <th style={{ width: '11%' }}>OPP</th>
                <th style={{ width: '7%' }}>AB</th>
                <th style={{ width: '7%' }}>R</th>
                <th style={{ width: '7%' }}>H</th>
                <th style={{ width: '8%' }}>RBI</th>
                <th style={{ width: '7%' }}>BB</th>
                <th style={{ width: '7%' }}>SO</th>
                <th style={{ width: '8%' }}>HR</th>
                <th style={{ width: '8%' }}>SB</th>
                <th style={{ width: '11%' }}>AVG</th>
              </tr>
            </thead>
            <tbody>
              {playerGames.map((game, idx) => (
                <tr key={idx}>
                  <td>{`${parseInt(game.date.split('-')[1], 10)}/${parseInt(game.date.split('-')[2], 10)}`}</td>
                  <td>{game.opponent}</td>
                  <td>{game.atBats ?? 'N/A'}</td>
                  <td>{game.runs ?? 'N/A'}</td>
                  <td>{game.hits ?? 'N/A'}</td>
                  <td>{game.rbi ?? 'N/A'}</td>
                  <td>{game.baseOnBalls ?? 'N/A'}</td>
                  <td>{game.strikeOuts ?? 'N/A'}</td>
                  <td>{game.homeRuns ?? 'N/A'}</td>
                  <td>{game.stolenBases ?? 'N/A'}</td>
                  <td>{game.avg ?? 'N/A'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    );
  };

  const awayTeam = teams.find((t) => t.teamType === 'Away') || teams[0];
  const homeTeam = teams.find((t) => t.teamType === 'Home') || teams[1];

  if (!awayTeam || !homeTeam) {
    return <div className="batter-gamelog-wrapper">Missing team data.</div>;
  }

  return (
    <div
      className="batter-gamelog-wrapper"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{
        position: 'relative',
        overflow: 'hidden',
        width: '100%',
      }}
    >

      <div
        style={{
          display: 'flex',
          width: '100%',
          transform: showing === 'away' ? 'translateX(0%)' : 'translateX(-100%)',
          transition: 'transform 0.3s ease',
        }}
      >
        {renderTeam(awayTeam)}
        {renderTeam(homeTeam)}
      </div>
    </div>
  );
};

export default BatterGamelog;