import React from 'react';
import './Game.css'; // Import your CSS file for styling

function Game() {
    // Function to generate buttons
    const generateButtons = () => {
        const buttons = [];
        for (let i = 1; i <= 16; i++) {
            buttons.push(
                <button key={i} className="button">
                    Button {i}
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