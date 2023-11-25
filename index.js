const express = require('express');
const cors = require('cors');
const app = express()
const port = process.env.PORT || 5000
require('dotenv').config()


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
    const mealsCollection = client.db("mealsDb").collection("meals")
    const requestMealsCollection = client.db("mealsDb").collection("requestMeals")
    const reviewsCollection = client.db("mealsDb").collection("reviews")
    try {
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


        app.put('/meals/:id', async (req, res) => {
            const id = req.params.id
            const query = { _id: new ObjectId(id) }

            try {
                // Find the meal by ID
                const meal = await mealsCollection.findOne(query);

                if (!meal) {
                    // If the meal with the specified ID is not found, return a 404 status
                    return res.status(404).json({ error: 'Meal not found' });
                }

                // Check if the user has already liked the meal
                const hasLiked = meal.likes > 0;

                // Update the 'likes' field based on whether the user has already liked
                const updatedLikes = hasLiked ? meal.likes - 1 : meal.likes + 1;

                // Update the 'likes' field
                const updatedMeal = await mealsCollection.updateOne(
                    query,
                    { $set: { likes: updatedLikes } }
                );

                // Return the updated meal data
                res.json({ success: true, updatedMeal: { ...meal, likes: updatedLikes } });
            } catch (error) {
                console.error('Error updating likes:', error.message);
                // Handle the error, send an error response, or log it as needed
                res.status(500).json({ error: 'Internal server error' });
            }
        })

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

        app.get('/reviews', async (req, res) => {

            const result = await reviewsCollection.find().toArray();
            res.send(result)
        })

        app.get('/requestMeals', async (req, res) => {

            const result = await requestMealsCollection.find().toArray();
            res.send(result)
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




