import { promises as fs } from 'fs'
import path from 'path'

export const dynamic = 'force-dynamic'

const REPORTS_DIR = path.join(process.cwd(), '.lighthouseci', 'reports')

const TARGET_PAGES = {
  home: 'localhost--',
  shop: 'localhost-shop-',
  product: 'localhost-product_1-',
  cart: 'localhost-cart-'
}

function getLatestReportPath(fileNames, prefix) {
  const matches = fileNames
    .filter((name) => name.startsWith(prefix) && name.endsWith('.report.json'))
    .sort()
  return matches.length ? path.join(REPORTS_DIR, matches[matches.length - 1]) : null
}

function normalizeCategories(categories = {}) {
  const perf = Number(categories.performance?.score ?? 0)
  const accessibility = Number(categories.accessibility?.score ?? 0)
  const bestPractices = Number(categories['best-practices']?.score ?? 0)
  const seo = Number(categories.seo?.score ?? 0)

  return {
    performance: Math.round(perf * 100),
    accessibility: Math.round(accessibility * 100),
    bestPractices: Math.round(bestPractices * 100),
    seo: Math.round(seo * 100)
  }
}

export async function GET() {
  try {
    const fileNames = await fs.readdir(REPORTS_DIR)
    const pageEntries = {}

    for (const [key, prefix] of Object.entries(TARGET_PAGES)) {
      const latestPath = getLatestReportPath(fileNames, prefix)
      if (!latestPath) continue

      const content = await fs.readFile(latestPath, 'utf8')
      const report = JSON.parse(content)
      pageEntries[key] = {
        categories: normalizeCategories(report.categories),
        fetchTime: report.fetchTime
      }
    }

    const values = Object.values(pageEntries)
    const overall = values.length
      ? {
          performance: Math.round(values.reduce((acc, cur) => acc + cur.categories.performance, 0) / values.length),
          accessibility: Math.round(values.reduce((acc, cur) => acc + cur.categories.accessibility, 0) / values.length),
          bestPractices: Math.round(values.reduce((acc, cur) => acc + cur.categories.bestPractices, 0) / values.length),
          seo: Math.round(values.reduce((acc, cur) => acc + cur.categories.seo, 0) / values.length)
        }
      : null

    const latestFetchTime = values
      .map((item) => item.fetchTime)
      .filter(Boolean)
      .sort()
      .at(-1) || null

    return Response.json({
      ok: true,
      overall,
      pages: pageEntries,
      latestFetchTime
    })
  } catch {
    return Response.json(
      {
        ok: false,
        overall: null,
        pages: {},
        latestFetchTime: null
      },
      { status: 200 }
    )
  }
}
