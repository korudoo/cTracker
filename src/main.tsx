import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import App from '@/App';
import '@/index.css';
import { AuthProvider } from '@/context/AuthContext';
import { CalendarProvider } from '@/context/CalendarContext';
import { queryClient } from '@/lib/queryClient';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <CalendarProvider>
            <App />
          </CalendarProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
