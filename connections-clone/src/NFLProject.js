import React from 'react';
import NavBar from './NavBar';

function NFLProject() {
    return (
        <div>
            <nav style={{ position: 'fixed', top: '0', left: '0', width: '100%', backgroundColor: '#333', color: '#fff', padding: '10px 20px', zIndex: '1000' }}>
                <NavBar />
            </nav>
            <div style={{ marginTop: '50px', height: 'calc(100vh - 50px)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                <div style={{ width: '80%', height: '80vh', border: '1px solid #ccc', overflow: 'hidden' }}>
                    <iframe src="/Rainey, Jonathan - Resume 2024.PDF#view=FitH" title="Resume" style={{ width: '100%', height: '100%', border: 'none' }}></iframe>
                </div>
            </div>
        </div>
    );
}
export default NFLProject;