import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { 
  Lightning, SignOut, CheckCircle, X
} from '@phosphor-icons/react';

interface TechData {
  id: number;
  name: string;
  status: string;
  lat: number;
  lng: number;
}

interface AssignedOrder {
  id: number;
  address: string;
  lat: number;
  lng: number;
  status: string;
}

// Map Helper to Center
function MapCenterer({ coords }: { coords: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (coords) map.flyTo(coords, 16);
  }, [coords, map]);
  return null;
}

// Icons
const techIcon = L.divIcon({
  className: 'custom-marker',
  html: '<div class="marker-pin moving"><i class="ph ph-car"></i><div class="marker-pulse"></div></div>',
  iconSize: [30, 30],
  iconAnchor: [15, 15]
});

const osIcon = L.divIcon({
  className: 'custom-marker',
  html: '<div class="os-marker-pin"><i class="ph-fill ph-wrench"></i></div>',
  iconSize: [30, 30],
  iconAnchor: [15, 15]
});

export default function TechDashboard({ user, onLogout }: { user: any, onLogout: () => void }) {
  const [tech, setTech] = useState<TechData | null>(null);
  const [orders, setOrders] = useState<AssignedOrder[]>([]);
  const [tracking] = useState(true); // Always tracking
  const [currentPos, setCurrentPos] = useState<[number, number] | null>(null);
  const [routeData, setRouteData] = useState<[number, number][] | null>(null);
  const [reportOrder, setReportOrder] = useState<AssignedOrder | null>(null);
  const [equipmentDetails, setEquipmentDetails] = useState('');

  // Fetch technician profile
  useEffect(() => {
    const fetchProfile = async () => {
      const { data, error } = await supabase
        .from('technicians')
        .select('*')
        .eq('user_id', user.id)
        .single();
      
      if (data && !error) {
        setTech(data);
        setCurrentPos([data.lat, data.lng]);
      }
    };
    fetchProfile();
  }, [user.id]);

  // Fetch assigned orders
  useEffect(() => {
    if (!tech) return;
    const fetchOrders = async () => {
      const { data } = await supabase
        .from('service_orders')
        .select('*')
        .eq('assigned_tech_id', tech.id)
        .neq('status', 'completed');
      
      if (data) setOrders(data);
    };
    fetchOrders();

    const channel = supabase
      .channel('tech-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'service_orders', filter: `assigned_tech_id=eq.${tech.id}` }, () => {
        fetchOrders();
      })
      .subscribe();
    
    return () => { supabase.removeChannel(channel); };
  }, [tech?.id]);

  // GPS Tracking
  useEffect(() => {
    if (!tech || !tracking) return;

    const updateLocation = () => {
      if (!navigator.geolocation) return;
      
      navigator.geolocation.getCurrentPosition(async (pos) => {
        const { latitude, longitude } = pos.coords;
        setCurrentPos([latitude, longitude]);
        
        await supabase
          .from('technicians')
          .update({ 
            lat: latitude, 
            lng: longitude, 
            status: 'moving',
            updated_at: new Date() 
          })
          .eq('id', tech.id);
      });
    };

    updateLocation();
    const interval = setInterval(updateLocation, 60000);
    return () => clearInterval(interval);
  }, [tech?.id, tracking]);

  // Routing Logic
  useEffect(() => {
    const acceptedOrder = orders.find(o => o.status === 'accepted');
    if (acceptedOrder && currentPos) {
      const fetchRoute = async () => {
        try {
          const url = `https://router.project-osrm.org/route/v1/driving/${currentPos[1]},${currentPos[0]};${acceptedOrder.lng},${acceptedOrder.lat}?overview=full&geometries=geojson`;
          const res = await fetch(url);
          const data = await res.json();
          if (data.routes && data.routes.length > 0) {
            const coords = data.routes[0].geometry.coordinates.map((c: [number, number]) => [c[1], c[0]] as [number, number]);
            setRouteData(coords);
          }
        } catch (e) { console.error('Error fetching route:', e); }
      };
      fetchRoute();
    } else {
      setRouteData(null);
    }
  }, [orders, currentPos]);

  const handleAcceptOS = async (id: number) => {
    if (!confirm('Deseja ACEITAR esta Ordem de Serviço e ver a rota?')) return;
    const { error } = await supabase
      .from('service_orders')
      .update({ status: 'accepted' })
      .eq('id', id);
    if (error) alert('Erro ao aceitar: ' + error.message);
  };

  const handleCompleteOS = async () => {
    if (!reportOrder || !equipmentDetails.trim()) {
      alert('Por favor, descreva os equipamentos utilizados.');
      return;
    }
    
    const { error } = await supabase
      .from('service_orders')
      .update({ 
        status: 'completed',
        report_notes: equipmentDetails 
      })
      .eq('id', reportOrder.id);
    
    if (error) {
      alert('Erro ao concluir: ' + error.message);
    } else {
      setReportOrder(null);
      setEquipmentDetails('');
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    onLogout();
  };

  if (!tech) return <div className="app-loading glass-panel"><Lightning weight="fill" className="pulse" /> Carregando...</div>;

  return (
    <div className="tech-app">
      {/* Background Map - The only primary UI */}
      <div className="tech-map-container">
        <MapContainer 
          center={currentPos || [-4.4550, -43.8858]} 
          zoom={16} 
          zoomControl={false}
          style={{ width: '100%', height: '100%' }}
        >
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <MapCenterer coords={currentPos} />
          
          {currentPos && <Marker position={currentPos} icon={techIcon} />}
          
          {orders.map(order => (
            <Marker 
              key={order.id} 
              position={[order.lat, order.lng]} 
              icon={osIcon} 
              eventHandlers={{
                click: () => setReportOrder(order)
              }}
            />
          ))}

          {routeData && (
            <Polyline positions={routeData} pathOptions={{ color: 'var(--accent-amber)', weight: 5, opacity: 0.9 }} />
          )}
        </MapContainer>
      </div>

      {/* Discrete Logout Button */}
      <button onClick={handleLogout} className="floating-logout" title="Sair"><SignOut /></button>

      {/* Interactive OS Details Card (Floating Overlay) */}
      {reportOrder && (
        <div className="os-details-overlay">
          <div className="details-card glass-panel">
            <div className="details-header">
              <h3>ORDEM DE SERVIÇO #{reportOrder.id}</h3>
              <button onClick={() => setReportOrder(null)} className="close-btn-minimal"><X /></button>
            </div>
            
            <div className="details-body">
              <div className="info-group">
                <label>Endereço de Atendimento:</label>
                <p>{reportOrder.address}</p>
              </div>

              <div className="info-group">
                <label>Status Atual:</label>
                <span className={`status-tag-small ${reportOrder.status}`}>{reportOrder.status}</span>
              </div>

              {reportOrder.status === 'assigned' ? (
                <div className="details-actions">
                  <p className="hint">Aceite a OS para visualizar a rota otimizada até o local.</p>
                  <button className="btn primary full-width" onClick={() => handleAcceptOS(reportOrder.id)}>
                    <CheckCircle weight="bold" /> ACEITAR CHAMADO
                  </button>
                </div>
              ) : (
                <div className="details-report-area">
                  <label>Relatar Equipamentos Utilizados:</label>
                  <textarea 
                    placeholder="Descreva aqui os materiais usados (Ex: 1 Roteador, 20m fibra...)"
                    value={equipmentDetails}
                    onChange={(e) => setEquipmentDetails(e.target.value)}
                  />
                  <button className="btn primary full-width" onClick={handleCompleteOS}>
                    <CheckCircle weight="bold" /> FINALIZAR ATENDIMENTO
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
