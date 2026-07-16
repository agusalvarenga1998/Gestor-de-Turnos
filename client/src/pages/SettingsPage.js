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

const doctorIcon = new L.Icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/387/387561.png',
  iconSize: [40, 40],
  iconAnchor: [20, 40],
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
    mp_connected: false
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
    security: false
  });

  // Estados de Seguridad
  const [securityData, setSecurityData] = useState({
    twoFactorEnabled: false,
    emailVerified: false
  });
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [twoFactorSecret, setTwoFactorSecret] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [show2FAForm, setShow2FAForm] = useState(false);
  const [loadingSecurity, setLoadingSecurity] = useState(false);
  const [securityError, setSecurityError] = useState('');
  const [securitySuccess, setSecuritySuccess] = useState('');

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

  const handleSetup2FA = async () => {
    setLoadingSecurity(true);
    setSecurityError('');
    setSecuritySuccess('');
    try {
      const response = await apiClient.post('/api/auth/profile/2fa/setup');
      if (response.data.success) {
        setQrCodeUrl(response.data.qrCodeUrl);
        setTwoFactorSecret(response.data.secret);
        setShow2FAForm(true);
      }
    } catch (err) {
      setSecurityError('Error al iniciar configuración de 2FA.');
    } finally {
      setLoadingSecurity(false);
    }
  };

  const handleVerify2FA = async (enable) => {
    setLoadingSecurity(true);
    setSecurityError('');
    setSecuritySuccess('');
    try {
      const response = await apiClient.post('/api/auth/profile/2fa/verify', {
        code: twoFactorCode,
        enable
      });
      if (response.data.success) {
        setSecuritySuccess(response.data.message);
        setSecurityData(prev => ({ ...prev, twoFactorEnabled: enable }));
        setShow2FAForm(false);
        setTwoFactorCode('');
        await refreshUser();
      }
    } catch (err) {
      setSecurityError(err.response?.data?.message || 'Código incorrecto. Verifica el autenticador.');
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
        mp_connected: user.mp_connected || false
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
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('connected');
      setSearchParams(newParams, { replace: true });
      setTimeout(() => setSuccessMessage(''), 5000);
    }

    if (searchParams.get('error') === 'true') {
      setSuccessMessage('✗ Error al conectar Google Calendar');
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('error');
      setSearchParams(newParams, { replace: true });
      setTimeout(() => setSuccessMessage(''), 5000);
    }

    // Detectar si viene del callback de Mercado Pago
    if (searchParams.get('mp_connected') === 'true') {
      setSuccessMessage('✓ Mercado Pago conectado exitosamente');
      refreshUser();
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('mp_connected');
      setSearchParams(newParams, { replace: true });
      setTimeout(() => setSuccessMessage(''), 5000);
    }

    if (searchParams.get('mp_connected') === 'error') {
      setSuccessMessage('✗ Error al conectar Mercado Pago');
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
          <h1 className={styles.title}>Configuración</h1>
          <p className={styles.subtitle}>Gestiona tu cuenta y preferencias</p>
        </div>

        {successMessage && (
          <div className={styles.successMessage}>
            {successMessage}
          </div>
        )}

        {(!user?.rubro || !user?.specialization || !user?.address) && (
          <div className={styles.warningMessage}>
            <Icon name="warning" size={24} color="#b45309" />
            <span>Por favor, completa tu rubro, especialidad y dirección de consultorio (ubicándola en el mapa) para activar tu perfil y comenzar a recibir turnos.</span>
          </div>
        )}

        {/* Google Calendar Section */}
        <div className={`${styles.section} ${openSections.google ? styles.sectionOpen : ''}`}>
          <div className={styles.sectionHeader} onClick={() => toggleSection('google')} style={{ cursor: 'pointer' }}>
            <div className={styles.sectionTitleGroup}>
              <div className={styles.sectionTitle}>
                <Icon name="calendar" size={24} color="#2563eb" />
                Google Calendar
              </div>
              <span className={`material-symbols-outlined ${styles.accordionChevron}`}>
                {openSections.google ? 'expand_less' : 'expand_more'}
              </span>
            </div>
            <p className={styles.sectionDescription}>
              Sincroniza automáticamente tus citas con Google Calendar.
            </p>
          </div>

          {openSections.google && (
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
          )}
        </div>

        {/* PWA Push Notifications Section */}
        <div className={`${styles.section} ${openSections.push ? styles.sectionOpen : ''}`}>
          <div className={styles.sectionHeader} onClick={() => toggleSection('push')} style={{ cursor: 'pointer' }}>
            <div className={styles.sectionTitleGroup}>
              <div className={styles.sectionTitle}>
                <Icon name="download" size={24} color="#10b981" />
                Notificaciones en el Celular
              </div>
              <span className={`material-symbols-outlined ${styles.accordionChevron}`}>
                {openSections.push ? 'expand_less' : 'expand_more'}
              </span>
            </div>
            <p className={styles.sectionDescription}>
              Recibe avisos push nativos 15 minutos antes de cada turno y resúmenes diarios de tu agenda.
            </p>
          </div>

          {openSections.push && (
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
          )}
        </div>

        {/* Mercado Pago Section */}
        <div className={`${styles.section} ${openSections.mercadopago ? styles.sectionOpen : ''}`}>
          <div className={styles.sectionHeader} onClick={() => toggleSection('mercadopago')} style={{ cursor: 'pointer' }}>
            <div className={styles.sectionTitleGroup}>
              <div className={styles.sectionTitle}>
                <Icon name="check-circle" size={24} color="#009ee3" />
                Mercado Pago
              </div>
              <span className={`material-symbols-outlined ${styles.accordionChevron}`}>
                {openSections.mercadopago ? 'expand_less' : 'expand_more'}
              </span>
            </div>
            <p className={styles.sectionDescription}>
              Conecta tu cuenta de Mercado Pago para recibir el pago de las señas de tus pacientes automáticamente en tu cuenta.
            </p>
          </div>

          {openSections.mercadopago && (
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
          )}
        </div>

        {/* Profile Settings */}
        <div className={`${styles.section} ${openSections.profile ? styles.sectionOpen : ''}`}>
          <div className={styles.sectionHeader} onClick={() => toggleSection('profile')} style={{ cursor: 'pointer' }}>
            <div className={styles.sectionTitleGroup}>
              <div className={styles.sectionTitle}>
                <Icon name="users" size={24} color="#2563eb" />
                Datos Profesionales
              </div>
              <span className={`material-symbols-outlined ${styles.accordionChevron}`}>
                {openSections.profile ? 'expand_less' : 'expand_more'}
              </span>
            </div>
            <p className={styles.sectionDescription}>
              Actualiza tu información profesional y de contacto
            </p>
          </div>

          {openSections.profile && (
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
                  <div className={styles.formGroup}></div>
                </div>


                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label htmlFor="clinic_name">Nombre de la Clínica</label>
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
                    <label htmlFor="phone">Teléfono de Contacto</label>
                    <input
                      type="tel"
                      id="phone"
                      name="phone"
                      value={profileData.phone}
                      onChange={handleProfileChange}
                      placeholder="Ej: +54 9 11 1234-5678"
                      disabled={savingProfile}
                    />
                  </div>
                </div>

                 <div className={styles.formGroup}>
                  <label htmlFor="address">Dirección del Consultorio *</label>
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
          )}
        </div>

        {/* Onboarding Checklist Section */}
        <div className={`${styles.section} ${openSections.onboarding ? styles.sectionOpen : ''}`}>
          <div className={styles.sectionHeader} onClick={() => toggleSection('onboarding')} style={{ cursor: 'pointer' }}>
            <div className={styles.sectionTitleGroup}>
              <div className={styles.sectionTitle}>
                <Icon name="reports" size={24} color="#f59e0b" />
                Guía de Inicio / Estado del Consultorio
              </div>
              <span className={`material-symbols-outlined ${styles.accordionChevron}`}>
                {openSections.onboarding ? 'expand_less' : 'expand_more'}
              </span>
            </div>
            <p className={styles.sectionDescription}>
              Completa los pasos obligatorios para habilitar el portal de reservas online de tus pacientes.
            </p>
          </div>

          {openSections.onboarding && (
            <div className={styles.card}>
              <OnboardingChecklist alwaysShow={true} />
            </div>
          )}
        </div>

        {/* Seguridad Section */}
        <div className={`${styles.section} ${openSections.security ? styles.sectionOpen : ''}`}>
          <div className={styles.sectionHeader} onClick={() => toggleSection('security')} style={{ cursor: 'pointer' }}>
            <div className={styles.sectionTitleGroup}>
              <div className={styles.sectionTitle}>
                <Icon name="lock" size={24} color="#dc2626" />
                Seguridad y Datos
              </div>
              <span className={`material-symbols-outlined ${styles.accordionChevron}`}>
                {openSections.security ? 'expand_less' : 'expand_more'}
              </span>
            </div>
            <p className={styles.sectionDescription}>
              Protege tu consultorio con Autenticación de Dos Factores (2FA) y administra la privacidad de tus datos.
            </p>
          </div>

          {openSections.security && (
            <div className={styles.card}>
              <div className={styles.securityContainer}>
                {securitySuccess && <div className={styles.successMessage} style={{ marginBottom: '1rem' }}>{securitySuccess}</div>}
                {securityError && <div className={styles.errorMessage} style={{ color: '#dc2626', background: '#fef2f2', padding: '0.75rem', borderRadius: '8px', border: '1px solid #fca5a5', marginBottom: '1rem', fontSize: '0.875rem' }}>{securityError}</div>}

                {/* Doble Factor (2FA) */}
                <div className={styles.securityItem}>
                  <div className={styles.securityInfo}>
                    <h4>Autenticación de Dos Factores (2FA)</h4>
                    <p>Agrega un paso adicional al iniciar sesión ingresando un código temporal de tu celular (Google Authenticator, Authy, etc.).</p>
                  </div>
                  <div className={styles.securityActions}>
                    {securityData.twoFactorEnabled ? (
                      <div className={styles.enabledBadgeGroup}>
                        <span className={styles.enabledBadge}>✓ HABILITADO</span>
                        <button 
                          onClick={() => {
                            setTwoFactorCode('');
                            setShow2FAForm(true);
                          }} 
                          className={styles.disable2faBtn}
                          disabled={loadingSecurity}
                        >
                          Desactivar
                        </button>
                      </div>
                    ) : (
                      <button onClick={handleSetup2FA} className={styles.enable2faBtn} disabled={loadingSecurity}>
                        Activar 2FA
                      </button>
                    )}
                  </div>
                </div>

                {/* Formulario 2FA Setup/Desactivación */}
                {show2FAForm && (
                  <div className={styles.setup2faBox}>
                    {!securityData.twoFactorEnabled && qrCodeUrl && (
                      <div className={styles.qrSetup}>
                        <p>1. Escanea el código QR desde tu app autenticadora:</p>
                        <div style={{ textAlign: 'center', margin: '1rem 0' }}>
                          <img src={qrCodeUrl} alt="2FA QR Code" style={{ borderRadius: '8px', border: '1px solid #e2e8f0' }} />
                        </div>
                        <p>O introduce la clave manualmente: <code>{twoFactorSecret}</code></p>
                      </div>
                    )}
                    <p style={{ marginTop: '0.5rem' }}>
                      {securityData.twoFactorEnabled 
                        ? 'Ingresa el código temporal de 6 dígitos de tu celular para desactivar 2FA:' 
                        : '2. Ingresa el código temporal de 6 dígitos para validar la configuración:'}
                    </p>
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                      <input
                        type="text"
                        maxLength="6"
                        placeholder="Ej: 123456"
                        value={twoFactorCode}
                        onChange={(e) => setTwoFactorCode(e.target.value)}
                        style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', width: '120px', textAlign: 'center', fontSize: '1rem', fontWeight: 'bold' }}
                      />
                      <button
                        onClick={() => handleVerify2FA(!securityData.twoFactorEnabled)}
                        className={styles.confirmBtn}
                        style={{ padding: '0.5rem 1rem', background: '#10b981', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
                        disabled={loadingSecurity || twoFactorCode.length !== 6}
                      >
                        {loadingSecurity ? 'Verificando...' : 'Confirmar'}
                      </button>
                      <button
                        onClick={() => setShow2FAForm(false)}
                        style={{ padding: '0.5rem 1rem', background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}

                <hr className={styles.securityDivider} />

                {/* Sesiones Activas / Cierre Global */}
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

                {/* Descargar Datos */}
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

                {/* Borrar Cuenta */}
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
          )}
        </div>

      </div>
    </DoctorLayout>
  );
}
