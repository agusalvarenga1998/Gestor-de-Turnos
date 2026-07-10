import React, { useState, useEffect } from 'react';
import Icon from './Icon';
import styles from './Odontograma.module.css';

// FDI Tooth Numbers:
// Upper Right: 18 to 11 | Upper Left: 21 to 28
// Lower Right: 48 to 41 | Lower Left: 31 to 38
const UPPER_RIGHT = ['18', '17', '16', '15', '14', '13', '12', '11'];
const UPPER_LEFT = ['21', '22', '23', '24', '25', '26', '27', '28'];
const LOWER_RIGHT = ['48', '47', '46', '45', '44', '43', '42', '41'];
const LOWER_LEFT = ['31', '32', '33', '34', '35', '36', '37', '38'];

const INITIAL_TOOTH_STATE = {
  surfaces: {
    vestibular: null, // 'caries' | 'restoration' | null
    lingual: null,
    mesial: null,
    distal: null,
    oclusal: null
  },
  ausente: false,
  corona: false,
  implante: false,
  endodoncia: false,
  notes: ''
};

const TOOLS = [
  { id: 'caries', label: 'Caries (Rojo)', icon: 'edit', colorClass: styles.toolCaries, activeColor: '#ef4444' },
  { id: 'restoration', label: 'Restaurado (Azul)', icon: 'edit', colorClass: styles.toolRestoration, activeColor: '#2563eb' },
  { id: 'corona', label: 'Corona (Dorado)', icon: 'shield', colorClass: styles.toolCorona, activeColor: '#f59e0b' },
  { id: 'implante', label: 'Implante (Verde)', icon: 'plus', colorClass: styles.toolImplant, activeColor: '#10b981' },
  { id: 'endodoncia', label: 'Conducto (Púrpura)', icon: 'list', colorClass: styles.toolEndo, activeColor: '#a855f7' },
  { id: 'ausente', label: 'Ausente/Extracción', icon: 'x', colorClass: styles.toolAusente, activeColor: '#64748b' },
  { id: 'clear', label: 'Limpiar Pieza', icon: 'trash', colorClass: styles.toolClear, activeColor: '#e2e8f0' }
];

