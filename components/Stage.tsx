
import React, { useState, useEffect, useRef } from 'react';
import { SessionConfig } from '../types';
import { VirtualAudience } from './VirtualAudience';
import { Mic, Square, Loader2, Plus, SkipForward, X, AlertTriangle } from 'lucide-react';

interface Props {
  config: SessionConfig;
  onFinish: (blob: Blob, duration: number, transcript: string) => void;
  onBack: () => void;
}

type StageState = 'PREP' | 'COUNTDOWN' | 'STARTING' | 'RECORDING' | 'FINISHED' | 'ERROR';

export const Stage: React.FC<Props> = ({ config, onFinish, onBack }) => {
  const [stageState, setStageState] = useState<StageState>(config.prepTimeSeconds > 0 ? 'PREP' : 'COUNTDOWN');
  const [prepTimeLeft, setPrepTimeLeft] = useState(config.prepTimeSeconds);
  const [countDown, setCountDown] = useState(5);
  const [timeLeft, setTimeLeft] = useState(config.durationSeconds);
  const [isReady, setIsReady] = useState(false);
  const [volume, setVolume] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const startTimeRef = useRef<number>(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  // Web Speech API — transcribes live in the browser. Self-restarts on silence.
  const recognitionRef = useRef<any>(null);
  const transcriptRef = useRef<string>('');
  const isRecordingRef = useRef<boolean>(false);
  const [liveTranscript, setLiveTranscript] = useState<string>('');

  // Prep Timer
  useEffect(() => {
    let interval: any;
    if (stageState === 'PREP' && prepTimeLeft > 0) {
      interval = setInterval(() => setPrepTimeLeft((prev) => prev - 1), 1000);
    } else if (stageState === 'PREP' && prepTimeLeft <= 0) {
      setStageState('COUNTDOWN');
    }
    return () => clearInterval(interval);
  }, [stageState, prepTimeLeft]);

  // Countdown Timer
  useEffect(() => {
    let interval: any;
    if (stageState === 'COUNTDOWN' && countDown > 0) {
      interval = setInterval(() => setCountDown((prev) => prev - 1), 1000);
    } else if (stageState === 'COUNTDOWN' && countDown <= 0) {
      setStageState('STARTING');
    }
    return () => clearInterval(interval);
  }, [stageState, countDown]);

  // Auto-start recording
  useEffect(() => {
    if (stageState === 'STARTING' && isReady) {
        // Small delay to ensure browser hardware state is settled
        const timer = setTimeout(() => {
            startRecording();
        }, 300);
        return () => clearTimeout(timer);
    }
  }, [stageState, isReady]);

  // Recording Timer
  useEffect(() => {
    let interval: any;
    if (stageState === 'RECORDING' && timeLeft > 0) {
      interval = setInterval(() => setTimeLeft((prev) => Math.max(0, prev - 1)), 1000);
    } else if (stageState === 'RECORDING' && timeLeft <= 0) {
      stopRecording();
    }
    return () => clearInterval(interval);
  }, [stageState, timeLeft]);

  const getSupportedMimeType = () => {
    // Since we now only record audio, we focus on audio containers
    const types = [
      'audio/webm;codecs=opus', 
      'audio/webm', 
      'audio/ogg;codecs=opus', 
      'audio/mp4', 
      'audio/aac'
    ];
    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) return type;
    }
    return '';
  };

  useEffect(() => {
    let isMounted = true;
    const setupStream = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          },
          video: false
        });
        
        if (!isMounted) {
          stream.getTracks().forEach(track => track.stop());
          return;
        }
        streamRef.current = stream;
        
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        audioContextRef.current = audioContext;
        const source = audioContext.createMediaStreamSource(stream);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        analyserRef.current = analyser;
        source.connect(analyser);

        const updateVolume = () => {
          if (!analyserRef.current) return;
          const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
          analyserRef.current.getByteFrequencyData(dataArray);
          let sum = 0;
          for(let i = 0; i < dataArray.length; i++) sum += dataArray[i];
          setVolume(Math.min(100, (sum / dataArray.length) * 2.5)); 
          animationFrameRef.current = requestAnimationFrame(updateVolume);
        };
        updateVolume();

        setIsReady(true);
      } catch (err: any) {
        console.error("Stream setup failed:", err);
        if (isMounted) {
          setErrorMsg(err.message || "Microphone access is required to start the session.");
          setStageState('ERROR');
        }
      }
    };

    setupStream();
    return () => {
      isMounted = false;
      if (streamRef.current) streamRef.current.getTracks().forEach(track => track.stop());
      if (audioContextRef.current) audioContextRef.current.close();
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, []);

  const startSpeechRecognition = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    transcriptRef.current = '';
    setLiveTranscript('');
    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    let langTag = 'en-US';
    const lang = (config.language || 'English').toLowerCase();
    if (lang.includes('cantonese')) langTag = 'yue-Hant-HK';
    else if (lang.includes('mandarin') || lang.includes('chinese')) langTag = 'zh-CN';
    else if (lang.includes('spanish')) langTag = 'es-ES';
    else if (lang.includes('french')) langTag = 'fr-FR';
    recognition.lang = langTag;
    recognition.onresult = (event: any) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const chunk = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          transcriptRef.current += (transcriptRef.current ? ' ' : '') + chunk.trim();
        } else {
          interim += chunk;
        }
      }
      setLiveTranscript((transcriptRef.current + ' ' + interim).trim());
    };
    recognition.onerror = (e: any) => console.warn('SpeechRecognition error:', e?.error);
    recognition.onend = () => {
      if (isRecordingRef.current) {
        try { recognition.start(); } catch {}
      }
    };
    try { recognition.start(); recognitionRef.current = recognition; } catch (e) { console.warn(e); }
  };

  const stopSpeechRecognition = () => {
    if (recognitionRef.current) {
      recognitionRef.current.onend = null;
      try { recognitionRef.current.stop(); } catch {}
    }
    recognitionRef.current = null;
  };

  const startRecording = () => {
    if (!streamRef.current || !isReady) return;
    
    try {
      // Create a NEW stream with ONLY audio tracks for the recorder
      const audioTracks = streamRef.current.getAudioTracks();
      if (audioTracks.length === 0) {
        throw new Error("No audio tracks found in stream.");
      }
      
      const recordingStream = new MediaStream(audioTracks);
      const mimeType = getSupportedMimeType();
      
      let recorder: MediaRecorder;
      try {
        recorder = new MediaRecorder(recordingStream, mimeType ? { mimeType } : undefined);
      } catch (e) {
        console.warn("Failed to init with mimeType, falling back to default", e);
        recorder = new MediaRecorder(recordingStream);
      }
      
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        stopSpeechRecognition();
        const finalBlob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        const finalDuration = (Date.now() - startTimeRef.current) / 1000;
        onFinish(finalBlob, Math.max(finalDuration, 0.5), transcriptRef.current);
      };

      chunksRef.current = [];
      startTimeRef.current = Date.now();

      recorder.start(500);
      mediaRecorderRef.current = recorder;
      isRecordingRef.current = true;
      startSpeechRecognition();
      setStageState('RECORDING');
    } catch (err: any) {
      console.error("Critical: Failed to start MediaRecorder:", err);
      setErrorMsg(`Recording Error: ${err.message || "Could not initialize audio capture. Please refresh and check permissions."}`);
      setStageState('ERROR');
    }
  };

  const stopRecording = () => {
    isRecordingRef.current = false;
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      try {
        mediaRecorderRef.current.stop();
        setStageState('FINISHED');
      } catch (err: any) {
        console.error("Error stopping recorder:", err);
        setStageState('ERROR');
      }
    }
  };

  const skipPrep = () => setStageState('COUNTDOWN');

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  if (stageState === 'ERROR') {
    return (
      <div className="flex flex-col h-screen w-full bg-slate-950 items-center justify-center p-6 text-center">
        <div className="w-20 h-20 bg-red-900/20 rounded-full flex items-center justify-center mb-6">
          <AlertTriangle size={40} className="text-red-500" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-4">Hardware Access Error</h2>
        <p className="text-slate-400 mb-8 max-w-md leading-relaxed">{errorMsg || "An unexpected error occurred during setup."}</p>
        <button onClick={onBack} className="px-8 py-3 bg-white text-slate-900 font-bold rounded-xl hover:bg-slate-200 transition-colors">Go Back to Menu</button>
      </div>
    );
  }

  if (stageState === 'PREP') {
    return (
      <div className="flex flex-col h-screen w-full bg-slate-900 items-center justify-center relative overflow-hidden">
        <div className="z-10 bg-slate-800/80 backdrop-blur-xl p-10 rounded-3xl border border-slate-700 shadow-2xl flex flex-col items-center max-w-2xl text-center relative">
          <button onClick={onBack} className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-full transition-colors"><X size={24} /></button>
          <h2 className="text-3xl font-bold text-white mb-6">Preparation Time</h2>
          <div className="text-8xl font-mono font-bold text-blue-400 mb-8">{formatTime(Math.ceil(prepTimeLeft))}</div>
          <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-700 w-full mb-8">
            <p className="text-slate-400 text-xs uppercase font-bold tracking-widest mb-2">Topic</p>
            <p className="text-xl md:text-2xl text-white font-bold leading-tight">"{config.topic}"</p>
          </div>
          <button onClick={skipPrep} className="px-8 py-4 bg-white text-slate-900 font-bold rounded-full text-lg hover:bg-blue-50 transition-colors flex items-center gap-2">I'm Ready <SkipForward size={20} /></button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen w-full bg-black relative overflow-hidden">
      {/* Top Header - Updated for full topic visibility */}
      <div className="w-full bg-slate-900/80 border-b border-slate-700 p-4 flex justify-between items-center z-20 backdrop-blur-md">
        <div className="flex items-center gap-4 flex-1">
           <div className="bg-black/40 px-4 py-2 rounded-lg border border-white/10 w-full">
              <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest leading-none mb-1">{config.educationLevel}</p>
              <p className="text-white text-sm md:text-base font-bold whitespace-normal tracking-tight leading-snug">{config.topic}</p>
           </div>
        </div>
        <div className={`text-3xl font-mono font-bold ${timeLeft <= 10 && stageState === 'RECORDING' ? 'text-red-500 animate-pulse' : 'text-green-400'} bg-black/60 px-4 py-1 rounded-lg border border-white/10 ml-4 shrink-0`}>
          {formatTime(timeLeft)}
        </div>
      </div>

      {/* Main Viewport */}
      <div className="flex-1 overflow-hidden p-2 md:p-4 bg-slate-900 relative">
         <VirtualAudience userVideo={
             <div className="relative w-full h-full bg-slate-900 flex items-center justify-center overflow-hidden">
                {stageState === 'COUNTDOWN' && (
                    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px] animate-fade-in">
                        <div className="text-9xl font-black text-white drop-shadow-[0_0_20px_rgba(255,255,255,0.8)] scale-150 animate-pulse">{countDown}</div>
                    </div>
                )}

                {(stageState === 'STARTING' || !isReady) && (
                   <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 z-20">
                      <Loader2 className="w-12 h-12 text-blue-500 animate-spin mb-4" />
                      <p className="text-white font-bold animate-pulse">{stageState === 'STARTING' ? "Entering Stage..." : "Warming up Audience..."}</p>
                   </div>
                )}

                {/* Audio visualizer */}
                <div className="flex flex-col items-center justify-center gap-3">
                    <div className="p-4 rounded-full transition-all duration-75" style={{
                      background: `rgba(59,130,246,${0.15 + volume / 300})`,
                      boxShadow: `0 0 ${volume / 2}px rgba(59,130,246,${volume / 200})`,
                      transform: `scale(${1 + (volume / 150)})`
                    }}>
                      <Mic size={28} className="text-blue-400" />
                    </div>
                    {stageState === 'RECORDING' && (
                      <div className="flex items-center gap-1 h-6">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <div key={i} className="w-1 bg-blue-500 rounded-full transition-all duration-75" style={{ height: `${Math.max(4, Math.min(24, volume * (0.5 + Math.random() * 0.8)))}px` }} />
                        ))}
                      </div>
                    )}
                </div>
             </div>
         } />
      </div>

      {/* Live transcript — visible while recording so user knows it's working */}
      {stageState === 'RECORDING' && (
        <div className="w-full bg-slate-900/95 border-t border-slate-700 px-6 py-3 z-20">
          <div className="max-w-3xl mx-auto">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Live Transcript</p>
            <p className="text-sm text-slate-200 leading-relaxed max-h-20 overflow-y-auto">
              {liveTranscript || <span className="italic text-slate-500">Listening… start speaking your answer.</span>}
            </p>
          </div>
        </div>
      )}

      {/* Control Bar */}
      <div className="w-full bg-slate-900/90 backdrop-blur-md p-6 border-t border-slate-700 z-30">
        <div className="max-w-3xl mx-auto flex items-center justify-center gap-4 md:gap-10">
           {stageState !== 'RECORDING' ? (
             <button disabled className="w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300 border-4 shadow-xl bg-slate-700 border-slate-600 opacity-50 cursor-not-allowed">
               {stageState === 'COUNTDOWN' ? <span className="text-2xl font-bold text-white">{countDown}</span> : <Loader2 size={32} className="text-slate-400 animate-spin" />}
             </button>
           ) : (
             <button onClick={stopRecording} className="w-20 h-20 rounded-full bg-slate-800 hover:bg-slate-700 border-4 border-red-500/50 flex items-center justify-center transition-all hover:scale-105 animate-pulse shadow-[0_0_20px_rgba(239,68,68,0.4)]">
               <Square size={32} className="text-red-500 fill-current" />
             </button>
           )}
           
           <button 
             onClick={() => setTimeLeft(prev => prev + 15)} 
             disabled={stageState !== 'RECORDING'} 
             className="p-4 rounded-full border flex items-center justify-center gap-1 font-bold transition-all bg-blue-600 hover:bg-blue-500 border-blue-400 text-white disabled:opacity-50"
           >
              <Plus size={18} /><span className="text-sm">15s</span>
           </button>
        </div>
        <div className="text-center mt-4 text-sm text-slate-400 font-medium tracking-wide">
          {stageState === 'COUNTDOWN' ? "Get Ready..." : stageState === 'RECORDING' ? "ON AIR - SPEAK NOW" : stageState === 'FINISHED' ? "Finishing..." : "Initializing Stage..."}
        </div>
      </div>
    </div>
  );
};
