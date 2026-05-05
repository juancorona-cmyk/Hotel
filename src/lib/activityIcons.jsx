const P = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: '1.6' }

export function getActivityIcon(name = '') {
  const n = name.toLowerCase()

  if (/yoga|meditac/.test(n))
    return (
      <svg {...P}>
        <path d="M12 2a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" transform="translate(0 4)"/>
        <path d="M6 12c0-2 1.5-4 6-4s6 2 6 4"/>
        <path d="M3 16c1-2 2.5-3 4-3l5 5 5-5c1.5 0 3 1 4 3"/>
        <path d="M7 12l-3 4M17 12l3 4"/>
      </svg>
    )

  if (/pilates/.test(n))
    return (
      <svg {...P}>
        <circle cx="12" cy="4" r="2"/>
        <path d="M12 6v6"/>
        <path d="M8 10l4 2 4-2"/>
        <path d="M10 18l2-4 2 4"/>
        <path d="M6 14c1.5 1.5 3 2 6 2s4.5-.5 6-2"/>
      </svg>
    )

  if (/nata|swim|piscin|alber/.test(n))
    return (
      <svg {...P}>
        <path d="M2 16c1.5-1.5 3-2 4.5-2s3 1.5 4.5 2 3-.5 4.5-2 3-2 4.5-2"/>
        <path d="M2 12c1.5-1.5 3-2 4.5-2s3 1.5 4.5 2 3-.5 4.5-2 3-2 4.5-2"/>
        <circle cx="16" cy="5.5" r="1.5"/>
        <path d="M19 7.5l-5-2"/>
      </svg>
    )

  if (/bail|danz|zumba/.test(n))
    return (
      <svg {...P}>
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
      </svg>
    )

  if (/cocin|chef|gastro|taller de/.test(n))
    return (
      <svg {...P}>
        <path d="M18 8h1a4 4 0 0 1 0 8h-1"/>
        <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/>
        <line x1="6" y1="1" x2="6" y2="4"/>
        <line x1="10" y1="1" x2="10" y2="4"/>
        <line x1="14" y1="1" x2="14" y2="4"/>
      </svg>
    )

  if (/fitness|gym|pesas|entrena|ejerc/.test(n))
    return (
      <svg {...P}>
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
      </svg>
    )

  if (/camin|sende|trote|jogg|corr/.test(n))
    return (
      <svg {...P}>
        <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
        <polyline points="17 6 23 6 23 12"/>
      </svg>
    )

  if (/music|concierto|cantante|banda|grupo/.test(n))
    return (
      <svg {...P}>
        <path d="M9 18V5l12-2v13"/>
        <circle cx="6" cy="18" r="3"/>
        <circle cx="18" cy="16" r="3"/>
      </svg>
    )

  if (/tenis|padel|pádel/.test(n))
    return (
      <svg {...P}>
        <circle cx="12" cy="12" r="10"/>
        <path d="M3.6 6.5c2.5 0 4.5 3 6 5.5s3.5 5.5 6 5.5"/>
        <path d="M20.4 6.5c-2.5 0-4.5 3-6 5.5s-3.5 5.5-6 5.5"/>
      </svg>
    )

  if (/futbol|fútbol|soccer|deport|pelota/.test(n))
    return (
      <svg {...P}>
        <circle cx="12" cy="12" r="10"/>
        <path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>
        <path d="M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M19.1 4.9l-2.8 2.8M7.7 16.3l-2.8 2.8"/>
      </svg>
    )

  // default: calendar event
  return (
    <svg {...P}>
      <rect x="3" y="4" width="18" height="18" rx="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/>
      <line x1="8" y1="2" x2="8" y2="6"/>
      <line x1="3" y1="10" x2="21" y2="10"/>
      <path d="M8 15l3 3 5-5"/>
    </svg>
  )
}
