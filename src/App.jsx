import { useState, useEffect } from 'react'
import Navbar from './components/Navbar'
import Hero from './components/Hero'
import About from './components/About'
import Stats from './components/Stats'
import Amenidades from './components/Amenidades'
import Rooms from './components/Rooms'
import Videos from './components/Videos'
import Restaurant from './components/Restaurant'
import EventHall from './components/EventHall'
import Testimonials from './components/Testimonials'
import Location from './components/Location'
import Footer from './components/Footer'
import BookingModal from './components/BookingModal'
import HotelBot from './components/HotelBot'
import AdminDashboard from './components/AdminDashboard'
import { setupDB, trackEvent } from './lib/turso'

export default function App() {
  const [bookingRoom, setBookingRoom] = useState(null)
  const [showAdmin, setShowAdmin] = useState(false)

  const openBooking = (source, roomId) => {
    trackEvent('reserva_click', { source, room: roomId })
    setBookingRoom(roomId)
  }

  useEffect(() => {
    setupDB()
  }, [])

  useEffect(() => {
    const handleKey = (e) => {
      if (e.ctrlKey && e.key === 'k') {
        e.preventDefault()
        setShowAdmin(a => !a)
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [])

  return (
    <>
      <Navbar />
      <Hero onBook={() => openBooking('hero', 'deluxe')} />
      <About />
      <Stats />
      <Amenidades />
      <Rooms onBook={(roomId) => openBooking('rooms', roomId)} />
      <Videos />
      <Restaurant />
      <EventHall />
      <Testimonials />
      <Location />
      <Footer />
      <HotelBot />
      {bookingRoom && (
        <BookingModal
          initialRoom={bookingRoom}
          onClose={() => setBookingRoom(null)}
        />
      )}
      {showAdmin && (
        <AdminDashboard onClose={() => setShowAdmin(false)} />
      )}
    </>
  )
}
