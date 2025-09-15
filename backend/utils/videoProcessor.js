const { google } = require('googleapis');

// Utility function to extract YouTube video ID from URL
function extractVideoId(url) {
    const regex = /(?:https?:\/\/)?(?:www\.)?youtu(?:\.be\/|be\.com\/(?:watch\?v=|v\/|embed\/|user\/(?:[\w#]+\/)+))([^&#?\n]+)/;
    const matches = url.match(regex);
    return matches ? matches[1] : null;
}

async function getVideoDetails(videoId) {
    const youtube = google.youtube({
        version: 'v3',
        auth: process.env.GOOGLE_API_KEY,
    });

    const response = await youtube.videos.list({
        part: 'snippet,contentDetails,statistics', // Specify the parts you want to retrieve
        id: videoId,
    });

    return response.data.items[0];
}

// Function to get original language of the video 
async function getVideoInfo(youtubeUrl) {
    const youtubeAPI = require('youtube-api-v3-search');
    const apiKey = process.env.GOOGLE_API_KEY;
    const videoId = extractVideoId(youtubeUrl);
    if (!videoId) throw new Error('Invalid YouTube URL');

    console.log(`Fetching video language for video ID: ${videoId}`);

    const options = {
        part: 'snippet',
        id: videoId,
        type: 'video'
    };
    console.log(`Options used for YouTube API:`, options);
    return await youtubeAPI(apiKey, options);
}


// Function to extract audio track from youtube video using youtube-dl
async function extractAudio(youtubeUrl) {
    const youtubedl = require('youtube-dl-exec');
    const outputPath = '/tmp/audio.%(ext)s';
    await youtubedl(youtubeUrl, {
        extractAudio: true,
        audioFormat: 'mp3',
        output: outputPath,
        noCheckCertificates: true,
        noWarnings: true,
        preferFreeFormats: true,
        addHeader: [
            'referer:youtube.com',
            'user-agent:googlebot'
        ]
    });
    return outputPath.replace('%(ext)s', 'mp3');
}

// Function to trasncribe audio using Google Cloud Speech-to-Text and keeping time track like subtitles
async function transcribeAudio(audioPath, languageCode) {
    const fs = require('fs');
    const speech = require('@google-cloud/speech');
    const client = new speech.SpeechClient({ apiKey: process.env.GOOGLE_API_KEY });

    const file = fs.readFileSync(audioPath);
    const audioBytes = file.toString('base64');

    const request = {
        audio: {
            content: audioBytes,
        },
        config: {
            encoding: 'MP3',
            sampleRateHertz: 16000,
            languageCode: languageCode,
            enableWordTimeOffsets: true,
        },
    };

    const [response] = await client.recognize(request);
    return response;
}

// Function to translate text using Google Cloud Translate
async function translateText(text, targetLanguage, originalLanguage = 'pt-BR') {
    const { TranslationServiceClient } = require('@google-cloud/translate');
    const translationClient = new TranslationServiceClient();

    const [response] = await translationClient.translateText({
        parent: translationClient.locationPath('youtube-voice-over-472122', 'global'),
        contents: [text],
        targetLanguageCode: targetLanguage,
        mimeType: 'text/plain', // mime types: text/plain, text/html
        originalLanguageCode: originalLanguage
    });
    return response.translations[0].translatedText;
}

// Function to create new audio track from the original track and the translated text using Google Cloud Text-to-Speech
async function synthesizeSpeech(text, languageCode) {
    const fs = require('fs');
    const textToSpeech = require('@google-cloud/text-to-speech');
    const client = new textToSpeech.TextToSpeechClient();

    const request = {
        input: { text: text },
        voice: { languageCode: languageCode, ssmlGender: 'NEUTRAL' },
        audioConfig: { audioEncoding: 'MP3' },
    };

    const [response] = await client.synthesizeSpeech(request);
    const outputPath = '/tmp/synthesized_audio.mp3';
    fs.writeFileSync(outputPath, response.audioContent, 'binary');
    return outputPath;
}

// Function to merge audio with video using FFmpeg
async function mergeAudioWithVideo(originalVideoPath, audioPath, outputVideoPath) {
    const ffmpeg = require('fluent-ffmpeg');
    return new Promise((resolve, reject) => {
        ffmpeg(originalVideoPath)
            .addInput(audioPath)
            .outputOptions('-c:v copy') // Copy the video stream
            .outputOptions('-c:a aac')   // Encode audio to AAC
            .outputOptions('-shortest')   // Finish encoding when the shortest input ends
            .save(outputVideoPath)
            .on('end', () => resolve(outputVideoPath))
            .on('error', (err) => reject(err));
    });
}

async function processJob(job, youtubeUrl) {
    try {
        job.status = 'processing';
        job.updatedAt = new Date();
        await job.save();

        console.log(`Processing job ID: ${job._id}`);

        const videoInfo = await getVideoDetails(job.youtubeLinkId);

        const originalLanguage = videoInfo.snippet.defaultAudioLanguage || 'pt-BR';
        console.log(`Original language: ${originalLanguage}`);
        // const audioPath = await extractAudio(youtubeUrl);
        // console.log(`Extracted audio path: ${audioPath}`);
        // const transcription = await transcribeAudio(audioPath, originalLanguage);
        // console.log(`Transcription complete`);
        const translatedText = await translateText('O Arthur é um ótimo programador', job.language, originalLanguage);
        console.log(`Translation complete: ${JSON.stringify(translatedText)}`);
        // console.log(`Translation complete`);
        const synthesizedAudio = await synthesizeSpeech(translatedText, job.language);
        console.log(`Speech synthesis complete at: ${synthesizedAudio}`);
        const result = await uploadToCloudStorage(synthesizedAudio, `synthesized_audio_${job.youtubeLinkId}_${job.language}.mp3`);
        // const outputVideoPath = `/tmp/output_${videoId}.mp4`;
        // const result = await mergeAudioWithVideo(audioPath, synthesizedAudio, outputVideoPath);
        // console.log(`Video processing complete: ${result.videoUrl}`);

        job.status = 'done';
        job.result = result;
        job.updatedAt = new Date();
        await job.save();
    } catch (error) {
        job.status = 'error';
        job.error = error.message;
        job.updatedAt = new Date();
        await job.save();
        console.error(`Error processing job ID ${job._id}:`, error);
    }


}

// Function to Upload audio to Cloud Storage
async function uploadToCloudStorage(filePath, destFileName) {

    // Imports the Google Cloud client library
    const { Storage } = require('@google-cloud/storage');

    // Creates a client
    const storage = new Storage({ apiKey: process.env.GOOGLE_API_KEY });

    const options = {
        destination: destFileName
    };
    const bucketName = process.env.GCLOUD_STORAGE_BUCKET;
    console.log(`Uploading file ${filePath} to bucket ${bucketName} as ${destFileName}`);
    const res = await storage.bucket(bucketName).upload(filePath, options);
    console.log(`${filePath} uploaded to ${bucketName}`);
    return res[0].publicUrl();
}


module.exports = {
    processJob,
    extractVideoId
};