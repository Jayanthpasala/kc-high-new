import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error("Critical Failure: Root element not found.");
}

// Clear the "Booting..." loader manually before React takes over
const renderApp = () => {
  try {
    const root = ReactDOM.createRoot(rootElement);
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
  } catch (err) {
    console.error("Mounting error:", err);
    rootElement.innerHTML = `
      <div style="padding: 40px; font-family: 'Inter', sans-serif; background: #fff1f2; color: #9f1239; border-radius: 20px; margin: 20px; border: 2px solid #fecdd3; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);">
        <h1 style="font-weight: 900; font-size: 24px; margin-bottom: 10px;">BOOT ERROR</h1>
        <pre style="background: #1e293b; color: #34d399; padding: 20px; border-radius: 12px; font-size: 12px; overflow: auto;">
${err instanceof Error ? err.stack : String(err)}
        </pre>
        <button onclick="window.location.reload()" style="margin-top: 20px; padding: 12px 24px; background: #e11d48; color: white; border: none; border-radius: 12px; font-weight: 800; cursor: pointer;">Try Again</button>
      </div>
    `;
  }
};

renderApp();