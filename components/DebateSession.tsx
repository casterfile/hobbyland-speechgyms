
import React, { useState, useEffect, useRef } from 'react';
import { SessionConfig } from '../types';
import { generateDebateCounter } from '../services/geminiService';
import { Mic, Square, Loader2, Swords, Bot, VideoOff, Video, User } from 'lucide-react';

interface Props {
  config: SessionConfig;
  onFinishDebate: (constructiveBlob: Blob, rebuttalBlob: Blob, aiCounter: string) => void;
  onBack: () => void;
}

type DebateStep = 'INTRO' | 'PREP' | 'RECORD_CONSTRUCTIVE' | 'AI_THINKING' | 'AI_COUNTER' | 'PREP_REBUTTAL' | 'RECORD_REBUTTAL' | 'FINISHING';

export const DebateSession: React.FC<Props> = ({ config, onFinishDebate, onBack }) => {
  const [step, setStep] = useState<DebateStep>('INTRO');
  const [timeLeft, setTimeLeft] = useState(config.prepTimeSeconds > 0 ? config.prepTimeSeconds : 5);
  const [recordingTime, setRecordingTime] = useState(config.durationSeconds);
  const [cameraOn, setCameraOn] = useState(true);
  
  const [constructiveBlob, setConstructiveBlob] = useState<Blob | null>(null);
  const [rebuttalBlob, setRebuttalBlob] = useState<Blob | null>(null);
  const [aiCounterText, setAiCounterText] = useState("");
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Setup Stream (Camera + Audio) for Stage Visualization
  useEffect(() => {
    let isMounted = true;
    const setupStream = async () => {
        if (step !== 'RECORD_CONSTRUCTIVE' && step !== 'RECORD_REBUTTAL') return;

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: { echoCancellation: true },
                video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' }
            });

            if (!isMounted) {
                stream.getTracks().forEach(t => t.stop());
                return;
            }
            streamRef.current = stream;

            if (videoRef.current) videoRef.current.srcObject = stream;

            // Auto-start recording logic is inside the step effect below, relying on streamRef
        } catch (e) {
            console.error("Stream setup failed", e);
        }
    };

    if (step === 'RECORD_CONSTRUCTIVE' || step === 'RECORD_REBUTTAL') {
        setupStream();
    }

    return () => {
        isMounted = false;
        if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    };
  }, [step]);

  // Timer & Auto-Record Logic
  useEffect(() => {
    let interval: any;
    
    // Prep Countdown
    if ((step === 'PREP' || step === 'PREP_REBUTTAL') && timeLeft > 0) {
      interval = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
    } else if ((step === 'PREP' || step === 'PREP_REBUTTAL') && timeLeft <= 0) {
      const nextStep = step === 'PREP' ? 'RECORD_CONSTRUCTIVE' : 'RECORD_REBUTTAL';
      setStep(nextStep);
      // Wait for stream to init in the other effect, then start recording
      setTimeout(() => startRecording(nextStep), 500); 
    }
    
    // Recording Countdown
    if ((step === 'RECORD_CONSTRUCTIVE' || step === 'RECORD_REBUTTAL') && recordingTime > 0) {
      interval = setInterval(() => setRecordingTime(prev => prev - 1), 1000);
    } else if ((step === 'RECORD_CONSTRUCTIVE' || step === 'RECORD_REBUTTAL') && recordingTime <= 0) {
      stopRecording();
    }

    return () => clearInterval(interval);
  }, [step, timeLeft, recordingTime]);

  const startRecording = async (currentStep: DebateStep) => {
    if (!streamRef.current) return;
    try {
      const audioTracks = streamRef.current.getAudioTracks();
      const recordingStream = new MediaStream(audioTracks);
      const recorder = new MediaRecorder(recordingStream);
      chunksRef.current = [];
      recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        handleRecordingComplete(blob, currentStep);
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setRecordingTime(config.durationSeconds);
    } catch (e) {
      console.error("Mic error", e);
    }
  };

  const stopRecording = () => {
    // Robust stop logic: Check if exists and is not inactive
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch (e) {
        console.error("Error stopping recorder", e);
        // Fallback: Manually trigger completion if stop() throws
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        handleRecordingComplete(blob, step);
      }
    } else {
        // Fallback if state is already inactive but UI didn't update
        if (chunksRef.current.length > 0) {
            const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
            handleRecordingComplete(blob, step);
        }
    }
  };

  const handleRecordingComplete = async (blob: Blob, currentStep: DebateStep) => {
    // Teardown stream for this step
    if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
    }

    if (currentStep === 'RECORD_CONSTRUCTIVE') {
      setConstructiveBlob(blob);
      setStep('AI_THINKING');
      try {
        const counter = await generateDebateCounter(
            blob, 
            config.topic, 
            config.debateSide || 'AFFIRMATIVE', 
            config.language, 
            config.educationLevel
        );
        setAiCounterText(counter);
        setStep('AI_COUNTER');
      } catch (e) {
        console.error("AI Gen Failed", e);
        setAiCounterText("Error generating counter-argument. Proceeding to rebuttal.");
        setStep('AI_COUNTER');
      }
    } else if (currentStep === 'RECORD_REBUTTAL') {
      setRebuttalBlob(blob);
      setStep('FINISHING');
      if (constructiveBlob) {
        onFinishDebate(constructiveBlob, blob, aiCounterText);
      }
    }
  };

  const startRebuttalRound = () => {
      setTimeLeft(10); // Short prep for rebuttal
      setStep('PREP_REBUTTAL');
  };

  const toggleCamera = () => {
    if (streamRef.current) {
        const vTrack = streamRef.current.getVideoTracks()[0];
        if (vTrack) {
            vTrack.enabled = !cameraOn;
            setCameraOn(!cameraOn);
        }
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  if (step === 'INTRO') {
    return (
      <div className="flex flex-col h-screen w-full bg-slate-900 items-center justify-center p-6 text-center">
        <div className="max-w-2xl w-full bg-slate-800 p-10 rounded-3xl border border-slate-700 shadow-2xl space-y-8 animate-fade-in">
           <div className="flex justify-center mb-4">
              <div className="p-4 bg-green-500/20 rounded-full text-green-400 border border-green-500/50">
                  <Swords size={48} />
              </div>
           </div>
           <div>
               <h1 className="text-3xl font-bold text-white mb-2">Debate Mode</h1>
               <p className="text-slate-400 text-lg">Topic: <span className="text-white font-bold">"{config.topic}"</span></p>
               <div className={`inline-block mt-4 px-4 py-1 rounded-full text-sm font-bold border ${config.debateSide === 'AFFIRMATIVE' ? 'bg-green-600/20 border-green-500 text-green-200' : 'bg-red-600/20 border-red-500 text-red-200'}`}>
                   You are: {config.debateSide}
               </div>
           </div>
           
           <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
               <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700">
                   <span className="text-xs font-bold text-slate-500 uppercase">Round 1</span>
                   <p className="font-bold text-white">Constructive Speech</p>
                   <p className="text-xs text-slate-400">{formatTime(config.durationSeconds)}</p>
               </div>
               <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700 opacity-50">
                   <span className="text-xs font-bold text-slate-500 uppercase">Intermission</span>
                   <p className="font-bold text-white">AI Counter-Attack</p>
                   <p className="text-xs text-slate-400">Analysis</p>
               </div>
               <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700 opacity-50">
                   <span className="text-xs font-bold text-slate-500 uppercase">Round 2</span>
                   <p className="font-bold text-white">Final Rebuttal</p>
                   <p className="text-xs text-slate-400">{formatTime(config.durationSeconds)}</p>
               </div>
           </div>

           <button onClick={() => setStep('PREP')} className="w-full py-4 bg-green-600 hover:bg-green-500 text-white font-bold rounded-xl shadow-lg transition-all text-lg">
               Start Debate
           </button>
        </div>
      </div>
    );
  }

  if (step === 'PREP' || step === 'PREP_REBUTTAL') {
      return (
        <div className="flex flex-col h-screen w-full bg-black items-center justify-center p-6 text-center">
            <h2 className="text-4xl font-bold text-white mb-8">{step === 'PREP' ? "Prepare Constructive" : "Prepare Rebuttal"}</h2>
            <div className="text-9xl font-mono font-bold text-green-500 mb-8 animate-pulse">{timeLeft}</div>
            <p className="text-slate-400">Get ready to speak...</p>
        </div>
      );
  }

  // STAGE VIEW FOR RECORDING
  if (step === 'RECORD_CONSTRUCTIVE' || step === 'RECORD_REBUTTAL') {
      return (
        <div className="flex flex-col h-screen w-full bg-black relative overflow-hidden">
             {/* Header */}
             <div className="w-full bg-slate-900/80 border-b border-slate-700 p-4 flex justify-between items-center z-30 backdrop-blur-md">
                <div className="flex items-center gap-4 flex-1">
                    <div className="bg-black/40 px-4 py-2 rounded-lg border border-white/10 w-full">
                        <div className="flex justify-between items-center mb-1">
                             <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">{config.debateSide} ({step === 'RECORD_CONSTRUCTIVE' ? 'Round 1' : 'Round 2'})</p>
                        </div>
                        <p className="text-white text-sm md:text-base font-bold whitespace-normal tracking-tight leading-snug">{config.topic}</p>
                    </div>
                </div>
                <div className={`text-3xl font-mono font-bold ${recordingTime <= 10 ? 'text-red-500 animate-pulse' : 'text-green-400'} bg-black/60 px-4 py-1 rounded-lg border border-white/10 ml-4 shrink-0`}>
                    {formatTime(recordingTime)}
                </div>
            </div>

            {/* Immersive Debate Stage */}
            <div className="flex-1 relative bg-black overflow-hidden flex items-end justify-center">
                 {/* 1. Audience Background */}
                 <div className="absolute inset-0 z-0">
                    <img 
                        src="https://images.unsplash.com/photo-1544531586-fde5298cdd40?auto=format&fit=crop&w=2000&q=80" 
                        alt="Audience" 
                        className="w-full h-full object-cover opacity-60 filter blur-[2px]" 
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent"></div>
                 </div>

                 {/* 2. User Video (Speaker) */}
                 <div className="relative z-10 w-full max-w-4xl h-[90%] flex items-end justify-center mb-[-2%]">
                    <div className="relative w-full h-full flex items-center justify-center">
                        <video 
                            ref={videoRef} 
                            autoPlay 
                            muted 
                            playsInline 
                            className={`h-full w-auto max-w-full object-cover rounded-t-3xl shadow-2xl transition-opacity duration-300 ${!cameraOn ? 'opacity-0' : 'opacity-100'}`} 
                        />
                        {!cameraOn && (
                            <div className="absolute inset-0 flex items-center justify-center text-slate-500 bg-slate-900/80 rounded-t-3xl backdrop-blur-sm border border-slate-700">
                                <div className="flex flex-col items-center gap-4">
                                    <User size={64} />
                                    <p className="font-bold">Camera Off</p>
                                </div>
                            </div>
                        )}
                    </div>
                 </div>

                 {/* 3. Microphone Stand Overlay */}
                 <div className="absolute bottom-0 z-20 pointer-events-none drop-shadow-2xl filter brightness-75 contrast-125">
                     <svg width="200" height="400" viewBox="0 0 200 400" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-[40vh] w-auto">
                        {/* Mic Head */}
                        <rect x="70" y="20" width="60" height="90" rx="30" fill="#334155" stroke="#94a3b8" strokeWidth="4" />
                        <line x1="75" y1="35" x2="125" y2="35" stroke="#64748b" strokeWidth="2" />
                        <line x1="75" y1="50" x2="125" y2="50" stroke="#64748b" strokeWidth="2" />
                        <line x1="75" y1="65" x2="125" y2="65" stroke="#64748b" strokeWidth="2" />
                        <line x1="75" y1="80" x2="125" y2="80" stroke="#64748b" strokeWidth="2" />
                        {/* Mic Connector */}
                        <rect x="90" y="110" width="20" height="30" fill="#1e293b" />
                        {/* Stand Pole */}
                        <rect x="95" y="140" width="10" height="260" fill="url(#grad1)" />
                        <defs>
                            <linearGradient id="grad1" x1="100" y1="140" x2="100" y2="400" gradientUnits="userSpaceOnUse">
                                <stop stopColor="#94a3b8" />
                                <stop offset="1" stopColor="#0f172a" />
                            </linearGradient>
                        </defs>
                     </svg>
                 </div>

                 {/* On Air Badge */}
                 <div className="absolute top-6 left-6 z-20 bg-red-600 text-white text-xs font-bold px-3 py-1.5 rounded-full animate-pulse flex items-center gap-2 shadow-lg">
                     <div className="w-2 h-2 bg-white rounded-full"></div> ON AIR
                 </div>
            </div>

            {/* Control Bar */}
            <div className="w-full bg-slate-900/90 backdrop-blur-md p-6 border-t border-slate-700 z-30">
                <div className="max-w-3xl mx-auto flex items-center justify-center gap-4 md:gap-10">
                    <button onClick={toggleCamera} className="p-4 rounded-full bg-slate-800 text-white hover:bg-slate-700 transition-colors border border-slate-600">
                        {cameraOn ? <Video size={24} /> : <VideoOff size={24} />}
                    </button>
                    
                    <button onClick={stopRecording} className="w-20 h-20 rounded-full bg-slate-800 hover:bg-slate-700 border-4 border-red-500/50 flex items-center justify-center transition-all hover:scale-105 animate-pulse shadow-[0_0_20px_rgba(239,68,68,0.4)]">
                        <Square size={32} className="text-red-500 fill-current" />
                    </button>
                    
                    <div className="w-14"></div> {/* Spacer for balance */}
                </div>
                <p className="text-center text-slate-500 text-xs mt-4 uppercase font-bold tracking-widest">Recording in Progress - Click Square to Finish</p>
            </div>
        </div>
      );
  }

  if (step === 'AI_THINKING') {
      return (
          <div className="flex flex-col h-screen w-full bg-slate-900 items-center justify-center text-center p-6">
              <Loader2 size={64} className="text-blue-500 animate-spin mb-6" />
              <h2 className="text-2xl font-bold text-white">Opponent is thinking...</h2>
              <p className="text-slate-400 mt-2">Analyzing your arguments and formulating a counter-attack.</p>
          </div>
      );
  }

  if (step === 'AI_COUNTER') {
      return (
        <div className="flex flex-col h-screen w-full bg-slate-900 p-6 overflow-y-auto">
            <div className="max-w-3xl mx-auto w-full my-auto space-y-6 animate-fade-in">
                <div className="flex items-center gap-4 mb-8">
                    <div className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center border-4 border-slate-800 shadow-xl">
                        <Bot size={32} className="text-white" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-white">Opponent's Counter</h2>
                        <p className="text-slate-400 text-sm">Review this carefully for your rebuttal.</p>
                    </div>
                </div>

                <div className="bg-slate-800 p-8 rounded-3xl border border-slate-700 shadow-2xl relative">
                    <div className="absolute -left-3 top-10 w-6 h-6 bg-slate-800 border-l border-b border-slate-700 transform rotate-45"></div>
                    <p className="text-lg md:text-xl text-slate-200 leading-relaxed font-serif">
                        "{aiCounterText}"
                    </p>
                </div>

                <div className="flex justify-end pt-4">
                    <button onClick={startRebuttalRound} className="px-8 py-4 bg-green-600 hover:bg-green-500 text-white font-bold rounded-xl shadow-lg transition-transform hover:scale-105 flex items-center gap-3">
                        Start Rebuttal <Swords size={20} />
                    </button>
                </div>
            </div>
        </div>
      );
  }

  return (
      <div className="flex flex-col h-screen w-full bg-slate-900 items-center justify-center text-center">
          <Loader2 size={48} className="text-white animate-spin" />
          <p className="text-white mt-4 font-bold">Finalizing Debate...</p>
      </div>
  );
};
