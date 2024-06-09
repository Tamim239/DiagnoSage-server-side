const express = require('express')
const app = express()
require('dotenv').config()
const cors = require('cors')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb')
const jwt = require('jsonwebtoken')
const port = process.env.PORT || 5000

// middleware
const corsOptions = {
  origin: ['http://localhost:5173', 'http://localhost:5174', 'https://diagnosage.netlify.app'],
  credentials: true,
  optionSuccessStatus: 200,
}
app.use(cors(corsOptions))
app.use(express.json())

// jwt verify middleware
const verifyToken = (req, res, next) => {
  console.log('inside verify token', req.headers.authorization)
  if (!req.headers.authorization) {
    return res.status(401).send({ message: 'unauthorized access' });
  }
  const token = req.headers.authorization.split(' ')[1];
  jwt.verify(token, process.env.ACCESS_TOKEN_API, (err, decoded) => {
    if (err) {
      return res.status(401).send({ message: 'unauthorized access' });
    }
    req.decoded = decoded;
    next()
  })
}
// verify admin after verifyToken
const verifyAdmin = async (req, res, next) => {
  const email = req.decoded.email;
  const query = { email };
  const user = await userCollection.findOne(query);
  const isAdmin = user?.role === 'admin'
  if (!isAdmin) {
    return res.status(403).send({ message: 'forbidden access' });
  }
  next()
}

const uri = `mongodb+srv://${process.env.USER_DB}:${process.env.USER_PASS}@cluster0.uj1q2ho.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
})

async function run() {
  try {
    const userCollection = client.db('DaignoDb').collection('users');
    const bannerCollection = client.db('DaignoDb').collection('banners');
    const testCollection = client.db('DaignoDb').collection('tests');
    const bookCollection = client.db('DaignoDb').collection('books');
    // auth related api
    app.post('/jwt', async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_API, { expiresIn: '1h' })
      res.send({ token })
    });
    // Logout
    app.get("/logout", async (req, res) => {
      const user = req.body;
      console.log("logging out", user);
      res
        .clearCookie("token", {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
          maxAge: 0
        })
        .send({ success: true });
    });

    // user collection
    app.get('/users/:email', async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      console.log(email, query)
      const result = await userCollection.findOne(query);
      res.send(result)
    })

    app.get('/users', verifyToken, verifyAdmin, async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result)
    });

    app.post('/users', async (req, res) => {
      const user = req.body;
      const result = await userCollection.insertOne(user);
      res.send(result)
    });

    app.put('/users/:id', async (req, res) => {
      const user = req.body;
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) }
      const options = { upsert: true }
      const updateDoc = {
        $set: {
          ...user
        }
      }
      const result = await userCollection.updateOne(filter, updateDoc, options)
      res.send(result)
    })

    // admin set
    app.get('/user/admin/:email', verifyToken, async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded.email) {
        return res.status(403).send({ message: 'unauthorized access' })
      }
      const query = { email: email }
      const user = await userCollection.findOne(query);
      let admin = false;
      if (user) {
        admin = user?.role === 'admin';
      }
      res.send({ admin })
    });

    // added banner info and set get delete
    app.get('/banners', async (req, res) => {
      const result = await bannerCollection.find().toArray();
      res.send(result)
    });

  
    app.post('/banners', async (req, res) => {
      const banner = req.body;
      const result = await bannerCollection.insertOne(banner);
      res.send(result)
    });

    app.put('/banners/:id', async(req, res) =>{
      const update = req.body;
      const id = req.params.id;
      const query = {_id: new ObjectId(id)};
      const updateDoc ={
        $set: {
          ...update
        }
      }
      const result = await bannerCollection.updateOne(query, updateDoc);
      res.send(result)
    });

    app.delete('/banners/:id', async (req, res) => {
      const id = req.params.id;
      console.log(id)
      const query = { _id: new ObjectId(id) };
      const result = await bannerCollection.deleteOne(query);
      res.send(result)
    });

    // add tests set get delete update
    app.get('/tests', async (req, res) => {
      const result = await testCollection.find().toArray();
      res.send(result);
    });

    app.get('/tests/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await testCollection.findOne(query);
      res.send(result)
    })

    app.post('/tests', async (req, res) => {
      const test = req.body;
      const result = await testCollection.insertOne(test);
      res.send(result);
    });
    app.put('/tests/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) }
      const doc = {
        $inc: {
          slots: -1
        }
      }
      const result = await testCollection.updateOne(filter, doc);
      res.send(result)
    });

    app.patch('/tests/:id', async (req, res) => {
      const test = req.body;
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) }
      const doc = {
        $set: {
          ...test
        },
      }
      const result = await testCollection.updateOne(filter, doc);
      res.send(result)
    });

    app.delete('/tests/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await testCollection.deleteOne(query);
      res.send(result)
    });

      //  save apply data
      app.post('/bookList', async (req, res) => {
        const info = req.body;
        const result = await bookCollection.insertOne(info);
        const updateDoc = {
          $inc: { slots: -1 },
        }
        const testQuery = { _id: new ObjectId(info._id) }
        const updateSlots = await testCollection.updateOne(testQuery, updateDoc)
        console.log(updateSlots)
        res.send(result)
      });

    // Send a ping to confirm a successful connection
    await client.db('admin').command({ ping: 1 })
    console.log(
      'Pinged your deployment. You successfully connected to MongoDB!'
    )
  } finally {
    // Ensures that the client will close when you finish/error
  }
}
run().catch(console.dir)

app.get('/', (req, res) => {
  res.send('Hello from DiagnoSage Server..')
})

app.listen(port, () => {
  console.log(`DiagnoSage is running on port ${port}`)
})