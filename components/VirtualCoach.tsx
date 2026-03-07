
import React, { useState, useEffect, useRef } from 'react';
import { AnalysisResult, SessionMode, EducationLevel } from '../types';
import { createCoachChat } from '../services/geminiService';
import { Send, User, Bot, Loader2, Sparkles, Mic, Volume2, VolumeX } from 'lucide-react';
import { GenerateContentResponse } from "@google/genai";

interface Props {
  result: AnalysisResult;
  topic: string;
  mode: SessionMode;
  language: string;
  eduLevel?: EducationLevel;
}

interface Message {
  role: 'user' | 'model';
  text: string;
}

export const VirtualCoach: React.FC<Props> = ({ result, topic, mode, language, eduLevel = EducationLevel.UNIVERSITY }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(true);
  const [isListening, setIsListening] = useState(false);
  
  const chatSessionRef = useRef<any>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const synthRef = useRef<SpeechSynthesis>(window.speechSynthesis);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.continuous = false;
        recognitionRef.current.interimResults = false;
        
        let langTag = 'en-US';
        if (language.toLowerCase().includes('cantonese')) langTag = 'yue-Hant-HK';
        else if (language.toLowerCase().includes('mandarin') || language.toLowerCase().includes('chinese')) langTag = 'zh-CN';
        
        recognitionRef.current.lang = langTag;
        recognitionRef.current.onresult = (event: any) => {
          setInput(event.results[0][0].transcript);
          setIsListening(false);
        };
        recognitionRef.current.onerror = () => setIsListening(false);
        recognitionRef.current.onend = () => setIsListening(false);
      }
    }
  }, [language]);

  useEffect(() => {
    if (!isVoiceEnabled && synthRef.current) synthRef.current.cancel();
  }, [isVoiceEnabled]);

  const speak = (text: string) => {
    if (!isVoiceEnabled || !synthRef.current) return;
    synthRef.current.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const voices = synthRef.current.getVoices();
    let selectedVoice = voices.find(v => v.lang.includes(language.slice(0, 2)));
    if (selectedVoice) utterance.voice = selectedVoice;
    synthRef.current.speak(utterance);
  };

  useEffect(() => {
    chatSessionRef.current = createCoachChat(result, topic, mode, language, eduLevel);
    const startConversation = async () => {
      setIsLoading(true);
      try {
        const response: GenerateContentResponse = await chatSessionRef.current.sendMessage({ 
          message: `Greet the user for their ${eduLevel} level speech on "${topic}". Briefly mention a specific positive from their transcript.` 
        });
        setMessages([{ role: 'model', text: response.text || "Hello! Ready to review?" }]);
      } catch (e) {
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    };
    startConversation();
    return () => { if (synthRef.current) synthRef.current.cancel(); };
  }, [result, topic, mode, language, eduLevel]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const handleSend = async (manualText?: string) => {
    const textToSend = manualText || input;
    if (!textToSend.trim() || isLoading) return;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: textToSend }]);
    setIsLoading(true);
    try {
      const response: GenerateContentResponse = await chatSessionRef.current.sendMessage({ message: textToSend });
      setMessages(prev => [...prev, { role: 'model', text: response.text || "Interesting point." }]);
    } catch (e) {
      setMessages(prev => [...prev, { role: 'model', text: "Sorry, I lost my connection." }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[500px] w-full bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden shadow-2xl">
      <div className="bg-slate-900/50 p-4 border-b border-slate-700 flex items-center justify-between">
        <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-indigo-500 flex items-center justify-center relative"><Bot size={24} className="text-white" /></div>
            <div>
            <h3 className="font-bold text-white">AI Coach ({eduLevel})</h3>
            <p className="text-xs text-slate-400">Ready to assist</p>
            </div>
        </div>
        <button onClick={() => setIsVoiceEnabled(!isVoiceEnabled)} className={`p-2 rounded-full ${isVoiceEnabled ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-400'}`}>
            {isVoiceEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
        </button>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-900/30">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] p-3 rounded-2xl text-sm leading-relaxed ${msg.role === 'user' ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-slate-700 text-slate-200 rounded-tl-none border border-slate-600'}`}>
              {msg.text}
              {msg.role === 'model' && isVoiceEnabled && (
                <button onClick={() => speak(msg.text)} className="ml-2 inline-block opacity-50 hover:opacity-100"><Volume2 size={12} /></button>
              )}
            </div>
          </div>
        ))}
        {isLoading && <div className="text-xs text-slate-500 animate-pulse">Coach is thinking...</div>}
      </div>
      <div className="p-4 bg-slate-800 border-t border-slate-700 flex gap-2">
          <input type="text" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSend()} placeholder="Ask for advice..." className="flex-1 bg-slate-900 border border-slate-600 rounded-xl px-4 py-2 text-white outline-none" />
          <button onClick={() => handleSend()} disabled={isLoading || !input.trim()} className="bg-blue-600 text-white p-2 rounded-xl disabled:opacity-50"><Send size={20} /></button>
      </div>
    </div>
  );
};
