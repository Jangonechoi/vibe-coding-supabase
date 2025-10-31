import React from "react";

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "secondary" | "outline";
}

export function Badge({
  children,
  className = "",
  variant = "default",
  ...props
}: BadgeProps) {
  const baseStyles =
    "inline-flex items-center justify-center rounded-md text-xs font-medium";

  const variants = {
    default: "bg-gray-800 text-white",
    secondary: "bg-gray-100 text-gray-700",
    outline: "border border-gray-300 text-gray-700",
  };

  return (
    <span
      className={`${baseStyles} ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </span>
  );
}
