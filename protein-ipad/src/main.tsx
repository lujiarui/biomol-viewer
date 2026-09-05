import { createRoot } from 'react-dom/client';
import { I18nProvider } from './i18n';
import { App } from './app/App';
import './styles/globals.css';
createRoot(document.getElementById('root')!).render(<I18nProvider><App /></I18nProvider>);
