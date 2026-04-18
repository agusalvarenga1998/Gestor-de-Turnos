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

// Icono personalizado con fallback por si falla la red
const doctorIcon = new L.Icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/2750/2750657.png', // Icono de mapa médico
  iconSize: [45, 45],
  iconAnchor: [22, 45],
  popupAnchor: [0, -45],
  className: 'doctor-marker'
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
