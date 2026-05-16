import puppeteer from 'puppeteer-core'
import chromium from '@sparticuz/chromium'
import { existsSync } from 'fs'

const LOCAL_CHROME_PATHS = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
]

async function getBrowserConfig() {
  const isLambda = !!process.env.AWS_LAMBDA_FUNCTION_NAME
  const isNetlifyDev = !!process.env.NETLIFY_DEV
  const isNetlify = !!process.env.NETLIFY

  console.log('[export-pdf] Environment:', { isLambda, isNetlifyDev, isNetlify })

  // 1. If we are on a real Lambda environment (Netlify Production)
  if (isLambda && !isNetlifyDev) {
    console.log('[export-pdf] Using sparticuz chromium (Production)')
    return {
      executablePath: await chromium.executablePath(),
      args: [...chromium.args, '--no-sandbox'],
    }
  }

  // 2. Try environment variable
  const fromEnv = process.env.CHROME_PATH
  if (fromEnv) {
    console.log('[export-pdf] Checking CHROME_PATH:', fromEnv)
    if (existsSync(fromEnv)) {
      return { executablePath: fromEnv, args: ['--no-sandbox', '--disable-setuid-sandbox'] }
    }
    console.log('[export-pdf] CHROME_PATH does not exist')
  }

  // 3. Try common local paths
  for (const p of LOCAL_CHROME_PATHS) {
    if (existsSync(p)) {
      console.log('[export-pdf] Found local Chrome at:', p)
      return { executablePath: p, args: ['--no-sandbox', '--disable-setuid-sandbox'] }
    }
  }

  // 4. Fallback to sparticuz if nothing else found and we are on Netlify (even if dev)
  if (isNetlify) {
    console.log('[export-pdf] Falling back to sparticuz chromium')
    try {
      const path = await chromium.executablePath()
      if (path) {
        return {
          executablePath: path,
          args: [...chromium.args, '--no-sandbox'],
        }
      }
    } catch (e) {
      console.error('[export-pdf] Failed to get chromium executable path from sparticuz:', e)
    }
  }

  throw new Error('Chrome not found. Install Google Chrome or set CHROME_PATH.')
}

export default async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    })
  }

  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  let browser = null
  try {
    const { html, filename = 'reporte.pdf', pageWidth, pageHeight } = await req.json()
    const { executablePath, args } = await getBrowserConfig()

    browser = await puppeteer.launch({
      executablePath,
      args,
      headless: true,
    })

    const page = await browser.newPage()

    await page.setRequestInterception(false)

    const vpW = pageWidth || 1200
    await page.setViewport({ width: vpW, height: 2000, deviceScaleFactor: 2 })
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30000 })

    let pdfOptions
    if (pageWidth) {
      const ph = pageHeight || await page.evaluate(() => document.body.scrollHeight)
      pdfOptions = {
        width: `${pageWidth}px`,
        height: `${ph}px`,
        printBackground: true,
        margin: { top: 0, right: 0, bottom: 0, left: 0 },
        pageRanges: '1',
      }
    } else {
      pdfOptions = { format: 'A4', printBackground: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } }
    }

    const pdf = await page.pdf(pdfOptions)

    return new Response(new Blob([pdf], { type: 'application/pdf' }), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Access-Control-Allow-Origin': '*',
      },
    })
  } catch (err) {
    console.error('[export-pdf] Error:', err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    })
  } finally {
    if (browser) await browser.close()
  }
}
