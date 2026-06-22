import { useState, useEffect, lazy, Suspense } from 'react'
import { Routes, Route, useNavigate, useSearchParams, useLocation, Navigate } from 'react-router-dom'
import { App as CapApp } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import Navbar from './components/Navbar'
import MaintenanceBanner from './components/MaintenanceBanner'
import Hero from './components/Hero'
import About from './components/About'
import Stats from './components/Stats'
import Marquee from './components/Marquee'
import Amenidades from './components/Amenidades'
import Rooms from './components/Rooms'
import Videos from './components/Videos'
import Restaurant from './components/Restaurant'
import EventHall from './components/EventHall'
import Testimonials from './components/Testimonials'
import Location from './components/Location'
import Footer from './components/Footer'
import HotelBot from './components/HotelBot'
import PromoStrip from './components/PromoStrip'
import { setupDB, trackEvent, getProxyConfig, getRegistrationById } from './lib/turso'
import { fmtFecha } from './lib/utils'
import { updateCDN } from './lib/cdn'
import './components/MaintenanceBanner.css'

const BookingModal = lazy(() => import('./components/BookingModal'))
const AdminDashboard = lazy(() => import('./components/AdminDashboard'))
const EventoPage = lazy(() => import('./components/EventoPage'))
const CheckInPage = lazy(() => import('./components/CheckInPage'))

// True solo en Android/iOS nativo, false en navegador web
const isNativeApp = Capacitor.isNativePlatform()

const PKG = 'com.hotelpuntagaleria.app'

function LazyFallback() {
  return <div className="lazy-fallback" aria-hidden="true" />
}

