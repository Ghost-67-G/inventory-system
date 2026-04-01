import { useEffect, useRef, useState } from 'react';
import { Laptop, Moon, Sun } from 'lucide-react';
import { useThemeStore, type ThemeMode } from '@/store/themeStore';
import { Button } from '@/components/ui/button';

const MODE_META: Record<ThemeMode, { label: string; Icon: typeof Sun }> = {
  light: { label: 'Light', Icon: Sun },
  system: { label: 'System', Icon: Laptop },
  dark: { label: 'Dark', Icon: Moon }
};

export function ThemeToggle() {
  const mode = useThemeStore((state) => state.mode);
  const setMode = useThemeStore((state) => state.setMode);
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current) {
        return;
      }
      if (!rootRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, []);

  const ActiveIcon = MODE_META[mode].Icon;

  return (
    <div ref={rootRef} className="relative">
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={() => setIsOpen((value) => !value)}
        title={`Theme: ${MODE_META[mode].label.toLowerCase()}`}
        className="h-10 w-10 min-h-11 md:min-h-0"
      >
        <ActiveIcon className="h-4 w-4" />
      </Button>

      {isOpen ? (
        <div className="absolute right-0 z-50 mt-2 w-44 rounded-md border border-border bg-popover p-1 shadow-md">
          {(Object.keys(MODE_META) as ThemeMode[]).map((nextMode) => {
            const Icon = MODE_META[nextMode].Icon;
            const selected = mode === nextMode;
            return (
              <button
                key={nextMode}
                type="button"
                onClick={() => {
                  setMode(nextMode);
                  setIsOpen(false);
                }}
                className={`flex w-full items-center gap-2 rounded-sm px-2 py-2 text-sm transition-colors ${
                  selected ? 'bg-accent text-accent-foreground' : 'text-foreground hover:bg-muted'
                }`}
              >
                <Icon className="h-4 w-4" />
                {MODE_META[nextMode].label}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
