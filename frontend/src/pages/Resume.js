import React from 'react';
import resumeImage from '../assets/images/Rainey, Jonathan - Resume 6-16-2024-1.png';
import resumeImage2 from '../assets/images/Rainey, Jonathan - Resume 6-16-2024-2.png';

function Resume() {
    return (
        <div>
            <div className="download-pdf-container">
               <button class="downloadPDF">Download PDF</button>
            </div>

            <div className="resume-container">
                <div className="resume-wrapper">
                    <img src={resumeImage} alt="Resume" className="resume-image"/>
                    <img src={resumeImage2} alt="Resume2" className="resume-image"/>
                </div>
            </div>
        </div>
    );
}
export default Resume;