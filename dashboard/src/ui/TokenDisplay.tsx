import { useState, useCallback } from 'react';
import './TokenDisplay.css';

interface TokenDisplayProps {
  token: string;
  label?: string;
}

export function TokenDisplay({ token, label = 'Access Token' }: TokenDisplayProps) {
  const [copied, setCopied] = useState(false);
  const [revealed, setRevealed] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(token);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy token:', err);
    }
  }, [token]);

  const maskedToken = token.slice(0, 8) + '••••••••' + token.slice(-8);

  return (
    <div className="token-display">
      <div className="token-display-label">{label}</div>
      <div className="token-display-row">
        <button
          className="token-display-reveal"
          onClick={() => setRevealed(!revealed)}
          title={revealed ? 'Hide token' : 'Reveal token'}
        >
          <span className="token-display-icon">
            {revealed ? '◉' : '◎'}
          </span>
        </button>
        <code className="token-display-value">
          {revealed ? token : maskedToken}
        </code>
        <button
          className={`token-display-copy ${copied ? 'copied' : ''}`}
          onClick={handleCopy}
          title="Copy to clipboard"
        >
          <span className="token-display-copy-icon">
            {copied ? '✓' : '⧉'}
          </span>
        </button>
      </div>
    </div>
  );
}
