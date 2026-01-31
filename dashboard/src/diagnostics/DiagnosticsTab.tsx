import { useContainerStats } from '../hooks/useContainerStats';
import { SystemOverview } from './SystemOverview';
import { ContainerMetrics } from './ContainerMetrics';
import { CleanupPanel } from './CleanupPanel';
import { HealthStatus } from './HealthStatus';
import './DiagnosticsTab.css';

export function DiagnosticsTab() {
  const { stats, loading, error } = useContainerStats();

  return (
    <div className="diagnostics-tab" role="tabpanel" id="diagnostics-panel">
      {error && (
        <div className="diagnostics-error">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 1a7 7 0 100 14A7 7 0 008 1zM7 4h2v5H7V4zm0 6h2v2H7v-2z" />
          </svg>
          <span>{error}</span>
        </div>
      )}

      <div className="diagnostics-grid">
        <div className="diagnostics-main">
          <SystemOverview stats={stats} loading={loading} />
          <ContainerMetrics stats={stats} />
        </div>

        <div className="diagnostics-sidebar">
          <HealthStatus />
          <CleanupPanel />
        </div>
      </div>
    </div>
  );
}
