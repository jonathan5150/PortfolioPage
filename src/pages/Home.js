import React, { useEffect } from 'react';

function Home() {
  useEffect(() => {
    const preloadImage = (url) => {
      const img = new Image();
      img.src = url;
    }

    preloadImage('https://jonathanrainey.dev/static/media/Rainey,%20Jonathan%20-%20Resume%202024.9517b2b495dab2040288.png');
  }, []);

  return (
    <div className="Home">
        <p className="homeParagraph">Welcome to my portfolio! This page exists to showcase my past, current, and future projects.</p>
        <p className="homeParagraph">I'm a software developer who lives in the St. Louis, MO area. I have experience with modern JS frameworks such as React and Angular, as well as programming languages such as Java and C++. I'm currently focusing on learning React which is what this page was built with. It will always be a work in progress.</p>
        <p className="homeParagraph">Feel free to contact me with any questions you have, I'm always looking for new opportunities!</p>
    </div>
  );
}

export default Home;
