import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import DoctorLayout from '../components/DoctorLayout';
import Icon from '../components/Icon';
import Loading from '../components/Loading';
import { patientAPI, patientRecordAPI } from '../services/api';
import styles from './PatientHistoryPage.module.css';

export default function PatientHistoryPage() {
  const { patientId } = useParams();
  const navigate = useNavigate();
  const [patient, setPatient] = useState(null);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  const [formData, setFormData] = useState({
    type: 'note',
    title: '',
    content: ''
  });
  const [selectedFile, setSelectedFile] = useState(null);
  const fileInputRef = useRef(null);
  const [viewerModal, setViewerModal] = useState({ show: false, file: null, type: null });

  useEffect(() => {
    fetchData();
  }, [patientId]);

  const getAbsoluteUrl = (fileUrl) => {
    if (!fileUrl) return '';
    if (fileUrl.startsWith('http')) return fileUrl;
    
    // Si estamos en producción (Render/Dominio Propio), necesitamos apuntar al backend explícitamente
    const apiBase = process.env.REACT_APP_API_BASE_URL || 
                    (window.location.hostname.includes('onrender.com') || window.location.hostname.includes('turnohub.com.ar')
                      ? 'https://consultorio-backend-r2su.onrender.com' 
                      : '');
    
    return `${apiBase}${fileUrl}`;
  };

  const openViewer = (fileUrl, type) => {
    const absoluteUrl = getAbsoluteUrl(fileUrl);
    setViewerModal({ show: true, file: absoluteUrl, type });
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const [patientRes, recordsRes] = await Promise.all([
        patientAPI.getPatient(patientId),
        patientRecordAPI.getRecords(patientId)
      ]);

      if (patientRes.success) {
        setPatient(patientRes.patient);
      }
      if (recordsRes.success) {
        setRecords(recordsRes.records);
      }
    } catch (err) {
      console.error('Error cargando historial:', err);
      setError('No se pudo cargar la información del paciente');
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e) => {
    setSelectedFile(e.target.files[0]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title && !selectedFile) {
      alert('Por favor ingresa un título o selecciona un archivo');
      return;
    }

    try {
      setUploading(true);
      const data = new FormData();
      data.append('type', formData.type);
      data.append('title', formData.title || (selectedFile ? selectedFile.name : 'Nota'));
      data.append('content', formData.content);
      if (selectedFile) {
        data.append('file', selectedFile);
      }

      const response = await patientRecordAPI.createRecord(patientId, data);

      if (response.success) {
        setRecords([response.record, ...records]);
        setShowAddModal(false);
        setFormData({ type: 'note', title: '', content: '' });
        setSelectedFile(null);
      }
    } catch (err) {
      console.error('Error guardando registro:', err);
      alert('Error al guardar el registro');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (recordId) => {
    if (!window.confirm('¿Estás seguro de eliminar este registro?')) return;

    try {
      const response = await patientRecordAPI.deleteRecord(recordId);
      if (response.success) {
        setRecords(records.filter(r => r.id !== recordId));
      }
    } catch (err) {
      console.error('Error eliminando registro:', err);
      alert('Error al eliminar el registro');
    }
  };

  if (loading) return <DoctorLayout><Loading /></DoctorLayout>;
  if (error) return <DoctorLayout><div className={styles.error}>{error}</div></DoctorLayout>;

  return (
    <DoctorLayout>
      <div className={styles.container}>
        <div className={styles.header}>
          <button onClick={() => navigate('/patients')} className={styles.backBtn}>
            <Icon name="arrow-left" size={20} />
            Volver a Clientes
          </button>
          <div className={styles.patientProfile}>
            <div className={styles.avatar}>
              {patient?.name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
            </div>
            <div className={styles.info}>
              <h1>{patient?.name}</h1>
              <p>{patient?.document_number ? `DNI: ${patient.document_number}` : 'Sin DNI'} • {patient?.phone}</p>
            </div>
          </div>
          <button onClick={() => setShowAddModal(true)} className={styles.addBtn}>
            <Icon name="plus" size={18} />
            Nuevo Registro
          </button>
        </div>

        <div className={styles.timeline}>
          {records.length === 0 ? (
            <div className={styles.empty}>
              <Icon name="folder-open" size={48} color="#cbd5e1" />
              <p>No hay registros en el historial de este paciente</p>
              <button onClick={() => setShowAddModal(true)} className={styles.secondaryBtn}>
                Comenzar historial
              </button>
            </div>
          ) : (
            records.map((record) => (
              <div key={record.id} className={styles.recordCard}>
                <div className={styles.recordIcon}>
                  <Icon 
                    name={record.type === 'note' ? 'file-text' : record.type === 'image' ? 'image' : 'file'} 
                    size={24} 
                  />
                </div>
                <div className={styles.recordContent}>
                  <div className={styles.recordHeader}>
                    <h3>{record.title}</h3>
                    <div className={styles.recordMeta}>
                      <span>{new Date(record.created_at).toLocaleString('es-ES')}</span>
                      <button onClick={() => handleDelete(record.id)} className={styles.deleteBtn}>
                        <Icon name="trash-2" size={16} />
                        Eliminar
                      </button>
                    </div>
                  </div>
                  
                  {record.content && <p className={styles.textContent}>{record.content}</p>}
                  
                  {record.file_path && (
                    <div className={styles.fileAttachment}>
                      {record.type === 'image' ? (
                        <div className={styles.imagePreview}>
                          <img 
                            src={getAbsoluteUrl(record.file_path)} 
                            alt={record.file_name} 
                            onClick={() => openViewer(record.file_path, 'image')}
                            style={{ cursor: 'zoom-in' }}
                          />
                          <button onClick={() => openViewer(record.file_path, 'image')} className={styles.viewBtn}>
                            Ver imagen completa
                          </button>
                        </div>
                      ) : (
                        <div className={styles.fileBox}>
                          <Icon name="file" size={20} />
                          <span>{record.file_name}</span>
                          <button onClick={() => openViewer(record.file_path, record.file_type)} className={styles.viewBtn}>
                            Ver documento
                          </button>
                          <a href={getAbsoluteUrl(record.file_path)} download={record.file_name} className={styles.downloadLink}>
                            Descargar
                          </a>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Modal para añadir registro */}
        {showAddModal && (
          <div className={styles.modalOverlay}>
            <div className={styles.modal}>
              <div className={styles.modalHeader}>
                <h2>Añadir al Historial</h2>
                <button onClick={() => setShowAddModal(false)} className={styles.closeBtn}>
                  <Icon name="x" size={24} />
                </button>
              </div>
              
              <form onSubmit={handleSubmit} className={styles.form}>
                <div className={styles.formGroup}>
                  <label>Tipo de Registro</label>
                  <div className={styles.typeSelector}>
                    <button 
                      type="button" 
                      className={formData.type === 'note' ? styles.activeType : ''}
                      onClick={() => setFormData({...formData, type: 'note'})}
                    >
                      <Icon name="file-text" size={16} /> Nota
                    </button>
                    <button 
                      type="button" 
                      className={formData.type === 'document' ? styles.activeType : ''}
                      onClick={() => setFormData({...formData, type: 'document'})}
                    >
                      <Icon name="file" size={16} /> Documento
                    </button>
                    <button 
                      type="button" 
                      className={formData.type === 'image' ? styles.activeType : ''}
                      onClick={() => setFormData({...formData, type: 'image'})}
                    >
                      <Icon name="image" size={16} /> Imagen
                    </button>
                  </div>
                </div>

                <div className={styles.formGroup}>
                  <label>Título / Descripción Corta</label>
                  <input 
                    type="text" 
                    value={formData.title}
                    onChange={(e) => setFormData({...formData, title: e.target.value})}
                    placeholder="Ej: Resultados análisis de sangre"
                  />
                </div>

                <div className={styles.formGroup}>
                  <label>Contenido / Observaciones</label>
                  <textarea 
                    value={formData.content}
                    onChange={(e) => setFormData({...formData, content: e.target.value})}
                    placeholder="Escribe notas adicionales aquí..."
                    rows={4}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label>Archivo (Opcional)</label>
                  <div className={styles.fileUpload}>
                    <input 
                      type="file" 
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      className={styles.hiddenInput}
                    />
                    <button 
                      type="button" 
                      onClick={() => fileInputRef.current.click()}
                      className={styles.uploadBtn}
                    >
                      <Icon name="upload" size={18} />
                      {selectedFile ? selectedFile.name : 'Seleccionar archivo'}
                    </button>
                    {selectedFile && (
                      <button type="button" onClick={() => setSelectedFile(null)} className={styles.clearFile}>
                        <Icon name="x" size={14} />
                      </button>
                    )}
                  </div>
                  <small>Formatos permitidos: PDF, Imágenes, DOC, TXT. Máx 10MB.</small>
                </div>

                <div className={styles.modalActions}>
                  <button type="submit" disabled={uploading} className={styles.submitBtn}>
                    {uploading ? 'Guardando...' : 'Guardar Registro'}
                  </button>
                  <button type="button" onClick={() => setShowAddModal(false)} className={styles.cancelBtn}>
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Visor de Archivos */}
        {viewerModal.show && (
          <div className={styles.viewerOverlay} onClick={() => setViewerModal({ show: false, file: null, type: null })}>
            <div className={styles.viewerContent} onClick={e => e.stopPropagation()}>
              <div className={styles.viewerHeader}>
                <button onClick={() => setViewerModal({ show: false, file: null, type: null })} className={styles.closeViewer}>
                  <Icon name="x" size={24} />
                </button>
              </div>
              <div className={styles.viewerBody}>
                {viewerModal.type === 'image' ? (
                  <img src={viewerModal.file} alt="Visualización" className={styles.fullImage} />
                ) : viewerModal.file?.toLowerCase().endsWith('.pdf') || viewerModal.type?.includes('pdf') ? (
                  <iframe src={viewerModal.file} title="Document Viewer" className={styles.pdfViewer} />
                ) : (
                  <div className={styles.unsupportedViewer}>
                    <Icon name="file" size={64} />
                    <p>Este tipo de archivo no se puede previsualizar directamente.</p>
                    <a href={viewerModal.file} download className={styles.addBtn}>Descargar Archivo</a>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </DoctorLayout>
  );
}
