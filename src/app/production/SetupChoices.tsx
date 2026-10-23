import { useId, type ReactNode } from 'react';
import { Check } from 'lucide-react';

export interface SetupChoice {
  id: string;
  label: string;
  description: string;
  detail?: string;
  visual?: ReactNode;
}

export function SetupChoices({ label, options, value, onSelect, className = '' }: {
  label: string; options: SetupChoice[]; value: string; onSelect: (id: string) => void; className?: string;
}) {
  const groupId = useId();
  return <div className={`setup-card-grid ${className}`} role="group" aria-label={label}>
    {options.map((option, index) => <button type="button" className="setup-card" key={option.id} aria-label={option.label} aria-describedby={`${groupId}-${index}`} aria-pressed={value === option.id} onClick={() => onSelect(option.id)}>
      {option.visual && <span className="setup-card-visual" aria-hidden>{option.visual}</span>}
      <span className="setup-card-title"><strong>{option.label}</strong><span className="setup-card-check" aria-hidden>{value === option.id && <Check size={16} strokeWidth={3} />}</span></span>
      <span className="setup-card-description" id={`${groupId}-${index}`}>{option.description}</span>
      {option.detail && <span className="setup-card-detail">{option.detail}</span>}
    </button>)}
  </div>;
}
