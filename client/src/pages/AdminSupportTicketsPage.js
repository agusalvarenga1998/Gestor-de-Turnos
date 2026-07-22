import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAdminAuth } from '../hooks/useAdminAuth';
import AdminLayout from '../components/AdminLayout';
import Loading from '../components/Loading';
import styles from './AdminSupportTicketsPage.module.css';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5002';

export default function AdminSupportTicketsPage() {
  const { token } = useAdminAuth();

  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');

  // Ticket seleccionado para ver/editar en modal
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [editStatus, setEditStatus] = useState('');
  const [editAdminNotes, setEditAdminNotes] = useState('');
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    fetchTickets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchTickets = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_BASE_URL}/api/admin/support-tickets`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data.success) {
        setTickets(response.data.tickets || []);
      }
    } catch (err) {
      console.error('Error al cargar tickets de soporte:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (ticket) => {
    setSelectedTicket(ticket);
    setEditStatus(ticket.status || 'pending');
    setEditAdminNotes(ticket.admin_notes || '');
  };

  const handleCloseModal = () => {
    setSelectedTicket(null);
  };

  const handleUpdateTicket = async (e) => {
    e.preventDefault();
    if (!selectedTicket) return;

    try {
      setUpdating(true);
      const response = await axios.put(
        `${API_BASE_URL}/api/admin/support-tickets/${selectedTicket.id}`,
        {
          status: editStatus,
          admin_notes: editAdminNotes
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (response.data.success) {
        setTickets(prev =>
          prev.map(t => (t.id === selectedTicket.id ? response.data.ticket : t))
        );
        handleCloseModal();
      }
    } catch (err) {
      console.error('Error al actualizar ticket:', err);
      alert('Error al guardar los cambios del ticket.');
    } finally {
      setUpdating(false);
    }
  };

  const filteredTickets = tickets.filter(t => {
    const matchesSearch =
      (t.subject && t.subject.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (t.doctor_name && t.doctor_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (t.doctor_email && t.doctor_email.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesStatus = statusFilter === 'all' || t.status === statusFilter;
    const matchesPriority = priorityFilter === 'all' || t.priority === priorityFilter;

    return matchesSearch && matchesStatus && matchesPriority;
  });

  const totalTickets = tickets.length;
  const pendingCount = tickets.filter(t => t.status === 'pending').length;
  const inProgressCount = tickets.filter(t => t.status === 'in_progress').length;
  const resolvedCount = tickets.filter(t => t.status === 'resolved').length;

  const renderBadge = (status) => {
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

  return (
    <AdminLayout>
      <div className={styles.container}>
        <div className={styles.header}>
          <h1>Gestión de Tickets de Soporte</h1>
          <p>Revisa y responde a los problemas y consultas reportadas por los profesionales registrados.</p>
        </div>

        {/* Métrica Resumen */}
        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <div className={styles.statTitle}>Total Reportes</div>
            <div className={styles.statValue}>{totalTickets}</div>
          </div>
          <div className={styles.statCard} style={{ borderLeft: '4px solid #f59e0b' }}>
            <div className={styles.statTitle}>Pendientes</div>
            <div className={styles.statValue} style={{ color: '#d97706' }}>{pendingCount}</div>
          </div>
          <div className={styles.statCard} style={{ borderLeft: '4px solid #0284c7' }}>
            <div className={styles.statTitle}>En Proceso</div>
            <div className={styles.statValue} style={{ color: '#0284c7' }}>{inProgressCount}</div>
          </div>
          <div className={styles.statCard} style={{ borderLeft: '4px solid #10b981' }}>
            <div className={styles.statTitle}>Resueltos</div>
            <div className={styles.statValue} style={{ color: '#059669' }}>{resolvedCount}</div>
          </div>
        </div>

        {/* Barra de Filtros */}
        <div className={styles.filterBar}>
          <input
            type="text"
            className={styles.searchInput}
            placeholder="Buscar por profesional, email o asunto..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <select
            className={styles.selectInput}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">Todos los estados</option>
            <option value="pending">Pendientes</option>
            <option value="in_progress">En Proceso</option>
            <option value="resolved">Resueltos</option>
            <option value="closed">Cerrados</option>
          </select>
          <select
            className={styles.selectInput}
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
          >
            <option value="all">Todas las prioridades</option>
            <option value="urgent">URGENTE 🔴</option>
            <option value="high">Alta 🟠</option>
            <option value="medium">Media 🟡</option>
            <option value="low">Baja 🟢</option>
          </select>
        </div>

        {/* Tabla */}
        {loading ? (
          <Loading />
        ) : filteredTickets.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b', background: 'white', borderRadius: '12px' }}>
            No se encontraron reportes con los filtros seleccionados.
          </div>
        ) : (
          <div className={styles.tableContainer}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Profesional</th>
                  <th>Asunto</th>
                  <th>Categoría</th>
                  <th>Prioridad</th>
                  <th>Estado</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                {filteredTickets.map(t => (
                  <tr key={t.id}>
                    <td>{new Date(t.created_at).toLocaleDateString()} {new Date(t.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                    <td>
                      <strong>{t.doctor_name || 'Desconocido'}</strong>
                      <div className={styles.doctorMeta}>{t.doctor_email}</div>
                    </td>
                    <td><strong>{t.subject}</strong></td>
                    <td><span style={{ textTransform: 'capitalize' }}>{t.category}</span></td>
                    <td>
                      {t.priority === 'urgent' && '🔴 Urgente'}
                      {t.priority === 'high' && '🟠 Alta'}
                      {t.priority === 'medium' && '🟡 Media'}
                      {t.priority === 'low' && '🟢 Baja'}
                    </td>
                    <td>{renderBadge(t.status)}</td>
                    <td>
                      <button className={styles.actionBtn} onClick={() => handleOpenModal(t)}>
                        Ver / Editar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Modal de Detalle y Respuesta */}
        {selectedTicket && (
          <div className={styles.modalOverlay} onClick={handleCloseModal}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
              <div className={styles.modalHeader}>
                <div>
                  <h2>Ticket: {selectedTicket.subject}</h2>
                  <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '4px' }}>
                    Enviado el {new Date(selectedTicket.created_at).toLocaleString()}
                  </div>
                </div>
                <button className={styles.closeBtn} onClick={handleCloseModal}>&times;</button>
              </div>

              <div className={styles.detailField}>
                <div className={styles.detailLabel}>Profesional</div>
                <div><strong>{selectedTicket.doctor_name}</strong> ({selectedTicket.doctor_email})</div>
                {selectedTicket.doctor_phone && <div style={{ fontSize: '0.85rem', color: '#64748b' }}>Teléfono: {selectedTicket.doctor_phone}</div>}
              </div>

              <div className={styles.detailField}>
                <div className={styles.detailLabel}>Descripción del Problema</div>
                <div className={styles.descriptionBox}>{selectedTicket.description}</div>
              </div>

              <form onSubmit={handleUpdateTicket}>
                <div className={styles.formGroup}>
                  <label>Estado del Ticket</label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value)}
                  >
                    <option value="pending">Pendiente ⏳</option>
                    <option value="in_progress">En Proceso 🛠️</option>
                    <option value="resolved">Resuelto ✅</option>
                    <option value="closed">Cerrado 📁</option>
                  </select>
                </div>

                <div className={styles.formGroup}>
                  <label>Notas del Administrador / Respuesta Interna</label>
                  <textarea
                    rows="4"
                    value={editAdminNotes}
                    onChange={(e) => setEditAdminNotes(e.target.value)}
                    placeholder="Escribe notas sobre la resolución del problema o respuesta dada al profesional..."
                  ></textarea>
                </div>

                <div className={styles.modalActions}>
                  <button type="button" className={styles.cancelBtn} onClick={handleCloseModal}>
                    Cancelar
                  </button>
                  <button type="submit" className={styles.saveBtn} disabled={updating}>
                    {updating ? 'Guardando...' : 'Guardar Cambios'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
