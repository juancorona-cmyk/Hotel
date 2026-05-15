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
import { setupDB, trackEvent, getProxyConfig, getRegistrationById } from './lib/turso'
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

// Visitante en browser: muestra el ticket del registro directamente
function CheckInBrowserGateway() {
  const [searchParams] = useSearchParams()
  const rid = searchParams.get('rid')
  const [reg, setReg] = useState(null)
  const [fetched, setFetched] = useState(false)

  useEffect(() => {
    if (!rid) { setFetched(true); return }
    getRegistrationById(parseInt(rid))
      .then(r => setReg(r))
      .catch(() => setReg(null))
      .finally(() => setFetched(true))
  }, [rid])

  const S = {
    page: {
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(160deg,#f5f2ed 0%,#eae5dc 100%)',
      fontFamily: "'Montserrat',sans-serif", padding: '32px 20px',
    },
    card: {
      background: '#fff', borderRadius: 28, width: '100%', maxWidth: 380,
      boxShadow: '0 12px 48px rgba(0,0,0,0.10)', overflow: 'hidden',
    },
    header: {
      background: '#5a6c1e', padding: '28px 28px 24px',
      display: 'flex', alignItems: 'center', gap: 14,
    },
    logoWrap: {
      width: 44, height: 44, borderRadius: 12, background: 'rgba(255,255,255,0.15)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    },
    hotelName: { color: '#fff', fontWeight: 800, fontSize: 15, lineHeight: 1.2 },
    hotelSub:  { color: 'rgba(255,255,255,0.7)', fontWeight: 600, fontSize: 11, marginTop: 2 },
    body: { padding: '28px 28px 32px' },
    spinner: {
      width: 52, height: 52, borderRadius: '50%',
      border: '4px solid #e5e0d8', borderTopColor: '#5a6c1e',
      animation: 'gw-spin 0.8s linear infinite', margin: '0 auto 20px',
    },
    iconCircle: (color) => ({
      width: 72, height: 72, borderRadius: '50%', background: color,
      display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px',
    }),
    title: { fontWeight: 800, fontSize: 18, color: '#1a1f0e', margin: '0 0 8px', textAlign: 'center' },
    sub:   { fontSize: 13, color: '#6b7280', margin: '0 0 24px', lineHeight: 1.6, textAlign: 'center' },
    divider: { height: 1, background: '#f0ede8', margin: '20px 0' },
    row: {
      display: 'flex', alignItems: 'center', gap: 12,
      background: '#f9f7f4', borderRadius: 14, padding: '12px 14px', marginBottom: 10,
    },
    rowIcon: (bg) => ({
      width: 36, height: 36, borderRadius: 10, background: bg, flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }),
    rowLabel: { fontSize: 11, color: '#9ca3af', fontWeight: 600, display: 'block' },
    rowVal:   { fontSize: 14, color: '#1a1f0e', fontWeight: 700, display: 'block', marginTop: 1 },
    ticketStrip: {
      background: '#f5f2ed', borderTop: '1px dashed #d1ccc4',
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '12px 28px', margin: '0 -28px',
    },
    ticketLabel: { fontSize: 11, fontWeight: 700, color: '#9ca3af', letterSpacing: '0.06em' },
    ticketNum:   { fontSize: 15, fontWeight: 800, color: '#5a6c1e' },
    notice: {
      display: 'flex', gap: 12, alignItems: 'flex-start',
      background: '#f0f4e4', borderRadius: 14, padding: '14px 16px', marginTop: 16,
    },
    noticeIcon: { flexShrink: 0, marginTop: 1 },
    noticeText: { fontSize: 12.5, color: '#3d4a0f', fontWeight: 600, lineHeight: 1.55 },
    footer: {
      textAlign: 'center', fontSize: 11.5, color: '#b0a898', fontWeight: 600, marginTop: 24,
    },
  }

  const CardShell = ({ sub, children }) => (
    <div style={S.page}>
      <style>{`@keyframes gw-spin{to{transform:rotate(360deg)}}`}</style>
      <div style={S.card}>
        <div style={S.header}>
          <div style={S.logoWrap}>
            <img src="/logo/logNegro.svg" alt="" style={{ height: 26, filter: 'brightness(0) invert(1)' }} />
          </div>
          <div>
            <div style={S.hotelName}>Hotel Punta Galería</div>
            <div style={S.hotelSub}>{sub}</div>
          </div>
        </div>
        <div style={S.body}>{children}</div>
      </div>
      <div style={S.footer}>hotelpuntagaleria.mx</div>
    </div>
  )

  // Cargando registro desde DB
  if (!fetched) {
    return (
      <CardShell sub="Confirmación de registro">
        <div style={S.spinner} />
        <p style={{ ...S.title, marginTop: 8 }}>Cargando tu ticket…</p>
      </CardShell>
    )
  }

  // Sin rid — página genérica
  if (!rid) return <Navigate to="/" replace />

  // Registro no encontrado
  if (!reg) {
    return (
      <CardShell sub="Control de accesos">
        <div style={S.iconCircle('#fff0f0')}>
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#c0392b" strokeWidth="1.8">
            <circle cx="12" cy="12" r="10"/>
            <line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
          </svg>
        </div>
        <p style={S.title}>Registro no encontrado</p>
        <p style={S.sub}>No pudimos encontrar este ticket. Contacta al personal del hotel.</p>
      </CardShell>
    )
  }

  // ─── Ticket del invitado ───
  return (
    <CardShell sub="¡Gracias por tu registro!">
      {/* Check animado */}
      <div style={{ ...S.iconCircle('#f0f4e4'), position: 'relative' }}>
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#5a6c1e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
      </div>

      <p style={S.title}>¡Gracias por registrarte!</p>
      <p style={{ ...S.sub, marginBottom: 20 }}>Tu lugar está confirmado. Te esperamos en el evento.</p>

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
      {reg.event_name && (
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
            <span style={S.rowVal}>{reg.event_name}</span>
          </div>
        </div>
      )}

      {/* Ticket # */}
      <div style={{ ...S.ticketStrip, marginTop: 20 }}>
        <span style={S.ticketLabel}>N° DE TICKET</span>
        <span style={S.ticketNum}>#{String(reg.id).padStart(4, '0')}</span>
      </div>

      {/* Instrucción de acceso */}
      <div style={S.notice}>
        <div style={S.noticeIcon}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#5a6c1e" strokeWidth="2" strokeLinecap="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          </svg>
        </div>
        <p style={{ ...S.noticeText, margin: 0 }}>
          En la entrada, el personal del hotel escaneará tu QR para confirmar tu acceso.
        </p>
      </div>
    </CardShell>
  )
}

function HomeApp({ bookingRoom, setBookingRoom, showAdmin, setShowAdmin, dataVersion, setDataVersion }) {
  const openBooking = (source, roomId) => {
    trackEvent('reserva_click', { source, room: roomId })
    setBookingRoom(roomId)
  }

  return (
    <>
      <Navbar />
      <Hero onBook={() => openBooking('hero', 'deluxe')} />
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
