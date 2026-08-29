
import type React from 'react';

export enum AppStatus {
  IDLE = 'IDLE',
  CONNECTING = 'CONNECTING',
  LISTENING = 'LISTENING',
  THINKING = 'THINKING',
  SPEAKING = 'SPEAKING',
  ERROR = 'ERROR'
}

export interface GroundingLink {
  uri: string;
  title: string;
}

export interface VisualContent {
  type: 'image' | 'map' | 'search' | 'info';
  title?: string;
  url?: string;
  content?: string;
  items?: { title: string; subtitle?: string; url?: string }[];
  groundingLinks?: GroundingLink[];
  isGenerating?: boolean;
}

export interface TranscriptionItem {
  text: string;
  role: 'user' | 'model';
  timestamp: number;
  visual?: VisualContent;
  imageData?: string; // Base64 image data for user messages
}

export interface UserProfile {
  name: string;
  mobile: string;
  village: string;
  state: string;
  location?: string; // Legacy field
  onboarded: boolean;
}

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'start-conversation-widget': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        'agent-id'?: string;
        'public-key'?: string;
        'participant-id'?: string;
        'metadata'?: string;
        'mode'?: string;
        'width'?: string | number;
        'height'?: string | number;
        'button-text'?: string;
        'title'?: string;
        'description'?: string;
        'button-background'?: string;
        'button-text-color'?: string;
        'border-radius'?: string;
        [key: string]: any;
      };
      'agent-widget': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        'agent-id'?: string;
        'public-key'?: string;
        'participant-id'?: string;
        'metadata'?: string;
        [key: string]: any;
      };
    }
  }
}
