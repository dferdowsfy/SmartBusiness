import { Waypoints } from "lucide-react";

type SmartPRLogoProps = {
  className?: string;
  inverted?: boolean;
  iconSize?: number;
  size?: "app" | "auth" | "landing";
};

/** Shared SmartPR brand lockup. Keep all product surfaces on one mark. */
export function SmartPRLogo({ className = "", inverted = false, iconSize = 20, size }: SmartPRLogoProps) {
  return (
    <span className={`smartpr-logo ${size ? `smartpr-logo-${size}` : ""} ${inverted ? "smartpr-logo-inverted" : ""} ${className}`.trim()}>
      <span className="smartpr-logo-mark"><Waypoints size={iconSize} strokeWidth={2.4} aria-hidden /></span>
      <span className="smartpr-logo-wordmark">Smart<span>PR</span></span>
    </span>
  );
}
