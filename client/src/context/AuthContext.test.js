import React, { useContext } from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { AuthProvider, AuthContext } from './AuthContext';
import { authAPI } from '../services/api';

jest.mock('../services/api', () => ({ authAPI: { verify: jest.fn() } }));
global.IS_REACT_ACT_ENVIRONMENT = true;

test('conserva el token ante un corte y recupera la sesión al reintentar', async () => {
  localStorage.setItem('token', 'saved-session');
  authAPI.verify.mockRejectedValueOnce(new Error('Network unavailable')).mockResolvedValueOnce({ success: true, doctor: { id: 'doctor', status: 'approved' } });
  const div = document.createElement('div');
  const root = createRoot(div);
  let auth;
  function Probe() { auth = useContext(AuthContext); return null; }
  const log = jest.spyOn(console, 'error').mockImplementation(() => {});
  try {
    await act(async () => { root.render(<AuthProvider><Probe /></AuthProvider>); });
    expect(localStorage.getItem('token')).toBe('saved-session');
    expect(auth.sessionError).toBeTruthy();
    await act(async () => { auth.retrySession(); });
    expect(auth.isAuthenticated).toBe(true);
    expect(auth.sessionError).toBe(null);
  } finally { await act(async () => root.unmount()); localStorage.clear(); log.mockRestore(); }
});

test('elimina la sesión cuando el servidor rechaza el token con 401', async () => {
  localStorage.setItem('token', 'expired-session');
  authAPI.verify.mockRejectedValueOnce({ response: { status: 401 } });
  const root = createRoot(document.createElement('div'));
  const log = jest.spyOn(console, 'error').mockImplementation(() => {});
  try {
    await act(async () => { root.render(<AuthProvider><span /></AuthProvider>); });
    expect(localStorage.getItem('token')).toBe(null);
  } finally { await act(async () => root.unmount()); localStorage.clear(); log.mockRestore(); }
});
