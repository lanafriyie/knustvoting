import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

function mount() {
  let container = document.getElementById('root');
  if (!container) {
    container = document.createElement('div');
    container.id = 'root';
    document.body.appendChild(container);
  }
  const root = createRoot(container);
  root.render(<App />);
}

mount();

// Export for testing or embedding
export default mount;
