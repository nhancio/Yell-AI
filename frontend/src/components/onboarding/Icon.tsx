const paths: Record<string, string[]> = {
  email: ["M4 5h16v14H4z", "m4 7 8 5 8-5"],
  calendar: ["M5 5h14v15H5z", "M8 3v4m8-4v4M5 10h14M8 13h2m4 0h2m-8 3h2"],
  reminders: ["M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18", "M12 7v5l3 2"],
  notes: ["M12 21H5V3h12v8", "M8 7h6M8 11h3m3 10 6-6-3-3-6 6-1 4z"],
  research: ["M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14", "m15 12 6 7"],
  news: ["M5 3h10l4 4v14H5z", "M14 3v5h5M8 12h8m-8 4h8"],
  automations: ["M11 19H5V4h14v7", "m12 11 9 3-4 2-2 4z"],
  daily_brief: ["M4 5h12M4 10h8M4 15h5", "m17 10 1.5 4.5L23 16l-4.5 1.5L17 22l-1.5-4.5L11 16l4.5-1.5z"],
  sports: ["M7 3h10v5a5 5 0 0 1-10 0z", "M7 5H3v3a4 4 0 0 0 4 4m10-7h4v3a4 4 0 0 1-4 4m-5 1v6m-5 2h10"],
  travel: ["m3 10 18-7-7 18-3-8-8-3z", "m11 13 5-5"],
  images: ["M4 4h16v16H4z", "M8 7h.01M4 16l5-5 4 4 3-3 4 4"],
  finances: ["M3 6h18v14H3zM3 6V3h15v3M3 10h18", "M16 15h2"],
  shopping: ["M5 8h14l2 13H3z", "M8 8V6a4 4 0 0 1 8 0v2"],
  reservations: ["M4 3v6a3 3 0 0 0 6 0V3M7 3v18M16 21V3c-4 2-4 9 0 10h3V3"],
  coding: ["m8 6-6 6 6 6m8-12 6 6-6 6"],
  check: ["m5 12 4 4L19 6"], arrow: ["M5 12h14m-5-5 5 5-5 5"],
  link: ["m10 14 4-4M8 16l-1 1a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0m2 10a4 4 0 0 0 6 0l4-4a4 4 0 0 0-6-6l-1 1"],
};

export default function Icon({ name, size = 15 }: { name: string; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    {(paths[name] || paths.link).map((d, i) => <path key={i} d={d} />)}
  </svg>;
}