// Visitante en browser: muestra el ticket del registro directamente.
// Si es Android, intenta abrir la app via intent:// antes de mostrar el ticket.
function CheckInBrowserGateway() {
  const [searchParams] = useSearchParams()
  const rid = searchParams.get('rid')
  const [reg, setReg]         = useState(null)
  const [fetched, setFetched] = useState(false)
  const [ready, setReady]     = useState(false) // true cuando ya no esperamos la app

  useEffect(() => {
    if (!rid) { setFetched(true); setReady(true); return }

    // Fetch del registro en paralelo
    getRegistrationById(parseInt(rid))
      .then(r => setReg(r))
      .catch(() => setReg(null))
      .finally(() => setFetched(true))

    // Solo intentar abrir la app en Android y solo una vez por rid
    const key = `gw_${rid}`
    const isAndroid = /android/i.test(navigator.userAgent)

    if (isAndroid && !sessionStorage.getItem(key)) {
      // Marcar ANTES de redirigir — si Chrome sigue el fallback URL,
      // la nueva carga verá la flag y no volverá a intentar
      sessionStorage.setItem(key, '1')
      const fb = encodeURIComponent(`https://hotelpuntagaleria.mx/checkin?rid=${rid}`)
      window.location.href =
        `intent://hotelpuntagaleria.mx/checkin?rid=${rid}` +
        `#Intent;scheme=hotelpg;package=${PKG};S.browser_fallback_url=${fb};end`
      // Si el browser no soporta intent:// (edge case), mostrar ticket tras 3s
      setTimeout(() => setReady(true), 3000)
    } else {
      setReady(true)
    }
  }, [rid])

  // ── Estilos — diseño compacto que cabe en una sola pantalla ─────────────────
  const S = {
    page: {
      height: '100dvh', display: 'flex', flexDirection: 'column',
      background: '#ede9e1', fontFamily: "'Montserrat',sans-serif", overflow: 'hidden',
    },
    hero: {
      background: 'linear-gradient(160deg,#3d4d10 0%,#5a6c1e 100%)',
      padding: '20px 18px 18px', display: 'flex', flexDirection: 'column', alignItems: 'center',
      flexShrink: 0,
    },
    logoRow: {
      display: 'flex', alignItems: 'center', gap: 9, marginBottom: 14,
      alignSelf: 'stretch',
      background: 'rgba(0,0,0,0.15)', borderRadius: 11,
      padding: '7px 11px',
    },
    logoBox: {
      width: 28, height: 28, borderRadius: 7, background: 'rgba(255,255,255,0.2)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    },
    hotelName: { color: '#fff', fontWeight: 800, fontSize: 12.5, lineHeight: 1.2 },
    hotelSub:  { color: 'rgba(255,255,255,0.6)', fontWeight: 600, fontSize: 10, marginTop: 1 },
    heroIcon: {
      width: 58, height: 58, borderRadius: '50%', background: 'rgba(255,255,255,0.18)',
      border: '2px solid rgba(255,255,255,0.3)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12,
    },
    heroTitle: { color: '#fff', fontWeight: 900, fontSize: 19, margin: '0 0 5px', textAlign: 'center' },
    heroSub:   { color: 'rgba(255,255,255,0.78)', fontSize: 12, fontWeight: 600, textAlign: 'center', lineHeight: 1.45 },
    body: { flex: 1, padding: '0 14px 14px', overflow: 'auto' },
    ticket: {
      background: '#fff', borderRadius: '0 0 20px 20px',
      padding: '14px 16px 0', marginBottom: 10,
      boxShadow: '0 4px 20px rgba(0,0,0,0.07)',
    },
    strip: {
      borderTop: '1.5px dashed #e0dbd3', margin: '0 -16px',
      padding: '11px 16px',
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    },
    stripLabel: { fontSize: 10, fontWeight: 700, color: '#b0a898', letterSpacing: '0.06em', textTransform: 'uppercase' },
    stripNum:   { fontSize: 16, fontWeight: 900, color: '#5a6c1e', letterSpacing: '0.5px' },
    row: {
      display: 'flex', alignItems: 'center', gap: 10,
      borderBottom: '1px solid #f5f0eb', padding: '9px 0',
    },
    rowIcon: (bg) => ({
      width: 32, height: 32, borderRadius: 8, background: bg, flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }),
    rowLabel: { fontSize: 10, color: '#9ca3af', fontWeight: 600, display: 'block' },
    rowVal:   { fontSize: 13.5, color: '#1a1f0e', fontWeight: 700, display: 'block', marginTop: 1 },
    notice: {
      display: 'flex', gap: 10, alignItems: 'flex-start',
      background: '#f0f4e4', borderRadius: 13, padding: '12px 13px',
    },
    noticeText: { fontSize: 12, color: '#3d4a0f', fontWeight: 600, lineHeight: 1.5, margin: 0 },
    spinner: {
      width: 44, height: 44, borderRadius: '50%',
      border: '4px solid rgba(255,255,255,0.3)', borderTopColor: '#fff',
      animation: 'gw-spin 0.8s linear infinite', marginBottom: 14,
    },
    errIcon: {
      width: 64, height: 64, borderRadius: '50%', background: 'rgba(255,255,255,0.12)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12,
    },
  }

  const Shell = ({ icon, title, msg, sub }) => (
    <div style={S.page}>
      <style>{`@keyframes gw-spin{to{transform:rotate(360deg)}}`}</style>
      <div style={S.hero}>
        <div style={S.logoRow}>
          <div style={S.logoBox}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                <polyline points="9 22 9 12 15 12 15 22"/>
              </svg>
          </div>
          <div>
            <div style={S.hotelName}>Hotel Punta Galería</div>
            <div style={S.hotelSub}>{sub}</div>
          </div>
        </div>
        {icon}
        {title && <p style={S.heroTitle}>{title}</p>}
        {msg   && <p style={{ ...S.heroSub, marginTop: 8, maxWidth: 300 }}>{msg}</p>}
      </div>
    </div>
  )

  // Cargando
  if (!ready || !fetched) {
    return <Shell sub="Cargando ticket…" icon={<div style={S.spinner} />} />
  }

  if (!rid) return <Navigate to="/" replace />

  // Registro no encontrado
  if (!reg) {
    return (
      <Shell
        sub="Control de accesos"
        icon={
          <div style={S.errIcon}>
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="1.8">
              <circle cx="12" cy="12" r="10"/>
              <line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
            </svg>
          </div>
        }
        title="Registro no encontrado"
        msg="No encontramos este ticket. Contacta al personal del hotel."
      />
    )
  }

  // ─── Ticket del invitado ─────────────────────────────────────────────────────
  return (
    <div style={S.page}>
      <style>{`@keyframes gw-spin{to{transform:rotate(360deg)}}`}</style>

      {/* Hero */}
      <div style={S.hero}>
        <div style={S.logoRow}>
          <div style={S.logoBox}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                <polyline points="9 22 9 12 15 12 15 22"/>
              </svg>
          </div>
          <div>
            <div style={S.hotelName}>Hotel Punta Galería</div>
            <div style={S.hotelSub}>¡Gracias por tu registro!</div>
          </div>
        </div>

        <div style={S.heroIcon}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </div>
        <p style={S.heroTitle}>Tu lugar está confirmado</p>
        <p style={{ ...S.heroSub, maxWidth: 260 }}>Te esperamos en el evento. Presenta este QR a la entrada.</p>
      </div>

      {/* Contenido */}
      <div style={S.body}>
        <div style={S.ticket}>
          {/* Nombre */}
          <div style={S.row}>
            <div style={S.rowIcon('#eef4e8')}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#5a6c1e" strokeWidth="2" strokeLinecap="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
              </svg>
            </div>
            <div>
              <span style={S.rowLabel}>Asistente</span>
              <span style={S.rowVal}>{reg.full_name}</span>
            </div>
          </div>

          {/* Evento */}
          {(reg.event_name || reg.activity_name) && (
            <div style={S.row}>
              <div style={S.rowIcon('#eef4e8')}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#5a6c1e" strokeWidth="2" strokeLinecap="round">
                  <rect x="3" y="4" width="18" height="18" rx="2"/>
                  <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
                  <line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
              </div>
              <div>
                <span style={S.rowLabel}>Evento</span>
                <span style={S.rowVal}>{reg.event_name || reg.activity_name}</span>
              </div>
            </div>
          )}

          {/* Fecha del evento */}
          {reg.event_date && (
            <div style={S.row}>
              <div style={S.rowIcon('#eef4e8')}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#5a6c1e" strokeWidth="2" strokeLinecap="round">
                  <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                </svg>
              </div>
              <div>
                <span style={S.rowLabel}>Fecha del evento</span>
                <span style={S.rowVal}>{fmtFecha(reg.event_date, true)}</span>
              </div>
            </div>
          )}

          {/* Ticket strip */}
          <div style={S.strip}>
            <span style={S.stripLabel}>N° de ticket</span>
            <span style={S.stripNum}>#{String(reg.id).padStart(4, '0')}</span>
          </div>
        </div>

        {/* Instrucción */}
        <div style={S.notice}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#5a6c1e" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0, marginTop: 1 }}>
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          </svg>
          <p style={S.noticeText}>
            En la entrada, el personal del hotel escaneará tu QR para confirmar tu acceso.
          </p>
        </div>
      </div>
    </div>
  )
}

function HomeApp({ bookingRoom, setBookingRoom, showAdmin, setShowAdmin, dataVersion, setDataVersion }) {
  const openBooking = (source, roomId) => {
    trackEvent('reserva_click', { source, origin: 'web', promo: 'web_20', room: roomId })
    setBookingRoom(roomId)
  }

  return (
    <>
      <Navbar />
      <Hero onBook={() => openBooking('hero', 'deluxe')} />
      <PromoStrip onBook={() => openBooking('hero_strip', 'deluxe')} />
      <About />
      <Stats />
      <Marquee />
      <Amenidades key={`amenidades-${dataVersion}`} />
      <Rooms onBook={(roomId) => openBooking('rooms', roomId)} />
      <Videos />
      <Restaurant />
      <EventHall />
      <Testimonials />
      <Location />
      <Footer />
      <HotelBot />
      {bookingRoom && (
        <Suspense fallback={<LazyFallback />}>
          <BookingModal
            initialRoom={bookingRoom}
            onClose={() => setBookingRoom(null)}
          />
        </Suspense>
      )}
      {showAdmin && (
        <Suspense fallback={<LazyFallback />}>
          <AdminDashboard onClose={() => {
            setShowAdmin(false)
            setDataVersion(v => v + 1)
          }} />
        </Suspense>
      )}
    </>
  )
}

export default function App() {
  const [bookingRoom, setBookingRoom] = useState(null)
  const [showAdmin, setShowAdmin] = useState(false)
  const [showMaintenance] = useState(false)
  const [maintenanceUnlocked, setMaintenanceUnlocked] = useState(false)
  const [dataVersion, setDataVersion] = useState(0)
  const navigate = useNavigate()

  useEffect(() => {
    getProxyConfig().then(data => {
      if (data?.config?.cloudinaryCloudName) {
        localStorage.setItem('cloudinary_cloud_name', data.config.cloudinaryCloudName)
        updateCDN(data.config.cloudinaryCloudName)
        setDataVersion(v => v + 1)
      }
    })
  }, [])

  useEffect(() => {
    const setupDeepLinks = async () => {
      CapApp.addListener('appUrlOpen', (data) => {
        try {
          const url = new URL(data.url)
          let path = url.pathname + url.search
          if (!path || path === '/') {
            const search = data.url.split('?')[1]
            if (search) path = '/checkin?' + search
          }
          if (path) navigate(path)
        } catch (e) {
          console.error('Deep link error:', e)
        }
      })
    }
    setupDeepLinks()
  }, [navigate])

  useEffect(() => {
    setupDB().catch(err => console.error('Initial DB Setup failed:', err.message))
  }, [])

  // Crear canal de notificación Android al arrancar — debe existir ANTES de que llegue cualquier push
  useEffect(() => {
    if (!isNativeApp) return
    import('@capacitor/push-notifications').then(({ PushNotifications }) => {
      PushNotifications.createChannel({
        id: 'hotel_push',
        name: 'Hotel Punta Galería',
        description: 'Nuevos registros y pagos',
        importance: 5,
        visibility: 1,
        vibration: true,
        lights: true,
      }).catch(e => console.warn('[push] createChannel:', e?.message))
    }).catch(() => {})
  }, [])

  useEffect(() => {
    const handleKey = (e) => {
      if (e.ctrlKey && e.key?.toLowerCase() === 'k') {
        e.preventDefault()
        setShowAdmin(a => {
          if (a) setDataVersion(v => v + 1)
          return !a
        })
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [])

  const location = useLocation()
  const isCheckinQR = location.pathname === '/checkin' && location.search.includes('rid=')

  return (
    <>
      {!isNativeApp && <MaintenanceBanner
        show={showMaintenance}
        skip={isCheckinQR}
        onUnlock={() => setMaintenanceUnlocked(true)}
      />}

      <Routes>
        <Route path="/evento/:slug" element={
          <Suspense fallback={<LazyFallback />}>
            <EventoPage key={dataVersion} />
          </Suspense>
        } />

        {/* Browser-only route, ignored in native app as /* matches first */}
        <Route path="/checkin" element={
          isNativeApp ? (
            <Suspense fallback={<LazyFallback />}>
              <CheckInPage />
            </Suspense>
          ) : (
            <CheckInBrowserGateway />
          )
        } />

        {/* Catch-all route */}
        <Route path="/*" element={
          isNativeApp ? (
            <Suspense fallback={<LazyFallback />}>
              <CheckInPage />
            </Suspense>
          ) : (
            <HomeApp
              key={dataVersion}
              bookingRoom={bookingRoom}
              setBookingRoom={setBookingRoom}
              showAdmin={showAdmin}
              setShowAdmin={setShowAdmin}
              dataVersion={dataVersion}
              setDataVersion={setDataVersion}
            />
          )
        } />
      </Routes>
    </>
  )
}
