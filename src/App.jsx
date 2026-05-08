import { useState, useEffect, lazy, Suspense } from 'react'
import { Routes, Route, useNavigate, Navigate } from 'react-router-dom'
import { App as CapApp } from '@capacitor/app'
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

// Detection for Capacitor/Native environment
const isNativeApp = !!window.Capacitor

function LazyFallback() {
  return <div className="lazy-fallback" aria-hidden="true" />
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
  const [showMaintenance] = useState(true)
  const [maintenanceUnlocked, setMaintenanceUnlocked] = useState(false)
  const [dataVersion, setDataVersion] = useState(0)
  const navigate = useNavigate()

  useEffect(() => {
    // Sync configuration from Netlify env vars (Private)
    getProxyConfig().then(data => {
      if (data?.config?.cloudinaryCloudName) {
        localStorage.setItem('cloudinary_cloud_name', data.config.cloudinaryCloudName)
        updateCDN(data.config.cloudinaryCloudName) // Actualizar URLs del CDN antes de re-renderizar
        setDataVersion(v => v + 1) // Forzar re-renderizado
      }
    })
  }, [])

  useEffect(() => {
    // Handle Deep Links
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
    setupDB().catch(err => {
      console.error('Initial DB Setup failed:', err.message)
    })
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

  return (
    <>
      {/* El mantenimiento solo bloquea la web pública, no el APK del Staff */}
      {!isNativeApp && <MaintenanceBanner 
        show={showMaintenance} 
        onUnlock={() => setMaintenanceUnlocked(true)} 
      />}
      
      <Routes>
        <Route path="/evento/:slug" element={
          <Suspense fallback={<LazyFallback />}>
            <EventoPage key={dataVersion} />
          </Suspense>
        } />
        
        <Route path="/checkin" element={
          isNativeApp ? (
            <Suspense fallback={<LazyFallback />}>
              <CheckInPage />
            </Suspense>
          ) : (
            <Navigate to="/" replace />
          )
        } />

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
