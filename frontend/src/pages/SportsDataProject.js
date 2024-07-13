import { Link } from 'react-router-dom';

function SportsDataProject() {

  return (
    <div className="SportsDataProject">
      <p className="otherParagraph">
        This is where my current project is being built. I have a
        lot of friends interested in sports data and they've mentioned to me how difficult it is to
        find a webpage that has all the statistics they want to see in one place. So I figured I'd try to
        tackle the project so that I can work on my backend skills via connecting to a public API,
        storing that information in a database, and manipulating it.
      </p>

      <div className="MLBLink">
        <Link to="/MLBData">
          <button className="mlbLinkButton">
          LINK TO MLB DATA PROJECT
          </button>
        </Link>
      </div>
    </div>
  );
}

export default SportsDataProject;
