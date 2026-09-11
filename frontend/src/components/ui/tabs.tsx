'use client';

import * as React from 'react';

type TabsContextValue = {
  value: string;
  onValueChange: (value: string) => void;
};

const TabsContext = React.createContext<TabsContextValue | null>(null);

const useTabsContext = () => {
  const ctx = React.useContext(TabsContext);
  if (!ctx) {
    throw new Error('Tabs components must be used within <Tabs>');
  }
  return ctx;
};

interface TabsProps {
  value: string;
  onValueChange: (value: string) => void;
  children: React.ReactNode;
  className?: string;
}

const Tabs = React.forwardRef<HTMLDivElement, TabsProps>(
  ({ value, onValueChange, children, className = '', ...props }, ref) => {
    const contextValue = React.useMemo(() => ({ value, onValueChange }), [value, onValueChange]);
    return (
      <TabsContext.Provider value={contextValue}>
        <div ref={ref} className={className} {...props}>
          {children}
        </div>
      </TabsContext.Provider>
    );
  }
);
Tabs.displayName = 'Tabs';

interface TabsListProps {
  children: React.ReactNode;
  className?: string;
}

const TabsList = React.forwardRef<
  HTMLDivElement,
  TabsListProps
>(({ children, className = '', ...props }, ref) => (
  <div ref={ref} role="tablist" className={`flex overflow-x-auto border-b border-border ${className}`} {...props}>
    {children}
  </div>
));
TabsList.displayName = 'TabsList';

interface TabsTriggerProps {
  value: string;
  children: React.ReactNode;
  className?: string;
}

const TabsTrigger = React.forwardRef<
  HTMLButtonElement,
  TabsTriggerProps
>(({ value: tabValue, children, className = '', ...props }, ref) => {
  const { value, onValueChange } = useTabsContext();
  const isActive = value === tabValue;

  return (
    <button
      ref={ref}
      type="button"
      role="tab"
      id={`tab-${tabValue}`}
      aria-selected={isActive}
      aria-controls={`tabpanel-${tabValue}`}
      tabIndex={isActive ? 0 : -1}
      onClick={() => onValueChange(tabValue)}
      onKeyDown={(event) => {
        if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft' && event.key !== 'Home' && event.key !== 'End') {
          return;
        }
        const list = event.currentTarget.closest('[role="tablist"]');
        if (!list) return;
        const tabs = Array.from(list.querySelectorAll<HTMLButtonElement>('[role="tab"]:not([disabled])'));
        const index = tabs.indexOf(event.currentTarget);
        if (index === -1) return;
        event.preventDefault();
        let nextIndex = index;
        if (event.key === 'ArrowRight') nextIndex = (index + 1) % tabs.length;
        if (event.key === 'ArrowLeft') nextIndex = (index - 1 + tabs.length) % tabs.length;
        if (event.key === 'Home') nextIndex = 0;
        if (event.key === 'End') nextIndex = tabs.length - 1;
        tabs[nextIndex]?.focus();
        tabs[nextIndex]?.click();
      }}
      className={`shrink-0 px-4 py-2 font-medium text-sm border-b-2 transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 ${
        isActive
          ? 'border-primary text-foreground'
          : 'border-transparent text-muted-foreground hover:text-foreground'
      } ${className}`}
      {...props}
    >
      {children}
    </button>
  );
});
TabsTrigger.displayName = 'TabsTrigger';

interface TabsContentProps {
  value: string;
  children: React.ReactNode;
  className?: string;
}

const TabsContent = React.forwardRef<
  HTMLDivElement,
  TabsContentProps
>(({ value: contentValue, children, className = '', ...props }, ref) => {
  const { value } = useTabsContext();
  const isActive = value === contentValue;

  if (!isActive) return null;

  return (
    <div
      ref={ref}
      role="tabpanel"
      id={`tabpanel-${contentValue}`}
      aria-labelledby={`tab-${contentValue}`}
      tabIndex={0}
      className={`mt-4 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
});
TabsContent.displayName = 'TabsContent';

export { Tabs, TabsList, TabsTrigger, TabsContent };
