import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { postQueue } from './queue';

const BACKEND_URL = 'http://localhost:3000';

const Popup = () => {
  const [vehicles] = useState([
    { id: 1, title: '2020 Toyota Camry', price: '$24,999', desc: 'Low miles, clean title.', img: '' }
  ]);
  const [status, setStatus] = useState('');
  const [token, setToken] = useState('');

  useEffect(() => {
    const stored = localStorage.getItem('token');
    if (stored) setToken(stored);
  }, []);

  const login = async () => {
    const email = prompt('Email');
    const pass = prompt('Password');
    const res = await fetch(`${BACKEND_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: pass })
    });
    const data = await res.json();
    localStorage.setItem('token', data.token);
    setToken(data.token);
  };

  const post = async (v: any) => {
    setStatus('Queuing...');
    try {
      await postQueue.enqueue(v, 'marketplace');
      setStatus('Posted!');
    } catch (err: any) {
      setStatus(`Error: ${err.message}`);
    }
  };

  if (!token) return <button onClick={login}>Login</button>;

  return (
    <div style={{ padding: 10, width: 300 }}>
      <h3>FB Auto-Lister</h3>
      {vehicles.map(v => (
        <div key={v.id} style={{ border: '1px solid #ccc', margin: 5, padding: 5 }}>
          <b>{v.title}</b> - {v.price}
          <button onClick={() => post(v)} style={{ marginLeft: 10 }}>Post</button>
        </div>
      ))}
      <p><b>{status}</b></p>
    </div>
  );
};

ReactDOM.createRoot(document.getElementById('root')!).render(<Popup />);
