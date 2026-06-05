# HOTEL

> Memoria viva del proyecto.

## 1. Identidad

**Que es:** Sitio web de marketing del Hotel Punta Galeria + app nativa Android para staff.

**Stack:** React + Vite + Capacitor + Netlify Functions + Turso DB

**Owner:** JUANPA

**URL:** hotelpuntagaleria.mx · **Puerto dev:** 8888 (netlify dev) / 5173 (vite)

---

## 2. Estado actual

- **Fecha de corte:** 22/05/26
- **Fase:** 8 — Produccion
- **Semaforo:** Amarillo
- **En produccion:** si

---

## 3. Decisiones clave

| Fecha | Decision | Por que | Alternativas descartadas | Regla |
|---|---|---|---|---|
| — | Dual codebase web + Android | Un solo repo sirve web y app staff | Repos separados | window.Capacitor detecta entorno |

---

## 4. Metrica semanal

| Metrica | Valor |
|---|---|
| Flujos implementados | ? |
| Flujos testeados | ? |
| Bloqueo activo | sin datos iniciales |

---

## 5. Lo que NO se debe hacer

- No correr build:apk sin JAVA_HOME configurado en JDK 21

## 6. Deuda tecnica

- Sin tests configurados
- Sin linter configurado
