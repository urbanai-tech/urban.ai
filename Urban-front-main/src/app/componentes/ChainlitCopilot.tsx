"use client"
import React, { useEffect } from "react"
import { usePathname } from 'next/navigation'
import { useAuth } from "../context/AuthContext"

// Routes where the copilot should not appear (public routes)
const publicRoutes = ['/', '/confirm-email', '/request-reset-password', '/reset-password']

type Props = {
  serverUrl?: string
}

export default function ChainlitCopilot({ serverUrl }: Props) {
  const { isAuthenticated } = useAuth()
  const pathname = usePathname()
  const chainlitUrl = serverUrl || process.env.NEXT_PUBLIC_CHAINLIT_URL || ""

  // Don't show on public routes or when not authenticated
  const isPublicRoute = publicRoutes.some(route => pathname === route || pathname.startsWith(`${route}/`))
  if (!isAuthenticated || isPublicRoute) {
    return null
  }

  useEffect(() => {
    if (!chainlitUrl) return

    const scriptId = "chainlit-copilot-script"

    // Avoid injecting the script multiple times
    if (!document.getElementById(scriptId)) {
      const s = document.createElement("script")
      s.id = scriptId
      s.src = `${chainlitUrl.replace(/\/$/, "")}/copilot/index.js`
      s.async = true
      document.body.appendChild(s)

      s.addEventListener("error", () => {
        // eslint-disable-next-line no-console
        console.error("Failed to load Chainlit Copilot script from", s.src)
      })
    }

    function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
      const toRad = (x: number) => x * Math.PI / 180
      const R = 6371 // Earth radius in km
      const dLat = toRad(lat2 - lat1)
      const dLon = toRad(lon2 - lon1)
      const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2)
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
      return R * c
    }

    async function handleCallFn(e: any) {
      const { name, args, callback } = e.detail || {}
      const accessToken = localStorage.getItem('accessToken')
      const baseUrl = process.env.NEXT_PUBLIC_API_URL

      try {
        switch (name) {
          case 'getUserInfo': {
            const url = `${baseUrl}/auth/me`
            console.log('[Copilot] Fetching user info:', url)
            const response = await fetch(url, {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
              }
            })
            console.log('[Copilot] Response status:', response.status)
            const json = await response.json()
            console.log('[Copilot] Response data:', json)
            callback(formatUserInfo(json))
            break
          }

          case 'getUserProperties': {
            const url = `${baseUrl}/connect/user-addresses`
            console.log('[Copilot] Fetching user properties:', url)
            const response = await fetch(url, {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
              }
            })
            console.log('[Copilot] Response status:', response.status)
            const json = await response.json()
            console.log('[Copilot] Response data:', json)
            callback(formatProperties(json))
            break
          }

          case 'getNearbyEvents': {
            const propUrl = `${baseUrl}/connect/user-addresses`
            const eventUrl = `${baseUrl}/event/all`
            // Fetch properties
            const propRes = await fetch(propUrl, {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
              }
            })
            const properties = await propRes.json()
            // Fetch events
            const eventRes = await fetch(eventUrl, {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
              }
            })
            const eventJson = await eventRes.json()
            const events = eventJson.data || []
            // Use distanceKm from args or default to 10 km
            const maxDist = typeof args?.distanceKm === 'number' ? args.distanceKm : 10
            // Filter events for each property by geolocation
            const filtered = properties.map((prop: any) => {
              const propLat = parseFloat(prop.latitude)
              const propLon = parseFloat(prop.longitude)
              const propTitle = prop.titulo || ''
              const propEvents = events.filter((ev: any) => {
                if (!ev.latitude || !ev.longitude || isNaN(propLat) || isNaN(propLon)) return false
                const evLat = parseFloat(ev.latitude)
                const evLon = parseFloat(ev.longitude)
                const dist = haversineDistance(propLat, propLon, evLat, evLon)
                return dist <= maxDist
              })
              return {
                property: propTitle,
                events: propEvents.slice(0, 5)
              }
            })
            callback(formatNearbyEventsFiltered(filtered))
            break
          }

          default:
            console.warn('[Copilot] Unknown function name:', name)
            callback("Desculpe, não sei como lidar com essa solicitação.")
        }
      } catch (error) {
        console.error("[Copilot] Error handling copilot function:", error)
        callback("Desculpe, houve um erro ao processar sua solicitação.")
      }
    }

    // Helper functions to format the responses
    function formatUserInfo(user: any): string {
      if (!user) return "Não foi possível recuperar as informações do usuário."
      return `
- Nome de usuário: ${user.username || '-'}
      `.trim()
    }

    function formatProperties(properties: any[]): string {
      if (!properties?.length) return "Você ainda não possui propriedades cadastradas."
      return properties
        .map((prop: any) => `
- Título: ${prop.titulo}
  Ativo: ${prop.ativo ? 'Sim' : 'Não'}
  Proprietário: ${prop.user?.username || '-'}
  Número de quartos: ${prop.quartos || '-'}
  Número de banheiros: ${prop.banheiros || '-'}
  Número de camas: ${prop.camas || '-'}
  Email: ${prop.user?.email || '-'}
  Criado em: ${prop.user?.createdAt ? new Date(prop.user.createdAt).toLocaleDateString('pt-BR') : '-'}
        `.trim())
        .join("\n\n")
    }

    function formatNearbyEvents(eventsData: any): string {
      if (!Array.isArray(eventsData) || !eventsData.length) return "Não foram encontrados eventos próximos às suas propriedades."
      // Show top 5 events
      return eventsData.slice(0, 5)
        .map((event: any, i: number) => `
${i + 1}. ${event.nome}
   Data: ${event.dataInicio ? new Date(event.dataInicio).toLocaleDateString('pt-BR') : '-'}
   Local: ${event.enderecoCompleto || '-'}
   Link: ${event.linkSiteOficial || '-'}
        `.trim())
        .join("\n\n")
    }

    function formatNearbyEventsFiltered(filtered: any[]): string {
      if (!Array.isArray(filtered) || !filtered.length) return "Não foram encontrados eventos próximos às suas propriedades."
      return filtered.map(({ property, events }: any) => {
        if (!events.length) return `Não há eventos próximos a: ${property}`
        return `Eventos próximos a ${property}:
${events.map((event: any, i: number) => `  ${i + 1}. ${event.nome}
     Data: ${event.dataInicio ? new Date(event.dataInicio).toLocaleDateString('pt-BR') : '-'}
     Local: ${event.enderecoCompleto || '-'}
     Link: ${event.linkSiteOficial || '-'}
     Imagem: ${event.imagem_url || '-'}`).join('\n')}`
      }).join('\n\n')
    }

    window.addEventListener("chainlit-call-fn", handleCallFn as EventListener)

    // Poll for mount function in case script hasn't loaded yet
    let mounted = false
    const interval = window.setInterval(() => {
      try {
        const mountFn = (window as any).mountChainlitWidget
        if (typeof mountFn === "function" && !mounted) {
          mounted = true
          mountFn({ chainlitServer: chainlitUrl })
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("Error while attempting to mount Chainlit widget:", err)
      }
    }, 300)

    return () => {
      window.removeEventListener("chainlit-call-fn", handleCallFn as EventListener)
      window.clearInterval(interval)
    }
  }, [chainlitUrl])

  return null
}
