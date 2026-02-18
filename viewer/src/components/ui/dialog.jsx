import * as React from 'react';
import { cn } from '../../lib/utils';

const DialogContext = React.createContext({
  open: false,
  onOpenChange: () => {},
});

function Dialog({ open, onOpenChange, children }) {
  React.useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && open) {
        onOpenChange(false);
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [open, onOpenChange]);

  return (
    <DialogContext.Provider value={{ open, onOpenChange }}>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <DialogOverlay onClick={() => onOpenChange(false)} />
          {children}
        </div>
      )}
    </DialogContext.Provider>
  );
}

function DialogOverlay({ className, onClick }) {
  return (
    <div
      className={cn(
        'fixed inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in',
        className
      )}
      onClick={onClick}
    />
  );
}

function DialogContent({ className, children, ...props }) {
  return (
    <div
      className={cn(
        'relative z-50 w-full max-w-lg bg-background p-6 shadow-lg sm:rounded-lg border animate-in zoom-in-95 fade-in-0',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

function DialogHeader({ className, children, ...props }) {
  return (
    <div
      className={cn('flex flex-col space-y-1.5 text-center sm:text-left mb-4', className)}
      {...props}
    >
      {children}
    </div>
  );
}

function DialogTitle({ className, children, ...props }) {
  return (
    <h2
      className={cn('text-lg font-semibold leading-none tracking-tight', className)}
      {...props}
    >
      {children}
    </h2>
  );
}

function DialogDescription({ className, children, ...props }) {
  return (
    <p className={cn('text-sm text-muted-foreground', className)} {...props}>
      {children}
    </p>
  );
}

function DialogClose({ className, children, onClick, ...props }) {
  const { onOpenChange } = React.useContext(DialogContext);

  return (
    <button
      className={cn(
        'absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none',
        className
      )}
      onClick={(e) => {
        onClick?.(e);
        onOpenChange(false);
      }}
      {...props}
    >
      {children || (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      )}
    </button>
  );
}

export {
  Dialog,
  DialogOverlay,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogClose,
};
