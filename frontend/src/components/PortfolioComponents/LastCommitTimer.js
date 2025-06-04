import React, { useState, useEffect } from 'react';
import axios from 'axios';

function LastCommitTimer() {
  const [lastCommitTime, setLastCommitTime] = useState(null);

  useEffect(() => {
    const fetchLastCommitTime = async () => {
      try {
        const response = await axios.get('https://api.github.com/repos/jonathan5150/PortfolioPage/commits?per_page=1');
        const lastCommit = response.data[0].commit.author.date;
        setLastCommitTime(new Date(lastCommit));
      } catch (error) {
        console.error('Error fetching last commit time:', error);
      }
    };

    fetchLastCommitTime();

    const interval = setInterval(fetchLastCommitTime, 60000); // Update every minute

    return () => clearInterval(interval);
  }, []);

  const formatDate = (date) => {
    const options = { year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', hour12: true, timeZoneName: 'short' };
    let dateTimeString = date.toLocaleString('en-US', options);
    const [datePart, timePart] = dateTimeString.split(', ');
    return `${datePart} @ ${timePart}`;
  };

  return (
    <div>
      Last Updated: {lastCommitTime ? formatDate(lastCommitTime) : 'Fetching...'}
    </div>
  );
}

export default LastCommitTimer;