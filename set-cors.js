const admin = require('firebase-admin');
const serviceAccount = require('./firebase/g-pluse-firebase-adminsdk-fbsvc-e3048d4260.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: 'g-pluse.firebasestorage.app'
});

const bucket = admin.storage().bucket();
bucket.setCorsConfiguration([
    {
        origin: ['*'],
        method: ['GET', 'PUT', 'POST', 'DELETE', 'OPTIONS'],
        responseHeader: ['Content-Type', 'Authorization', 'Content-Length', 'User-Agent', 'x-goog-resumable'],
        maxAgeSeconds: 3600
    }
]).then(() => {
    console.log('CORS Configured successfully!');
    process.exit(0);
}).catch((err) => {
    console.error('Error configuring CORS:', err);
    process.exit(1);
});
