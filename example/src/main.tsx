import React from 'react';
import { createRoot } from 'react-dom/client';
import { RadialDialPage } from './RadialDialPage';

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root');
createRoot(root).render(
  <React.StrictMode>
    <RadialDialPage />
  </React.StrictMode>,
);
