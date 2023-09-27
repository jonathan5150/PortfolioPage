import React, { useState } from 'react';
import './Game.css'; // Import your CSS file for styling

function Game() {
    const [buttonToggles, setButtonToggles] = useState(Array(16).fill(false)); // Initialize toggle state for 16 buttons

    // Function to handle button toggle
    const handleButtonToggle = (index) => {
        const updatedToggles = [...buttonToggles];
        const numToggled = updatedToggles.filter((toggled) => toggled).length; // Count currently toggled buttons

        if (numToggled < 4 || updatedToggles[index]) {
            // Allow toggling if fewer than 4 are toggled or if toggling off a previously toggled button
            updatedToggles[index] = !updatedToggles[index];
            setButtonToggles(updatedToggles);
        }
    };

    // Function to generate buttons with toggles
    const generateButtons = () => {
        const buttons = [];
        for (let i = 1; i <= 16; i++) {
            buttons.push(
                <button
                    key={i}
                    className={`button ${buttonToggles[i - 1] ? 'button-toggled' : ''}`}
                    onClick={() => handleButtonToggle(i - 1)} // Pass the index to handleButtonToggle
                >
                    TEST {i}
                </button>
            );
        }
        return buttons;
    };

    return (
        <div className="game-container">
            <p className="createFour">Create four groups of four!</p>
            <div className="grid">{generateButtons()}</div>
            <div className="circle-container">
                <p>Mistakes remaining:</p>
                <div className="circle">●</div>
                <div className="circle">●</div>
                <div className="circle">●</div>
                <div className="circle">●</div>
            </div>
            {/* Add the three buttons below */}
            <div className="button-container">
                <button className="bottomButton">Shuffle</button>
                <button className="bottomButton">Deselect All</button>
                <button className="bottomButton">Submit</button>
            </div>
        </div>
    );
}

export default Game;