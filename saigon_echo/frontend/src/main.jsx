// Điểm khởi động: bọc ứng dụng trong React Router và vùng dữ liệu dùng chung.
import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { DemoDataProvider } from './contexts/DemoDataContext';
import App from './App';
import './styles/globals.css';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <DemoDataProvider><App /></DemoDataProvider>
    </BrowserRouter>
  </React.StrictMode>
);
