import React, { useState, useEffect } from 'react';
import axios from 'axios';
import DoctorLayout from '../components/DoctorLayout';
import Icon from '../components/Icon';
import Loading from '../components/Loading';
import { appointmentAPI, patientAPI, insuranceAPI } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import { useWebSocketContext } from '../hooks/useWebSocketContext';
import styles from './AppointmentsPage.module.css';

export default function AppointmentsPage() {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [filteredAppointments, setFilteredAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterDate, setFilterDate] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    patientId: '',
    serviceId: '',
    appointment_date: '',
    appointment_time: '',
    reason_for_visit: '',
    insurance_company_id: ''
  });
  const [patients, setPatients] = useState([]);
  const [services, setServices] = useState([]);
  const [selectedService, setSelectedService] = useState(null);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [availableSlots, setAvailableSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [patientInsurances, setPatientInsurances] = useState([]);
  const { isConnected } = useWebSocketContext();
  const [delayModal, setDelayModal] = useState({ show: false, appointmentId: null });
  const [delayMinutes, setDelayMinutes] = useState(15);

  useEffect(() => {
    fetchAppointments();
    fetchPatients();
    fetchServices();
  }, []);

  // Cargar slots disponibles cuando cambia la fecha o el servicio
  useEffect(() => {
    if (formData.appointment_date) {
      const duration = selectedService ? selectedService.duration_minutes : 30;
      loadAvailableSlots(formData.appointment_date, duration);
    } else {
      setAvailableSlots([]);
    }
  }, [formData.appointment_date, selectedService]);

  // Cargar obras sociales del paciente
  useEffect(() => {
    if (formData.patientId) {
      loadPatientInsurances(formData.patientId);
    } else {
      setPatientInsurances([]);
    }
  }, [formData.patientId]);

  const loadPatientInsurances = async (patientId) => {
    try {
      const response = await insuranceAPI.getPatientInsurances(patientId);
      if (response.success) {
        setPatientInsurances(response.insurances);
      }
    } catch (err) {
      console.error('Error cargando obras sociales del paciente:', err);
      setPatientInsurances([]);
    }
  };

  const fetchServices = async () => {
    try {
      // Usaremos el endpoint que creamos antes para obtener servicios propios
      const response = await axios.get(`${process.env.REACT_APP_API_BASE_URL || 'http://localhost:5002'}/api/services/doctor/me`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      if (response.data.success) {
        setServices(response.data.services);
      }
    } catch (err) {
      console.error('Error cargando servicios:', err);
    }
  };

  const fetchPatients = async () => {
    try {
      const response = await patientAPI.getPatients();
      if (response.success) {
        setPatients(response.patients);
      }
    } catch (err) {
      console.error('Error cargando pacientes:', err);
    }
  };

  const loadAvailableSlots = async (date, duration = 30) => {
    try {
      setLoadingSlots(true);
      const response = await appointmentAPI.getPublicAvailableSlots(user?.id || '', date, duration);
      if (response.success) {
        setAvailableSlots(response.slots || []);
      }
    } catch (err) {
      console.error('Error cargando horarios disponibles:', err);
      setAvailableSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  };

  useEffect(() => {
    let filtered = [...appointments];

    // Filtro por Estado
    if (filterStatus !== 'all') {
      filtered = filtered.filter(a => a.status === filterStatus);
    }

    // Filtro por Fecha (Normalizado)
    if (filterDate) {
      filtered = filtered.filter(a => {
        const dateStr = String(a.appointment_date).split('T')[0];
        return dateStr === filterDate;
      });
    }

    // Filtro por Buscador (Nombre o Teléfono)
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(a => {
        const name = (a.patient_name || '').toLowerCase();
        const phone = (a.patient_phone || '').toLowerCase();
        return name.includes(term) || phone.includes(term);
      });
    }

    setFilteredAppointments(filtered);
  }, [appointments, searchTerm, filterStatus, filterDate]);

  const fetchAppointments = async () => {
    try {
      setLoading(true);
      const response = await appointmentAPI.getAppointments();

      if (response.success) {
        const sorted = response.appointments.sort((a, b) => {
          const dateAStr = String(a.appointment_date).split('T')[0];
          const dateBStr = String(b.appointment_date).split('T')[0];
          const dateA = new Date(`${dateAStr}T${a.appointment_time}`);
          const dateB = new Date(`${dateBStr}T${b.appointment_time}`);
          return dateB - dateA;
        });
        setAppointments(sorted);
      }

      setError(null);
    } catch (err) {
      console.error('Error cargando citas:', err);
      setError('Error al cargar las citas');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (appointmentId, newStatus) => {
    try {
      const response = await appointmentAPI.updateAppointment(appointmentId, {
        status: newStatus
      });

      if (response.success) {
        setAppointments(prev =>
          prev.map(a => a.id === appointmentId ? response.appointment : a)
        );
      }
    } catch (err) {
      console.error('Error actualizando cita:', err);
      alert('Error al actualizar la cita');
    }
  };

  const handleDelay = async () => {
    if (!delayMinutes || delayMinutes <= 0) {
      alert('Por favor ingresa minutos válidos');
      return;
    }

    try {
      const response = await appointmentAPI.updateDelay(delayModal.appointmentId, {
        delay_minutes: delayMinutes,
        delay_reason: 'Retraso registrado'
      });

      if (response.success) {
        setAppointments(prev =>
          prev.map(a => a.id === delayModal.appointmentId
            ? { ...a, delay_minutes: delayMinutes }
            : a)
        );
        alert(`✓ Retraso de ${delayMinutes} minutos registrado`);
        setDelayModal({ show: false, appointmentId: null });
        setDelayMinutes(15);
      }
    } catch (err) {
      console.error('Error registrando retraso:', err);
      alert('Error al registrar el retraso');
    }
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    
    if (name === 'serviceId') {
      const service = services.find(s => s.id === parseInt(value));
      setSelectedService(service);
    }

    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleCreateAppointment = async (e) => {
    e.preventDefault();

    if (!formData.patientId || !formData.appointment_date || !formData.appointment_time) {
      alert('Por favor completa los campos requeridos');
      return;
    }

    try {
      setFormSubmitting(true);
      const response = await appointmentAPI.createAppointment(formData);

      if (response.success) {
        setAppointments(prev => [response.appointment, ...prev]);
        resetForm();
        setShowForm(false);
      }
    } catch (err) {
      console.error('Error creando cita:', err);
      alert('Error al crear la cita');
    } finally {
      setFormSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      patientId: '',
      serviceId: '',
      appointment_date: '',
      appointment_time: '',
      reason_for_visit: '',
      insurance_company_id: ''
    });
    setSelectedService(null);
    setPatientInsurances([]);
  };

  const getStatusBadge = (status) => {
    const badges = {
      pending: { label: 'Por Aprobar', class: styles.statusPending },
      pending_payment: { label: 'Pendiente de Pago', class: styles.statusPending },
      scheduled: { label: 'Programado', class: styles.statusScheduled },
      completed: { label: 'Completado', class: styles.statusCompleted },
      cancelled: { label: 'Cancelado', class: styles.statusCancelled },
      rejected: { label: 'Rechazado', class: styles.statusRejected }
    };
    const badge = badges[status] || badges.scheduled;
    return <span className={`${styles.statusBadge} ${badge.class}`}>{badge.label}</span>;
  };

  const handleAcceptAppointment = async (appointmentId) => {
    try {
      setLoading(true);
      const response = await appointmentAPI.acceptAppointment(appointmentId);
      if (response.success) {
        // Actualizar la cita en el estado local
        const updated = appointments.map(a =>
          a.id === appointmentId ? { ...a, status: 'scheduled' } : a
        );
        setAppointments(updated);
        alert('✓ Cita aceptada y confirmación enviada al paciente');
      }
    } catch (err) {
      console.error('Error aceptando cita:', err);
      alert('Error al aceptar la cita');
    } finally {
      setLoading(false);
    }
  };

  const handleRejectAppointment = async (appointmentId) => {
    const reason = window.prompt('¿Por qué rechazas esta cita?');
    if (reason === null) return; // Cancelado

    try {
      setLoading(true);
      const response = await appointmentAPI.rejectAppointment(appointmentId, reason);
      if (response.success) {
        // Actualizar la cita en el estado local
        const updated = appointments.map(a =>
          a.id === appointmentId ? { ...a, status: 'rejected' } : a
        );
        setAppointments(updated);
        alert('✓ Cita rechazada');
      }
    } catch (err) {
      console.error('Error rechazando cita:', err);
      alert('Error al rechazar la cita');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <DoctorLayout>
        <Loading />
      </DoctorLayout>
    );
  }

  return (
    <DoctorLayout>
      <div className={styles.container}>
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>Gestión de Citas</h1>
            <p className={styles.subtitle}>Administra todas tus citas médicas</p>
          </div>
          <button
            onClick={() => {
              resetForm();
              setShowForm(true);
            }}
            className={styles.addBtn}
          >
            <Icon name="plus" size={18} color="currentColor" />
            Nueva Cita
          </button>
        </div>

        {error && <div className={styles.errorBox}>{error}</div>}

        {/* Modal de crear cita */}
        {showForm && (
          <div className={styles.modal}>
            <div className={styles.modalContent}>
              <div className={styles.modalHeader}>
                <h2>Nueva Cita</h2>
                <button
                  onClick={() => {
                    setShowForm(false);
                    resetForm();
                  }}
                  className={styles.closeBtn}
                >
                  <Icon name="x" size={20} color="currentColor" />
                </button>
              </div>

              <form onSubmit={handleCreateAppointment} className={styles.form}>
                <div className={styles.formGroup}>
                  <label>Cliente*</label>
                  <select
                    name="patientId"
                    value={formData.patientId}
                    onChange={handleFormChange}
                    required
                  >
                    <option value="">Selecciona un cliente</option>
                    {patients.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>

                <div className={styles.formGroup}>
                  <label>Servicio*</label>
                  <select
                    name="serviceId"
                    value={formData.serviceId}
                    onChange={handleFormChange}
                    required
                  >
                    <option value="">Selecciona un servicio</option>
                    {services.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.duration_minutes} min - ${parseFloat(s.price).toLocaleString()})
                      </option>
                    ))}
                  </select>
                </div>

                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label>Fecha*</label>
                    <input
                      type="date"
                      name="appointment_date"
                      value={formData.appointment_date}
                      onChange={handleFormChange}
                      required
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label>Hora*</label>
                    {formData.appointment_date ? (
                      loadingSlots ? (
                        <div className={styles.loadingSlots}>Cargando horarios disponibles...</div>
                      ) : availableSlots.length > 0 ? (
                        <select
                          name="appointment_time"
                          value={formData.appointment_time}
                          onChange={handleFormChange}
                          required
                        >
                          <option value="">Selecciona un horario</option>
                          {availableSlots.map((slot) => (
                            <option key={slot} value={slot}>
                              {slot}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <div className={styles.noSlots}>
                          No hay horarios disponibles para esta fecha
                        </div>
                      )
                    ) : (
                      <input
                        type="time"
                        name="appointment_time"
                        value={formData.appointment_time}
                        onChange={handleFormChange}
                        placeholder="Selecciona una fecha primero"
                        disabled
                      />
                    )}
                  </div>
                </div>

                <div className={styles.formGroup}>
                  <label>Motivo de la consulta</label>
                  <input
                    type="text"
                    name="reason_for_visit"
                    placeholder="Ej: Revisión general, Dolor de cabeza..."
                    value={formData.reason_for_visit}
                    onChange={handleFormChange}
                  />
                </div>

                {patientInsurances.length > 0 && (
                  <div className={styles.formGroup}>
                    <label>Obra Social</label>
                    <select
                      name="insurance_company_id"
                      value={formData.insurance_company_id}
                      onChange={handleFormChange}
                    >
                      <option value="">Sin obra social</option>
                      {patientInsurances.map(insurance => (
                        <option key={insurance.id} value={insurance.id}>
                          {insurance.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className={styles.formActions}>
                  <button type="submit" className={styles.submitBtn} disabled={formSubmitting}>
                    {formSubmitting ? 'Creando...' : 'Crear Cita'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowForm(false);
                      resetForm();
                    }}
                    className={styles.cancelBtn}
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Toolbar de filtros */}
        <div className={styles.toolbar}>
          <div className={styles.searchBox}>
            <Icon name="search" size={18} color="#64748b" />
            <input
              type="text"
              placeholder="Buscar cliente o teléfono..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={styles.searchInput}
            />
          </div>

          <div className={styles.filters}>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className={styles.select}
            >
              <option value="all">Todos los estados</option>
              <option value="pending">Pendiente de Aprobación</option>
              <option value="pending_payment">Pendiente de Pago</option>
              <option value="scheduled">Programado</option>
              <option value="completed">Completado</option>
              <option value="cancelled">Cancelado</option>
              <option value="rejected">Rechazado</option>
            </select>

            <input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className={styles.select}
            />

            <button onClick={fetchAppointments} className={styles.refreshBtn} title="Actualizar">
              <Icon name="search" size={18} color="currentColor" />
              Actualizar
            </button>
          </div>
        </div>

        {/* Tabla de citas */}
        {filteredAppointments.length === 0 ? (
          <div className={styles.emptyState}>
            <p>No hay citas que coincidan con tus filtros</p>
          </div>
        ) : (
          <div className={styles.tableContainer}>
            <table className={styles.appointmentsTable}>
              <thead>
                <tr>
                  <th>Turno</th>
                  <th>Cliente</th>
                  <th>Motivo / Obra Social</th>
                  <th>Costo Total</th>
                  <th>Seña Pagada</th>
                  <th>Cobertura OS</th>
                  <th>Estado</th>
                  <th className={styles.toChargeHeader}>A COBRAR</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredAppointments.map((appt) => {
                  const toCharge = parseFloat(appt.total_price || 0) - parseFloat(appt.booking_fee_paid || 0) - parseFloat(appt.coverage_amount || 0);
                  
                  return (
                    <tr key={appt.id}>
                      <td className={styles.dateTime} data-label="Turno">
                        <div className={styles.date}>
                          {(() => {
                            const dateStr = String(appt.appointment_date).split('T')[0];
                            const d = new Date(dateStr + 'T12:00:00');
                            return d.toLocaleDateString('es-ES', { month: 'short', day: 'numeric' });
                          })()}
                        </div>
                        <div className={styles.time}>{appt.appointment_time}</div>
                        <div className={styles.miniCode}>{appt.appointment_code}</div>
                      </td>
                      <td className={styles.patientInfo} data-label="Cliente">
                        <div className={styles.pName}>{appt.patient_name}</div>
                        <div className={styles.pPhone}>{appt.patient_phone}</div>
                      </td>
                      <td className={styles.reasonCol} data-label="Motivo / OS">
                        <div className={styles.reasonText}>{appt.reason_for_visit || 'Visita general'}</div>
                        {appt.insurance_name && (
                          <div className={styles.insuranceBadge}>{appt.insurance_name}</div>
                        )}
                      </td>
                      <td className={styles.amount} data-label="Total">
                        ${parseFloat(appt.total_price || 0).toLocaleString()}
                      </td>
                      <td className={styles.feePaid} data-label="Seña">
                        ${parseFloat(appt.booking_fee_paid || 0).toLocaleString()}
                      </td>
                      <td className={styles.coverage} data-label="Cobertura">
                        {parseFloat(appt.coverage_amount || 0) > 0 ? `-$${parseFloat(appt.coverage_amount).toLocaleString()}` : '-'}
                      </td>
                      <td data-label="Estado">{getStatusBadge(appt.status)}</td>
                      <td className={styles.toChargeCell} data-label="A COBRAR">
                        <div className={styles.toChargeAmount}>
                          ${toCharge > 0 ? toCharge.toLocaleString() : '0'}
                        </div>
                      </td>
                      <td className={styles.actions} data-label="Acciones">
                        <div className={styles.actionButtons}>
                        {['pending', 'pending_payment', 'scheduled'].includes(appt.status) ? (
                          <>
                            <button
                              onClick={() => handleAcceptAppointment(appt.id)}
                              className={styles.acceptBtn}
                              title="Confirmar/Aceptar cita"
                              disabled={appt.status === 'scheduled'}
                              style={appt.status === 'scheduled' ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
                            >
                              ✓ {appt.status === 'scheduled' ? 'Confirmado' : 'Aceptar'}
                            </button>
                            <button
                              onClick={() => handleRejectAppointment(appt.id)}
                              className={styles.rejectBtn}
                              title="Rechazar cita"
                            >
                              ✗ Rechazar
                            </button>
                          </>
                        ) : (
                          <>
                            <select
                              value={appt.status}
                              onChange={(e) => handleStatusChange(appt.id, e.target.value)}
                              className={styles.statusSelect}
                            >
                              <option value="scheduled">Programado</option>
                              <option value="completed">Completado</option>
                              <option value="cancelled">Cancelado</option>
                            </select>
                            <button
                              onClick={() => setDelayModal({ show: true, appointmentId: appt.id })}
                              className={styles.delayBtn}
                              title="Registrar retraso"
                            >
                              ⏱️ Retraso
                            </button>
                          </>
                        )}
                        </div>
                        {appt.delay_minutes > 0 && (
                          <div className={styles.delayBadge}>+{appt.delay_minutes} min</div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className={styles.footer}>
          <p>Total: <strong>{filteredAppointments.length}</strong> cita(s)</p>
        </div>

        {/* Delay Modal */}
        {delayModal.show && (
          <div className={styles.modal}>
            <div className={styles.modalContent}>
              <div className={styles.modalHeader}>
                <h2>Registrar Retraso</h2>
                <button
                  onClick={() => {
                    setDelayModal({ show: false, appointmentId: null });
                    setDelayMinutes(15);
                  }}
                  className={styles.closeBtn}
                >
                  ✕
                </button>
              </div>

              <div style={{ padding: '1.5rem' }}>
                <p style={{ marginBottom: '1rem', color: 'var(--text-secondary)' }}>
                  ¿Cuántos minutos de retraso tiene esta cita?
                </p>

                <div className={styles.delayOptions}>
                  {[15, 30, 45, 60].map(mins => (
                    <button
                      key={mins}
                      onClick={() => setDelayMinutes(mins)}
                      className={`${styles.optionBtn} ${delayMinutes === mins ? styles.active : ''}`}
                    >
                      {mins} min
                    </button>
                  ))}
                </div>

                <div className={styles.customInput}>
                  <label>O ingresa minutos personalizados:</label>
                  <input
                    type="number"
                    min="1"
                    max="180"
                    value={delayMinutes}
                    onChange={(e) => setDelayMinutes(parseInt(e.target.value) || 0)}
                    className={styles.input}
                  />
                </div>

                <div className={styles.modalButtons}>
                  <button
                    onClick={() => {
                      setDelayModal({ show: false, appointmentId: null });
                      setDelayMinutes(15);
                    }}
                    className={styles.cancelBtn}
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleDelay}
                    className={styles.confirmBtn}
                  >
                    Registrar Retraso
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </DoctorLayout>
  );
}
