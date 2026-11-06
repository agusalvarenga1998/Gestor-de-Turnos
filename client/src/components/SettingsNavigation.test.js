import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import SettingsNavigation from './SettingsNavigation';
global.IS_REACT_ACT_ENVIRONMENT = true;

test('agrupa configuración y conserva el acceso al plan y los horarios', async () => {
  const onSelect = jest.fn(), div = document.createElement('div'), root = createRoot(div);
  try {
    await act(async () => root.render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><SettingsNavigation activeTab="profile" onSelect={onSelect} /></MemoryRouter>));
    expect([...div.querySelectorAll('h3')].map(element => element.textContent)).toEqual(['Consultorio', 'Agenda', 'Cobros', 'Notificaciones', 'Plan', 'Seguridad']);
    await act(async () => [...div.querySelectorAll('button')].find(button => button.textContent === 'Plan y renovación').click());
    expect(onSelect).toHaveBeenCalledWith('subscription');
    expect(div.querySelector('a[href="/working-hours"]')).toBeTruthy();
  } finally { await act(async () => root.unmount()); }
});
