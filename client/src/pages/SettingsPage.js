import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';
import DoctorLayout from '../components/DoctorLayout';
import Icon from '../components/Icon';
import { useAuth } from '../hooks/useAuth';
import apiClient, { googleAPI, doctorAPI } from '../services/api';
import { RUBROS_ESPECIALIDADES } from '../constants/categories';
import OnboardingChecklist from '../components/OnboardingChecklist';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import styles from './SettingsPage.module.css';

// Corregir iconos de Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const doctorIcon = L.divIcon({
  className: 'th-custom-marker',
  html: `
    <div style="width: 38px; height: 50px; position: relative; cursor: pointer;">
      <svg width="38" height="50" viewBox="0 0 38 50" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0px 4px 8px rgba(0,0,0,0.35));">
        <path d="M19 0C8.50659 0 0 8.50659 0 19C0 31.5 19 50 19 50C19 50 38 31.5 38 19C38 8.50659 29.4934 0 19 0Z" fill="#2563eb" stroke="#ffffff" stroke-width="2.5"/>
        <circle cx="19" cy="19" r="12.5" fill="#1d4ed8" />
        <text x="19" y="20.5" font-family="Arial, Helvetica, sans-serif" font-weight="900" font-size="14" fill="#ffffff" text-anchor="middle" dominant-baseline="central" letter-spacing="-0.5px">TH</text>
      </svg>
    </div>
  `,
  iconSize: [38, 50],
  iconAnchor: [19, 50],
  popupAnchor: [0, -50]
});

