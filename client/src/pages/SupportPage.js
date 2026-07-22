import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../hooks/useAuth';
import Icon from '../components/Icon';
import DoctorLayout from '../components/DoctorLayout';
import styles from './SupportPage.module.css';

export default function SupportPage() {
  const { user, isAuthenticated } = useAuth();

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    category: 'tech',
    priority: 'medium',
    description: ''
  });

  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [myTickets, setMyTickets] = useState([]);
  const [fetchingTickets, setFetchingTickets] = useState(false);

  useEffect(() => {
    if (user) {
      setFormData(prev => ({
        ...prev,
        name: user.name || '',
        email: user.email || ''
      }));
    }
  }, [user]);

  // Cargar tickets del profesional si está autenticado
  const fetchMyTickets = async () => {
    if (!isAuthenticated) return;
    try {
      setFetchingTickets(true);
      const token = localStorage.getItem('token');
      const baseUrl = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5002';
      const response = await axios.get(`${baseUrl}/api/support/tickets/my-tickets`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data.success) {
        setMyTickets(response.data.tickets || []);
      }
    } catch (err) {
      console.error('Error al obtener mis tickets de soporte:', err);
    } finally {
      setFetchingTickets(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchMyTickets();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage('');

    try {
      const baseUrl = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5002';
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const response = await axios.post(`${baseUrl}/api/support/tickets`, formData, { headers });

      if (response.data.success) {
        setSent(true);
        setFormData(prev => ({
          ...prev,
          subject: '',
          description: ''
        }));
        if (isAuthenticated) {
          fetchMyTickets();
        }
      } else {
        setErrorMessage(response.data.message || 'Error al enviar el reporte.');
      }
    } catch (err) {
      console.error('Error al enviar ticket:', err);
      setErrorMessage(err.response?.data?.message || 'Error de conexión con el servidor.');
    } finally {
      setLoading(false);
    }
  };

  const statusBadge = (status) => {
    switch (status) {
      case 'pending':
        return <span className={`${styles.badge} ${styles.badgePending}`}>Pendiente ⏳</span>;
      case 'in_progress':
        return <span className={`${styles.badge} ${styles.badgeInProgress}`}>En Proceso 🛠️</span>;
      case 'resolved':
        return <span className={`${styles.badge} ${styles.badgeResolved}`}>Resuelto ✅</span>;
      case 'closed':
        return <span className={`${styles.badge} ${styles.badgeClosed}`}>Cerrado 📁</span>;
      default:
        return <span className={styles.badge}>{status}</span>;
    }
  };

  const mainContent = (
    <div className={styles.container}>
      {!isAuthenticated && (
        <nav className={styles.navbar}>
          <div className={styles.navContent}>
            <Link to="/" className={styles.logo}>
              <span className={`material-symbols-outlined ${styles.logoIcon}`}>hub</span>
              <span>TurnoHub Support</span>
            </Link>
            <Link to="/" className={styles.backLink}>Regresar</Link>
          </div>
        </nav>
      )}

      <main className={styles.main}>
        <div className={styles.layout}>
          {/* Columna Izquierda: Formulario */}
          <section className={styles.formSection}>
            <div className={styles.intro}>
              <h1>Reportar un Problema / Soporte</h1>
              <p>¿Tienes alguna duda técnica, falla o consulta? Tu mensaje nos llegará inmediatamente por email a <strong>admin.turnohub@gmail.com</strong> y a nuestro panel central.</p>
            </div>

            {errorMessage && (
              <div className={styles.errorAlert}>
                ⚠️ {errorMessage}
              </div>
            )}

            {sent ? (
              <div className={styles.successCard}>
                <div className={styles.successIcon}>✓</div>
                <h2>¡Reporte Enviado con Éxito!</h2>
                <p>Hemos recibido tu consulta y se notificó al administrador a <strong>admin.turnohub@gmail.com</strong>. Un miembro del equipo te responderá a la brevedad.</p>
                <button onClick={() => setSent(false)} className={styles.resetBtn}>Enviar otro reporte</button>
              </div>
            ) : (
              <form className={styles.form} onSubmit={handleSubmit}>
                <div className={styles.row}>
                  <div className={styles.group}>
                    <label>Nombre Completo</label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      placeholder="Ej: Dr. Juan Pérez"
                      required
                    />
                  </div>
                  <div className={styles.group}>
                    <label>Email de Contacto</label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      placeholder="juan@clinica.com"
                      required
                    />
                  </div>
                </div>

                <div className={styles.row}>
                  <div className={styles.group}>
                    <label>Categoría</label>
                    <select
                      name="category"
                      value={formData.category}
                      onChange={handleChange}
                      required
                    >
                      <option value="tech">Problema Técnico / Falla</option>
                      <option value="billing">Facturación / Suscripción</option>
                      <option value="sales">Información sobre Planes</option>
                      <option value="other">Otro / Sugerencia</option>
                    </select>
                  </div>
                  <div className={styles.group}>
                    <label>Prioridad</label>
                    <select
                      name="priority"
                      value={formData.priority}
                      onChange={handleChange}
                      required
                    >
                      <option value="low">Baja 🟢</option>
                      <option value="medium">Media 🟡</option>
                      <option value="high">Alta 🟠</option>
                      <option value="urgent">URGENTE 🔴</option>
                    </select>
                  </div>
                </div>

                <div className={styles.group}>
                  <label>Asunto</label>
                  <input
                    type="text"
                    name="subject"
                    value={formData.subject}
                    onChange={handleChange}
                    placeholder="Ej: Error al sincronizar Google Calendar"
                    required
                  />
                </div>

                <div className={styles.group}>
                  <label>Descripción detallada del problema</label>
                  <textarea
                    rows="5"
                    name="description"
                    value={formData.description}
                    onChange={handleChange}
                    placeholder="Describe qué sucedió, qué pantalla estabas usando o cómo podemos ayudarte..."
                    required
                  ></textarea>
                </div>

                <button type="submit" className={styles.submitBtn} disabled={loading}>
                  {loading ? 'Enviando reporte...' : 'Enviar reporte de soporte'}
                </button>
              </form>
            )}

            {/* Historial de reportes del profesional */}
            {isAuthenticated && (
              <div className={styles.myTicketsSection}>
                <h2>Mis Reportes Enviados</h2>
                {fetchingTickets ? (
                  <p>Cargando reportes anteriores...</p>
                ) : myTickets.length === 0 ? (
                  <p className={styles.emptyText}>No has registrado reportes previamente.</p>
                ) : (
                  <div className={styles.ticketsList}>
                    {myTickets.map(t => (
                      <div key={t.id} className={styles.ticketCard}>
                        <div className={styles.ticketHeader}>
                          <span className={styles.ticketSubject}>{t.subject}</span>
                          {statusBadge(t.status)}
                        </div>
                        <p className={styles.ticketDesc}>{t.description}</p>
                        <div className={styles.ticketMeta}>
                          <span>Categoría: {t.category}</span> • <span>Enviado: {new Date(t.created_at).toLocaleDateString()}</span>
                        </div>
                        {t.admin_notes && (
                          <div className={styles.adminNotesBox}>
                            <strong>Respuesta del Administrador:</strong> {t.admin_notes}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Columna Derecha: Canales Directos */}
          <aside className={styles.infoSection}>
            <div className={styles.infoCard}>
              <h3>Contacto Directo</h3>
              
              <div className={styles.contactItem}>
                <div className={styles.iconCircle}><Icon name="mail" size={20} color="#2563eb" /></div>
                <div>
                  <h4>Correo Directo</h4>
                  <p>admin.turnohub@gmail.com</p>
                </div>
              </div>

              <div className={styles.contactItem}>
                <div className={styles.iconCircle}>💬</div>
                <div>
                  <h4>WhatsApp Soporte</h4>
                  <p>+54 9 3765 40-9032</p>
                </div>
              </div>

              <div className={styles.contactItem}>
                <div className={styles.iconCircle}><Icon name="calendar" size={20} color="#2563eb" /></div>
                <div>
                  <h4>Horario de Atención</h4>
                  <p>Lunes a Viernes: 09:00 - 18:00</p>
                  <p>Sábados: 09:00 - 13:00</p>
                </div>
              </div>
            </div>

            <div className={styles.statusCard}>
              <div className={styles.statusDot}></div>
              <span>Sistemas funcionando al 100%</span>
            </div>
          </aside>
        </div>
      </main>

      {!isAuthenticated && (
        <footer className={styles.footer}>
          <p>© 2026 TurnoHub Global Support center.</p>
        </footer>
      )}
    </div>
  );

  if (isAuthenticated) {
    return <DoctorLayout>{mainContent}</DoctorLayout>;
  }

  return mainContent;
}
