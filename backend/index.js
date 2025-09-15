const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const { Job } = require('./models/Job');
const videoProcessor = require('./utils/videoProcessor');
require('dotenv').config();

const app = express();
const PORT = 3000;

// Replace this with your actual MongoDB connection string
const MONGODB_URI = process.env.MONGODB_URI;

app.use(cors());
app.use(bodyParser.json());

// Connect to MongoDB
mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('MongoDB Connected'))
  .catch(err => console.error('MongoDB connection error:', err));

// Create a new processing job
app.post('/api/process', async (req, res) => {
  const { youtubeUrl, language } = req.body;
  if (!youtubeUrl || !language) {
    return res.status(400).json({ error: 'youtubeUrl and language are required' });
  }

  const videoId = videoProcessor.extractVideoId(youtubeUrl);
  if (!videoId) throw new Error('Invalid YouTube URL');


  // Create a job entry in the database
  const job = new Job({
    youtubeLinkId: videoId,
    language,
    status: 'pending',
    createdAt: new Date(),
    updatedAt: new Date(),
    result: null
  });

  await job.save();
  console.log(`Job created with ID: ${job._id}`);

  // Process the job asynchronously
  videoProcessor.processJob(job, youtubeUrl).catch(err => {
    console.error('Error processing job:', err);
  });

  res.status(202).json({ jobId: job._id });

});

// Endpoint to get job status/result
app.get('/api/job/:id', async (req, res) => {
  const job = await Job.findById(req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  res.json(job);
});

// Endpoint to get job is exists by the youtube video id and language
app.get('/api/job', async (req, res) => {
  const { youtubeUrl, language } = req.query;
  if (!youtubeUrl || !language) {
    return res.status(400).json({ error: 'youtubeUrl and language are required' });
  }

  const job = await Job.findOne({ youtubeLinkId: extractVideoId(youtubeUrl), language, status: 'done' });
  if (!job) return res.status(404).json({ error: 'Job not found' });
  res.json(job);
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
