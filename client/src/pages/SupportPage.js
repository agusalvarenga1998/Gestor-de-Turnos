import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../components/Icon';
import styles from './SupportPage.module.css';

export default function SupportPage() {
  const [sent, setSent] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setSent(true);
  };

  return (
    <div className={styles.container}>
      {/* Navbar Minimalista */}
      <nav className={styles.navbar}>
        <div className={styles.navContent}>
          <Link to="/login" className={styles.logo}>
            <img src="/logo_turnohub.png" alt="T" />
            <span>TurnoHub Support</span>
          </Link>
          <Link to="/login" className={styles.backLink}>Regresar</Link>
        </div>
      </nav>

      <main className={styles.main}>
        <div className={styles.layout}>
          {/* Columna Izquierda: Formulario */}
          <section className={styles.formSection}>
            <div className={styles.intro}>
              <h1>Contacta con nosotros</h1>
              <p>¿Tienes alguna duda técnica o comercial? Nuestro equipo de expertos está listo para ayudarte.</p>
            </div>

            {sent ? (
              <div className={styles.successCard}>
                <div className={styles.successIcon}>✓</div>
                <h2>¡Mensaje enviado!</h2>
                <p>Hemos recibido tu consulta. Un miembro de nuestro equipo te contactará en las próximas 24 horas.</p>
                <button onClick={() => setSent(false)} className={styles.resetBtn}>Enviar otro mensaje</button>
              </div>
            ) : (
              <form className={styles.form} onSubmit={handleSubmit}>
                <div className={styles.row}>
                  <div className={styles.group}>
                    <label>Nombre Completo</label>
                    <input type="text" placeholder="Ej: Dr. Juan Pérez" required />
                  </div>
                  <div className={styles.group}>
                    <label>Email Profesional</label>
                    <input type="email" placeholder="juan@clinica.com" required />
                  </div>
                </div>

                <div className={styles.group}>
                  <label>Asunto</label>
                  <select required>
                    <option value="">Selecciona una opción</option>
                    <option value="tech">Problema Técnico</option>
                    <option value="billing">Facturación</option>
                    <option value="sales">Información sobre Planes</option>
                    <option value="other">Otro</option>
                  </select>
                </div>

                <div className={styles.group}>
                  <label>Mensaje</label>
                  <textarea rows="5" placeholder="Cuéntanos en qué podemos ayudarte..." required></textarea>
                </div>

                <button type="submit" className={styles.submitBtn}>Enviar consulta</button>
              </form>
            )}
          </section>

          {/* Columna Derecha: Canales Directos */}
          <aside className={styles.infoSection}>
            <div className={styles.infoCard}>
              <h3>Canales Directos</h3>
              
              <div className={styles.contactItem}>
                <div className={styles.iconCircle}><Icon name="mail" size={20} color="#2563eb" /></div>
                <div>
                  <h4>Correo Electrónico</h4>
                  <p>soporte@turnohub.com</p>
                </div>
              </div>

              <div className={styles.contactItem}>
                <div className={styles.iconCircle}>💬</div>
                <div>
                  <h4>WhatsApp Soporte</h4>
                  <p>+54 9 11 1234-5678</p>
                </div>
              </div>

              <div className={styles.contactItem}>
                <div className={styles.iconCircle}><Icon name="calendar" size={20} color="#2563eb" /></div>
                <div>
                  <h4>Horario de Atención</h4>
                  <p>Lunes a Viernes: 09:00 - 18:00</p>
                  <p>Sábados: 09:00 - 13:00</p>
                </div>
              </div>
            </div>

            <div className={styles.statusCard}>
              <div className={styles.statusDot}></div>
              <span>Todos los sistemas operativos</span>
            </div>
          </aside>
        </div>
      </main>

      <footer className={styles.footer}>
        <p>© 2026 TurnoHub Global Support center.</p>
      </footer>
    </div>
  );
}
