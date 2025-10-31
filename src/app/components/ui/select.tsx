import React, { useState, useContext, createContext } from "react";

interface SelectContextType {
  open: boolean;
  setOpen: (open: boolean) => void;
  value: string;
  setValue: (value: string) => void;
}

const SelectContext = createContext<SelectContextType>({
  open: false,
  setOpen: () => {},
  value: "",
  setValue: () => {},
});

export const Select = ({ children }: { children: React.ReactNode }) => {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");

  return (
    <SelectContext.Provider value={{ open, setOpen, value, setValue }}>
      <div className="relative">{children}</div>
    </SelectContext.Provider>
  );
};

interface SelectTriggerProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children?: React.ReactNode;
}

export const SelectTrigger = React.forwardRef<
  HTMLButtonElement,
  SelectTriggerProps
>(({ children, className = "", ...props }, ref) => {
  const context = useContext(SelectContext);

  return (
    <button
      ref={ref}
      type="button"
      onClick={() => context.setOpen(!context.open)}
      className={`flex h-12 w-full items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-0 ${className}`}
      {...props}
    >
      {context.value || children}
      <svg
        className="h-5 w-5 text-gray-400"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M19 9l-7 7-7-7"
        />
      </svg>
    </button>
  );
});

SelectTrigger.displayName = "SelectTrigger";

export const SelectValue = ({
  children,
  placeholder,
}: {
  children?: React.ReactNode;
  placeholder?: string;
}) => {
  const context = useContext(SelectContext);

  return (
    <span className="text-left">
      {context.value || children || placeholder}
    </span>
  );
};

interface SelectContentProps {
  children: React.ReactNode;
}

export const SelectContent = ({ children }: SelectContentProps) => {
  const context = useContext(SelectContext);

  if (!context.open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-10"
        onClick={() => context.setOpen(false)}
      />
      <div className="absolute z-20 w-full mt-1 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg">
        <div className="py-1">{children}</div>
      </div>
    </>
  );
};

interface SelectItemProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string;
  children: React.ReactNode;
}

export const SelectItem = ({ value, children, ...props }: SelectItemProps) => {
  const context = useContext(SelectContext);

  return (
    <button
      type="button"
      onClick={() => {
        context.setValue(value);
        context.setOpen(false);
      }}
      className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 focus:bg-gray-50 focus:outline-none"
      {...props}
    >
      {children}
    </button>
  );
};
