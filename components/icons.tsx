type IconProps = { className?: string };

function Icon({ children, className }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      className={`understudy-icon ${className ?? ""}`}
      width="18"
      height="18"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden
      focusable="false"
      data-understudy-icon="true"
    >
      {children}
    </svg>
  );
}

export function IconHome(props: IconProps) {
  return <Icon {...props}><path d="M2.5 7.1 8 2.5l5.5 4.6v6.1a.8.8 0 0 1-.8.8H3.3a.8.8 0 0 1-.8-.8V7.1Z" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round"/><path d="M6.2 14v-4h3.6v4" stroke="currentColor" strokeWidth="1.25"/></Icon>;
}

export function IconTransition(props: IconProps) {
  return <Icon {...props}><path d="M2.5 5h8.7M8.8 2.6 11.3 5 8.8 7.4M13.5 11H4.8M7.2 8.6 4.7 11l2.5 2.4" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/></Icon>;
}

export function IconContinuity(props: IconProps) {
  return <Icon {...props}><path d="M2 11.8V8.7m4 3.1V4.2m4 7.6V6.5m4 5.3V2.8" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round"/></Icon>;
}

export function IconAsk(props: IconProps) {
  return <Icon {...props}><circle cx="8" cy="8" r="5.7" stroke="currentColor" strokeWidth="1.25"/><path d="M6.2 6.1a2 2 0 0 1 3.8.8c0 1.3-2 1.6-2 2.9" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/><circle cx="8" cy="12" r=".75" fill="currentColor"/></Icon>;
}

export function IconPlug(props: IconProps) {
  return <Icon {...props}><path d="M6 2.5v3M10 2.5v3M4.2 5.4h7.6v1.3A3.8 3.8 0 0 1 8 10.5v3" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/></Icon>;
}

export function IconChevronRight(props: IconProps) {
  return <Icon {...props}><path d="m6 3.5 4.5 4.5L6 12.5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/></Icon>;
}

export function IconPlus(props: IconProps) {
  return <Icon {...props}><path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/></Icon>;
}

export function IconFile(props: IconProps) {
  return <Icon {...props}><path d="M4 1.8h5l3 3V14H4V1.8Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/><path d="M9 1.8v3h3M6 8h4M6 10.5h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></Icon>;
}

export function IconGithub(props: IconProps) {
  return <Icon {...props}><path d="M8 2.1a5.9 5.9 0 0 0-1.9 11.5c.3 0 .4-.1.4-.3v-1.1c-1.8.4-2.2-.8-2.2-.8-.3-.7-.7-.9-.7-.9-.6-.4 0-.4 0-.4.6 0 1 .7 1 .7.6 1 1.5.7 1.9.5.1-.4.2-.7.4-.8-1.4-.2-2.9-.7-2.9-3a2.4 2.4 0 0 1 .6-1.7c-.1-.2-.3-.8.1-1.7 0 0 .5-.2 1.8.6A6 6 0 0 1 8 4.5c.5 0 1.1.1 1.6.2 1.2-.8 1.8-.6 1.8-.6.4.9.2 1.5.1 1.7.4.5.6 1.1.6 1.7 0 2.3-1.5 2.8-2.9 3 .2.2.4.6.4 1.2v1.6c0 .2.1.4.4.3A5.9 5.9 0 0 0 8 2.1Z" fill="currentColor"/></Icon>;
}

export function IconSpark(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="4" cy="8" r="1.45" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="11.8" cy="4.2" r="1.45" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="11.8" cy="11.8" r="1.45" stroke="currentColor" strokeWidth="1.2" />
      <path d="M5.3 7.35 10.5 4.85M5.3 8.65l5.2 2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </Icon>
  );
}

export function IconMessage(props: IconProps) {
  return <Icon {...props}><path d="M2.3 3.2h11.4v7.7H7l-3.6 2.3v-2.3H2.3V3.2Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/><path d="M5 6h6M5 8.2h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></Icon>;
}

export function IconCheck(props: IconProps) {
  return <Icon {...props}><path d="m3.2 8.3 3 3 6.6-6.6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></Icon>;
}

export function IconAlert(props: IconProps) {
  return <Icon {...props}><path d="M8 2.1 14 13H2L8 2.1Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/><path d="M8 6v3.2M8 11.3v.1" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></Icon>;
}

export function IconClock(props: IconProps) {
  return <Icon {...props}><circle cx="8" cy="8" r="5.7" stroke="currentColor" strokeWidth="1.2"/><path d="M8 4.8v3.5l2.4 1.4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></Icon>;
}

export function IconSearch(props: IconProps) {
  return <Icon {...props}><circle cx="7" cy="7" r="4.3" stroke="currentColor" strokeWidth="1.25"/><path d="m10.2 10.2 3.1 3.1" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/></Icon>;
}

export function IconUpload(props: IconProps) {
  return <Icon {...props}><path d="M8 10.5V2.8M5.2 5.6 8 2.8l2.8 2.8M3 9.5v3.2h10V9.5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/></Icon>;
}

export function IconKnowledge(props: IconProps) { return <IconFile {...props} />; }
export function IconCapture(props: IconProps) { return <IconMessage {...props} />; }
export function IconCoverage(props: IconProps) { return <IconContinuity {...props} />; }
