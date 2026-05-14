import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import { io, Socket } from 'socket.io-client';
import L from 'leaflet';
import { useQuery } from '@tanstack/react-query';
import { MapPin, Radio, User } from 'lucide-react';
import api from '../services/api';

// Custom maroon marker
const createMarker = (name: string) => L.divIcon({
  className: '',
  html: `<div style="background:#8D1B3D;color:white;border-radius:50% 50% 50% 0;width:32px;height:32px;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:12px;transform:rotate(-45deg);border:2px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3)"><span style="transform:rotate(45deg)">${name[0].toUpperCase()}</span></div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 32],
});

export default function GPSTracking() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [liveLocations, setLiveLocations] = useState<Record<string, any>>({});
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [route, setRoute] = useState<[number, number][]>([]);

  const { data: latestLocations = [] } = useQuery({
    queryKey: ['gps-locations'],
    queryFn: () => api.get('/gps/locations').then(r => r.data),
    refetchInterval: 30000,
  });

  const { data: routeData } = useQuery({
    queryKey: ['gps-route', selectedUser],
    queryFn: () => api.get(`/gps/route/${selectedUser}`).then(r => r.data),
    enabled: !!selectedUser,
  });

  useEffect(() => {
    if (routeData) {
      setRoute(routeData.map((l: any) => [l.latitude, l.longitude]));
    }
  }, [routeData]);

  useEffect(() => {
    const token = localStorage.getItem('dubyx_token');
    const s = io(window.location.origin.replace(':3000', ':5000'), {
      auth: { token },
      transports: ['websocket'],
    });

    s.on('location:updated', (data: any) => {
      setLiveLocations(prev => ({ ...prev, [data.userId]: data }));
    });

    s.on('salesman:offline', ({ userId }: { userId: string }) => {
      setLiveLocations(prev => {
        const n = { ...prev };
        delete n[userId];
        return n;
      });
    });

    setSocket(s);
    return () => { s.disconnect(); };
  }, []);

  // Merge latest API locations with live socket locations
  const allLocations = latestLocations.map((l: any) => ({
    ...l,
    ...(liveLocations[l.id] || {}),
    location: liveLocations[l.id] || l.location,
  }));

  const centerQatar: [number, number] = [25.2854, 51.5310];

  return (
    <div className="space-y-4 h-full">
      <div className="flex items-center gap-2">
        <Radio size={16} className="text-green-500 animate-pulse" />
        <span className="text-sm font-medium text-gray-600">{Object.keys(liveLocations).length} salesmen live</span>
      </div>

      <div className="grid grid-cols-4 gap-4 h-[calc(100vh-220px)]">
        {/* Sidebar */}
        <div className="space-y-2 overflow-y-auto">
          {allLocations.map((s: any) => (
            <button
              key={s.id}
              onClick={() => setSelectedUser(selectedUser === s.id ? null : s.id)}
              className={`w-full text-left card p-3 hover:shadow-md transition-all ${selectedUser === s.id ? 'ring-2 ring-[#8D1B3D]' : ''}`}
            >
              <div className="flex items-center gap-2 mb-1">
                <div className="w-8 h-8 bg-[#8D1B3D] rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-xs font-bold">{s.name[0]}</span>
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-sm text-gray-900 truncate">{s.name}</p>
                  <p className="text-xs text-gray-400">{s.area || 'Unknown area'}</p>
                </div>
                {liveLocations[s.id] && <div className="w-2 h-2 bg-green-500 rounded-full ml-auto flex-shrink-0" />}
              </div>
              {s.location && (
                <div className="flex items-center gap-1 text-xs text-gray-400">
                  <MapPin size={10} />
                  <span className="truncate">{s.location.latitude?.toFixed(4)}, {s.location.longitude?.toFixed(4)}</span>
                </div>
              )}
            </button>
          ))}
          {allLocations.length === 0 && (
            <div className="text-center py-8 text-gray-400 text-sm">
              <User size={32} className="mx-auto mb-2 opacity-30" />
              No salesmen tracking data
            </div>
          )}
        </div>

        {/* Map */}
        <div className="col-span-3 card overflow-hidden">
          <MapContainer center={centerQatar} zoom={11} className="w-full h-full" style={{ zIndex: 1 }}>
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; OpenStreetMap contributors'
            />
            {allLocations.filter((l: any) => l.location).map((s: any) => (
              <Marker
                key={s.id}
                position={[s.location.latitude, s.location.longitude]}
                icon={createMarker(s.name)}
              >
                <Popup>
                  <div className="text-sm">
                    <p className="font-bold">{s.name}</p>
                    <p className="text-gray-500">{s.area}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {s.location.timestamp ? new Date(s.location.timestamp).toLocaleTimeString() : ''}
                    </p>
                    {liveLocations[s.id] && <p className="text-green-600 text-xs font-medium mt-1">● Live</p>}
                  </div>
                </Popup>
              </Marker>
            ))}
            {route.length > 1 && <Polyline positions={route} color="#8D1B3D" weight={3} opacity={0.7} dashArray="6,4" />}
          </MapContainer>
        </div>
      </div>
    </div>
  );
}
