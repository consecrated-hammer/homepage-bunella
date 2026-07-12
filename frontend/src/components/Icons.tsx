import type { SVGProps } from 'react'

// Lightweight, dependency-free icon set (stroke-based, 24px grid, currentColor).
// Keeps the Docker build offline and the bundle tiny.

type IconProps = SVGProps<SVGSVGElement> & { filled?: boolean }

function Svg({ children, className = 'h-5 w-5', strokeWidth = 1.75, ...props }: SVGProps<SVGSVGElement> & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth as number}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  )
}

export const ImageIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <circle cx="9" cy="9" r="1.6" />
    <path d="m21 15-4.5-4.5a2 2 0 0 0-2.8 0L3 21" />
  </Svg>
)

export const LayersIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="m12 3 9 5-9 5-9-5 9-5Z" />
    <path d="m3 13 9 5 9-5" />
  </Svg>
)

export const HardDriveIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3" y="13" width="18" height="6" rx="2" />
    <path d="M5.5 13 8 5h8l2.5 8" />
    <circle cx="7" cy="16" r="0.6" fill="currentColor" />
  </Svg>
)

export const DatabaseIcon = (p: IconProps) => (
  <Svg {...p}>
    <ellipse cx="12" cy="5" rx="8" ry="3" />
    <path d="M4 5v6c0 1.66 3.58 3 8 3s8-1.34 8-3V5" />
    <path d="M4 11v6c0 1.66 3.58 3 8 3s8-1.34 8-3v-6" />
  </Svg>
)

export const HeartIcon = ({ filled, ...p }: IconProps) => (
  <Svg fill={filled ? 'currentColor' : 'none'} {...p}>
    <path d="M19 5.5a4.4 4.4 0 0 0-6.2 0l-.8.8-.8-.8a4.4 4.4 0 1 0-6.2 6.2l7 7 7-7a4.4 4.4 0 0 0 0-6.2Z" />
  </Svg>
)

export const StarIcon = ({ filled, ...p }: IconProps) => (
  <Svg fill={filled ? 'currentColor' : 'none'} {...p}>
    <path d="m12 3 2.6 5.3 5.9.9-4.2 4.1 1 5.8L12 16.9 6.7 19.6l1-5.8L3.5 9.7l5.9-.9L12 3Z" />
  </Svg>
)

export const RepeatIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="m17 2 4 4-4 4" />
    <path d="M3 11V9a4 4 0 0 1 4-4h14" />
    <path d="m7 22-4-4 4-4" />
    <path d="M21 13v2a4 4 0 0 1-4 4H3" />
  </Svg>
)

export const MonitorIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3" y="4" width="18" height="12" rx="2" />
    <path d="M8 20h8M12 16v4" />
  </Svg>
)

export const TrashIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 7h16" />
    <path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    <path d="M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" />
    <path d="M10 11v6M14 11v6" />
  </Svg>
)

export const SparklesIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3v4M12 17v4M3 12h4M17 12h4" />
    <path d="m6.5 6.5 1.8 1.8M15.7 15.7l1.8 1.8M17.5 6.5l-1.8 1.8M8.3 15.7l-1.8 1.8" />
  </Svg>
)

export const EyeIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
    <circle cx="12" cy="12" r="2.5" />
  </Svg>
)

export const CheckIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="m5 12 5 5L20 7" />
  </Svg>
)

export const PlusIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
)

export const SearchIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="m21 21-4.3-4.3" />
  </Svg>
)

export const XIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Svg>
)

export const ArrowUpIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 19V5M6 11l6-6 6 6" />
  </Svg>
)

export const ArrowDownIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 5v14M6 13l6 6 6-6" />
  </Svg>
)

export const UploadIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 16V4M8 8l4-4 4 4" />
    <path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
  </Svg>
)

export const SlidersIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 6h11M19 6h1M4 12h3M11 12h9M4 18h7M15 18h5" />
    <circle cx="17" cy="6" r="2" />
    <circle cx="9" cy="12" r="2" />
    <circle cx="13" cy="18" r="2" />
  </Svg>
)

export const WrenchIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M15 6.5a3.5 3.5 0 0 0-4.6 4.3l-6 6a1.5 1.5 0 0 0 2.1 2.1l6-6A3.5 3.5 0 0 0 17.5 9l-2 2-2-2 2-2Z" />
  </Svg>
)

