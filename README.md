# Youtube Voice Over

## Overview

This project lets users submit a YouTube video URL and a target language. The backend creates a job, simulates video processing, and returns a video with a new voice track (demo only; pipeline not yet implemented). Job status and result are stored in MongoDB.

## Frontend

- Built in Angular.
- Input for YouTube URL and language.
- Shows job status and plays processed video when ready.

### Run Frontend

```bash
cd frontend
npm install
npm start
```
(Requires Angular CLI)

## Backend

- Node.js/Express API
- Stores jobs in MongoDB

### Run Backend

```bash
cd backend
npm install
node index.js
```

Edit `backend/index.js` to use your MongoDB URI.

## Extending

- Implement audio extraction, separation, transcription, translation, TTS, muxing in `/api/process`.
- Store and serve processed files (e.g., via static hosting, GridFS, or S3).

## Demo Video

The system currently returns a demo video. Replace with your processing logic!