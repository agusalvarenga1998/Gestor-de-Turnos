import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';
import DoctorLayout from '../components/DoctorLayout';
import Icon from '../components/Icon';
import { useAuth } from '../hooks/useAuth';
import apiClient, { googleAPI } from '../services/api';
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
  const [searchParams] = useSearchParams();
  const [googleConnected, setGoogleConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [profileData, setProfileData] = useState({
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
  const [existingSpecializations, setExistingSpecializations] = useState([]);

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
    fetchSpecializations();

    // Cargar datos del usuario
    if (user) {
      setProfileData({
        specialization: user.specialization || '',
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
      if (user.latitude && user.longitude) {
        setMapCenter([user.latitude, user.longitude]);
      }
    }

    // Detectar si viene del callback de Google
    if (searchParams.get('connected') === 'true') {
      setSuccessMessage('✓ Google Calendar conectado exitosamente');
      setTimeout(() => setSuccessMessage(''), 5000);
    }

    if (searchParams.get('error') === 'true') {
      setSuccessMessage('✗ Error al conectar Google Calendar');
      setTimeout(() => setSuccessMessage(''), 5000);
    }
  }, [searchParams, user]);

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

  const fetchSpecializations = async () => {
    try {
      // Usamos el endpoint existente que ya devuelve especialidades únicas
      const response = await axios.get(`${process.env.REACT_APP_API_BASE_URL || ''}/api/appointments/public/specializations`);
      if (response.data.success) {
        setExistingSpecializations(response.data.specializations);
      }
    } catch (err) {
      console.error('Error cargando especialidades:', err);
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

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    try {
      setSavingProfile(true);
      const response = await apiClient.put(
        '/api/auth/profile',
        profileData
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

        {/* Google Calendar Section */}
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <div className={styles.sectionTitle}>
              <Icon name="calendar" size={24} color="#2563eb" />
              Google Calendar
            </div>
            <p className={styles.sectionDescription}>
              Sincroniza automáticamente tus citas con Google Calendar.
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

        {/* Mercado Pago Section */}
        <div className={styles.section}>
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
              ) : (
                <button
                  className={styles.connectBtn}
                  style={{ backgroundColor: '#009ee3', borderColor: '#009ee3', color: 'white', display: 'flex', alignItems: 'center', gap: '8px' }}
                  onClick={async () => {
                    const mpToken = window.prompt('Para vincular tu cuenta, ingresa tu Access Token de Producción de Mercado Pago:');
                    if (mpToken && mpToken.startsWith('APP_USR-')) {
                      try {
                        setSavingProfile(true);
                        const res = await apiClient.put('/api/auth/profile', { 
                          mp_connected: true, 
                          mp_access_token: mpToken 
                        });
                        
                        if (res.data.success) {
                          setSuccessMessage('✓ ¡Mercado Pago vinculado exitosamente!');
                          refreshUser();
                        }
                      } catch (err) {
                        alert('Error al vincular el token. Verifica que sea válido.');
                      } finally {
                        setSavingProfile(false);
                      }
                    } else if (mpToken) {
                      alert('El token debe comenzar con APP_USR-');
                    }
                  }}
                >
                   <Icon name="check-circle" size={18} color="white" />
                   Vincular con Mercado Pago
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Profile Settings */}
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <div className={styles.sectionTitle}>
              <Icon name="users" size={24} color="#2563eb" />
              Datos Profesionales
            </div>
            <p className={styles.sectionDescription}>
              Actualiza tu información profesional y de contacto
            </p>
          </div>

          <div className={styles.card}>
            <form onSubmit={handleSaveProfile} className={styles.form}>
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label htmlFor="specialization">Especialidad / Rubro</label>
                  <input
                    type="text"
                    id="specialization"
                    name="specialization"
                    list="specialization-list"
                    value={profileData.specialization}
                    onChange={handleProfileChange}
                    placeholder="Ej: Estética, Barbería, Abogados, etc."
                    disabled={savingProfile}
                  />
                  <datalist id="specialization-list">
                    {existingSpecializations.map((spec, index) => (
                      <option key={index} value={spec} />
                    ))}
                  </datalist>
                  <small>Elegí una existente o escribí tu propio rubro.</small>
                </div>
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
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label htmlFor="appointment_price">Costo Total de Consulta ($)</label>
                  <input
                    type="number"
                    id="appointment_price"
                    name="appointment_price"
                    step="0.01"
                    min="0"
                    value={profileData.appointment_price}
                    onChange={handleProfileChange}
                    placeholder="Ej: 15000"
                    disabled={savingProfile}
                  />
                  <small>Este es el valor total que cobras por la atención.</small>
                </div>
                <div className={styles.formGroup}>
                  <label htmlFor="booking_fee">Monto de Reserva online ($)</label>
                  <input
                    type="number"
                    id="booking_fee"
                    name="booking_fee"
                    step="0.01"
                    min="0"
                    value={profileData.booking_fee}
                    onChange={handleProfileChange}
                    placeholder="Ej: 3000"
                    disabled={savingProfile}
                  />
                  <small>Lo que el paciente paga para señar el turno.</small>
                </div>
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
                <label htmlFor="address">Dirección del Consultorio</label>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <input
                    type="text"
                    id="address"
                    name="address"
                    value={profileData.address}
                    onChange={handleProfileChange}
                    placeholder="Ej: Calle Principal 123, Ciudad"
                    style={{ flex: 1 }}
                    disabled={savingProfile}
                  />
                  <button 
                    type="button" 
                    onClick={handleVerifyAddress}
                    className={styles.verifyBtn}
                  >
                    Ubicar en Mapa 🗺️
                  </button>
                </div>
                <small>Escribe tu dirección y presiona "Ubicar" para verla en el mapa inferior.</small>
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
      </div>
    </DoctorLayout>
  );
}
