import React from 'react';
import { Link } from 'react-router-dom';
import styles from './LegalPages.module.css';

export default function TermsOfServicePage() {
  return (
    <div className={styles.container}>
      <nav className={styles.navbar}>
        <div className={styles.navContent}>
          <Link to="/" className={styles.logo}>
            <span className={`material-symbols-outlined ${styles.logoIcon}`}>hub</span>
            <span>TurnoHub</span>
          </Link>
          <Link to="/" className={styles.backLink}>Volver al Inicio</Link>
        </div>
      </nav>

      <main className={styles.main}>
        <h1 className={styles.title}>Términos del Servicio</h1>
        <p className={styles.subtitle}>Última actualización: 29 de mayo de 2026</p>

        <div className={styles.content}>
          <p>
            Bienvenido a <strong>TurnoHub</strong>. Los siguientes Términos del Servicio (en adelante, "los Términos") regulan el acceso y uso de nuestra plataforma web y móvil diseñada para la gestión de turnos médicos y profesionales de la salud. Al registrarse y utilizar nuestros servicios, usted acepta cumplir plenamente con estos Términos.
          </p>

          <h2>1. Registro y Uso de la Cuenta</h2>
          <p>
            Para utilizar los servicios de TurnoHub como profesional de la salud o consultorio, debe registrar una cuenta proporcionando información verídica, exacta y actualizada. Usted es el único responsable de:
          </p>
          <ul>
            <li>Mantener la confidencialidad de sus credenciales de acceso.</li>
            <li>Todas las actividades realizadas bajo su cuenta.</li>
            <li>Garantizar que la información de los turnos y de sus pacientes cumpla con la normativa local de protección de datos de salud aplicable en su país.</li>
          </ul>

          <h2>2. Integración con Google Calendar</h2>
          <p>
            Nuestra plataforma ofrece una funcionalidad opcional de sincronización con <strong>Google Calendar</strong>. Al activar esta integración:
          </p>
          <ul>
            <li>Usted autoriza a TurnoHub a vincular su cuenta de Google, obtener los permisos necesarios de lectura/escritura en su calendario y sincronizar automáticamente las citas creadas en la plataforma.</li>
            <li>Es su responsabilidad asegurarse de que la vinculación del calendario profesional o personal no infrinja normas de privacidad internas de su organización médica o clínica.</li>
            <li>Usted puede desvincular la integración con Google Calendar en cualquier momento desde la sección de configuración de perfil del doctor.</li>
          </ul>

          <h2>3. Propiedad Intelectual</h2>
          <p>
            Todos los derechos de propiedad intelectual de la plataforma TurnoHub (código fuente, diseño de interfaces, logotipos, textos, gráficos e infraestructura tecnológica) son propiedad exclusiva de la Plataforma o sus licenciantes. Queda prohibida la reproducción, modificación o ingeniería inversa del software sin autorización previa por escrito.
          </p>

          <h2>4. Modificaciones y Suspensión del Servicio</h2>
          <p>
            Nos reservamos el derecho de modificar, actualizar o interrumpir temporal o permanentemente el servicio (o cualquier parte del mismo) en cualquier momento con o sin previo aviso para realizar tareas de mantenimiento, mejoras del sistema o actualizaciones de seguridad.
          </p>
          <p>
            Asimismo, nos reservamos el derecho de suspender o cancelar cuentas de usuarios que violen de forma flagrante estos Términos o hagan un uso fraudulento o indebido de la infraestructura de la plataforma.
          </p>

          <h2>5. Limitación de Responsabilidad</h2>
          <p>
            TurnoHub provee una herramienta de software como servicio (SaaS) para facilitar la gestión administrativa de consultorios. La Plataforma:
          </p>
          <ul>
            <li>No se responsabiliza de los desacuerdos, cancelaciones imprevistas, fallos de asistencia o mala praxis médica entre el profesional de salud y sus pacientes.</li>
            <li>No garantiza que el servicio esté libre de interrupciones temporales ocasionadas por fallos en proveedores de internet externos o caídas globales de infraestructura de terceros (como bases de datos de Google o Render).</li>
          </ul>

          <h2>6. Ley Aplicable y Jurisdicción</h2>
          <p>
            Estos Términos de Servicio se regirán e interpretarán de acuerdo con las leyes vigentes de la República Argentina. Cualquier disputa relacionada con el uso de la plataforma será sometida a la jurisdicción exclusiva de los tribunales competentes.
          </p>

          <h2>7. Modificaciones a los Términos</h2>
          <p>
            Podemos actualizar estos Términos periódicamente. Te notificaremos sobre cambios significativos publicando los nuevos Términos en esta página web. El uso continuo de la plataforma después de la publicación de dichos cambios constituye la aceptación de los nuevos Términos.
          </p>

          <h2>8. Soporte y Contacto</h2>
          <p>
            Si tiene alguna pregunta sobre estos Términos de Servicio, puede comunicarse con nosotros enviando un correo electrónico a <strong>soporte@turnohub.com.ar</strong>.
          </p>
        </div>
      </main>

      <footer className={styles.footer}>
        <p>© 2026 TurnoHub. Todos los derechos reservados.</p>
      </footer>
    </div>
  );
}
