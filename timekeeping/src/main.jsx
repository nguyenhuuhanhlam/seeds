import '@astryxdesign/core/reset.css';
import '@astryxdesign/core/astryx.css';
import '@astryxdesign/theme-neutral/theme.css';
import '@astryxdesign/theme-neutral/fonts.css';
import './app-fonts.css';
import './print.css';

import { Theme } from '@astryxdesign/core';
import React from 'react';
import ReactDOM from 'react-dom/client';

import { defaultThemeSlug, themes } from '../astryx-themes.js';
import App from './App.jsx';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Theme theme={themes[defaultThemeSlug]}>
      <App />
    </Theme>
  </React.StrictMode>,
);
