import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';

@Injectable()
export class FirebaseAdminService implements OnModuleInit {
    constructor(private configService: ConfigService) { }

    onModuleInit() {
        if (admin.apps.length === 0) {
            // For development, we might use service account or just project ID if running in GCP
            // Typically, for local dev, we use a serviceAccountKey.json
            const serviceAccountPath = this.configService.get<string>('FIREBASE_SERVICE_ACCOUNT');

            if (serviceAccountPath) {
                admin.initializeApp({
                    credential: admin.credential.cert(serviceAccountPath),
                });
            } else {
                // Fallback or warning
                console.warn('FIREBASE_SERVICE_ACCOUNT not found, firebase-admin initialized with default credentials');
                admin.initializeApp();
            }
        }
    }

    getAuth() {
        return admin.auth();
    }
}
