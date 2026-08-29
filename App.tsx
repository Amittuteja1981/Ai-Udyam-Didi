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
// This instruction tells the model to treat Devanagari as the only valid script for STT and TTS.
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

declare global {
  interface Window {
    aistudio: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

const SAHELI_IMAGE = "https://image2url.com/r2/default/images/1769072984336-dcce0dca-5c10-4d48-aa6c-11e0ead8a24b.jpg";
const CDF_LOGO = "https://image2url.com/r2/default/images/1769073801640-26f71cc6-deb8-4340-afee-ef36d5b8f9c9.png";
const HELPLINE_NUMBER = "+919911988233"; 
const DISPLAY_HELPLINE = "+91-9911988233";
const SAMORA_AGENT_ID = "075175a3-af50-4349-be71-c248fbaa92e9";
const SAMORA_PUBLIC_KEY = "org_sec_f69d5b0d-fc59-4629-9ea8-1e3375901775";
const PROFILE_KEY = 'udyog_saheli_v10_persistence';
const CHAT_HISTORY_KEY = 'udyog_saheli_chat_history';
const IDLE_TIMEOUT_MS = 60000; // 60 seconds to auto-disconnect for cost saving

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
      // Stage 1: Warning after 45 seconds
      idleTimerRef.current = setTimeout(() => {
        if ((status as AppStatus) !== AppStatus.IDLE) {
          setShowTimeoutWarning(true);
          // Stage 2: Final disconnect after 15 more seconds (total 60s)
          idleTimerRef.current = setTimeout(() => {
            console.debug('Session timed out for cost control.');
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
      console.error("API Key is missing or undefined");
      setStatus(AppStatus.ERROR);
      setHasApiKey(false);
      return;
    }

    console.log("Initializing Gemini Live session...");
    const ai = new GoogleGenAI({ 
      apiKey,
      baseUrl: "https://generativelanguage.googleapis.com" 
    } as any);

    if (!audioContextRef.current) {
      audioContextRef.current = {
        input: new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 }),
        output: new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 })
      };
    } else {
      // Ensure contexts are resumed
      if (audioContextRef.current.input.state === 'suspended') audioContextRef.current.input.resume();
      if (audioContextRef.current.output.state === 'suspended') audioContextRef.current.output.resume();
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
        if (audioContextRef.current) {
          if (audioContextRef.current.input.state === 'suspended') await audioContextRef.current.input.resume();
          if (audioContextRef.current.output.state === 'suspended') await audioContextRef.current.output.resume();
        }
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

              <div className="flex items-start space-x-4 p-4 rounded-2xl bg-gray-50 border border-gray-100 shadow-sm">
                <div className="text-2xl">🔒</div>
                <div className="flex-1">
                  <h4 className="font-bold devanagari text-slate-800 text-[15px]">आपकी प्राइवेसी</h4>
                  <p className="devanagari text-[13px] text-gray-500 leading-snug">आपकी जानकारी आपके फोन तक ही सीमित है। हम इसे कहीं और नहीं भेज रहे हैं।</p>
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
          <div className="space-y-1">
             <label className="devanagari text-xs font-bold text-[#128c7e] ml-2">नाम</label>
             <input 
               type="text" 
               placeholder="आपका नाम" 
               value={userProfile.name} 
               onChange={e => setUserProfile({...userProfile, name: e.target.value})} 
               className="w-full p-4 bg-gray-100 rounded-2xl border-2 border-gray-200 text-black devanagari font-bold outline-none focus:border-[#128c7e] placeholder-gray-400" 
             />
          </div>
          <div className="space-y-1">
             <label className="devanagari text-xs font-bold text-[#128c7e] ml-2">मोबाइल नंबर</label>
             <input 
               type="tel" 
               placeholder="10 अंकों का नंबर" 
               value={userProfile.mobile} 
               onChange={e => setUserProfile({...userProfile, mobile: e.target.value})} 
               className="w-full p-4 bg-gray-100 rounded-2xl border-2 border-gray-200 text-black devanagari font-bold outline-none focus:border-[#128c7e] placeholder-gray-400" 
             />
          </div>
          <div className="space-y-1">
             <label className="devanagari text-xs font-bold text-[#128c7e] ml-2">गाँव</label>
             <input 
               type="text" 
               placeholder="गाँव का नाम" 
               value={userProfile.village} 
               onChange={e => setUserProfile({...userProfile, village: e.target.value})} 
               className="w-full p-4 bg-gray-100 rounded-2xl border-2 border-gray-200 text-black devanagari font-bold outline-none focus:border-[#128c7e] placeholder-gray-400" 
             />
          </div>
          <div className="space-y-1">
             <label className="devanagari text-xs font-bold text-[#128c7e] ml-2">राज्य</label>
             <select 
               value={userProfile.state} 
               onChange={e => setUserProfile({...userProfile, state: e.target.value})} 
               className="w-full p-4 bg-gray-100 rounded-2xl border-2 border-gray-200 text-black devanagari font-bold outline-none focus:border-[#128c7e]"
             >
                <option value="">राज्य चुनें</option>
                {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
             </select>
          </div>
        </div>
        <button 
          onClick={() => { saveProfile({...userProfile, onboarded: true}); setView('DASHBOARD'); }} 
          disabled={!userProfile.name || !userProfile.mobile} 
          className="w-full py-5 rounded-3xl bg-[#128c7e] text-white font-bold text-xl devanagari shadow-xl disabled:bg-gray-300 mt-6 active:scale-95 transition-transform"
        >
          शुरू करें
        </button>
      </motion.div>
    );
  };

  return (
    <div className="flex flex-col h-[100dvh] bg-white relative overflow-hidden">
      <AnimatePresence>
        {hasApiKey === false && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-white z-[200] flex flex-col items-center justify-center p-8 text-center space-y-8"
          >
            <div className="w-24 h-24 bg-green-50 rounded-full flex items-center justify-center">
              <Mic className="w-12 h-12 text-[#128c7e]" />
            </div>
            <div className="space-y-4">
              <h2 className="text-3xl font-black devanagari text-slate-800">नमस्ते दीदी!</h2>
              <p className="text-lg devanagari text-gray-500 leading-relaxed">
                सहेली से बात करने के लिए आपको अपना "API Key" चुनना होगा। यह एक बार की प्रक्रिया है।
              </p>
              <p className="text-xs text-blue-600 underline">
                <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer">
                  बिलिंग और की (Key) के बारे में जानें
                </a>
              </p>
            </div>
            <button 
              onClick={handleSelectKey}
              className="w-full max-w-xs py-5 bg-[#128c7e] text-white rounded-3xl font-bold text-xl devanagari shadow-xl active:scale-95 transition-transform"
            >
              API Key चुनें
            </button>
          </motion.div>
        )}

        {showLogoutConfirm && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm z-[150] flex items-center justify-center p-6"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-white rounded-3xl p-8 w-full max-w-xs text-center space-y-6 shadow-2xl"
            >
              <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto">
                <LogOut className="w-10 h-10 text-red-500" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-black devanagari text-slate-800">लॉगआउट करें?</h3>
                <p className="text-sm devanagari text-gray-500 leading-relaxed">क्या आप वाकई अपनी सहेली से विदा लेना चाहती हैं?</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={() => setShowLogoutConfirm(false)}
                  className="py-4 bg-gray-100 text-gray-600 rounded-2xl font-bold devanagari active:scale-95 transition-transform"
                >
                  नहीं
                </button>
                <button 
                  onClick={confirmLogout}
                  className="py-4 bg-red-500 text-white rounded-2xl font-bold devanagari shadow-lg active:scale-95 transition-transform"
                >
                  हाँ, विदा
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {showTimeoutWarning && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-6"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-white rounded-3xl p-8 w-full max-w-xs text-center space-y-6 shadow-2xl"
            >
              <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto">
                <AlertTriangle className="w-10 h-10 text-amber-600" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-black devanagari text-slate-800">दीदी, क्या आप यहाँ हैं?</h3>
                <p className="text-sm devanagari text-gray-500 leading-relaxed">काफी देर से कोई बात नहीं हुई। क्या आप अभी भी बात करना चाहती हैं?</p>
              </div>
              <button 
                onClick={() => resetInactivityTimer()}
                className="w-full py-4 bg-[#128c7e] text-white rounded-2xl font-bold devanagari shadow-lg active:scale-95 transition-transform"
              >
                हाँ, सहेली!
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {view === 'WELCOME' ? (
          <motion.div 
            key="welcome"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col h-full items-center justify-between p-8 pb-[calc(2rem+env(safe-area-inset-bottom))] bg-gradient-to-b from-green-50 to-white text-center"
          >
            <div className="flex-1 flex flex-col items-center justify-center space-y-6">
              <motion.img 
                animate={{ y: [0, -15, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                src={SAHELI_IMAGE} 
                alt="Saheli Logo" 
                className="w-64 h-64 object-contain rounded-3xl shadow-2xl" 
              />
              <h1 className="text-4xl font-black text-green-900 devanagari">उद्योग सहेली</h1>
              <p className="text-lg text-green-700 font-bold devanagari">ग्रामीण उद्यमियों की डिजिटल साथी</p>
            </div>
            <div className="w-full flex flex-col items-center space-y-8">
              <button onClick={() => setView(userProfile.onboarded ? 'DASHBOARD' : 'ONBOARDING')} className="w-full max-w-xs bg-[#128c7e] text-white py-5 rounded-3xl font-bold text-xl devanagari shadow-xl active:scale-95 transition-transform">नमस्ते, शुरू करें</button>
              <div className="flex flex-col items-center space-y-2">
                <img src={CDF_LOGO} alt="CDF Logo" className="h-12 object-contain filter drop-shadow-lg" />
                <p className="text-[10px] text-green-800 devanagari font-black">Connecting Dreams Foundation</p>
              </div>
            </div>
          </motion.div>
        ) : view === 'ONBOARDING' ? (
          renderOnboarding()
        ) : view === 'DASHBOARD' ? (
          <motion.div 
            key="dashboard"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            className="flex flex-col h-full bg-white"
          >
            <header className="bg-[#128c7e] text-white px-4 py-5 flex flex-col shadow-lg z-20 pt-[calc(1.25rem+env(safe-area-inset-top))]">
              <div className="flex justify-between items-center">
                <div className="flex items-center space-x-3">
                  <img src={SAHELI_IMAGE} className="w-10 h-10 rounded-full border border-white/20" alt="Saheli" />
                  <h1 className="text-lg font-bold devanagari">नमस्ते, {userProfile.name}</h1>
                </div>
                <div className="flex items-center space-x-2">
                  <button onClick={handleLogout} className="bg-red-500/80 px-4 py-2 rounded-xl text-[10px] font-bold devanagari text-white shadow-sm active:bg-red-600 transition-colors flex items-center space-x-1">
                    <LogOut className="w-3 h-3" />
                    <span>लॉगआउट</span>
                  </button>
                </div>
              </div>
            </header>
            <main className="flex-1 overflow-y-auto bg-gray-50/20 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
              <div className="p-5 bg-green-50/40 border-b border-gray-100 flex items-center space-x-3">
                  <div className="w-10 h-10 bg-[#128c7e] rounded-xl flex items-center justify-center text-white text-xl font-black shadow-md">स</div>
                  <div><h3 className="font-bold devanagari text-green-900">सहेली सलाहकार</h3><p className="text-[9px] text-green-700 font-bold uppercase tracking-widest">Digital Partner</p></div>
              </div>

              {/* Beneficiary Profile Summary */}
              <div className="mx-4 mt-3 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-50 text-[#128c7e] font-bold flex items-center justify-center text-base">
                    👤
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-gray-800 devanagari">{userProfile.name}</h4>
                    <p className="text-xs text-gray-400 devanagari">
                      {[userProfile.village, userProfile.state].filter(Boolean).join(', ')}
                    </p>
                  </div>
                </div>
                {userProfile.mobile && (
                  <span className="text-xs font-mono text-gray-500 bg-gray-50 px-2.5 py-1 rounded-lg border border-gray-100">
                    {userProfile.mobile}
                  </span>
                )}
              </div>

              {/* Samora Talk to Asha Voice Call Widget */}
              <div id="asha-call-card" className="mx-4 mt-4 mb-4 p-5 bg-gradient-to-br from-emerald-600 via-[#128c7e] to-[#075e54] text-white rounded-3xl shadow-lg border border-emerald-400/30 flex flex-col space-y-4">
                <div className="flex items-center space-x-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white text-2xl shadow-inner shrink-0">
                    🎙️
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-lg devanagari text-white leading-tight">आशा दीदी से बात करें</h3>
                    <p className="text-xs text-emerald-100 devanagari opacity-95">आवाज़ द्वारा लाइव बातचीत शुरू करें</p>
                  </div>
                </div>

                <div className="w-full pt-1">
                  <start-conversation-widget
                    agent-id={SAMORA_AGENT_ID}
                    public-key={SAMORA_PUBLIC_KEY}
                    participant-id={userProfile.mobile ? `cdf-${userProfile.mobile}` : `cdf-guest-${userProfile.name || 'beneficiary'}`}
                    metadata={JSON.stringify({
                      beneficiary_name: userProfile.name || "दीदी",
                      district: userProfile.village || "",
                      state: userProfile.state || "",
                      language: "hindi"
                    })}
                    mode="inline"
                    width="100%"
                    height="54"
                    button-text="आशा दीदी से बात करें (Talk to Asha)"
                    title="आशा दीदी (Talk to Asha)"
                    description="आशा दीदी से लाइव आवाज़ में सलाह लें"
                  ></start-conversation-widget>
                </div>
              </div>
              
              <div className="mx-4 p-6 bg-[#128c7e]/5 rounded-3xl border border-[#128c7e]/10 flex flex-col items-center space-y-3 text-center">
                <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm">
                  <Phone className="w-5 h-5 text-[#128c7e]" />
                </div>
                <p className="devanagari text-[13px] text-gray-500 font-bold">मदद या सुझाव के लिए यहाँ फोन करें:</p>
                <a href={`tel:${HELPLINE_NUMBER}`} className="devanagari font-black text-[#128c7e] text-2xl hover:underline transition-all active:scale-95">
                  {DISPLAY_HELPLINE}
                </a>
              </div>

              <div className="mt-6 mx-4 p-4 bg-amber-50 rounded-2xl border border-amber-100 flex items-start space-x-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-800 font-bold devanagari leading-relaxed">
                  सावधानी: उद्योग सहेली एक एआई (AI) है। महत्वपूर्ण व्यावसायिक निर्णय लेने से पहले जानकारी की पुष्टि अवश्य करें।
                </p>
              </div>
              <div className="mt-8 flex flex-col items-center py-6">
                <img src={CDF_LOGO} className="h-10 opacity-60 mb-1" alt="CDF" />
                <p className="text-[10px] text-green-800 devanagari font-black">Connecting Dreams Foundation</p>
              </div>
            </main>
          </motion.div>
        ) : (
          <motion.div 
            key="chat"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 50 }}
            className="flex flex-col h-full whatsapp-bg"
          >
            <header className="bg-[#128c7e] text-white px-4 py-3 flex items-center shadow-lg z-20 pt-[calc(0.75rem+env(safe-area-inset-top))]">
              <button onClick={() => { closeSession(); setView('DASHBOARD'); }} className="p-2 mr-1 active:bg-white/10 rounded-full transition-colors">
                <ArrowLeft className="w-6 h-6" />
              </button>
              <img src={SAHELI_IMAGE} className="w-10 h-10 rounded-full mr-3" alt="Saheli" />
              <div className="flex-1">
                <h1 className="text-[17px] font-bold devanagari leading-tight">{selectedTopic?.name}</h1>
                <p className="text-[10px] text-green-100 devanagari opacity-80">विशेषज्ञ सहेली</p>
              </div>
              <button onClick={() => setMessages([])} className="p-2 text-white/60 hover:text-white transition-colors">
                <MessageSquare className="w-5 h-5" />
              </button>
            </header>
            <main className="flex-1 overflow-y-auto p-4 space-y-4 pb-48">
              {messages.map((m, i) => (
                <motion.div 
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  key={i} 
                  className={`flex w-full ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[85%] p-4 rounded-2xl shadow-sm ${m.role === 'user' ? 'bubble-user rounded-tr-none' : 'bubble-saheli rounded-tl-none'}`}>
                    {m.imageData && (
                      <img src={m.imageData} alt="Uploaded" className="w-full h-48 object-cover rounded-xl mb-3 border border-black/5" />
                    )}
                    <p className="devanagari text-[17px] leading-[1.6] text-slate-800">{m.text}</p>
                    {m.visual?.groundingLinks && (
                      <div className="mt-3 pt-2 border-t border-gray-100">
                        <p className="text-[11px] font-bold text-gray-500 mb-2 flex items-center">
                          <Search className="w-3 h-3 mr-1" />
                          <span>स्त्रोत:</span>
                        </p>
                        <div className="space-y-1">
                          {m.visual.groundingLinks.map((link, idx) => (
                            <a key={idx} href={link.uri} target="_blank" rel="noopener noreferrer" className="block text-xs text-[#128c7e] underline truncate">
                              {link.title}
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                    <p className="text-[9px] text-gray-400 mt-2 text-right">
                      {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </motion.div>
              ))}
              <div ref={chatEndRef} />
            </main>
            
            <footer className="bg-white/90 backdrop-blur-sm p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] flex flex-col items-center justify-center space-y-4 border-t border-gray-200 z-30 absolute bottom-0 left-0 right-0">
              <div className="flex items-center space-x-6">
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 active:scale-90 transition-transform disabled:opacity-50"
                >
                  {isUploading ? (
                    <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <ImageIcon className="w-6 h-6" />
                  )}
                </button>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleImageUpload} 
                  accept="image/*" 
                  className="hidden" 
                />

                <div className="relative">
                  <VoicePulse isActive={status === AppStatus.SPEAKING || status === AppStatus.LISTENING || isRecording} color={isRecording ? 'bg-red-500' : 'bg-[#128c7e]'} />
                  <div 
                    onMouseDown={() => toggleRecording()} 
                    onMouseUp={() => stopRecordingInternal()} 
                    onTouchStart={() => toggleRecording()} 
                    onTouchEnd={() => stopRecordingInternal()}
                    className={`absolute inset-0 w-16 h-16 m-auto rounded-full flex items-center justify-center shadow-xl transition-all active:scale-90 touch-none select-none cursor-pointer z-20 ${isRecording ? 'bg-red-500' : 'bg-[#128c7e] hover:bg-[#075e54]'}`}>
                    <Mic className="h-8 w-8 text-white" />
                  </div>
                </div>

                <div className="w-12 h-12" /> {/* Spacer for symmetry */}
              </div>

              <div className="flex flex-col items-center">
                <p className="devanagari text-xs text-gray-400 font-bold tracking-wide">
                  {status === AppStatus.THINKING ? 'सहेली सोच रही है...' : 
                   status === AppStatus.SPEAKING ? 'सहेली बोल रही है...' :
                   isRecording ? 'सहेली सुन रही है...' : 'बोलने के लिए दबाएं'}
                </p>
              </div>
            </footer>
          </motion.div>
        )}
      </AnimatePresence>
      {status === AppStatus.CONNECTING && (
        <div className="absolute inset-0 bg-white/95 z-50 flex flex-col items-center justify-center space-y-4">
          <div className="w-12 h-12 border-4 border-[#128c7e] border-t-transparent rounded-full animate-spin"></div>
          <p className="devanagari text-[#128c7e] font-bold">सहेली आ रही है...</p>
        </div>
      )}
      {status === AppStatus.ERROR && (
        <div className="absolute inset-0 bg-white/95 z-50 flex flex-col items-center justify-center p-8 text-center space-y-6">
          <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center">
            <AlertTriangle className="w-10 h-10 text-red-500" />
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-black devanagari text-slate-800">ओह! कुछ गलत हो गया</h3>
            <p className="text-sm devanagari text-gray-500 leading-relaxed">सहेली से संपर्क नहीं हो पा रहा है। कृपया इंटरनेट चेक करें या फिर से कोशिश करें।</p>
          </div>
          <button 
            onClick={() => { closeSession(); setStatus(AppStatus.IDLE); }}
            className="w-full max-w-xs py-4 bg-[#128c7e] text-white rounded-2xl font-bold devanagari shadow-lg active:scale-95 transition-transform"
          >
            फिर से कोशिश करें
          </button>
        </div>
      )}
      <style>{`
        @keyframes fade-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fade-in 0.3s ease-out forwards; }
        @keyframes float { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-15px); } }
        .animate-float { animation: float 6s ease-in-out infinite; }
      `}</style>
    </div>
  );
};

export default App;