import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { queueAPI } from '../services/api';
import axios from 'axios';
import styles from './PatientQueueTrackerPage.module.css';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

export default function PatientSelfQueuePage() {
  const { doctorId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [doctorInfo, setDoctorInfo] = useState(null);
  const [services, setServices] = useState([]);

  const [formData, setFormData] = useState({
    patientName: '',
    patientPhone: '',
    serviceId: ''
  });
  const [submitting, setSubmitting] = useState(false);

  const fetchDoctorInfo = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_BASE_URL}/api/queue/public/board/${doctorId}`, {
        headers: { 'ngrok-skip-browser-warning': 'true' }
      });
      if (res.data.success) {
        setDoctorInfo(res.data.doctor);
        if (res.data.doctor && !res.data.doctor.allow_self_queue) {
          setError('El auto-registro por QR está desactivado para este consultorio. Por favor consulta en recepción.');
        }
      }
    } catch (err) {
      console.error('Error cargando información del profesional:', err);
      setError('No se pudo acceder a la sala de espera de este profesional.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDoctorInfo();
  }, [doctorId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.patientName.trim()) {
      alert('Tu nombre es obligatorio.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await queueAPI.selfRegisterInQueue(doctorId, formData);
      if (res.success && res.entry) {
        // Redirigir directamente a la pantalla de seguimiento de su ticket
        navigate(`/turnero/${res.entry.tracking_token}`);
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Error al anotarse en la fila');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner}></div>
        <p>Cargando sala de espera...</p>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        {/* Cabecera */}
        {doctorInfo && (
          <div className={styles.doctorHeader}>
            <div className={styles.logoBadge}>
              <span className="material-symbols-outlined" style={{ fontSize: '28px', color: '#2563eb' }}>medical_services</span>
            </div>
            <div>
              <h1 className={styles.doctorName}>{doctorInfo.name}</h1>
              <p className={styles.doctorSub}>{doctorInfo.specialization || 'Atención Profesional'} • {doctorInfo.clinic_name || 'Consultorio'}</p>
              {doctorInfo.address && <p className={styles.doctorAddr}>📍 {doctorInfo.address}</p>}
            </div>
          </div>
        )}

        {error ? (
          <div className={styles.ticketCard} style={{ padding: '2rem', textAlign: 'center' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '48px', color: '#f59e0b' }}>info</span>
            <h3 style={{ margin: '0.5rem 0', color: '#1e293b' }}>Auto-registro no disponible</h3>
            <p style={{ color: '#64748b', fontSize: '0.9rem' }}>{error}</p>
          </div>
        ) : (
          <div className={styles.ticketCard} style={{ padding: '1.5rem' }}>
            <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#2563eb', textTransform: 'uppercase', letterSpacing: '0.05em' }}>FILA VIRTUAL EN VIVO</span>
              <h2 style={{ margin: '0.25rem 0', fontSize: '1.4rem', fontWeight: 800, color: '#0f172a' }}>🎟️ Anotarse en la Fila</h2>
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>Completa tus datos para recibir tu número de ticket y seguir tu turno desde el celular.</p>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#334155', marginBottom: '0.4rem' }}>Tu Nombre y Apellido*</label>
                <input
                  type="text"
                  placeholder="Ej: Sofía Martínez"
                  value={formData.patientName}
                  onChange={(e) => setFormData(prev => ({ ...prev, patientName: e.target.value }))}
                  required
                  style={{ width: '100%', padding: '0.8rem 1rem', border: '1px solid #cbd5e1', borderRadius: '10px', fontSize: '0.95rem', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#334155', marginBottom: '0.4rem' }}>Teléfono / WhatsApp (Opcional)</label>
                <input
                  type="tel"
                  placeholder="Ej: +54 9 11 1234-5678"
                  value={formData.patientPhone}
                  onChange={(e) => setFormData(prev => ({ ...prev, patientPhone: e.target.value }))}
                  style={{ width: '100%', padding: '0.8rem 1rem', border: '1px solid #cbd5e1', borderRadius: '10px', fontSize: '0.95rem', boxSizing: 'border-box' }}
                />
                <span style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.2rem', display: 'block' }}>Te avisaremos por WhatsApp cuando sea tu turno.</span>
              </div>

              <button
                type="submit"
                disabled={submitting}
                style={{
                  width: '100%',
                  padding: '1rem',
                  background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '12px',
                  fontSize: '1.05rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  marginTop: '0.5rem',
                  boxShadow: '0 8px 16px -4px rgba(37, 99, 235, 0.3)'
                }}
              >
                {submitting ? 'Obteniendo Ticket...' : '🎟️ Sacar Mi Ticket Digital'}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
