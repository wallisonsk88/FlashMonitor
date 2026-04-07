import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { 
  Lightning, SignOut, MapPin, 
  MapPinLine, Wrench, CheckCircle, Clock 
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
  status: string;
}

export default function TechDashboard({ user, onLogout }: { user: any, onLogout: () => void }) {
  const [tech, setTech] = useState<TechData | null>(null);
  const [orders, setOrders] = useState<AssignedOrder[]>([]);
  const [tracking, setTracking] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  // Fetch technician profile linked to this user
  useEffect(() => {
    const fetchProfile = async () => {
      const { data, error } = await supabase
        .from('technicians')
        .select('*')
        .eq('user_id', user.id)
        .single();
      
      if (data && !error) {
        setTech(data);
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

  // Real-time tracking logic (1 minute interval)
  useEffect(() => {
    if (!tech || !tracking) return;

    const updateLocation = () => {
      if (!navigator.geolocation) return;
      
      navigator.geolocation.getCurrentPosition(async (pos) => {
        const { latitude, longitude } = pos.coords;
        const { error } = await supabase
          .from('technicians')
          .update({ 
            lat: latitude, 
            lng: longitude, 
            status: 'moving',
            updated_at: new Date() 
          })
          .eq('id', tech.id);
        
        if (!error) setLastUpdate(new Date());
      });
    };

    updateLocation();
    const interval = setInterval(updateLocation, 60000); // 1 minute
    
    return () => clearInterval(interval);
  }, [tech?.id, tracking]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    onLogout();
  };

  if (!tech) return <div className="tech-loading">Carregando perfil...</div>;

  return (
    <div className="tech-app">
      <header className="tech-header glass-panel">
        <div className="tech-brand"><Lightning weight="fill" /> FlashOS</div>
        <button onClick={handleLogout} className="logout-btn"><SignOut /></button>
      </header>

      <main className="tech-main">
        <div className="tech-info-card glass-panel">
          <div className="tech-user">
            <span className="profile-label">Técnico Logado</span>
            <h2>{tech.name}</h2>
          </div>
          <div className="tech-actions">
            <button 
              className={`tracking-toggle ${tracking ? 'active' : ''}`}
              onClick={() => setTracking(!tracking)}
            >
              <MapPinLine weight={tracking ? "fill" : "regular"} />
              {tracking ? 'Rastreamento Ativado' : 'Iniciar Rastreamento'}
            </button>
            {lastUpdate && (
              <p className="update-msg">
                <Clock /> Última atualização: {lastUpdate.toLocaleTimeString()}
              </p>
            )}
          </div>
        </div>

        <section className="tech-status-grid">
          <div className="status-kpi glass-panel">
            <MapPin weight="fill" />
            <span>{tracking ? 'Online' : 'Offline'}</span>
            <label>Conexão GPS</label>
          </div>
          <div className="status-kpi glass-panel">
            <Wrench weight="fill" />
            <span>{orders.length}</span>
            <label>Minhas OS</label>
          </div>
        </section>

        <section className="tech-orders-section">
          <h3>MINHAS ORDENS DE SERVIÇO</h3>
          <div className="orders-list">
            {orders.length === 0 ? (
              <div className="empty-orders">Nenhuma OS atribuída.</div>
            ) : (
              orders.map(order => (
                <div key={order.id} className="order-item glass-panel">
                  <div className="order-details">
                    <span className="order-id">#OS {order.id}</span>
                    <p>{order.address}</p>
                    <span className={`status-tag ${order.status}`}>{order.status}</span>
                  </div>
                  <button className="btn-done"><CheckCircle /></button>
                </div>
              ))
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
