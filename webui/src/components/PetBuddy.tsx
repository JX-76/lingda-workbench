import React, { useMemo } from 'react'
import { useChatStore } from '../store/chatStore'

function getDeviceSeed() {
  if (typeof window === 'undefined') return 'default-device'
  const key = 'buddy_device_seed'
  let seed = localStorage.getItem(key)
  if (!seed) {
    seed = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
    localStorage.setItem(key, seed)
  }
  return seed
}

function hashString(input: string) {
  let hash = 0
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

function pick<T>(list: T[], seed: number, offset = 0) {
  return list[(seed + offset) % list.length]
}

export default function PetBuddy({ className = '' }: { className?: string }) {
  const isStreaming = useChatStore(state => state.isStreaming)
  const pendingApproval = useChatStore(state => state.pendingApproval)
  const streamStatus = useChatStore(state => state.streamStatus)

  const isAlert = pendingApproval !== null || streamStatus === 'error'
  const isThinking = isStreaming && !isAlert

  const seed = useMemo(() => hashString(getDeviceSeed()), [])

  const color = isAlert ? '#ef4444' : isThinking ? '#3b82f6' : '#333333'
  const eyeColor = '#ffffff'

  const antennaType = pick(['v', 'straight', 'split'], seed, 1)
  const earType = pick(['rect', 'round', 'short', 'blob', 'ghost', 'penguin'], seed, 2)
  const eyeType = pick(['pill', 'round', 'line', 'blob', 'ghost', 'penguin'], seed, 3)
  const accentType = pick(['none', 'chin', 'dots', 'axolotl', 'ghost', 'cat'], seed, 4)

  const renderAntenna = () => {
    if (antennaType === 'straight') {
      return (
        <>
          <path d="M32 8V20" stroke={color} strokeWidth="4" strokeLinecap="round" />
          <circle cx="32" cy="7" r="3" fill={color} />
        </>
      )
    }
    if (antennaType === 'split') {
      return (
        <>
          <path d="M27 10L32 18L37 10" stroke={color} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="27" cy="9" r="2.5" fill={color} />
          <circle cx="37" cy="9" r="2.5" fill={color} />
        </>
      )
    }
    // Default 'v' shape
    return <path d="M26 12L32 20L38 12" stroke={color} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
  }

  const renderEars = () => {
    if (earType === 'round') {
      return (
        <>
          <circle cx="12" cy="36" r="5" fill={color} />
          <circle cx="52" cy="36" r="5" fill={color} />
        </>
      )
    }
    if (earType === 'short') {
      return (
        <>
          <rect x="10" y="32" width="6" height="8" rx="3" fill={color} />
          <rect x="48" y="32" width="6" height="8" rx="3" fill={color} />
        </>
      )
    }
    if (earType === 'blob') {
      return (
        <>
          <path d="M16 28 C 12 28, 8 32, 10 38 C 12 42, 16 42, 16 42" fill="none" stroke={color} strokeWidth="4" />
          <path d="M48 28 C 52 28, 56 32, 54 38 C 52 42, 48 42, 48 42" fill="none" stroke={color} strokeWidth="4" />
        </>
      )
    }
    if (earType === 'ghost') {
      return (
        <>
          <path d="M16 32 C 10 32, 8 38, 12 44" fill="none" stroke={color} strokeWidth="4" strokeLinecap="round" />
          <path d="M48 32 C 54 32, 56 38, 52 44" fill="none" stroke={color} strokeWidth="4" strokeLinecap="round" />
        </>
      )
    }
    if (earType === 'penguin') {
       return (
         <>
           <path d="M16 28 L 8 40" stroke={color} strokeWidth="4" strokeLinecap="round" />
           <path d="M48 28 L 56 40" stroke={color} strokeWidth="4" strokeLinecap="round" />
         </>
       )
    }
    // Default rect ears
    return (
      <>
        <path d="M16 32H10C8.89543 32 8 32.8954 8 34V38C8 39.1046 8.89543 40 10 40H16" fill={color} />
        <path d="M48 32H54C55.1046 32 56 32.8954 56 34V38C56 39.1046 55.1046 40 54 40H48" fill={color} />
      </>
    )
  }

  const renderEyes = () => {
    if (eyeType === 'round') {
      return (
        <>
          <circle cx="25" cy="32" r="4" fill={eyeColor} />
          <circle cx="39" cy="32" r="4" fill={eyeColor} />
        </>
      )
    }
    if (eyeType === 'line') {
      return (
        <>
          <rect x="21" y="31" width="8" height="4" rx="2" fill={eyeColor} />
          <rect x="35" y="31" width="8" height="4" rx="2" fill={eyeColor} />
        </>
      )
    }
    if (eyeType === 'blob') {
      return (
        <>
          <circle cx="24" cy="32" r="3" fill={eyeColor} />
          <circle cx="40" cy="32" r="3" fill={eyeColor} />
          <path d="M28 34 Q 32 38 36 34" fill="none" stroke={eyeColor} strokeWidth="2" strokeLinecap="round" />
        </>
      )
    }
    if (eyeType === 'ghost') {
      return (
        <>
          <circle cx="26" cy="30" r="4" fill={eyeColor} />
          <circle cx="38" cy="30" r="4" fill={eyeColor} />
          <circle cx="32" cy="38" r="3" fill={eyeColor} />
        </>
      )
    }
    if (eyeType === 'penguin') {
       return (
         <>
           <path d="M22 30 L 28 34 L 22 38" fill="none" stroke={eyeColor} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
           <path d="M42 30 L 36 34 L 42 38" fill="none" stroke={eyeColor} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
         </>
       )
    }
    // Default pill eyes
    return (
      <>
        <rect x="22" y="28" width="6" height={isAlert ? 4 : 10} rx={isAlert ? 2 : 3} fill={eyeColor} className="transition-all duration-300" />
        <rect x="36" y="28" width="6" height={isAlert ? 4 : 10} rx={isAlert ? 2 : 3} fill={eyeColor} className="transition-all duration-300" />
      </>
    )
  }

  const renderAccent = () => {
    if (accentType === 'chin') {
      return <path d="M26 42C28 44 36 44 38 42" stroke={eyeColor} strokeWidth="2.5" strokeLinecap="round" />
    }
    if (accentType === 'dots') {
      return (
        <>
          <circle cx="28" cy="42" r="1.5" fill={eyeColor} />
          <circle cx="32" cy="43" r="1.5" fill={eyeColor} />
          <circle cx="36" cy="42" r="1.5" fill={eyeColor} />
        </>
      )
    }
    if (accentType === 'axolotl') {
       return (
         <>
           <path d="M12 20 Q 8 24 12 28" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" />
           <path d="M52 20 Q 56 24 52 28" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" />
         </>
       )
    }
    if (accentType === 'cat') {
       return (
         <>
           <path d="M26 38 L 20 36 M 26 40 L 20 42" stroke={eyeColor} strokeWidth="2" strokeLinecap="round" />
           <path d="M38 38 L 44 36 M 38 40 L 44 42" stroke={eyeColor} strokeWidth="2" strokeLinecap="round" />
         </>
       )
    }
    if (accentType === 'ghost') {
       return (
         <path d="M16 48 Q 20 52 24 48 T 32 48 T 40 48 T 48 48" fill="none" stroke={color} strokeWidth="4" strokeLinecap="round" />
       )
    }
    return null
  }

  return (
    <div className={`relative flex items-center justify-center transition-all duration-300 ${isAlert ? 'animate-[shake_0.5s_ease-in-out_infinite]' : ''} ${className}`}>
      <svg
        width="84"
        height="84"
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={isThinking ? 'animate-pulse' : ''}
      >
        {renderAntenna()}
        {renderEars()}
        <rect x="16" y="20" width="32" height="28" rx="8" fill={color} className="transition-colors duration-300" />
        {renderEyes()}
        {renderAccent()}
      </svg>

      {isThinking && (
        <div className="absolute -top-1 -right-1 flex space-x-1">
          <div className="h-2 w-2 animate-bounce rounded-full bg-blue-500" style={{ animationDelay: '0ms' }}></div>
          <div className="h-2 w-2 animate-bounce rounded-full bg-blue-500" style={{ animationDelay: '150ms' }}></div>
          <div className="h-2 w-2 animate-bounce rounded-full bg-blue-500" style={{ animationDelay: '300ms' }}></div>
        </div>
      )}

      {isAlert && (
        <div className="absolute -top-1 -right-1 flex space-x-1">
          <div className="h-3 w-3 animate-ping rounded-full bg-red-500"></div>
        </div>
      )}

      <style
        dangerouslySetInnerHTML={{
          __html: `
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-2px) rotate(-2deg); }
          75% { transform: translateX(2px) rotate(2deg); }
        }
      `,
        }}
      />
    </div>
  )
}
