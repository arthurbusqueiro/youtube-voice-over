const mongoose = require('mongoose');

const JobSchema = new mongoose.Schema({
  youtubeLinkId: { type: String, required: true },
  language: { type: String, required: true },
  status: { type: String, enum: ['pending', 'processing', 'done', 'error'], default: 'pending' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  result: { type: mongoose.Schema.Types.Mixed, default: null },
  error: { type: String, default: null }
});

const Job = mongoose.model('Job', JobSchema);

module.exports = { Job };