export const KeyIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="8" cy="8" r="4" />
    <path d="m11 11 9 9M16 16l2-2M19 19l2-2" />
  </Svg>
)

export const LogOutIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4" />
    <path d="M10 12H3M6 8l-4 4 4 4" />
  </Svg>
)

export const ExternalLinkIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M14 4h6v6" />
    <path d="M20 4 10 14" />
    <path d="M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4" />
  </Svg>
)

export const ClockIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </Svg>
)

export const RectHorizontalIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3" y="6" width="18" height="12" rx="2" />
  </Svg>
)

export const RectVerticalIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="6" y="3" width="12" height="18" rx="2" />
  </Svg>
)

export const GridIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3" y="3" width="7" height="7" rx="1.5" />
    <rect x="14" y="3" width="7" height="7" rx="1.5" />
    <rect x="3" y="14" width="7" height="7" rx="1.5" />
    <rect x="14" y="14" width="7" height="7" rx="1.5" />
  </Svg>
)

export const SaveIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 4h11l3 3v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z" />
    <path d="M8 4v5h7V4M8 21v-6h8v6" />
  </Svg>
)

export const UndoIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M9 7 4 12l5 5" />
    <path d="M4 12h11a5 5 0 0 1 0 10h-2" />
  </Svg>
)

export const PaletteIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3a9 9 0 0 0 0 18c1.1 0 2-.9 2-2 0-.5-.2-1-.5-1.3-.3-.4-.5-.8-.5-1.2 0-1 .8-1.8 1.8-1.8H16a5 5 0 0 0 5-5c0-3.9-4-6.7-9-6.7Z" />
    <circle cx="7.5" cy="11.5" r="1" fill="currentColor" stroke="none" />
    <circle cx="10.5" cy="7.5" r="1" fill="currentColor" stroke="none" />
    <circle cx="15" cy="8" r="1" fill="currentColor" stroke="none" />
  </Svg>
)

export const CropIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 2v14a1 1 0 0 0 1 1h11" />
    <path d="M2 6h14a1 1 0 0 1 1 1v11" />
  </Svg>
)

export const AlertIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 4 2.5 20h19L12 4Z" />
    <path d="M12 10v4M12 17.5v.1" />
  </Svg>
)

export const FilmIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <path d="M7 4v16M17 4v16M3 9h4M3 15h4M17 9h4M17 15h4" />
  </Svg>
)

export const GearIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="m10.2 3.6.5 1.9a6.8 6.8 0 0 1 2.6 0l.5-1.9 2.4 1-.5 1.9a7 7 0 0 1 1.8 1.8l1.9-.5 1 2.4-1.9.5a6.8 6.8 0 0 1 0 2.6l1.9.5-1 2.4-1.9-.5a7 7 0 0 1-1.8 1.8l.5 1.9-2.4 1-.5-1.9a6.8 6.8 0 0 1-2.6 0l-.5 1.9-2.4-1 .5-1.9a7 7 0 0 1-1.8-1.8l-1.9.5-1-2.4 1.9-.5a6.8 6.8 0 0 1 0-2.6l-1.9-.5 1-2.4 1.9.5a7 7 0 0 1 1.8-1.8l-.5-1.9 2.4-1Z" />
    <circle cx="12" cy="12" r="2.75" />
  </Svg>
)

export const LockIcon = (p: IconProps) => (
  <Svg strokeWidth={2} {...p}>
    <rect x="5" y="11" width="14" height="9" rx="2" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </Svg>
)

export const TextIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 6h16M4 12h10M4 18h13" />
  </Svg>
)

export const ChevronUpDownIcon = (p: IconProps) => (
  <Svg strokeWidth={2} {...p}>
    <path d="m8 9 4-4 4 4M8 15l4 4 4-4" />
  </Svg>
)

export const ChevronRightIcon = (p: IconProps) => (
  <Svg strokeWidth={2} {...p}>
    <path d="m9 6 6 6-6 6" />
  </Svg>
)

export const CheckCircleIcon = ({ filled, ...p }: IconProps) => (
  <Svg {...p}>
    {filled ? (
      <>
        <circle cx="12" cy="12" r="9" fill="currentColor" stroke="none" />
        <path d="m8 12 2.5 2.5L16 9" stroke="#fff" />
      </>
    ) : (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="m8 12 2.5 2.5L16 9" />
      </>
    )}
  </Svg>
)
