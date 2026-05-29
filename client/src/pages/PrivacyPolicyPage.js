import React from 'react';
import { Link } from 'react-router-dom';
import styles from './LegalPages.module.css';

export default function PrivacyPolicyPage() {
  return (
    <div className={styles.container}>
      <nav className={styles.navbar}>
        <div className={styles.navContent}>
          <Link to="/login" className={styles.logo}>
            <img src="/logo_turnohub.png" alt="T" onError={(e) => { e.target.style.display = 'none'; }} />
            <span>TurnoHub</span>
          </Link>
          <Link to="/login" className={styles.backLink}>Volver al Inicio</Link>
        </div>
      </nav>

      <main className={styles.main}>
        <h1 className={styles.title}>Política de Privacidad</h1>
        <p className={styles.subtitle}>Última actualización: 29 de mayo de 2026</p>

        <div className={styles.content}>
          <p>
            En <strong>TurnoHub</strong> (en adelante, "la Plataforma"), operada para facilitar la gestión de turnos médicos y profesionales, nos tomamos muy en serio la privacidad y seguridad de sus datos personales. Esta Política de Privacidad describe cómo recopilamos, utilizamos y protegemos su información cuando utiliza nuestros servicios y, específicamente, cuando vincula su cuenta con los servicios de Google (Google Login y Google Calendar).
          </p>

          <h2>1. Información que recopilamos</h2>
          <p>
            Recopilamos información únicamente para proveer y mejorar la funcionalidad de gestión de citas:
          </p>
          <ul>
            <li><strong>Información de la Cuenta:</strong> Nombre, dirección de correo electrónico profesional, especialidad médica y datos de contacto de los profesionales de salud registrados.</li>
            <li><strong>Datos de Integración de Google:</strong> Si decide vincular su cuenta de Google, recopilamos su dirección de correo electrónico de Google, identificador único de Google, y los tokens de acceso y actualización correspondientes.</li>
            <li><strong>Datos de Google Calendar:</strong> Accedemos y leemos sus calendarios y eventos para evitar conflictos de horarios, y escribimos eventos específicos para agendar, actualizar o cancelar las citas programadas a través de TurnoHub.</li>
          </ul>

          <h2>2. Cómo utilizamos su información</h2>
          <p>
            Utilizamos los datos recopilados estrictamente para los siguientes propósitos:
          </p>
          <ul>
            <li>Proveer, operar y mantener la plataforma de gestión de turnos médicos.</li>
            <li>Permitir el inicio de sesión rápido mediante el servicio de autenticación de Google.</li>
            <li>Sincronizar de forma bidireccional los turnos programados en TurnoHub con su Google Calendar personal o del consultorio.</li>
            <li>Enviar notificaciones y recordatorios automáticos sobre citas agendadas o canceladas.</li>
          </ul>

          <h2>3. Uso Limitado de Datos de las APIs de Google</h2>
          <p>
            El uso y la transferencia por parte de TurnoHub a cualquier otra aplicación de la información recibida de las APIs de Google se adherirá a la <strong>Política de Datos de Usuario de los Servicios de API de Google</strong>, incluidos los requisitos de <strong>Uso Limitado</strong> (Limited Use requirements).
          </p>
          <p>
            No compartimos, transferimos ni vendemos bajo ninguna circunstancia sus datos obtenidos a través de las APIs de Google a terceros para fines publicitarios, análisis de datos de mercado ni otras actividades que no sean proveer de forma explícita la sincronización del calendario y autenticación de su cuenta de usuario.
          </p>

          <h2>4. Almacenamiento y Protección de Datos</h2>
          <p>
            Toda la información personal y los tokens de integración se transmiten de forma cifrada mediante HTTPS (protocolo seguro) y se almacenan utilizando estándares de seguridad modernos. Los tokens de acceso y actualización de Google se almacenan de manera segura y confidencial en nuestra base de datos.
          </p>

          <h2>5. Derechos del Usuario y Eliminación de Datos</h2>
          <p>
            Usted conserva el control total sobre sus datos en todo momento. Puede:
          </p>
          <ul>
            <li>Desvincular su cuenta de Google Calendar desde la sección de <strong>Configuración</strong> de la plataforma cuando lo desee, lo cual eliminará inmediatamente todos los tokens y credenciales guardados en nuestros servidores.</li>
            <li>Solicitar la eliminación definitiva de su cuenta de TurnoHub y todos los datos asociados enviando un correo electrónico a nuestro equipo de soporte.</li>
          </ul>

          <h2>6. Cambios en esta Política</h2>
          <p>
            Nos reservamos el derecho de actualizar esta Política de Privacidad de forma periódica. Cualquier cambio sustancial será notificado a través de la aplicación o mediante un correo electrónico informativo antes de que entre en vigencia.
          </p>

          <h2>7. Contacto</h2>
          <p>
            Si tiene alguna duda o consulta sobre esta política de privacidad o sobre el manejo de sus datos personales, puede ponerse en contacto con nosotros escribiendo a: <strong>soporte@turnohub.com.ar</strong>.
          </p>
        </div>
      </main>

      <footer className={styles.footer}>
        <p>© 2026 TurnoHub. Todos los derechos reservados.</p>
      </footer>
    </div>
  );
}
