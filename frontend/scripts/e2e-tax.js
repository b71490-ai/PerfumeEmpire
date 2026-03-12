const axios = require('axios')
;(async () => {
  try {
    const BACKEND = process.env.BACKEND_URL || 'http://localhost:5000'
    console.log('Logging in as e2e_admin...')
    const login = await axios.post(`${BACKEND}/api/auth/login`, { username: 'e2e_admin', password: 'admin123' }, { withCredentials: true })
    if (login.status !== 200) throw new Error('login failed')
    const token = login.data?.token
    console.log('Got token length:', token ? token.length : 'none')

    const auth = { headers: { Authorization: `Bearer ${token}` } }
    console.log('Fetching tax (no filter)…')
    const res1 = await axios.get(`${BACKEND}/api/admin/stats/tax`, auth)
    console.log('Tax total (all):', res1.data)

    const start = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()
    const end = new Date().toISOString()
    console.log('Fetching tax (date range)…', start, end)
    const res2 = await axios.get(`${BACKEND}/api/admin/stats/tax?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`, auth)
    console.log('Tax total (range):', res2.data)

    console.log('Fetching tax (status=Completed)')
    const res3 = await axios.get(`${BACKEND}/api/admin/stats/tax?status=Completed`, auth)
    console.log('Tax total (completed):', res3.data)

    process.exit(0)
  } catch (err) {
    console.error(err.response ? err.response.data : err.message)
    process.exit(2)
  }
})()
