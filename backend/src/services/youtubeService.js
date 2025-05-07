const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

/**
 * Service to handle YouTube API integration
 */
class YouTubeService {
  constructor() {
    this.youtube = null;
    this.oAuth2Client = null;
  }

  /**
   * Initialize the YouTube API client with OAuth credentials
   */
  initialize(clientId, clientSecret, redirectUri) {
    this.oAuth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      redirectUri
    );

    this.youtube = google.youtube({
      version: 'v3',
      auth: this.oAuth2Client
    });
  }

  /**
   * Get the authorization URL for YouTube
   */
  getAuthUrl() {
    return this.oAuth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: ['https://www.googleapis.com/auth/youtube.upload']
    });
  }

  /**
   * Exchange authorization code for tokens
   */
  async getTokenFromCode(code) {
    const { tokens } = await this.oAuth2Client.getToken(code);
    this.oAuth2Client.setCredentials(tokens);
    return tokens;
  }

  /**
   * Upload video to YouTube
   */
  async uploadVideo(filePath, title, description, tags, privacyStatus = 'unlisted') {
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      throw new Error(`Video file not found at: ${filePath}`);
    }

    // Upload to YouTube
    const res = await this.youtube.videos.insert({
      part: 'snippet,status',
      requestBody: {
        snippet: {
          title,
          description,
          tags,
          categoryId: '22' // People & Blogs category
        },
        status: {
          privacyStatus
        }
      },
      media: {
        body: fs.createReadStream(filePath)
      }
    });

    return {
      id: res.data.id,
      url: `https://www.youtube.com/watch?v=${res.data.id}`
    };
  }
}

module.exports = new YouTubeService();