export default function Odontograma({ initialData, onSave, patientName }) {
  const [teeth, setTeeth] = useState({});
  const [activeTool, setActiveTool] = useState('caries');
  const [selectedTooth, setSelectedTooth] = useState(null);
  const [generalObservations, setGeneralObservations] = useState('');
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Initialize odontogram state
  useEffect(() => {
    const defaultState = {};
    const allTeeth = [...UPPER_RIGHT, ...UPPER_LEFT, ...LOWER_RIGHT, ...LOWER_LEFT];
    
    allTeeth.forEach(tNum => {
      defaultState[tNum] = JSON.parse(JSON.stringify(INITIAL_TOOTH_STATE));
    });

    if (initialData && initialData.teeth) {
      // Merge initial data
      Object.keys(initialData.teeth).forEach(tNum => {
        if (defaultState[tNum]) {
          defaultState[tNum] = {
            ...defaultState[tNum],
            ...initialData.teeth[tNum],
            surfaces: {
              ...defaultState[tNum].surfaces,
              ...initialData.teeth[tNum].surfaces
            }
          };
        }
      });
      setGeneralObservations(initialData.observations || '');
    } else {
      setGeneralObservations('');
    }
    
    setTeeth(defaultState);
    setSelectedTooth(null);
  }, [initialData]);

  const handleSurfaceClick = (toothNum, surface) => {
    setTeeth(prev => {
      const updated = { ...prev };
      const tooth = { ...updated[toothNum] };
      const surfaces = { ...tooth.surfaces };

      if (activeTool === 'caries') {
        surfaces[surface] = 'caries';
      } else if (activeTool === 'restoration') {
        surfaces[surface] = 'restoration';
      } else if (activeTool === 'clear') {
        surfaces[surface] = null;
      } else {
        // If it's a whole tooth tool, apply it to the whole tooth
        applyWholeToothTool(toothNum, activeTool);
        return prev;
      }

      tooth.surfaces = surfaces;
      updated[toothNum] = tooth;
      return updated;
    });

    // Auto-select tooth to view notes
    setSelectedTooth(toothNum);
  };

  const applyWholeToothTool = (toothNum, tool) => {
    setTeeth(prev => {
      const updated = { ...prev };
      const tooth = { ...updated[toothNum] };

      if (tool === 'corona') {
        tooth.corona = !tooth.corona;
      } else if (tool === 'implante') {
        tooth.implante = !tooth.implante;
      } else if (tool === 'endodoncia') {
        tooth.endodoncia = !tooth.endodoncia;
      } else if (tool === 'ausente') {
        tooth.ausente = !tooth.ausente;
      } else if (tool === 'clear') {
        // Reset everything for this tooth
        updated[toothNum] = JSON.parse(JSON.stringify(INITIAL_TOOTH_STATE));
        return updated;
      }

      updated[toothNum] = tooth;
      return updated;
    });
  };

  const handleToothClick = (toothNum) => {
    setSelectedTooth(toothNum);
    // If a whole tooth tool is active, apply it directly on tooth click
    if (['corona', 'implante', 'endodoncia', 'ausente', 'clear'].includes(activeTool)) {
      applyWholeToothTool(toothNum, activeTool);
    }
  };

  const handleToothNotesChange = (e) => {
    const val = e.target.value;
    setTeeth(prev => {
      const updated = { ...prev };
      const tooth = { ...updated[selectedTooth] };
      tooth.notes = val;
      updated[selectedTooth] = tooth;
      return updated;
    });
  };

  const handlePrint = () => {
    window.print();
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      const dataToSave = {
        teeth,
        observations: generalObservations,
        updatedAt: new Date().toISOString()
      };
      await onSave(dataToSave);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2500);
    } catch (err) {
      console.error('Error saving odontogram:', err);
      alert('Error al guardar el odontograma');
    } finally {
      setIsSaving(false);
    }
  };

  const getSurfaceColor = (toothNum, surface) => {
    const state = teeth[toothNum]?.surfaces?.[surface];
    if (state === 'caries') return '#ef4444'; // Red
    if (state === 'restoration') return '#2563eb'; // Blue
    return '#ffffff'; // White default
  };

  const renderToothSVG = (toothNum) => {
    const tData = teeth[toothNum] || INITIAL_TOOTH_STATE;
    const isSelected = selectedTooth === toothNum;

    return (
      <div 
        className={`${styles.toothWrapper} ${isSelected ? styles.selectedTooth : ''}`}
        onClick={() => handleToothClick(toothNum)}
      >
        <span className={styles.toothNumber}>{toothNum}</span>
        <div className={styles.svgContainer}>
          <svg width="46" height="46" viewBox="0 0 46 46" className={styles.toothSvg}>
            {/* Top: Vestibular */}
            <polygon 
              points="3,3 43,3 33,13 13,13" 
              fill={getSurfaceColor(toothNum, 'vestibular')} 
              stroke="#94a3b8" 
              strokeWidth="1"
              onClick={(e) => { e.stopPropagation(); handleSurfaceClick(toothNum, 'vestibular'); }}
              className={styles.surfacePolygon}
            />
            {/* Right: Distal */}
            <polygon 
              points="43,3 43,43 33,33 33,13" 
              fill={getSurfaceColor(toothNum, 'distal')} 
              stroke="#94a3b8" 
              strokeWidth="1"
              onClick={(e) => { e.stopPropagation(); handleSurfaceClick(toothNum, 'distal'); }}
              className={styles.surfacePolygon}
            />
            {/* Bottom: Lingual */}
            <polygon 
              points="3,43 43,43 33,33 13,33" 
              fill={getSurfaceColor(toothNum, 'lingual')} 
              stroke="#94a3b8" 
              strokeWidth="1"
              onClick={(e) => { e.stopPropagation(); handleSurfaceClick(toothNum, 'lingual'); }}
              className={styles.surfacePolygon}
            />
            {/* Left: Mesial */}
            <polygon 
              points="3,3 3,43 13,33 13,13" 
              fill={getSurfaceColor(toothNum, 'mesial')} 
              stroke="#94a3b8" 
              strokeWidth="1"
              onClick={(e) => { e.stopPropagation(); handleSurfaceClick(toothNum, 'mesial'); }}
              className={styles.surfacePolygon}
            />
            {/* Center: Oclusal */}
            <rect 
              x="13" 
              y="13" 
              width="20" 
              height="20" 
              fill={getSurfaceColor(toothNum, 'oclusal')} 
              stroke="#94a3b8" 
              strokeWidth="1"
              onClick={(e) => { e.stopPropagation(); handleSurfaceClick(toothNum, 'oclusal'); }}
              className={styles.surfacePolygon}
            />

            {/* OVERLAYS FOR WHOLE TOOTH STATUS */}
            {tData.ausente && (
              <>
                <line x1="2" y1="2" x2="44" y2="44" stroke="#ef4444" strokeWidth="4" strokeLinecap="round" />
                <line x1="44" y1="2" x2="2" y2="44" stroke="#ef4444" strokeWidth="4" strokeLinecap="round" />
              </>
            )}

            {tData.endodoncia && (
              <line x1="23" y1="2" x2="23" y2="44" stroke="#a855f7" strokeWidth="4" strokeLinecap="round" strokeDasharray="2,2" />
            )}

            {tData.corona && (
              <rect x="2" y="2" width="42" height="42" fill="none" stroke="#f59e0b" strokeWidth="3.5" rx="3" />
            )}

            {tData.implante && (
              <circle cx="23" cy="23" r="10" fill="none" stroke="#10b981" strokeWidth="4" />
            )}
          </svg>

          {/* Indicators badges */}
          <div className={styles.indicators}>
            {tData.notes && <span className={styles.indicatorNote} title="Tiene notas">📝</span>}
            {tData.corona && <span className={styles.indicatorCorona} title="Corona">👑</span>}
            {tData.implante && <span className={styles.indicatorImplant} title="Implante">🔩</span>}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className={styles.odontogramaContainer}>
      <div className={styles.odontogramaCard}>
        <div className={styles.odontogramaHeader}>
          <div>
            <h3>Ficha Clínica y Odontograma</h3>
            <p className={styles.patientSub}>Paciente: <strong>{patientName}</strong></p>
          </div>
          <div className={styles.headerBtnGroup}>
            <button 
              onClick={handlePrint} 
              className={styles.printBtn}
              type="button"
            >
              <Icon name="printer" size={16} />
              <span>Imprimir Ficha</span>
            </button>
            <button 
              onClick={handleSave} 
              className={`${styles.saveBtn} ${savedSuccess ? styles.saveSuccess : ''}`}
              disabled={isSaving}
              type="button"
            >
              <Icon name={savedSuccess ? "check" : "save"} size={16} />
              <span>{isSaving ? 'Guardando...' : (savedSuccess ? '¡Guardado!' : 'Guardar Odontograma')}</span>
            </button>
          </div>
        </div>

        {/* Toolbar */}
        <div className={styles.toolbar}>
          <span className={styles.toolbarLabel}>Herramienta Clínica:</span>
          <div className={styles.toolsList}>
            {TOOLS.map(tool => (
              <button
                key={tool.id}
                type="button"
                onClick={() => setActiveTool(tool.id)}
                className={`${styles.toolBtn} ${activeTool === tool.id ? styles.activeTool : ''}`}
                style={{
                  borderLeft: activeTool === tool.id ? `4px solid ${tool.activeColor}` : '1px solid #cbd5e1'
                }}
              >
                <div className={`${styles.toolColorIndicator} ${tool.colorClass}`} />
                <span>{tool.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Teeth Grid */}
        <div className={styles.dentalArch}>
          <div className={styles.archRow}>
            <div className={styles.archLabel}>SUPERIOR</div>
            
            {/* Upper Right Quadrant (18-11) */}
            <div className={styles.quadrant}>
              {UPPER_RIGHT.map(tNum => renderToothSVG(tNum))}
            </div>
            
            <div className={styles.midlineDivider} />

            {/* Upper Left Quadrant (21-28) */}
            <div className={styles.quadrant}>
              {UPPER_LEFT.map(tNum => renderToothSVG(tNum))}
            </div>
          </div>

          <div className={styles.horizontalArchDivider} />

          <div className={styles.archRow}>
            <div className={styles.archLabel}>INFERIOR</div>
            
            {/* Lower Right Quadrant (48-41) */}
            <div className={styles.quadrant}>
              {LOWER_RIGHT.map(tNum => renderToothSVG(tNum))}
            </div>
            
            <div className={styles.midlineDivider} />

            {/* Lower Left Quadrant (31-38) */}
            <div className={styles.quadrant}>
              {LOWER_LEFT.map(tNum => renderToothSVG(tNum))}
            </div>
          </div>
        </div>

        {/* General Observations & Selected Tooth Notes */}
        <div className={styles.notesGrid}>
          <div className={styles.observationsBox}>
            <label className={styles.boxLabel}>📋 Observaciones Generales de la Ficha</label>
            <textarea
              className={styles.generalTextarea}
              placeholder="Escribe aquí observaciones generales de la boca, alergias, antecedentes odontológicos..."
              value={generalObservations}
              onChange={(e) => setGeneralObservations(e.target.value)}
            />
          </div>

          <div className={styles.toothNotesBox}>
            {selectedTooth ? (
              <>
                <label className={styles.boxLabel}>
                  🦷 Notas de la Pieza {selectedTooth}
                </label>
                <div className={styles.toothSummary}>
                  <div className={styles.toothStateLabels}>
                    {teeth[selectedTooth]?.ausente && <span className={styles.badgeStateRed}>AUSENTE</span>}
                    {teeth[selectedTooth]?.corona && <span className={styles.badgeStateYellow}>CORONA</span>}
                    {teeth[selectedTooth]?.implante && <span className={styles.badgeStateGreen}>IMPLANTE</span>}
                    {teeth[selectedTooth]?.endodoncia && <span className={styles.badgeStatePurple}>ENDODONCIA</span>}
                  </div>
                  <textarea
                    className={styles.toothTextarea}
                    placeholder={`Escribe anotaciones clínicas específicas para la pieza dental ${selectedTooth}...`}
                    value={teeth[selectedTooth]?.notes || ''}
                    onChange={handleToothNotesChange}
                  />
                </div>
              </>
            ) : (
              <div className={styles.noToothSelected}>
                <Icon name="info" size={32} color="#94a3b8" />
                <p>Haz clic en cualquier diente para ver detalles o registrar notas de esa pieza en particular.</p>
              </div>
            )}
          </div>
        </div>

        {/* Print-only Observations view */}
        <div className={styles.printOnlyNotes}>
          <h4 className={styles.printLabel}>Observaciones Generales:</h4>
          <p className={styles.printText}>{generalObservations || 'Sin observaciones registradas.'}</p>
        </div>

        {/* Print-only list of all tooth notes */}
        <div className={styles.printOnlyToothNotes}>
          <h4 className={styles.printLabel}>Detalles por Pieza Dental:</h4>
          {Object.keys(teeth).filter(tNum => teeth[tNum]?.notes || teeth[tNum]?.ausente || teeth[tNum]?.corona || teeth[tNum]?.implante || teeth[tNum]?.endodoncia || Object.values(teeth[tNum]?.surfaces || {}).some(v => v !== null)).length === 0 ? (
            <p className={styles.printText}>No se registraron tratamientos ni notas específicas en las piezas dentales.</p>
          ) : (
            <div className={styles.printToothList}>
              {Object.keys(teeth).filter(tNum => teeth[tNum]?.notes || teeth[tNum]?.ausente || teeth[tNum]?.corona || teeth[tNum]?.implante || teeth[tNum]?.endodoncia || Object.values(teeth[tNum]?.surfaces || {}).some(v => v !== null)).map(tNum => {
                const tData = teeth[tNum];
                const statusList = [];
                if (tData.ausente) statusList.push('Ausente/Extracción');
                if (tData.corona) statusList.push('Corona');
                if (tData.implante) statusList.push('Implante');
                if (tData.endodoncia) statusList.push('Tratamiento de Conducto');
                
                // Also list surfaces marked
                const surfacesList = [];
                if (tData.surfaces.vestibular) surfacesList.push(`Vestibular (${tData.surfaces.vestibular === 'caries' ? 'Caries' : 'Restaurado'})`);
                if (tData.surfaces.lingual) surfacesList.push(`Lingual (${tData.surfaces.lingual === 'caries' ? 'Caries' : 'Restaurado'})`);
                if (tData.surfaces.mesial) surfacesList.push(`Mesial (${tData.surfaces.mesial === 'caries' ? 'Caries' : 'Restaurado'})`);
                if (tData.surfaces.distal) surfacesList.push(`Distal (${tData.surfaces.distal === 'caries' ? 'Caries' : 'Restaurado'})`);
                if (tData.surfaces.oclusal) surfacesList.push(`Oclusal (${tData.surfaces.oclusal === 'caries' ? 'Caries' : 'Restaurado'})`);
                
                const allStates = [...statusList, ...surfacesList];

                return (
                  <div key={tNum} className={styles.printToothRow}>
                    <strong>Pieza {tNum}:</strong> {allStates.length > 0 ? `[${allStates.join(', ')}] ` : ''}{tData.notes || ''}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
