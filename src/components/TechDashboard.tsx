import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import { 
  Lightning, SignOut, MapPin, 
  MapPinLine, Wrench, CheckCircle, Clock, X
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
  const [tracking, setTracking] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [currentPos, setCurrentPos] = useState<[number, number] | null>(null);

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
        
        setLastUpdate(new Date());
      });
    };

    updateLocation();
    const interval = setInterval(updateLocation, 60000);
    return () => clearInterval(interval);
  }, [tech?.id, tracking]);

  const handleCompleteOS = async (id: number) => {
    if (!confirm('Deseja concluir esta Ordem de Serviço?')) return;
    const { error } = await supabase
      .from('service_orders')
      .update({ status: 'completed' })
      .eq('id', id);
    if (error) alert('Erro ao concluir: ' + error.message);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    onLogout();
  };

  if (!tech) return <div className="app-loading glass-panel"><Lightning weight="fill" className="pulse" /> Carregando...</div>;

  return (
    <div className="tech-app">
      {/* Background Map */}
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
            />
          ))}
        </MapContainer>
      </div>

      <header className="tech-ui-header">
        <div className="tech-brand"><Lightning weight="fill" /> FlashOS</div>
        <button onClick={handleLogout} className="action-icon-btn logout"><SignOut /></button>
      </header>

      {/* Floating Status Card */}
      <div className="tech-status-card glass-panel">
        <div className="tech-header-info">
          <div>
            <h2>{tech.name}</h2>
            <p className="tech-status-text">
              <span className={`dot ${tracking ? 'active' : ''}`}></span>
              {tracking ? 'GPS Ativo' : 'GPS Inativo'}
            </p>
          </div>
          <button 
            className={`tech-track-btn ${tracking ? 'active' : ''}`}
            onClick={() => setTracking(!tracking)}
          >
            <MapPinLine weight="bold" />
          </button>
        </div>
        
        {lastUpdate && (
          <div className="last-sync">
            <Clock /> Última sincronização: {lastUpdate.toLocaleTimeString()}
          </div>
        )}
      </div>

      {/* Bottom Sheet for Orders */}
      <div className="tech-bottom-sheet glass-panel">
        <div className="sheet-header">
          <h3><Wrench weight="fill" /> Minhas Ordens ({orders.length})</h3>
        </div>
        <div className="tech-orders-list">
          {orders.length === 0 ? (
            <div className="empty-msg">Nenhuma OS pendente.</div>
          ) : (
            orders.map(order => (
              <div key={order.id} className="tech-order-card">
                <div className="order-main">
                  <div className="order-texts">
                    <strong>OS #{order.id}</strong>
                    <p>{order.address}</p>
                  </div>
                  <button className="btn-finish" onClick={() => handleCompleteOS(order.id)}>
                    <CheckCircle weight="fill" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
