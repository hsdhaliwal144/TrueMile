import {
  Home,
  TrendingUp,
  Server,
  BarChart3,
  Send,
  GraduationCap,
} from 'lucide-react';

const TABS = [
  { id: 'rigby', label: 'Rigby', icon: Home },
  { id: 'load', label: 'Load Optimizer', icon: TrendingUp },
  { id: 'tms', label: 'TMS', icon: Server },
  { id: 'broker-intel', label: 'Broker Intelligence', icon: BarChart3 },
  { id: 'broker-outreach', label: 'Broker Outreach', icon: Send },
  { id: 'education', label: 'Education', icon: GraduationCap },
];

export default function Sidebar({
  activeTab,
  onTabChange,
}: {
  activeTab: string;
  onTabChange: (id: any) => void;
}) {
  return (
    <aside className="w-60 bg-slate-950 border-r border-slate-800 flex flex-col">
      {/* logo */}
      <div className="px-5 pt-6 pb-4 flex items-center gap-3">
        <div className="h-9 w-9 rounded-2xl bg-blue-500/10 flex items-center justify-center text-xl">
          🚚
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-400">
            Fleet1.AI
          </p>
          <p className="text-sm font-semibold text-white">Control Center</p>
        </div>
      </div>

      {/* nav */}
      <nav className="flex-1 px-3 space-y-1">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const active = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
                active
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-400 hover:bg-slate-900/60 hover:text-white'
              }`}
            >
              <Icon size={18} strokeWidth={1.6} />
              {tab.label}
            </button>
          );
        })}
      </nav>

      <div className="px-5 pb-5 text-xs text-slate-500">v0.1 • YC demo</div>
    </aside>
  );
}
