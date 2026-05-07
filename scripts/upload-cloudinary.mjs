/**
 * Sube todos los assets del hotel a Cloudinary, organizado en carpetas.
 * Uso: node scripts/upload-cloudinary.mjs
 * Requiere: CLOUDINARY_API_KEY en variables de entorno o en este archivo.
 */

import { v2 as cloudinary } from 'cloudinary'
import { readFileSync, writeFileSync } from 'fs'
import { resolve } from 'path'

// ── Credenciales ──────────────────────────────────────────
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

// ── Assets a subir ────────────────────────────────────────
// [localPath, cloudinaryPublicId, resourceType]
const ASSETS = [
  // ── VIDEOS ──────────────────────────────────────────────
  ['public/videos/FONDO-VIDEO.mp4',       'hotel/videos/fondo-video',       'video'],
  ['public/videos/habitacionvideo.mp4',   'hotel/videos/habitacion-video',  'video'],
  ['public/videos/jardinesvideo.mp4',     'hotel/videos/jardines-video',    'video'],

  // ── IMÁGENES ─────────────────────────────────────────────
  ['public/habitaciones/Deluxe.jpg',         'hotel/imagenes/habitaciones/deluxe',          'image'],
  ['public/habitaciones/deluxeDouble.jpg',   'hotel/imagenes/habitaciones/deluxe-double',   'image'],
  ['public/hotel/Foto-inicio-300x268.jpg',   'hotel/imagenes/hotel/foto-inicio',            'image'],
  ['public/restaurante/restaurante.png',     'hotel/imagenes/restaurante/restaurante',      'image'],
  ['public/salon/salon1.png',                'hotel/imagenes/salon/salon1',                 'image'],
  ['public/salon/salon2.png',                'hotel/imagenes/salon/salon2',                 'image'],
  ['public/salon/salon3.png',                'hotel/imagenes/salon/salon3',                 'image'],
  ['public/salon/salonprincipal.jpg',        'hotel/imagenes/salon/salon-principal',        'image'],

  // ── LOGOS ────────────────────────────────────────────────
  ['public/logo/logo.svg',   'hotel/logos/logo',   'image'],
  ['public/icono.svg',       'hotel/logos/icono',  'image'],
]

// ── Mapa de URLs resultantes (para actualizar el código) ──
const URL_MAP = {}

async function uploadAll() {
  console.log(`\n🚀 Subiendo ${ASSETS.length} archivos a Cloudinary (cloud: ${process.env.CLOUDINARY_CLOUD_NAME})...\n`)

  for (const [localPath, publicId, resourceType] of ASSETS) {
    const fullPath = resolve(localPath)
    process.stdout.write(`  ↑ ${localPath.padEnd(45)} `)

    try {
      const result = await cloudinary.uploader.upload(fullPath, {
        public_id:     publicId,
        resource_type: resourceType,
        overwrite:     true,
        // Para imágenes: optimización automática
        ...(resourceType === 'image' && {
          quality:         'auto',
          fetch_format:    'auto',
        }),
        // Para videos: compresión automática
        ...(resourceType === 'video' && {
          video_codec:  'auto',
          quality:      'auto',
        }),
      })

      // Guardar URL limpia (sin transformaciones fijas para flexibilidad)
      URL_MAP[`/${localPath.replace('public/', '')}`] = result.secure_url
      console.log(`✓  ${(result.bytes / 1024 / 1024).toFixed(1)} MB`)
    } catch (err) {
      console.log(`✗  ERROR: ${err.message}`)
    }
  }

  // ── Generar archivo de URLs para copiar al código ─────────
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME
  const lines = Object.entries(URL_MAP).map(([local, cdn]) =>
    `  '${local}': \`${cdn.replace(cloudName, '${CN}')}\`,`
  ).join('\n')

  const output = `// URLs generadas por upload-cloudinary.mjs
// Copia estas URLs a tus componentes

const CN = process.env.VITE_CLOUDINARY_CLOUD_NAME

export const CDN = {
${lines}
}
`
  writeFileSync('scripts/cdn-urls.mjs', output)

  console.log(`\n✅ Listo. URLs guardadas en scripts/cdn-urls.mjs\n`)
  console.log('URLs generadas:')
  Object.entries(URL_MAP).forEach(([k, v]) => console.log(`  ${k}\n  → ${v}\n`))
}

uploadAll().catch(console.error)
