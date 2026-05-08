const DEFAULT_CLOUD = 'dfuzfdrat'

let cloudName = localStorage.getItem('cloudinary_cloud_name') || import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || DEFAULT_CLOUD

const buildUrl = (path, type = 'image', ext = '') => {
  const base = `https://res.cloudinary.com/${cloudName}/${type}/upload`
  const params = type === 'image' ? 'q_auto,f_auto' : 'q_auto'
  const fullPath = ext ? `${path}.${ext}` : path
  return `${base}/${params}/${fullPath}`
}

export const CDN = {
  FOTO_INICIO:     buildUrl('hotel/imagenes/hotel/foto-inicio', 'image', 'jpg'),
  DELUXE:          buildUrl('hotel/imagenes/habitaciones/deluxe', 'image', 'jpg'),
  DELUXE_DOUBLE:   buildUrl('hotel/imagenes/habitaciones/deluxe-double', 'image', 'jpg'),
  RESTAURANTE:     buildUrl('hotel/imagenes/restaurante/restaurante', 'image', 'png'),
  SALON1:          buildUrl('hotel/imagenes/salon/salon1', 'image', 'png'),
  SALON2:          buildUrl('hotel/imagenes/salon/salon2', 'image', 'png'),
  SALON3:          buildUrl('hotel/imagenes/salon/salon3', 'image', 'png'),
  SALON_PRINCIPAL: buildUrl('hotel/imagenes/salon/salon-principal', 'image', 'jpg'),
  VIDEO_FONDO:      buildUrl('hotel/videos/fondo-video', 'video', 'mp4'),
  VIDEO_HABITACION: buildUrl('hotel/videos/habitacion-video', 'video', 'mp4'),
  VIDEO_JARDINES:   buildUrl('hotel/videos/jardines-video', 'video', 'mp4'),
}

/**
 * Actualiza las URLs del CDN con el nuevo nombre de cloud.
 * Debe llamarse antes de renderizar los componentes que usan CDN.
 */
export function updateCDN(newCloudName) {
  if (!newCloudName || newCloudName === cloudName) return
  cloudName = newCloudName
  
  CDN.FOTO_INICIO = buildUrl('hotel/imagenes/hotel/foto-inicio', 'image', 'jpg')
  CDN.DELUXE = buildUrl('hotel/imagenes/habitaciones/deluxe', 'image', 'jpg')
  CDN.DELUXE_DOUBLE = buildUrl('hotel/imagenes/habitaciones/deluxe-double', 'image', 'jpg')
  CDN.RESTAURANTE = buildUrl('hotel/imagenes/restaurante/restaurante', 'image', 'png')
  CDN.SALON1 = buildUrl('hotel/imagenes/salon/salon1', 'image', 'png')
  CDN.SALON2 = buildUrl('hotel/imagenes/salon/salon2', 'image', 'png')
  CDN.SALON3 = buildUrl('hotel/imagenes/salon/salon3', 'image', 'png')
  CDN.SALON_PRINCIPAL = buildUrl('hotel/imagenes/salon/salon-principal', 'image', 'jpg')
  CDN.VIDEO_FONDO = buildUrl('hotel/videos/fondo-video', 'video', 'mp4')
  CDN.VIDEO_HABITACION = buildUrl('hotel/videos/habitacion-video', 'video', 'mp4')
  CDN.VIDEO_JARDINES = buildUrl('hotel/videos/jardines-video', 'video', 'mp4')
  
  console.log('[CDN] URLs actualizadas para cloud:', cloudName)
}
