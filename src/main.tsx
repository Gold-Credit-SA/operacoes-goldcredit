import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { ErrorBoundary } from "./components/ErrorBoundary";

// Detecta chunks que falharam ao carregar (deploy novo + cache antigo)
window.addEventListener('error', (e) => {
  const msg = String(e?.message || '');
  if (/Loading chunk|Failed to fetch dynamically imported module|Importing a module script failed/i.test(msg)) {
    if (!sessionStorage.getItem('chunk-reload-attempted')) {
      sessionStorage.setItem('chunk-reload-attempted', '1');
      window.location.reload();
    }
  }
});

window.addEventListener('unhandledrejection', (e) => {
  const msg = String(e?.reason?.message || e?.reason || '');
  if (/Loading chunk|Failed to fetch dynamically imported module|Importing a module script failed/i.test(msg)) {
    if (!sessionStorage.getItem('chunk-reload-attempted')) {
      sessionStorage.setItem('chunk-reload-attempted', '1');
      window.location.reload();
    }
  }
});

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
