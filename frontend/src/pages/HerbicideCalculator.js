import React from 'react';
import { Link } from 'react-router-dom';

function HerbicideCalculator() {
  return (
    <div className="ScrollableContainer">
      <div className="defaultParagraph">
        <p>I used to work for a large plant nursery. A
        coworker asked for help to create a tool that would
        make it easier to calculate the correct ratio of
        herbicide to be mixed for spraying on the farm. This
        is the result, currently in progress.</p>
      </div>

      <div>
        <Link to="/MLBData">
          <button className="Link">
            LINK TO HERBICIDE CALCULATOR
          </button>
        </Link>
      </div>
    </div>
  );
}

export default HerbicideCalculator;