const express = require('express');
const cors = require('cors');
const app = express()
const jwt = require('jsonwebtoken');
require('dotenv').config()
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const port = process.env.PORT || 5000


// middleware
app.use(cors())
app.use(express.json())



const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.VITE_DB_USER}:${process.env.VITE_DB_PASS}@cluster0.04lxrta.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        const mealsCollection = client.db("mealsDb").collection("meals")
        const upcomingCollection = client.db("mealsDb").collection("upcoming")
        const requestMealsCollection = client.db("mealsDb").collection("requestMeals")
        const reviewsCollection = client.db("mealsDb").collection("reviews")
        const userCollection = client.db("mealsDb").collection("users");
        const packageCollection = client.db("mealsDb").collection("packages");
        const packagePaymentCollection = client.db("mealsDb").collection("packagePayments");
        const paymentCollection = client.db("mealsDb").collection("payments");

        // jwt related api
        app.post('/jwt', async (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });
            res.send({ token });
        })

        // middlewares 
        const verifyToken = (req, res, next) => {
            // console.log('inside verify token', req.headers.authorization);
            if (!req.headers.authorization) {
                return res.status(401).send({ message: 'unauthorized access' });
            }
            const token = req.headers.authorization.split(' ')[1];
            jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
                if (err) {
                    return res.status(401).send({ message: 'unauthorized access' })
                }
                req.decoded = decoded;
                next();
            })
        }

        // use verify admin after verifyToken
        const verifyAdmin = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email };
            const user = await userCollection.findOne(query);
            const isAdmin = user?.role === 'admin';
            if (!isAdmin) {
                return res.status(403).send({ message: 'forbidden access' });
            }
            next();
        }

        // user related api
        app.get('/users', async (req, res) => {
            const result = await userCollection.find().toArray();
            res.send(result);
        });

        app.post('/users', async (req, res) => {
            const user = req.body;
            // insert email if user doesnt exists: 
            // you can do this many ways (1. email unique, 2. upsert 3. simple checking)
            const query = { email: user.email }
            const existingUser = await userCollection.findOne(query);
            if (existingUser) {
                return res.send({ message: 'user already exists', insertedId: null })
            }
            const result = await userCollection.insertOne(user);
            res.send(result);
        });

        app.get('/users/admin/:email', verifyToken, async (req, res) => {
            const email = req.params.email;

            if (email !== req.decoded.email) {
                return res.status(403).send({ message: 'forbidden access' })
            }

            const query = { email: email };
            const user = await userCollection.findOne(query);
            let admin = false;
            if (user) {
                admin = user?.role === 'admin';
            }
            res.send({ admin });
        })

        app.patch('/users/admin/:id', verifyToken, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updatedDoc = {
                $set: {
                    role: 'admin'
                }
            }
            const result = await userCollection.updateOne(filter, updatedDoc);
            res.send(result);
        })

        app.delete('/users/:id', verifyToken, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await userCollection.deleteOne(query);
            res.send(result);
        })

        // menu related apis

        // meals
        app.get('/meals', async (req, res) => {

            const result = await mealsCollection.find().toArray();
            res.send(result)
        })

        app.get('/meals/:id', async (req, res) => {
            const id = req.params.id
            const query = { _id: new ObjectId(id) }
            const result = await mealsCollection.findOne(query)
            res.send(result)
        })



        app.post('/meals', verifyToken, verifyAdmin, async (req, res) => {
            const item = req.body;
            const result = await mealsCollection.insertOne(item);
            res.send(result);
        });

        app.patch('/meals/:id', async (req, res) => {
            try {
                const item = req.body;
                const id = req.params.id;
                const filter = { _id: new ObjectId(id) };

                const updatedDoc = {
                    $set: {
                        mealTitle: item.mealTitle,
                        mealImage: item.mealImage,
                        ingredients: item.ingredients,
                        description: item.description,
                        price: item.price,
                        rating: item.rating,
                        name: item.name,
                        email: item.email,
                    },
                };

                const result = await mealsCollection.updateOne(filter, updatedDoc);

                if (result.modifiedCount > 0) {
                    // If at least one document was modified, send a success response
                    res.send({ success: true, modifiedCount: result.modifiedCount });
                } else {
                    // If no documents were modified, send a response indicating that the item wasn't found
                    res.status(404).send({ success: false, message: 'Item not found' });
                }

                console.log(result);
            } catch (error) {
                console.error('Error updating meal:', error);
                res.status(500).send('Internal Server Error');
            }
        });

        app.delete('/meals/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await mealsCollection.deleteOne(query);
            res.send(result);
        });

        // upcoming
        app.get('/upcoming', async (req, res) => {

            const result = await upcomingCollection.find().toArray();
            res.send(result)
        })

        app.get('/upcoming/:id', async (req, res) => {
            const id = req.params.id
            const query = { _id: new ObjectId(id) }
            const result = await upcomingCollection.findOne(query)
            res.send(result)
        })

        app.post('/upcoming', verifyToken, verifyAdmin, async (req, res) => {
            const item = req.body;
            const result = await upcomingCollection.insertOne(item);
            res.send(result);
        });


        app.delete('/upcoming/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await upcomingCollection.deleteOne(query);
            res.send(result);
        });

        app.put('/upcoming/like/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };

            // Update the likes count in the database
            const result = await upcomingCollection.updateOne(query, { $inc: { likes: 1 } });

            res.send(result);
        });



        // Like a meal
        app.post('/meals/like/:id', async (req, res) => {
            const mealId = req.params.id;
            const query = { _id: new ObjectId(mealId) };

            // Fetch the current document to get the current value of "likes"
            const currentMeal = await mealsCollection.findOne(query);

            if (currentMeal) {
                const update = { $inc: { likes: 1 } };
                const result = await mealsCollection.updateOne(query, update);
                res.send(result);
            } else {
                res.status(404).send({ error: 'Meal not found' });
            }
        });

        // Like a meal
        app.post('/meals/like/:id', async (req, res) => {
            const mealId = req.params.id;
            const query = { _id: new ObjectId(mealId) };

            // Fetch the current document to get the current value of "likes"
            const currentMeal = await mealsCollection.findOne(query);

            if (currentMeal && currentMeal.likes >= 0) {
                const update = { $inc: { likes: 1 } };
                const result = await mealsCollection.updateOne(query, update);
                res.send(result);
            } else {
                res.status(404).send({ error: 'Meal not found or already disliked' });
            }
        });

        // Dislike a meal
        app.post('/meals/dislike/:id', async (req, res) => {
            const mealId = req.params.id;
            const query = { _id: new ObjectId(mealId) };

            // Fetch the current document to get the current value of "likes"
            const currentMeal = await mealsCollection.findOne(query);

            if (currentMeal && currentMeal.likes > 0) {
                const update = { $inc: { likes: -1 } };
                const result = await mealsCollection.updateOne(query, update);

                // Check if likes are negative, set them to 0
                if (result.modifiedCount > 0 && currentMeal.likes - 1 < 0) {
                    await mealsCollection.updateOne({ _id: new ObjectId(mealId) }, { $set: { likes: 0 } });
                }

                res.send(result);
            } else {
                res.status(404).send({ error: 'Meal not found or already liked' });
            }
        });



        app.post('/requestMeals', async (req, res) => {
            try {
                const meals = req.body;
                console.log(meals);
                const result = await requestMealsCollection.insertOne(meals);
                res.send(result);
            } catch (error) {
                console.error('Error inserting meal:', error);
                res.status(500).send('Internal Server Error');
            }
        })

        app.get('/requestMeals', async (req, res) => {

            const result = await requestMealsCollection.find().toArray();
            res.send(result)
        })

        app.put('/requestMeals/:id', async (req, res) => {
            try {
                const id = req.params.id;
                const filter = { _id: new ObjectId(id) };
                const update = { $set: { status: 'served' } };

                const result = await requestMealsCollection.updateOne(filter, update);

                if (result.modifiedCount > 0) {
                    res.send({ success: true, modifiedCount: result.modifiedCount });
                } else {
                    res.status(404).send({ success: false, message: 'Item not found' });
                }
            } catch (error) {
                console.error('Error updating status:', error);
                res.status(500).send('Internal Server Error');
            }
        });

        app.delete('/requestMeals/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await requestMealsCollection.deleteOne(query);
            res.send(result);
        });

        app.post('/reviews', async (req, res) => {
            try {
                const reviews = req.body;
                console.log(reviews);
                const result = await reviewsCollection.insertOne(reviews);
                res.send(result);
            } catch (error) {
                console.error('Error inserting meal:', error);
                res.status(500).send('Internal Server Error');
            }
        })


        // Add this route for searching users by username or email
        app.get('/requestMeals/search', async (req, res) => {
            try {
                const { query } = req.query;

                // Use a regex pattern for case-insensitive search
                const searchPattern = new RegExp(query, 'i');

                // Perform a search on both username and email fields
                const result = await requestMealsCollection.find({
                    $or: [
                        { name: searchPattern },
                        { email: searchPattern }
                    ]
                }).toArray();

                res.send(result);
            } catch (error) {
                console.error('Error searching for users:', error);
                res.status(500).send('Internal Server Error');
            }
        });


        app.get('/reviews', async (req, res) => {

            const result = await reviewsCollection.find().toArray();
            res.send(result)
        })

        app.get('/reviews/:email', verifyToken, async (req, res) => {
            const query = { email: req.params.email }
            if (req.params.email !== req.decoded.email) {
                return res.status(403).send({ message: 'forbidden access' });
            }
            const result = await reviewsCollection.find(query).toArray();
            res.send(result);
            console.log(result)
        })

        app.delete('/reviews/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await reviewsCollection.deleteOne(query);
            res.send(result);
        });

        app.get('/requestMeals', async (req, res) => {

            const result = await requestMealsCollection.find().toArray();
            res.send(result)
        })
        // package
        app.get('/packages', async (req, res) => {

            const result = await packageCollection.find().toArray();
            res.send(result)
        })
        //package payment intent
        app.post('/create-package-payment-intent', async (req, res) => {
            const { price } = req.body;
            const amount = parseInt(price * 100);
            console.log(amount, 'amount inside the intent')

            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: 'usd',
                payment_method_types: ['card']
            });

            res.send({
                clientSecret: paymentIntent.client_secret
            })
        });

        app.get('/packagePayments/:email', verifyToken, async (req, res) => {
            const query = { email: req.params.email }
            if (req.params.email !== req.decoded.email) {
                return res.status(403).send({ message: 'forbidden access' });
            }
            const result = await packagePaymentCollection.find(query).toArray();
            res.send(result);
            console.log(result)
        })

        app.get('/packagePayments', async (req, res) => {

            const result = await packagePaymentCollection.find().toArray();
            res.send(result)
        })

        app.post('/packagePayments', async (req, res) => {
            try {
                const packages = req.body;
                console.log(packages);
                const result = await packagePaymentCollection.insertOne(packages);
                res.send(result);
            } catch (error) {
                console.error('Error inserting meal:', error);
                res.status(500).send('Internal Server Error');
            }
        })


        // payment intent
        app.post('/create-payment-intent', async (req, res) => {
            const { price } = req.body;
            const amount = parseInt(price * 100);
            console.log(amount, 'amount inside the intent')

            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: 'usd',
                payment_method_types: ['card']
            });

            res.send({
                clientSecret: paymentIntent.client_secret
            })
        });


        app.get('/payments/:email', verifyToken, async (req, res) => {
            const query = { email: req.params.email }
            if (req.params.email !== req.decoded.email) {
                return res.status(403).send({ message: 'forbidden access' });
            }
            const result = await paymentCollection.find(query).toArray();
            res.send(result);
        })

        app.post('/payments', async (req, res) => {
            const payment = req.body;
            const paymentResult = await paymentCollection.insertOne(payment);

            //  carefully delete each item from the cart
            console.log('payment info', payment);
            //  carefully delete each item from the cart
            console.log('payment info', payment);
            const query = {
                _id: {
                    $in: payment.cartIds.map(id => new ObjectId(id))
                }
            };

            const deleteResult = await requestMealsCollection.deleteMany(query);



            res.send({ paymentResult, deleteResult });
        })


        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();
        // Send a ping to confirm a successful connection
        // await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);



app.get('/', (req, res) => {
    res.send('hostel meal management is running')
})

app.listen(port, () => {
    console.log('hostel meal management  server is running on port ', port)
})




