import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Removed the hardcoded "SpeechGyms v1.0.3" console banner — it was last
// bumped in April 2026 and misled a debug session on 2026-06-21 into thinking
// production was running a stale build. Identify bundle versions by the
// `index-XXX.js` filename hash on the served HTML, not by a manual string.

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);