import { v2 as cloudinary } from 'cloudinary'

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

console.log('Subiendo jardines-video.mp4 (50MB) en chunks...')
try {
  const result = await new Promise((resolve, reject) => {
    cloudinary.uploader.upload_large(
      'public/videos/jardinesvideo.mp4',
      { public_id: 'hotel/videos/jardines-video', resource_type: 'video', chunk_size: 6000000, overwrite: true, async: true },
      (error, result) => error ? reject(error) : resolve(result)
    )
  })
  console.log('✓ OK →', result.secure_url)
} catch (e) {
  console.log('✗', e.message)
}
