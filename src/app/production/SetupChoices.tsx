import { useId, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { Check } from 'lucide-react';

export interface SetupChoice {
  id: string;
  label: string;
  description: string;
  detail?: string;
  visual?: ReactNode;
}

/**
 * Escolha única em cartões (#152): grupo de rádio de verdade para teclado e leitor de tela.
 * Uma parada de Tab no grupo (no cartão escolhido); setas, Home e End mudam a escolha, como num
 * grupo de rádio nativo. O leitor de tela anuncia "opção 2 de 6, marcada".
 */
export function SetupChoices({ label, options, value, onSelect, className = '' }: {
  label: string; options: SetupChoice[]; value: string; onSelect: (id: string) => void; className?: string;
}) {
  const groupId = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const selected = options.findIndex((o) => o.id === value);
  const tabStop = selected >= 0 ? selected : 0;

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>, index: number) {
    const last = options.length - 1;
    const next = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? (index === last ? 0 : index + 1)
      : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? (index === 0 ? last : index - 1)
      : e.key === 'Home' ? 0
      : e.key === 'End' ? last
      : null;
    if (next === null) return;
    e.preventDefault();
    onSelect(options[next]!.id);
    refs.current[next]?.focus();
  }

  return <div className={`setup-card-grid ${className}`} role="radiogroup" aria-label={label}>
    {options.map((option, index) => {
      const checked = value === option.id;
      return <button
        type="button"
        role="radio"
        className="setup-card"
        key={option.id}
        ref={(el) => { refs.current[index] = el; }}
        aria-label={option.label}
        aria-describedby={`${groupId}-${index}`}
        aria-checked={checked}
        data-selected={checked}
        tabIndex={index === tabStop ? 0 : -1}
        onClick={() => onSelect(option.id)}
        onKeyDown={(e) => onKeyDown(e, index)}
      >
        {option.visual && <span className="setup-card-visual" aria-hidden>{option.visual}</span>}
        <span className="setup-card-title"><strong>{option.label}</strong><span className="setup-card-check" aria-hidden>{checked && <Check size={16} strokeWidth={3} />}</span></span>
        <span className="setup-card-description" id={`${groupId}-${index}`}>{option.description}</span>
        {option.detail && <span className="setup-card-detail">{option.detail}</span>}
      </button>;
    })}
  </div>;
}
