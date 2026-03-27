import '../styles/globals.css'
import Script from 'next/script'
import { cookies } from 'next/headers'
import ThemeProvider from '../components/ThemeProvider'
import { Cairo } from 'next/font/google'
import { CartProvider } from '../context/CartContext'
import { AdminProvider } from '../context/AdminContext'
import AdsBar from '../components/AdsBar'
import Header from '../components/Header'
import StoreNotice from '../components/StoreNotice'
import WebVitalsReporter from '../components/WebVitalsReporter'
import { getServerApiUrl } from '@/lib/serverApi'

const cairo = Cairo({
  subsets: ['arabic', 'latin'],
  weight: ['400', '600', '700', '800'],
  display: 'swap'
})

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
const STORE_SETTINGS_FETCH_OPTIONS = { next: { revalidate: 300 } }
const structuredData = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': `${siteUrl}#organization`,
      name: 'عطور الإمبراطورية',
      url: siteUrl,
      sameAs: []
    },
    {
      '@type': 'WebSite',
      '@id': `${siteUrl}#website`,
      url: siteUrl,
      name: 'عطور الإمبراطورية',
      inLanguage: 'ar-SA',
      publisher: {
        '@id': `${siteUrl}#organization`
      },
      potentialAction: {
        '@type': 'SearchAction',
        target: `${siteUrl}/shop?search={search_term_string}`,
        'query-input': 'required name=search_term_string'
      }
    }
  ]
}

const sanitizeId = (value) => String(value || '').trim().replace(/[^A-Za-z0-9_-]/g, '')

const normalizeGaId = (value) => {
  const cleaned = sanitizeId(value).toUpperCase()
  return /^G-[A-Z0-9]+$/.test(cleaned) ? cleaned : ''
}

const normalizeGtmId = (value) => {
  const cleaned = sanitizeId(value).toUpperCase()
  return /^GTM-[A-Z0-9]+$/.test(cleaned) ? cleaned : ''
}

const normalizePixelId = (value) => {
  const cleaned = sanitizeId(value)
  return /^\d{5,20}$/.test(cleaned) ? cleaned : ''
}

async function getTrackingSettings() {
  try {
    const res = await fetch(getServerApiUrl('/store-settings'), STORE_SETTINGS_FETCH_OPTIONS)
    if (!res.ok) {
      return { gaId: '', gtmId: '', pixelId: '' }
    }

    const settings = await res.json()
    return {
      gaId: normalizeGaId(settings?.googleAnalyticsId),
      gtmId: normalizeGtmId(settings?.tagManagerId),
      pixelId: normalizePixelId(settings?.metaPixelId)
    }
  } catch {
    return { gaId: '', gtmId: '', pixelId: '' }
  }
}

export async function generateMetadata() {
  const fallbackTitle = '✨ عطور الإمبراطورية'
  const fallbackDescription = 'متجر العطور الفاخرة - اكتشف أروع العطور العالمية'
  const fallbackSiteName = 'عطور الإمبراطورية'
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
  const metadataBase = new URL(siteUrl)

  try {
    const res = await fetch(getServerApiUrl('/store-settings'), STORE_SETTINGS_FETCH_OPTIONS)
    if (!res.ok) {
      return {
        metadataBase,
        alternates: { canonical: '/' },
        title: fallbackTitle,
        description: fallbackDescription,
        openGraph: {
          title: fallbackTitle,
          description: fallbackDescription,
          siteName: fallbackSiteName,
          locale: 'ar_SA',
          type: 'website'
        },
        twitter: {
          card: 'summary_large_image',
          title: fallbackTitle,
          description: fallbackDescription
        }
      }
    }

    const settings = await res.json()
    const storeName = settings?.storeName || settings?.logoText || fallbackTitle
    const seoDescription = settings?.seoDescription || ''
    const keywords = String(settings?.seoKeywords || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)

    const dynamicTitle = `${settings?.logoIcon || '✨'} ${storeName}`
    const dynamicDescription = seoDescription || `متجر ${storeName} - اكتشف أروع العطور العالمية`

    return {
      metadataBase,
      alternates: { canonical: '/' },
      title: dynamicTitle,
      description: dynamicDescription,
      keywords,
      openGraph: {
        title: dynamicTitle,
        description: dynamicDescription,
        siteName: storeName,
        locale: 'ar_SA',
        type: 'website'
      },
      twitter: {
        card: 'summary_large_image',
        title: dynamicTitle,
        description: dynamicDescription
      }
    }
  } catch {
    return {
      metadataBase,
      alternates: { canonical: '/' },
      title: fallbackTitle,
      description: fallbackDescription,
      openGraph: {
        title: fallbackTitle,
        description: fallbackDescription,
        siteName: fallbackSiteName,
        locale: 'ar_SA',
        type: 'website'
      },
      twitter: {
        card: 'summary_large_image',
        title: fallbackTitle,
        description: fallbackDescription
      }
    }
  }
}

