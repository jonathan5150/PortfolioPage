import React from 'react';

function Resume() {
    return (
        <div>
            {/*<div style={{ marginTop: '20px', height: 'calc(100vh - 50px)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                <div style={{ width: '80%', height: '80vh', border: '1px solid #ccc', overflow: 'hidden' }}>
                    <iframe src="/Rainey, Jonathan - Resume 2024.PDF#view=FitH#toolbar=0" title="Resume" style={{ width: '100%', height: '100%', border: 'none' }}></iframe>
                </div>
            </div>*/}
            <div className="resume-container">
                <div className="resume-wrapper">
                    <img src="Rainey, Jonathan - Resume 2024.png" alt="Resume" className="resume-image"/>
                </div>
            </div>
        </div>
    );
}
export default Resume;