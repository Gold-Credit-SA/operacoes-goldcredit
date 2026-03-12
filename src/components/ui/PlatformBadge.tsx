import logoSerasa from '@/assets/logo-serasa.png';
import logoHbi from '@/assets/logo-hbi.png';
import logoAgrisk from '@/assets/logo-agrisk.png';
import { cn } from '@/lib/utils';

const PLATFORM_CONFIG: Record<string, { logo: string; label: string; className: string }> = {
  serasa: { logo: logoSerasa, label: 'Serasa', className: 'bg-blue-500/10 text-blue-700 border-blue-200' },
  scr: { logo: logoHbi, label: 'SCR (HBI)', className: 'bg-green-500/10 text-green-700 border-green-200' },
  agrisk: { logo: logoAgrisk, label: 'AgRisk', className: 'bg-amber-500/10 text-amber-700 border-amber-200' },
};

interface PlatformBadgeProps {
  platform: string;
  onClick?: (e: React.MouseEvent) => void;
  className?: string;
}

export function PlatformBadge({ platform, onClick, className }: PlatformBadgeProps) {
  const config = PLATFORM_CONFIG[platform];
  if (!config) {
    return (
      <span className={cn("inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-medium bg-muted text-muted-foreground", className)}>
        {platform.toUpperCase()}
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[10px] font-medium",
        config.className,
        onClick && "cursor-pointer hover:opacity-80 transition-opacity",
        className
      )}
      onClick={onClick}
    >
      <img src={config.logo} alt={config.label} className="h-3.5 w-3.5 object-contain" />
      {config.label}
    </span>
  );
}
