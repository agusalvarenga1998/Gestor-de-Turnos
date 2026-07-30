import React, { useState, useEffect, useRef } from 'react';
import DoctorLayout from '../components/DoctorLayout';
import Icon from '../components/Icon';
import Loading from '../components/Loading';
import { queueAPI, patientAPI, serviceAPI } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import styles from './LiveQueuePage.module.css';

export default function LiveQueuePage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Queue State
  const [inProgress, setInProgress] = useState(null);
  const [waitingList, setWaitingList] = useState([]);
  const [completedCount, setCompletedCount] = useState(0);
  const [totalTodayCount, setTotalTodayCount] = useState(0);
  const [allowSelfQueue, setAllowSelfQueue] = useState(true);

  // Form States
  const [patients, setPatients] = useState([]);
  const [services, setServices] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newEntryData, setNewEntryData] = useState({
    patientId: '',
    patientName: '',
    patientPhone: '',
    serviceId: '',
    notes: ''
  });
  const [isQuickPatient, setIsQuickPatient] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [copiedLinkToken, setCopiedLinkToken] = useState(null);
  const [showQrModal, setShowQrModal] = useState(false);

  const fetchQueueData = async () => {
    try {
      setLoading(true);
      const res = await queueAPI.getDoctorQueueStatus();
      if (res.success) {
        setInProgress(res.inProgress);
        setWaitingList(res.waitingList);
        setCompletedCount(res.completedCount);
        setTotalTodayCount(res.totalTodayCount);
        if (res.doctor) setAllowSelfQueue(Boolean(res.doctor.allow_self_queue));
      }
    } catch (err) {
      console.error('Error al cargar fila virtual:', err);
      setError('Error al cargar la sala de espera.');
    } finally {
      setLoading(false);
    }
  };

  const fetchAuxData = async () => {
    try {
      const [pRes, sRes] = await Promise.all([
        patientAPI.getPatients(),
        serviceAPI.getMyServices()
      ]);
      if (pRes.success) setPatients(pRes.patients || []);
      if (sRes.success) setServices(sRes.services || []);
    } catch (err) { }
  };

  useEffect(() => {
    fetchQueueData();
    fetchAuxData();
  }, []);

  const handlePatientSelect = (e) => {
    const val = e.target.value;
    if (val === '__new__') {
      setIsQuickPatient(true);
      setNewEntryData(prev => ({ ...prev, patientId: '', patientName: '', patientPhone: '' }));
    } else {
      setIsQuickPatient(false);
      const selected = patients.find(p => p.id === val);
      if (selected) {
        setNewEntryData(prev => ({
          ...prev,
          patientId: selected.id,
          patientName: selected.name,
          patientPhone: selected.phone || ''
        }));
      } else {
        setNewEntryData(prev => ({ ...prev, patientId: '', patientName: '', patientPhone: '' }));
      }
    }
  };

  const handleAddPatientToQueue = async (e) => {
    e.preventDefault();
    if (!newEntryData.patientName.trim()) {
      alert('El nombre del paciente es obligatorio.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await queueAPI.registerPatientInQueue(newEntryData);
      if (res.success) {
        setSuccessMsg(`✓ Ticket #${res.entry.ticket_number} asignado a ${res.entry.patient_name}`);
        setNewEntryData({ patientId: '', patientName: '', patientPhone: '', serviceId: '', notes: '' });
        setIsQuickPatient(false);
        setShowAddForm(false);
        fetchQueueData();
        setTimeout(() => setSuccessMsg(''), 4000);
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Error al registrar paciente en la fila');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCallNext = async () => {
    if (waitingList.length === 0) return;
    try {
      setSubmitting(true);
      const res = await queueAPI.callNextPatient();
      if (res.success) {
        setSuccessMsg(`📢 Llamando a ${res.calledPatient.patient_name} (Ticket ${res.calledPatient.ticket_code})`);
        fetchQueueData();
        setTimeout(() => setSuccessMsg(''), 4000);
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Error al llamar al siguiente paciente');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCompleteCurrent = async () => {
    if (!inProgress) return;
    try {
      setSubmitting(true);
      const res = await queueAPI.completePatient(inProgress.id);
      if (res.success) {
        setSuccessMsg(`✅ Atención finalizada de ${inProgress.patient_name}`);
        fetchQueueData();
        setTimeout(() => setSuccessMsg(''), 4000);
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Error al finalizar atención');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSkip = async (queueId) => {
    if (!window.confirm('¿Deseas saltear este turno de la fila?')) return;
    try {
      setSubmitting(true);
      const res = await queueAPI.skipPatient(queueId, 'skipped');
      if (res.success) {
        fetchQueueData();
      }
    } catch (err) {
      alert('Error al saltear turno');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleSelfQueue = async () => {
    try {
      const nextVal = !allowSelfQueue;
      const res = await queueAPI.toggleSelfRegistration(nextVal);
      if (res.success) {
        setAllowSelfQueue(res.allow_self_queue);
      }
    } catch (err) {
      alert('Error al actualizar configuración');
    }
  };

  const copyPatientTrackLink = (token) => {
    const link = `${window.location.origin}/turnero/${token}`;
    navigator.clipboard.writeText(link);
    setCopiedLinkToken(token);
    setTimeout(() => setCopiedLinkToken(null), 3000);
  };

  return (
    <DoctorLayout>
      <div className={styles.container}>
        {/* Encabezado */}
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>Fila Virtual / Orden de Llegada</h1>
            <p className={styles.subtitle}>Gestiona la sala de espera y llama a tus pacientes en tiempo real</p>
          </div>
          <div className={styles.headerActions}>
            <button 
              onClick={() => setShowAddForm(!showAddForm)} 
              className={styles.addBtn}
            >
              <Icon name="plus" size={18} color="#FFF" />
              {showAddForm ? 'Cerrar Formulario' : 'Anunciar Paciente'}
            </button>
            <button 
              onClick={() => setShowQrModal(true)}
              className={styles.qrBtn}
              title="Ver código QR para anotarse solos"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>qr_code_2</span>
              QR Sala
            </button>
          </div>
        </div>

        {successMsg && <div className={styles.successBanner}>{successMsg}</div>}
        {error && <div className={styles.errorBanner}>{error}</div>}

        {/* Resumen Superior de Métricas */}
        <div className={styles.metricsGrid}>
          <div className={styles.metricCard}>
            <div className={styles.metricIcon} style={{ background: '#ecfdf5', color: '#10b981' }}>
              <span className="material-symbols-outlined">person_play</span>
            </div>
            <div>
              <span className={styles.metricValue}>{inProgress ? inProgress.patient_name : 'Nadie'}</span>
              <span className={styles.metricLabel}>En Atención Actual</span>
            </div>
          </div>

          <div className={styles.metricCard}>
            <div className={styles.metricIcon} style={{ background: '#eff6ff', color: '#3b82f6' }}>
              <span className="material-symbols-outlined">group</span>
            </div>
            <div>
              <span className={styles.metricValue}>{waitingList.length}</span>
              <span className={styles.metricLabel}>En Espera</span>
            </div>
          </div>

          <div className={styles.metricCard}>
            <div className={styles.metricIcon} style={{ background: '#fef3c7', color: '#f59e0b' }}>
              <span className="material-symbols-outlined">task_alt</span>
            </div>
            <div>
              <span className={styles.metricValue}>{completedCount}</span>
              <span className={styles.metricLabel}>Atendidos Hoy</span>
            </div>
          </div>
        </div>

        {/* Formulario de Anunciar Paciente */}
        {showAddForm && (
          <div className={styles.addCard}>
            <div className={styles.addCardHeader}>
              <h3>➕ Registrar Llegada de Paciente a la Fila</h3>
              <p>El paciente recibirá su número de ticket y posición para seguir en vivo desde su celular.</p>
            </div>
            <form onSubmit={handleAddPatientToQueue} className={styles.form}>
              <div className={styles.formGrid}>
                <div className={styles.formGroup}>
                  <label>Seleccionar Paciente*</label>
                  <select onChange={handlePatientSelect} value={isQuickPatient ? '__new__' : newEntryData.patientId}>
                    <option value="">Buscar en mis pacientes...</option>
                    {patients.map(p => (
                      <option key={p.id} value={p.id}>{p.name} ({p.phone || 'Sin tel'})</option>
                    ))}
                    <option value="__new__">+ Crear nuevo paciente o caminante (Walk-in)...</option>
                  </select>
                </div>

                {isQuickPatient && (
                  <>
                    <div className={styles.formGroup}>
                      <label>Nombre y Apellido*</label>
                      <input
                        type="text"
                        placeholder="Ej: Laura Giménez"
                        value={newEntryData.patientName}
                        onChange={(e) => setNewEntryData(prev => ({ ...prev, patientName: e.target.value }))}
                        required
                      />
                    </div>
                    <div className={styles.formGroup}>
                      <label>Teléfono / WhatsApp</label>
                      <input
                        type="tel"
                        placeholder="Ej: +54 9 11 1234-5678"
                        value={newEntryData.patientPhone}
                        onChange={(e) => setNewEntryData(prev => ({ ...prev, patientPhone: e.target.value }))}
                      />
                    </div>
                  </>
                )}

                <div className={styles.formGroup}>
                  <label>Servicio / Práctica (Opcional)</label>
                  <select
                    value={newEntryData.serviceId}
                    onChange={(e) => setNewEntryData(prev => ({ ...prev, serviceId: e.target.value }))}
                  >
                    <option value="">Consulta general / Sin especificar</option>
                    {services.map(s => (
                      <option key={s.id} value={s.id}>{s.name} (${parseFloat(s.price).toLocaleString()})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className={styles.formActions}>
                <button type="submit" className={styles.submitBtn} disabled={submitting}>
                  {submitting ? 'Anotando...' : '✓ Ingresar a la Fila'}
                </button>
                <button type="button" onClick={() => setShowAddForm(false)} className={styles.cancelBtn}>
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Tarjeta de Control Principal (Llamada en Vivo) */}
        <div className={styles.mainControlCard}>
          <div className={styles.inProgressSection}>
            <div className={styles.sectionBadge}>🟢 EN ATENCIÓN AHORA</div>
            {inProgress ? (
              <div className={styles.inProgressDetails}>
                <div className={styles.ticketBigBadge}>{inProgress.ticket_code}</div>
                <div>
                  <h2 className={styles.inProgressName}>{inProgress.patient_name}</h2>
                  <p className={styles.inProgressSub}>
                    {inProgress.service_name || 'Consulta General'} • 
                    Llamado a las {new Date(inProgress.called_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <div className={styles.inProgressActions}>
                  <button onClick={handleCompleteCurrent} className={styles.completeBtn} disabled={submitting}>
                    <Icon name="check" size={18} color="white" />
                    Finalizar Atención
                  </button>
                </div>
              </div>
            ) : (
              <div className={styles.emptyInProgress}>
                <p>No hay ningún paciente en atención en este momento.</p>
              </div>
            )}
          </div>

          <div className={styles.callNextBanner}>
            <button
              onClick={handleCallNext}
              disabled={submitting || waitingList.length === 0}
              className={styles.callNextBtn}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '24px' }}>volume_up</span>
              {waitingList.length > 0 
                ? `📢 LLAMAR SIGUIENTE (${waitingList[0].ticket_code} - ${waitingList[0].patient_name})`
                : 'No hay pacientes esperando'
              }
            </button>
          </div>
        </div>

        {/* Lista de Espera del Día */}
        <div className={styles.waitingSection}>
          <div className={styles.sectionTitleRow}>
            <h3>📋 Lista de Espera ({waitingList.length})</h3>
            <div className={styles.toggleSelfQueueWrapper}>
              <label className={styles.switchLabel}>
                <input
                  type="checkbox"
                  checked={allowSelfQueue}
                  onChange={handleToggleSelfQueue}
                />
                <span className={styles.slider}></span>
                Permitir que los pacientes se anoten solos por QR
              </label>
            </div>
          </div>

          {loading ? (
            <Loading message="Cargando cola..." />
          ) : waitingList.length === 0 ? (
            <div className={styles.emptyQueueBox}>
              <span className="material-symbols-outlined" style={{ fontSize: '48px', color: '#cbd5e1' }}>event_seat</span>
              <h4>La sala de espera está vacía</h4>
              <p>Presiona "Anunciar Paciente" para registrar la llegada del primer turno.</p>
            </div>
          ) : (
            <div className={styles.queueTableWrapper}>
              <table className={styles.queueTable}>
                <thead>
                  <tr>
                    <th>Posición</th>
                    <th>Ticket</th>
                    <th>Paciente</th>
                    <th>Servicio</th>
                    <th>Llegada</th>
                    <th>Est. Espera</th>
                    <th>Acciones / Enlace Live</th>
                  </tr>
                </thead>
                <tbody>
                  {waitingList.map((item, idx) => (
                    <tr key={item.id} className={idx === 0 ? styles.nextInLineRow : ''}>
                      <td>
                        <span className={styles.posBadge}>#{item.position}</span>
                      </td>
                      <td>
                        <span className={styles.ticketCodeBadge}>{item.ticket_code}</span>
                      </td>
                      <td>
                        <strong className={styles.patientNameStr}>{item.patient_name}</strong>
                        {item.patient_phone && <span className={styles.phoneSub}>📱 {item.patient_phone}</span>}
                      </td>
                      <td>{item.service_name || 'General'}</td>
                      <td>{new Date(item.joined_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</td>
                      <td>~{item.estimated_wait_minutes} min</td>
                      <td>
                        <div className={styles.rowActions}>
                          <button
                            onClick={() => copyPatientTrackLink(item.tracking_token)}
                            className={styles.linkCopyBtn}
                            title="Copiar enlace de seguimiento para celular del paciente"
                          >
                            <Icon name={copiedLinkToken === item.tracking_token ? 'check' : 'copy'} size={14} />
                            {copiedLinkToken === item.tracking_token ? 'Copiado!' : 'Link Paciente'}
                          </button>
                          <button
                            onClick={() => handleSkip(item.id)}
                            className={styles.skipBtn}
                            title="Saltear paciente"
                          >
                            Saltear
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal de Código QR para el Establecimiento */}
        {showQrModal && (
          <div className={styles.qrModalOverlay}>
            <div className={styles.qrModalCard}>
              <div className={styles.qrModalHeader}>
                <h3>📱 Código QR para Sala de Espera</h3>
                <button onClick={() => setShowQrModal(false)} className={styles.closeQrBtn}>✕</button>
              </div>
              <p className={styles.qrDesc}>
                Los pacientes pueden escanear este código QR con la cámara de su celular al llegar para anotarse solos en la fila y seguir su turno.
              </p>

              <div className={styles.qrDisplayBox}>
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(`${window.location.origin}/fila/${user?.id}`)}`}
                  alt="Código QR de Fila"
                  className={styles.qrImg}
                />
                <p className={styles.qrUrlText}>{`${window.location.origin}/fila/${user?.id}`}</p>
              </div>

              <div className={styles.qrModalFooter}>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}/fila/${user?.id}`);
                    alert('Enlace copiado al portapapeles');
                  }}
                  className={styles.copyQrLinkBtn}
                >
                  Copiar Enlace
                </button>
                <button onClick={() => window.print()} className={styles.printQrBtn}>
                  🖨️ Imprimir Cartel QR
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DoctorLayout>
  );
}
