import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.js';
import { LoginView } from './LoginView.js';

const root = document.getElementById('root');
if (!root) throw new Error('No #root element found');

const isLoginWindow = window.location.hash.toLowerCase().includes('login');

createRoot(root).render(
  <StrictMode>{isLoginWindow ? <LoginView /> : <App />}</StrictMode>,
);
