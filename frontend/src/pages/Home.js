import React, { useEffect } from 'react';
import LastCommitTimer from '../components/PortfolioComponents/LastCommitTimer';

function Home() {
  useEffect(() => {
    const preloadImage = (url) => {
      const img = new Image();
      img.src = url;
    }

    //This code preloads my resume whether I'm working on it on local or it's live
    if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
        preloadImage('src/assets/images/Rainey, Jonathan - Resume 2024.png');
        preloadImage('src/assets/images/atw1.png');
        preloadImage('src/assets/images/atw2.png');
        preloadImage('src/assets/images/atw3.png');
    }
    else {
        preloadImage('https://jonathanrainey.dev/static/media/Rainey,%20Jonathan%20-%20Resume%202024.9517b2b495dab2040288.png');
        preloadImage('https://jonathanrainey.dev/static/media/atw1.ca38dddd76c5f721726e.png');
        preloadImage('https://jonathanrainey.dev/static/media/atw2.a65e86daef764120f64c.png');
        preloadImage('https://jonathanrainey.dev/static/media/atw3.fc82e3bf1a66551ff51c.png');
    }
  }, []);

  return (
    <div className="Home">
        <p className="intro-p">Welcome to my portfolio! This page exists to showcase my past,
        current, and future projects.</p>
        <p className="intro-p">I'm a software developer who lives in the St. Louis, MO area. I
         have experience with modern JS frameworks such as React and Angular, as well as programming
          languages such as Java and C++. I'm currently focusing on learning React which is what
          this page is being built with. It will always be a work in progress.</p>
        <p className="intro-p">Feel free to contact me with any questions you have, I'm always
        looking for new opportunities!</p>
    <footer>
      <LastCommitTimer />
    </footer>

    </div>

  );
}

export default Home;