import React, { useState } from 'react';
import { Link } from 'react-router-dom';

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
                    <li><Link to="/home">Home</Link></li>
                    <li><Link to="/resume">Resume</Link></li>
                    <li><Link to="/project1">Project 1: Tehandon Time Calculator</Link></li>
                    <li><Link to="/project2">Project 2: Along The Way Roadtripping Web Application</Link></li>
                    <li><Link to="/project3">Project 3: Sports Stats API</Link></li>
                    <li><Link to="/contact">Contact Info</Link></li>
                </ul>
            </div>
            <div className="navbar-right">
                <a href="https://linkedin.com/in/jonathan-rainey-877a9ba4">
                    <img src="LinkedIn-Blue-128-┬«@2x.png" alt="LinkedIn text logo" className="linkedInLink" />
                </a>
                <a href="https://github.com/jonathan5150">
                    <img src="github-mark.png" alt="Github logo" className="githubLink" />
                </a>
            </div>
        </nav>
    );
}

export default NavBar;