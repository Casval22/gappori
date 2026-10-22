const name = process.env.REPOSITORY_NAME
if (!name) throw new Error('REPOSITORY_NAME is required')
const base =
  process.env.BASE_OVERRIDE || (name.toLowerCase().endsWith('.github.io') ? '/' : `/${name}/`)
if (!/^\/(?:[a-zA-Z0-9._~-]+\/)*$/.test(base) || base.includes('..'))
  throw new Error('Invalid VITE_BASE_PATH; use / or /repository/')
process.stdout.write(`VITE_BASE_PATH=${base}\n`)
