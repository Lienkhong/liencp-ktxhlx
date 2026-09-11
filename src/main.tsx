import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Ensure HTTPS in cloud environments to prevent HTTP->HTTPS 301/302 redirects stripping POST bodies
if (
  typeof window !== 'undefined' &&
  window.location.protocol === 'http:' &&
  !window.location.hostname.includes('localhost') &&
  !window.location.hostname.includes('127.0.0.1')
) {
  window.location.replace(`https://${window.location.host}${window.location.pathname}${window.location.search}${window.location.hash}`);
}

// Suppress benign dev server HMR websocket notices and quota limit notices in browser console
if (typeof window !== 'undefined') {
  const origError = console.error;
  console.error = (...args: any[]) => {
    if (args.length > 0) {
      const firstArg = typeof args[0] === 'string' ? args[0] : JSON.stringify(args[0]);
      if (
        firstArg.includes('[vite] failed to connect to websocket') ||
        (firstArg.includes('WebSocket') && firstArg.includes('failed')) ||
        firstArg.includes('Quota limit exceeded') ||
        firstArg.includes('Quota exceeded') ||
        firstArg.includes('Free daily read units per project') ||
        firstArg.includes('resource-exhausted')
      ) {
        console.warn('[Handled Notice]:', ...args);
        return;
      }
    }
    origError.apply(console, args);
  };
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
