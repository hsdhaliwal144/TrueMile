import { Clock, FileCheck, Upload, ShieldCheck } from 'lucide-react';

export default function RigbyMain({
  activeTab,
  metrics,
}: {
  activeTab: string;
  metrics: any;
  onMetricsChange: (m: any) => void;
}) {
  // calc
  const totalExpenses =
    metrics.fuelCost +
    metrics.insurance +
    metrics.maintenance +
    metrics.otherExpenses;
  const cpm =
    metrics.milesPerMonth && metrics.milesPerMonth > 0
      ? totalExpenses / metrics.milesPerMonth
      : 0;
  const estRevenue = metrics.loadsPerMonth * 2500;
  const rpm =
    metrics.milesPerMonth && metrics.milesPerMonth > 0
      ? estRevenue / metrics.milesPerMonth
      : 0;
  const profitPerMile = rpm - cpm;

  // EDUCATION TAB = LIGHT UI
  if (activeTab === 'education') {
    return (
      <div className="flex-1 overflow-y-auto bg-slate-50 text-slate-950 px-10 py-8">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-3xl font-bold">Driver Education</h1>
            <p className="text-slate-500">
              Training lessons and resources to help you stay safe and
              compliant.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-5 max-w-5xl">
          <EducationCard
            title="Hours of Service (HOS)"
            desc="Understand HOS rules and how to track your hours."
            icon={<Clock className="text-blue-600" />}
          />
          <EducationCard
            title="Pre-Trip Inspection"
            desc="Steps to inspect your vehicle before a trip."
            icon={<FileCheck className="text-sky-600" />}
          />
          <EducationCard
            title="DOT Inspection"
            desc="How to prepare for a roadside DOT inspection."
            icon={<ShieldCheck className="text-indigo-600" />}
          />
        </div>

        <div className="mt-8 max-w-2xl">
          <h2 className="text-lg font-semibold mb-2">Language Practice</h2>
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
            <p className="font-medium">Crossing the Border</p>
            <p className="text-sm text-slate-500">
              Common English phrases (for border crossings)
            </p>
          </div>
        </div>
      </div>
    );
  }

  // DEFAULT: RIGBY DARK
  return (
    <main className="flex-1 overflow-y-auto bg-slate-950 px-10 py-8">
      {/* header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white">
            Rigby – Fleet Advisor
          </h1>
          <p className="text-slate-400">
            Smart trucker + fleet CFO. Let’s get your numbers right.
          </p>
        </div>
        <div className="flex gap-3">
          <button className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-sm text-slate-100 flex items-center gap-2">
            <Upload size={16} />
            Upload docs
          </button>
          <button className="px-3 py-2 rounded-lg bg-blue-500 text-sm font-medium text-white">
            Start a review
          </button>
        </div>
      </div>

      {/* cards */}
      <div className="grid grid-cols-3 gap-6 max-w-6xl">
        {/* Fleet Profile */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-sm">
          <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center mb-3">
            <Clock className="text-blue-300" size={20} />
          </div>
          <h2 className="text-lg font-semibold text-white mb-1">
            Fleet Profile
          </h2>
          <p className="text-sm text-slate-400 mb-4">
            Track trucks, drivers, and load volume.
          </p>
          <div className="space-y-2 text-sm">
            <Row label="Trucks" value={metrics.trucks} />
            <Row label="Drivers" value={metrics.drivers} />
            <Row label="Loads / month" value={metrics.loadsPerMonth} />
          </div>
        </div>

        {/* Financial Snapshot */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-sm">
          <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center mb-3">
            <FileCheck className="text-emerald-300" size={20} />
          </div>
          <h2 className="text-lg font-semibold text-white mb-1">
            Financial Snapshot
          </h2>
          <p className="text-sm text-slate-400 mb-4">
            Current operating efficiency.
          </p>
          <div className="space-y-2 text-sm">
            <Row label="CPM" value={`$${cpm.toFixed(2)}`} />
            <Row label="RPM" value={`$${rpm.toFixed(2)}`} />
            <Row
              label="Profit / mile"
              value={`$${profitPerMile.toFixed(2)}`}
              accent={profitPerMile > 0}
            />
          </div>
        </div>

        {/* Upload documents */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-sm flex flex-col">
          <div className="h-10 w-10 rounded-xl bg-purple-500/10 flex items-center justify-center mb-3">
            <Upload className="text-purple-200" size={20} />
          </div>
          <h2 className="text-lg font-semibold text-white mb-1">
            Upload documents
          </h2>
          <p className="text-sm text-slate-400 mb-4">
            Rate cons, fuel receipts, maintenance.
          </p>
          <button className="mt-auto bg-blue-500 hover:bg-blue-600 text-white py-2 rounded-lg text-sm">
            Choose files
          </button>
        </div>
      </div>

      {/* bottom strip */}
      <div className="max-w-6xl mt-8">
        <h3 className="text-sm font-semibold text-white mb-3">
          AI suggestions
        </h3>
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 text-sm text-slate-300">
          <ul className="list-disc list-inside space-y-2">
            <li>Reduce idle time to lower fuel cost.</li>
            <li>Consider moving 1 truck to high-RPM regional freight.</li>
            <li>Upload last 3 rate cons to benchmark your lanes.</li>
          </ul>
        </div>
      </div>
    </main>
  );
}

function Row({
  label,
  value,
  accent,
}: {
  label: string;
  value: any;
  accent?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-400">{label}</span>
      <span className={accent ? 'text-emerald-300 font-medium' : 'text-white'}>
        {value}
      </span>
    </div>
  );
}

function EducationCard({
  title,
  desc,
  icon,
}: {
  title: string;
  desc: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
      <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center mb-3">
        {icon}
      </div>
      <h3 className="font-semibold mb-1">{title}</h3>
      <p className="text-sm text-slate-500">{desc}</p>
    </div>
  );
}
