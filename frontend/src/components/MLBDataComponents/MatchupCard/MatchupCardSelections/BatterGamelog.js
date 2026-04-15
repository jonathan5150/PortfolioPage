import React, { useEffect, useState, useRef } from 'react';
import Cookies from 'js-cookie';
import teamPrimaryColors, {
  getTeamBackgroundStyle,
} from '../MatchupCardComponents/mlbUtils/teamPrimaryColors';

const viewportStyle = {
  width: '100%',
  border: '1px solid rgba(255, 255, 255, 0.12)',
  borderRadius: '8px',
  overflow: 'hidden',
  background: 'rgba(30, 30, 30, 0.55)',
};

const containerStyle = {
  width: '100%',
  background: 'transparent',
};

const tableStyle = {
  width: '100%',
  fontSize: '12px',
  borderCollapse: 'collapse',
  tableLayout: 'fixed',
};

const thStyle = {
  padding: '5px 6px',
  fontSize: '0.63rem',
  fontWeight: 600,
  color: 'rgba(255,255,255,0.82)',
  background: 'rgba(255,255,255,0.03)',
  borderBottom: '1px solid rgba(255,255,255,0.08)',
  textAlign: 'center',
};

const tdStyle = {
  padding: '5px 6px',
  color: 'white',
  borderBottom: '1px solid rgba(255,255,255,0.06)',
  textAlign: 'center',
  fontSize: '0.7rem',
};

const cellStyle = {
  ...tdStyle,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

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

  const renderTeam = ({ team, teamType, logs = {}, roster = [] }, isSecondTeam = false) => {
    const selectedPlayer = selectedPlayers[team.id] || '';
    const playerGames = logs[selectedPlayer]?.slice(0, numGamesToShow) || [];
    const teamColor = teamPrimaryColors[team.name];

    return (
      <div style={{ ...containerStyle, width: '100%', flexShrink: 0 }}>
        <div style={{ position: 'relative', overflow: 'hidden' }}>
          <div
            style={{
              ...getTeamBackgroundStyle(teamColor),
              borderRadius: isSecondTeam ? '0' : '8px 8px 0 0',
            }}
          />

          <h3
            style={{
              margin: 0,
              display: 'flex',
              padding: '4px 0',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              zIndex: 2,
              fontWeight: 300,
              lineHeight: 1,
              color: '#fff',
              borderRadius: isSecondTeam ? '0' : '8px 8px 0 0',
              background: 'transparent',
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
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr auto',
            alignItems: 'center',
            columnGap: '8px',
            margin: '6px 0',
            width: '100%',
            padding: '0 6px',
            boxSizing: 'border-box',
          }}
        >
          {roster.length > 0 ? (
            <select
              value={selectedPlayer}
              onChange={(e) => handleSelectChange(team.id, e.target.value)}
              style={{
                margin: 0,
                padding: '4px',
                width: '100%',
                minWidth: 0,
              }}
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
          ) : (
            <div />
          )}

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

        {playerGames.length === 0 ? (
          <div
            style={{
              padding: '14px 10px',
              textAlign: 'center',
              color: 'rgba(255,255,255,0.8)',
              fontSize: '0.7rem',
            }}
          >
            No recent games found for {selectedPlayer}.
          </div>
        ) : (
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={{ ...thStyle, width: '12%' }}>DATE</th>
                <th style={{ ...thStyle, width: '11%' }}>OPP</th>
                <th style={{ ...thStyle, width: '7%' }}>AB</th>
                <th style={{ ...thStyle, width: '7%' }}>R</th>
                <th style={{ ...thStyle, width: '7%' }}>H</th>
                <th style={{ ...thStyle, width: '8%' }}>RBI</th>
                <th style={{ ...thStyle, width: '7%' }}>BB</th>
                <th style={{ ...thStyle, width: '7%' }}>SO</th>
                <th style={{ ...thStyle, width: '8%' }}>HR</th>
                <th style={{ ...thStyle, width: '8%' }}>SB</th>
                <th style={{ ...thStyle, width: '11%' }}>AVG</th>
              </tr>
            </thead>
            <tbody>
              {playerGames.map((game, idx) => {
                const mm = Number(game?.date?.split?.('-')?.[1] || 0);
                const dd = Number(game?.date?.split?.('-')?.[2] || 0);
                const dateStr = mm && dd ? `${mm}/${dd}` : game?.date || '';
                const isLastRow = idx === playerGames.length - 1;

                const rowTdStyle = isLastRow
                  ? { ...tdStyle, borderBottom: 'none' }
                  : tdStyle;

                return (
                  <tr key={idx}>
                    <td style={rowTdStyle}>{dateStr}</td>
                    <td style={{ ...cellStyle, borderBottom: rowTdStyle.borderBottom }}>
                      {game.opponent}
                    </td>
                    <td style={rowTdStyle}>{game.atBats ?? 'N/A'}</td>
                    <td style={rowTdStyle}>{game.runs ?? 'N/A'}</td>
                    <td style={rowTdStyle}>{game.hits ?? 'N/A'}</td>
                    <td style={rowTdStyle}>{game.rbi ?? 'N/A'}</td>
                    <td style={rowTdStyle}>{game.baseOnBalls ?? 'N/A'}</td>
                    <td style={rowTdStyle}>{game.strikeOuts ?? 'N/A'}</td>
                    <td style={rowTdStyle}>{game.homeRuns ?? 'N/A'}</td>
                    <td style={rowTdStyle}>{game.stolenBases ?? 'N/A'}</td>
                    <td style={rowTdStyle}>{game.avg ?? 'N/A'}</td>
                  </tr>
                );
              })}
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
      style={viewportStyle}
    >
      <div
        style={{
          display: 'flex',
          width: '100%',
          transform: showing === 'away' ? 'translateX(0%)' : 'translateX(-100%)',
          transition: 'transform 0.3s ease',
        }}
      >
        {renderTeam(awayTeam, false)}
        {renderTeam(homeTeam, true)}
      </div>
    </div>
  );
};

export default BatterGamelog;