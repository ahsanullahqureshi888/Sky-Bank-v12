import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import AppRoutes from './routes/AppRoutes';
import RouteErrorBoundary from './components/RouteErrorBoundary';
import './index.css';
import './i18n';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <RouteErrorBoundary
      title="SKY ARIANA GROUP OF COMPANIES"
      message="An unexpected display issue occurred. Click Reload to restore your session immediately."
    >
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </RouteErrorBoundary>
  </React.StrictMode>
);

