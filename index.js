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
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb')
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
    // Send a ping to confirm a successful connection
    await client.db('admin').command({ ping: 1 })
    console.log('Pinged your deployment.')
    const database = client.db('summerSurfers')
    const coursesCollection = database.collection('courseColl')
    const usersCollection = database.collection('usersColl')
    const paymentsCollection = database.collection('paymentsColl')
    const myCourseCollection = database.collection('myCourseColl')
    const reviewsCollection = database.collection('reviewsColl')
    // courses operation
    app.get('/courses', async (req, res) => {
      const result = await coursesCollection.find().toArray()
      res.send(result)
    })
    // cart operation
    app.post('/carts', verifyJWT, async (req, res) => {
      const data = req.body
      const query = { course: data?.course, email: data?.email }
      const checkSelected = await myCourseCollection.findOne(query)
      if (!checkSelected) {
        const result = await myCourseCollection.insertOne(data)
        if (result?.insertedId) {
          const course = { _id: new ObjectId(data?.course) }
          console.log(course)
          const enrolledCourse = await coursesCollection.findOne(course)
          const upgradeDoc = {
            $set: {
              enrolled: enrolledCourse?.enrolled + 1,
            },
          }
          const upgradeResult = await coursesCollection.updateOne(
            course,
            upgradeDoc
          )
          if (upgradeResult?.modifiedCount > 0) {
            res.send({
              error: false,
              message: 'Course added to cart. Pay to enroll now.',
              result,
              upgradeResult,
            })
          }
        }
      } else {
        res.send({ error: true, message: 'Course already added.' })
      }
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
