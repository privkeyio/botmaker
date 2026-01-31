import { ReactNode } from 'react';
import './Shell.css';

interface ShellProps {
  children: ReactNode;
  header?: ReactNode;
}

export function Shell({ children, header }: ShellProps) {
  return (
    <div className="shell">
      {header}
      <main className="shell-main">
        {children}
      </main>
    </div>
  );
}
