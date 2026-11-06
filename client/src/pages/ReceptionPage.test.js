import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import axios from 'axios';
import ReceptionPage from './ReceptionPage';

jest.mock('axios', () => ({ get: jest.fn(), post: jest.fn() }));
jest.mock('../services/api', () => ({ API_BASE_URL: 'https://example.invalid' }));
global.IS_REACT_ACT_ENVIRONMENT = true;

test('recepción usa su propia sesión, registra el saldo y cierra sin borrar la sesión del profesional', async () => {
  localStorage.setItem('token', 'professional-session');
  localStorage.setItem('receptionToken', 'reception-session');
  axios.get.mockImplementation(url => {
    if (url.endsWith('/session')) return Promise.resolve({ data: { name: 'Ana', doctorName: 'Consultorio' } });
    if (url.endsWith('/booking-data')) return Promise.resolve({ data: { patients: [], services: [] } });
    return Promise.resolve({ data: { appointments: [{ id: 'appointment-id', appointment_date: '2099-01-05', appointment_time: '10:00:00', duration_minutes: 30, patient_name: 'Paciente', status: 'scheduled', payment_status: 'partial', total_price: '1000', booking_fee_paid: '100', coverage_amount: '0' }] } });
  });
  axios.post.mockResolvedValue({ data: { success: true } });
  const confirm = jest.spyOn(window, 'confirm').mockReturnValue(true);
  const rootElement = document.createElement('div');
  const root = createRoot(rootElement);
  try {
    await act(async () => root.render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><ReceptionPage /></MemoryRouter>));
    expect(rootElement.textContent).toContain('Ana');
    await act(async () => [...rootElement.querySelectorAll('button')].find(button => button.textContent === 'Registrar saldo recibido').click());
    expect(axios.post).toHaveBeenCalledWith('https://example.invalid/api/reception/appointments/appointment-id/collect', { method: 'efectivo', amount: 900 }, { headers: { Authorization: 'Bearer reception-session' } });
    await act(async () => [...rootElement.querySelectorAll('button')].find(button => button.textContent === 'Cerrar sesión').click());
    expect(localStorage.getItem('receptionToken')).toBe(null);
    expect(localStorage.getItem('token')).toBe('professional-session');
    expect(rootElement.querySelector('input[type="password"]')).toBeTruthy();
  } finally { await act(async () => root.unmount()); confirm.mockRestore(); localStorage.clear(); }
});
