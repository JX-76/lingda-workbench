import React from 'react'

export default function MemeAgentLogo({ className = '' }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 200 200"
      width="100%"
      height="100%"
      className={className}
      aria-hidden="true"
    >
      <path fill="#1A1A1A" d="M 32 100 C 32 40 45 30 55 30 C 65 30 70 50 75 75 Z" />
      <path fill="#1A1A1A" d="M 168 100 C 168 40 155 30 145 30 C 135 30 130 50 125 75 Z" />
      <rect fill="#1A1A1A" x="30" y="65" width="140" height="115" rx="50" />
      <path d="M 100 70 C 100 45 110 35 120 30" stroke="#1A1A1A" strokeWidth="16" strokeLinecap="round" fill="none" />
      <circle fill="#1A1A1A" cx="125" cy="25" r="14" />
      <rect fill="#FFFFFF" x="48" y="85" width="104" height="72" rx="36" />
      <circle fill="#1A1A1A" cx="100" cy="162" r="15" />
      <rect fill="#1A1A1A" x="75" y="105" width="14" height="28" rx="7" />
      <rect fill="#1A1A1A" x="111" y="105" width="14" height="28" rx="7" />
    </svg>
  )
}
