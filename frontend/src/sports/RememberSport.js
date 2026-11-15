import React, { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { readPreferredSport, savePreferredSport, sportPath } from './sports';

// Wraps each sport's page so the site reopens on the sport the visitor was
// last on: every visit to a sport page is remembered, and when the site is
// opened fresh (a bookmark, the home screen, a typed address) on a different
// sport, it switches to the remembered one. Moving between sports inside the
// site (the sport switcher) is never redirected.
let openedFresh = true;

const RememberSport = ({ sport, children }) => {
  const saved = readPreferredSport();
  const redirect = Boolean(openedFresh && saved && saved !== sport);
  useEffect(() => {
    openedFresh = false;
    if (!redirect) savePreferredSport(sport);
  }, [redirect, sport]);
  return redirect ? <Navigate to={sportPath(saved)} replace /> : children;
};

export default RememberSport;
