const express = require('express')
const app = express()
const cors = require('cors')
require('dotenv').config()
const port = process.env.PORT || 5000
const jwt = require('jsonwebtoken')
const stripe = require('stripe')(process.env.stripe_key)
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
    // Middleware
    const verifyInstructor = async (req, res, next) => {
      const email = req.decoded.email
      const query = { email: email }
      const user = await usersCollection.findOne(query)
      if (user?.role === 'instructor') {
        next()
      } else {
        return res
          .status(403)
          .send({ error: true, message: 'Forbidden access' })
      }
    }
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email
      const query = { email: email }
      const user = await usersCollection.findOne(query)
      if (user?.role === 'admin') {
        next()
      } else {
        return res
          .status(403)
          .send({ error: true, message: 'Forbidden access' })
      }
    }

    // courses operation
    app.get('/courses', async (req, res) => {
      const result = await coursesCollection
        .find({ status: 'approved' })
        .toArray()
      res.send(result)
    })
    // Filter courses by instructor category
    app.get('/courses/instructor/:email', async (req, res) => {
      const instructorEmail = req.params.email
      const query = { 'instructor.email': instructorEmail, status: 'approved' }
      const result = await coursesCollection.find(query).toArray()
      res.send(result)
    })
    // filter courses by popular
    app.get('/courses/popular', async (req, res) => {
      const courses = await coursesCollection
        .find({ status: 'approved' })
        .toArray()
      const tempCourse = courses.filter(
        (course) => course.totalSeats > course.enrolled
      )
      const popularCourses = tempCourse.filter((course) => {
        const enrollmentPercentage = (course.enrolled / course.totalSeats) * 100
        return enrollmentPercentage > 70
      })
      popularCourses.sort((a, b) => {
        const aEnrollmentPercentage = (a.enrolled / a.totalSeats) * 100
        const bEnrollmentPercentage = (b.enrolled / b.totalSeats) * 100
        return bEnrollmentPercentage - aEnrollmentPercentage
      })
      const topPopularCourses = popularCourses.slice(0, 6)
      res.send(topPopularCourses)
    })
    app.get('/courses/my-courses/:email', verifyJWT, async (req, res) => {
      const email = req.params.email
      const query = { email: email, status: 'paid' }
      const courseIDs = await myCourseCollection.find(query).toArray()
      const promises = courseIDs.map(async (item) => {
        const courseId = new ObjectId(item.course)
        const course = await coursesCollection.findOne({
          _id: courseId,
          status: 'approved',
        })
        return course
      })
      const courses = await Promise.all(promises)
      res.send(courses)
    })
    app.get('/courses/my-lists/:email', verifyJWT, async (req, res) => {
      const email = req.params.email
      const query = { email: email, status: 'unpaid' }
      const courseIDs = await myCourseCollection.find(query).toArray()
      const promises = courseIDs.map(async (item) => {
        const courseId = new ObjectId(item.course)
        const course = await coursesCollection.findOne({
          _id: courseId,
          status: 'approved',
        })
        return course
      })
      const courses = await Promise.all(promises)
      res.send(courses)
    })
    /*-------------------------------

     USERS OPERATION
 
     -------------------------------*/
    app.post('/users', async (req, res) => {
      const user = req.body
      const query = { email: user.email }
      const existUser = await usersCollection.findOne(query)
      if (!existUser) {
        const result = await usersCollection.insertOne(user)
        res.send(result)
      } else {
        res.send({ message: 'Users exist already' })
      }
    })
    /*-------------------------------
    PAYMENT OPERATIONS
    -------------------------------*/
    app.get('/payments/:email', verifyJWT, async (req, res) => {
      const email = req.params.email
      const result = await paymentsCollection
        .find({ email })
        .sort({ billingTime: -1 })
        .toArray()
      res.send(result)
    })
    app.post('/payment', verifyJWT, async (req, res) => {
      const paymentData = req.body
      if (paymentData.status === 'paid') {
        const date = new Date()
        paymentData.billingTime = date
        const addPaymentData = await paymentsCollection.insertOne(paymentData)
        if (addPaymentData) {
          const updateMyCourses = await Promise.all(
            paymentData?.items?.map(async (item) => {
              const query = { email: paymentData.email, course: item }
              const updatedDoc = {
                $set: {
                  status: 'paid',
                },
              }
              const upgradeMyCourse = await myCourseCollection.findOneAndUpdate(
                query,
                updatedDoc
              )
              const course = { _id: new ObjectId(item), status: 'approved' }
              const enrolledCourse = await coursesCollection.findOne(course)
              const upgradeDoc = {
                $set: {
                  enrolled: enrolledCourse?.enrolled + 1,
                },
              }
              const upgradeStudentNum = await coursesCollection.updateOne(
                course,
                upgradeDoc
              )
              return { upgradeMyCourse, upgradeStudentNum }
            })
          )
          if (updateMyCourses) {
            res.send({
              message: 'Payment successful.',
              response: updateMyCourses,
            })
          }
        }
      }
    })
    app.post('/create-payment-intent', verifyJWT, async (req, res) => {
      const price = req.body.price
      const amount = parseFloat(price) * 100
      if (amount > 0 && !isNaN(amount)) {
        const paymentIntent = await stripe.paymentIntents.create({
          amount: amount.toFixed(0),
          currency: 'usd',
          payment_method_types: ['card'],
        })
        res.send({ clientSecret: paymentIntent.client_secret })
      } else {
        res.send({ error: true })
      }
    })

    /*-------------------------------
    
    CART OPERATION
    
    -------------------------------*/
    app.post('/carts', verifyJWT, async (req, res) => {
      const data = req.body
      const query = { course: data?.course, email: data?.email }
      const checkSelected = await myCourseCollection.findOne(query)
      if (!checkSelected) {
        const result = await myCourseCollection.insertOne(data)
        if (result?.insertedId) {
          res.send({
            error: false,
            message: 'Course added to cart. Pay to enroll now.',
            result,
          })
        }
      } else {
        res.send({ error: true, message: 'Course already added.' })
      }
    })
    app.delete('/carts/:id', verifyJWT, async (req, res) => {
      const courseID = req.params.id
      const query = { course: courseID }
      const checkSelected = await myCourseCollection.findOne(query)
      if (checkSelected) {
        const result = await myCourseCollection.deleteOne(checkSelected)
        res.send({ error: false, message: 'Course deleted', response: result })
      } else {
        res.send({ error: true, message: 'Course not found' })
      }
    })
    /*-------------------------------
    
    INSTRUCTOR OPERATIONS
    
    -------------------------------*/
    app.get('/instructor/verify/:email', verifyJWT, async (req, res) => {
      const email = req.params.email
      if (req.decoded.email === email) {
        const query = { email: email }
        const user = await usersCollection.findOne(query)
        const result = { instructor: user?.role === 'instructor' }
        res.send(result)
      } else {
        res.send({ instructor: false })
      }
    })
    app.get('/instructors', async (req, res) => {
      const result = await usersCollection
        .find({ role: 'instructor' })
        .toArray()
      res.send(result)
    })
    app.get(
      '/instructor/courses/:email',
      verifyJWT,
      verifyInstructor,
      async (req, res) => {
        const email = req.params.email
        const query = { 'instructor.email': email, status: 'approved' }
        const result = await coursesCollection.find(query).toArray()
        res.send(result)
      }
    )
    app.get(
      '/instructor/courses/declined/:email',
      verifyJWT,
      verifyInstructor,
      async (req, res) => {
        const email = req.params.email
        const query = { 'instructor.email': email, status: 'declined' }
        const result = await coursesCollection.find(query).toArray()
        res.send(result)
      }
    )
    app.get(
      '/instructor/courses/pending/:email',
      verifyJWT,
      verifyInstructor,
      async (req, res) => {
        const email = req.params.email
        const query = { 'instructor.email': email, status: 'pending' }
        const result = await coursesCollection.find(query).toArray()
        res.send(result)
      }
    )
    app.post(
      '/instructor/courses/add',
      verifyJWT,
      verifyInstructor,
      async (req, res) => {
        const data = req.body
        const result = await coursesCollection.insertOne(data)
        res.send(result)
      }
    )
    app.put(
      '/instructor/courses/update',
      verifyJWT,
      verifyInstructor,
      async (req, res) => {
        const data = req.body
        const query = { _id: new ObjectId(data?.id) }
        const updatedDoc = {
          $set: {
            title: data?.title,
            price: data?.price,
            totalSeats: data?.totalSeats,
          },
        }
        const result = await coursesCollection.updateOne(query, updatedDoc)
        res.send(result)
      }
    )
    app.get(
      '/instructor/courses/:id',
      verifyJWT,
      verifyInstructor,
      async (req, res) => {
        const query = { _id: new ObjectId(req.params.id) }
        const result = await coursesCollection.findOne(query)
        res.send(result)
      }
    )
    app.get('/instructors/popular', async (req, res) => {
      const instructors = await usersCollection
        .find({ role: 'instructor' })
        .toArray()
      const courses = await coursesCollection
        .find({ status: 'approved' })
        .toArray()
      const instructorsWithPopularity = instructors.map((instructor) => {
        const instructorCourses = courses.filter(
          (course) => course.instructor.email === instructor.email
        )
        const totalCourses = instructorCourses.length
        let popularCourses = 0
        let totalStudents = 0
        let totalSeats = 0
        instructorCourses.forEach((course) => {
          const enrollmentPercentage =
            (course.enrolled / course.totalSeats) * 100
          if (enrollmentPercentage > 70) {
            popularCourses++
          }
          totalStudents += course.enrolled
          totalSeats += course.totalSeats
        })
        const popularityPercentage = (popularCourses / totalCourses) * 100 || 0
        return {
          ...instructor,
          popularityPercentage,
          totalStudents,
          totalSeats,
        }
      })
      const popularInstructors = instructorsWithPopularity.filter(
        (instructor) => instructor.popularityPercentage > 0
      )
      popularInstructors.sort(
        (a, b) => b.popularityPercentage - a.popularityPercentage
      )
      const topPopularInstructors = popularInstructors.slice(0, 6)
      res.send(topPopularInstructors)
    })
    /*-------------------------------

     Admin Related Routes and Operations 

    -------------------------------*/
    app.get('/admin/verify/:email', verifyJWT, async (req, res) => {
      const email = req.params.email
      if (req.decoded.email === email) {
        const query = { email: email }
        const user = await usersCollection.findOne(query)
        const result = { admin: user?.role === 'admin' }
        res.send(result)
      } else {
        res.send({ admin: false })
      }
    })
    app.get('/admin/courses', verifyJWT, verifyAdmin, async (req, res) => {
      const result = await coursesCollection.find().toArray()
      res.send(result)
    })
    app.post(
      '/admin/courses/feedback',
      verifyJWT,
      verifyAdmin,
      async (req, res) => {
        const data = req.body
        const query = { _id: new ObjectId(data?.id) }
        const options = { upsert: true }
        const upgradeDoc = {
          $set: {
            feedback: data?.feedback,
          },
        }
        const result = await coursesCollection.updateOne(
          query,
          upgradeDoc,
          options
        )
        res.send(result)
      }
    )
    app.patch(
      '/admin/courses/approve/:id',
      verifyJWT,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id
        const filter = { _id: new ObjectId(id) }
        const option = { upsert: true }
        const updatedDoc = {
          $set: {
            status: 'approved',
          },
        }
        const result = await coursesCollection.updateOne(
          filter,
          updatedDoc,
          option
        )
        res.send(result)
      }
    )
    app.patch(
      '/admin/courses/declined/:id',
      verifyJWT,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id
        const filter = { _id: new ObjectId(id) }
        const option = { upsert: true }
        const updatedDoc = {
          $set: {
            status: 'declined',
          },
        }
        const result = await coursesCollection.updateOne(
          filter,
          updatedDoc,
          option
        )
        res.send(result)
      }
    )
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
