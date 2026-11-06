import React from 'react';
import { createRoot } from 'react-dom/client';
import { act, Simulate } from 'react-dom/test-utils';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import PatientAppointmentViewPage from './PatientAppointmentViewPage';
import { appointmentAPI } from '../services/api';

jest.mock('../services/api', () => ({ appointmentAPI: { getByToken: jest.fn(), getRescheduleSlots: jest.fn(), reschedulePublic: jest.fn() } }));
global.IS_REACT_ACT_ENVIRONMENT = true;

test('el paciente elige un horario y confirma el cambio desde su enlace privado', async () => {
  const appointment = { id: 'private-token', status: 'scheduled', payment_status: 'partial', booking_fee_paid: '1000', appointment_date: '2099-01-05', appointment_time: '10:00:00', duration_minutes: 30, doctor_name: 'Profesional', patient_name: 'Paciente' };
  appointmentAPI.getByToken.mockResolvedValue({ success: true, appointment });
  appointmentAPI.getRescheduleSlots.mockResolvedValue({ success: true, slots: ['11:00'] });
  appointmentAPI.reschedulePublic.mockResolvedValue({ success: true, message: 'Turno reprogramado. Se conservan los pagos.' });
  const div = document.createElement('div');
  const root = createRoot(div);
  try {
    await act(async () => root.render(<MemoryRouter initialEntries={['/patient/appointment/private-token']}><Routes><Route path="/patient/appointment/:appointmentCode" element={<PatientAppointmentViewPage />} /></Routes></MemoryRouter>));
    await act(async () => [...div.querySelectorAll('button')].find(button => button.textContent === 'Cambiar fecha y horario').click());
    await act(async () => Simulate.change(div.querySelector('#reschedule-date'), { target: { value: '2099-01-06' } }));
    expect(appointmentAPI.getRescheduleSlots).toHaveBeenCalledWith('private-token', '2099-01-06');
    await act(async () => Simulate.change(div.querySelector('#reschedule-time'), { target: { value: '11:00' } }));
    await act(async () => Simulate.submit(div.querySelector('form')));
    expect(appointmentAPI.reschedulePublic).toHaveBeenCalledWith('private-token', '2099-01-06', '11:00');
    expect(div.textContent).toContain('Turno reprogramado. Se conservan los pagos.');
  } finally { await act(async () => root.unmount()); }
});
