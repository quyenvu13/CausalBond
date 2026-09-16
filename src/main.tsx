import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';
import '@genlayer/transaction-kit-react/styles.css';

createRoot(document.getElementById('root')!).render(<App />);
