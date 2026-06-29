import * as React from "react";
import { cn } from "@/lib/cn";

/**
 * Shared button — salarymap sizing/weight/motion ported onto vtm's Toss
 * blue palette. Bold label, fixed heights, soft shadow, spring press.
 */
type Variant = "primary" | "secondary" | "outline" | "ghost" | "destructive" | "soft";
type Size = "sm" | "md" | "lg" | "icon";

const base =
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-xl font-bold " +
  "transition-all duration-200 ease-spring active:scale-[0.98] " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 focus-visible:ring-offset-2 " +
  "disabled:pointer-events-none disabled:opacity-50";

const variants: Record<Variant, string> = {
  primary:
    "bg-blue-500 text-white shadow-soft-sm hover:bg-blue-600 hover:shadow-brand",
  secondary:
    "bg-gray-100 text-gray-800 shadow-soft-xs hover:bg-gray-200",
  outline:
    "border border-gray-200 bg-white text-gray-800 shadow-soft-xs hover:bg-gray-50",
  ghost:
    "text-gray-700 hover:bg-gray-100",
  destructive:
    "bg-red-500 text-white shadow-soft-xs hover:opacity-90",
  soft:
    "bg-blue-50 text-blue-600 hover:bg-blue-100",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-2.5 text-[12px]",
  md: "h-9 px-4 text-[13px]",
  lg: "h-11 px-6 text-sm",
  icon: "h-9 w-9",
};

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", ...props }, ref) => (
    <button
      ref={ref}
      className={cn(base, variants[variant], sizes[size], className)}
      {...props}
    />
  )
);
Button.displayName = "Button";
