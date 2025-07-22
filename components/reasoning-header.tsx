import { ChevronDownIcon } from './icons';

interface ReasoningHeaderProps {
  statusText: string;
  isExpanded: boolean;
  onToggle: () => void;
}

export function ReasoningHeader({ statusText, isExpanded, onToggle }: ReasoningHeaderProps) {
  return (
    <div className="flex flex-row gap-2 items-center">
      <div className="font-medium text-sm text-muted-foreground">{statusText}</div>
      <button
        data-testid="message-reasoning-toggle"
        type="button"
        className={`cursor-pointer transition-transform ${isExpanded ? '' : 'rotate-180'}`}
        onClick={onToggle}
        aria-label={isExpanded ? 'Collapse reasoning' : 'Expand reasoning'}
      >
        <ChevronDownIcon />
      </button>
    </div>
  );
} 