export default async function RootLayout({ children }) {
  const { gaId, gtmId, pixelId } = await getTrackingSettings()

  // read theme cookie (if present) so we can render matching attributes server-side
  const cookieTheme = (function () {
    try {
      const c = cookies().get('theme')
      return c?.value
    } catch (e) {
      return undefined
    }
  })()

  const serverTheme = cookieTheme === 'dark' || cookieTheme === 'light' ? cookieTheme : null
  const htmlClass = serverTheme ? `${cairo.className} ${serverTheme === 'dark' ? 'theme-dark' : 'theme-light'}` : cairo.className

  return (
      <html lang="ar" dir="rtl" className={htmlClass} data-theme={serverTheme ?? undefined} suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://images.unsplash.com" crossOrigin="anonymous" />
        {gtmId && (
          <Script
            id="gtm-init"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{
              __html: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${gtmId}');`
            }}
          />
        )}
        {gaId && (
          <>
            <Script src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`} strategy="afterInteractive" />
            <Script
              id="ga4-init"
              strategy="afterInteractive"
              dangerouslySetInnerHTML={{
                __html: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js', new Date());gtag('config', '${gaId}');`
              }}
            />
          </>
        )}
        {pixelId && (
          <Script
            id="meta-pixel-init"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{
              __html: `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');fbq('init', '${pixelId}');fbq('track', 'PageView');`
            }}
          />
        )}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
        <script
          id="theme-init"
          dangerouslySetInnerHTML={{
            __html: `(() => { try {
              try { document.documentElement.classList.add('${cairo.className}'); } catch(e){}
              const stored = (function(){ try { return localStorage.getItem('theme') } catch(e){ return null } })();
              const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
              const pick = stored === 'dark' || stored === 'light' ? stored : (prefersDark ? 'dark' : 'light');
              try {
                const ssrTheme = ${serverTheme ? `'${serverTheme}'` : 'null'};
                if (!ssrTheme) {
                  document.documentElement.classList.toggle('theme-dark', pick === 'dark');
                  document.documentElement.classList.toggle('theme-light', pick === 'light');
                  document.documentElement.setAttribute('data-theme', pick);
                  document.body.classList.toggle('theme-dark', pick === 'dark');
                  document.body.classList.toggle('theme-light', pick === 'light');
                  document.body.setAttribute('data-theme', pick);
                }
              } catch (e) {}
            } catch (e) {} })()`
          }}
        />
      </head>
      <body className={serverTheme ? (serverTheme === 'dark' ? 'theme-dark' : 'theme-light') : undefined} data-theme={serverTheme ?? undefined} suppressHydrationWarning>
        {gtmId && (
          <noscript>
            <iframe
              src={`https://www.googletagmanager.com/ns.html?id=${gtmId}`}
              height="0"
              width="0"
              style={{ display: 'none', visibility: 'hidden' }}
            />
          </noscript>
        )}
        {pixelId && (
          <noscript>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              height="1"
              width="1"
              style={{ display: 'none' }}
              src={`https://www.facebook.com/tr?id=${pixelId}&ev=PageView&noscript=1`}
              alt=""
            />
          </noscript>
        )}
        <AdminProvider>
          <CartProvider>
            <ThemeProvider>
              <WebVitalsReporter />
              <AdsBar />
              <div className="hero-trust-bar top-trust-strip" role="contentinfo" aria-label="مزايا المتجر">
                <div className="hero-trust-bar__inner">
                  <div className="trust-item">🚚 <span><span className="trust-word-white">شحن</span> سريع</span></div>
                  <div className="trust-item">💳 <span>دفع آمن</span></div>
                  <div className="trust-item">🔒 <span>منتجات أصلية 100%</span></div>
                  <div className="trust-item">🔄 <span>استرجاع خلال 7 أيام</span></div>

                  <div className="trust-item trust-item-copy" aria-hidden="true">🚚 <span><span className="trust-word-white">شحن</span> سريع</span></div>
                  <div className="trust-item trust-item-copy" aria-hidden="true">💳 <span>دفع آمن</span></div>
                  <div className="trust-item trust-item-copy" aria-hidden="true">🔒 <span>منتجات أصلية 100%</span></div>
                  <div className="trust-item trust-item-copy" aria-hidden="true">🔄 <span>استرجاع خلال 7 أيام</span></div>
                </div>
              </div>
              <Header />
              <StoreNotice />
              {children}
            </ThemeProvider>
          </CartProvider>
        </AdminProvider>
      </body>
    </html>
  )
}

