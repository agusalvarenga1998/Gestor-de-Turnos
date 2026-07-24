import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Reparación de Iconos Estándares de Leaflet (Indispensable para React)
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: markerIcon2x,
    iconUrl: markerIcon,
    shadowUrl: markerShadow,
});

// Icono de pin azul con letras TH en blanco
const doctorIcon = L.divIcon({
  className: 'th-custom-marker',
  html: `
    <div style="width: 38px; height: 50px; position: relative; cursor: pointer;">
      <svg width="38" height="50" viewBox="0 0 38 50" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0px 4px 8px rgba(0,0,0,0.35));">
        <path d="M19 0C8.50659 0 0 8.50659 0 19C0 31.5 19 50 19 50C19 50 38 31.5 38 19C38 8.50659 29.4934 0 19 0Z" fill="#2563eb" stroke="#ffffff" stroke-width="2.5"/>
        <circle cx="19" cy="19" r="12.5" fill="#1d4ed8" />
        <text x="19" y="20.5" font-family="Arial, Helvetica, sans-serif" font-weight="900" font-size="14" fill="#ffffff" text-anchor="middle" dominant-baseline="central" letter-spacing="-0.5px">TH</text>
      </svg>
    </div>
  `,
  iconSize: [38, 50],
  iconAnchor: [19, 50],
  popupAnchor: [0, -50]
});

function MapController({ doctors, userLocation }) {
  const map = useMap();

  useEffect(() => {
    const doctorPoints = [];
    doctors.forEach(doc => {
      const lat = parseFloat(doc.latitude);
      const lng = parseFloat(doc.longitude);
      if (!isNaN(lat) && !isNaN(lng)) {
        doctorPoints.push([lat, lng]);
      }
    });

    if (doctorPoints.length > 0) {
      console.log(`🎯 Centrando mapa en ${doctorPoints.length} médicos...`);
      if (doctorPoints.length === 1) {
        // Si hay un solo médico, volar directo a él con zoom 16
        map.setView(doctorPoints[0], 16, { animate: true });
      } else {
        // Si hay varios, encuadrar a todos los médicos
        const bounds = L.latLngBounds(doctorPoints);
        map.fitBounds(bounds, { padding: [50, 50], animate: true });
      }
    } else if (userLocation) {
      // SOLO si no hay médicos en esa especialidad, mostrar la ubicación del usuario
      map.setView([userLocation.lat, userLocation.lng], 13, { animate: true });
    }
  }, [doctors, userLocation, map]);

  return null;
}

export default function DoctorMap({ doctors, onSelectDoctor, userLocation }) {
  const mapKey = `map-${doctors.length}-${doctors.map(d => d.id).join('')}`;

  return (
    <div 
      key={mapKey}
      style={{ 
        height: '500px', 
        width: '100%', 
        borderRadius: '20px', 
        overflow: 'hidden', 
        border: '3px solid #3b82f6',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
        position: 'relative'
      }}
    >
      <MapContainer 
        center={[-34.6037, -58.3816]} 
        zoom={13} 
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        
        <MapController doctors={doctors} userLocation={userLocation} />

        {userLocation && (
          <Marker position={[userLocation.lat, userLocation.lng]}>
            <Popup>Tu ubicación</Popup>
          </Marker>
        )}

        {doctors.map((doc) => {
          const lat = parseFloat(doc.latitude);
          const lng = parseFloat(doc.longitude);
          
          if (!isNaN(lat) && !isNaN(lng)) {
            return (
              <Marker 
                key={`doctor-pin-${doc.id}`} 
                position={[lat, lng]} 
                icon={doctorIcon}
              >
                <Popup>
                  <div style={{ textAlign: 'center', padding: '10px' }}>
                    <h3 style={{ margin: '0', color: '#1e40af' }}>Dr. {doc.name}</h3>
                    <p style={{ color: '#6b7280', margin: '5px 0' }}>{doc.clinic_name}</p>
                    <button 
                      onClick={() => onSelectDoctor(doc.id)}
                      style={{
                        marginTop: '10px',
                        padding: '8px 15px',
                        background: '#3b82f6',
                        color: 'white',
                        border: 'none',
                        borderRadius: '5px',
                        cursor: 'pointer',
                        fontWeight: 'bold'
                      }}
                    >
                      SELECCIONAR
                    </button>
                  </div>
                </Popup>
              </Marker>
            );
          }
          return null;
        })}
      </MapContainer>
    </div>
  );
}
