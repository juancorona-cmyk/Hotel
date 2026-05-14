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
import { setupDB, trackEvent, getProxyConfig } from './lib/turso'
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

// Página que intenta abrir la app nativa al escanear el QR desde el navegador
function CheckInBrowserGateway() {
  const [searchParams] = useSearchParams()
  const rid = searchParams.get('rid')
  const [tried, setTried] = useState(false)

  useEffect(() => {
    if (!rid) return
    // Intent URL: si la app está instalada la abre; si no, queda en la página
    const fallback = encodeURIComponent(window.location.href)
    const intentUrl = `intent://hotelpuntagaleria.mx/checkin?rid=${rid}#Intent;scheme=https;package=${PKG};S.browser_fallback_url=${fallback};end`
    window.location.href = intentUrl
    setTimeout(() => setTried(true), 2500)
  }, [rid])

  if (!rid) return <Navigate to="/" replace />

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: '#f0f2f5',
      fontFamily: "'Montserrat', sans-serif", padding: 24
    }}>
      <div style={{
        background: '#fff', borderRadius: 24, padding: '40px 28px',
        textAlign: 'center', maxWidth: 360, width: '100%',
        boxShadow: '0 8px 40px rgba(0,0,0,0.10)'
      }}>
        <img src="/logo/logNegro.svg" alt="Hotel Punta Galería"
          style={{ height: 36, marginBottom: 28 }} />

        {!tried ? (
          <>
            <div style={{
              width: 64, height: 64, borderRadius: '50%',
              border: '4px solid #e2e8f0', borderTopColor: '#5a6c1e',
              animation: 'spin 0.8s linear infinite', margin: '0 auto 20px'
            }} />
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            <p style={{ fontWeight: 800, fontSize: 17, color: '#1e293b', margin: '0 0 8px' }}>
              Abriendo la app…
            </p>
            <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>
              Redirigiendo al sistema de accesos del hotel
            </p>
          </>
        ) : (
          <>
            <div style={{
              width: 60, height: 60, borderRadius: '50%', background: '#f1f5f9',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 20px'
            }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
                stroke="#5a6c1e" strokeWidth="2">
                <path d="M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2z" />
                <path d="M12 8v4l3 3" />
              </svg>
            </div>
            <p style={{ fontWeight: 800, fontSize: 16, color: '#1e293b', margin: '0 0 8px' }}>
              Instala la app del staff
            </p>
            <p style={{ fontSize: 13, color: '#64748b', margin: '0 0 24px', lineHeight: 1.6 }}>
              Este QR es para el personal del hotel. Instala la app para confirmar asistencia.
            </p>
            <div style={{
              background: '#f8fafc', borderRadius: 14, padding: '14px 16px',
              display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left'
            }}>
              <div style={{
                width: 44, height: 44, borderRadius: 10, background: '#5a6c1e',
                flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
                  stroke="#fff" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <line x1="9" y1="9" x2="9.01" y2="9" strokeWidth="3" />
                  <line x1="15" y1="9" x2="15.01" y2="9" strokeWidth="3" />
                  <line x1="9" y1="15" x2="9.01" y2="15" strokeWidth="3" />
                  <line x1="15" y1="15" x2="15.01" y2="15" strokeWidth="3" />
                </svg>
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: 14, color: '#1e293b' }}>
                  Hotel Punta Galería Staff
                </div>
                <div style={{ fontSize: 12, color: '#64748b' }}>Ticket #{String(rid).padStart(4, '0')}</div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
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
