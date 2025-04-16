import React from 'react';
import excel from '../assets/images/excel.png';

function ExcelProject() {
  return (
    <div className="excel-container">
      <p className="excelParagraph">I still need to finish the descriptions for this project but below is a picture of what it looks like until then. More coming soon!</p>
      <div className="excel-photo">
        <img className="excel-image" src={excel} alt="excel" />
      </div>
    </div>
  );
}

export default ExcelProject;