#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getStorage } from 'firebase-admin/storage';

const IG_BASE = 'https://graph.facebook.com/v21.0';

function arg(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : '';
}

async function uploadVideo(videoPath, bucketName, credentialPath) {
  const app = getApps()[0] ?? initializeApp({
    credential: cert(JSON.parse(readFileSync(resolve(credentialPath), 'utf8'))),
    storageBucket: bucketName,
  });
  const bucket = getStorage(app).bucket(bucketName);
  const fileName = resolve(videoPath).split(/[\\/]/).pop();
  const objectName = `social-media/instagram/${new Date().toISOString().slice(0, 10)}/${Date.now()}-${fileName}`;
  const file = bucket.file(objectName);
  await file.save(readFileSync(resolve(videoPath)), { metadata: { contentType: 'video/mp4' } });
  const [url] = await file.getSignedUrl({ action: 'read', expires: Date.now() + 60 * 60 * 1000 });
  return url;
}

async function uploadCover(coverPath, bucketName) {
  const bucket = getStorage().bucket(bucketName);
  const fileName = resolve(coverPath).split(/[\\/]/).pop();
  const objectName = `social-media/instagram/${new Date().toISOString().slice(0, 10)}/${Date.now()}-${fileName}`;
  const file = bucket.file(objectName);
  await file.save(readFileSync(resolve(coverPath)), { metadata: { contentType: 'image/jpeg' } });
  const [url] = await file.getSignedUrl({ action: 'read', expires: Date.now() + 60 * 60 * 1000 });
  return url;
}

async function createReel(userId, videoUrl, coverUrl, caption, token) {
  const params = new URLSearchParams({
    media_type: 'REELS',
    video_url: videoUrl,
    cover_url: coverUrl,
    caption,
    share_to_feed: 'true',
    access_token: token,
  });
  const res = await fetch(`${IG_BASE}/${userId}/media?${params}`, { method: 'POST' });
  if (!res.ok) throw new Error(`createReel failed [${res.status}]: ${await res.text()}`);
  return (await res.json()).id;
}

async function status(id, token) {
  const params = new URLSearchParams({ fields: 'status_code', access_token: token });
  const res = await fetch(`${IG_BASE}/${id}?${params}`);
  if (!res.ok) throw new Error(`status failed [${res.status}]: ${await res.text()}`);
  return (await res.json()).status_code;
}

async function waitUntilFinished(id, token, timeoutMs = 180000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const current = await status(id, token);
    if (current === 'FINISHED') return;
    if (current === 'ERROR') throw new Error(`Reel container ${id} entered ERROR state`);
    await new Promise(resolvePromise => setTimeout(resolvePromise, 5000));
  }
  throw new Error(`Reel container ${id} timed out`);
}

async function publish(userId, containerId, token) {
  const params = new URLSearchParams({ creation_id: containerId, access_token: token });
  const res = await fetch(`${IG_BASE}/${userId}/media_publish?${params}`, { method: 'POST' });
  if (!res.ok) throw new Error(`publishReel failed [${res.status}]: ${await res.text()}`);
  return (await res.json()).id;
}

async function permalink(mediaId, token) {
  const params = new URLSearchParams({ fields: 'permalink', access_token: token });
  const res = await fetch(`${IG_BASE}/${mediaId}?${params}`);
  if (!res.ok) return null;
  return (await res.json()).permalink ?? null;
}

const videoPath = arg('--video');
const captionPath = arg('--caption-file');
const coverPath = arg('--cover');
const { INSTAGRAM_ACCESS_TOKEN: token, INSTAGRAM_USER_ID: userId, FIREBASE_STORAGE_BUCKET: bucket, GOOGLE_APPLICATION_CREDENTIALS: credentials } = process.env;
if (!videoPath || !captionPath || !coverPath) throw new Error('--video, --caption-file and --cover are required');
if (!token || !userId || !bucket || !credentials) throw new Error('Instagram and Firebase variables are required in .env');

console.log('Uploading Reel video to Firebase Storage...');
const videoUrl = await uploadVideo(videoPath, bucket, credentials);
console.log('Uploading Reel cover to Firebase Storage...');
const coverUrl = await uploadCover(coverPath, bucket);
console.log('Creating Instagram Reel container...');
const containerId = await createReel(userId, videoUrl, coverUrl, readFileSync(resolve(captionPath), 'utf8'), token);
console.log(`Reel container: ${containerId}`);
console.log('Waiting for Instagram processing...');
await waitUntilFinished(containerId, token);
console.log('Publishing Reel...');
const postId = await publish(userId, containerId, token);
const url = await permalink(postId, token);
console.log(`REEL_PUBLISHED|${postId}|${url ?? ''}`);
