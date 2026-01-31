import type { ContainerStats } from '../types';
import { Gauge } from '../ui/Gauge';
import { Panel } from '../ui/Panel';
import './SystemOverview.css';

interface SystemOverviewProps {
  stats: ContainerStats[];
  loading: boolean;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

export function SystemOverview({ stats, loading }: SystemOverviewProps) {
  // Aggregate stats across all containers
  const totalCpu = stats.reduce((sum, s) => sum + s.cpuPercent, 0);
  const avgCpu = stats.length > 0 ? totalCpu / stats.length : 0;
  const totalMemory = stats.reduce((sum, s) => sum + s.memoryUsage, 0);
  const totalMemoryLimit = stats.reduce((sum, s) => sum + s.memoryLimit, 0);
  const memoryPercent = totalMemoryLimit > 0 ? (totalMemory / totalMemoryLimit) * 100 : 0;
  const totalNetworkRx = stats.reduce((sum, s) => sum + s.networkRxBytes, 0);
  const totalNetworkTx = stats.reduce((sum, s) => sum + s.networkTxBytes, 0);

  if (loading) {
    return (
      <Panel className="system-overview system-overview--loading">
        <div className="system-overview-spinner" />
        <span>Loading system metrics...</span>
      </Panel>
    );
  }

  return (
    <Panel className="system-overview" header="System Overview">
      <div className="system-overview-grid">
        <div className="system-overview-gauge">
          <Gauge
            value={avgCpu}
            max={100}
            size="lg"
            label="Avg CPU"
            unit="%"
            thresholds={{ warning: 60, danger: 85 }}
          />
        </div>

        <div className="system-overview-gauge">
          <Gauge
            value={memoryPercent}
            max={100}
            size="lg"
            label="Memory"
            unit="%"
            thresholds={{ warning: 70, danger: 90 }}
          />
        </div>

        <div className="system-overview-stats">
          <div className="system-overview-stat">
            <span className="system-overview-stat-label">Active Bots</span>
            <span className="system-overview-stat-value">{stats.length}</span>
          </div>
          <div className="system-overview-stat">
            <span className="system-overview-stat-label">Total Memory</span>
            <span className="system-overview-stat-value">{formatBytes(totalMemory)}</span>
          </div>
          <div className="system-overview-stat">
            <span className="system-overview-stat-label">Network In</span>
            <span className="system-overview-stat-value">{formatBytes(totalNetworkRx)}</span>
          </div>
          <div className="system-overview-stat">
            <span className="system-overview-stat-label">Network Out</span>
            <span className="system-overview-stat-value">{formatBytes(totalNetworkTx)}</span>
          </div>
        </div>
      </div>
    </Panel>
  );
}
