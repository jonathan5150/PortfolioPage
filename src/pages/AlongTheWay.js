import React from 'react';
import atw1 from '../assets/images/atw1.png';
import atw2 from '../assets/images/atw2.png';
import atw3 from '../assets/images/atw3.png';

function AlongTheWay() {
  return (
    <div className="ScrollableContainer">
        <div className="AlongTheWay">
            <img className="image" src={atw1} alt="Along The Way 1" />
            <img className="image" src={atw2} alt="Along The Way 1" />
            <img className="image bottom-margin" src={atw3} alt="Along The Way 1" />
        </div>
    </div>
  );
}

export default AlongTheWay;