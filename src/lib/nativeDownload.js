import { Capacitor } from '@capacitor/core'
import { Filesystem, Directory } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(String(reader.result).split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

// En la app nativa `<a download>` no dispara el DownloadManager de Android
// (el WebView de Capacitor no tiene download listener), así que el archivo
// se escribe en Cache (sin permisos de almacenamiento) y se abre el sheet
// nativo de compartir, desde donde el staff lo guarda donde quiera.
export async function saveOrShareBlob(blob, filename) {
  if (Capacitor.isNativePlatform()) {
    const data = await blobToBase64(blob)
    const { uri } = await Filesystem.writeFile({
      path: filename,
      data,
      directory: Directory.Cache,
    })
    try {
      await Share.share({ title: filename, url: uri, dialogTitle: 'Guardar o compartir PDF' })
    } catch (err) {
      // El staff cerro el sheet de compartir sin elegir app — el PDF ya se genero bien,
      // no es un error real de la funcion.
      if (String(err?.message || err).toLowerCase().includes('cancel')) return
      throw err
    }
    return
  }

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
