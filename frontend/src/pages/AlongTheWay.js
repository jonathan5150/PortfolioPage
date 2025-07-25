import React from 'react';
import atw1 from '../assets/images/atw1.png';
import atw2 from '../assets/images/atw2.png';
import atw3 from '../assets/images/atw3.png';

function AlongTheWay() {
  return (
    <div className="ScrollableContainer">
        <div className="defaultParagraph">

            <p>This is "Along The Way", the capstone project I created along with a small group of
            peers in order to graduate from the LaunchCode Coding Bootcamp based in St. Louis, MO.
            The project was created because our group enjoyed roadtripping and specifically finding
            interesting places along our routes. However, we noticed that Google Maps was unable to
            complete this task. </p>

            <p>Below is an image of a directions request from St. Louis to Seattle. When you search for
            bakeries along the route, Google only shows you bakeries located in St. Louis. So we
            needed to figure out a way to show ALL of the bakeries along the route. </p>

            <img className="image" src={atw1} alt="Along The Way 1" />
            <p>So here's what we came up with! As you can see we managed to solve the problem. I
            personally coded the majority of the functions on the left side of the page, wrote
            the code for the searching along route functionality, taught myself how to use the
            Google Maps API, and also completed nearly all of the layout and CSS design work needed
            for the page. The image below shows the Directions and Route Data/Gas Calculator part of
             the application.</p>

            <img className="image" src={atw2} alt="Along The Way 1" />

            <p>And finally the image below shows the true goal of the project, listing all of the
            requested places along the route. </p>

            <img className="image bottom-margin" src={atw3} alt="Along The Way 1" />
        </div>
    </div>
  );
}

export default AlongTheWay;