export default function SettingsPage() {
  const { user, token, refreshUser } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [googleConnected, setGoogleConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [profileData, setProfileData] = useState({
    rubro: '',
    specialization: '',
    clinic_name: '',
    license_number: '',
    phone: '',
    address: '',
    latitude: null,
    longitude: null,
    booking_fee: 0,
    appointment_price: 0,
    mp_connected: false,
    date_of_birth: ''
  });
  const [mapCenter, setMapCenter] = useState([-34.6037, -58.3816]);
  const [savingProfile, setSavingProfile] = useState(false);
  const [customSpecialty, setCustomSpecialty] = useState('');
  const [isCustomSpecialty, setIsCustomSpecialty] = useState(false);
  const [mpAccount, setMpAccount] = useState(null);
  const [loadingMp, setLoadingMp] = useState(false);
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [loadingPush, setLoadingPush] = useState(false);
  const [loadingTestPush, setLoadingTestPush] = useState(false);
  const [pushLogs, setPushLogs] = useState('');
  const [showLogs, setShowLogs] = useState(false);
  const [openSections, setOpenSections] = useState({
    google: window.innerWidth > 768,
    push: window.innerWidth > 768,
    mercadopago: window.innerWidth > 768,
    profile: true,
    onboarding: false,
    security: false,
    subscription: false
  });

  // Estados de Navegación por Categorías (Tabs)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState(() => {
    const tabFromUrl = searchParams.get('tab');
    if (tabFromUrl && ['profile', 'mercadopago', 'google', 'push', 'subscription', 'security', 'onboarding'].includes(tabFromUrl)) {
      return tabFromUrl;
    }
    return 'profile';
  });

  useEffect(() => {
    const tabFromUrl = searchParams.get('tab');
    if (tabFromUrl && ['profile', 'mercadopago', 'google', 'push', 'subscription', 'security', 'onboarding'].includes(tabFromUrl)) {
      setActiveTab(tabFromUrl);
    }
  }, [searchParams]);

  const handleSelectTab = (tabId) => {
    setActiveTab(tabId);
    const newParams = new URLSearchParams(searchParams);
    newParams.set('tab', tabId);
    setSearchParams(newParams, { replace: true });
  };

  // Estados de Seguridad
  const [securityData, setSecurityData] = useState({
    emailVerified: false
  });
  const [loadingSecurity, setLoadingSecurity] = useState(false);
  const [securityError, setSecurityError] = useState('');
  const [securitySuccess, setSecuritySuccess] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);

  // Estados de Suscripción
  const [plans, setPlans] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [loadingSub, setLoadingSub] = useState(false);
  const [submittingSub, setSubmittingSub] = useState(false);

  const fetchSubscriptionData = async () => {
    try {
      setLoadingSub(true);
      const plansRes = await axios.get(`${process.env.REACT_APP_API_BASE_URL || 'http://localhost:5002'}/api/admin/public/plans`);
      if (plansRes.data.success) {
        setPlans(plansRes.data.plans);
      }
      
      const historyRes = await apiClient.get('/api/doctor/subscriptions/history');
      if (historyRes.data.success) {
        setSubscriptions(historyRes.data.subscriptions);
      }
    } catch (err) {
      console.error('Error al cargar datos de suscripción:', err);
    } finally {
      setLoadingSub(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchSubscriptionData();
    }
  }, [user]);

  const handleRequestPlan = async (planId) => {
    if (!window.confirm('¿Confirmas que deseas enviar la solicitud para activar este plan? El administrador revisará tu solicitud.')) return;
    try {
      setSubmittingSub(true);
      const response = await apiClient.post('/api/doctor/subscriptions/request', { pricing_plan_id: planId });
      if (response.data.success) {
        alert('✓ Solicitud enviada correctamente. El administrador la revisará a la brevedad.');
        fetchSubscriptionData();
      }
    } catch (err) {
      console.error('Error al solicitar plan:', err);
      alert(err.response?.data?.message || 'Error al enviar la solicitud.');
    } finally {
      setSubmittingSub(false);
    }
  };

  const handlePayPlan = async (planId) => {
    try {
      setSubmittingSub(true);
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
      setSubmittingSub(false);
    }
  };

  const handleSendVerification = async () => {
    setLoadingSecurity(true);
    setSecurityError('');
    setSecuritySuccess('');
    try {
      const response = await apiClient.post('/api/auth/profile/send-verification');
      if (response.data.success) {
        setSecuritySuccess('Código de verificación generado: ' + response.data.verificationToken);
      }
    } catch (err) {
      setSecurityError('Error al enviar código de verificación.');
    } finally {
      setLoadingSecurity(false);
    }
  };



  const handleLogoutAll = async () => {
    if (!window.confirm('¿Estás seguro? Esto cerrará tu sesión en TODOS tus dispositivos móviles y web actuales.')) return;
    setLoadingSecurity(true);
    try {
      const response = await apiClient.post('/api/auth/profile/logout-all');
      if (response.data.success) {
        alert('Sesiones cerradas con éxito. Por favor vuelve a iniciar sesión.');
        localStorage.clear();
        window.location.href = '/login';
      }
    } catch (err) {
      setSecurityError('Error al cerrar todas las sesiones.');
    } finally {
      setLoadingSecurity(false);
    }
  };

  const handleExportData = () => {
    const token = localStorage.getItem('token');
    window.open(`${process.env.REACT_APP_API_BASE_URL || ''}/api/auth/profile/export?token=${token}`, '_blank');
  };

  const handleDeleteAccount = async () => {
    const code = window.prompt('ATENCIÓN ⚠️: Esta acción es irreversible. Se eliminarán tus turnos, servicios, registros de pacientes y cuenta. Escribe "ELIMINAR MI CUENTA" para proceder:');
    if (code !== 'ELIMINAR MI CUENTA') {
      alert('Confirmación incorrecta.');
      return;
    }
    setLoadingSecurity(true);
    try {
      const response = await apiClient.delete('/api/auth/profile/delete-account');
      if (response.data.success) {
        alert('Cuenta eliminada permanentemente. Esperamos volver a verte.');
        localStorage.clear();
        window.location.href = '/register';
      }
    } catch (err) {
      setSecurityError('Error al eliminar tu cuenta.');
    } finally {
      setLoadingSecurity(false);
    }
  };

  const toggleSection = (section) => {
    setOpenSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  // Componente para manejar clics en el mapa
  function LocationMarker() {
    useMapEvents({
      click(e) {
        setProfileData(prev => ({
          ...prev,
          latitude: e.latlng.lat,
          longitude: e.latlng.lng
        }));
      },
    });

    return profileData.latitude && profileData.longitude ? (
      <Marker position={[profileData.latitude, profileData.longitude]} icon={doctorIcon} draggable={true}
        eventHandlers={{
          dragend: (e) => {
            const marker = e.target;
            const position = marker.getLatLng();
            setProfileData(prev => ({
              ...prev,
              latitude: position.lat,
              longitude: position.lng
            }));
          },
        }}
      />
    ) : null;
  }

  // Componente para mover la cámara
  function RecenterMap({ position }) {
    const map = useMapEvents({});
    useEffect(() => {
      if (position[0] && position[1]) {
        map.setView(position, 15);
      }
    }, [position]);
    return null;
  }

  useEffect(() => {
    fetchGoogleStatus();
    checkCurrentPushSubscription();

    // Cargar datos del usuario
    if (user) {
      const rub = user.rubro || '';
      const spec = user.specialization || '';
      const isCustom = rub && spec && (!RUBROS_ESPECIALIDADES[rub] || !RUBROS_ESPECIALIDADES[rub].includes(spec));

      setProfileData({
        rubro: rub,
        specialization: isCustom ? '__custom__' : spec,
        clinic_name: user.clinic_name || '',
        license_number: user.license_number || '',
        phone: user.phone || '',
        address: user.address || '',
        latitude: user.latitude || null,
        longitude: user.longitude || null,
        booking_fee: user.booking_fee || 0,
        appointment_price: user.appointment_price || 0,
        mp_connected: user.mp_connected || false,
        date_of_birth: user.date_of_birth ? user.date_of_birth.substring(0, 10) : ''
      });
      setIsCustomSpecialty(isCustom);
      setCustomSpecialty(isCustom ? spec : '');
      setSecurityData({
        twoFactorEnabled: user.two_factor_enabled || false,
        emailVerified: user.email_verified || false
      });
      
      if (user.latitude && user.longitude) {
        setMapCenter([user.latitude, user.longitude]);
      }
    }

    // Detectar si viene del callback de Google
    if (searchParams.get('connected') === 'true') {
      setSuccessMessage('✓ Google Calendar conectado exitosamente');
      handleSelectTab('google');
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('connected');
      setSearchParams(newParams, { replace: true });
      setTimeout(() => setSuccessMessage(''), 5000);
    }

    if (searchParams.get('error') === 'true') {
      setSuccessMessage('✗ Error al conectar Google Calendar');
      handleSelectTab('google');
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('error');
      setSearchParams(newParams, { replace: true });
      setTimeout(() => setSuccessMessage(''), 5000);
    }

    // Detectar si viene del callback de Mercado Pago
    if (searchParams.get('mp_connected') === 'true') {
      setSuccessMessage('✓ Mercado Pago conectado exitosamente');
      refreshUser();
      handleSelectTab('mercadopago');
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('mp_connected');
      setSearchParams(newParams, { replace: true });
      setTimeout(() => setSuccessMessage(''), 5000);
    }

    if (searchParams.get('mp_connected') === 'error') {
      setSuccessMessage('✗ Error al conectar Mercado Pago');
      handleSelectTab('mercadopago');
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('mp_connected');
      setSearchParams(newParams, { replace: true });
      setTimeout(() => setSuccessMessage(''), 5000);
    }
  }, [searchParams, user, refreshUser, setSearchParams]);

  useEffect(() => {
    const fetchMpAccount = async () => {
      if (!user || !user.mp_connected) {
        setMpAccount(null);
        return;
      }
      try {
        setLoadingMp(true);
        const response = await apiClient.get('/api/mercadopago/oauth/account');
        if (response.data.success && response.data.connected) {
          setMpAccount(response.data.account);
        }
      } catch (err) {
        // Silenciar error 404 si el backend en producción no ha sido desplegado con el nuevo endpoint
        if (err.response?.status !== 404) {
          console.error('Error fetching Mercado Pago account:', err);
        }
      } finally {
        setLoadingMp(false);
      }
    };

    fetchMpAccount();
  }, [user]);

  const fetchGoogleStatus = async () => {
    try {
      setLoading(true);
      const response = await googleAPI.getStatus();
      setGoogleConnected(response.connected || false);
    } catch (err) {
      console.error('Error obteniendo estado de Google:', err);
    } finally {
      setLoading(false);
    }
  };

  const checkCurrentPushSubscription = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      return;
    }
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      setPushSubscribed(!!sub);
    } catch (err) {
      console.error('Error checking push subscription:', err);
    }
  };

  function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  const handleSubscribePush = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      alert('Las notificaciones push no son compatibles con este navegador o dispositivo.');
      return;
    }

    setLoadingPush(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        alert('Permiso de notificaciones rechazado. Actívalo en la configuración de tu navegador.');
        setLoadingPush(false);
        return;
      }

      const reg = await navigator.serviceWorker.ready;
      const response = await doctorAPI.getPushPublicKey();
      if (!response.success || !response.publicKey) {
        throw new Error('No se pudo obtener la clave pública VAPID.');
      }

      const convertedVapidKey = urlBase64ToUint8Array(response.publicKey);

      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedVapidKey
      });

      const saveResponse = await doctorAPI.savePushSubscription(subscription);
      if (saveResponse.success) {
        setPushSubscribed(true);
        setSuccessMessage('Notificaciones push activadas correctamente en este dispositivo.');
      } else {
        throw new Error(saveResponse.message);
      }
    } catch (err) {
      console.error('Error al suscribir a notificaciones push:', err);
      alert(`Error al activar notificaciones: ${err.message}`);
    } finally {
      setLoadingPush(false);
    }
  };

  const handleUnsubscribePush = async () => {
    if (!('serviceWorker' in navigator)) return;
    setLoadingPush(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await doctorAPI.deletePushSubscription(sub.endpoint);
        await sub.unsubscribe();
      }
      setPushSubscribed(false);
      setSuccessMessage('Notificaciones desactivadas en este dispositivo.');
    } catch (err) {
      console.error('Error al dar de baja notificaciones:', err);
      alert('Error al desactivar notificaciones.');
    } finally {
      setLoadingPush(false);
    }
  };

  const handleSendTestPush = async () => {
    setLoadingTestPush(true);
    try {
      const response = await doctorAPI.sendTestPushNotification();
      if (response.success) {
        setSuccessMessage('✓ ' + response.message);
        setTimeout(() => setSuccessMessage(''), 5000);
      } else {
        alert(`Error al enviar prueba: ${response.message}`);
      }
    } catch (err) {
      console.error('Error al enviar push de prueba:', err);
      const errMsg = err.response?.data?.message || err.message;
      alert(`Error al enviar push de prueba: ${errMsg}`);
    } finally {
      setLoadingTestPush(false);
    }
  };

  const handleFetchPushLogs = async () => {
    if (showLogs) {
      setShowLogs(false);
      return;
    }
    try {
      const response = await apiClient.get('/api/doctor/push-subscription/debug-logs');
      if (response.data.success) {
        setPushLogs(response.data.logs);
        setShowLogs(true);
      } else {
        alert('Error al obtener logs: ' + response.data.message);
      }
    } catch (err) {
      console.error(err);
      alert('Error al obtener logs de depuración');
    }
  };

  const handleRubroChange = (e) => {
    const val = e.target.value;
    setProfileData(prev => ({
      ...prev,
      rubro: val,
      specialization: ''
    }));
    setIsCustomSpecialty(false);
    setCustomSpecialty('');
  };

  const handleSpecializationChange = (e) => {
    const val = e.target.value;
    if (val === '__custom__') {
      setIsCustomSpecialty(true);
      setProfileData(prev => ({
        ...prev,
        specialization: '__custom__'
      }));
    } else {
      setIsCustomSpecialty(false);
      setProfileData(prev => ({
        ...prev,
        specialization: val
      }));
    }
  };

  const handleConnect = () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setSuccessMessage('✗ No hay sesión activa');
        return;
      }
      window.location.href = `${process.env.REACT_APP_API_BASE_URL || ''}/api/google/auth?token=${token}`;
    } catch (err) {
      console.error('Error conectando:', err);
      setSuccessMessage('✗ Error al conectar');
    }
  };

  const handleDisconnect = async () => {
    if (!window.confirm('¿Desconectar Google Calendar?')) {
      return;
    }

    try {
      setDisconnecting(true);
      const response = await googleAPI.disconnect();

      if (response.success) {
        setGoogleConnected(false);
        setSuccessMessage('✓ Google Calendar desconectado');
        setTimeout(() => setSuccessMessage(''), 5000);
      }
    } catch (err) {
      console.error('Error desconectando:', err);
      setSuccessMessage('✗ Error al desconectar');
      setTimeout(() => setSuccessMessage(''), 5000);
    } finally {
      setDisconnecting(false);
    }
  };

  const handleProfileChange = (e) => {
    const { name, value } = e.target;
    setProfileData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleVerifyAddress = async () => {
    if (!profileData.address) return;
    try {
      setSavingProfile(true);
      const res = await axios.get(`https://nominatim.openstreetmap.org/search`, {
        params: { q: profileData.address, format: 'json', limit: 1 },
        headers: { 'User-Agent': 'TurnoHub-App/1.0' }
      });
      if (res.data && res.data.length > 0) {
        const { lat, lon } = res.data[0];
        setProfileData(prev => ({ ...prev, latitude: parseFloat(lat), longitude: parseFloat(lon) }));
        setMapCenter([parseFloat(lat), parseFloat(lon)]);
      }
    } catch (err) {
      console.error('Error verificando:', err);
    } finally {
      setSavingProfile(false);
    }
  };

  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      alert('La geolocalización no es compatible con este navegador o dispositivo.');
      return;
    }
    setSavingProfile(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        try {
          const res = await axios.get('https://nominatim.openstreetmap.org/reverse', {
            params: {
              lat: latitude,
              lon: longitude,
              format: 'json',
            },
            headers: { 'User-Agent': 'TurnoHub-App/1.0' }
          });
          
          let addressVal = '';
          if (res.data && res.data.display_name) {
            addressVal = res.data.display_name;
          } else {
            addressVal = `${latitude}, ${longitude}`;
          }

          setProfileData(prev => ({
            ...prev,
            address: addressVal,
            latitude,
            longitude
          }));
          setMapCenter([latitude, longitude]);
          setSuccessMessage('✓ Ubicación obtenida exitosamente');
          setTimeout(() => setSuccessMessage(''), 5000);
        } catch (err) {
          console.error('Error in reverse geocoding:', err);
          setProfileData(prev => ({
            ...prev,
            latitude,
            longitude
          }));
          setMapCenter([latitude, longitude]);
          alert('Ubicación obtenida pero no pudimos decodificar la dirección de texto.');
        } finally {
          setSavingProfile(false);
        }
      },
      (error) => {
        console.error('Error getting position:', error);
        alert(`Error al obtener ubicación: ${error.message}`);
        setSavingProfile(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    try {
      setSavingProfile(true);
      
      const finalSpecialization = isCustomSpecialty ? customSpecialty.trim() : profileData.specialization;
      if (!profileData.rubro || !finalSpecialization || !profileData.address) {
        setSuccessMessage('✗ Rubro, Especialidad y Dirección son obligatorios');
        setTimeout(() => setSuccessMessage(''), 5000);
        return;
      }

      const response = await apiClient.put(
        '/api/auth/profile',
        {
          ...profileData,
          specialization: finalSpecialization
        }
      );

      if (response.data.success) {
        setSuccessMessage('✓ Perfil actualizado correctamente');
        await refreshUser();
        setTimeout(() => setSuccessMessage(''), 5000);
      }
    } catch (err) {
      console.error('Error guardando perfil:', err);
      setSuccessMessage('✗ Error al guardar cambios');
      setTimeout(() => setSuccessMessage(''), 5000);
    } finally {
      setSavingProfile(false);
    }
  };

  return (
    <DoctorLayout>
      <div className={styles.container}>
        <div className={styles.header}>
          <h1 className={styles.title}>Configuración del Perfil</h1>
          <p className={styles.subtitle}>Gestiona tu cuenta, integraciones de cobro, sincronización y preferencias.</p>
        </div>

        {successMessage && (
          <div className={styles.successMessage}>
            {successMessage}
          </div>
        )}

        {(!user?.rubro || !user?.specialization || !user?.address) && (
          <div className={styles.warningMessage}>
            <Icon name="warning" size={24} color="#b45309" />
            <span>Por favor, completa tu rubro, especialidad y dirección del establecimiento (ubicándola en el mapa) para activar tu perfil y comenzar a recibir turnos.</span>
          </div>
        )}

        {/* Selector / Menú Desplegable para Celulares */}
        <div className={styles.mobileCategoryMenu}>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className={styles.mobileMenuToggleBtn}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="material-symbols-outlined" style={{ color: '#2563eb', fontSize: '20px' }}>settings</span>
              <span style={{ fontWeight: 800, fontSize: '0.95rem' }}>
                {activeTab === 'profile' && '👤 Datos Generales'}
                {activeTab === 'mercadopago' && '💳 Mercado Pago'}
                {activeTab === 'google' && '📅 Google Calendar'}
                {activeTab === 'push' && '🔔 Notificaciones Celular'}
                {activeTab === 'subscription' && '💎 Plan y Suscripción'}
                {activeTab === 'security' && '🔐 Seguridad y Datos'}
                {activeTab === 'onboarding' && '📋 Guía de Inicio'}
              </span>
            </div>
            <span className="material-symbols-outlined" style={{ transition: 'transform 0.2s', transform: mobileMenuOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>
              expand_more
            </span>
          </button>

          {mobileMenuOpen && (
            <div className={styles.mobileMenuList}>
              <div className={styles.mobileMenuGroupTitle}>CONFIGURACIÓN DE CUENTA</div>
              <button
                type="button"
                className={`${styles.mobileMenuItem} ${activeTab === 'profile' ? styles.mobileMenuItemActive : ''}`}
                onClick={() => { handleSelectTab('profile'); setMobileMenuOpen(false); }}
              >
                <Icon name="users" size={18} color={activeTab === 'profile' ? '#2563eb' : '#64748b'} />
                <span>Datos Generales (Perfil, dirección y GPS)</span>
              </button>

              <button
                type="button"
                className={`${styles.mobileMenuItem} ${activeTab === 'mercadopago' ? styles.mobileMenuItemActive : ''}`}
                onClick={() => { handleSelectTab('mercadopago'); setMobileMenuOpen(false); }}
              >
                <Icon name="check-circle" size={18} color={activeTab === 'mercadopago' ? '#009ee3' : '#64748b'} />
                <span style={{ flex: 1 }}>Mercado Pago (Cobros de señas online)</span>
                {profileData.mp_connected && <span className={styles.tabBadgeSuccess}>✓</span>}
              </button>

              <button
                type="button"
                className={`${styles.mobileMenuItem} ${activeTab === 'google' ? styles.mobileMenuItemActive : ''}`}
                onClick={() => { handleSelectTab('google'); setMobileMenuOpen(false); }}
              >
                <Icon name="calendar" size={18} color={activeTab === 'google' ? '#2563eb' : '#64748b'} />
                <span style={{ flex: 1 }}>Google Calendar (Sincronización)</span>
                {googleConnected && <span className={styles.tabBadgeSuccess}>✓</span>}
              </button>

              <button
                type="button"
                className={`${styles.mobileMenuItem} ${activeTab === 'push' ? styles.mobileMenuItemActive : ''}`}
                onClick={() => { handleSelectTab('push'); setMobileMenuOpen(false); }}
              >
                <Icon name="download" size={18} color={activeTab === 'push' ? '#10b981' : '#64748b'} />
                <span style={{ flex: 1 }}>Notificaciones Celular (Alertas PWA)</span>
                {pushSubscribed && <span className={styles.tabBadgeSuccess}>✓</span>}
              </button>

              <button
                type="button"
                className={`${styles.mobileMenuItem} ${activeTab === 'subscription' ? styles.mobileMenuItemActive : ''}`}
                onClick={() => { handleSelectTab('subscription'); setMobileMenuOpen(false); }}
              >
                <Icon name="wallet" size={18} color={activeTab === 'subscription' ? '#3b82f6' : '#64748b'} />
                <span>Plan y Suscripción (Facturación y planes)</span>
              </button>

              <button
                type="button"
                className={`${styles.mobileMenuItem} ${activeTab === 'security' ? styles.mobileMenuItemActive : ''}`}
                onClick={() => { handleSelectTab('security'); setMobileMenuOpen(false); }}
              >
                <Icon name="lock" size={18} color={activeTab === 'security' ? '#dc2626' : '#64748b'} />
                <span>Seguridad y Datos (Sesiones y privacidad)</span>
              </button>

              <button
                type="button"
                className={`${styles.mobileMenuItem} ${activeTab === 'onboarding' ? styles.mobileMenuItemActive : ''}`}
                onClick={() => { handleSelectTab('onboarding'); setMobileMenuOpen(false); }}
              >
                <Icon name="reports" size={18} color={activeTab === 'onboarding' ? '#f59e0b' : '#64748b'} />
                <span>Guía de Inicio (Checklist consultorio)</span>
              </button>

              <div className={styles.mobileMenuGroupTitle} style={{ marginTop: '0.75rem' }}>CONFIGURACIONES DE ATENCIÓN</div>
              <a href="/working-hours" className={styles.mobileMenuItem}>
                <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#0284c7' }}>schedule</span>
                <span>Horarios de Atención</span>
                <span className="material-symbols-outlined" style={{ marginLeft: 'auto', fontSize: '14px', color: '#94a3b8' }}>open_in_new</span>
              </a>
              <a href="/services" className={styles.mobileMenuItem}>
                <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#16a34a' }}>medical_services</span>
                <span>Servicios y Precios</span>
                <span className="material-symbols-outlined" style={{ marginLeft: 'auto', fontSize: '14px', color: '#94a3b8' }}>open_in_new</span>
              </a>
              <a href="/insurance" className={styles.mobileMenuItem}>
                <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#8b5cf6' }}>health_and_safety</span>
                <span>Obras Sociales y Convenios</span>
                <span className="material-symbols-outlined" style={{ marginLeft: 'auto', fontSize: '14px', color: '#94a3b8' }}>open_in_new</span>
              </a>
            </div>
          )}
        </div>

        {/* Layout en 2 Columnas: Sidebar Menú + Contenido Activo */}
        <div className={styles.settingsLayout}>
          {/* Menú Lateral de Categorías de Configuración (Solo visible en escritorio >900px) */}
          <aside className={styles.settingsSidebar}>
            <div className={styles.sidebarGroup}>
              <span className={styles.sidebarGroupTitle}>Configuración de Cuenta</span>
              <nav className={styles.sidebarNav}>
                <button
                  type="button"
                  className={`${styles.navItem} ${activeTab === 'profile' ? styles.navItemActive : ''}`}
                  onClick={() => handleSelectTab('profile')}
                >
                  <Icon name="users" size={20} color={activeTab === 'profile' ? '#2563eb' : '#64748b'} />
                  <div className={styles.navItemText}>
                    <span className={styles.navItemTitle}>Datos Generales</span>
                    <span className={styles.navItemSub}>Perfil, dirección y GPS</span>
                  </div>
                </button>

                <button
                  type="button"
                  className={`${styles.navItem} ${activeTab === 'mercadopago' ? styles.navItemActive : ''}`}
                  onClick={() => handleSelectTab('mercadopago')}
                >
                  <Icon name="check-circle" size={20} color={activeTab === 'mercadopago' ? '#009ee3' : '#64748b'} />
                  <div className={styles.navItemText}>
                    <span className={styles.navItemTitle}>Mercado Pago</span>
                    <span className={styles.navItemSub}>Cobros de señas online</span>
                  </div>
                  {profileData.mp_connected && <span className={styles.tabBadgeSuccess}>✓</span>}
                </button>

                <button
                  type="button"
                  className={`${styles.navItem} ${activeTab === 'google' ? styles.navItemActive : ''}`}
                  onClick={() => handleSelectTab('google')}
                >
                  <Icon name="calendar" size={20} color={activeTab === 'google' ? '#2563eb' : '#64748b'} />
                  <div className={styles.navItemText}>
                    <span className={styles.navItemTitle}>Google Calendar</span>
                    <span className={styles.navItemSub}>Sincronización de agenda</span>
                  </div>
                  {googleConnected && <span className={styles.tabBadgeSuccess}>✓</span>}
                </button>

                <button
                  type="button"
                  className={`${styles.navItem} ${activeTab === 'push' ? styles.navItemActive : ''}`}
                  onClick={() => handleSelectTab('push')}
                >
                  <Icon name="download" size={20} color={activeTab === 'push' ? '#10b981' : '#64748b'} />
                  <div className={styles.navItemText}>
                    <span className={styles.navItemTitle}>Notificaciones Celular</span>
                    <span className={styles.navItemSub}>Alertas PWA Push</span>
                  </div>
                  {pushSubscribed && <span className={styles.tabBadgeSuccess}>✓</span>}
                </button>

                <button
                  type="button"
                  className={`${styles.navItem} ${activeTab === 'subscription' ? styles.navItemActive : ''}`}
                  onClick={() => handleSelectTab('subscription')}
                >
                  <Icon name="wallet" size={20} color={activeTab === 'subscription' ? '#3b82f6' : '#64748b'} />
                  <div className={styles.navItemText}>
                    <span className={styles.navItemTitle}>Plan y Suscripción</span>
                    <span className={styles.navItemSub}>Planes y facturación</span>
                  </div>
                </button>

                <button
                  type="button"
                  className={`${styles.navItem} ${activeTab === 'security' ? styles.navItemActive : ''}`}
                  onClick={() => handleSelectTab('security')}
                >
                  <Icon name="lock" size={20} color={activeTab === 'security' ? '#dc2626' : '#64748b'} />
                  <div className={styles.navItemText}>
                    <span className={styles.navItemTitle}>Seguridad y Datos</span>
                    <span className={styles.navItemSub}>Sesiones y privacidad</span>
                  </div>
                </button>

                <button
                  type="button"
                  className={`${styles.navItem} ${activeTab === 'onboarding' ? styles.navItemActive : ''}`}
                  onClick={() => handleSelectTab('onboarding')}
                >
                  <Icon name="reports" size={20} color={activeTab === 'onboarding' ? '#f59e0b' : '#64748b'} />
                  <div className={styles.navItemText}>
                    <span className={styles.navItemTitle}>Guía de Inicio</span>
                    <span className={styles.navItemSub}>Checklist inicial</span>
                  </div>
                </button>
              </nav>
            </div>

            <div className={styles.sidebarGroup} style={{ marginTop: '1.5rem' }}>
              <span className={styles.sidebarGroupTitle}>Configuraciones de Atención</span>
              <nav className={styles.sidebarNav}>
                <a href="/working-hours" className={styles.navItemLink}>
                  <span className="material-symbols-outlined" style={{ fontSize: '20px', color: '#0284c7' }}>schedule</span>
                  <span>Horarios de Atención</span>
                  <span className="material-symbols-outlined" style={{ marginLeft: 'auto', fontSize: '16px', color: '#94a3b8' }}>open_in_new</span>
                </a>
                <a href="/services" className={styles.navItemLink}>
                  <span className="material-symbols-outlined" style={{ fontSize: '20px', color: '#16a34a' }}>medical_services</span>
                  <span>Servicios y Precios</span>
                  <span className="material-symbols-outlined" style={{ marginLeft: 'auto', fontSize: '16px', color: '#94a3b8' }}>open_in_new</span>
                </a>
                <a href="/insurance" className={styles.navItemLink}>
                  <span className="material-symbols-outlined" style={{ fontSize: '20px', color: '#8b5cf6' }}>health_and_safety</span>
                  <span>Obras Sociales y Convenios</span>
                  <span className="material-symbols-outlined" style={{ marginLeft: 'auto', fontSize: '16px', color: '#94a3b8' }}>open_in_new</span>
                </a>
              </nav>
            </div>
          </aside>

          {/* Panel Principal del Tab Seleccionado */}
          <main className={styles.settingsContent}>
            {/* TAB: DATOS GENERALES Y PERFIL */}
            {activeTab === 'profile' && (
              <div className={styles.tabPanel}>
                <div className={styles.sectionHeader}>
                  <div className={styles.sectionTitle}>
                    <Icon name="users" size={24} color="#2563eb" />
                    Datos Profesionales
                  </div>
                  <p className={styles.sectionDescription}>
                    Actualiza tu información profesional, rubro, especialidad y ubicación en el mapa para tus pacientes.
                  </p>
                </div>

                <div className={styles.card}>
                  <form onSubmit={handleSaveProfile} className={styles.form}>
                    <div className={styles.formRow}>
                      <div className={styles.formGroup}>
                        <label htmlFor="rubro">Rubro (Categoría Principal) *</label>
                        <select
                          id="rubro"
                          name="rubro"
                          value={profileData.rubro}
                          onChange={handleRubroChange}
                          disabled={savingProfile}
                          required
                          style={{ width: '100%', padding: '0.85rem 1rem', background: '#f8fafc', border: '2px solid #e2e8f0', borderRadius: '8px', fontSize: '1rem', color: '#1e293b' }}
                        >
                          <option value="">Selecciona un rubro...</option>
                          {Object.keys(RUBROS_ESPECIALIDADES).map(rub => (
                            <option key={rub} value={rub}>{rub}</option>
                          ))}
                        </select>
                      </div>
                      <div className={styles.formGroup}>
                        <label htmlFor="specialization">Especialidad *</label>
                        <select
                          id="specialization"
                          name="specialization"
                          value={profileData.specialization}
                          onChange={handleSpecializationChange}
                          disabled={savingProfile || !profileData.rubro}
                          required
                          style={{ width: '100%', padding: '0.85rem 1rem', background: '#f8fafc', border: '2px solid #e2e8f0', borderRadius: '8px', fontSize: '1rem', color: '#1e293b' }}
                        >
                          <option value="">Selecciona una especialidad...</option>
                          {profileData.rubro && RUBROS_ESPECIALIDADES[profileData.rubro]?.map(spec => (
                            <option key={spec} value={spec}>{spec}</option>
                          ))}
                          {profileData.rubro && (
                            <option value="__custom__">+ Otra / Agregar nueva especialidad...</option>
                          )}
                        </select>
                      </div>
                    </div>

                    {isCustomSpecialty && (
                      <div className={styles.formGroup} style={{ marginBottom: '1.5rem' }}>
                        <label htmlFor="customSpecialty">Escribe tu Especialidad Personalizada *</label>
                        <input
                          type="text"
                          id="customSpecialty"
                          value={customSpecialty}
                          onChange={(e) => setCustomSpecialty(e.target.value)}
                          placeholder="Ej: Neuropediatría, Microblading Avanzado, etc."
                          disabled={savingProfile}
                          required
                        />
                      </div>
                    )}

                    <div className={styles.formRow}>
                      <div className={styles.formGroup}>
                        <label htmlFor="license_number">Número de Matrícula</label>
                        <input
                          type="text"
                          id="license_number"
                          name="license_number"
                          value={profileData.license_number}
                          onChange={handleProfileChange}
                          placeholder="Ej: MED-123456"
                          disabled={savingProfile}
                        />
                      </div>
                      <div className={styles.formGroup}>
                        <label htmlFor="date_of_birth">🎂 Fecha de Nacimiento (Cumpleaños)</label>
                        <input
                          type="date"
                          id="date_of_birth"
                          name="date_of_birth"
                          value={profileData.date_of_birth || ''}
                          onChange={handleProfileChange}
                          disabled={savingProfile}
                        />
                        <span style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px' }}>
                          Te enviaremos un saludo por correo y un mensaje especial en tu panel en tu día.
                        </span>
                      </div>
                    </div>

                    <div className={styles.formRow}>
                      <div className={styles.formGroup}>
                        <label htmlFor="clinic_name">Nombre de la Clínica / Consultorio</label>
                        <input
                          type="text"
                          id="clinic_name"
                          name="clinic_name"
                          value={profileData.clinic_name}
                          onChange={handleProfileChange}
                          placeholder="Ej: Clínica Central"
                          disabled={savingProfile}
                        />
                      </div>

                      <div className={styles.formGroup}>
                        <label htmlFor="phone">Teléfono / WhatsApp de Contacto</label>
                        <input
                          type="tel"
                          id="phone"
                          name="phone"
                          value={profileData.phone}
                          onChange={handleProfileChange}
                          placeholder="Ej: +54 9 11 1234-5678"
                          disabled={savingProfile}
                        />
                        <small style={{ color: '#64748b', marginTop: '4px', display: 'block' }}>Tu WhatsApp de contacto directo para soporte y notificaciones.</small>
                      </div>
                    </div>

                    <div className={styles.formGroup}>
                      <label htmlFor="address">Dirección del Establecimiento *</label>
                      <div className={styles.addressInputGroup}>
                        <input
                          type="text"
                          id="address"
                          name="address"
                          value={profileData.address}
                          onChange={handleProfileChange}
                          placeholder="Ej: Calle Principal 123, Ciudad"
                          className={styles.addressInput}
                          disabled={savingProfile}
                          required
                        />
                        <div className={styles.addressActionButtons}>
                          <button 
                            type="button" 
                            onClick={handleVerifyAddress}
                            className={styles.verifyBtn}
                          >
                            Ubicar en Mapa 🗺️
                          </button>
                          <button 
                            type="button" 
                            onClick={handleGetLocation}
                            className={styles.gpsBtn}
                            title="Usar mi ubicación actual por GPS"
                          >
                            📍 Usar GPS
                          </button>
                        </div>
                      </div>
                      <small>Escribe tu dirección y presiona "Ubicar" para verla en el mapa, o usa tu ubicación actual por GPS.</small>
                    </div>

                    <div className={styles.mapPreviewContainer}>
                      <p className={styles.mapLabel}>Confirma tu ubicación exacta (puedes arrastrar el pin):</p>
                      <div className={styles.mapWrapper}>
                        <MapContainer center={mapCenter} zoom={15} scrollWheelZoom={false} style={{ height: '300px', width: '100%', borderRadius: '12px' }}>
                          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                          <LocationMarker />
                          <RecenterMap position={mapCenter} />
                        </MapContainer>
                      </div>
                    </div>

                    <button
                      type="submit"
                      className={styles.submitBtn}
                      disabled={savingProfile}
                    >
                      {savingProfile ? 'Guardando...' : 'Guardar Cambios'}
                    </button>
                  </form>
                </div>
              </div>
            )}

            {/* TAB: MERCADO PAGO */}
            {activeTab === 'mercadopago' && (
              <div className={styles.tabPanel}>
                <div className={styles.sectionHeader}>
                  <div className={styles.sectionTitle}>
                    <Icon name="check-circle" size={24} color="#009ee3" />
                    Mercado Pago
                  </div>
                  <p className={styles.sectionDescription}>
                    Conecta tu cuenta de Mercado Pago para recibir el pago de las señas de tus pacientes automáticamente en tu cuenta.
                  </p>
                </div>

                <div className={styles.card}>
                  <div className={styles.statusSection}>
                    <div className={styles.statusIndicator}>
                      <div className={`${styles.statusDot} ${profileData.mp_connected ? styles.connected : styles.disconnected}`}></div>
                      <div>
                        <h3 className={styles.statusLabel}>
                          {profileData.mp_connected ? 'Conectado' : 'No vinculado'}
                        </h3>
                        <p className={styles.statusDescription}>
                          {profileData.mp_connected
                            ? 'Tu cuenta de Mercado Pago está lista para recibir cobros'
                            : 'Vincula tu cuenta para que los pacientes puedan pagar la reserva online'}
                        </p>
                        {profileData.mp_connected && loadingMp && (
                          <p className={styles.mpAccountInfo}>Cargando datos de la cuenta...</p>
                        )}
                        {profileData.mp_connected && mpAccount && (
                          <p className={styles.mpAccountInfo}>
                            Cuenta vinculada: <strong>{mpAccount.email || mpAccount.nickname}</strong> {mpAccount.name && `(${mpAccount.name})`}
                          </p>
                        )}
                      </div>
                    </div>

                    {profileData.mp_connected ? (
                      <button
                        className={styles.disconnectBtn}
                        onClick={async () => {
                          if (window.confirm('¿Desvincular tu cuenta de Mercado Pago? No podrás recibir cobros de reservas.')) {
                            try {
                              const res = await apiClient.put('/api/auth/profile', { mp_connected: false, mp_access_token: null });
                              if (res.data.success) {
                                setSuccessMessage('✓ Mercado Pago desvinculado');
                                refreshUser();
                              }
                            } catch (err) {
                              alert('Error al desvincular');
                            }
                          }
                        }}
                      >
                        Desvincular Cuenta
                      </button>
                    ) : user?.plan?.allow_mercadopago === false ? (
                      <div className={styles.planRestricted}>
                        <button
                          className={styles.disabledBtn}
                          disabled
                        >
                          <Icon name="lock" size={18} color="currentColor" />
                          Mercado Pago Bloqueado
                        </button>
                        <p className={styles.upgradeNotice}>
                          Tu plan actual (<strong>{user.plan.name}</strong>) no incluye integración con Mercado Pago. Contacta al administrador para solicitar esta funcionalidad.
                        </p>
                      </div>
                    ) : (
                      <button
                        className={styles.connectBtn}
                        style={{ backgroundColor: '#009ee3', borderColor: '#009ee3', color: 'white', display: 'flex', alignItems: 'center', gap: '8px' }}
                        onClick={() => {
                          const token = localStorage.getItem('token');
                          if (!token) {
                            setSuccessMessage('✗ No hay sesión activa');
                            return;
                          }
                          window.location.href = `${process.env.REACT_APP_API_BASE_URL || ''}/api/mercadopago/oauth/auth?token=${token}`;
                        }}
                      >
                         <Icon name="check-circle" size={18} color="white" />
                         Vincular con Mercado Pago
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* TAB: GOOGLE CALENDAR */}
            {activeTab === 'google' && (
              <div className={styles.tabPanel}>
                <div className={styles.sectionHeader}>
                  <div className={styles.sectionTitle}>
                    <Icon name="calendar" size={24} color="#2563eb" />
                    Google Calendar
                  </div>
                  <p className={styles.sectionDescription}>
                    Sincroniza automáticamente tus citas con Google Calendar en tiempo real.
                  </p>
                </div>

                <div className={styles.card}>
                  {loading ? (
                    <div className={styles.loading}>
                      <div className={styles.spinner}></div>
                      <p>Cargando estado...</p>
                    </div>
                  ) : (
                    <div className={styles.statusSection}>
                      <div className={styles.statusIndicator}>
                        <div className={`${styles.statusDot} ${googleConnected ? styles.connected : styles.disconnected}`}></div>
                        <div>
                          <h3 className={styles.statusLabel}>
                            {googleConnected ? 'Conectado' : 'Desconectado'}
                          </h3>
                          <p className={styles.statusDescription}>
                            {googleConnected
                              ? 'Tu Google Calendar está sincronizado con TurnoHub'
                              : 'Conecta tu Google Calendar para sincronizar automáticamente tus citas'}
                          </p>
                        </div>
                      </div>

                      {googleConnected ? (
                        <button
                          className={styles.disconnectBtn}
                          onClick={handleDisconnect}
                          disabled={disconnecting}
                        >
                          {disconnecting ? 'Desconectando...' : 'Desconectar'}
                        </button>
                      ) : user?.plan?.allow_google_calendar === false ? (
                        <div className={styles.planRestricted}>
                          <button className={styles.disabledBtn} disabled>
                            <Icon name="lock" size={18} color="currentColor" />
                            Google Calendar Bloqueado
                          </button>
                          <p className={styles.upgradeNotice}>
                            Tu plan actual (<strong>{user.plan.name}</strong>) no incluye sincronización con Google Calendar. Contacta al administrador para solicitar esta funcionalidad.
                          </p>
                        </div>
                      ) : (
                        <button
                          className={styles.connectBtn}
                          onClick={handleConnect}
                        >
                          <Icon name="check" size={18} color="currentColor" />
                          Conectar Google Calendar
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB: NOTIFICACIONES PUSH */}
            {activeTab === 'push' && (
              <div className={styles.tabPanel}>
                <div className={styles.sectionHeader}>
                  <div className={styles.sectionTitle}>
                    <Icon name="download" size={24} color="#10b981" />
                    Notificaciones en el Celular
                  </div>
                  <p className={styles.sectionDescription}>
                    Recibe avisos push nativos 15 minutos antes de cada turno y resúmenes diarios de tu agenda.
                  </p>
                </div>

                <div className={styles.card}>
                  <div className={styles.statusSection}>
                    <div className={styles.statusIndicator}>
                      <div className={`${styles.statusDot} ${pushSubscribed ? styles.connected : styles.disconnected}`}></div>
                      <div>
                        <h3 className={styles.statusLabel}>
                          {pushSubscribed ? 'Notificaciones Activas' : 'Notificaciones Desactivadas'}
                        </h3>
                        <p className={styles.statusDescription}>
                          {pushSubscribed
                            ? 'Este dispositivo recibirá alertas automáticas sobre tus turnos'
                            : 'Activa las notificaciones en este navegador/celular para no perderte ningún turno'}
                        </p>
                      </div>
                    </div>

                    {pushSubscribed ? (
                      <div className={styles.buttonGroup}>
                        <button
                          className={styles.testBtn}
                          onClick={handleSendTestPush}
                          disabled={loadingTestPush}
                        >
                          <Icon name="refresh" size={18} color="currentColor" />
                          {loadingTestPush ? 'Enviando...' : 'Probar Notificación'}
                        </button>
                        <button
                          className={styles.disconnectBtn}
                          onClick={handleUnsubscribePush}
                          disabled={loadingPush}
                        >
                          {loadingPush ? 'Desactivando...' : 'Desactivar Notificaciones'}
                        </button>
                      </div>
                    ) : (
                      <button
                        className={styles.connectBtn}
                        onClick={handleSubscribePush}
                        disabled={loadingPush}
                        style={{ background: '#10b981' }}
                      >
                        <Icon name="check" size={18} color="currentColor" />
                        {loadingPush ? 'Activando...' : 'Activar Notificaciones'}
                      </button>
                    )}
                  </div>

                  {pushSubscribed && (
                    <div style={{ marginTop: '1.5rem', borderTop: '1px solid #e2e8f0', paddingTop: '1.5rem' }}>
                      <button
                        onClick={handleFetchPushLogs}
                        className={styles.connectBtn}
                        style={{ fontSize: '0.875rem', padding: '0.5rem 1rem', background: '#f1f5f9', borderColor: '#cbd5e1' }}
                      >
                        <Icon name="search" size={16} color="currentColor" />
                        {showLogs ? 'Ocultar Logs de Notificaciones' : 'Ver Logs de Notificaciones'}
                      </button>
                      {showLogs && (
                        <pre style={{
                          marginTop: '1rem',
                          padding: '1rem',
                          background: '#0f172a',
                          color: '#e2e8f0',
                          borderRadius: '8px',
                          fontSize: '0.75rem',
                          maxHeight: '250px',
                          overflowY: 'auto',
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-all',
                          textAlign: 'left',
                          fontFamily: 'monospace'
                        }}>
                          {pushLogs}
                        </pre>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB: PLAN Y SUSCRIPCIÓN */}
            {activeTab === 'subscription' && (
              <div className={styles.tabPanel}>
                <div className={styles.sectionHeader}>
                  <div className={styles.sectionTitle}>
                    <Icon name="wallet" size={24} color="#3b82f6" />
                    Plan y Suscripción
                  </div>
                  <p className={styles.sectionDescription}>
                    Gestiona tu plan comercial, ve el estado de tu cuenta o realiza la renovación de tu suscripción.
                  </p>
                </div>

                <div className={styles.card}>
                  <div className={styles.planOverview}>
                    <div className={styles.planOverviewInfo}>
                      <h3>Tu Estado Actual</h3>
                      <div className={styles.planInfoGrid}>
                        <div className={styles.planInfoItem}>
                          <span className={styles.planInfoLabel}>Plan comercial:</span>
                          <span className={styles.planInfoValue}>
                            {user?.plan?.name || (user?.plan_type === 'commission' ? 'Comisión' : 'Mensualidad')}
                          </span>
                        </div>
                        <div className={styles.planInfoItem}>
                          <span className={styles.planInfoLabel}>Estado de suscripción:</span>
                          <span className={`${styles.planStatusBadge} ${styles[user?.subscription_status]}`}>
                            {user?.subscription_status === 'trial' ? 'Prueba Gratis' : 
                             user?.subscription_status === 'active' ? 'Activo' : 
                             user?.subscription_status === 'expired' ? 'Expirado' : user?.subscription_status}
                          </span>
                        </div>
                        {(user?.subscription_status === 'active' || user?.subscription_status === 'trial') && (
                          <div className={styles.planInfoItem}>
                            <span className={styles.planInfoLabel}>Vence el:</span>
                            <span className={styles.planInfoValue}>
                              {user?.subscription_expires_at || user?.trial_ends_at ? new Date(user?.subscription_expires_at || user?.trial_ends_at).toLocaleDateString('es-ES') : '-'}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <hr className={styles.sectionDivider} />

                  <div className={styles.plansSelection}>
                    <h3>Planes Comerciales Disponibles</h3>
                    <p className={styles.subtitle}>Elige el plan que mejor se adapte a tus necesidades. Puedes solicitar la activación al administrador o pagar en línea con Mercado Pago.</p>
                    
                    {loadingSub ? (
                      <div style={{ textAlign: 'center', padding: '2rem' }}>Cargando planes comerciales...</div>
                    ) : (
                      <div className={styles.plansGrid}>
                        {plans.map(p => (
                          <div key={p.id} className={`${styles.pricingCard} ${p.is_popular ? styles.pricingCardPopular : ''}`}>
                            {p.is_popular && <span className={styles.popularLabel}>Recomendado</span>}
                            <h4>{p.name}</h4>
                            <p className={styles.planDesc}>{p.description}</p>
                            <div className={styles.priceContainer}>
                              <span className={styles.priceNum}>
                                {(() => {
                                  if (p.price === null || p.price === undefined || p.price === '') return 'Consultar';
                                  const str = String(p.price).trim();
                                  if (str.includes('%')) return str;
                                  const num = parseFloat(str);
                                  if (!isNaN(num)) return `$${num.toLocaleString('es-AR')}`;
                                  return str.startsWith('$') ? str : `$${str}`;
                                })()}
                              </span>
                              <span className={styles.period}>/ {p.price_period === 'monthly' ? 'mes' : p.price_period}</span>
                            </div>

                            {p.features && p.features.length > 0 && (
                              <ul className={styles.featuresList}>
                                {p.features.map((f, i) => <li key={i}>✓ {f}</li>)}
                              </ul>
                            )}

                            <div className={styles.planActions}>
                              <button 
                                onClick={() => handlePayPlan(p.id)} 
                                className={styles.payOnlineBtn}
                                disabled={submittingSub}
                              >
                                Pagar Online
                              </button>
                              <button 
                                onClick={() => handleRequestPlan(p.id)} 
                                className={styles.requestManualBtn}
                                disabled={submittingSub}
                              >
                                Solicitar Activación
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <hr className={styles.sectionDivider} />

                  <div className={styles.historySection}>
                    <h3>Historial de Solicitudes y Pagos</h3>
                    {subscriptions.length === 0 ? (
                      <p className={styles.emptyHistory}>No tienes solicitudes o pagos registrados aún.</p>
                    ) : (
                      <div className={styles.tableWrapper}>
                        <table className={styles.subTable}>
                          <thead>
                            <tr>
                              <th>Plan</th>
                              <th>Monto</th>
                              <th>Estado</th>
                              <th>Período</th>
                              <th>Fecha Solicitud</th>
                            </tr>
                          </thead>
                          <tbody>
                            {subscriptions.map(sub => (
                              <tr key={sub.id}>
                                <td>{sub.plan_name || 'Plan Comercial'}</td>
                                <td>${parseFloat(sub.amount).toFixed(2)}</td>
                                <td>
                                  <span className={`${styles.statusBadge} ${styles[sub.status]}`}>
                                    {sub.status === 'pending' ? 'Pendiente' : 
                                     sub.status === 'approved' ? 'Aprobado' : 
                                     sub.status === 'rejected' ? 'Rechazado' : sub.status}
                                  </span>
                                </td>
                                <td>
                                  {sub.period_start ? `${new Date(sub.period_start).toLocaleDateString('es-ES')} al ${new Date(sub.period_end).toLocaleDateString('es-ES')}` : '-'}
                                </td>
                                <td>{new Date(sub.created_at).toLocaleDateString('es-ES')}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* TAB: SEGURIDAD Y DATOS */}
            {activeTab === 'security' && (
              <div className={styles.tabPanel}>
                <div className={styles.sectionHeader}>
                  <div className={styles.sectionTitle}>
                    <Icon name="lock" size={24} color="#dc2626" />
                    Seguridad y Datos
                  </div>
                  <p className={styles.sectionDescription}>
                    Administra la seguridad de tu cuenta y la privacidad de tus datos.
                  </p>
                </div>

                <div className={styles.card}>
                  <div className={styles.securityContainer}>
                    {securitySuccess && <div className={styles.successMessage} style={{ marginBottom: '1rem' }}>{securitySuccess}</div>}
                    {securityError && <div className={styles.errorMessage} style={{ color: '#dc2626', background: '#fef2f2', padding: '0.75rem', borderRadius: '8px', border: '1px solid #fca5a5', marginBottom: '1rem', fontSize: '0.875rem' }}>{securityError}</div>}

                    <div className={styles.securityItem}>
                      <div className={styles.securityInfo}>
                        <h4>Cerrar Sesión en Todos los Dispositivos</h4>
                        <p>Invalida todas las sesiones activas actuales en celulares, tablets o navegadores. Deberás iniciar sesión nuevamente.</p>
                      </div>
                      <div className={styles.securityActions}>
                        <button onClick={handleLogoutAll} className={styles.logoutAllBtn} disabled={loadingSecurity}>
                          Cerrar Sesiones Globales
                        </button>
                      </div>
                    </div>

                    <hr className={styles.securityDivider} />

                    <div className={styles.securityItem}>
                      <div className={styles.securityInfo}>
                        <h4>Descargar mis Datos</h4>
                        <p>Obtén una copia completa en formato JSON de tu perfil, historial de turnos, convenios y caja.</p>
                      </div>
                      <div className={styles.securityActions}>
                        <button onClick={handleExportData} className={styles.exportBtn}>
                          <Icon name="download" size={16} /> Exportar JSON
                        </button>
                      </div>
                    </div>

                    <hr className={styles.securityDivider} />

                    <div className={styles.securityItem} style={{ background: '#fef2f2', padding: '1rem', borderRadius: '8px', border: '1px solid #fca5a5' }}>
                      <div className={styles.securityInfo}>
                        <h4 style={{ color: '#b91c1c' }}>Eliminar Cuenta Permanentemente</h4>
                        <p style={{ color: '#7f1d1d' }}>Esta acción es irreversible y eliminará de inmediato toda tu agenda, deudas, servicios y datos de pacientes.</p>
                      </div>
                      <div className={styles.securityActions}>
                        <button onClick={handleDeleteAccount} className={styles.deleteAccBtn}>
                          Eliminar Cuenta
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB: GUÍA DE INICIO */}
            {activeTab === 'onboarding' && (
              <div className={styles.tabPanel}>
                <div className={styles.sectionHeader}>
                  <div className={styles.sectionTitle}>
                    <Icon name="reports" size={24} color="#f59e0b" />
                    Guía de Inicio / Estado del Establecimiento
                  </div>
                  <p className={styles.sectionDescription}>
                    Completa los pasos obligatorios para habilitar el portal de reservas online de tus pacientes.
                  </p>
                </div>

                <div className={styles.card}>
                  <OnboardingChecklist alwaysShow={true} />
                </div>
              </div>
            )}
          </main>
        </div>

        {/* Link Personalizado de Reservas (Ubicado al final de las configuraciones) */}
        <div className={styles.section} style={{ marginTop: '2rem', marginBottom: '1rem' }}>
          <div className={styles.card} style={{ background: 'linear-gradient(135deg, #eff6ff, #f8fafc)', border: '2px solid #bfdbfe' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1rem' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#2563eb', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span className="material-symbols-outlined">link</span>
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#1e3a8a' }}>Tu Link Directo de Reservas</h3>
                <p style={{ margin: 0, fontSize: '0.875rem', color: '#3b82f6' }}>Comparte este enlace directo para que los pacientes reserven directamente contigo.</p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
              <input
                type="text"
                readOnly
                value={`${window.location.origin}/patient?doctor=${user?.id}`}
                onClick={(e) => e.target.select()}
                style={{ flex: 1, minWidth: '240px', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid #93c5fd', background: 'white', fontWeight: 600, color: '#1e293b' }}
              />
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}/patient?doctor=${user?.id}`);
                  setCopiedLink(true);
                  setTimeout(() => setCopiedLink(false), 3000);
                }}
                style={{ padding: '0.75rem 1.25rem', background: '#2563eb', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Icon name={copiedLink ? 'check' : 'copy'} size={16} color="white" />
                {copiedLink ? '¡Copiado!' : 'Copiar Link'}
              </button>
              <a
                href={`${window.location.origin}/patient?doctor=${user?.id}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ padding: '0.75rem 1.25rem', background: 'white', color: '#2563eb', border: '1px solid #2563eb', borderRadius: '8px', fontWeight: 700, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Icon name="eye" size={16} /> Ver Portal
              </a>
              <a
                href={`https://wa.me/?text=${encodeURIComponent(`¡Hola! Podés reservar tu turno directamente conmigo ingresando al siguiente enlace: ${window.location.origin}/patient?doctor=${user?.id}`)}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ padding: '0.75rem 1.25rem', background: '#25D366', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 700, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>chat</span> WhatsApp
              </a>
            </div>
          </div>
        </div>
      </div>
    </DoctorLayout>
  );
}
