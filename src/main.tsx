import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import 'katex/dist/katex.min.css';
import { initLatexClipboardInterceptor } from './services/latexClipboardService';

// Initialize global LaTeX clipboard interceptor (Option 1 & Option 2)
initLatexClipboardInterceptor();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
