import React from 'react';

const PitcherMatchup = ({ game, getTeamRecord }) => {
  const renderPitcherInfo = (team, pitcher) => (
    <>
      <span style={{ fontWeight: 'bold' }}>
        {team.name} ({getTeamRecord(team.id)})
      </span>
      <div className="pitcher-details">
        {pitcher?.fullName ? (
          <>
            <b>P:</b> {pitcher.fullName} ({pitcher.pitchHand}) / <b>ERA:</b> {pitcher.era} <br />
            <b>G:</b> {pitcher.gamesPlayed} / <b>IP:</b> {pitcher.inningsPitched} / <b>AVG IP:</b>{' '}
            {pitcher.gamesPlayed > 0
              ? (pitcher.inningsPitched / pitcher.gamesPlayed).toFixed(1)
              : 'N/A'}
          </>
        ) : (
          <span><b>P:</b> N/A</span>
        )}
      </div>
    </>
  );

  return (
    <>
      <div className="pitcher-info-top">
        {renderPitcherInfo(game.teams.away.team, game.teams.away.probablePitcher)}
      </div>

      <p className="vs">@</p>

      <div className="pitcher-info-bottom">
        {renderPitcherInfo(game.teams.home.team, game.teams.home.probablePitcher)}
      </div>
    </>
  );
};

export default PitcherMatchup;
