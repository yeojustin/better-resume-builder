import type { ReactNode } from 'react';
import { cn } from '../../utils/cn';

type CardProps = {
  children: ReactNode;
  className?: string;
  padding?: 'none' | 'sm' | 'md';
};

export function Card({ children, className, padding = 'md' }: CardProps) {
  const pad =
    padding === 'none' ? '' : padding === 'sm' ? 'p-3' : 'p-4';
  return (
    <div
      className={cn(
        'bg-white',
        pad,
        className
      )}
    >
      {children}
    </div>
  );
}

type CardHeaderProps = {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
};

export function CardHeader({ title, description, action, className }: CardHeaderProps) {
  return (
    <div
      className={cn(
        'flex items-start justify-between gap-3 border-b border-[#E8EAEF] pb-3 mb-3',
        className
      )}
    >
      <div className="min-w-0">
        <h3 className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#111]">
          {title}
        </h3>
        {description && (
          <p className="mt-1 text-[11px] leading-snug text-[#5C6370]">{description}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
