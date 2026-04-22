import { useEffect } from 'react'
import { streamManager } from '../api/StreamManager'

export function useChatStream() {
  useEffect(() => {
    // Only cleanup on unmount - connection logic is handled separately
    return () => {
      streamManager.disconnect()
    }
  }, [])

  return {
    connect: (sessionId: string) => streamManager.connect(sessionId),
    disconnect: () => streamManager.disconnect(),
    subscribe: (event: string, callback: (type: string, data: any) => void) => 
      streamManager.subscribe(event, callback)
  }
}
