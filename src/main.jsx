import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './app/App.jsx';
import { ensurePublicMediaConfig } from '@/lib/publicMediaConfig.js';
import './fonts/avant-garde.css';
import './styles.css';

async function bootstrap() {
  await ensurePublicMediaConfig();
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}

bootstrap();
