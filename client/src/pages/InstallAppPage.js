import React, { useState, useEffect } from 'react';
import Icon from '../components/Icon';
import styles from './InstallAppPage.module.css';

export default function InstallAppPage() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstallBtn, setShowInstallBtn] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallBtn(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      console.log(`User choice outcome: ${outcome}`);
      setDeferredPrompt(null);
      setShowInstallBtn(false);
    } else {
      alert('Para instalar la aplicación, por favor sigue las instrucciones detalladas a continuación para tu dispositivo.');
    }
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.logo}>
          <span className={`material-symbols-outlined ${styles.logoIcon}`}>hub</span>
          <span className={styles.logoText}>TurnoHub</span>
        </div>
        <h1 className={styles.title}>Cómo instalar la App de TurnoHub</h1>
        <p className={styles.subtitle}>Sigue estos sencillos pasos para tener TurnoHub en la pantalla de inicio de tu celular.</p>
      </header>

      {showInstallBtn && (
        <div className={styles.actionSection}>
          <button onClick={handleInstallClick} className={styles.primaryInstallBtn}>
            <Icon name="download" size={24} color="currentColor" />
            <span>Instalar TurnoHub Ahora</span>
          </button>
        </div>
      )}

      <div className={styles.stepsGrid}>
        {/* Android Card */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <span className="material-symbols-outlined" style={{ color: '#3ddc84', fontSize: '32px' }}>android</span>
            <h2>Android (Google Chrome)</h2>
          </div>
          <ol className={styles.stepList}>
            <li>
              <span className={styles.stepNumber}>1</span>
              <p>Abre el navegador <strong>Google Chrome</strong> en tu celular.</p>
            </li>
            <li>
              <span className={styles.stepNumber}>2</span>
              <p>Accede al sitio web de <strong>TurnoHub</strong> e inicia sesión en tu cuenta.</p>
            </li>
            <li>
              <span className={styles.stepNumber}>3</span>
              <p>Toca el icono de <strong>tres puntos (⋮)</strong> en la esquina superior derecha.</p>
            </li>
            <li>
              <span className={styles.stepNumber}>4</span>
              <p>Selecciona la opción <strong>"Instalar aplicación"</strong> o <strong>"Agregar a la pantalla principal"</strong>.</p>
            </li>
            <li>
              <span className={styles.stepNumber}>5</span>
              <p>Confirma presionando <strong>"Instalar"</strong> o <strong>"Añadir"</strong>. ¡Listo!</p>
            </li>
          </ol>
        </div>

        {/* iOS Card */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <span className="material-symbols-outlined" style={{ color: '#1e293b', fontSize: '32px' }}>apple</span>
            <h2>iOS - iPhone (Safari)</h2>
          </div>
          <ol className={styles.stepList}>
            <li>
              <span className={styles.stepNumber}>1</span>
              <p>Abre el navegador <strong>Safari</strong> en tu iPhone o iPad.</p>
            </li>
            <li>
              <span className={styles.stepNumber}>2</span>
              <p>Accede al sitio web de <strong>TurnoHub</strong> e inicia sesión en tu cuenta.</p>
            </li>
            <li>
              <span className={styles.stepNumber}>3</span>
              <p>Toca el botón de <strong>Compartir</strong> (icono de un cuadro con una flecha hacia arriba 📤) en la barra de navegación inferior.</p>
            </li>
            <li>
              <span className={styles.stepNumber}>4</span>
              <p>Desplázate hacia abajo y selecciona la opción <strong>"Agregar a Inicio"</strong> (con el icono ➕).</p>
            </li>
            <li>
              <span className={styles.stepNumber}>5</span>
              <p>Escribe el nombre de la app (ej: "TurnoHub") y pulsa <strong>"Agregar"</strong> en la esquina superior derecha.</p>
            </li>
          </ol>
        </div>
      </div>

      <footer className={styles.footer}>
        <button onClick={() => window.close()} className={styles.closeTabBtn}>
          Cerrar pestaña
        </button>
      </footer>
    </div>
  );
}
