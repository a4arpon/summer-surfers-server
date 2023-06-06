const express = require('express')
const app = express()
const cors = require('cors')
require('dotenv').config()
const port = process.env.PORT || 5000
const jwt = require('jsonwebtoken')
app.use(cors())

app.get('/', (req, res) => {
  res.send('Server Running')
})

app.listen(port, () => {
  console.log(`Bistro boss is running on port ${port}`)
})
