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
  <div ref={ref} role="tablist" className={`flex border-b border-gray-200 ${className}`} {...props}>
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
      role="tab"
      aria-selected={isActive}
      onClick={() => onValueChange(tabValue)}
      className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors whitespace-nowrap ${
        isActive
          ? 'border-blue-600 text-blue-600'
          : 'border-transparent text-gray-600 hover:text-gray-900'
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
    <div ref={ref} role="tabpanel" className={`mt-4 ${className}`} {...props}>
      {children}
    </div>
  );
});
TabsContent.displayName = 'TabsContent';

export { Tabs, TabsList, TabsTrigger, TabsContent };
