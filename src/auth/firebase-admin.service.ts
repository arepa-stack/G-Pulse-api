import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';

@Injectable()
export class FirebaseAdminService implements OnModuleInit {
    constructor(private configService: ConfigService) { }

    onModuleInit() {
        if (admin.apps.length === 0) {
            const serviceAccountJson = this.configService.get<string>('FIREBASE_SERVICE_ACCOUNT_JSON');
            const serviceAccountPath = this.configService.get<string>('FIREBASE_SERVICE_ACCOUNT');

            if (serviceAccountJson) {
                const serviceAccount = JSON.parse(serviceAccountJson);
                admin.initializeApp({
                    credential: admin.credential.cert(serviceAccount),
                });
            } else if (serviceAccountPath) {
                admin.initializeApp({
                    credential: admin.credential.cert(serviceAccountPath),
                });
            } else {
                console.warn('No Firebase credentials found, initialized with default credentials');
                admin.initializeApp();
            }
        }
    }

    getAuth() {
        return admin.auth();
    }
}
