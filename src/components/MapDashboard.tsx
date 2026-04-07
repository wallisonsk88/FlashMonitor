import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import { supabase } from '../supabaseClient';
import {
  Lightning, Plus, X, Speedometer, NavigationArrow,
  ClockCounterClockwise, MagicWand, MapPinPlus,
  MagnifyingGlass, Crosshair, Check, User, Wrench, SignOut
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
  const [searchTerm, setSearchTerm] = useState('');
  const [history, setHistory] = useState<Record<number, [number, number][]>>({});
  const [routeData, setRouteData] = useState<[number, number][] | null>(null);

  // OS Panel State
  const [showOsPanel, setShowOsPanel] = useState(false);
  const [osAddress, setOsAddress] = useState('');
  const [osStatusMsg, setOsStatusMsg] = useState('');
  const [isManualMode, setIsManualMode] = useState(false);
  const [pendingOsCoord, setPendingOsCoord] = useState<[number, number] | null>(null);
  const [osTechId, setOsTechId] = useState<number | null>(null);

  // Technician Manager State
  const [showTechManager, setShowTechManager] = useState(false);
  const [newTechName, setNewTechName] = useState('');
  const [newTechUserId, setNewTechUserId] = useState('');

  // === SUPABASE: Initial fetch ===
  useEffect(() => {
    const fetchTechs = async () => {
      const { data, error } = await supabase.from('technicians').select('*');
      if (!error && data && data.length > 0) {
        setTechs(data as Tech[]);
        setDbConnected(true);
        setHistory(prev => {
          const next = { ...prev };
          (data as Tech[]).forEach(t => {
            if (!next[t.id]) next[t.id] = [[t.lat, t.lng]];
          });
          return next;
        });
      } else {
        setTechs([]);
        setDbConnected(false);
      }
    };

    const fetchOrders = async () => {
      const { data, error } = await supabase.from('service_orders').select('*').eq('status', 'pending');
      if (!error && data) {
        setOsList(data as ServiceOrder[]);
      }
    };

    fetchTechs();
    fetchOrders();
  }, []);

  // === SUPABASE: Realtime Subscriptions ===
  useEffect(() => {
    const techChannel = supabase
      .channel('technicians-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'technicians' }, (payload) => {
        if (payload.eventType === 'UPDATE') {
          const updated = payload.new as Tech;
          setTechs(prev => prev.map(t => t.id === updated.id ? { ...t, ...updated } : t));
          
          // Update history on movement
          setHistory(prev => {
            const currentPath = prev[updated.id] || [];
            const lastPoint = currentPath[currentPath.length - 1];
            if (!lastPoint || lastPoint[0] !== updated.lat || lastPoint[1] !== updated.lng) {
              return { ...prev, [updated.id]: [...currentPath.slice(-19), [updated.lat, updated.lng]] };
            }
            return prev;
          });
        } else if (payload.eventType === 'INSERT') {
          const nw = payload.new as Tech;
          setTechs(prev => [...prev, nw]);
          setHistory(prev => ({ ...prev, [nw.id]: [[nw.lat, nw.lng]] }));
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
      setTechs(prev => {
        const nextTechs = prev.map(t => {
          if (t.status === 'moving') {
            const newLat = t.lat + (Math.random() - 0.5) * 0.001;
            const newLng = t.lng + (Math.random() - 0.5) * 0.001;
            return { ...t, lat: newLat, lng: newLng, speed: Math.floor(Math.random() * 35 + 30) };
          }
          return t;
        });

        // Update history in demo mode
        setHistory(hPrev => {
          const hNext = { ...hPrev };
          nextTechs.forEach(t => {
            if (t.status === 'moving') {
              const currentPath = hNext[t.id] || [];
              hNext[t.id] = [...currentPath.slice(-19), [t.lat, t.lng]];
            }
          });
          return hNext;
        });

        return nextTechs;
      });
    }, 3000);
    return () => clearInterval(interval);
  }, [dbConnected]);

  // === HANDLERS ===
  const handleTechClick = (tech: Tech) => {
    setSelectedTech(tech);
    setFocusCoord([tech.lat, tech.lng]);
    setShowHistory(false);
    setRouteData(null); // Clear routing when switching
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
        status: osTechId ? 'assigned' : 'pending',
        assigned_tech_id: osTechId
      });
      if (error) {
        alert('Erro ao salvar: ' + error.message);
        return;
      }
    } else {
      // Demo fallback (only if DB is disconnected)
      setOsList(prev => [...prev, { id: Date.now(), address: osAddress || 'Manual', lat: pendingOsCoord[0], lng: pendingOsCoord[1], status: osTechId ? 'assigned' : 'pending' }]);
    }

    alert('Ordem de Serviço criada com sucesso!');
    setPendingOsCoord(null);
    setShowOsPanel(false);
    setOsAddress('');
    setOsTechId(null);
  };
  
  const handleAddTech = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTechName || !newTechUserId) return;
    
    const { error } = await supabase
      .from('technicians')
      .insert([{ 
        name: newTechName, 
        user_id: newTechUserId, 
        status: 'offline',
        lat: -4.4550,
        lng: -43.8858
      }]);
    
    if (error) {
      alert(`Erro ao adicionar técnico: ${error.message}`);
    } else {
      setNewTechName('');
      setNewTechUserId('');
      alert('Técnico adicionado com sucesso!');
    }
  };

  const handleDeleteTech = async (id: number) => {
    if (!confirm('Tem certeza que deseja excluir este técnico?')) return;
    
    const { error } = await supabase
      .from('technicians')
      .delete()
      .eq('id', id);
    
    if (error) alert(`Erro ao excluir: ${error.message}`);
  };

  const handleOptimizeRoute = async () => {
    if (!selectedTech) return;
    
    // 1. Find destinations: Prioritize OS assigned to this tech, then pending ones
    const assignedOs = osList.filter(o => (o as any).assigned_tech_id === selectedTech.id);
    const targetOs = assignedOs.length > 0 ? assignedOs[0] : osList[0];
    
    if (!targetOs) {
      alert('Nenhuma Ordem de Serviço encontrada para otimizar.');
      return;
    }
    
    try {
      const url = `https://router.project-osrm.org/route/v1/driving/${selectedTech.lng},${selectedTech.lat};${targetOs.lng},${targetOs.lat}?overview=full&geometries=geojson`;
      const res = await fetch(url);
      const data = await res.json();
      
      if (data.routes && data.routes.length > 0) {
        const coords = data.routes[0].geometry.coordinates.map((c: [number, number]) => [c[1], c[0]] as [number, number]);
        setRouteData(coords);
        setFocusCoord([targetOs.lat, targetOs.lng]);
      } else {
        alert('Não foi possível calcular a rota.');
      }
    } catch (error) {
      console.error('Erro no roteamento:', error);
      alert('Erro ao conectar com serviço de mapas.');
    }
  };

  const techStatusLabel = (s: string) => s === 'moving' ? 'Em Rota' : s === 'idle' ? 'Parado' : 'Offline';

  // === RENDER ===
  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', overflow: 'hidden' }} className={isManualMode ? 'map-crosshair' : ''}>
      {/* Map */}
      <MapContainer center={[-4.4550, -43.8858]} zoom={14} zoomControl={false} style={{ width: '100%', height: '100%', position: 'absolute', zIndex: 1 }}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap" />
        <MapController focusTo={focusCoord} />
        <MapClickHandler active={isManualMode} onMapClick={(lat, lng) => { setPendingOsCoord([lat, lng]); setIsManualMode(false); setOsStatusMsg('Local marcado manualmente!'); }} />

        {techs.map(t => (
          <Marker key={t.id} position={[t.lat, t.lng]} icon={createIcon(getTechIconHtml(t.status))} eventHandlers={{ click: () => handleTechClick(t) }} />
        ))}

        {showHistory && selectedTech && history[selectedTech.id] && (
          <Polyline positions={history[selectedTech.id]} pathOptions={{ color: 'var(--accent-red)', weight: 4, dashArray: '10, 10', opacity: 0.7 }} />
        )}

        {routeData && (
          <Polyline positions={routeData} pathOptions={{ color: 'var(--accent-amber)', weight: 5, opacity: 0.9 }} />
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
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn primary small-btn" onClick={() => { setShowOsPanel(true); setOsStatusMsg(''); setIsManualMode(false); setPendingOsCoord(null); setShowTechManager(false); }}>
                <Plus /> Nova OS
              </button>
              <button className="btn secondary small-btn" title="Gerenciar Técnicos" onClick={() => { setShowTechManager(!showTechManager); setShowOsPanel(false); }}>
                <User />
              </button>
              <button className="btn secondary small-btn" onClick={() => supabase.auth.signOut()}>
                <SignOut />
              </button>
            </div>
          </div>
          <p>Rastreamento Tempo Real</p>
        </header>
        <div className="search-bar">
          <MagnifyingGlass />
          <input 
            type="text" 
            placeholder="Buscar técnico..." 
            value={searchTerm} 
            onChange={(e) => setSearchTerm(e.target.value)} 
          />
        </div>
        <div className="tech-list" id="tech-list">
          {techs.filter(t => t.name.toLowerCase().includes(searchTerm.toLowerCase())).map(t => {
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
            <button className="btn primary" onClick={() => { setShowHistory(true); setRouteData(null); }}><ClockCounterClockwise /> Ver Trajetória</button>
            <button className="btn secondary" onClick={handleOptimizeRoute}><MagicWand /> Otimizar Prox. Rota</button>
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
            
            <div className="divider"><span>ATRIBUIR TÉCNICO</span></div>
            <select 
              className="os-input" 
              value={osTechId || ''} 
              onChange={e => setOsTechId(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">Sem técnico atribuído</option>
              {techs.map(t => (
                <option key={t.id} value={t.id}>{t.name} ({techStatusLabel(t.status)})</option>
              ))}
            </select>
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

      {/* Technician Manager Panel */}
      {showTechManager && (
        <div className="action-panel glass-panel tech-manager-panel" style={{ zIndex: 101 }}>
          <div className="action-header">
            <h3><User /> Gerenciar Técnicos</h3>
            <button onClick={() => setShowTechManager(false)} className="close-btn"><X /></button>
          </div>
          
          <div className="tech-manager-content">
            <form onSubmit={handleAddTech} className="add-tech-form">
              <h4>Adicionar Novo Técnico</h4>
              <input 
                type="text" 
                className="os-input" 
                placeholder="Nome Completo" 
                value={newTechName}
                onChange={e => setNewTechName(e.target.value)}
                required
              />
              <input 
                type="text" 
                className="os-input" 
                placeholder="User ID (UUID do Supabase)" 
                value={newTechUserId}
                onChange={e => setNewTechUserId(e.target.value)}
                required
              />
              <button type="submit" className="btn primary small-btn" style={{ width: '100%', marginTop: '8px' }}>
                <Plus /> Salvar Técnico na Frota
              </button>
            </form>

            <div className="divider"><span>TÉCNICOS CADASTRADOS</span></div>
            
            <div className="tech-manager-list">
              {techs.length === 0 ? (
                <p className="empty-msg">Nenhum técnico cadastrado.</p>
              ) : (
                techs.map(t => (
                  <div key={t.id} className="tech-manager-item">
                    <div className="tech-info">
                      <strong>{t.name}</strong>
                      <span>ID: {t.id}</span>
                    </div>
                    <button className="delete-btn" onClick={() => handleDeleteTech(t.id)}><X /></button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
