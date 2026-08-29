
import { UserProfile, TranscriptionItem } from '../types';

/**
 * GOOGLE SHEETS LOGGING SERVICE
 * To enable logging:
 * 1. Create a Google Sheet and add an Apps Script (doPost function).
 * 2. Deploy it as a Web App (Access: Anyone).
 * 3. Paste the Deployment URL below.
 */
const SHEET_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycby3PdvDmwzPVajaZdI7xDXCAzPC74XWEOZ8xDY9JxxDPFvDSV64oTwz9Omvb74PNMgqgA/exec';

export const dbService = {
  /**
   * Sends user profile information to the Google Sheet.
   */
  async syncProfile(profile: UserProfile): Promise<boolean> {
    console.debug('[Sync] Saving profile for:', profile.name);
    
    if (!SHEET_SCRIPT_URL || SHEET_SCRIPT_URL.includes('YOUR_GOOGLE')) {
      return true; 
    }

    try {
      await fetch(SHEET_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors', // Bypasses CORS issues for simple hit-and-run logging
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'PROFILE',
          data: profile
        })
      });
      return true;
    } catch (e) {
      console.error('Sheet Sync Error:', e);
      return false;
    }
  },

  /**
   * Logs a chat interaction (User or Model) to the Google Sheet.
   */
  async logInteraction(userId: string, message: TranscriptionItem): Promise<void> {
    console.debug(`[Log] ${message.role}: ${message.text}`);

    if (!SHEET_SCRIPT_URL || SHEET_SCRIPT_URL.includes('YOUR_GOOGLE')) {
      return;
    }

    try {
      await fetch(SHEET_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'CHAT',
          data: {
            userId: userId,
            role: message.role,
            text: message.text
          }
        })
      });
    } catch (e) {
      console.error('Chat Logging Error:', e);
    }
  }
};
