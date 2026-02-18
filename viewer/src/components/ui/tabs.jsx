import * as React from 'react';
import { cn } from '../../lib/utils';

const TabsContext = React.createContext({
  value: '',
  onValueChange: () => {},
});

function Tabs({ value, onValueChange, children, className }) {
  return (
    <TabsContext.Provider value={{ value, onValueChange }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  );
}

function TabsList({ className, children }) {
  return (
    <div className={cn('inline-flex h-10 items-center justify-center rounded-md bg-muted p-1', className)}>
      {children}
    </div>
  );
}

function TabsTrigger({ value, children, className }) {
  const { value: currentValue, onValueChange } = React.useContext(TabsContext);
  const isActive = currentValue === value;

  return (
    <button
      onClick={() => onValueChange(value)}
      className={cn(
        'inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
        isActive
          ? 'bg-background text-foreground shadow-sm'
          : 'text-muted-foreground hover:bg-background/50',
        className
      )}
    >
      {children}
    </button>
  );
}

function TabsContent({ value, children, className }) {
  const { value: currentValue } = React.useContext(TabsContext);

  if (currentValue !== value) return null;

  return (
    <div className={cn('mt-2', className)}>
      {children}
    </div>
  );
}

export { Tabs, TabsList, TabsTrigger, TabsContent };
