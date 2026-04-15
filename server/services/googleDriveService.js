const { google } = require('googleapis');
const stream = require('stream');

/**
 * Google Drive Service
 * Handles autonomous file operations: Upload, Permissions, and Sharing.
 */
class GoogleDriveService {
    
    /**
     * Get authenticated Drive client for a user
     */
    getDriveClient(user) {
        const oauth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            `${process.env.NODE_ENV === "production" ? "https://nurotra.online" : "http://localhost:5000"}/api/integrations/google/callback`
        );

        oauth2Client.setCredentials({
            access_token: user.googleAccessToken,
            refresh_token: user.googleRefreshToken
        });

        return google.drive({ version: 'v3', auth: oauth2Client });
    }

    /**
     * Upload a buffer to Google Drive
     * @returns {Promise<{fileId: string, webViewLink: string}>}
     */
    async uploadFile(user, fileBuffer, fileName, mimeType) {
        try {
            console.log(`[DriveService] Starting upload for: ${fileName}`);
            const drive = this.getDriveClient(user);

            // Convert buffer to stream for multipart upload
            const bufferStream = new stream.PassThrough();
            bufferStream.end(fileBuffer);

            const fileMetadata = {
                name: fileName,
                // Optional: We could create/find a "Nurotra Exports" folder here in the future
            };

            const media = {
                mimeType: mimeType,
                body: bufferStream,
            };

            const response = await drive.files.create({
                resource: fileMetadata,
                media: media,
                fields: 'id, webViewLink, name',
            });

            const fileId = response.data.id;
            console.log(`[DriveService] Uploaded successfully. File ID: ${fileId}`);

            // Automatically make it public as per USER_REQUEST
            await this.makePublic(user, fileId);

            // Refresh metadata to get the latest link
            const finalFile = await drive.files.get({
                fileId: fileId,
                fields: 'webViewLink',
            });

            return {
                fileId,
                webViewLink: finalFile.data.webViewLink,
                fileName: response.data.name
            };
        } catch (error) {
            console.error(`[DriveService] Upload failed:`, error.message);
            throw error;
        }
    }

    /**
     * Update permissions to "Public Read" (Anyone with link)
     */
    async makePublic(user, fileId) {
        try {
            const drive = this.getDriveClient(user);
            console.log(`[DriveService] Updating permissions for ${fileId} to Public...`);

            await drive.permissions.create({
                fileId: fileId,
                resource: {
                    role: 'reader',
                    type: 'anyone',
                },
            });

            return true;
        } catch (error) {
            console.error(`[DriveService] Failed to set public permissions:`, error.message);
            // Non-fatal, return false but don't crash
            return false;
        }
    }
}

module.exports = new GoogleDriveService();
