import { useEffect, useState } from 'react';
import Navbar from '../components/Navbar';
import api from '../lib/api';

export default function Notifications() {
  const [notifications, setNotifications] = useState([]);

  const load = () => api.get('/notifications').then((r) => setNotifications(r.data.notifications || []));
  useEffect(() => { load(); }, []);

  const markAll = async () => {
    await api.post('/notifications/read-all');
    load();
  };

  return (
    <div className="mesh-bg min-h-screen">
      <Navbar />
      <div className="mx-auto max-w-3xl px-4 py-10">
        <div className="flex justify-between items-center mb-6">
          <h1 className="font-display text-3xl">Notifications</h1>
          <button onClick={markAll} className="text-sm text-accent-deep font-semibold">Mark all read</button>
        </div>
        <div className="space-y-3">
          {notifications.map((n) => (
            <div key={n.id} className={`rounded-2xl border border-line bg-white p-4 ${n.is_read ? 'opacity-70' : ''}`}>
              <div className="font-semibold">{n.title}</div>
              <div className="text-sm text-fog mt-1">{n.message}</div>
              <div className="text-xs text-fog mt-2">{new Date(n.created_at).toLocaleString()}</div>
            </div>
          ))}
          {notifications.length === 0 && <div className="text-fog">No notifications.</div>}
        </div>
      </div>
    </div>
  );
}
