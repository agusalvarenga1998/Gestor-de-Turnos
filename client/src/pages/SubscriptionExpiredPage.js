import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import axios from 'axios';
import apiClient from '../services/api';
import styles from './SubscriptionExpiredPage.module.css';

export default function SubscriptionExpiredPage() {
  const navigate = useNavigate();
  const { user, logout, refreshUser } = useAuth();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [requestSent, setRequestSent] = useState(false);

  useEffect(() => {
    fetchPlans();
    
    // Polling para verificar si el plan ha sido activado por el webhook de MP o el admin
    const interval = setInterval(async () => {
      if (user) {
        try {
          const res = await apiClient.get('/api/doctor/profile');
          if (res.data.success && res.data.doctor.subscription_status === 'active') {
            await refreshUser();
            navigate('/dashboard');
          }
        } catch (e) {
          // ignore
        }
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [user, navigate, refreshUser]);

  const fetchPlans = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${process.env.REACT_APP_API_BASE_URL || 'http://localhost:5002'}/api/admin/public/plans`);
      if (res.data.success) {
        setPlans(res.data.plans);
      }
    } catch (e) {
      console.error('Error fetching plans:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
  };

  const handleRequestPlan = async (planId) => {
    if (!window.confirm('¿Confirmas que deseas enviar la solicitud para activar este plan? El administrador revisará tu solicitud.')) return;
    try {
      setSubmitting(true);
      const response = await apiClient.post('/api/doctor/subscriptions/request', { pricing_plan_id: planId });
      if (response.data.success) {
        setRequestSent(true);
        alert('✓ Solicitud enviada correctamente. Tu cuenta se activará en cuanto el administrador la apruebe.');
      }
    } catch (err) {
      console.error('Error al solicitar plan:', err);
      alert(err.response?.data?.message || 'Error al enviar la solicitud.');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePayPlan = async (planId) => {
    try {
      setSubmitting(true);
      const response = await apiClient.post('/api/doctor/subscriptions/mercadopago-preference', { pricing_plan_id: planId });
      if (response.data.success && response.data.initPoint) {
        window.location.href = response.data.initPoint;
      } else {
        alert('Error al generar la preferencia de pago.');
      }
    } catch (err) {
      console.error('Error en pago de plan:', err);
      alert(err.response?.data?.message || 'Error al procesar el pago.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.iconWrapper}>
          <div className={styles.icon}>⚠️</div>
        </div>

        <h1 className={styles.title}>Tu Cuenta ha Expirado</h1>
        
        <div className={styles.message}>
          <p className={styles.highlight}>
            Tu acceso a TurnoHub se encuentra suspendido temporalmente por vencimiento de suscripción.
          </p>
          <p>
            Elige uno de nuestros planes comerciales a continuación para reactivar tu cuenta de inmediato o enviar una solicitud al administrador.
          </p>
        </div>

        {requestSent && (
          <div className={styles.alertSuccess}>
            <strong>¡Solicitud Pendiente!</strong> Ya hemos enviado tu solicitud al administrador. Tu cuenta se reactivará automáticamente una vez aprobada.
          </div>
        )}

        <div className={styles.plansSection}>
          <h2>Planes Disponibles</h2>
          {loading ? (
            <p>Cargando planes comerciales...</p>
          ) : (
            <div className={styles.plansGrid}>
              {plans.map(p => (
                <div key={p.id} className={`${styles.planCard} ${p.is_popular ? styles.popular : ''}`}>
                  {p.is_popular && <span className={styles.popularLabel}>Recomendado</span>}
                  <h3>{p.name}</h3>
                  <div className={styles.price}>
                    <span className={styles.amount}>
                      {(() => {
                        if (p.price === null || p.price === undefined || p.price === '') return 'Consultar';
                        const str = String(p.price).trim();
                        if (str.includes('%')) return str;
                        const num = parseFloat(str);
                        if (!isNaN(num)) return `$${num.toLocaleString('es-AR')}`;
                        return str.startsWith('$') ? str : `$${str}`;
                      })()}
                    </span>
                    <span className={styles.period}>/ {p.price_period === 'monthly' ? 'mes' : (p.price_period || 'mes')}</span>
                  </div>
                  <p className={styles.planDesc}>{p.description}</p>
                  
                  <div className={styles.planActions}>
                    <button
                      className={styles.payBtn}
                      onClick={() => handlePayPlan(p.id)}
                      disabled={submitting}
                    >
                      Pagar Online
                    </button>
                    <button
                      className={styles.requestBtn}
                      onClick={() => handleRequestPlan(p.id)}
                      disabled={submitting}
                    >
                      Solicitar Habilitación Manual
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className={styles.footerActions}>
          <button
            className={styles.logoutBtn}
            onClick={handleLogout}
          >
            Cerrar Sesión
          </button>
        </div>
      </div>
    </div>
  );
}
