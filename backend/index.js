require("dotenv").config();
const express = require("express");
const axios = require("axios");
const cors = require("cors");
const mongoose = require("mongoose");

const app = express();
app.use(cors()); // Allow requests from frontend
app.use(express.json());

const PORT = process.env.PORT || 5000;
const ORS_API_KEY = process.env.ORS_API_KEY; // Store API key in .env

mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("MongoDB Connected"))
  .catch((err) => console.error("MongoDB Connection Error:", err));

const PolygonSchema = new mongoose.Schema({
  coordinates: { type: [[Number]], required: true }, // Array of [lat, lng] pairs
});

const Polygon = mongoose.model("Polygon", PolygonSchema);

// Save Polygon
app.post("/api/polygons", async (req, res) => {
  try {
    const { coordinates } = req.body;
    if (!coordinates || coordinates.length < 3) {
      return res
        .status(400)
        .json({ error: "A polygon must have at least 3 points" });
    }

    const polygon = new Polygon({ coordinates });
    await polygon.save();
    console.log("🚀 ~ app.post ~ polygon:", polygon);
    res.status(201).json({ message: "Polygon saved successfully", polygon });
  } catch (err) {
    res.status(500).json({ error: "Server Error" });
  }
});

// Get all Polygons
app.get("/api/polygons", async (req, res) => {
  try {
    const polygons = await Polygon.find();
    console.log("🚀 ~ app.get ~ polygons:", polygons);
    res.status(200).json(polygons);
  } catch (err) {
    res.status(500).json({ error: "Server Error" });
  }
});

// Route to fetch directions securely
app.post("/api/getRoute", async (req, res) => {
  try {
    const { start, end } = req.body;

    const endCoordinates = [parseFloat(end[1]), parseFloat(end[0])];
    console.log("🚀 ~ app.post ~ endCoordinates:", endCoordinates);

    const url = `https://api.openrouteservice.org/v2/directions/driving-car?api_key=${ORS_API_KEY}&start=${start[1]},${start[0]}&end=${endCoordinates[0]},${endCoordinates[1]}`;

    console.log("🚀 ~ app.post ~ url:", url);
    const response = await axios.get(url);
    return res.status(200).json(response?.data);
  } catch (error) {
    console.error("Error fetching route:", error?.response?.data);
    res.status(500).json({ error: "Failed to fetch route" });
  }
});

// Start server
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
