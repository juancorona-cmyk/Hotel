# Guion voz en off — Hotel Punta Galeria

> Antes vs Ahora. Locucion lista para grabar.
> Tono: cercano, seguro, ritmo de demo. Pausas marcadas con [...].
> Datos verificados contra el codigo del proyecto.

---

## VERSION 1 — Corta (45-60 seg)

**[Pantalla: pagina vieja, imagen fija]**

Asi se veia antes.
[...]
Una pagina estatica. Solo imagenes fijas.
Sin movimiento. Sin diseño. Sin vida.
Ningun asistente. Ningun control. Nada que medir.

**[Transicion. Pantalla: pagina nueva, video de fondo corriendo]**

Y asi se ve hoy.
[...]
Video en vivo desde la entrada.
Cada seccion se anima al bajar.
Numeros que cuentan solos: cuarenta años, cuarenta y cuatro habitaciones, mas de quinientos eventos.

**[Pantalla: HotelBot abierto]**

Ahora hay un asistente. Se llama HotelBot.
Responde al huesped a cualquier hora.
Reserva, actividades, dudas. Todo al instante.

**[Pantalla: AdminDashboard]**

Y por dentro, un panel de control.
Vemos quien reserva. Cuantas noches. Que habitacion.
Quien se inscribe a cada actividad. En tiempo real.

**[Pantalla: app movil StaffApp]**

Hasta el celular trabaja para ti.
Creas un evento. Lo publicas al momento.
Ves quien se registra. Escaneas su QR en la puerta.
Todo desde la mano.

**[Cierre]**

Antes: una foto.
Ahora: un hotel que se mueve, atiende y mide solo.
Hotel Punta Galeria.

---

## VERSION 2 — Extendida (90-120 seg)

### Bloque 1 — El antes

**[Pantalla: sitio anterior, scroll lento sobre imagenes fijas]**

Empecemos por donde estabamos.
[...]
La pagina anterior era una postal.
Imagenes fijas. Sin un solo video.
Nada se movia. Nada respondia.
Si un huesped tenia una duda a medianoche, no habia nadie.
Si alguien reservaba, no quedaba registro que pudieras ver.
Y los eventos del hotel se manejaban a mano, en papel o en llamadas.
[...]
Bonita, pero muda.

### Bloque 2 — El ahora: la pagina

**[Pantalla: nueva home, video de fondo en el hero]**

Esto es lo que tenemos hoy.
[...]
Desde que abre, un video te recibe.
Hay una seccion completa de videos: el entorno, los jardines, las habitaciones.
Cada bloque se anima al desplazarte.
Los numeros cuentan la historia solos:
cuarenta años de trayectoria, cuarenta y cuatro habitaciones, mas de quinientos eventos, cuatro punto tres estrellas.
[...]
Y todo en dos idiomas: español e ingles, con un clic.

### Bloque 3 — El asistente

**[Pantalla: HotelBot respondiendo]**

Lo nuevo no es solo como se ve. Es lo que hace.
[...]
Ahora el hotel tiene un asistente propio: HotelBot.
Atiende al huesped las veinticuatro horas.
Le explica habitaciones, actividades, servicios.
Y lo enlaza directo a WhatsApp cuando quiere hablar con una persona.
La pagina dejo de ser un folleto. Ahora conversa.

### Bloque 4 — El control

**[Pantalla: AdminDashboard, tabs visibles]**

Y por detras, algo que antes no existia: control total.
[...]
Un panel donde vemos todo.
Quien reserva. Cuantas noches. Que habitacion. De donde llega.
Quien se inscribe a cada actividad: zumba, yoga, lo que sea.
Visitas, mensajes del bot, clics a WhatsApp, conversiones.
Antes reservabas a ciegas. Ahora decides con datos.

### Bloque 5 — La app movil

**[Pantalla: StaffApp en el telefono]**

Y lo llevamos a la mano.
[...]
Hay una aplicacion movil para el equipo.
Creas un evento desde el celular: nombre, fecha, cupo, precio.
Lo publicas y al instante genera una pagina propia para compartir por WhatsApp.
Ves en vivo quien se va registrando.
Y en la puerta, escaneas el QR del huesped para el check-in.
Registras el pago y marcas la entrada al mismo tiempo.
[...]
Todo desde un telefono.

### Cierre

**[Split screen: antes / ahora]**

Esto era el antes: una imagen quieta.
Esto es el ahora: un hotel que se ve, conversa, mide y se controla desde la mano.
[...]
Hotel Punta Galeria.
Lo mismo de siempre, hecho como hoy se debe.

---

## Tabla rapida — Antes vs Ahora (para apoyo visual)

| | Antes | Ahora |
|---|---|---|
| Diseño | Estatico, imagenes fijas | Animaciones al scroll, contadores, marquee |
| Video | Ninguno | Hero en video + seccion de 3 videos |
| Asistente | No habia | HotelBot 24/7 con enlace a WhatsApp |
| Reservas | Sin registro visible | Formulario + registro en base de datos |
| Control | A ciegas | AdminDashboard con metricas en vivo |
| Eventos | A mano | App movil: crear, publicar, registrar, QR |
| Check-in | Manual | Escaneo de QR + pago desde la app |
| Idiomas | Uno | Español / Ingles |

---

## Notas de produccion

- Pausas [...] = respiro de 1 seg para cortes de imagen.
- Datos confirmados en codigo: HotelBot (gpt-4o-mini), AdminDashboard (Ctrl+K), StaffApp (APK Capacitor), escaneo QR (mlkit).
- NO mencionar pago en linea: el flujo de pago es transferencia + confirmacion manual. No prometer Stripe/PayPal.
- NO prometer notificaciones push: no estan implementadas.
- Cifras del hero (40 años, 44 hab, 500+ eventos, 4.3 estrellas) salen de Stats.jsx. Verificar que sigan vigentes antes de grabar.
