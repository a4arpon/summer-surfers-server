const express = require('express')
const app = express()
const cors = require('cors')
require('dotenv').config()
const port = process.env.PORT || 5000
const jwt = require('jsonwebtoken')
// Middleware
app.use(cors())
app.use(express.json())
const verifyJWT = (req, res, next) => {
  const auth = req.headers.authorization
  if (auth) {
    const token = auth.split(' ')[1]
  }
}
// Mongodb With Server
const { MongoClient, ServerApiVersion } = require('mongodb')
const uri = `mongodb+srv://${process.env.mongo_user}:${process.env.mongo_password}@clustertest.wemsww6.mongodb.net/?retryWrites=true&w=majority`

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
})

async function run() {
  try {
    await client.connect()
    // Send a ping to confirm a successful connection
    await client.db('admin').command({ ping: 1 })
    console.log('Pinged your deployment.')
    const database = client.db('summerSurfers')
    const coursesCollection = database.collection('courseColl')
    const usersCollection = database.collection('usersColl')
    const paymentsCollection = database.collection('paymentColl')
    const reviewsCollection = database.collection('reviewsColl')
  } finally {
    // client.close()
  }
}
run().catch(console.dir)

app.get('/', (req, res) => {
  res.send('Server Running')
})

app.listen(port, () => {
  console.log(`Server is running on port ${port}`)
})
