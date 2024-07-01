import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';

function Header() {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [showNewLinks, setShowNewLinks] = useState(false);
    const location = useLocation();

    useEffect(() => {
        setIsMenuOpen(false); // Close the main menu immediately
        const timeout = setTimeout(() => {
            setShowNewLinks(false); // Close the "Projects" menu specifically after a delay
        }, 500); // Delay of 500 milliseconds (half a second)

        return () => clearTimeout(timeout); // Clear the timeout on unmount or when location changes
    }, [location]);

    const toggleMenu = () => {
        setIsMenuOpen(!isMenuOpen);
    };

    const toggleNewLinks = () => {
        setShowNewLinks(!showNewLinks);
    };

    return (
        <nav className={`navbar${isMenuOpen ? ' open' : ''}`}>
            <div className="navbar-left">
                <h1 className="header-title">PORTFOLIO</h1>
                <div className="header-title-container">
                    <h1 className="header-title-name">{'// Jonathan Rainey'}</h1>
                </div>

            </div>
            <div className="navbar-right">
                <button className="hamburger-menu" onClick={toggleMenu}>
                    &#9776;
                </button>
            </div>
            <div className={`menu${isMenuOpen ? ' open' : ''}`}>
                <ul>
                    <li><Link to="/home">Home</Link></li>
                    <li><Link to="/resume">Resume</Link></li>
                    <li><button onClick={toggleNewLinks}><strong>Projects</strong></button></li>
                    {showNewLinks && (
                        <>
                          {/*<li><Link to="/excelproject">- Excel Project</Link></li>*/}
                          <li><Link to="/alongtheway">- Along The Way</Link></li>
                          <li><Link to="/sportsdataproject">- Sports Data Project</Link></li>
                        </>
                    )}
                    <li><Link to="/contact">Contact</Link></li>
                </ul>
            </div>
            <div className="color-blend-line"></div>
        </nav>
    );
}

export default Header;