import { useState, useEffect } from 'react'
import { createActivityRegistration, getRegistrationCountByEvent, trackEvent, API_BASE } from '../lib/turso'
import { fmtFecha, isValidPhone } from '../lib/utils'
import './ActivityRegModal.css'

export default function ActivityRegModal({ activity, event, onClose }) {
  const [step, setStep]                   = useState(1)
  const [fullName, setFullName]           = useState('')
  const [phone, setPhone]                 = useState('')
  const [howFound, setHowFound]           = useState('')
  const [howFoundOther, setHowFoundOther] = useState('')
  const [whatsapp, setWhatsapp]           = useState('')
  const [error, setError]                 = useState('')
  const [saving, setSaving]               = useState(false)
  const [success, setSuccess]             = useState(false)
  const [regId, setRegId]                 = useState(null)
  const [exporting, setExporting]         = useState(false)
  const [payMethod, setPayMethod]         = useState('')

  // Capacity tracking
  const [spotsLeft, setSpotsLeft]   = useState(null)
  const [spotsLoading, setSpotsLoading] = useState(false)

  const capacity = event?.capacity > 0 ? Number(event.capacity) : 0

  useEffect(() => {
    if (!event?.id || !capacity) return
    setSpotsLoading(true)
    getRegistrationCountByEvent(event.id)
      .then(count => setSpotsLeft(Math.max(0, capacity - count)))
      .catch(() => setSpotsLeft(null))
      .finally(() => setSpotsLoading(false))
  }, [event?.id, capacity])

  const isSoldOut = capacity > 0 && spotsLeft === 0 && !spotsLoading

  const handleStep1 = (e) => {
    e.preventDefault()
    setError('')
    if (!fullName.trim()) { setError('Por favor ingresa tu nombre completo'); return }
    if (!phone.trim())    { setError('Por favor ingresa tu número de teléfono'); return }
    if (!isValidPhone(phone)) { setError('Ingresa un número válido (ej: 667 123 4567 o +1 555 000 1234)'); return }
    if (!howFound)        { setError('Por favor indica cómo te enteraste'); return }
    if (!whatsapp)        { setError('Por favor responde la pregunta de WhatsApp'); return }
    
    trackEvent('activity_reg_intent', {
      activity_id: activity.id,
      activity_name: activity.name,
      event_id: event?.id,
      full_name: fullName.trim(),
      phone: phone.trim(),
      how_found: howFound === 'Otros' ? `Otros: ${howFoundOther.trim() || '?'}` : howFound,
      whatsapp
    })

    setStep(2)
  }

  const handlePayment = async (method) => {
    setError('')
    setSaving(true)
    const howFoundFinal = howFound === 'Otros' ? `Otros: ${howFoundOther.trim() || '?'}` : howFound
    try {
      const newId = await createActivityRegistration(
        activity.id,
        activity.name,
        fullName.trim(),
        phone.trim(),
        howFoundFinal,
        whatsapp,
        event?.id ?? null,
        event?.name ?? '',
        method,
      )
      setRegId(newId)
      setPayMethod(method)
      trackEvent('activity_reg_confirm', {
        activity_id: activity.id,
        activity_name: activity.name,
        event_id: event?.id,
        payment_method: method
      })
      if (spotsLeft !== null) setSpotsLeft(s => Math.max(0, s - 1))
      setSuccess(true)
    } catch {
      setError('Error al registrar. Intenta nuevamente.')
      setStep(1)
    } finally {
      setSaving(false)
    }
  }

  // Spots badge config
  const spotsColor = spotsLeft !== null && capacity > 0
    ? spotsLeft <= 3 ? '#dc2626'
    : spotsLeft <= 8 ? '#d97706'
    : '#5a6c1e'
    : '#5a6c1e'

  const phoneTyped = phone.trim().length > 0
  const phoneOk    = phoneTyped && isValidPhone(phone)
  const phoneBad   = phoneTyped && !phoneOk

  const ticketId = String(regId || '').padStart(4, '0')
  const ticketVerificationCode = `${ticketId}-${String(fullName.length).padStart(2, '0')}${String(activity.id).padStart(2, '0')}`

  const handleDownloadTicket = async () => {
    setExporting(true)
    const dateStr = new Date().toLocaleDateString('es-MX', {
      day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
    })
    const checkinUrl = `https://hotelpuntagaleria.mx/checkin?rid=${regId}`

    const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;700;800;900&display=swap" rel="stylesheet">
<style>
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { 
    font-family: 'Montserrat', sans-serif; 
    background: #f0f2f5; 
    display: flex; 
    justify-content: center; 
    align-items: center; 
    width: 210mm;
    height: 297mm;
    overflow: hidden;
  }
  
  .ticket-container {
    width: 140mm;
    background: #fff;
    border-radius: 8mm;
    box-shadow: 0 10px 30px rgba(0,0,0,0.1);
    position: relative;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  /* Leaf Pattern Background */
  .leaf-bg {
    position: absolute;
    top: 0; left: 0; right: 0; bottom: 0;
    opacity: 0.04;
    pointer-events: none;
    z-index: 0;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'%3E%3Cpath fill='%235a6c1e' d='M25 30c5-5 15-5 20 0-5 5-5 15 0 20-5-5-15-5-20 0 5-5 5-15 0-20z'/%3E%3Cpath fill='%235a6c1e' d='M75 70c5-5 15-5 20 0-5 5-5 15 0 20-5-5-15-5-20 0 5-5 5-15 0-20z'/%3E%3Cpath fill='%235a6c1e' d='M20 80c3-3 9-3 12 0-3 3-3 9 0 12-3-3-9-3-12 0 3-3 3-9 0-12z'/%3E%3Cpath fill='%235a6c1e' d='M80 20c3-3 9-3 12 0-3 3-3 9 0 12-3-3-9-3-12 0 3-3 3-9 0-12z'/%3E%3C/svg%3E");
  }

  .header {
    background: #5a6c1e;
    padding: 8mm;
    text-align: center;
    position: relative;
    z-index: 1;
  }
  .header svg { width: 40mm; height: auto; }

  .content {
    padding: 8mm;
    position: relative;
    z-index: 1;
  }

  .ticket-id-section {
    text-align: center;
    margin-bottom: 6mm;
  }
  .ticket-label {
    font-size: 9px;
    font-weight: 800;
    color: #5a6c1e;
    letter-spacing: 2.5px;
    text-transform: uppercase;
    margin-bottom: 1.5mm;
  }
  .ticket-number {
    font-size: 32px;
    font-weight: 900;
    color: #1a1a1a;
    background: #f3f4f6;
    display: inline-block;
    padding: 1.5mm 7mm;
    border-radius: 3.5mm;
    border: 1px solid #e5e7eb;
  }

  .qr-section {
    display: flex;
    flex-direction: column;
    align-items: center;
    margin-bottom: 6mm;
  }
  .qr-wrapper {
    padding: 5mm;
    background: #fff;
    border: 1px solid #e5e7eb;
    border-radius: 5mm;
    box-shadow: 0 4px 15px rgba(0,0,0,0.05);
  }
  .qr-wrapper img { width: 40mm; height: 40mm; display: block; }
  .qr-hint {
    margin-top: 3mm;
    font-size: 9px;
    color: #6b7280;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1.2px;
  }

  .info-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 3mm;
  }
  .info-item {
    background: #fff;
    padding: 2.5mm 3.5mm;
    border-radius: 2.5mm;
    border: 1px solid #f3f4f6;
  }
  .info-item.full { grid-column: span 2; background: #f9fafb; border-left: 4px solid #5a6c1e; }
  .info-lbl { font-size: 7.5px; font-weight: 800; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.4px; margin-bottom: 0.8mm; }
  .info-val { font-size: 13px; font-weight: 700; color: #1f2937; }
  .info-item.full .info-val { font-size: 16px; color: #111827; }

  .instructions-box {
    margin-top: 6mm;
    background: #fffbeb;
    padding: 4mm;
    border-radius: 3.5mm;
    border: 1px solid #fef3c7;
  }
  .instr-title { font-size: 9px; font-weight: 900; color: #92400e; text-transform: uppercase; margin-bottom: 1.5mm; display: flex; align-items: center; }
  .instr-title svg { margin-right: 1.5mm; }
  .instr-text { font-size: 9px; line-height: 1.5; color: #b45309; font-weight: 500; }

  .notch-container {
    position: relative;
    height: 8mm;
    margin: 4mm 0;
    display: flex;
    align-items: center;
    z-index: 1;
  }
  .notch-left, .notch-right {
    position: absolute;
    width: 8mm;
    height: 8mm;
    background: #f0f2f5;
    border-radius: 50%;
  }
  .notch-left { left: -4mm; }
  .notch-right { right: -4mm; }
  .divider {
    flex-grow: 1;
    height: 0;
    border-top: 1.2px dashed #d1d5db;
    margin: 0 4mm;
  }

  .footer-ticket {
    background: #f9fafb;
    padding: 5mm;
    text-align: center;
    border-top: 1px solid #f3f4f6;
    z-index: 1;
  }
  .footer-brand { font-size: 11px; font-weight: 800; color: #5a6c1e; letter-spacing: 0.8px; }
  .footer-id { font-family: monospace; font-size: 8px; color: #9ca3af; margin-top: 1.5mm; }
</style></head>
<body>
<div class="ticket-container">
  <div class="leaf-bg"></div>
  <div class="header">
    <svg viewBox="0 0 997 283">
      <g fill="#fff">
        <path d="M83.49,144.65c-6.18.38-12.55-.8-15.59-6.71-4.13,2.92-9.22,5.26-13.16,8.43-4.48,3.61-7.91,10.66-14.86,7.59-5.09-2.25-6.34-11.3-5.76-16.21.19-1.64,1.01-3,1.36-4.4.17-.7.04-.82-.66-.66-6.84,1.59-15.44,10.24-18.77,16.26-1.87,3.38-5.1,13.42-7.94,15.09-1.43.84-3.16.73-4.54-.18-4.68-3.1,2.03-11.61,1.22-12.49-3.89-.24-6.13-4.73-3.94-8.02,4.97-7.18,13.85-14.27,18.23-21.59,4.27-7.12,7.52-17.08,11.2-24.78,8.17-17.08,16.6-33.09,30.87-45.9,3.23-2.9,9.88-9.46,14.28-5.75,5.1,4.3-2.05,17.24-4.18,22.09-12.33,20.52-27.49,39.07-41.99,58.04,5.55-2.33,14.91-3.96,15.37,4.58.23,4.33-2.68,8.13-1.89,13.85.07.5.31,2.15,1.15,1.72.26-.13,2.94-3.55,3.83-4.33,5.35-4.66,12.04-7.42,17.79-11.51.09-2.35-.42-4.5-.25-6.95.52-7.65,4.91-15.22,11.36-19.34,2.77-1.77,7.15-2.56,9.04-3.92,1.6-1.15,3.64-4.68,5.76-6.24,2.23-1.65,4.54-2.61,7.12-.91,3.51,2.31,1.43,6.61,2.44,8.11.14.2,3.35,1.62,4.33,2.39,1.38,1.09,2.88,2.9,3.7,4.46,2.04,3.89,1.72,8.34,3.51,12.32,11.52-12.22,11.73-29.07,17.03-44.14l-21.35,8.65c-5.16-.35-8.69-6.39-4.58-10.35,2.48-2.38,7.44-1.65,10.76-2.2,7.19-1.19,13.51-3.19,19.84-6.79,6.03-13.97,12.23-27.88,18.45-41.77,1.51-3.37,2.54-9.96,6.51-10.77s5.92,1.5,5.29,5.29c-.85,5.14-7.61,16.79-9.84,22.79-2.34,6.29-4.15,12.82-5.88,19.31,19.56-7.64,39.32-14.89,59.68-20.2,5.65-9.26,10.43-19.12,16.49-28.13,2.47-3.67,10.15-16.41,15.25-9.28,2.48,3.46.07,9.65-1.1,13.35-2.22,7.03-5.54,13.72-7.8,20.74,4.34-.55,8.83-1.21,13.2-1.43,3.26-.17,8.84-.54,11.87-.37,6.66.39,7.28,12.88,1.53,13.77-3.29.51-8.21-2.29-11.62-3.2-3.15-.84-16.61-2.86-18.58-1.1-.78.69-4.83,9.93-5.91,11.84-3.88,6.9-8.6,13.95-13.13,20.46-4.32,6.21-18.77,22.95-20.32,28.61-1.4,5.1-1.92,9.88,4.84,7.24,5.3-2.07,14.96-18.93,20.11-24.03,7.23-7.17,18.94-11.46,28.06-4.99,7.08,5.03,5.38,11.29,8.43,17.95,4.34,9.46,14.91,13.88,24.93,12.95,12.43-1.15,43.84-21.88,54.21-30.23,11.99-9.65,31.66-31.11,48.85-24.83,3.13,1.14,10.89,6.71,4.21,8.31-13.8,3.31-21.07,1.91-33.57,11.05-19.63,14.36-33.77,28.67-56.97,38.99-17.93,7.98-38.66,8.15-49.02-11.3-3.6-6.76-1.46-17.56-12.31-16.94-16.78.97-20.57,29.78-37.98,32.07-3.65.48-7.2.37-10.01-2.33-.93-.9-2.4-4.5-3.33-4.3-.33.07-4.17,3.8-5.11,4.5-7.93,5.88-17.71,11.63-27.79,12.28l7.63,5.56c14.03,13.6,15.8,41.59,13.42,59.86-2.19,16.85-13.83,32.97-30.65,37.48-11.79,3.16-23.04-.93-33.1-6.95v55.65h-19.67v-138.17ZM223.09,37.17l.98-3.82-2.39,3.6,1.41.22ZM219.27,44.38l-1.94.7-11.49,22.81c5.52-7.13,9.83-15.25,13.43-23.51ZM204.4,47.74c-20.23,5.36-39.57,13.45-58.8,21.56-3.09,7.98-5.89,16.06-9.11,24-1.41,3.49-4.58,8.53-5.29,11.98-.39,1.89-1.21,12.59-.21,13.46l2.33-.55c.58-13.39,8.31-26.79,19.78-33.72,4.52-2.73,16.96-8.1,17.28,1.4.18,5.34-9.38,16.43-13.01,20.62-4.52,5.23,9.51,9.99-14.37,14.88,2.7,3.31,9.43-.11,12.79-1.6,8.5-3.76,20.81-13.05,25.36-21.18,4.75-8.51,8.27-20.34,12.62-29.6,3.37-7.17,7.4-14.03,10.64-21.26ZM64.77,60.22c-.54-.55-4.49,3.72-5.04,4.31-7.67,8.27-13.62,19.64-18.46,29.75,4.77-4.9,8.97-10.98,12.86-16.64,1.15-1.67,11.36-16.69,10.64-17.42ZM157.38,95.72c-.33-.31-4.5,2.91-5.02,3.37-3.44,3.02-6.91,7.42-7.93,11.98,5.04-4.4,9.48-9.64,12.95-15.35ZM83.49,127.86h15.59c4.44-4.86,5.78-15.32-.47-19.19-4.21,6.8-9.6,13.19-15.6,18.48-1.16,1.02-6.89,4.74-7.11,5.12-.56.96.34,3.51,1.34,3.99l6.24.24v-8.64ZM128.11,127.86c-2.41-1.98-4.17-3.83-5.52-6.7l-7.44,8.14c4.25-1,8.58-1.67,12.95-1.44ZM138.18,128.82l-2.23-2.32-3.05.89c-.12.71.9.59,1.43.72,1.26.29,2.59.41,3.85.71ZM110.83,130.27l-2.84-.95-1,2.38,3.83-1.43ZM122.24,150.55c-6.55.69-13.6,4.62-18.53,8.82l-.1,42.17c-.07.95.41,1.31.96,1.92,7.51,8.19,23.84,12.06,31.94,2.62,11.59-13.51,12.01-58.3-14.27-55.53Z"/>
        <path d="M576.25,224.78c-5.39,6.22-12.76,10.75-20.63,13.2-33.52,10.42-59.34-7.48-66.72-40.29,1.25-22.38-1.61-46.46,0-68.64,2.8-38.69,43.38-62.3,78.88-46.69,16.04,7.05,27.18,23.86,30.09,40.88l-23.54,8.47c-2.09-10.13-8.86-21.56-18.73-25.66-18.31-7.6-40.15,7.11-41.73,26.39-1.38,16.95,1.03,35.65-.03,52.79,5.33,43.38,59.91,36.61,60.47-5.06h-29.75v-25.43h52.3v83.72l-.72.72h-19.91v-14.39Z"/>
        <path d="M757.38,188.31c-1.18.37-.43,6.18-.2,7.4,1.36,7.29,6.57,13.67,13.55,16.2,10.01,3.63,20.64-3.39,24.57-12.57l18.71,12.96c.6.43.74.85.64,1.57-.37,2.57-6.7,9.49-8.82,11.38-13.16,11.75-28.96,17.83-46.14,10.65-26.67-11.14-34.14-52.81-27.37-77.91,10.87-40.27,57.61-51.55,79.11-12.69,7.01,12.67,10.52,29.25,4.96,43.02h-59.02ZM794.57,168.64v-9.36c0-.81-1.85-5.25-2.39-6.25-6.48-12-28.18-11.37-33.69,1.36-.44,1.01-1.83,5.51-1.83,6.33v7.92h37.91Z"/>
        <path d="M476.45,238.21h-20.63v-8.16c-6.98,8.05-19.78,12.4-30.25,10.34-11.71-2.31-19.98-10.86-23.62-21.96-11.59-35.27,22.06-58.21,53.87-55.07.84-16.12-15.95-26.31-29.9-17.67-4.65,2.88-6.34,6.47-8.44,11.24-.2.45.28.84-.75.66l-12.97-14.42-.17-1.06c10.1-17.24,33.6-25.33,52.23-17.85,14.2,5.69,19.38,19.76,20.66,34.03l-.02,79.91ZM454.38,210.14v-26.87c-1.06-.85-3.56-1.15-5.02-1.22-12.88-.63-25.65,5.1-29.28,18.25-1.76,6.37-1.71,12.38,3.82,16.8,9.49,7.58,23.17.4,30.48-6.97Z"/>
        <path d="M679.41,238.21h-20.63v-7.68l-6.88,5.36c-20.28,11.43-41.41,2.52-47.58-19.75-9.51-34.33,23.77-55.84,54.46-52.77,1.13-20.91-25.61-28.88-36.37-10.7-.87,1.47-1.22,2.95-1.91,4.34-.23.45,1.13.77-.81.6l-12.98-14.41c-.66-1.44,2.75-5.42,3.85-6.71,22.62-26.37,68.24-17.47,68.88,20.86l-.02,80.86ZM657.34,182.56c-10.4-1.24-21.3-.13-28.8,7.91-6.71,7.19-10.05,21.59-.32,27.69,8.74,5.48,21.27-.38,27.93-6.83.31-.3.77-.43,1.19-.46v-28.31Z"/>
        <path d="M997.05,238.21h-20.63v-7.68l-6.88,5.36c-20.25,11.42-41.41,2.52-47.58-19.75-9.51-34.33,23.77-55.82,54.46-52.77,1.13-20.91-25.61-28.88-36.37-10.7-.87,1.47-1.22,2.95-1.91,4.34-.23.45,1.13.77-.81.6l-12.98-14.41c-.66-1.44,2.75-5.42,3.85-6.71,22.6-26.35,68.28-17.48,68.88,20.86l-.02,80.86ZM974.98,182.56c-10.41-1.24-21.3-.13-28.8,7.91-6.71,7.19-10.05,21.59-.32,27.69,9.48,5.95,21.76-1.19,29.12-7.53v-28.07Z"/>
        <path d="M197.2,124.5c.19,17.03-.25,34.09-.02,51.12.12,9.1-.31,20.99.48,29.75,1.44,16.01,29.77,12.63,29.77-2.9v-77.48h22.07v112.51l-.72.72h-21.35v-10.56c-7.97,7.84-19.05,10.42-30.01,9.61-15.53-1.15-22.41-13.2-23.27-27.59-1.63-27.26,1.28-56.1,0-83.53l.74-1.65h22.31Z"/>
        <path d="M287.41,124.98v10.56c12.77-9.89,28.34-15.46,42.23-4.08,3.88,3.18,10.55,12.24,10.55,17.28v89.24l-.72.72h-21.11l-.72-.72v-83.96c-7.8-10.11-17.79-8.02-25.92.47-.55.57-4.31,4.95-4.31,5.29v77.72l-.72.72h-21.11l-.72-.72v-111.79l.72-.72h21.83Z"/>
        <path d="M382.89,121.63h15.59l.72.72v24.71h-16.31v60.69c0,.5,1.61,4.48,2,5.19,2.68,4.92,9.03,6.98,14.31,5.6v21.83l-.79.64c-15.24.21-30.04-5.08-35.68-20.3-.66-1.77-2.39-7.54-2.39-9.13v-64.53h-16.07l-.72-.72v-24.47l.72-.72h14.63v-31.9l.72-.72h22.55l.72.72v32.38Z"/>
        <polygon points="721.16 77.01 721.16 236.05 720.44 236.77 694.77 236.77 694.77 77.01 721.16 77.01"/>
        <path d="M845.43,121.15v19.19c9.33-9.03,20.64-16.58,33.59-19.19v34.06h-9.36c-1.7,0-7.16,1.79-9,2.51-5.6,2.2-10.18,5.91-13.79,10.68v70.05l-.72.72h-21.59l-.72-.72v-117.3h21.59Z"/>
        <polygon points="908.76 125.46 908.76 238.93 908.04 239.65 886.69 239.65 886.69 125.46 908.76 125.46"/>
        <polygon points="938.99 84.68 906.12 116.35 888.13 116.35 912.84 84.68 938.99 84.68"/>
      </g>
    </svg>
  </div>
  
  <div class="content">
    <div class="ticket-id-section">
      <div class="ticket-label">Ticket de Acceso</div>
      <div class="ticket-number">#${ticketId}</div>
    </div>

    <div class="qr-section">
      <div class="qr-wrapper">
        <img src="https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(checkinUrl)}" alt="QR" />
      </div>
      <div class="qr-hint">Escanear al llegar</div>
    </div>

    <div class="info-grid">
      <div class="info-item full">
        <div class="info-lbl">Persona Registrada</div>
        <div class="info-val">${fullName.toUpperCase()}</div>
      </div>
      <div class="info-item full">
        <div class="info-lbl">Actividad / Evento</div>
        <div class="info-val">${activity.name}${event ? ' — ' + event.name : ''}</div>
      </div>
      ${event?.date ? `<div class="info-item full">
        <div class="info-lbl">Fecha del Evento</div>
        <div class="info-val">${fmtFecha(event.date, true)}</div>
      </div>` : ''}
      <div class="info-item">
        <div class="info-lbl">Precio</div>
        <div class="info-val">${event?.price > 0 ? '$' + parseFloat(event.price).toFixed(2) + ' MXN' : 'GRATIS'}</div>
      </div>
      <div class="info-item">
        <div class="info-lbl">Método de Pago</div>
        <div class="info-val">${payMethod === 'transferencia' ? 'TRANSFERENCIA' : 'PRESENCIAL'}</div>
      </div>
      <div class="info-item">
        <div class="info-lbl">Teléfono</div>
        <div class="info-val">${phone}</div>
      </div>
      <div class="info-item">
        <div class="info-lbl">Fecha de Registro</div>
        <div class="info-val">${dateStr}</div>
      </div>
    </div>

    <div class="instructions-box">
      <div class="instr-title">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
        Instrucciones
      </div>
      <div class="instr-text">
        • Presentar este ticket al llegar para validación.<br>
        • El pago debe realizarse en recepción o con el encargado.<br>
        • Llegar 10 minutos antes de la actividad.
      </div>
    </div>
  </div>

  <div class="notch-container">
    <div class="notch-left"></div>
    <div class="divider"></div>
    <div class="notch-right"></div>
  </div>

  <div class="footer-ticket">
    <div class="footer-brand">HOTEL PUNTA GALERÍA</div>
    <div class="footer-id">VALID-ID: ${ticketVerificationCode}</div>
  </div>
</div>
</body></html>`

    try {
      const res = await fetch(`${API_BASE}/.netlify/functions/export-pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ html, filename: `ticket-hotel-${ticketId}.pdf` })
      })
      if (!res.ok) throw new Error('PDF fail')
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `ticket-hotel-${ticketId}.pdf`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (e) {
      alert('Error al generar PDF. Por favor toma una captura de pantalla de tu ticket.')
    } finally {
      setExporting(false)
    }
  }

  const handleShareWhatsApp = () => {
    const dateStr = new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })
    const checkinUrl = `https://hotelpuntagaleria.mx/checkin?rid=${regId}`
    const msg = `🎫 *TICKET DE ACCESO — Hotel Punta Galería*\n\n`
      + `👤 *${fullName.trim()}*\n`
      + `📋 *${activity.name}*${event ? ' — ' + event.name : ''}\n`
      + `🎟️ Ticket: #${ticketId}\n`
      + `📅 ${dateStr}\n`
      + `💵 ${event?.price > 0 ? '$' + parseFloat(event.price).toFixed(2) + ' MXN' : 'GRATIS'} | Pago: ${payMethod === 'transferencia' ? 'Transferencia' : 'Presencial'}\n\n`
      + `📍 Hotel Punta Galería, Morelia, Mich.\n\n`
      + `🔗 Link de check-in: ${checkinUrl}`

    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank', 'noopener')
  }

  return (
    <div className="arm-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="arm-card">

        {/* Header */}
        <div className="arm-header">
          <div>
            <span className="arm-eyebrow">Inscripción</span>
            <h2 className="arm-title">{activity.name}</h2>
          </div>
          <button className="arm-close" onClick={onClose} aria-label="Cerrar">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Event details banner */}
        {event && (
          <div className="arm-event-banner">
            <div className="arm-event-banner__name">{event.name}</div>
            <div className="arm-event-banner__meta">
              {event.date && (
                <span className="arm-event-banner__pill">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                  {fmtFecha(event.date, true)}
                </span>
              )}
              {event.price > 0 && (
                <span className="arm-event-banner__pill arm-event-banner__pill--price">
                  ${parseFloat(event.price).toFixed(2)}
                </span>
              )}
              {capacity > 0 && (
                <span
                  className="arm-event-banner__pill arm-spots-pill"
                  style={{ borderColor: spotsColor, color: spotsColor }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
                  {spotsLoading
                    ? `${capacity} lugares`
                    : spotsLeft !== null
                      ? spotsLeft <= 3 && spotsLeft > 0
                        ? `¡Solo ${spotsLeft} lugar${spotsLeft === 1 ? '' : 'es'}!`
                        : spotsLeft === 0
                          ? 'Sin lugares'
                          : `${spotsLeft} de ${capacity} disponibles`
                      : `${capacity} lugares`
                  }
                </span>
              )}
            </div>
            {event.description && (
              <p className="arm-event-banner__desc">{event.description}</p>
            )}
          </div>
        )}

        {/* Éxito siempre tiene prioridad — incluso si era el último lugar */}
        {success ? (
          <div className="arm-success">
            {/* Check animado */}
            <div className="arm-success__check">
              <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
                <circle cx="32" cy="32" r="32" fill="#eef4e0"/>
                <circle cx="32" cy="32" r="26" fill="#d6e9a0"/>
                <polyline points="20,33 28,41 44,23" stroke="#3d5012" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>

            <h2 className="arm-success__title">¡Registro exitoso!</h2>

            {/* Ticket card — dos columnas: # izquierda, evento+fecha derecha */}
            <div className="arm-success__ticket">
              <div className="arm-success__ticket-cols">
                <div className="arm-success__ticket-left">
                  <span className="arm-success__ticket-label">TICKET</span>
                  <span className="arm-success__ticket-id">#{ticketId}</span>
                </div>
                <div className="arm-success__ticket-divider" aria-hidden="true"/>
                <div className="arm-success__ticket-right">
                  <span className="arm-success__ticket-event-name">
                    {event?.name || activity?.name || 'Evento'}
                  </span>
                  {event?.date && (
                    <span className="arm-success__ticket-date">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                        <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                      </svg>
                      {fmtFecha(event.date, true)}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Botones apilados */}
            <div className="arm-success__actions">
              <button className="arm-success__btn arm-success__btn--wa" onClick={handleShareWhatsApp}>
                <span className="arm-success__btn-icon">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                </span>
                <span className="arm-success__btn-label">
                  <span className="arm-success__btn-title">Recibir por WhatsApp</span>
                  <span className="arm-success__btn-sub">Te enviamos el ticket ahora</span>
                </span>
              </button>

              <button
                className={`arm-success__btn arm-success__btn--pdf ${exporting ? 'loading' : ''}`}
                onClick={handleDownloadTicket}
                disabled={exporting}
              >
                <span className="arm-success__btn-icon">
                  {exporting
                    ? <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/></svg>
                    : <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v13"/><polyline points="8 12 12 16 16 12"/><path d="M4 19h16"/></svg>
                  }
                </span>
                <span className="arm-success__btn-label">
                  <span className="arm-success__btn-title">{exporting ? 'Generando PDF…' : 'Descargar PDF'}</span>
                  <span className="arm-success__btn-sub">Guarda tu ticket en el celular</span>
                </span>
              </button>
            </div>

            <button className="arm-success__close-btn" onClick={onClose}>Cerrar</button>
          </div>
        ) : isSoldOut ? (
          <div className="arm-soldout">
            <div className="arm-soldout__icon">🌴</div>
            <p className="arm-soldout__title">¡Lugares agotados!</p>
            <p className="arm-soldout__msg">
              Este evento se llenó. Síguenos para enterarte de los próximos eventos y clases.
            </p>
            <button className="arm-soldout__wa" onClick={() => window.open('https://wa.me/526677154727', '_blank')}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              Avisarme del próximo evento
            </button>
          </div>
        ) : step === 1 ? (
          <form onSubmit={handleStep1} className="arm-form">
            <div className="arm-steps">
              <span className="arm-step arm-step--active">1</span>
              <span className="arm-step-line"/>
              <span className="arm-step">2</span>
            </div>

            <div className="arm-field">
              <label className="arm-label">Nombre completo <span>(Persona que tomará la clase)</span> *</label>
              <input
                type="text"
                className="arm-input"
                value={fullName}
                onChange={e => { setFullName(e.target.value); setError('') }}
                placeholder="Tu nombre completo"
              />
            </div>

            <div className="arm-field">
              <label className="arm-label">Número de teléfono *</label>
              <input
                type="tel"
                className={`arm-input${phoneOk ? ' arm-input--ok' : phoneBad ? ' arm-input--error' : ''}`}
                value={phone}
                onChange={e => { setPhone(e.target.value); setError('') }}
                placeholder="Ej: 667 123 4567"
              />
              {phoneBad && <p className="arm-phone-hint">Ej: 667 123 4567 · +1 555 000 1234 · +52 667 123 4567</p>}
            </div>

            <div className="arm-field">
              <label className="arm-label">¿Cómo te enteraste del evento? *</label>
              <div className="arm-radio-group">
                {['Instagram', 'Facebook', 'Conocido', 'Otros'].map(opt => (
                  <label key={opt} className={`arm-radio-label ${howFound === opt ? 'arm-radio-label--active' : ''}`}>
                    <input type="radio" name="howFound" value={opt} checked={howFound === opt}
                      onChange={() => { setHowFound(opt); setError('') }} />
                    {opt}
                  </label>
                ))}
              </div>
              {howFound === 'Otros' && (
                <input type="text" className="arm-input arm-input--sm"
                  value={howFoundOther} onChange={e => setHowFoundOther(e.target.value)}
                  placeholder="¿Cuál?" />
              )}
            </div>

            <div className="arm-field">
              <label className="arm-label">¿Te gustaría que te agreguemos al grupo de WhatsApp para futuros eventos y clases de Hotel Punta Galería? *</label>
              <div className="arm-radio-group">
                {['Sí', 'No', 'Ya estoy dentro'].map(opt => (
                  <label key={opt} className={`arm-radio-label ${whatsapp === opt ? 'arm-radio-label--active' : ''}`}>
                    <input type="radio" name="whatsapp" value={opt} checked={whatsapp === opt}
                      onChange={() => { setWhatsapp(opt); setError('') }} />
                    {opt}
                  </label>
                ))}
              </div>
            </div>

            {error && <p className="arm-error">{error}</p>}

            <button type="submit" className="arm-submit">
              Continuar al pago →
            </button>
          </form>
        ) : (
          <div className="arm-form">
            <div className="arm-steps">
              <span className="arm-step arm-step--done">✓</span>
              <span className="arm-step-line arm-step-line--done"/>
              <span className="arm-step arm-step--active">2</span>
            </div>

            <p className="arm-pay-sub">¿Cómo realizarás tu pago{event?.price > 0 ? ` de $${parseFloat(event.price).toFixed(2)}` : ''}?</p>

            <div className="arm-pay-options">
              <button
                type="button"
                className="arm-pay-card"
                onClick={() => handlePayment('transferencia')}
                disabled={saving}
              >
                <div className="arm-pay-card__icon">
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="5" width="20" height="14" rx="2"/>
                    <line x1="2" y1="10" x2="22" y2="10"/>
                  </svg>
                </div>
                <div className="arm-pay-card__info">
                  <strong>Transferencia bancaria</strong>
                  <span>Te enviamos los datos por WhatsApp</span>
                </div>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
              </button>

              <button
                type="button"
                className="arm-pay-card"
                onClick={() => handlePayment('presencial')}
                disabled={saving}
              >
                <div className="arm-pay-card__icon">
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                    <polyline points="9 22 9 12 15 12 15 22"/>
                  </svg>
                </div>
                <div className="arm-pay-card__info">
                  <strong>Pago presencial</strong>
                  <span>Paga en recepción el día del evento</span>
                </div>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
            </div>

            {error && <p className="arm-error" style={{ marginTop: 4 }}>{error}</p>}
            {saving && <p style={{ textAlign:'center', color:'#888', fontSize:13, marginTop:8 }}>Registrando…</p>}

            <button type="button" className="arm-back-link" onClick={() => setStep(1)}>
              ← Regresar
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
