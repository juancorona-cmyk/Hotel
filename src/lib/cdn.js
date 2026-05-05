const B = `https://res.cloudinary.com/${import.meta.env.VITE_CLOUDINARY_CLOUD_NAME}`
const img = (path) => `${B}/image/upload/q_auto,f_auto/${path}`
const vid = (path) => `${B}/video/upload/q_auto/${path}`

export const CDN = {
  // ── Imágenes ──────────────────────────────────────────
  FOTO_INICIO:     img('hotel/imagenes/hotel/foto-inicio.jpg'),
  DELUXE:          img('hotel/imagenes/habitaciones/deluxe.jpg'),
  DELUXE_DOUBLE:   img('hotel/imagenes/habitaciones/deluxe-double.jpg'),
  RESTAURANTE:     img('hotel/imagenes/restaurante/restaurante.png'),
  SALON1:          img('hotel/imagenes/salon/salon1.png'),
  SALON2:          img('hotel/imagenes/salon/salon2.png'),
  SALON3:          img('hotel/imagenes/salon/salon3.png'),
  SALON_PRINCIPAL: img('hotel/imagenes/salon/salon-principal.jpg'),

  // ── Videos ───────────────────────────────────────────
  VIDEO_FONDO:      vid('hotel/videos/fondo-video.mp4'),
  VIDEO_HABITACION: vid('hotel/videos/habitacion-video.mp4'),
  VIDEO_JARDINES:   vid('hotel/videos/jardines-video.mp4'),
}
