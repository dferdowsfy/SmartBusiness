type SmartPRLogoProps = {
  className?: string;
  inverted?: boolean;
  iconSize?: number;
  size?: "app" | "auth" | "landing";
};

/** Text-only SmartPR wordmark. No icon. */
export function SmartPRLogo({ className = "", inverted = false, size }: SmartPRLogoProps) {
  return (
    <span
      className={`smartpr-logo ${size ? `smartpr-logo-${size}` : ""} ${inverted ? "smartpr-logo-inverted" : ""} ${className}`.trim()}
    >
      <span className="smartpr-logo-wordmark">SmartPR</span>
    </span>
  );
}
