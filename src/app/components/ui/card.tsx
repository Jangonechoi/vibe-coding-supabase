import React from "react";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
}

export function Card({ className, children, ...props }: CardProps) {
  return (
    <div
      className={`bg-white border border-gray-200 rounded-xl overflow-hidden ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
