import React from 'react';
import LastTwentyGames from '../MatchupCardComponents/LastTwentyGames';

const TeamHistory = ({ game }) => {
  return (
    <div className="last-twenty-wrapper">
      <LastTwentyGames
        awayGames={game.teams.away.lastTwentyGames}
        homeGames={game.teams.home.lastTwentyGames}
        awayTeamId={game.teams.away.team.id}
        homeTeamId={game.teams.home.team.id}
      />
    </div>
  );
};

export default TeamHistory;