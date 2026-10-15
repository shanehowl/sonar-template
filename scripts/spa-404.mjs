// GitHub Pages serves 404.html for unknown paths. Copying index.html there lets
// a direct load or refresh of a client-side route (e.g. /about) boot the SPA.
import { copyFileSync, existsSync } from 'node:fs'

const indexPath = 'dist/index.html'

if (!existsSync(indexPath)) {
  console.error(`spa-404: ${indexPath} not found; run vite build first.`)
  process.exit(1)
}

copyFileSync(indexPath, 'dist/404.html')
console.log('spa-404: created dist/404.html')
