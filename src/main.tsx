import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
const root = document.getElementById('root');
if (!root) throw new Error('没有找到应用挂载节点。');
createRoot(root).render(<StrictMode><ErrorBoundary><App /></ErrorBoundary></StrictMode>);
