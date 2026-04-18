import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { appointmentAPI, insuranceAPI } from '../services/api';
import DoctorMap from '../components/DoctorMap';
import SplashLoader from '../components/SplashLoader';
import DatePicker, { registerLocale } from "react-datepicker";
import { es } from 'date-fns/locale';
import "react-datepicker/dist/react-datepicker.css";
import styles from './PatientPortalHomePage.module.css';

registerLocale('es', es);

export default function PatientPortalHomePage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(null);
  const [showSplash, setShowSplash] = useState(true);
  const [searchType, setSearchType] = useState('data');
  const [formData, setFormData] = useState({ name: '', lastName: '', documentNumber: '' });
  const [appointmentCode, setAppointmentCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Booking states
  const [specializations, setSpecializations] = useState([]);
  const [selectedSpecialization, setSelectedSpecialization] = useState('');
  const [doctors, setDoctors] = useState([]);
  const [selectedDoctor, setSelectedDoctor] = useState('');
  const [services, setServices] = useState([]);
  const [selectedService, setSelectedService] = useState(null);
  const [appointmentDate, setAppointmentDate] = useState('');
  const [availableSlots, setAvailableSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState('');
  const [bookingError, setBookingError] = useState('');
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [patientData, setPatientData] = useState({ name: '', lastName: '', email: '', documentNumber: '', phone: '', insuranceId: '' });
  const [doctorInsurances, setDoctorInsurances] = useState([]);
  const [userLocation, setUserLocation] = useState(null);
  const [doctorAvailability, setDoctorAvailability] = useState({ workingDays: [], vacations: [] });

  useEffect(() => {
    if (activeTab === 'book' && "geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition((position) => {
        setUserLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
      });
    }
  }, [activeTab]);

  useEffect(() => {
    loadSpecializations();
  }, []);

  useEffect(() => {
    if (selectedSpecialization) {
      setDoctors([]); // Limpiar lista anterior
      setSelectedDoctor(''); // Limpiar selección anterior
      loadDoctors(selectedSpecialization);
    }
  }, [selectedSpecialization]);

  useEffect(() => {
    if (selectedDoctor) {
      loadDoctorInsurances(selectedDoctor);
      loadDoctorAvailability(selectedDoctor);
      loadServices(selectedDoctor);
    }
  }, [selectedDoctor]);

  useEffect(() => {
    if (selectedDoctor && appointmentDate && selectedService) {
      loadAvailableSlots(selectedDoctor, appointmentDate, selectedService.duration_minutes);
    }
  }, [selectedDoctor, appointmentDate, selectedService]);

  const loadDoctorAvailability = async (doctorId) => {
    try {
      const response = await appointmentAPI.getDoctorAvailability(doctorId);
      if (response.success) setDoctorAvailability(response);
    } catch (err) { }
  };

  const loadDoctorInsurances = async (doctorId) => {
    try {
      const response = await insuranceAPI.getPublicInsurances(doctorId);
      if (response.success) setDoctorInsurances(response.insurances);
    } catch (err) { setDoctorInsurances([]); }
  };

  const loadSpecializations = async () => {
    try {
      const response = await appointmentAPI.getPublicSpecializations();
      if (response.success) setSpecializations(response.specializations);
    } catch (err) { }
  };

  const loadDoctors = async (specialization) => {
    try {
      const response = await appointmentAPI.getPublicDoctors(specialization);
      if (response.success) setDoctors(response.doctors);
    } catch (err) { }
  };

  const loadServices = async (doctorId) => {
    try {
      const response = await appointmentAPI.getPublicServices(doctorId);
      if (response.success) {
        setServices(response.services);
        // Autoseleccionar si solo hay uno
        if (response.services.length === 1) setSelectedService(response.services[0]);
      }
    } catch (err) { setServices([]); }
  };

  const loadAvailableSlots = async (doctorId, date, duration) => {
    try {
      const response = await appointmentAPI.getPublicAvailableSlots(doctorId, date, duration);
      if (response.success) {
        setAvailableSlots(response.slots || []);
        setSelectedSlot('');
      }
    } catch (err) { setAvailableSlots([]); }
  };

  const handlePatientDataChange = (e) => {
    const { name, value } = e.target;
    setPatientData(prev => ({ ...prev, [name]: value }));
  };

  const handleBookAppointment = async (e) => {
    e.preventDefault();
    if (!patientData.name || !patientData.lastName || !patientData.documentNumber || !patientData.phone || !selectedSlot) {
      setBookingError('Por favor completa todos los campos requeridos');
      return;
    }
    setBookingLoading(true);
    try {
      const response = await appointmentAPI.createPublicAppointment({
        doctorId: selectedDoctor,
        serviceId: selectedService?.id,
        appointmentDate,
        appointmentTime: selectedSlot,
        patientName: patientData.name,
        patientLastName: patientData.lastName,
        patientEmail: patientData.email,
        patientDocumentNumber: patientData.documentNumber,
        patientPhone: patientData.phone,
        insuranceId: patientData.insuranceId
      });

      if (response.success) {
        if (response.paymentRequired && response.initPoint) {
          window.location.href = response.initPoint;
        } else {
          setBookingSuccess(true);
          setBookingLoading(false);
        }
      }
    } catch (err) {
      setBookingError(err.response?.data?.message || 'Error al agendar el turno');
      setBookingLoading(false);
    }
  };

  const handleSubmitSearch = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (searchType === 'data') {
        const response = await appointmentAPI.searchByPatientData(formData);
        if (response.success && response.appointment) {
          navigate(`/patient/appointment/${response.appointment.id}`);
        }
      } else {
        navigate(`/patient/appointment/${appointmentCode.trim().toUpperCase()}`);
      }
    } catch (err) {
      setError('No se encontró ninguna cita.');
      setLoading(false);
    }
  };

  return (
    <>
      {showSplash && <SplashLoader onComplete={() => setShowSplash(false)} />}
      <div className={styles.pageWrapper}>
        <nav className={styles.navbar}>
          <div className={styles.navContent}>
            <Link to="/patient" className={styles.navLogo} onClick={() => setActiveTab(null)}>
              <img src="/logo_turnohub.png" alt="T" />
              <span>TurnoHub Turnos</span>
            </Link>
          </div>
        </nav>

        <header className={styles.hero}>
          <div className={styles.heroContent}>
            <h1>Tu tiempo, <span>optimizado</span></h1>
            <p>Gestiona tus turnos y reservas de forma rápida y sencilla.</p>
          </div>
        </header>

        <main className={styles.mainContent}>
          {!activeTab ? (
            <div className={styles.menuGrid}>
              <div className={styles.menuCard} onClick={() => setActiveTab('book')}>
                <div className={styles.cardIcon}>📅</div>
                <div className={styles.cardInfo}>
                  <h3>Pedir un Turno</h3>
                  <p>Reserva tu cita con especialistas en pocos pasos.</p>
                </div>
              </div>
              <div className={styles.menuCard} onClick={() => setActiveTab('search')}>
                <div className={styles.cardIcon}>🔍</div>
                <div className={styles.cardInfo}>
                  <h3>Mis Turnos</h3>
                  <p>Consulta el estado de tu cita o descarga tu comprobante.</p>
                </div>
              </div>
            </div>
          ) : (
            <div className={styles.formContainer}>
              <button className={styles.backBtn} onClick={() => setActiveTab(null)}>
                ← Volver al menú
              </button>

              {activeTab === 'search' && (
                <div className={styles.formCard}>
                  <div className={styles.formHeader}>
                    <h2>Buscar mi Turno</h2>
                  </div>
                  <div className={styles.tabs}>
                    <button className={`${styles.tab} ${searchType === 'data' ? styles.tabActive : ''}`} onClick={() => setSearchType('data')}>Por Datos</button>
                    <button className={`${styles.tab} ${searchType === 'code' ? styles.tabActive : ''}`} onClick={() => setSearchType('code')}>Por Código</button>
                  </div>
                  <form onSubmit={handleSubmitSearch}>
                    {searchType === 'data' ? (
                      <div className={styles.formGrid}>
                        <div className={styles.formGroup}><label>NOMBRE</label><input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required /></div>
                        <div className={styles.formGroup}><label>APELLIDO</label><input type="text" value={formData.lastName} onChange={(e) => setFormData({ ...formData, lastName: e.target.value })} required /></div>
                        <div className={`${styles.formGroup} ${styles.fullWidth}`}><label>DNI</label><input type="text" value={formData.documentNumber} onChange={(e) => setFormData({ ...formData, documentNumber: e.target.value })} required /></div>
                      </div>
                    ) : (
                      <div className={styles.formGroup}><label>CÓDIGO</label><input type="text" value={appointmentCode} onChange={(e) => setAppointmentCode(e.target.value)} required /></div>
                    )}
                    {error && <p className={styles.errorMsg}>{error}</p>}
                    <button type="submit" className={styles.submitBtn} disabled={loading}>{loading ? 'BUSCANDO...' : 'BUSCAR TURNO'}</button>
                  </form>
                </div>
              )}

              {activeTab === 'book' && (
                <div className={styles.bookingSplitLayout}>
                  <div className={styles.bookingFormSide}>
                    <div className={styles.formCard}>
                      {bookingSuccess ? (
                        <div className={styles.successMessage}>
                          <div className={styles.successIcon}>✓</div>
                          <h2>¡Turno solicitado!</h2>
                          <p>Recibirás un email con la confirmación.</p>
                        </div>
                      ) : (
                        <form onSubmit={handleBookAppointment}>
                          <h2>Reserva de Turno</h2>
                          <div className={styles.sectionTitle}>1. Rubro / Categoría</div>
                          <div className={styles.formGrid}>
                            <div className={styles.formGroup}>
                              <label>RUBRO / CATEGORÍA</label>
                              <select onChange={(e) => setSelectedSpecialization(e.target.value)} value={selectedSpecialization} required>
                                <option value="">Selecciona...</option>
                                {specializations.map(s => <option key={s} value={s}>{s}</option>)}
                              </select>
                            </div>
                            <div className={styles.formGroup}>
                              <label>PROFESIONAL / LOCAL</label>
                              <select onChange={(e) => { setSelectedDoctor(e.target.value); setSelectedService(null); }} value={selectedDoctor} disabled={!selectedSpecialization} required>
                                <option value="">Selecciona...</option>
                                {doctors.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                              </select>
                            </div>
                          </div>

                          {selectedDoctor && (
                            <>
                              <div className={styles.sectionTitle}>2. Servicio</div>
                              <div className={styles.servicesList}>
                                {services.map(s => (
                                  <div 
                                    key={s.id} 
                                    className={`${styles.serviceOption} ${selectedService?.id === s.id ? styles.serviceSelected : ''}`}
                                    onClick={() => setSelectedService(s)}
                                  >
                                    <div className={styles.serviceInfo}>
                                      <span className={styles.serviceName}>{s.name}</span>
                                      <span className={styles.serviceMeta}>{s.duration_minutes} min • ${parseFloat(s.price).toLocaleString()}</span>
                                    </div>
                                    <div className={styles.serviceCheck}>
                                      {selectedService?.id === s.id ? '✓' : ''}
                                    </div>
                                  </div>
                                ))}
                                {services.length === 0 && <p className={styles.emptyMsg}>Este profesional no tiene servicios configurados.</p>}
                              </div>
                            </>
                          )}

                          <div className={styles.sectionTitle}>{selectedDoctor ? '3' : '2'}. Tus Datos</div>
                          <div className={styles.formGrid}>
                            <div className={styles.formGroup}><label>NOMBRE</label><input type="text" name="name" onChange={handlePatientDataChange} required /></div>
                            <div className={styles.formGroup}><label>APELLIDO</label><input type="text" name="lastName" onChange={handlePatientDataChange} required /></div>
                            <div className={styles.formGroup}><label>DNI</label><input type="text" name="documentNumber" onChange={handlePatientDataChange} required /></div>
                            <div className={styles.formGroup}><label>TELÉFONO</label><input type="tel" name="phone" onChange={handlePatientDataChange} required /></div>
                            <div className={styles.formGroup}><label>EMAIL (Obligatorio)</label><input type="email" name="email" onChange={handlePatientDataChange} required /></div>
                            <div className={`${styles.formGroup} ${styles.fullWidth}`}><label>CONVENIO / DESCUENTO (Opcional)</label>
                              <select name="insuranceId" onChange={handlePatientDataChange} disabled={!selectedDoctor}>
                                <option value="">Sin convenio (Particular)</option>
                                {doctorInsurances.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                              </select>
                            </div>
                          </div>

                          <div className={styles.sectionTitle}>{selectedDoctor ? '4' : '3'}. Fecha y Hora</div>
                          <div className={styles.formGrid}>
                            <div className={styles.formGroup}>
                              <label>FECHA</label>
                              <DatePicker
                                selected={appointmentDate ? new Date(appointmentDate + 'T12:00:00') : null}
                                onChange={(date) => setAppointmentDate(date?.toISOString().split('T')[0] || '')}
                                filterDate={(date) => doctorAvailability.workingDays.includes(date.getDay())}
                                minDate={new Date()}
                                className={styles.datePickerInput}
                                dateFormat="dd/MM/yyyy"
                                locale="es"
                                disabled={!selectedDoctor || !selectedService}
                                placeholderText={!selectedService ? "Primero elige un servicio" : "Elige fecha"}
                              />
                            </div>
                            <div className={styles.formGroup}>
                              <label>HORA</label>
                              <select onChange={(e) => setSelectedSlot(e.target.value)} disabled={!appointmentDate || !selectedService} required>
                                <option value="">Selecciona...</option>
                                {availableSlots.map(s => <option key={s} value={s}>{s}</option>)}
                              </select>
                            </div>
                          </div>

                          {selectedDoctor && selectedService && selectedSlot && (
                            <div className={styles.paymentSummary}>
                              <h4>Resumen de Reserva</h4>
                              {(() => {
                                const d = doctors.find(doc => doc.id === selectedDoctor);
                                const servicePrice = parseFloat(selectedService.price);
                                
                                // Obtener descuento de obra social si existe
                                const selectedInsurance = doctorInsurances.find(i => i.id === patientData.insuranceId);
                                const insuranceDiscount = parseFloat(selectedInsurance?.additional_fee || 0);

                                const systemFee = servicePrice * 0.03;
                                const professionalFee = (selectedService.booking_fee !== null && selectedService.booking_fee !== undefined) 
                                  ? parseFloat(selectedService.booking_fee) 
                                  : parseFloat(d?.booking_fee || 0);
                                
                                const totalCustomerCost = servicePrice + systemFee - insuranceDiscount;
                                // Si la OS cubre el total, el cliente paga 0 ahora
                                const totalNow = insuranceDiscount >= servicePrice ? 0 : (professionalFee + systemFee);
                                // Lo que queda para el local (mínimo 0)
                                const balanceInLocal = Math.max(0, servicePrice - professionalFee - insuranceDiscount);

                                return (
                                  <>
                                    <div className={styles.paymentRow}>
                                      <span>Valor del Servicio:</span>
                                      <span>${servicePrice.toLocaleString()}</span>
                                    </div>
                                    <div className={styles.paymentRow}>
                                      <span>Uso de la Aplicación (3%):</span>
                                      <span>${systemFee.toLocaleString()}</span>
                                    </div>
                                    
                                    {insuranceDiscount > 0 && (
                                      <div className={styles.paymentRow} style={{ color: '#10b981', fontWeight: '500' }}>
                                        <span>Cobertura {selectedInsurance.name}:</span>
                                        <span>-${insuranceDiscount.toLocaleString()}</span>
                                      </div>
                                    )}

                                    <div className={`${styles.paymentRow} ${styles.highlightRow}`}>
                                      <span>COSTO TOTAL:</span>
                                      <span>${(totalCustomerCost > 0 ? totalCustomerCost : 0).toLocaleString()}</span>
                                    </div>
                                    
                                    <div className={`${styles.paymentRow} ${styles.totalRow}`}>
                                      <strong>PAGAR AHORA (Reserva + App):</strong>
                                      <strong>${totalNow.toLocaleString()}</strong>
                                    </div>
                                    <div className={styles.paymentRow}>
                                      <span>Abonar en el local:</span>
                                      <span>${(balanceInLocal > 0 ? balanceInLocal : 0).toLocaleString()}</span>
                                    </div>
                                  </>
                                );
                              })()}
                              <p className={styles.paymentNotice}>El saldo restante se abona en el local al finalizar el servicio.</p>
                            </div>
                          )}

                          {bookingError && <p className={styles.errorMsg}>{bookingError}</p>}
                          <button type="submit" className={styles.submitBtn} disabled={bookingLoading || !selectedSlot}>
                            {bookingLoading ? 'PROCESANDO...' : 'CONFIRMAR Y PAGAR'}
                          </button>
                        </form>
                      )}
                    </div>
                  </div>

                  <div className={styles.bookingMapSide}>
                    <div className={styles.stickyMap}>
                      <h3>Buscar por cercanía</h3>
                      <div className={styles.mapFrame}>
                        <DoctorMap
                          doctors={doctors}
                          onSelectDoctor={setSelectedDoctor}
                          userLocation={userLocation}
                        />
                      </div>
                      <p className={styles.mapHint}>* Usa el mapa para ver dónde atiende cada médico de esta especialidad.</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </>
  );
}
