import { Injectable, BadRequestException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { FirebaseAdminService } from './firebase-admin.service';

@Injectable()
export class AuthService {
    constructor(
        private usersService: UsersService,
        private firebaseAdmin: FirebaseAdminService,
    ) { }

    async register(email: string, password: string, name: string) {
        try {
            // 1. Create user in Firebase
            const firebaseUser = await this.firebaseAdmin.getAuth().createUser({
                email,
                password,
                displayName: name,
            });

            // 2. Create user in local DB
            const user = await this.usersService.create({
                email: firebaseUser.email || email,
                googleId: firebaseUser.uid,
                name: name,
            });

            return user;
        } catch (error) {
            throw new BadRequestException(error.message);
        }
    }

    async forgotPassword(email: string) {
        try {
            // Firebase Admin lets us generate a reset link
            const link = await this.firebaseAdmin.getAuth().generatePasswordResetLink(email);
            // In a real app, we would send this link via an Email Service (SendGrid, etc.)
            // For now, Firebase can also send it directly if configured, but through Admin SDK 
            // we usually get the link to send it ourselves.
            // For MVP simplicity, we can tell the user to use the Firebase Client SDK to trigger this,
            // or we return success if the user exists.

            // Note: Firebase Admin doesn't "send" the email automatically like the Client SDK does.
            // But we can trigger it or provide the link.
            console.log(`Password reset link for ${email}: ${link}`);
            return { message: 'If the email exists, a reset link has been generated.' };
        } catch (error) {
            throw new BadRequestException(error.message);
        }
    }

    async validateUser(firebaseUser: any) {
        const { email, uid, name } = firebaseUser;
        // Check by googleId first (this maps to Firebase UID)
        let user = await this.usersService.findOne({ googleId: uid });

        // Fallback: Check by email
        if (!user && email) {
            user = await this.usersService.findOne({ email });
            if (user && !user.googleId) {
                // Link Firebase UID to existing local user if they only had email
                user = await this.usersService.updateByEmail(email, { googleId: uid });
            }
        }

        if (!user) {
            // Auto-register if not found
            user = await this.usersService.create({
                email: email || `${uid}@placeholder.com`,
                googleId: uid,
                name: name || 'User',
            });
        }
        return user;
    }
}
