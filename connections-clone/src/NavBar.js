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
                <h1>Portfolio / Jonathan Rainey</h1>
            </div>
            <div className={`menu${isMenuOpen ? ' open' : ''}`}>
                <button className="close-button" onClick={toggleMenu}>
                    ×
                </button>
                <ul>
                    <li><a href="/">My Portfolio Page</a></li>
                    <li><a href="/">Resume</a></li>
                    <li><a href="/">To Do List</a></li>
                </ul>
//                PLZ CODE MORE TONIGHT
            </div>
        </nav>
    );
}

export default NavBar;