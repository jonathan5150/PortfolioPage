import React, { useState } from 'react';

function NavBar() {
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    const toggleMenu = () => {
        setIsMenuOpen(!isMenuOpen);
    };

    return (
        <nav className={`navbar${isMenuOpen ? ' open' : ''}`}>
            <div className="navbar-left">
                <button className="hamburger-menu" onClick={toggleMenu}>
                    &#9776;
                </button>
                <h1>Connections Clone</h1>
            </div>
            <div className={`menu${isMenuOpen ? ' open' : ''}`}>
                <button className="close-button" onClick={toggleMenu}>
                    ×
                </button>
                <ul>
                    <li><a href="/">Create New Puzzle</a></li>
                    <li><a href="/">How to Play</a></li>
                    <li><a href="/">About This Project</a></li>
                    <li><a href="/">Hi Hannie</a></li>
                </ul>
            </div>
            <div className="login-button">
                <button>Login</button>
            </div>
        </nav>
    );
}

export default NavBar;