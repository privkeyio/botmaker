import { Button } from '../ui/Button';
import './EmptyState.css';

interface EmptyStateProps {
  onCreateClick: () => void;
}

export function EmptyState({ onCreateClick }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon">
        <svg width="64" height="64" viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="8" y="8" width="48" height="48" rx="8" />
          <circle cx="24" cy="28" r="4" className="empty-state-eye" />
          <circle cx="40" cy="28" r="4" className="empty-state-eye" />
          <path d="M20 42c4-4 8-6 12-6s8 2 12 6" strokeLinecap="round" />
        </svg>
      </div>
      <h2 className="empty-state-title">No Bots Yet</h2>
      <p className="empty-state-description">
        Create your first bot to get started with automated messaging.
      </p>
      <Button variant="primary" size="lg" onClick={onCreateClick}>
        Create Your First Bot
      </Button>
    </div>
  );
}
