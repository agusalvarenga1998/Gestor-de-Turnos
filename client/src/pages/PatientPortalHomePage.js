import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { appointmentAPI, insuranceAPI } from '../services/api';
import DoctorMap from '../components/DoctorMap';
import Icon from '../components/Icon';
import SplashLoader from '../components/SplashLoader';
import Loading from '../components/Loading';
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
  const [formData, setFormData] = useState({ name: '', lastName: '', documentNumber: '', doctorId: '', specialization: '' });
  const [appointmentCode, setAppointmentCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 1024);
    };
    window.addEventListener('resize', handleResize);

    // Detectar iOS y standalone
    const userAgent = window.navigator.userAgent.toLowerCase();
    const ios = /iphone|ipad|ipod/.test(userAgent);
    const standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
    setIsIOS(ios);
    setIsStandalone(standalone);

    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallPWA = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      console.log(`PWA Installation outcome: ${outcome}`);
      setDeferredPrompt(null);
      setShowInstallPrompt(false);
    } else if (isIOS) {
      alert("Para instalar TurnoHub en tu iPhone/iPad: Presiona el botón Compartir (📤) en la barra inferior de Safari y luego selecciona 'Agregar a Inicio' (➕).");
    }
  };

  // Booking states
  const [rubros, setRubros] = useState([]);
  const [selectedRubro, setSelectedRubro] = useState('');
  const [specializations, setSpecializations] = useState([]);
  const [selectedSpecialization, setSelectedSpecialization] = useState('');
  const [doctors, setDoctors] = useState([]);
  const [selectedDoctor, setSelectedDoctor] = useState('');
  const [initialDoctorId, setInitialDoctorId] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('doctor') || '';
  });
  const [services, setServices] = useState([]);
  const [selectedService, setSelectedService] = useState(null);
  const [appointmentDate, setAppointmentDate] = useState('');
  const [availableSlots, setAvailableSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState('');
  const [bookingError, setBookingError] = useState('');
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState(null);
  const [patientData, setPatientData] = useState({ 
    name: '', 
    lastName: '', 
    email: '', 
    documentNumber: '', 
    phone: '', 
    insuranceId: '', 
    insurancePlanId: '', 
    paymentMethod: 'online',
    documentType: 'DNI',
    dateOfBirth: '',
    gender: 'Masculino',
    insurancePolicyNumber: '',
    address: '',
    locality: '',
    province: ''
  });
  const [doctorInsurances, setDoctorInsurances] = useState([]);
  const [selectedInsurancePlans, setSelectedInsurancePlans] = useState([]);
  const [userLocation, setUserLocation] = useState(null);
  const [doctorAvailability, setDoctorAvailability] = useState({ workingDays: [], vacations: [] });
  const [isExistingCustomer, setIsExistingCustomer] = useState(false);
  const [autofilledSuccess, setAutofilledSuccess] = useState(false);
  const [allDoctors, setAllDoctors] = useState([]);

  useEffect(() => {
    if (activeTab === 'book' && "geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition((position) => {
        setUserLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
      });
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab) return;

    const handleMouseMove = (e) => {
      const moveX = (e.clientX - window.innerWidth / 2) / 50;
      const moveY = (e.clientY - window.innerHeight / 2) / 50;
      const floatImg = document.querySelector(`.${styles.floatAnimation}`);
      if (floatImg) {
        floatImg.style.transform = `translate(${moveX}px, ${moveY}px)`;
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, [activeTab]);

  useEffect(() => {
    loadRubros();
    loadAllDoctors();
  }, []);

  useEffect(() => {
    if (allDoctors.length > 0 && initialDoctorId) {
      const doc = allDoctors.find(d => d.id === initialDoctorId);
      if (doc) {
        setActiveTab('book');
        setSelectedRubro(doc.rubro);
      } else {
        setInitialDoctorId('');
      }
    }
  }, [allDoctors, initialDoctorId]);

  useEffect(() => {
    if (selectedRubro) {
      setSpecializations([]);
      if (initialDoctorId) {
        const doc = allDoctors.find(d => d.id === initialDoctorId);
        if (doc) {
          setSelectedSpecialization(doc.specialization);
        } else {
          setSelectedSpecialization('');
        }
      } else {
        setSelectedSpecialization('');
      }
      setDoctors([]);
      setSelectedDoctor('');
      loadSpecializations(selectedRubro);
    } else {
      setSpecializations([]);
      setSelectedSpecialization('');
      setDoctors([]);
      setSelectedDoctor('');
    }
  }, [selectedRubro]);

  useEffect(() => {
    if (selectedSpecialization) {
      setDoctors([]); // Limpiar lista anterior
      if (initialDoctorId) {
        setSelectedDoctor(initialDoctorId);
        setTimeout(() => setInitialDoctorId(''), 100);
      } else {
        setSelectedDoctor('');
      }
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

  useEffect(() => {
    const fetchPatientDataByDni = async () => {
      const dni = patientData.documentNumber?.trim();
      if (!isExistingCustomer || !selectedDoctor || !dni || dni.length < 7 || dni.length > 10) {
        return;
      }

      try {
        console.log(`Buscando datos del paciente para DNI: ${dni}`);
        const response = await appointmentAPI.getPublicPatientDetails(selectedDoctor, dni);
        if (response.success && response.patient) {
          console.log('Paciente encontrado, autocompletando datos:', response.patient);
          setPatientData(prev => ({
            ...prev,
            name: response.patient.name,
            lastName: response.patient.lastName || '',
            email: response.patient.email || '',
            phone: response.patient.phone || '',
            documentType: response.patient.documentType || 'DNI',
            dateOfBirth: response.patient.dateOfBirth || '',
            gender: response.patient.gender || 'Masculino',
            address: response.patient.address || '',
            locality: response.patient.locality || '',
            province: response.patient.province || '',
            insuranceId: response.patient.insuranceId || '',
            insurancePlanId: response.patient.insurancePlanId || '',
            insurancePolicyNumber: response.patient.insurancePolicyNumber || ''
          }));

          if (response.patient.insuranceId) {
            const selectedIns = doctorInsurances.find(i => i.id === response.patient.insuranceId);
            setSelectedInsurancePlans(selectedIns?.plans || []);
          } else {
            setSelectedInsurancePlans([]);
          }

          setAutofilledSuccess(true);
        }
      } catch (err) {
        console.error('Error al autocompletar datos de paciente:', err);
      }
    };

    const delayDebounceFn = setTimeout(() => {
      fetchPatientDataByDni();
    }, 600); // Debounce de 600ms para esperar que termine de escribir

    return () => clearTimeout(delayDebounceFn);
  }, [patientData.documentNumber, selectedDoctor, isExistingCustomer, doctorInsurances]);

  const handleDniSearch = async () => {
    const dni = patientData.documentNumber?.trim();
    if (!selectedDoctor) {
      setBookingError('Por favor selecciona un profesional primero');
      return;
    }
    if (!dni || dni.length < 7 || dni.length > 10) {
      setBookingError('Por favor ingresa un DNI válido (entre 7 y 10 dígitos)');
      return;
    }

    setBookingLoading(true);
    setBookingError('');
    try {
      console.log(`Buscando datos del paciente para DNI: ${dni}`);
      const response = await appointmentAPI.getPublicPatientDetails(selectedDoctor, dni);
      if (response.success && response.patient) {
        console.log('Paciente encontrado, autocompletando datos:', response.patient);
        setPatientData(prev => ({
          ...prev,
          name: response.patient.name,
          lastName: response.patient.lastName || '',
          email: response.patient.email || '',
          phone: response.patient.phone || '',
          documentType: response.patient.documentType || 'DNI',
          dateOfBirth: response.patient.dateOfBirth || '',
          gender: response.patient.gender || 'Masculino',
          address: response.patient.address || '',
          locality: response.patient.locality || '',
          province: response.patient.province || '',
          insuranceId: response.patient.insuranceId || '',
          insurancePlanId: response.patient.insurancePlanId || '',
          insurancePolicyNumber: response.patient.insurancePolicyNumber || ''
        }));

        if (response.patient.insuranceId) {
          const selectedIns = doctorInsurances.find(i => i.id === response.patient.insuranceId);
          setSelectedInsurancePlans(selectedIns?.plans || []);
        } else {
          setSelectedInsurancePlans([]);
        }

        setAutofilledSuccess(true);
      } else {
        setBookingError('No se encontró ningún paciente con ese DNI.');
        setAutofilledSuccess(false);
      }
    } catch (err) {
      console.error('Error al buscar datos de paciente por DNI:', err);
      setBookingError(err.response?.data?.message || 'No se encontró ningún paciente con ese DNI.');
      setAutofilledSuccess(false);
    } finally {
      setBookingLoading(false);
    }
  };

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

  const loadRubros = async () => {
    try {
      const response = await appointmentAPI.getPublicRubros();
      if (response.success) setRubros(response.rubros);
    } catch (err) { }
  };

  const loadSpecializations = async (rubro) => {
    try {
      const response = await appointmentAPI.getPublicSpecializations(rubro);
      if (response.success) setSpecializations(response.specializations);
    } catch (err) { }
  };

  const loadAllDoctors = async () => {
    try {
      const response = await appointmentAPI.getAllPublicDoctors();
      if (response.success) setAllDoctors(response.doctors);
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
    if (name === 'insuranceId') {
      const selectedIns = doctorInsurances.find(i => i.id === value);
      setSelectedInsurancePlans(selectedIns?.plans || []);
      setPatientData(prev => ({
        ...prev,
        insuranceId: value,
        insurancePlanId: '' // reset plan when insurance changes
      }));
    } else {
      setPatientData(prev => ({ ...prev, [name]: value }));
    }
  };


  const handleBookAppointment = async (e) => {
    e.preventDefault();
    if (!patientData.name || !patientData.documentType || !patientData.documentNumber || !patientData.dateOfBirth || !selectedSlot) {
      setBookingError('Por favor completa todos los campos requeridos (*)');
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
        patientLastName: patientData.lastName || '',
        patientEmail: patientData.email,
        patientDocumentNumber: patientData.documentNumber,
        patientPhone: patientData.phone,
        insuranceId: patientData.insuranceId,
        insurancePlanId: patientData.insurancePlanId,
        paymentMethod: patientData.paymentMethod,
        documentType: patientData.documentType,
        dateOfBirth: patientData.dateOfBirth,
        gender: patientData.gender,
        address: patientData.address,
        locality: patientData.locality,
        province: patientData.province,
        insurancePolicyNumber: patientData.insurancePolicyNumber
      });

      if (response.success) {
        if (response.paymentRequired && response.initPoint) {
          window.location.href = response.initPoint;
        } else {
          setBookingSuccess(response.appointment);
          setBookingLoading(false);
        }
      }
    } catch (err) {
      setBookingError(err.response?.data?.message || 'Error al agendar el turno');
      setBookingLoading(false);
    }
  };

  const handleReset = () => {
    setActiveTab(null);
    setBookingSuccess(null);
    setSelectedSpecialization('');
    setSelectedDoctor('');
    setSelectedService(null);
    setAppointmentDate('');
    setAvailableSlots([]);
    setSelectedSlot('');
    setPatientData({ name: '', lastName: '', email: '', documentNumber: '', phone: '', insuranceId: '', insurancePlanId: '', paymentMethod: 'online' });
    setSelectedInsurancePlans([]);
    setError('');
    setBookingError('');
    setIsExistingCustomer(false);
    setAutofilledSuccess(false);
  };

  const handleSubmitSearch = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (searchType === 'data') {
        if (!formData.doctorId) {
          setError('Por favor selecciona un profesional.');
          setLoading(false);
          return;
        }
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

  const renderPatientFormFields = (isDisabled) => {
    return (
      <div className={styles.patientFormCardsGrid}>
        {/* Tarjeta 1: Datos del paciente */}
        <div className={styles.formCardBox}>
          <h3 className={styles.cardBoxTitle}>Datos del paciente</h3>
          <p className={styles.cardBoxSub}>Información básica de identificación.</p>
          
          <div className={styles.formGroup}>
            <label>Apellido y Nombre *</label>
            <input 
              type="text" 
              name="name" 
              value={patientData.name || ''} 
              onChange={handlePatientDataChange} 
              placeholder="Apellido, Nombre"
              required 
              disabled={isDisabled}
            />
          </div>

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label>Tipo doc. *</label>
              <select 
                name="documentType" 
                value={patientData.documentType || 'DNI'} 
                onChange={handlePatientDataChange}
                required
                disabled={isDisabled}
              >
                <option value="DNI">DNI</option>
                <option value="LC">LC</option>
                <option value="LE">LE</option>
                <option value="CI">CI</option>
                <option value="PASAPORTE">PASAPORTE</option>
              </select>
            </div>
            <div className={styles.formGroup}>
              <label>N° Documento *</label>
              <input 
                type="text" 
                name="documentNumber" 
                value={patientData.documentNumber || ''} 
                onChange={handlePatientDataChange} 
                placeholder="12345678"
                required 
                disabled={isDisabled}
              />
            </div>
          </div>

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label>Fecha de nac. *</label>
              <input 
                type="date" 
                name="dateOfBirth" 
                value={patientData.dateOfBirth || ''} 
                onChange={handlePatientDataChange}
                required
                disabled={isDisabled}
              />
            </div>
            <div className={styles.formGroup}>
              <label>Sexo</label>
              <select 
                name="gender" 
                value={patientData.gender || 'Masculino'} 
                onChange={handlePatientDataChange}
                disabled={isDisabled}
              >
                <option value="Masculino">Masculino</option>
                <option value="Femenino">Femenino</option>
                <option value="Otro">Otro</option>
              </select>
            </div>
          </div>
        </div>

        {/* Tarjeta 2: Obra social */}
        <div className={styles.formCardBox}>
          <h3 className={styles.cardBoxTitle}>Obra social</h3>
          <p className={styles.cardBoxSub}>Seleccioná tu cobertura médica si tenés.</p>
          
          <div className={styles.formGroup}>
            <label>Obra social</label>
            <select 
              name="insuranceId" 
              value={patientData.insuranceId || ''} 
              onChange={handlePatientDataChange}
              disabled={!selectedDoctor || isDisabled}
            >
              <option value="">Particular / Sin obra social</option>
              {doctorInsurances.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
            </select>
          </div>

          {patientData.insuranceId && selectedInsurancePlans.length > 0 && (
            <div className={styles.formGroup}>
              <label>Plan</label>
              <select 
                name="insurancePlanId" 
                value={patientData.insurancePlanId || ''} 
                onChange={handlePatientDataChange}
                required
                disabled={isDisabled}
              >
                <option value="">Selecciona tu plan...</option>
                {selectedInsurancePlans.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.coverage_type === 'percentage' ? `${parseFloat(p.coverage_value)}%` : `$${parseFloat(p.coverage_value)}`})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className={styles.formGroup}>
            <label>N° de afiliado</label>
            <input 
              type="text" 
              name="insurancePolicyNumber" 
              value={patientData.insurancePolicyNumber || ''} 
              onChange={handlePatientDataChange} 
              placeholder="0000000"
              disabled={isDisabled}
            />
          </div>
        </div>

        {/* Tarjeta 3: Contacto */}
        <div className={styles.formCardBox}>
          <h3 className={styles.cardBoxTitle}>Contacto</h3>
          <p className={styles.cardBoxSub}>Teléfono y email para comunicarnos con vos.</p>

          <div className={styles.formGroup}>
            <label>Celular</label>
            <input 
              type="tel" 
              name="phone" 
              value={patientData.phone || ''} 
              onChange={handlePatientDataChange} 
              placeholder="+54 9 11 0000-0000"
            />
          </div>

          <div className={styles.formGroup}>
            <label>Email</label>
            <input 
              type="email" 
              name="email" 
              value={patientData.email || ''} 
              onChange={handlePatientDataChange} 
              placeholder="nombre@email.com"
            />
          </div>
        </div>

        {/* Tarjeta 4: Domicilio */}
        <div className={styles.formCardBox}>
          <h3 className={styles.cardBoxTitle}>Domicilio</h3>
          <p className={styles.cardBoxSub}>Dirección de residencia actual.</p>

          <div className={styles.formGroup}>
            <label>Dirección</label>
            <input 
              type="text" 
              name="address" 
              value={patientData.address || ''} 
              onChange={handlePatientDataChange} 
              placeholder="Av. Corrientes 1234"
            />
          </div>

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label>Localidad</label>
              <input 
                type="text" 
                name="locality" 
                value={patientData.locality || ''} 
                onChange={handlePatientDataChange} 
                placeholder="Buenos Aires"
              />
            </div>
            <div className={styles.formGroup}>
              <label>Provincia</label>
              <input 
                type="text" 
                name="province" 
                value={patientData.province || ''} 
                onChange={handlePatientDataChange} 
                placeholder="CABA"
              />
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className={styles.container}>
      {showSplash && <SplashLoader onComplete={() => setShowSplash(false)} />}
      {bookingLoading && <Loading />}
      <div className={styles.pageWrapper}>
        <header className={styles.navbar}>
          <div className={styles.navContent}>
            <Link to="/patient" className={styles.navLogo} onClick={handleReset}>
              <span className={`material-symbols-outlined ${styles.logoIcon}`}>hub</span>
              <span className={styles.logoText}>TurnoHub Turnos</span>
            </Link>

            {/* Botón de instalación PWA */}
            {(showInstallPrompt || (isIOS && !isStandalone)) && (
              <button 
                onClick={handleInstallPWA}
                className={styles.installAppBtn}
              >
                <span className="material-symbols-outlined">download</span>
                <span>Instalar App</span>
              </button>
            )}
          </div>
        </header>

        <main className={styles.mainContent}>
          {!activeTab ? (
            <>
              {/* Hero Section */}
              <section className={styles.hero}>
                <div className={styles.heroContent}>
                  <div className={styles.heroText}>
                    <h2 className={styles.heroTitle}>Bienvenido a TurnoHub</h2>
                    <p className={styles.heroSubtitle}>Gestiona tus turnos y reservas de forma rápida, segura y desde cualquier lugar.</p>
                    <div className={styles.heroBadges}>
                      <div className={styles.heroBadge}>
                        <span className="material-symbols-outlined">verified</span>
                        <span>100% Seguro</span>
                      </div>
                      <div className={styles.heroBadge}>
                        <span className="material-symbols-outlined">bolt</span>
                        <span>Acceso Rápido</span>
                      </div>
                    </div>
                  </div>
                  <div className={`${styles.heroIllustration} ${styles.floatAnimation}`}>
                    <img 
                      alt="Productivity illustration" 
                      src="https://lh3.googleusercontent.com/aida-public/AB6AXuDzjd_j1hNQk1lYETh4LhorZYbpcpqm8gePv0Xyl8R5tOYvzpDe4-54SkGpdxLWd8NvjEnmcQDt4r3EtJyd5I-HmhZoe_bC4Geu7rf1or8I612o2dOTPZ9idEc9tSNLAE98cK5XoMZm-UHpXnZozxPfvFdZA9orvWiVl3gJo5UJ1BbEGQgUpvwlKRITUd01Jg7h3bc6ztnyxNZbjYmX9lIXK9dca8wt-BHcMq9sEzimBjpA9GTTspcXVaBADJ8yS2CAGru1CD7GBIAg" 
                    />
                  </div>
                </div>
                {/* Abstract background shapes */}
                <div className={styles.bgCircle1}></div>
                <div className={styles.bgCircle2}></div>
              </section>

              {/* Action Cards Grid */}
              <section className={styles.gridSection}>
                <div className={styles.menuGrid}>
                  {/* Pedir un Turno Card */}
                  <button type="button" className={styles.menuCard} onClick={() => setActiveTab('book')}>
                    <div className={`${styles.cardIconBox} ${styles.primaryIconBox}`}>
                      <span className="material-symbols-outlined">calendar_month</span>
                    </div>
                    <h3 className={`${styles.cardTitle} ${styles.primaryTitle}`}>Pedir un Turno</h3>
                    <p className={styles.cardDesc}>Reserva tu cita con especialistas en pocos pasos. Encuentra disponibilidad inmediata.</p>
                    <div className={`${styles.cardAction} ${styles.primaryAction}`}>
                      <span>Empezar ahora</span>
                      <span className="material-symbols-outlined">arrow_forward</span>
                    </div>
                  </button>

                  {/* Mis Turnos Card */}
                  <button type="button" className={styles.menuCard} onClick={() => setActiveTab('search')}>
                    <div className={`${styles.cardIconBox} ${styles.secondaryIconBox}`}>
                      <span className="material-symbols-outlined">history</span>
                    </div>
                    <h3 className={`${styles.cardTitle} ${styles.secondaryTitle}`}>Mis Turnos</h3>
                    <p className={styles.cardDesc}>Consulta el estado de tu cita o descarga tu comprobante. Revisa tu historial completo.</p>
                    <div className={`${styles.cardAction} ${styles.secondaryAction}`}>
                      <span>Ver historial</span>
                      <span className="material-symbols-outlined">arrow_forward</span>
                    </div>
                  </button>
                </div>
              </section>
            </>
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
                        <div className={`${styles.formGroup} ${styles.fullWidth}`}>
                          <label>PROFESIONAL / LOCAL</label>
                          <select 
                            value={formData.doctorId} 
                            onChange={(e) => setFormData({ ...formData, doctorId: e.target.value })}
                            required
                          >
                            <option value="">Selecciona...</option>
                            {allDoctors.map(d => (
                              <option key={d.id} value={d.id}>
                                {d.name} ({d.specialization})
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className={`${styles.formGroup} ${styles.fullWidth}`}>
                          <label>DNI DEL PACIENTE</label>
                          <input 
                            type="text" 
                            value={formData.documentNumber} 
                            onChange={(e) => setFormData({ ...formData, documentNumber: e.target.value })} 
                            placeholder="Ej: 12345678"
                            required 
                          />
                        </div>
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
                          
                          <div className={styles.successDetails}>
                            <div className={styles.detailItem}>
                              <strong>Fecha:</strong> {(() => {
                                try {
                                  const dateVal = bookingSuccess.appointmentDate;
                                  const dateStr = (typeof dateVal === 'string' && dateVal.includes('T')) 
                                    ? dateVal.split('T')[0] 
                                    : (dateVal instanceof Date ? dateVal.toISOString().split('T')[0] : dateVal);
                                  return new Date(dateStr + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
                                } catch (e) {
                                  return 'Fecha no disponible';
                                }
                              })()}
                            </div>
                            <div className={styles.detailItem}>
                              <strong>Hora:</strong> {bookingSuccess.appointmentTime} hs
                            </div>
                            <div className={styles.detailItem}>
                              <strong>Profesional:</strong> {bookingSuccess.doctorName}
                            </div>
                            {bookingSuccess.isOnline ? (
                              <div className={styles.detailItem}>
                                <strong>Modalidad:</strong> 🎥 Consulta Online
                              </div>
                            ) : (
                              <div className={styles.detailItem}>
                                <strong>Dirección:</strong> {bookingSuccess.address || 'Consultorio del profesional'}
                              </div>
                            )}
                          </div>

                          {bookingSuccess.isOnline && bookingSuccess.meetLink && (
                            <a
                              href={bookingSuccess.meetLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={styles.meetBtn}
                            >
                              🎥 Unirte a la videollamada (Google Meet)
                            </a>
                          )}
                          {bookingSuccess.isOnline && !bookingSuccess.meetLink && (
                            <p className={styles.meetPending}>⏳ El link de videollamada llegará por email una vez que el profesional lo confirme.</p>
                          )}
                          
                          <button className={styles.doneBtn} onClick={handleReset}>
                            Volver al Inicio
                          </button>
                        </div>
                      ) : (
                        <form onSubmit={handleBookAppointment}>
                          <h2>Reserva de Turno</h2>
                          <div className={styles.sectionTitle}>1. Rubro, Especialidad y Profesional</div>
                          <div className={styles.formGridThree}>
                            <div className={styles.formGroup}>
                              <label>RUBRO (CATEGORÍA)</label>
                              <select onChange={(e) => setSelectedRubro(e.target.value)} value={selectedRubro} required>
                                <option value="">Selecciona...</option>
                                {rubros.map(r => <option key={r} value={r}>{r}</option>)}
                              </select>
                            </div>
                            <div className={styles.formGroup}>
                              <label>ESPECIALIDAD</label>
                              <select 
                                onChange={(e) => setSelectedSpecialization(e.target.value)} 
                                value={selectedSpecialization} 
                                disabled={!selectedRubro}
                                required
                              >
                                <option value="">Selecciona...</option>
                                {specializations.map(s => <option key={s} value={s}>{s}</option>)}
                              </select>
                            </div>
                            <div className={styles.formGroup}>
                              <label>PROFESIONAL</label>
                              <select 
                                onChange={(e) => { setSelectedDoctor(e.target.value); setSelectedService(null); }} 
                                value={selectedDoctor} 
                                disabled={!selectedSpecialization} 
                                required
                              >
                                <option value="">Selecciona...</option>
                                {doctors.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                              </select>
                            </div>
                          </div>

                          {selectedDoctor && (
                            <div className={styles.doctorAddressInfo}>
                              <Icon name="map-pin" size={16} />
                              <span>{doctors.find(d => d.id === selectedDoctor)?.address || 'Dirección no especificada'}</span>
                            </div>
                          )}

                          {isMobile && selectedSpecialization && (
                            <div className={styles.mobileMapContainer}>
                              <h3 className={styles.mobileMapTitle}>Ubicación / Buscar por cercanía</h3>
                              <div className={styles.mapFrame}>
                                <DoctorMap
                                  doctors={doctors}
                                  onSelectDoctor={setSelectedDoctor}
                                  userLocation={userLocation}
                                />
                              </div>
                              <p className={styles.mapHint}>* Puedes tocar un marcador en el mapa para seleccionar al profesional.</p>
                            </div>
                          )}

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
                            <div className={styles.customerTypeToggle}>
                              <button
                                type="button"
                                className={`${styles.toggleBtn} ${!isExistingCustomer ? styles.activeToggle : ''}`}
                                onClick={() => {
                                  setIsExistingCustomer(false);
                                  setAutofilledSuccess(false);
                                  setPatientData({ name: '', lastName: '', email: '', documentNumber: '', phone: '', insuranceId: '', paymentMethod: 'online' });
                                }}
                              >
                                Soy Cliente Nuevo
                              </button>
                              <button
                                type="button"
                                className={`${styles.toggleBtn} ${isExistingCustomer ? styles.activeToggle : ''}`}
                                onClick={() => {
                                  setIsExistingCustomer(true);
                                  setAutofilledSuccess(false);
                                  setPatientData({ name: '', lastName: '', email: '', documentNumber: '', phone: '', insuranceId: '', paymentMethod: 'online' });
                                }}
                              >
                                Ya soy Cliente (Cargar por DNI)
                              </button>
                            </div>

                            {isExistingCustomer ? (
                              <>
                                <div className={styles.dniSearchWrapper}>
                                  <div className={styles.formGroup} style={{ flex: 1 }}>
                                    <label>INGRESA TU DNI</label>
                                    <input
                                      type="text"
                                      name="documentNumber"
                                      value={patientData.documentNumber || ''}
                                      onChange={handlePatientDataChange}
                                      placeholder="Ej: 12345678"
                                      required
                                    />
                                  </div>
                                  <button
                                    type="button"
                                    onClick={handleDniSearch}
                                    className={styles.dniSearchBtn}
                                  >
                                    Buscar Datos
                                  </button>
                                </div>

                                {autofilledSuccess && (
                                  <>
                                    <div className={styles.autofilledAlert}>
                                      <span>✓</span> ¡Datos cargados con éxito para <strong>{patientData.name}</strong>!
                                    </div>
                                    {renderPatientFormFields(true)}
                                  </>
                                )}
                              </>
                            ) : (
                              renderPatientFormFields(false)
                            )}

                            <div className={`${styles.formGroup} ${styles.fullWidth}`}>
                              <label>MÉTODO DE PAGO</label>
                              <select name="paymentMethod" onChange={handlePatientDataChange} value={patientData.paymentMethod}>
                                <option value="online">Pagar Reserva Online (Mercado Pago)</option>
                                <option value="cash">Pagar en el Local (Efectivo/Transferencia)</option>
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
                                
                                const selectedInsurance = doctorInsurances.find(i => i.id === patientData.insuranceId);
                                let insuranceDiscount = 0;
                                let selectedPlanName = '';
                                if (selectedInsurance) {
                                  if (patientData.insurancePlanId) {
                                    const selectedPlan = selectedInsurance.plans?.find(p => p.id === patientData.insurancePlanId);
                                    if (selectedPlan) {
                                      selectedPlanName = selectedPlan.name;
                                      if (selectedPlan.coverage_type === 'percentage') {
                                        insuranceDiscount = servicePrice * (parseFloat(selectedPlan.coverage_value) / 100);
                                      } else {
                                        insuranceDiscount = parseFloat(selectedPlan.coverage_value);
                                      }
                                    }
                                  } else {
                                    const specificCoverage = selectedInsurance.coverages?.find(c => c.service_id === selectedService.id);
                                    if (specificCoverage) {
                                      if (specificCoverage.coverage_type === 'percentage') {
                                        insuranceDiscount = servicePrice * (parseFloat(specificCoverage.coverage_value) / 100);
                                      } else {
                                        insuranceDiscount = parseFloat(specificCoverage.coverage_value);
                                      }
                                    } else {
                                      insuranceDiscount = parseFloat(selectedInsurance.additional_fee || 0);
                                    }
                                  }
                                }

                                const systemFee = d?.plan_type === 'commission' ? (servicePrice * 0.03) : 0;
                                const professionalFee = (selectedService.booking_fee !== null && selectedService.booking_fee !== undefined) 
                                  ? parseFloat(selectedService.booking_fee) 
                                  : parseFloat(d?.booking_fee || 0);
                                
                                const totalCustomerCost = servicePrice + systemFee - insuranceDiscount;
                                const totalNow = insuranceDiscount >= servicePrice ? 0 : (professionalFee + systemFee);
                                const balanceInLocal = Math.max(0, servicePrice - professionalFee - insuranceDiscount);

                                return (
                                  <>
                                    <div className={styles.paymentRow}>
                                      <span>Valor del Servicio:</span>
                                      <span>${servicePrice.toLocaleString()}</span>
                                    </div>
                                    {systemFee > 0 && (
                                      <div className={styles.paymentRow}>
                                        <span>Uso de la Aplicación (3%):</span>
                                        <span>${systemFee.toLocaleString()}</span>
                                      </div>
                                    )}
                                    
                                    {insuranceDiscount > 0 && (
                                      <div className={styles.paymentRow} style={{ color: '#10b981', fontWeight: '500' }}>
                                        <span>Cobertura {selectedInsurance.name} {selectedPlanName ? `(${selectedPlanName})` : ''}:</span>
                                        <span>-${insuranceDiscount.toLocaleString()}</span>
                                      </div>
                                    )}

                                    <div className={`${styles.paymentRow} ${styles.highlightRow}`}>
                                      <span>COSTO TOTAL:</span>
                                      <span>${(totalCustomerCost > 0 ? totalCustomerCost : 0).toLocaleString()}</span>
                                    </div>
                                    
                                    <div className={`${styles.paymentRow} ${styles.totalRow}`}>
                                      <strong>{patientData.paymentMethod === 'cash' ? 'PAGAR AHORA:' : 'PAGAR AHORA (Reserva + App):'}</strong>
                                      <strong>${(patientData.paymentMethod === 'cash' ? 0 : totalNow).toLocaleString()}</strong>
                                    </div>
                                    <div className={styles.paymentRow}>
                                      <span>Abonar en el local:</span>
                                      <span>${(patientData.paymentMethod === 'cash' ? servicePrice - insuranceDiscount : balanceInLocal).toLocaleString()}</span>
                                    </div>
                                  </>
                                );
                              })()}
                              <p className={styles.paymentNotice}>El saldo restante se abona en el local al finalizar el servicio.</p>
                            </div>
                          )}

                          {bookingError && <p className={styles.errorMsg}>{bookingError}</p>}
                          <button type="submit" className={styles.submitBtn} disabled={bookingLoading || !selectedSlot}>
                            {bookingLoading ? 'PROCESANDO...' : (patientData.paymentMethod === 'cash' ? 'CONFIRMAR TURNO' : 'CONFIRMAR Y PAGAR')}
                          </button>
                        </form>
                      )}
                    </div>
                  </div>

                  {!isMobile && (
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
                  )}
                </div>
              )}
            </div>
          )}
        </main>

        <footer className={styles.footer}>
          <div className={styles.footerContent}>
            <p>© 2026 TurnoHub. Todos los derechos reservados.</p>
            <div className={styles.footerLinks}>
              <Link to="/privacy">Política de Privacidad</Link>
              <span className={styles.divider}>•</span>
              <Link to="/terms">Términos de Servicio</Link>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
