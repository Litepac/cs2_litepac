import type { UtilityVisualKind } from "../replay/utilityPresentation";

type Props = {
  kind: UtilityVisualKind;
  className?: string;
  title?: string;
};

export function UtilityIcon({ kind, className, title }: Props) {
  return (
    <svg
      aria-hidden={title ? undefined : true}
      className={className}
      fill="none"
      viewBox="0 0 16 16"
      xmlns="http://www.w3.org/2000/svg"
    >
      {title ? <title>{title}</title> : null}
      {kind === "flashbang" ? <FlashbangIcon /> : null}
      {kind === "smoke" ? <SmokeIcon /> : null}
      {kind === "hegrenade" ? <HEIcon /> : null}
      {kind === "fire" || kind === "molotov" || kind === "incendiary" ? <FireIcon /> : null}
      {kind === "decoy" ? <DecoyIcon /> : null}
      {kind === "bomb" ? <BombIcon /> : null}
    </svg>
  );
}

function FlashbangIcon() {
  return (
    <>
      <rect x="4.75" y="1.95" width="5.5" height="11.05" rx="1.28" className="utility-icon-body-fill" />
      <rect x="4.75" y="1.95" width="5.5" height="11.05" rx="1.28" className="utility-icon-outline" />
      <rect x="6.05" y="0.35" width="2.9" height="1.62" rx="0.34" className="utility-icon-cap" />
      <path d="M9.02 1.45h1.12c.54 0 .98.44.98.98v1.58" className="utility-icon-outline" />
      <circle cx="11.75" cy="1.4" r="1.34" className="utility-icon-outline" />
      <path d="M7.5 4.45v6.15" className="utility-icon-accent" />
    </>
  );
}

function SmokeIcon() {
  return (
    <>
      <path d="M4.45 1.8c0-.98.75-1.72 1.74-1.72h2.02c1.1 0 1.9.8 1.9 1.92v10.05c0 1.09-.8 1.89-1.88 1.89H6.15c-.99 0-1.7-.73-1.7-1.73z" className="utility-icon-body-fill" />
      <path d="M4.45 1.8c0-.98.75-1.72 1.74-1.72h2.02c1.1 0 1.9.8 1.9 1.92v10.05c0 1.09-.8 1.89-1.88 1.89H6.15c-.99 0-1.7-.73-1.7-1.73z" className="utility-icon-outline" />
      <rect x="5.55" y="-0.15" width="3.7" height="1.38" rx="0.32" className="utility-icon-cap" />
      <rect x="9.95" y="3" width="2.05" height="6.9" rx="0.42" className="utility-icon-body-fill" />
      <rect x="9.95" y="3" width="2.05" height="6.9" rx="0.42" className="utility-icon-outline" />
      <path d="M5.75 3.85h3.15M5.75 5.95h3.15M5.75 8.05h3.15M5.75 10.15h3.15" className="utility-icon-accent" />
    </>
  );
}

function HEIcon() {
  return (
    <>
      <circle cx="7.05" cy="9.05" r="4.1" className="utility-icon-body-fill" />
      <circle cx="7.05" cy="9.05" r="4.1" className="utility-icon-outline" />
      <rect x="5.85" y="3.2" width="2.45" height="1.55" rx="0.38" className="utility-icon-cap" />
      <path d="M8.5 5.35l2.85-2.45" className="utility-icon-detail" />
      <circle cx="11.95" cy="2.45" r="1.12" className="utility-icon-outline" />
      <path d="M5.65 9.05h2.8M7.05 7.65v2.8" className="utility-icon-accent" />
    </>
  );
}

function FireIcon() {
  return (
    <>
      <path d="M5 5.55c0-.7.28-1.35.79-1.84l1.34-1.3c.33-.32.77-.49 1.23-.49h.17c.47 0 .91.18 1.24.51l1.08 1.1c.5.5.78 1.18.78 1.89v6.1c0 1.2-.88 2.08-2.05 2.08H7.05c-1.17 0-2.05-.88-2.05-2.08z" className="utility-icon-body-fill" />
      <path d="M5 5.55c0-.7.28-1.35.79-1.84l1.34-1.3c.33-.32.77-.49 1.23-.49h.17c.47 0 .91.18 1.24.51l1.08 1.1c.5.5.78 1.18.78 1.89v6.1c0 1.2-.88 2.08-2.05 2.08H7.05c-1.17 0-2.05-.88-2.05-2.08z" className="utility-icon-outline" />
      <rect x="7.55" y="0.75" width="1.05" height="1.75" rx="0.25" className="utility-icon-cap" />
      <path d="M8.65 1.4l1.7 1.95" className="utility-icon-outline" />
      <path d="M7.9 6.05c1 .63 1.38 1.37 1.18 2.18-.2.8-.76 1.42-1.55 1.79.18-.55.09-1.02-.25-1.38-.35-.37-.45-.79-.29-1.25.12-.36.43-.82.91-1.34z" className="utility-icon-accent-fill" />
    </>
  );
}

function DecoyIcon() {
  return (
    <>
      <rect x="4" y="4" width="8" height="8" rx="1.5" className="utility-icon-body" />
      <path d="M5.8 8h4.4M5.8 10.2h4.4" className="utility-icon-accent" />
      <path d="M8 4v8" className="utility-icon-detail" />
    </>
  );
}

function BombIcon() {
  return (
    <>
      <rect x="4.4" y="3.1" width="7.2" height="10" rx="1.5" className="utility-icon-body" />
      <rect x="6.5" y="1.7" width="3" height="1.7" rx="0.45" className="utility-icon-cap" />
      <rect x="6.2" y="5.1" width="3.6" height="1.4" rx="0.4" className="utility-icon-detail-fill" />
      <rect x="5.8" y="7.4" width="4.4" height="4.5" rx="0.5" className="utility-icon-outline" />
      <path d="M7 8.6h2M7 10h2.1" className="utility-icon-detail" />
    </>
  );
}
