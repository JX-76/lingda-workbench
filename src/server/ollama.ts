import { PROVIDER_REGISTRY } from '../providers/registry.js'

export function startOllamaHealthCheck(intervalMs = 30000) {
  const ollamaUrl = PROVIDER_REGISTRY['ollama']?.baseUrl || 'http://127.0.0.1:11434'
  
  setInterval(async () => {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000)
      
      const res = await fetch(`${ollamaUrl}/api/tags`, { signal: controller.signal })
      clearTimeout(timeoutId)
      
      if (res.ok) {
        const data = await res.json()
        const models = data.models?.map((m: any) => m.name) || []
        
        if (models.length > 0 && PROVIDER_REGISTRY['ollama']) {
          PROVIDER_REGISTRY['ollama'].models = models
          if (!models.includes(PROVIDER_REGISTRY['ollama'].defaultModel)) {
            PROVIDER_REGISTRY['ollama'].defaultModel = models[0]
          }
        }
      }
    } catch (e) {
      // Failed to connect to Ollama, ignore silently in background
    }
  }, intervalMs)
}
