import React from 'react';
import ReactDOM from 'react-dom/client';
// 👇 必须加上这一行！没有它，整个网站的布局都会失效（黑屏/白屏）
import './index.css'; 
import App from './App';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
