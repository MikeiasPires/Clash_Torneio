const paths = {
  crown: 'm3 6 5 4 4-7 4 7 5-4-2 12H5L3 6Zm3 15h12',
  trophy: 'M7 3h10v5a5 5 0 0 1-10 0V3Zm0 2H3v3a4 4 0 0 0 4 4m10-7h4v3a4 4 0 0 1-4 4m-5 1v8m-5 0h10',
  history: 'm4 3 7 6-2 3-6-7 1-2Zm16 0-7 6 2 3 6-7-1-2ZM7 14l3 3M4 20l5-5m8-1-3 3m6 3-5-5M3 17l4 4m14-4-4 4',
  arrow: 'M5 12h14m-6-6 6 6-6 6',
  shield: 'm12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Zm-3 9 2 2 4-4',
}

export default function HomeIcon({ name }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>
}
