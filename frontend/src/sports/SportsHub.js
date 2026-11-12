import React from 'react';
import { Navigate } from 'react-router-dom';
import { sportPath, startingSport } from './sports';

// /sports: open the visitor's saved sport, or the one in season.
const SportsHub = () => <Navigate to={sportPath(startingSport())} replace />;

export default SportsHub;
