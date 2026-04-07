import { useState, useEffect, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import { supabase } from '../supabaseClient';
import {
  Lightning, Plus, X, Speedometer, NavigationArrow,
  ClockCounterClockwise, MagicWand, MapPinPlus,
  MagnifyingGlass, Crosshair, Check, User, Wrench
} from '@phosphor-icons/react';

// === TYPES ===
interface Tech {
  id: number;
  name: string;
  status: 'moving' | 'idle' | 'offline';
  lat: number;
  lng: number;
  speed: number;
  dest: string;
}

interface ServiceOrder {
  id: number;
  address: string;
  lat: number;
  lng: number;
  status: string;
}

// === ICONS ===
function getTechIconHtml(status: string) {
  const iconClass = status === 'offline' ? 'ph-user-minus' : 'ph-car';
  return '<div class="marker-pin ' + status + '"><i class="ph ' + iconClass + '"></i><div class="marker-pulse"></div></div>';
}

function getOsIconHtml() {
  return '<div class="os-marker-pin"><i class="ph-fill ph-wrench"></i></div>';
}

function createIcon(html: string) {
  return L.divIcon({ className: 'custom-marker', html, iconSize: [30, 30], iconAnchor: [15, 15] });
}

// Fallback demo data (used only when Supabase tables are empty)
const DEMO_TECHS: Tech[] = [
  { id: -1, name: 'Carlos Silva', status: 'moving', lat: -23.55052, lng: -46.633308, speed: 45, dest: 'Av. Paulista, 1000' },
  { id: -2, name: 'Marcos Santos', status: 'idle', lat: -23.5615, lng: -46.6559, speed: 0, dest: 'R. Augusta, 500' },
  { id: -3, name: 'Ana Oliveira', status: 'moving', lat: -23.5411, lng: -46.6433, speed: 60, dest: 'Centro' },
  { id: -4, name: 'João Souza', status: 'offline', lat: -23.5822, lng: -46.6833, speed: 0, dest: 'Base' }
];

// === MAP HELPERS ===
function MapController({ focusTo }: { focusTo: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (focusTo) map.flyTo(focusTo, 15, { animate: true, duration: 1 });
  }, [focusTo, map]);
  return null;
}

