import { systemDestination } from './landing-route';

function openLegacyRoute() {
  const destination = systemDestination(location.hash, location.search);
  if (!destination) return false;
  location.replace(destination);
  return true;
}

// Keep landing styles and application styles in separate documents.
window.addEventListener('hashchange', openLegacyRoute);
if (!openLegacyRoute()) {
  void import('./artisys-landing.jsx');
}
