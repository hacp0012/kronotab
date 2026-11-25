import React from 'react';

export interface IconProps extends React.SVGProps<SVGSVGElement> {
  size?: number;
}

const BaseSvg: React.FC<IconProps> = ({
  size = 15,
  className = '',
  children,
  ...props
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={`inline-block shrink-0 ${className}`}
    {...props}
  >
    {children}
  </svg>
);

export const IconTimer: React.FC<IconProps> = (props) => (
  <BaseSvg {...props}>
    <line x1="10" x2="14" y1="2" y2="2" />
    <line x1="12" x2="15" y1="14" y2="11" />
    <circle cx="12" cy="14" r="8" />
  </BaseSvg>
);

export const IconClock: React.FC<IconProps> = (props) => (
  <BaseSvg {...props}>
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </BaseSvg>
);

export const IconCheckCircle: React.FC<IconProps> = (props) => (
  <BaseSvg {...props}>
    <circle cx="12" cy="12" r="10" />
    <path d="m9 12 2 2 4-4" />
  </BaseSvg>
);

export const IconCircle: React.FC<IconProps> = (props) => (
  <BaseSvg {...props}>
    <circle cx="12" cy="12" r="9" />
  </BaseSvg>
);

export const IconHalfCircle: React.FC<IconProps> = (props) => (
  <BaseSvg {...props}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 3a9 9 0 0 1 0 18Z" fill="currentColor" stroke="none" />
  </BaseSvg>
);

export const IconCheck: React.FC<IconProps> = (props) => (
  <BaseSvg {...props}>
    <path d="M20 6 9 17l-5-5" />
  </BaseSvg>
);

export const IconNote: React.FC<IconProps> = (props) => (
  <BaseSvg {...props}>
    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" x2="8" y1="13" y2="13" />
    <line x1="16" x2="8" y1="17" y2="17" />
    <line x1="10" x2="8" y1="9" y2="9" />
  </BaseSvg>
);

export const IconKanban: React.FC<IconProps> = (props) => (
  <BaseSvg {...props}>
    <rect width="6" height="14" x="4" y="5" rx="1" />
    <rect width="6" height="10" x="14" y="5" rx="1" />
  </BaseSvg>
);

export const IconExternalLink: React.FC<IconProps> = (props) => (
  <BaseSvg {...props}>
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    <polyline points="15 3 21 3 21 9" />
    <line x1="10" x2="21" y1="14" y2="3" />
  </BaseSvg>
);

export const IconPipWindow: React.FC<IconProps> = (props) => (
  <BaseSvg {...props}>
    <rect x="2" y="4" width="20" height="16" rx="2" />
    <rect x="11" y="10" width="9" height="7" rx="1" />
  </BaseSvg>
);

export const IconPalette: React.FC<IconProps> = (props) => (
  <BaseSvg {...props}>
    <circle cx="13.5" cy="6.5" r=".5" fill="currentColor" />
    <circle cx="17.5" cy="10.5" r=".5" fill="currentColor" />
    <circle cx="8.5" cy="7.5" r=".5" fill="currentColor" />
    <circle cx="6.5" cy="12.5" r=".5" fill="currentColor" />
    <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z" />
  </BaseSvg>
);

export const IconMoreVertical: React.FC<IconProps> = (props) => (
  <BaseSvg {...props}>
    <circle cx="12" cy="12" r="1" />
    <circle cx="12" cy="5" r="1" />
    <circle cx="12" cy="19" r="1" />
  </BaseSvg>
);

export const IconPlus: React.FC<IconProps> = (props) => (
  <BaseSvg {...props}>
    <line x1="12" x2="12" y1="5" y2="19" />
    <line x1="5" x2="19" y1="12" y2="12" />
  </BaseSvg>
);

export const IconMinus: React.FC<IconProps> = (props) => (
  <BaseSvg {...props}>
    <line x1="5" x2="19" y1="12" y2="12" />
  </BaseSvg>
);

export const IconTrash: React.FC<IconProps> = (props) => (
  <BaseSvg {...props}>
    <path d="M3 6h18" />
    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
  </BaseSvg>
);

export const IconEdit: React.FC<IconProps> = (props) => (
  <BaseSvg {...props}>
    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
  </BaseSvg>
);

export const IconClose: React.FC<IconProps> = (props) => (
  <BaseSvg {...props}>
    <path d="M18 6 6 18" />
    <path d="m6 6 12 12" />
  </BaseSvg>
);

export const IconPlay: React.FC<IconProps> = (props) => (
  <BaseSvg {...props}>
    <polygon points="6 3 20 12 6 21 6 3" fill="currentColor" />
  </BaseSvg>
);

export const IconPause: React.FC<IconProps> = (props) => (
  <BaseSvg {...props}>
    <rect x="6" y="4" width="4" height="16" fill="currentColor" />
    <rect x="14" y="4" width="4" height="16" fill="currentColor" />
  </BaseSvg>
);

export const IconRotateCcw: React.FC<IconProps> = (props) => (
  <BaseSvg {...props}>
    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <path d="M3 3v5h5" />
  </BaseSvg>
);

export const IconVolume: React.FC<IconProps> = (props) => (
  <BaseSvg {...props}>
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
    <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
    <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
  </BaseSvg>
);

export const IconBell: React.FC<IconProps> = (props) => (
  <BaseSvg {...props}>
    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
    <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
  </BaseSvg>
);

export const IconRepeat: React.FC<IconProps> = (props) => (
  <BaseSvg {...props}>
    <path d="m17 2 4 4-4 4" />
    <path d="M3 11v-1a4 4 0 0 1 4-4h14" />
    <path d="m7 22-4-4 4-4" />
    <path d="M21 13v1a4 4 0 0 1-4 4H3" />
  </BaseSvg>
);

export const IconPin: React.FC<IconProps> = (props) => (
  <BaseSvg {...props}>
    <line x1="12" x2="12" y1="17" y2="22" />
    <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z" />
  </BaseSvg>
);

export const IconSearch: React.FC<IconProps> = (props) => (
  <BaseSvg {...props}>
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.3-4.3" />
  </BaseSvg>
);

export const IconFolder: React.FC<IconProps> = (props) => (
  <BaseSvg {...props}>
    <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
  </BaseSvg>
);

export const IconArrowRight: React.FC<IconProps> = (props) => (
  <BaseSvg {...props}>
    <path d="M5 12h14" />
    <path d="m12 5 7 7-7 7" />
  </BaseSvg>
);

export const IconPriorityLow: React.FC<IconProps> = (props) => (
  <BaseSvg {...props}>
    <path d="M12 5v14" />
    <path d="m19 12-7 7-7-7" />
  </BaseSvg>
);

export const IconPriorityMedium: React.FC<IconProps> = (props) => (
  <BaseSvg {...props}>
    <line x1="5" x2="19" y1="9" y2="9" />
    <line x1="5" x2="19" y1="15" y2="15" />
  </BaseSvg>
);

export const IconPriorityHigh: React.FC<IconProps> = (props) => (
  <BaseSvg {...props}>
    <path d="M12 19V5" />
    <path d="m5 12 7-7 7 7" />
  </BaseSvg>
);

export const IconInfo: React.FC<IconProps> = (props) => (
  <BaseSvg {...props}>
    <circle cx="12" cy="12" r="10" />
    <path d="M12 16v-4" />
    <path d="M12 8h.01" />
  </BaseSvg>
);

export const IconCopy: React.FC<IconProps> = (props) => (
  <BaseSvg {...props}>
    <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
    <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
  </BaseSvg>
);

export const IconListTree: React.FC<IconProps> = (props) => (
  <BaseSvg {...props}>
    <path d="M21 12h-8" />
    <path d="M21 6H8" />
    <path d="M21 18h-8" />
    <path d="M3 6v4c0 1.1.9 2 2 2h3" />
    <path d="M3 10v6c0 1.1.9 2 2 2h3" />
  </BaseSvg>
);

export const IconIndent: React.FC<IconProps> = (props) => (
  <BaseSvg {...props}>
    <polyline points="3 8 7 12 3 16" />
    <line x1="21" x2="11" y1="12" y2="12" />
    <line x1="21" x2="11" y1="6" y2="6" />
    <line x1="21" x2="11" y1="18" y2="18" />
  </BaseSvg>
);

export const IconOutdent: React.FC<IconProps> = (props) => (
  <BaseSvg {...props}>
    <polyline points="7 8 3 12 7 16" />
    <line x1="21" x2="11" y1="12" y2="12" />
    <line x1="21" x2="11" y1="6" y2="6" />
    <line x1="21" x2="11" y1="18" y2="18" />
  </BaseSvg>
);

export const IconGripVertical: React.FC<IconProps> = (props) => (
  <BaseSvg {...props}>
    <circle cx="9" cy="12" r="1" fill="currentColor" />
    <circle cx="9" cy="5" r="1" fill="currentColor" />
    <circle cx="9" cy="19" r="1" fill="currentColor" />
    <circle cx="15" cy="12" r="1" fill="currentColor" />
    <circle cx="15" cy="5" r="1" fill="currentColor" />
    <circle cx="15" cy="19" r="1" fill="currentColor" />
  </BaseSvg>
);

export const IconBold: React.FC<IconProps> = (props) => (
  <BaseSvg {...props}>
    <path d="M6 12h9a4 4 0 0 1 0 8H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h7a4 4 0 0 1 0 8" />
  </BaseSvg>
);

export const IconItalic: React.FC<IconProps> = (props) => (
  <BaseSvg {...props}>
    <line x1="19" x2="10" y1="4" y2="4" />
    <line x1="14" x2="5" y1="20" y2="20" />
    <line x1="15" x2="9" y1="4" y2="20" />
  </BaseSvg>
);

export const IconUnderline: React.FC<IconProps> = (props) => (
  <BaseSvg {...props}>
    <path d="M6 4v6a6 6 0 0 0 12 0V4" />
    <line x1="4" x2="20" y1="20" y2="20" />
  </BaseSvg>
);

export const IconStrikethrough: React.FC<IconProps> = (props) => (
  <BaseSvg {...props}>
    <path d="M16 4H9a3 3 0 0 0-2.83 4" />
    <path d="M14 12a4 4 0 0 1 0 8H6" />
    <line x1="4" x2="20" y1="12" y2="12" />
  </BaseSvg>
);

export const IconClearFormat: React.FC<IconProps> = (props) => (
  <BaseSvg {...props}>
    <path d="M4 7V4h16v3" />
    <path d="M5 20h6" />
    <path d="M13 4 8 20" />
    <path d="m15 15 5 5" />
    <path d="m20 15-5 5" />
  </BaseSvg>
);

export const IconTextColor: React.FC<IconProps> = (props) => (
  <BaseSvg {...props}>
    <path d="M4 20h16" />
    <path d="m6 16 6-12 6 12" />
    <path d="M8 12h8" />
  </BaseSvg>
);

export const IconHighlighter: React.FC<IconProps> = (props) => (
  <BaseSvg {...props}>
    <path d="m9 11-6 6v3h9l3-3" />
    <path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4" />
  </BaseSvg>
);

export const IconListBullet: React.FC<IconProps> = (props) => (
  <BaseSvg {...props}>
    <line x1="8" x2="21" y1="6" y2="6" />
    <line x1="8" x2="21" y1="12" y2="12" />
    <line x1="8" x2="21" y1="18" y2="18" />
    <line x1="3" x2="3.01" y1="6" y2="6" />
    <line x1="3" x2="3.01" y1="12" y2="12" />
    <line x1="3" x2="3.01" y1="18" y2="18" />
  </BaseSvg>
);

export const IconListOrdered: React.FC<IconProps> = (props) => (
  <BaseSvg {...props}>
    <line x1="10" x2="21" y1="6" y2="6" />
    <line x1="10" x2="21" y1="12" y2="12" />
    <line x1="10" x2="21" y1="18" y2="18" />
    <path d="M4 6h1v4" />
    <path d="M4 10h2" />
    <path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1" />
  </BaseSvg>
);

export const IconQuote: React.FC<IconProps> = (props) => (
  <BaseSvg {...props}>
    <path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z" />
    <path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z" />
  </BaseSvg>
);

export const IconSettings: React.FC<IconProps> = (props) => (
  <BaseSvg {...props}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </BaseSvg>
);

export const IconSidebar: React.FC<IconProps> = (props) => (
  <BaseSvg {...props}>
    <rect width="18" height="18" x="3" y="3" rx="2" />
    <path d="M9 3v18" />
  </BaseSvg>
);

export const IconChevronRight: React.FC<IconProps> = (props) => (
  <BaseSvg {...props}>
    <path d="m9 18 6-6-6-6" />
  </BaseSvg>
);

export const IconChevronDown: React.FC<IconProps> = (props) => (
  <BaseSvg {...props}>
    <path d="m6 9 6 6 6-6" />
  </BaseSvg>
);

export const IconChevronLeft: React.FC<IconProps> = (props) => (
  <BaseSvg {...props}>
    <path d="m15 18-6-6 6-6" />
  </BaseSvg>
);

export const IconWrapText: React.FC<IconProps> = (props) => (
  <BaseSvg {...props}>
    <line x1="3" x2="21" y1="6" y2="6" />
    <path d="M3 12h15a3 3 0 1 1 0 6h-4" />
    <polyline points="16 16 14 18 16 20" />
    <line x1="3" x2="10" y1="18" y2="18" />
  </BaseSvg>
);

export const IconSpellCheck: React.FC<IconProps> = (props) => (
  <BaseSvg {...props}>
    <path d="m6 16 6-12 6 12" />
    <path d="M8 12h8" />
    <path d="m16 20 2 2 4-4" />
  </BaseSvg>
);

export const IconLink: React.FC<IconProps> = (props) => (
  <BaseSvg {...props}>
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
  </BaseSvg>
);

export const IconMoreHorizontal: React.FC<IconProps> = (props) => (
  <BaseSvg {...props}>
    <circle cx="12" cy="12" r="1.2" fill="currentColor" />
    <circle cx="5" cy="12" r="1.2" fill="currentColor" />
    <circle cx="19" cy="12" r="1.2" fill="currentColor" />
  </BaseSvg>
);

export const IconCheckbox: React.FC<IconProps> = (props) => (
  <BaseSvg {...props}>
    <rect x="3" y="3" width="18" height="18" rx="3.5" />
    <path d="m8 12.5 2.5 2.5 5.5-5.5" />
  </BaseSvg>
);

export const IconTriStateCheckbox: React.FC<IconProps> = (props) => (
  <BaseSvg {...props}>
    <rect x="3" y="3" width="18" height="18" rx="3.5" />
    <path d="M3 12h18" opacity="0.25" />
    <path d="M8 12h8" strokeWidth="2.3" />
    <circle cx="12" cy="12" r="2.2" fill="currentColor" stroke="none" />
  </BaseSvg>
);