function MapClickHandler({ onMapClick, active }: { onMapClick: (lat: number, lng: number) => void; active: boolean }) {
  useMapEvents({
    click(e) {
      if (active) onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

// === MAIN COMPONENT ===
export default function MapDashboard() {
  const [techs, setTechs] = useState<Tech[]>([]);
  const [osList, setOsList] = useState<ServiceOrder[]>([]);
  const [selectedTech, setSelectedTech] = useState<Tech | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [focusCoord, setFocusCoord] = useState<[number, number] | null>(null);
  const [dbConnected, setDbConnected] = useState(false);

  // OS Panel State
  const [showOsPanel, setShowOsPanel] = useState(false);
  const [osAddress, setOsAddress] = useState('');
  const [osStatusMsg, setOsStatusMsg] = useState('');
  const [isManualMode, setIsManualMode] = useState(false);
  const [pendingOsCoord, setPendingOsCoord] = useState<[number, number] | null>(null);

  // === SUPABASE: Initial fetch ===
  const fetchTechs = useCallback(async () => {
    const { data, error } = await supabase.from('technicians').select('*');
    if (!error && data && data.length > 0) {
      setTechs(data as Tech[]);
      setDbConnected(true);
    } else {
      // Fallback to demo data if DB is empty or error
      setTechs(DEMO_TECHS);
      setDbConnected(false);
    }
  }, []);

  const fetchOrders = useCallback(async () => {
    const { data, error } = await supabase.from('service_orders').select('*').eq('status', 'pending');
    if (!error && data) {
      setOsList(data as ServiceOrder[]);
    }
  }, []);

  useEffect(() => {
    fetchTechs();
    fetchOrders();
  }, [fetchTechs, fetchOrders]);

  // === SUPABASE: Realtime Subscriptions ===
  useEffect(() => {
    const techChannel = supabase
      .channel('technicians-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'technicians' }, (payload) => {
        if (payload.eventType === 'UPDATE') {
          const updated = payload.new as Tech;
          setTechs(prev => prev.map(t => t.id === updated.id ? { ...t, ...updated } : t));
        } else if (payload.eventType === 'INSERT') {
          setTechs(prev => [...prev, payload.new as Tech]);
        } else if (payload.eventType === 'DELETE') {
          const deleted = payload.old as { id: number };
          setTechs(prev => prev.filter(t => t.id !== deleted.id));
        }
      })
      .subscribe();

    const osChannel = supabase
      .channel('service-orders-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'service_orders' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setOsList(prev => [...prev, payload.new as ServiceOrder]);
        } else if (payload.eventType === 'UPDATE') {
          const updated = payload.new as ServiceOrder;
          if (updated.status !== 'pending') {
            setOsList(prev => prev.filter(o => o.id !== updated.id));
          } else {
            setOsList(prev => prev.map(o => o.id === updated.id ? { ...o, ...updated } : o));
          }
        } else if (payload.eventType === 'DELETE') {
          const deleted = payload.old as { id: number };
          setOsList(prev => prev.filter(o => o.id !== deleted.id));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(techChannel);
      supabase.removeChannel(osChannel);
    };
  }, []);

  // === Simulation for DEMO mode (only when DB is not connected) ===
  useEffect(() => {
    if (dbConnected) return;
    const interval = setInterval(() => {
      setTechs(prev => prev.map(t => {
        if (t.status === 'moving') {
          const newLat = t.lat + (Math.random() - 0.5) * 0.001;
          const newLng = t.lng + (Math.random() - 0.5) * 0.001;
          return { ...t, lat: newLat, lng: newLng, speed: Math.floor(Math.random() * 35 + 30) };
        }
        return t;
      }));
    }, 3000);
    return () => clearInterval(interval);
  }, [dbConnected]);

  // === HANDLERS ===
  const handleTechClick = (tech: Tech) => {
    setSelectedTech(tech);
    setFocusCoord([tech.lat, tech.lng]);
    setShowHistory(false);
  };

  const handleApiSearch = async () => {
    if (!osAddress) { setOsStatusMsg('Digite um endereço válido.'); return; }
    setOsStatusMsg('Buscando...');
    try {
      const url = 'https://nominatim.openstreetmap.org/search?format=json&q=' + encodeURIComponent(osAddress);
      const res = await fetch(url);
      const data = await res.json();
      if (data && data.length > 0) {
        const lat = parseFloat(data[0].lat);
        const lon = parseFloat(data[0].lon);
        setOsStatusMsg('Local encontrado!');
        setPendingOsCoord([lat, lon]);
        setFocusCoord([lat, lon]);
        setIsManualMode(false);
      } else {
        setOsStatusMsg('Endereço não encontrado. Use a busca manual.');
      }
    } catch {
      setOsStatusMsg('Erro na API.');
    }
  };

  const confirmOsCreation = async () => {
    if (!pendingOsCoord) return;

    if (dbConnected) {
      const { error } = await supabase.from('service_orders').insert({
        address: osAddress || 'Manual',
        lat: pendingOsCoord[0],
        lng: pendingOsCoord[1],
        status: 'pending'
      });
      if (error) {
        alert('Erro ao salvar: ' + error.message);
        return;
      }
    } else {
      // Demo fallback
      setOsList(prev => [...prev, { id: Date.now(), address: osAddress || 'Manual', lat: pendingOsCoord[0], lng: pendingOsCoord[1], status: 'pending' }]);
    }

    alert('Ordem de Serviço criada com sucesso!');
    setPendingOsCoord(null);
    setShowOsPanel(false);
    setOsAddress('');
  };

  const techStatusLabel = (s: string) => s === 'moving' ? 'Em Rota' : s === 'idle' ? 'Parado' : 'Offline';

  // === RENDER ===
  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', overflow: 'hidden' }} className={isManualMode ? 'map-crosshair' : ''}>
      {/* Map */}
      <MapContainer center={[-23.55052, -46.633308]} zoom={13} zoomControl={false} style={{ width: '100%', height: '100%', position: 'absolute', zIndex: 1 }}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap" />
        <MapController focusTo={focusCoord} />
        <MapClickHandler active={isManualMode} onMapClick={(lat, lng) => { setPendingOsCoord([lat, lng]); setIsManualMode(false); setOsStatusMsg('Local marcado manualmente!'); }} />

        {techs.map(t => (
          <Marker key={t.id} position={[t.lat, t.lng]} icon={createIcon(getTechIconHtml(t.status))} eventHandlers={{ click: () => handleTechClick(t) }} />
        ))}

        {showHistory && selectedTech && (
          <Polyline positions={[[selectedTech.lat, selectedTech.lng]]} pathOptions={{ color: '#ff2a2a', weight: 4, dashArray: '10, 10' }} />
        )}

        {pendingOsCoord && <Marker position={pendingOsCoord} icon={createIcon(getOsIconHtml())} />}

        {osList.map(os => (
          <Marker key={os.id} position={[os.lat, os.lng]} icon={createIcon(getOsIconHtml())} />
        ))}
      </MapContainer>

      {/* KPI Cards */}
      <div className="kpi-container" style={{ zIndex: 100 }}>
        <div className="kpi-card glass-panel">
          <Lightning weight="fill" />
          <div className="kpi-info">
            <span className="kpi-value">{techs.filter(t => t.status !== 'offline').length}</span>
            <span className="kpi-label">Online</span>
          </div>
        </div>
        <div className="kpi-card glass-panel accent">
          <Wrench weight="fill" />
          <div className="kpi-info">
            <span className="kpi-value">{osList.length}</span>
            <span className="kpi-label">OS Pendentes</span>
          </div>
        </div>
      </div>

      {/* Connection Status */}
      <div style={{ position: 'absolute', bottom: 24, right: 24, zIndex: 100, fontSize: '0.7rem', color: dbConnected ? '#4ade80' : '#f59e0b', display: 'flex', alignItems: 'center', gap: 6 }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: dbConnected ? '#4ade80' : '#f59e0b' }}></div>
        {dbConnected ? 'Supabase Conectado' : 'Modo Demo (execute o SQL no Supabase)'}
      </div>

      {/* Sidebar */}
      <aside className="sidebar glass-panel" style={{ zIndex: 100 }}>
        <header className="sidebar-header">
          <div className="header-top">
            <h2><Lightning weight="fill" /> FlashOS</h2>
            <button className="btn primary small-btn" onClick={() => { setShowOsPanel(true); setOsStatusMsg(''); setIsManualMode(false); setPendingOsCoord(null); }}>
              <Plus /> Nova OS
            </button>
          </div>
          <p>Rastreamento Tempo Real</p>
        </header>
        <div className="search-bar">
          <MagnifyingGlass />
          <input type="text" placeholder="Buscar técnico..." />
        </div>
        <div className="tech-list" id="tech-list">
          {techs.map(t => {
            const isSelected = selectedTech?.id === t.id;
            return (
              <div key={t.id} className={'tech-item' + (isSelected ? ' selected' : '')} onClick={() => handleTechClick(t)}>
                <div className="tech-avatar">
                  <User />
                  <div className={'tech-status-dot status-' + t.status}></div>
                </div>
                <div className="tech-details">
                  <div className="tech-name">{t.name}</div>
                  <div className="tech-meta">
                    <span>{techStatusLabel(t.status)}</span>
                    {t.status !== 'offline' && <span>• {t.speed} km/h</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </aside>

      {/* Action Panel */}
      {selectedTech && !showOsPanel && (
        <div className="action-panel glass-panel" style={{ zIndex: 100 }}>
          <div className="action-header">
            <h3>{selectedTech.name}</h3>
            <button onClick={() => { setSelectedTech(null); setShowHistory(false); }} className="close-btn"><X /></button>
          </div>
          <div className="action-content">
            <p className={'status-badge ' + selectedTech.status}>{techStatusLabel(selectedTech.status)}</p>
            <p className="data-row"><Speedometer /> <span>{techs.find(t => t.id === selectedTech.id)?.speed} km/h</span></p>
            <p className="data-row"><NavigationArrow /> Destino: <span>{selectedTech.dest}</span></p>
          </div>
          <div className="action-buttons">
            <button className="btn primary" onClick={() => setShowHistory(true)}><ClockCounterClockwise /> Ver Trajetória</button>
            <button className="btn secondary"><MagicWand /> Otimizar Prox. Rota</button>
          </div>
        </div>
      )}

      {/* OS Creation Panel */}
      {showOsPanel && (
        <div className="action-panel glass-panel os-panel" style={{ zIndex: 100 }}>
          <div className="action-header">
            <h3><MapPinPlus /> Criar Nova OS</h3>
            <button onClick={() => { setShowOsPanel(false); setIsManualMode(false); setPendingOsCoord(null); }} className="close-btn"><X /></button>
          </div>
          <div className="os-content">
            <input type="text" className="os-input" placeholder="Endereço (ex: Av. Paulista, 1000)..." value={osAddress} onChange={e => setOsAddress(e.target.value)} />
            <div className="os-status">{osStatusMsg}</div>
            <button className="btn primary" onClick={handleApiSearch}><MagnifyingGlass /> Buscar Automático</button>
            <div className="divider"><span>OU</span></div>
            <button className="btn secondary" onClick={() => { setIsManualMode(true); setOsStatusMsg('CLIQUE NO MAPA para marcar o local.'); }}>
              <Crosshair /> Marcar Manualmente no Mapa
            </button>
          </div>
          {pendingOsCoord && (
            <div className="action-buttons" style={{ marginTop: '16px' }}>
              <button className="btn primary" style={{ backgroundColor: 'var(--accent-amber)' }} onClick={confirmOsCreation}>
                <Check /> Confirmar Local e Salvar
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
