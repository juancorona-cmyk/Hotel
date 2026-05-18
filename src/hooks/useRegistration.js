import { useState, useEffect, useRef, useCallback } from 'react'
import {
  createActivityRegistration,
  getRegistrationCountByEvent,
  trackEvent,
  getRegistrationById,
  checkWhatsappMember,
  addWhatsappMember,
  checkExistingRegistration,
  API_BASE,
} from '../lib/turso'

const WA_GROUP_LINK = 'https://chat.whatsapp.com/GVefjT90VZRJZ9X18Vizaw'
import { isValidPhone, compressImage } from '../lib/utils'
import {
  uploadTransferProof as doUploadProof,
  downloadTicketPdf,
  generateTicketPdfBlob,
} from '../lib/ticketPdf'

export const WHATSAPP_OPTIONS = ['Sí', 'No', 'Ya estoy dentro']
export const HOW_FOUND_OPTIONS = ['Instagram', 'Facebook', 'Conocido', 'Otros']

function lsKey(eventId) { return `reg_event_${eventId}` }

export function useRegistration({ event, activity, initialRegId, onRegistered }) {
  const [step, setStep] = useState(1)
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [howFound, setHowFound] = useState('')
  const [howFoundOther, setHowFoundOther] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [registrationId, setRegistrationId] = useState(null)
  const [paymentMethod, setPaymentMethod] = useState('')
  const [paymentPending, setPaymentPending] = useState(false)
  const [showTransferInfo, setShowTransferInfo] = useState(false)
  const [copiedClabe, setCopiedClabe] = useState(false)
  const [proofUploaded, setProofUploaded] = useState(false)
  const [uploadingProof, setUploadingProof] = useState(false)
  const [proofError, setProofError] = useState('')
  const [downloadingPDF, setDownloadingPDF] = useState(false)
  const [spotsLeft, setSpotsLeft] = useState(null)
  const [isWhatsappMember, setIsWhatsappMember] = useState(null)
  const [duplicateReg, setDuplicateReg] = useState(null)
  // True while restoring saved state — prevents form flash before data loads
  const [restoring, setRestoring] = useState(() => {
    if (initialRegId) return true
    if (!event?.id) return false
    try {
      const saved = localStorage.getItem(lsKey(event.id))
      const parsed = JSON.parse(saved || 'null')
      return !!(parsed?.registrationId)
    } catch { return false }
  })

  const qrSvgRef = useRef(null)
  const whatsappAutoSet = useRef(false)

  const capacity = event?.capacity > 0 ? Number(event.capacity) : 0

  // ── Restore saved registration from localStorage (modal, no URL param) ──
  useEffect(() => {
    if (!event?.id || initialRegId) { setRestoring(false); return }
    const saved = localStorage.getItem(lsKey(event.id))
    if (!saved) { setRestoring(false); return }
    let parsed
    try { parsed = JSON.parse(saved) } catch { setRestoring(false); return }
    if (!parsed?.registrationId) { setRestoring(false); return }
    ;(async () => {
      try {
        const reg = await getRegistrationById(parsed.registrationId)
        if (!reg) { localStorage.removeItem(lsKey(event.id)); return }
        setRegistrationId(reg.id)
        setFullName(reg.full_name || '')
        setWhatsapp(reg.whatsapp || '')
        setPaymentMethod(reg.payment_method || '')
        const isPaid = reg.paid === 1 || reg.paid === '1'
        const isCheckedIn = reg.checked_in === 1 || reg.checked_in === '1'
        setSuccess(true)
        if (isCheckedIn) {
          // Fully done — no need to keep localStorage
          localStorage.removeItem(lsKey(event.id))
        } else if (!isPaid && reg.payment_method === 'transferencia') {
          setPaymentPending(true)
          if (reg.transfer_proof_url) setProofUploaded(true)
        }
      } catch {}
      finally { setRestoring(false) }
    })()
  }, [event?.id, initialRegId]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Restore from URL param (?rid=) ──────────────────
  useEffect(() => {
    if (!initialRegId) return
    ;(async () => {
      try {
        const reg = await getRegistrationById(initialRegId)
        if (reg) {
          setRegistrationId(reg.id)
          setFullName(reg.full_name || '')
          setWhatsapp(reg.whatsapp || '')
          setPaymentMethod(reg.payment_method || '')
          const isPaid = reg.paid === 1 || reg.paid === '1'
          setSuccess(true)
          if (!isPaid && reg.payment_method === 'transferencia') {
            setPaymentPending(true)
            if (reg.transfer_proof_url) setProofUploaded(true)
          }
        }
      } catch {}
      finally { setRestoring(false) }
    })()
  }, [initialRegId])

  // ── WhatsApp membership check (informational only) ──
  useEffect(() => {
    if (!isValidPhone(phone)) {
      setIsWhatsappMember(null)
      return
    }
    const timer = setTimeout(async () => {
      try {
        const isMember = await checkWhatsappMember(phone)
        setIsWhatsappMember(isMember)
        if (isMember) {
          setWhatsapp('Ya estoy dentro')
          whatsappAutoSet.current = true
        } else if (whatsappAutoSet.current) {
          setWhatsapp('')
          whatsappAutoSet.current = false
        }
      } catch {
        setIsWhatsappMember(false)
      }
    }, 500)
    return () => clearTimeout(timer)
  }, [phone]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Duplicate event registration check (blocks submit) ──
  useEffect(() => {
    if (!isValidPhone(phone) || !event?.id) {
      setDuplicateReg(null)
      return
    }
    const timer = setTimeout(async () => {
      try {
        const existing = await checkExistingRegistration(phone, event.id)
        setDuplicateReg(existing ?? null)
      } catch {
        setDuplicateReg(null)
      }
    }, 500)
    return () => clearTimeout(timer)
  }, [phone, event?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Spots left ──────────────────────────────────────
  useEffect(() => {
    if (!event?.id || !capacity) return
    getRegistrationCountByEvent(event.id)
      .then(count => setSpotsLeft(Math.max(0, capacity - count)))
      .catch(() => setSpotsLeft(null))
  }, [event?.id, capacity])

  // ── Poll payment status ─────────────────────────────
  useEffect(() => {
    if (!paymentPending || !registrationId) return
    const interval = setInterval(async () => {
      try {
        const reg = await getRegistrationById(registrationId)
        if (reg?.paid === 1 || reg?.paid === '1') {
          setPaymentPending(false)
          // Keep localStorage until checked_in so the ticket is always recoverable
        }
      } catch {}
    }, 5000)
    return () => clearInterval(interval)
  }, [paymentPending, registrationId, event?.id])

  const handleStep1 = useCallback((e) => {
    e.preventDefault()
    setError('')
    if (duplicateReg) return  // blocked — already registered for this event
    if (!fullName.trim()) { setError('Por favor ingresa tu nombre completo'); return }
    if (!phone.trim()) { setError('Por favor ingresa tu número de teléfono'); return }
    if (!isValidPhone(phone)) { setError('Ingresa un número válido (ej: 667 123 4567 o +1 555 000 1234)'); return }
    if (!howFound) { setError('Por favor indica cómo te enteraste'); return }
    if (!whatsapp && isWhatsappMember === false) { setError('Por favor responde la pregunta de WhatsApp'); return }

    trackEvent('activity_reg_intent', {
      activity_id: activity?.id || event?.activity_id,
      activity_name: activity?.name || event?.name,
      event_id: event?.id,
      full_name: fullName.trim(),
      phone: phone.trim(),
      how_found: howFound === 'Otros' ? `Otros: ${howFoundOther.trim() || '?'}` : howFound,
      whatsapp,
    })

    setStep(2)
  }, [fullName, phone, howFound, howFoundOther, whatsapp, activity, event, duplicateReg, isWhatsappMember])

  const handlePayment = useCallback(async (method) => {
    setError('')
    setSubmitting(true)
    setShowTransferInfo(false)
    const howFoundFinal = howFound === 'Otros' ? `Otros: ${howFoundOther.trim() || '?'}` : howFound
    const actId = activity?.id ?? event?.activity_id ?? 0
    const actName = activity?.name ?? event?.name ?? ''
    try {
      const regId = await createActivityRegistration(
        actId,
        actName,
        fullName.trim(),
        phone.trim(),
        howFoundFinal,
        whatsapp,
        event?.id ?? null,
        event?.name ?? '',
        method,
      )
      trackEvent('activity_reg_confirm', {
        activity_id: actId,
        activity_name: actName,
        event_id: event?.id,
        payment_method: method,
        source: 'link',
      })
      if (spotsLeft !== null) setSpotsLeft(s => Math.max(0, s - 1))
      setRegistrationId(regId)
      setPaymentMethod(method)
      if (method === 'transferencia') setPaymentPending(true)
      setSuccess(true)
      if (onRegistered) onRegistered(regId)

      // Persist in localStorage so reopening the modal restores this state
      if (event?.id && regId) {
        localStorage.setItem(lsKey(event.id), JSON.stringify({ registrationId: regId, paymentMethod: method }))
      }

      if (whatsapp === 'Sí') {
        addWhatsappMember(phone.trim()).catch(() => {})
      }
    } catch {
      setError('Ocurrió un error al registrarte. Intenta nuevamente.')
      setStep(1)
    } finally {
      setSubmitting(false)
    }
  }, [fullName, phone, howFound, howFoundOther, whatsapp, activity, event, spotsLeft, onRegistered])

  const handleProofUpload = useCallback(async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingProof(true)
    setProofError('')
    try {
      await doUploadProof({ file, registrationId, eventName: event?.name })
      setProofUploaded(true)
    } catch {
      setProofError('No se pudo subir el comprobante. Intenta de nuevo.')
    } finally {
      setUploadingProof(false)
    }
  }, [registrationId, event?.name])

  const handleResumeRegistration = useCallback(async () => {
    if (!duplicateReg) return
    try {
      const reg = await getRegistrationById(duplicateReg.id)
      if (!reg) return
      setRegistrationId(reg.id)
      setFullName(reg.full_name || '')
      setWhatsapp(reg.whatsapp || '')
      setPaymentMethod(reg.payment_method || '')
      const isPaid = reg.paid === 1 || reg.paid === '1'
      setSuccess(true)
      if (!isPaid && reg.payment_method === 'transferencia') {
        setPaymentPending(true)
        if (reg.transfer_proof_url) setProofUploaded(true)
      }
    } catch {}
  }, [duplicateReg])

  const handleJoinGroup = useCallback(() => {
    if (phone) addWhatsappMember(phone.trim()).catch(() => {})
    window.open('https://chat.whatsapp.com/GVefjT90VZRJZ9X18Vizaw', '_blank', 'noopener')
  }, [phone])

  const handleSendTicketWhatsApp = useCallback(async () => {
    const dateStr = event?.date
      ? new Date(event.date + 'T12:00:00').toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
      : ''
    const payStr = paymentMethod === 'presencial'
      ? 'Presencial - Pagar en recepcion'
      : paymentMethod === 'transferencia'
        ? (paymentPending ? 'Transferencia - Pendiente' : 'Transferencia - Pagado')
        : ''
    const ticketNum = String(registrationId || '').padStart(4, '0')
    const msg = `*TICKET DE ACCESO - Hotel Punta Galeria*\n\n`
      + `*Nombre:* ${fullName.trim()}\n`
      + `*Evento:* ${event?.name || ''}\n`
      + `*Ticket:* #${ticketNum}\n`
      + (dateStr ? `*Fecha:* ${dateStr}\n` : '')
      + `*Lugar:* Hotel Punta Galeria, Morelia, Mich.\n`
      + (payStr ? `*Pago:* ${payStr}\n` : '')
      + `\n_Presenta este ticket en la entrada del evento_`

    const digits = phone.replace(/\D/g, '')
    const waPhone = digits.length === 10 ? `52${digits}` : digits
    const waUrl = `https://wa.me/${waPhone}?text=${encodeURIComponent(msg)}`

    // Móvil: Web Share API con PDF adjunto (sin bloqueador de popups)
    const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0
    if (isMobile && typeof navigator.share === 'function') {
      try {
        const qrDataUrl = qrSvgRef.current?.toDataURL?.('image/png') ?? null
        const { blob, filename } = await generateTicketPdfBlob({
          registrationId, fullName, event, qrDataUrl, paymentMethod, paymentPending,
        })
        const pdfFile = new File([blob], filename, { type: 'application/pdf' })
        if (navigator.canShare?.({ files: [pdfFile] })) {
          await navigator.share({ files: [pdfFile], text: msg })
          return
        }
      } catch {}
      // Fallback móvil sin Web Share API
      window.open(waUrl, '_blank', 'noopener')
      return
    }

    // PC: abrir WhatsApp síncrono (nunca se bloquea), luego descargar PDF
    // a.click() para descargas no es bloqueado aunque sea después de await
    window.open(waUrl, '_blank', 'noopener')
    try {
      const qrDataUrl = qrSvgRef.current?.toDataURL?.('image/png') ?? null
      const { blob, filename } = await generateTicketPdfBlob({
        registrationId, fullName, event, qrDataUrl, paymentMethod, paymentPending,
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = filename; a.click()
      URL.revokeObjectURL(url)
    } catch {}
  }, [registrationId, fullName, phone, event, paymentMethod, paymentPending, qrSvgRef])

  const handleDownloadPDF = useCallback(async () => {
    setDownloadingPDF(true)
    try {
      const canvas = qrSvgRef.current
      const qrDataUrl = canvas?.toDataURL?.('image/png') ?? null
      await downloadTicketPdf({
        registrationId,
        fullName,
        event,
        qrDataUrl,
        paymentMethod,
        paymentPending,
      })
    } catch {
      alert('No se pudo generar el PDF. Intenta de nuevo.')
    } finally {
      setDownloadingPDF(false)
    }
  }, [registrationId, fullName, event, paymentMethod, paymentPending])

  const spotsColor = spotsLeft !== null && capacity > 0
    ? spotsLeft <= 3 ? '#dc2626' : spotsLeft <= 8 ? '#d97706' : '#5a6c1e'
    : '#5a6c1e'

  const isSoldOut = capacity > 0 && spotsLeft === 0

  const phoneTyped = phone.trim().length > 0
  const phoneOk = phoneTyped && isValidPhone(phone)
  const phoneBad = phoneTyped && !phoneOk
  const ticketId = String(registrationId || '').padStart(4, '0')

  return {
    step, fullName, phone, howFound, howFoundOther, whatsapp,
    error, submitting, success, registrationId, paymentMethod,
    paymentPending, showTransferInfo, copiedClabe, proofUploaded,
    uploadingProof, proofError, downloadingPDF,
    spotsLeft, capacity, isSoldOut, spotsColor,
    phoneTyped, phoneOk, phoneBad, ticketId,
    isWhatsappMember, duplicateReg, restoring,
    qrSvgRef,
    setStep, setFullName, setPhone, setHowFound, setHowFoundOther,
    setWhatsapp, setError, setShowTransferInfo, setCopiedClabe,
    handleStep1, handlePayment, handleProofUpload, handleDownloadPDF, handleResumeRegistration, handleJoinGroup, handleSendTicketWhatsApp,
  }
}
