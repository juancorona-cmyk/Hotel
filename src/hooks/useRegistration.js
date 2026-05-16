import { useState, useEffect, useRef, useCallback } from 'react'
import {
  createActivityRegistration,
  getRegistrationCountByEvent,
  trackEvent,
  getRegistrationById,
  API_BASE,
} from '../lib/turso'
import { isValidPhone, compressImage } from '../lib/utils'
import {
  uploadTransferProof as doUploadProof,
  downloadTicketPdf,
} from '../lib/ticketPdf'

export const WHATSAPP_OPTIONS = ['Sí', 'No', 'Ya estoy dentro']
export const HOW_FOUND_OPTIONS = ['Instagram', 'Facebook', 'Conocido', 'Otros']

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

  const qrSvgRef = useRef(null)

  const capacity = event?.capacity > 0 ? Number(event.capacity) : 0

  // Load spots left
  useEffect(() => {
    if (!event?.id || !capacity) return
    getRegistrationCountByEvent(event.id)
      .then(count => setSpotsLeft(Math.max(0, capacity - count)))
      .catch(() => setSpotsLeft(null))
  }, [event?.id, capacity])

  // Load existing registration if coming back with ?rid=
  useEffect(() => {
    if (!initialRegId) return
    ;(async () => {
      try {
        const reg = await getRegistrationById(initialRegId)
        if (reg) {
          setRegistrationId(reg.id)
          setFullName(reg.full_name || '')
          setPaymentMethod(reg.payment_method || '')
          const isPaid = reg.paid === 1 || reg.paid === '1'
          setSuccess(true)
          if (!isPaid && reg.payment_method === 'transferencia') {
            setPaymentPending(true)
            if (reg.transfer_proof_url) setProofUploaded(true)
          }
        }
      } catch {}
    })()
  }, [initialRegId])

  // Poll payment status
  useEffect(() => {
    if (!paymentPending || !registrationId) return
    const interval = setInterval(async () => {
      try {
        const reg = await getRegistrationById(registrationId)
        if (reg?.paid === 1 || reg?.paid === '1') setPaymentPending(false)
      } catch {}
    }, 5000)
    return () => clearInterval(interval)
  }, [paymentPending, registrationId])

  const handleStep1 = useCallback((e) => {
    e.preventDefault()
    setError('')
    if (!fullName.trim()) { setError('Por favor ingresa tu nombre completo'); return }
    if (!phone.trim()) { setError('Por favor ingresa tu número de teléfono'); return }
    if (!isValidPhone(phone)) { setError('Ingresa un número válido (ej: 667 123 4567 o +1 555 000 1234)'); return }
    if (!howFound) { setError('Por favor indica cómo te enteraste'); return }
    if (!whatsapp) { setError('Por favor responde la pregunta de WhatsApp'); return }

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
  }, [fullName, phone, howFound, howFoundOther, whatsapp, activity, event])

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

  const handleDownloadPDF = useCallback(async () => {
    setDownloadingPDF(true)
    try {
      await downloadTicketPdf({
        registrationId,
        fullName,
        event,
        qrSvgEl: qrSvgRef.current,
      })
    } catch {
      alert('No se pudo generar el PDF. Intenta de nuevo.')
    } finally {
      setDownloadingPDF(false)
    }
  }, [registrationId, fullName, event])

  // Spots badge
  const spotsColor = spotsLeft !== null && capacity > 0
    ? spotsLeft <= 3 ? '#dc2626' : spotsLeft <= 8 ? '#d97706' : '#5a6c1e'
    : '#5a6c1e'

  const isSoldOut = capacity > 0 && spotsLeft === 0

  const phoneTyped = phone.trim().length > 0
  const phoneOk = phoneTyped && isValidPhone(phone)
  const phoneBad = phoneTyped && !phoneOk
  const ticketId = String(registrationId || '').padStart(4, '0')

  return {
    // State
    step, fullName, phone, howFound, howFoundOther, whatsapp,
    error, submitting, success, registrationId, paymentMethod,
    paymentPending, showTransferInfo, copiedClabe, proofUploaded,
    uploadingProof, proofError, downloadingPDF,
    spotsLeft, capacity, isSoldOut, spotsColor,
    phoneTyped, phoneOk, phoneBad, ticketId,
    qrSvgRef,
    // Setters
    setStep, setFullName, setPhone, setHowFound, setHowFoundOther,
    setWhatsapp, setError, setShowTransferInfo, setCopiedClabe,
    // Handlers
    handleStep1, handlePayment, handleProofUpload, handleDownloadPDF,
  }
}
