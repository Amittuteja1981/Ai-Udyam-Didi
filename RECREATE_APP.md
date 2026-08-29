# Recreating Udyog Saheli (Udyami Saheli)

This document provides step-by-step instructions and all necessary code to recreate the **Udyog Saheli** application—a conversational AI assistant designed for rural women entrepreneurs.

## 1. Project Setup

### Prerequisites
- Node.js installed on your machine.
- A Google Gemini API Key (get one at [ai.google.dev](https://ai.google.dev/)).

### Initialize Project
Run the following commands in your terminal:

```bash
# Create a new Vite project with React and TypeScript
npm create vite@latest udyog-saheli -- --template react-ts

# Navigate into the project directory
cd udyog-saheli

# Install core dependencies
npm install @google/genai lucide-react motion react react-dom

# Install development dependencies
npm install -D tailwindcss @tailwindcss/vite @types/node typescript vite
```

## 2. Configuration

### Tailwind CSS Setup
Update your `vite.config.ts` to include the Tailwind plugin:

```typescript
// vite.config.ts
import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
```

Update `src/index.css` to import Tailwind:

```css
/* src/index.css */
@import "tailwindcss";

:root {
  font-family: Inter, system-ui, Avenir, Helvetica, Arial, sans-serif;
  line-height: 1.5;
  font-weight: 400;
}

body {
  margin: 0;
  display: flex;
  place-items: center;
  min-width: 320px;
  min-height: 100vh;
  background-color: #f9fafb;
}

.devanagari {
  font-family: 'Noto Sans Devanagari', sans-serif;
}

/* WhatsApp-like background for chat */
.whatsapp-bg {
  background-color: #e5ddd5;
  background-image: url("https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png");
  background-repeat: repeat;
}

.bubble-user {
  background-color: #dcf8c6;
}

.bubble-saheli {
  background-color: #ffffff;
}
```

Add the Google Font to `index.html`:

```html
<!-- index.html -->
<!DOCTYPE html>
<html lang="hi">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
    <title>Udyog Saheli</title>
    <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;700;900&family=Inter:wght@400;700;900&display=swap" rel="stylesheet">
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

## 3. Image Assets

The following image links are used in the application:

- **Saheli Illustration:** `https://image2url.com/r2/default/images/1769072984336-dcce0dca-5c10-4d48-aa6c-11e0ead8a24b.jpg`
- **Connecting Dreams Foundation Logo:** `https://image2url.com/r2/default/images/1769073801640-26f71cc6-deb8-4340-afee-ef36d5b8f9c9.png`

## 4. Source Code

Create the following files in your `src` directory:

### `src/types.ts`
```typescript
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
  imageData?: string;
}

export interface UserProfile {
  name: string;
  mobile: string;
  village: string;
  state: string;
  onboarded: boolean;
}
```

### `src/services/dbService.ts`
```typescript
import { UserProfile, TranscriptionItem } from '../types';

/**
 * GOOGLE SHEETS LOGGING SERVICE
 * To enable logging:
 * 1. Create a Google Sheet and add an Apps Script (doPost function).
 * 2. Deploy it as a Web App (Access: Anyone).
 * 3. Paste the Deployment URL below.
 */
const SHEET_SCRIPT_URL = ''; // Add your Google Apps Script URL here

export const dbService = {
  async syncProfile(profile: UserProfile): Promise<boolean> {
    if (!SHEET_SCRIPT_URL) return true;
    try {
      await fetch(SHEET_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'PROFILE', data: profile })
      });
      return true;
    } catch (e) {
      console.error('Sheet Sync Error:', e);
      return false;
    }
  },

  async logInteraction(userId: string, message: TranscriptionItem): Promise<void> {
    if (!SHEET_SCRIPT_URL) return;
    try {
      await fetch(SHEET_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'CHAT',
          data: { userId, role: message.role, text: message.text }
        })
      });
    } catch (e) {
      console.error('Chat Logging Error:', e);
    }
  }
};
```

### `src/App.tsx`
```typescript
import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, Modality, LiveServerMessage } from '@google/genai';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Mic, 
  X, 
  ArrowLeft, 
  LogOut, 
  Phone, 
  AlertTriangle, 
  Image as ImageIcon, 
  ChevronRight,
  Info,
  Search,
  MessageSquare
} from 'lucide-react';
import { AppStatus, TranscriptionItem, UserProfile, GroundingLink } from './types';
import { decode, decodeAudioData, createBlob } from './services/audioUtils';
import { dbService } from './services/dbService';
import VoicePulse from './components/VoicePulse';

// STABLE LOW COST VERSION: Forced Devanagari Script Enforcement
const BASE_SYSTEM_INSTRUCTION = `नाम: "उद्योग सहेली"। आप केवल और केवल देवनागरी हिंदी लिपि (Devanagari Hindi) जानते हैं। 
नियम: 
1. यूज़र चाहे किसी भी भाषा (उर्दू, पंजाबी, अंग्रेजी) या बोली में बोले, आपको उसे केवल और केवल देवनागरी हिंदी लिपि में ही लिखना (transcribe) है। उर्दू (Urdu script), पंजाबी (Gurmukhi), या रोमन (English script) का प्रयोग किसी भी स्थिति में न करें। 
2. हमेशा "दीदी" बोलें। उत्तर बहुत छोटे और सटीक दें। 
3. धैर्य से सुनें: जब यूज़र बोलना बंद करे, तो 1-2 सेकंड का मौन (pause) लें, फिर अपनी बात शुरू करें। 
4. आप केवल अपने विषय (Category) के विशेषज्ञ हैं। यदि यूज़र आपके विषय से बाहर का सवाल पूछे, तो उसे डैशबोर्ड पर वापस जाने को कहें। 
5. यदि सवाल किसी भी विषय में नहीं आता, तो उसे हेल्पलाइन नंबर +91-9911988233 पर फोन करने को कहें। 
6. Google Search सिर्फ बाज़ार भाव या सरकारी योजनाओं के लिए ही करें।`;

const TOPICS = [
  { 
    id: 'finance', 
    name: 'पैसा और बैंक', 
    desc: 'लोन और बचत का सही हिसाब', 
    icon: '💰', 
    greeting: 'नमस्ते दीदी! मैं आपकी बैंक और पैसों से जुड़ी सहेली हूँ। आप लोन या बचत के बारे में क्या जानना चाहती हैं?',
    persona: 'आप एक बैंक और वित्त विशेषज्ञ हैं। आप केवल लोन, बचत, ब्याज और सरकारी बैंक योजनाओं के बारे में बात करेंगे। अन्य किसी भी विषय के लिए यूज़र को डैशबोर्ड पर वापस जाने को कहें।'
  },
  { 
    id: 'packaging', 
    name: 'पैकेजिंग और सजावट', 
    desc: 'सामान को सुंदर बनाने के तरीके', 
    icon: '📦', 
    greeting: 'नमस्ते! सामान की पैकिंग सुंदर होगी तो बिक्री बढ़ेगी। मैं इसमें आपकी क्या मदद करूँ?',
    persona: 'आप एक पैकेजिंग और ब्रांडिंग विशेषज्ञ हैं। आप केवल लेबल डिजाइन, पैकिंग सामग्री, और उत्पाद की सजावट के बारे में बात करेंगे। अन्य किसी भी विषय के लिए यूज़र को डैशबोर्ड पर वापस जाने को कहें।'
  },
  { 
    id: 'marketing', 
    name: 'बिक्री और ग्राहक', 
    desc: 'ज़्यादा सामान बेचने के तरीके', 
    icon: '📢', 
    greeting: 'दीदी, ग्राहक भगवान का रूप हैं। बिक्री कैसे बढ़ानी है, इसके बारे में क्या पूछना है?',
    persona: 'आप एक मार्केटिंग और सेल्स विशेषज्ञ हैं। आप केवल ग्राहकों को आकर्षित करने, सोशल मीडिया पर बेचने, और बाज़ार की रणनीतियों के बारे में बात करेंगे। अन्य किसी भी विषय के लिए यूज़र को डैशबोर्ड पर वापस जाने को कहें।'
  },
  { 
    id: 'schemes', 
    name: 'सरकारी मदद', 
    desc: 'सरकारी योजनाओं की पूरी जानकारी', 
    icon: '🏛️', 
    greeting: 'सरकार हमारी बहुत मदद करती है। क्या आप किसी खास योजना के बारे में पूछना चाहती हैं?',
    persona: 'आप एक सरकारी योजना विशेषज्ञ हैं। आप केवल पीएमईजीपी, मुद्रा लोन, और महिला उद्यमियों के लिए सरकारी सब्सिडी के बारे में बात करेंगे। अन्य किसी भी विषय के लिए यूज़र को डैशबोर्ड पर वापस जाने को कहें।'
  },
  { 
    id: 'other', 
    name: 'कुछ और पूछें', 
    desc: 'कोई भी सवाल या सलाह', 
    icon: '💬', 
    greeting: 'जी दीदी, मैं हाज़िर हूँ। पूछिए, आज आप क्या सोच रही हैं?',
    persona: 'आप एक सामान्य बिज़नेस सलाहकार हैं। आप ग्रामीण बिज़नेस से जुड़े किसी भी सामान्य सवाल का जवाब देंगे। यदि सवाल बिज़नेस से बाहर का है, तो हेल्पलाइन पर फोन करने को कहें।'
  },
];

const SAHELI_IMAGE = "https://image2url.com/r2/default/images/1769072984336-dcce0dca-5c10-4d48-aa6c-11e0ead8a24b.jpg";
const CDF_LOGO = "https://image2url.com/r2/default/images/1769073801640-26f71cc6-deb8-4340-afee-ef36d5b8f9c9.png";
const HELPLINE_NUMBER = "+919911988233"; 
const DISPLAY_HELPLINE = "+91-9911988233";
const PROFILE_KEY = 'udyog_saheli_v10_persistence';
const CHAT_HISTORY_KEY = 'udyog_saheli_chat_history';

const INDIAN_STATES = [
  "आंध्र प्रदेश", "बिहार", "छत्तीसगढ़", "गुजरात", "हरियाणा", "झारखंड", 
  "मध्य प्रदेश", "महाराष्ट्र", "ओडिशा", "पंजाब", "राजस्थान", "उत्तर प्रदेश", "उत्तरखंड", "पश्चिम बंगाल"
];

const App: React.FC = () => {
  const [view, setView] = useState<'WELCOME' | 'ONBOARDING' | 'DASHBOARD' | 'CHAT'>('WELCOME');
  const [onboardingStep, setOnboardingStep] = useState(0); 
  const [userProfile, setUserProfile] = useState<UserProfile>({ 
    name: '', mobile: '', village: '', state: '', onboarded: false 
  });
  const [selectedTopic, setSelectedTopic] = useState<typeof TOPICS[0] | null>(null);
  const [status, setStatus] = useState<AppStatus>(AppStatus.IDLE);
  const [messages, setMessages] = useState<TranscriptionItem[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [showTimeoutWarning, setShowTimeoutWarning] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);

  const sessionRef = useRef<any>(null);
  const audioContextRef = useRef<{ input: AudioContext; output: AudioContext } | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const streamRef = useRef<MediaStream | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const micProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const currentOutputTranscription = useRef<string>('');
  const currentInputTranscription = useRef<string>('');
  const currentGroundingLinks = useRef<GroundingLink[]>([]);

  useEffect(() => {
    const checkApiKey = async () => {
      if (window.aistudio && typeof window.aistudio.hasSelectedApiKey === 'function') {
        const hasKey = await window.aistudio.hasSelectedApiKey();
        setHasApiKey(hasKey);
      } else {
        setHasApiKey(true);
      }
    };
    checkApiKey();

    const saved = localStorage.getItem(PROFILE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      setUserProfile(parsed);
      if (parsed.onboarded) setView('DASHBOARD');
    }

    const savedHistory = localStorage.getItem(CHAT_HISTORY_KEY);
    if (savedHistory) {
      setMessages(JSON.parse(savedHistory));
    }
  }, []);

  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(messages));
    }
  }, [messages]);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
    resetInactivityTimer();
  }, [messages, status]);

  const handleSelectKey = async () => {
    if (window.aistudio && typeof window.aistudio.openSelectKey === 'function') {
      await window.aistudio.openSelectKey();
      setHasApiKey(true);
    }
  };

  const resetInactivityTimer = () => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    setShowTimeoutWarning(false);
    
    if (status !== AppStatus.IDLE && status !== AppStatus.CONNECTING) {
      idleTimerRef.current = setTimeout(() => {
        if (status !== AppStatus.IDLE) {
          setShowTimeoutWarning(true);
          idleTimerRef.current = setTimeout(() => {
            closeSession();
          }, 15000);
        }
      }, 45000);
    }
  };

  const saveProfile = async (data: UserProfile) => {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(data));
    setUserProfile(data);
    await dbService.syncProfile(data);
  };

  const handleLogout = (e: React.MouseEvent) => {
    e.preventDefault();
    setShowLogoutConfirm(true);
  };

  const confirmLogout = () => {
    closeSession();
    localStorage.removeItem(PROFILE_KEY);
    localStorage.removeItem(CHAT_HISTORY_KEY);
    setUserProfile({ name: '', mobile: '', village: '', state: '', onboarded: false });
    setMessages([]);
    setOnboardingStep(0);
    setView('WELCOME');
    setShowLogoutConfirm(false);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      const base64Data = base64.split(',')[1];

      const userMsg: TranscriptionItem = { 
        text: "दीदी, मैंने एक फोटो भेजी है।", 
        role: 'user', 
        timestamp: Date.now(),
        imageData: base64
      };
      setMessages(prev => [...prev.slice(-15), userMsg]);

      try {
        const session = await initSession(`यूज़र ने एक फोटो भेजी है। विषय: ${selectedTopic?.name}`);
        session.sendRealtimeInput({
          media: {
            data: base64Data,
            mimeType: file.type
          }
        });
        setStatus(AppStatus.THINKING);
      } catch (err) {
        console.error("Image upload session error:", err);
      } finally {
        setIsUploading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const stopAudio = () => {
    sourcesRef.current.forEach(s => { try { s.stop(); s.disconnect(); } catch (e) {} });
    sourcesRef.current.clear();
    nextStartTimeRef.current = 0;
  };

  const stopRecordingInternal = () => {
    if (micProcessorRef.current) { micProcessorRef.current.disconnect(); micProcessorRef.current = null; }
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    setIsRecording(false);
    if (status === AppStatus.LISTENING) {
      setStatus(AppStatus.THINKING);
    }
  };

  const initSession = async (customInstruction?: string) => {
    if (sessionRef.current) return Promise.resolve(sessionRef.current);
    setStatus(AppStatus.CONNECTING);
    
    const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'undefined') {
      setStatus(AppStatus.ERROR);
      setHasApiKey(false);
      return;
    }

    const ai = new GoogleGenAI({ 
      apiKey,
      baseUrl: "https://generativelanguage.googleapis.com" 
    } as any);

    if (!audioContextRef.current) {
      audioContextRef.current = {
        input: new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 }),
        output: new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 })
      };
    }

    const dynamicInstruction = `${BASE_SYSTEM_INSTRUCTION}\nयूज़र: ${userProfile.name}, गाँव: ${userProfile.village}\nवर्तमान विषय: ${selectedTopic?.name}\nविशेषज्ञता: ${selectedTopic?.persona}\n${customInstruction || ""}`;

    const sessionPromise = ai.live.connect({
      model: 'gemini-2.5-flash-native-audio-preview-12-2025',
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
        systemInstruction: dynamicInstruction,
        outputAudioTranscription: {},
        inputAudioTranscription: {},
        tools: [{ googleSearch: {} }],
      },
      callbacks: {
        onopen: () => {
          setStatus(AppStatus.LISTENING);
          resetInactivityTimer();
        },
        onmessage: async (message: LiveServerMessage) => {
          resetInactivityTimer();
          
          if (message.serverContent?.modelTurn) {
            setStatus(AppStatus.SPEAKING);
          }

          const groundingMetadata = (message.serverContent as any)?.groundingMetadata;
          if (groundingMetadata?.groundingChunks) {
            groundingMetadata.groundingChunks.forEach((chunk: any) => {
              if (chunk.web) {
                currentGroundingLinks.current.push({
                  uri: chunk.web.uri,
                  title: chunk.web.title || 'स्त्रोत'
                });
              }
            });
          }

          if (message.serverContent?.inputTranscription) {
            currentInputTranscription.current += message.serverContent.inputTranscription.text;
          }

          if (message.serverContent?.outputTranscription) {
            currentOutputTranscription.current += message.serverContent.outputTranscription.text;
          }

          if (message.serverContent?.turnComplete) {
            const userText = currentInputTranscription.current.trim();
            if (userText && view === 'CHAT') {
              const userMsg: TranscriptionItem = { text: userText, role: 'user', timestamp: Date.now() };
              setMessages(prev => [...prev.slice(-20), userMsg]); 
              dbService.logInteraction(userProfile.mobile, userMsg);
            }

            const modelText = currentOutputTranscription.current.trim();
            if (modelText && view === 'CHAT') {
              const modelMsg: TranscriptionItem = { 
                text: modelText, 
                role: 'model', 
                timestamp: Date.now(),
                visual: currentGroundingLinks.current.length > 0 ? {
                  type: 'search',
                  groundingLinks: [...currentGroundingLinks.current]
                } : undefined
              };
              setMessages(prev => [...prev.slice(-20), modelMsg]); 
              dbService.logInteraction(userProfile.mobile, modelMsg);
            }
            
            currentOutputTranscription.current = '';
            currentInputTranscription.current = '';
            currentGroundingLinks.current = [];
          }

          const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
          if (base64Audio) {
            setStatus(AppStatus.SPEAKING);
            const ctx = audioContextRef.current!.output;
            const audioBuffer = await decodeAudioData(decode(base64Audio), ctx, 24000, 1);
            const source = ctx.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(ctx.destination);
            source.addEventListener('ended', () => { 
              sourcesRef.current.delete(source); 
              if (sourcesRef.current.size === 0) setStatus(AppStatus.LISTENING); 
            });
            const startTime = Math.max(nextStartTimeRef.current, ctx.currentTime + 0.05); 
            source.start(startTime);
            nextStartTimeRef.current = startTime + audioBuffer.duration;
            sourcesRef.current.add(source);
          }
          if (message.serverContent?.interrupted) stopAudio();
        },
        onerror: () => setStatus(AppStatus.ERROR),
        onclose: () => setStatus(AppStatus.IDLE)
      }
    });
    sessionRef.current = await sessionPromise;
    return sessionPromise;
  };

  const toggleRecording = async () => {
    if (!isRecording) {
      stopAudio();
      try {
        const sessionPromise = initSession(`विषय: ${selectedTopic?.name}`);
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;
        const source = audioContextRef.current!.input.createMediaStreamSource(stream);
        const scriptProcessor = audioContextRef.current!.input.createScriptProcessor(2048, 1, 1); 
        scriptProcessor.onaudioprocess = (e) => {
          const pcmBlob = createBlob(e.inputBuffer.getChannelData(0));
          sessionPromise.then((session) => {
            session.sendRealtimeInput({ media: pcmBlob });
          });
        };
        source.connect(scriptProcessor);
        scriptProcessor.connect(audioContextRef.current!.input.destination);
        micProcessorRef.current = scriptProcessor;
        setIsRecording(true);
        resetInactivityTimer();
      } catch (err) {
        setStatus(AppStatus.ERROR);
      }
    } else {
      stopRecordingInternal();
    }
  };

  const closeSession = () => {
    if (sessionRef.current) { try { sessionRef.current.close(); } catch(e) {} sessionRef.current = null; }
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    stopAudio();
    setStatus(AppStatus.IDLE);
    setIsRecording(false);
  };

  const renderOnboarding = () => {
    if (onboardingStep === 0) {
      return (
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          className="flex flex-col h-[100dvh] bg-white p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))]"
        >
          <div className="flex-1 flex flex-col justify-center space-y-8">
            <div className="flex flex-col items-center space-y-2">
              <div className="w-16 h-16 bg-[#128c7e]/10 rounded-full flex items-center justify-center">
                <Info className="w-8 h-8 text-[#128c7e]" />
              </div>
              <h2 className="text-2xl font-black devanagari text-slate-800">ज़रूरी बातें</h2>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-start space-x-4 p-4 rounded-2xl bg-gray-50 border border-gray-100 shadow-sm">
                <div className="text-2xl">🤖</div>
                <div className="flex-1">
                  <h4 className="font-bold devanagari text-slate-800 text-[15px]">एआई (AI) सहेली</h4>
                  <p className="devanagari text-[13px] text-gray-500 leading-snug">दीदी, मैं एक कंप्यूटर प्रोग्राम हूँ। मैं आपकी मदद की पूरी कोशिश करती हूँ, पर मैं इंसान नहीं हूँ।</p>
                </div>
              </div>
              <div className="flex items-start space-x-4 p-4 rounded-2xl bg-gray-50 border border-gray-100 shadow-sm">
                <div className="text-2xl">🔍</div>
                <div className="flex-1">
                  <h4 className="font-bold devanagari text-slate-800 text-[15px]">जानकारी की पुष्टि</h4>
                  <p className="devanagari text-[13px] text-gray-500 leading-snug">बड़ा बिज़नेस फैसला लेने से पहले विशेषज्ञों या बैंक वालों से जानकारी ज़रूर मिला लें।</p>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-8 space-y-4">
            <button onClick={() => setOnboardingStep(1)} className="w-full py-5 rounded-3xl bg-[#128c7e] text-white font-bold text-xl devanagari shadow-xl active:scale-95 transition-transform">
              जी दीदी, समझ गई
            </button>
          </div>
        </motion.div>
      );
    }

    return (
      <motion.div 
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
        className="flex flex-col h-[100dvh] bg-white p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] overflow-y-auto"
      >
        <h2 className="text-center font-bold devanagari text-xl mb-10 text-slate-800">अपनी जानकारी भरें</h2>
        <div className="space-y-5 flex-1">
          <input type="text" placeholder="आपका नाम" value={userProfile.name} onChange={e => setUserProfile({...userProfile, name: e.target.value})} className="w-full p-4 bg-gray-100 rounded-2xl border-2 border-gray-200 text-black devanagari font-bold outline-none focus:border-[#128c7e]" />
          <input type="tel" placeholder="मोबाइल नंबर" value={userProfile.mobile} onChange={e => setUserProfile({...userProfile, mobile: e.target.value})} className="w-full p-4 bg-gray-100 rounded-2xl border-2 border-gray-200 text-black devanagari font-bold outline-none focus:border-[#128c7e]" />
          <input type="text" placeholder="गाँव" value={userProfile.village} onChange={e => setUserProfile({...userProfile, village: e.target.value})} className="w-full p-4 bg-gray-100 rounded-2xl border-2 border-gray-200 text-black devanagari font-bold outline-none focus:border-[#128c7e]" />
          <select value={userProfile.state} onChange={e => setUserProfile({...userProfile, state: e.target.value})} className="w-full p-4 bg-gray-100 rounded-2xl border-2 border-gray-200 text-black devanagari font-bold outline-none focus:border-[#128c7e]">
            <option value="">राज्य चुनें</option>
            {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <button onClick={() => { saveProfile({...userProfile, onboarded: true}); setView('DASHBOARD'); }} disabled={!userProfile.name || !userProfile.mobile} className="w-full py-5 rounded-3xl bg-[#128c7e] text-white font-bold text-xl devanagari shadow-xl disabled:bg-gray-300 mt-6">शुरू करें</button>
      </motion.div>
    );
  };

  return (
    <div className="flex flex-col h-[100dvh] bg-white relative overflow-hidden">
      <AnimatePresence>
        {view === 'WELCOME' ? (
          <motion.div key="welcome" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col h-full items-center justify-between p-8 bg-gradient-to-b from-green-50 to-white text-center">
            <div className="flex-1 flex flex-col items-center justify-center space-y-6">
              <img src={SAHELI_IMAGE} alt="Saheli" className="w-64 h-64 object-contain rounded-3xl shadow-2xl animate-float" />
              <h1 className="text-4xl font-black text-green-900 devanagari">उद्योग सहेली</h1>
              <p className="text-lg text-green-700 font-bold devanagari">ग्रामीण उद्यमियों की डिजिटल साथी</p>
            </div>
            <button onClick={() => setView(userProfile.onboarded ? 'DASHBOARD' : 'ONBOARDING')} className="w-full max-w-xs bg-[#128c7e] text-white py-5 rounded-3xl font-bold text-xl devanagari shadow-xl">नमस्ते, शुरू करें</button>
          </motion.div>
        ) : view === 'ONBOARDING' ? (
          renderOnboarding()
        ) : view === 'DASHBOARD' ? (
          <motion.div key="dashboard" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col h-full bg-white">
            <header className="bg-[#128c7e] text-white px-4 py-5 flex justify-between items-center shadow-lg">
              <div className="flex items-center space-x-3">
                <img src={SAHELI_IMAGE} className="w-10 h-10 rounded-full" alt="Saheli" />
                <h1 className="text-lg font-bold devanagari">नमस्ते, {userProfile.name}</h1>
              </div>
              <button onClick={handleLogout} className="bg-red-500 px-4 py-2 rounded-xl text-xs font-bold devanagari">लॉगआउट</button>
            </header>
            <main className="flex-1 overflow-y-auto p-5 space-y-4">
              {TOPICS.map((topic) => (
                <button key={topic.id} onClick={() => { setSelectedTopic(topic); setView('CHAT'); setMessages([{ text: topic.greeting, role: 'model', timestamp: Date.now() }]); }} className="w-full flex items-center p-5 bg-white border border-gray-100 rounded-3xl shadow-sm active:bg-gray-50">
                  <div className="text-3xl">{topic.icon}</div>
                  <div className="ml-5 text-left">
                    <h4 className="font-bold text-lg devanagari">{topic.name}</h4>
                    <p className="text-sm text-gray-400 devanagari">{topic.desc}</p>
                  </div>
                </button>
              ))}
            </main>
          </motion.div>
        ) : (
          <motion.div key="chat" initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} className="flex flex-col h-full whatsapp-bg">
            <header className="bg-[#128c7e] text-white px-4 py-3 flex items-center shadow-lg">
              <button onClick={() => { closeSession(); setView('DASHBOARD'); }} className="p-2 mr-2"><ArrowLeft /></button>
              <img src={SAHELI_IMAGE} className="w-10 h-10 rounded-full mr-3" alt="Saheli" />
              <h1 className="text-lg font-bold devanagari">{selectedTopic?.name}</h1>
            </header>
            <main className="flex-1 overflow-y-auto p-4 space-y-4 pb-48">
              {messages.map((m, i) => (
                <div key={i} className={`flex w-full ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] p-4 rounded-2xl shadow-sm ${m.role === 'user' ? 'bubble-user' : 'bubble-saheli'}`}>
                    {m.imageData && <img src={m.imageData} className="w-full rounded-xl mb-2" />}
                    <p className="devanagari text-lg">{m.text}</p>
                    {m.visual?.groundingLinks?.map((l, idx) => (
                      <a key={idx} href={l.uri} target="_blank" className="block text-xs text-blue-600 underline mt-1">{l.title}</a>
                    ))}
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </main>
            <footer className="bg-white p-6 absolute bottom-0 w-full flex flex-col items-center border-t">
              <div className="flex items-center space-x-6">
                <button onClick={() => fileInputRef.current?.click()} className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center"><ImageIcon /></button>
                <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" className="hidden" />
                <div className="relative">
                  <VoicePulse isActive={isRecording} color="bg-red-500" />
                  <div onMouseDown={toggleRecording} onMouseUp={stopRecordingInternal} className={`w-16 h-16 rounded-full flex items-center justify-center shadow-xl ${isRecording ? 'bg-red-500' : 'bg-[#128c7e]'}`}>
                    <Mic className="text-white" />
                  </div>
                </div>
              </div>
              <p className="devanagari text-xs text-gray-400 mt-2">{isRecording ? 'सहेली सुन रही है...' : 'बोलने के लिए दबाएं'}</p>
            </footer>
          </motion.div>
        )}
      </AnimatePresence>
      {status === AppStatus.CONNECTING && <div className="absolute inset-0 bg-white/90 flex items-center justify-center"><p className="devanagari font-bold">सहेली आ रही है...</p></div>}
      <style>{`
        @keyframes float { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-15px); } }
        .animate-float { animation: float 6s ease-in-out infinite; }
      `}</style>
    </div>
  );
};

export default App;
```


## 5. Environment Variables

Create a `.env` file in the root of your project:

```env
GEMINI_API_KEY=your_actual_api_key_here
```

## 6. Running the App

Start the development server:

```bash
npm run dev
```

The app will be available at `http://localhost:3000`.

## 7. Key Features to Note
- **Devanagari Enforcement:** The system instruction forces the AI to only use Hindi script.
- **Cost Saving:** The app includes an idle timeout (60s) to disconnect the Gemini Live session when not in use.
- **Multimodal:** Users can upload images for the AI to analyze.
- **Grounding:** Uses Google Search grounding for real-time information like market rates.
