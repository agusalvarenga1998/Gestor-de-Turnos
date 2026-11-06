import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import axios from 'axios';
import OperationsPage from './OperationsPage';

jest.mock('axios', () => Object.assign(jest.fn(), { get: jest.fn() }));
jest.mock('../services/api', () => ({ API_BASE_URL: 'https://example.invalid' }));
jest.mock('../hooks/useAuth', () => ({ useAuth: () => ({ token: 'doctor-session' }) }));
jest.mock('../hooks/useAdminAuth', () => ({ useAdminAuth: () => ({ token: 'admin-session' }) }));
jest.mock('../components/DoctorLayout', () => ({ children }) => <div>{children}</div>);
jest.mock('../components/AdminLayout', () => ({ children }) => <div>{children}</div>);
jest.mock('../components/OperationalSummary', () => () => <p>Resumen</p>);
global.IS_REACT_ACT_ENVIRONMENT = true;

test('solo ofrece reintento de correos habilitados y usa el token del profesional', async () => {
  axios.get.mockResolvedValue({ data: { workerEnabled: true, jobs: [
    { id: 'failed', category: 'appointment', recipient_hint: 'p***@example.com', status: 'failed', attempts: 8, can_retry: true },
    { id: 'sent', category: 'appointment', recipient_hint: 'p***@example.com', status: 'sent', attempts: 1, can_retry: false }
  ] } });
  axios.mockResolvedValue({ data: { message: 'Aviso en cola para reintentar.' } });
  const div = document.createElement('div'), root = createRoot(div);
  try {
    await act(async () => root.render(<MemoryRouter initialEntries={['/operations?tab=notifications']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><OperationsPage /></MemoryRouter>));
    const buttons = [...div.querySelectorAll('button')].filter(button => button.textContent === 'Reintentar');
    expect(buttons).toHaveLength(1);
    await act(async () => buttons[0].click());
    expect(axios).toHaveBeenCalledWith({ method: 'post', url: 'https://example.invalid/api/operations/notifications/failed/retry', data: {}, headers: { Authorization: 'Bearer doctor-session' } });
    expect(div.textContent).toContain('Aviso en cola para reintentar.');
  } finally { await act(async () => root.unmount()); }
});

test('administración distingue un respaldo sin restauración verificada', async () => {
  axios.get.mockResolvedValue({ data: { status: { configured: true, createdAt: '2026-11-06T12:00:00Z', databaseRestoreVerified: false, attachmentsVerified: false, stale: true } } });
  const div = document.createElement('div'), root = createRoot(div);
  try {
    await act(async () => root.render(<MemoryRouter initialEntries={['/admin/operations?tab=backups']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><OperationsPage admin /></MemoryRouter>));
    expect(div.textContent).toContain('Sin verificar');
    expect(div.textContent).toContain('ATENCIÓN');
    expect(axios.get).toHaveBeenCalledWith('https://example.invalid/api/operations/admin/backups', { headers: { Authorization: 'Bearer admin-session' } });
  } finally { await act(async () => root.unmount()); }
});
