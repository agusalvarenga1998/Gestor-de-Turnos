import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Icon from '../components/Icon';
import styles from './MovementsPage.module.css';

export default function MovementsPage() {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [movements, setMovements] = useState([]);
  
  // Filtros de movimientos
  const [typeFilter, setTypeFilter] = useState('all');
  const [methodFilter, setMethodFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Formulario manual
  const [amount, setAmount] = useState('');
  const [type, setType] = useState('cobro');
  const [paymentMethod, setPaymentMethod] = useState('efectivo');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formSuccess, setFormSuccess] = useState('');
  const [formError, setFormError] = useState('');

  // Modales
  const [showAddModal, setShowAddModal] = useState(false);
  const [showCloseSummary, setShowCloseSummary] = useState(false);
  const [closeData, setCloseData] = useState(null);
  const [closing, setClosing] = useState(false);

  const fetchSummary = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(
        `${process.env.REACT_APP_API_BASE_URL || 'http://localhost:5002'}/api/movements/summary`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.data.success) {
        setSummary(res.data.summary);
      }
    } catch (err) {
      console.error('Error al cargar resumen financiero:', err);
    }
  };

  const fetchMovements = async () => {
    try {
      const token = localStorage.getItem('token');
      const params = {};
      if (typeFilter !== 'all') params.type = typeFilter;
      if (methodFilter !== 'all') params.paymentMethod = methodFilter;
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;

      const res = await axios.get(
        `${process.env.REACT_APP_API_BASE_URL || 'http://localhost:5002'}/api/movements`,
        {
          headers: { Authorization: `Bearer ${token}` },
          params
        }
      );
      if (res.data.success) {
        setMovements(res.data.movements);
      }
    } catch (err) {
      console.error('Error al cargar movimientos:', err);
    }
  };

  const loadData = async () => {
    setLoading(true);
    await Promise.all([fetchSummary(), fetchMovements()]);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [typeFilter, methodFilter, startDate, endDate]);

  const handleRegisterMovement = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setFormSuccess('');
    setFormError('');

    try {
      const token = localStorage.getItem('token');
      const res = await axios.post(
        `${process.env.REACT_APP_API_BASE_URL || 'http://localhost:5002'}/api/movements`,
        {
          amount: parseFloat(amount),
          type,
          paymentMethod,
          description
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (res.data.success) {
        setFormSuccess('Movimiento registrado exitosamente.');
        setAmount('');
        setDescription('');
        setType('cobro');
        setPaymentMethod('efectivo');
        setTimeout(() => {
          setShowAddModal(false);
          setFormSuccess('');
          loadData();
        }, 1500);
      }
    } catch (err) {
      console.error('Error al crear movimiento:', err);
      setFormError(err.response?.data?.message || 'Error al guardar el movimiento.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDailyClose = async () => {
    if (!window.confirm('¿Estás seguro de realizar el arqueo y cierre diario de caja hoy? Esta acción quedará registrada en la auditoría.')) {
      return;
    }
    setClosing(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.post(
        `${process.env.REACT_APP_API_BASE_URL || 'http://localhost:5002'}/api/movements/daily-close`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.data.success) {
        setCloseData(res.data.closeSummary);
        setShowCloseSummary(true);
      }
    } catch (err) {
      console.error('Error al realizar cierre diario:', err);
      alert('Error al realizar el arqueo de caja.');
    } finally {
      setClosing(false);
    }
  };

  const handleExportCSV = () => {
    const token = localStorage.getItem('token');
    let url = `${process.env.REACT_APP_API_BASE_URL || 'http://localhost:5002'}/api/movements/export`;
    const params = [];
    if (startDate) params.push(`startDate=${startDate}`);
    if (endDate) params.push(`endDate=${endDate}`);
    if (params.length > 0) url += `?${params.join('&')}`;

    // Crear un link invisible para descargar el archivo
    const link = document.createElement('a');
    link.href = url;
    // Agregar cabecera auth en la url no es posible directo, pero el backend lo soporta si lo pasamos por query o si creamos un iframe.
    // Para simplificar, abrimos una ventana pasándole el token en la query del endpoint de exportación
    window.open(`${url}${url.includes('?') ? '&' : '?'}token=${token}`, '_blank');
  };

  if (loading && !summary) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner}></div>
        <p>Cargando caja y movimientos...</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Caja y Movimientos</h1>
          <p className={styles.subtitle}>Gestioná cobros, señas, gastos y cierres de caja diarios</p>
        </div>
        <div className={styles.headerActions}>
          <button onClick={() => setShowAddModal(true)} className={styles.primaryBtn}>
            <Icon name="plus" size={18} /> Registrar Movimiento
          </button>
          <button onClick={handleDailyClose} disabled={closing} className={styles.secondaryBtn}>
            <Icon name="check" size={18} /> Cierre Diario
          </button>
        </div>
      </header>

      {/* Resumen Superior */}
      {summary && (
        <div className={styles.summaryGrid}>
          <div className={styles.summaryCard} style={{ borderLeft: '4px solid #10b981' }}>
            <span className={styles.summaryLabel}>Cobrado Hoy (Total)</span>
            <span className={styles.summaryValue}>${summary.todayCollected.total.toLocaleString('es-ES')}</span>
            <div className={styles.paymentMethodsBreakdown}>
              <span>💵 Efec: ${summary.todayCollected.cash}</span>
              <span>🏦 Transf: ${summary.todayCollected.transfer}</span>
              <span>📱 MP: ${summary.todayCollected.mercadopago}</span>
            </div>
          </div>

          <div className={styles.summaryCard} style={{ borderLeft: '4px solid #ef4444' }}>
            <span className={styles.summaryLabel}>Total por Cobrar (Pendiente)</span>
            <span className={styles.summaryValue}>${summary.totalPending.toLocaleString('es-ES')}</span>
            <span className={styles.summaryFootnote}>Turnos activos con saldo deudor</span>
          </div>

          <div className={styles.summaryCard} style={{ borderLeft: '4px solid #f59e0b' }}>
            <span className={styles.summaryLabel}>Clientes con Deuda</span>
            <span className={styles.summaryValue}>{summary.indebtedAppointments.length}</span>
            <span className={styles.summaryFootnote}>Pacientes con saldo pendiente</span>
          </div>
        </div>
      )}

      {/* Grid Central: Lista de Deudores / Filtros e Historial */}
      <div className={styles.mainGrid}>
        
        {/* Panel Izquierdo: Clientes Deudores */}
        <div className={styles.indebtedPanel}>
          <h3 className={styles.panelTitle}>
            <Icon name="users" size={18} /> Clientes con Saldo Deudor
          </h3>
          {summary?.indebtedAppointments.length === 0 ? (
            <p className={styles.emptyText}>¡Al día! No hay clientes con deuda.</p>
          ) : (
            <div className={styles.debtList}>
              {summary?.indebtedAppointments.map((appt) => (
                <div key={appt.id} className={styles.debtCard}>
                  <div className={styles.debtCardHeader}>
                    <strong>{appt.patient_name}</strong>
                    <span className={styles.debtAmount}>Debe: ${appt.debt.toLocaleString('es-ES')}</span>
                  </div>
                  <div className={styles.debtCardBody}>
                    <p>📅 Turno: {new Date(appt.appointment_date).toLocaleDateString('es-ES')} - {appt.appointment_time.substring(0,5)} hs</p>
                    <p>💼 Servicio: {appt.service_name || 'Consulta General'}</p>
                    {appt.patient_phone && <p>📞 Tel: {appt.patient_phone}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Panel Derecho: Historial de Transacciones */}
        <div className={styles.historyPanel}>
          <div className={styles.panelHeaderWithAction}>
            <h3 className={styles.panelTitle}>
              <Icon name="list" size={18} /> Historial de Caja
            </h3>
            <button onClick={handleExportCSV} className={styles.exportBtn}>
              <Icon name="download" size={16} /> Exportar CSV
            </button>
          </div>

          {/* Filtros */}
          <div className={styles.filtersBox}>
            <div className={styles.filterItem}>
              <label>Tipo</label>
              <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
                <option value="all">Todos</option>
                <option value="cobro">Cobros</option>
                <option value="seña">Señas</option>
                <option value="gasto">Gastos</option>
                <option value="reembolso">Reembolsos</option>
              </select>
            </div>

            <div className={styles.filterItem}>
              <label>Medio de Pago</label>
              <select value={methodFilter} onChange={(e) => setMethodFilter(e.target.value)}>
                <option value="all">Todos</option>
                <option value="efectivo">Efectivo</option>
                <option value="transferencia">Transferencia</option>
                <option value="mercadopago">Mercado Pago</option>
              </select>
            </div>

            <div className={styles.filterItem}>
              <label>Desde</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>

            <div className={styles.filterItem}>
              <label>Hasta</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>

          {/* Listado */}
          {movements.length === 0 ? (
            <p className={styles.emptyText}>No se encontraron movimientos con los filtros aplicados.</p>
          ) : (
            <div className={styles.tableResponsive}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Tipo</th>
                    <th>Detalle</th>
                    <th>Método</th>
                    <th style={{ textAlign: 'right' }}>Monto</th>
                  </tr>
                </thead>
                <tbody>
                  {movements.map((mov) => {
                    const isNegative = mov.amount < 0;
                    return (
                      <tr key={mov.id}>
                        <td className={styles.dateCol}>
                          {new Date(mov.created_at).toLocaleString('es-ES', { 
                            day: '2-digit', 
                            month: '2-digit', 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })}
                        </td>
                        <td>
                          <span className={`${styles.badge} ${styles[mov.type]}`}>
                            {mov.type.toUpperCase()}
                          </span>
                        </td>
                        <td className={styles.descCol}>
                          {mov.description || 'Movimiento de caja'}
                          {mov.patient_name && (
                            <div className={styles.patientSubtext}>Paciente: {mov.patient_name}</div>
                          )}
                        </td>
                        <td>
                          <span className={styles.methodText}>
                            {mov.payment_method === 'mercadopago' ? '📱 MP' : mov.payment_method === 'transferencia' ? '🏦 Transf' : '💵 Efec'}
                          </span>
                        </td>
                        <td 
                          style={{ textAlign: 'right', fontWeight: 'bold' }} 
                          className={isNegative ? styles.negativeAmt : styles.positiveAmt}
                        >
                          {isNegative ? '-' : '+'}${Math.abs(parseFloat(mov.amount)).toLocaleString('es-ES')}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modal: Registrar Movimiento Manual */}
      {showAddModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h3>Registrar Movimiento de Caja</h3>
              <button onClick={() => setShowAddModal(false)} className={styles.closeBtn}>
                <Icon name="x" size={20} />
              </button>
            </div>
            <form onSubmit={handleRegisterMovement} className={styles.modalForm}>
              {formSuccess && <div className={styles.successAlert}>{formSuccess}</div>}
              {formError && <div className={styles.errorAlert}>{formError}</div>}

              <div className={styles.formGroup}>
                <label>Monto ($)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="Ej: 5000"
                  required
                  disabled={submitting}
                />
              </div>

              <div className={styles.formGroup}>
                <label>Tipo de Transacción</label>
                <select value={type} onChange={(e) => setType(e.target.value)} disabled={submitting}>
                  <option value="cobro">Cobro (Ingreso)</option>
                  <option value="seña">Seña (Ingreso de Reserva)</option>
                  <option value="gasto">Gasto / Egreso (Salida)</option>
                  <option value="reembolso">Reembolso (Salida)</option>
                </select>
              </div>

              <div className={styles.formGroup}>
                <label>Medio de Pago</label>
                <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} disabled={submitting}>
                  <option value="efectivo">Efectivo</option>
                  <option value="transferencia">Transferencia Bancaria</option>
                  <option value="mercadopago">Mercado Pago</option>
                </select>
              </div>

              <div className={styles.formGroup}>
                <label>Descripción / Nota</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Detalles sobre este cobro o gasto manual..."
                  rows="3"
                  disabled={submitting}
                ></textarea>
              </div>

              <div className={styles.modalActions}>
                <button type="button" onClick={() => setShowAddModal(false)} className={styles.cancelBtn} disabled={submitting}>
                  Cancelar
                </button>
                <button type="submit" className={styles.saveBtn} disabled={submitting}>
                  {submitting ? 'Registrando...' : 'Registrar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Resultado del Arqueo / Cierre de Caja */}
      {showCloseSummary && closeData && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal} style={{ maxWidth: '400px' }}>
            <div className={styles.modalHeader}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#10b981' }}>
                <Icon name="check" size={22} /> Arqueo y Cierre Diario
              </h3>
              <button onClick={() => setShowCloseSummary(false)} className={styles.closeBtn}>
                <Icon name="x" size={20} />
              </button>
            </div>
            <div className={styles.closeSummaryBody}>
              <p className={styles.closeIntro}>La caja se ha cerrado y auditado correctamente para el día de hoy.</p>
              
              <div className={styles.closeRow}>
                <span>💵 Efectivo Registrado:</span>
                <strong>${closeData.cash.toLocaleString('es-ES')}</strong>
              </div>
              <div className={styles.closeRow}>
                <span>🏦 Transferencias Registradas:</span>
                <strong>${closeData.transfer.toLocaleString('es-ES')}</strong>
              </div>
              <div className={styles.closeRow}>
                <span>📱 Mercado Pago:</span>
                <strong>${closeData.mercadopago.toLocaleString('es-ES')}</strong>
              </div>
              
              <hr className={styles.divider} />

              <div className={styles.closeRow} style={{ fontSize: '1.15rem', color: '#0f172a' }}>
                <span>💰 Total General:</span>
                <strong>${closeData.total.toLocaleString('es-ES')}</strong>
              </div>

              <div className={styles.closeRow} style={{ color: '#64748b', fontSize: '0.8rem', marginTop: '0.5rem' }}>
                <span>📦 Cantidad de Transacciones:</span>
                <strong>{closeData.transactions_count}</strong>
              </div>
              
              <button onClick={() => setShowCloseSummary(false)} className={styles.closeConfirmBtn}>
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
