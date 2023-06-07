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
    jwt.verify(token, process.env.jwt_secret_key, (err, decoded) => {
      if (err) {
        return res
          .status(401)
          .send({ error: true, message: 'Unauthorized user.' })
      }
      req.decoded = decoded
      next()
    })
  } else {
    return res.status(401).send({ error: true, message: 'Unauthorized user.' })
  }
}
// Mongodb With Server
const { MongoClient, ServerApiVersion } = require('mongodb')
// const uri = `mongodb+srv://${process.env.mongo_user}:${process.env.mongo_password}@clustertest.wemsww6.mongodb.net/?retryWrites=true&w=majority`
const uri = 'mongodb://127.0.0.1:27017/'
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
    // courses operation
    app.get('/courses', async (req, res) => {
      const result = await coursesCollection.find().toArray()
      res.send(result)
    })
    // users operation
    app.post('/users', async (req, res) => {
      const user = req.body
      const query = { email: user.email }
      const existUser = await usersCollection.findOne(query)
      if (!existUser) {
        const result = await usersCollection.insertOne(user)
        res.send(result)
      } else {
        res.send({ message: 'Users Exist Already' })
      }
    })
    // jwt token generation
    app.post('/jwt', async (req, res) => {
      const user = req.body
      const token = jwt.sign(user, process.env.jwt_secret_key, {
        expiresIn: '1hr',
      })
      res.send(token)
    })
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
