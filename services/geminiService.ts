
import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { AnalysisResult, SessionMode, SpeechLevel, EducationLevel, TopicOutline, DrillType, DrillBatchResult } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const EDUCATION_CONSTRAINTS = {
  [EducationLevel.ELEMENTARY]: {
    target: "7-9 year old child",
    cefr: "A1 (Beginner)",
    vocabulary: "Only simple words like 'happy', 'play', 'school', 'friend'. No abstract nouns.",
    forbidden: "politics, economy, technology infrastructure, philosophy, societal ethics, global warming, career paths.",
    topics: "Animals, toys, family, school lunch, playground, favorite colors, superpowers."
  },
  [EducationLevel.MIDDLE_SCHOOL]: {
    target: "11-13 year old",
    cefr: "A2/B1",
    vocabulary: "Standard daily English. Can use words like 'impact', 'community', 'hobbies'.",
    forbidden: "advanced geopolitical analysis, professional corporate jargon, complex legal terms.",
    topics: "Social media, school rules, friendship, favorite movies, future hobbies, recycling."
  },
  [EducationLevel.HIGH_SCHOOL]: {
    target: "14-17 year old",
    cefr: "B2",
    vocabulary: "Academic level vocabulary. Can use 'consequently', 'infrastructure', 'ethics'.",
    forbidden: "highly specialized PhD-level jargon.",
    topics: "Climate change, career choices, college life, technology trends, community service."
  },
  [EducationLevel.UNIVERSITY]: {
    target: "Adult/Professional",
    cefr: "C1/C2",
    vocabulary: "Sophisticated, nuanced, and technical.",
    forbidden: "None. Topics should be complex and challenging.",
    topics: "Artificial intelligence, geopolitical shifts, philosophical debates, professional ethics."
  }
};

function parseModelJson(text: string | undefined): any {
  if (!text) return {};
  try {
    const cleanJson = text.replace(/```json\n?|```/g, '').trim();
    return JSON.parse(cleanJson);
  } catch (e) {
    console.error("JSON Parse Error. Raw text:", text);
    return {};
  }
}

const analysisSchema: any = {
  type: Type.OBJECT,
  properties: {
    overallScore: { type: Type.INTEGER },
    subScores: {
      type: Type.OBJECT,
      properties: {
        logic: { type: Type.INTEGER },
        delivery: { type: Type.INTEGER },
        structure: { type: Type.INTEGER },
        vocabulary: { type: Type.INTEGER },
        emotion: { type: Type.INTEGER },
      },
      required: ["logic", "delivery", "structure", "vocabulary", "emotion"]
    },
    transcript: { type: Type.STRING },
    modelAnswer: { type: Type.STRING },
    fillerWordCount: { type: Type.INTEGER },
    vocabUpgrades: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          original: { type: Type.STRING },
          suggested: { type: Type.STRING },
          type: { type: Type.STRING, enum: ["vocabulary", "transition"] },
          tip: { type: Type.STRING }
        },
        required: ["original", "suggested", "type", "tip"]
      }
    },
    structure: {
      type: Type.OBJECT,
      properties: {
        isPrep: { type: Type.BOOLEAN },
        feedback: { type: Type.STRING },
        point: { type: Type.STRING },
        reason: { type: Type.STRING },
        example: { type: Type.STRING },
        pointRestated: { type: Type.STRING },
      },
      required: ["isPrep", "feedback", "point", "reason", "example", "pointRestated"]
    },
    sentiment: { type: Type.STRING },
    speechFramework: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          description: { type: Type.STRING },
          polishedScript: { type: Type.STRING }
        },
        required: ["name", "description", "polishedScript"]
      }
    },
    grammarAnalysis: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
            original: { type: Type.STRING },
            correction: { type: Type.STRING },
            reason: { type: Type.STRING }
        }
      }
    },
    strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
    weaknesses: { type: Type.ARRAY, items: { type: Type.STRING } },
    debateAnalysis: {
        type: Type.OBJECT,
        properties: {
            constructive: {
                type: Type.OBJECT,
                properties: { transcript: { type: Type.STRING }, modelAnswer: { type: Type.STRING } },
                required: ["transcript", "modelAnswer"]
            },
            rebuttal: {
                type: Type.OBJECT,
                properties: { transcript: { type: Type.STRING }, modelAnswer: { type: Type.STRING } },
                required: ["transcript", "modelAnswer"]
            }
        },
        required: ["constructive", "rebuttal"]
    }
  },
  required: ["overallScore", "subScores", "transcript", "modelAnswer", "vocabUpgrades", "structure", "speechFramework", "grammarAnalysis", "strengths", "weaknesses"]
};

const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

async function retryOperation<T>(operation: () => Promise<T>, retries = 3, delay = 1000): Promise<T> {
  try {
    return await operation();
  } catch (error: any) {
    if (retries > 0 && (error.status === 503 || error.status === 429)) {
      await new Promise(resolve => setTimeout(resolve, delay));
      return retryOperation(operation, retries - 1, delay * 2);
    }
    throw error;
  }
}

export const generateTopic = async (
  interests: string[], 
  goal: string, 
  language: string, 
  mode: SessionMode, 
  level: SpeechLevel,
  eduLevel: EducationLevel
): Promise<string> => {
  const config = EDUCATION_CONSTRAINTS[eduLevel];
  // Using gemini-2.5-flash for maximum speed
  const prompt = `Generate 1 impromptu speech topic for a ${config.target}. 
    Length: 5-12 words. Simple language. 
    Topic Interests: ${interests.join(",")}. Mode: ${mode}.
    Output ONLY topic text.`;

  const response = await retryOperation<GenerateContentResponse>(() => ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
  }));

  return response.text?.trim() || "The Importance of Friendship";
};

export const generateDrillChallenges = async (type: DrillType, count: number, language: string, contextTopic: string, eduLevel: EducationLevel): Promise<string[]> => {
    const config = EDUCATION_CONSTRAINTS[eduLevel];
    const response = await retryOperation<GenerateContentResponse>(() => ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Task: Generate 3 drill challenges for a ${config.target}. Type: ${type}. Context: ${contextTopic}. 
        Constraint: 5-12 words per challenge. Simple wording.
        Language: ${language}. Output as JSON array of strings.`,
        config: {
            responseMimeType: "application/json",
            responseSchema: { type: Type.ARRAY, items: { type: Type.STRING } }
        }
    }));
    return parseModelJson(response.text) || [];
};

export const analyzeSpeech = async (
  audioBlob: Blob,
  topic: string,
  duration: number,
  mode: SessionMode,
  language: string,
  level: SpeechLevel,
  eduLevel: EducationLevel
): Promise<AnalysisResult> => {
  const config = EDUCATION_CONSTRAINTS[eduLevel];
  const base64Audio = await blobToBase64(audioBlob);
  const promptText = `You are a world-class Speech Coach and Rhetoric Professor evaluating a ${config.target}.
Topic: "${topic}". Language: ${language}. Duration: ~${Math.round(duration)}s. Mode: ${mode}. Level: ${level}.

CRITICAL INSTRUCTION FOR SILENCE/EMPTY SPEECH:
If the transcript is empty or "[No speech detected]", you MUST STILL generate ALL fields below with ideal examples. Set overallScore to 0.

EVALUATION CRITERIA (be rigorous and specific):

1. **transcript**: Exact word-for-word transcription of the audio. Include filler words (um, uh, like, you know).

2. **overallScore** (0-100): Be strict. 70+ = genuinely good speech. 50-69 = average. Below 50 = needs work.

3. **subScores** (each 0-100):
   - logic: How well-structured is the reasoning? Are there clear cause-effect chains?
   - delivery: Pace, pausing, vocal variety, confidence, projection
   - structure: Did they use PREP or similar framework? Clear intro/body/conclusion?
   - vocabulary: Word choice sophistication, variety, precision for their level
   - emotion: Emotional engagement, passion, ability to connect with audience

4. **modelAnswer**: Write a COMPLETE, polished 200-300 word model speech for this exact topic. This should be a gold-standard example the speaker can study. Use rhetorical devices (anaphora, tricolon, metaphor). Include a strong hook, 2-3 body points with evidence, and a memorable conclusion.

5. **structure**: Analyze their PREP framework usage:
   - isPrep: Did they follow Point-Reason-Example-Point?
   - feedback: 2-3 sentences on structural strengths/weaknesses
   - point: What was their main claim? (or suggest one if missing)
   - reason: What reasoning did they provide? (or suggest)
   - example: What example/evidence did they use? (or suggest a compelling one)
   - pointRestated: How did they conclude? (or suggest a strong conclusion)

6. **vocabUpgrades**: Provide 8-15 specific upgrades. For each:
   - original: The exact weak/basic phrase they used
   - suggested: A more powerful, precise alternative
   - type: "vocabulary" or "transition"
   - tip: Brief explanation of why the upgrade is better

7. **speechFramework**: Provide 2-3 complete alternative scripts (each 150-250 words):
   - name: Framework name (e.g. "The Storyteller", "The Philosopher", "The Analyst")
   - description: 1 sentence on the approach
   - polishedScript: Full written-out speech using this framework

8. **grammarAnalysis**: List every grammar mistake found (3-10 items):
   - original: The incorrect phrase
   - correction: The corrected version
   - reason: Brief grammar rule explanation

9. **strengths**: 3-5 specific things they did well (be concrete, not generic)
10. **weaknesses**: 3-5 specific areas for improvement (actionable, not vague)
11. **sentiment**: Overall emotional tone (e.g. "Confident and persuasive", "Hesitant but thoughtful")
12. **fillerWordCount**: Exact count of filler words (um, uh, like, you know, so, basically)

BE THOROUGH. Every field must be substantive and detailed. Do not give generic feedback like "good job" — cite specific moments from their speech.
Output JSON only.`;

  const response = await retryOperation<GenerateContentResponse>(() => ai.models.generateContent({
    model: 'gemini-2.5-pro',
    contents: {
        parts: [
            { inlineData: { mimeType: audioBlob.type || 'audio/webm', data: base64Audio } },
            { text: promptText }
        ]
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: analysisSchema
    }
  }));

  const result = parseModelJson(response.text);
  
  const safeResult: AnalysisResult = {
      overallScore: result.overallScore || 0,
      subScores: result.subScores || { logic: 0, delivery: 0, structure: 0, vocabulary: 0, emotion: 0 },
      transcript: result.transcript || "",
      modelAnswer: result.modelAnswer || "",
      vocabUpgrades: result.vocabUpgrades || [],
      fillerWordCount: result.fillerWordCount || 0,
      structure: result.structure || { isPrep: false, feedback: "No speech detected.", point: "Suggested Point", reason: "Suggested Reason", example: "Suggested Example", pointRestated: "Suggested Conclusion" },
      sentiment: result.sentiment || "Neutral",
      speechFramework: result.speechFramework || [],
      grammarAnalysis: result.grammarAnalysis || [],
      strengths: result.strengths || [],
      weaknesses: result.weaknesses || [],
      wpm: 0,
      improvements: []
  };

  const transcript = safeResult.transcript;
  const isCjk = language.toLowerCase().includes('chinese') || language.toLowerCase().includes('cantonese') || language.toLowerCase().includes('mandarin');
  const unitCount = isCjk ? transcript.length : transcript.trim().split(/\s+/).filter(Boolean).length;
  safeResult.wpm = Math.round((unitCount / Math.max(duration, 1)) * 60) || 0;
  
  safeResult.improvements = safeResult.grammarAnalysis.map((g: any) => ({
      original: g.original,
      suggestion: g.correction,
      reason: g.reason
  }));

  return safeResult;
};

export const generateDebateCounter = async (
    userBlob: Blob, 
    topic: string, 
    userSide: string, 
    language: string, 
    eduLevel: EducationLevel
): Promise<string> => {
    const config = EDUCATION_CONSTRAINTS[eduLevel];
    const base64Audio = await blobToBase64(userBlob);
    
    // The AI takes the opposite side.
    const aiSide = userSide === 'AFFIRMATIVE' ? 'NEGATIVE' : 'AFFIRMATIVE';
    
    const prompt = `Act as a skilled Debate Opponent for a ${config.target}. 
    Topic: "${topic}". 
    User Side: ${userSide}. 
    Your Side: ${aiSide}.
    Language: ${language}.
    
    Task: Listen to the user's constructive speech. Identify their main arguments. 
    Then, write a sharp, logical 150-word Counter-Statement (Rebuttal) attacking their points and establishing your case.
    Keep it concise and spoken-style.
    Output ONLY the counter-statement text.`;

    const response = await retryOperation<GenerateContentResponse>(() => ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: {
            parts: [
                { inlineData: { mimeType: userBlob.type || 'audio/webm', data: base64Audio } },
                { text: prompt }
            ]
        }
    }));

    return response.text?.trim() || "I disagree with your premise. Let me present a counter-argument...";
};

export const analyzeDebateSession = async (
    constructiveBlob: Blob,
    rebuttalBlob: Blob,
    aiCounterText: string,
    topic: string,
    userSide: string,
    language: string,
    eduLevel: EducationLevel
): Promise<AnalysisResult> => {
    const config = EDUCATION_CONSTRAINTS[eduLevel];
    const constructiveBase64 = await blobToBase64(constructiveBlob);
    const rebuttalBase64 = await blobToBase64(rebuttalBlob);

    const promptText = `You are a Master Debate Judge and Rhetoric Expert evaluating a ${config.target}.
    Topic: "${topic}". User Side: ${userSide}. Language: ${language}.

    Input:
    1. User Constructive Speech (Audio 1)
    2. AI Opponent Counter-Argument: "${aiCounterText.substring(0, 500)}"
    3. User Rebuttal Speech (Audio 2)

    EVALUATION (be rigorous and detailed):

    1. **debateAnalysis**:
       - constructive: { transcript: <exact word-for-word text of audio 1>, modelAnswer: <a 200-word ideal constructive speech with strong claims, evidence, and impact> }
       - rebuttal: { transcript: <exact word-for-word text of audio 2>, modelAnswer: <a 200-word ideal rebuttal that dismantles opponent's points and reinforces own case> }

    2. **overallScore** (0-100): Be strict. Consider argument quality, refutation skill, evidence usage, and logical consistency across both rounds.

    3. **subScores** (0-100 each): logic (argument chains), delivery (confidence/pace), structure (organization), vocabulary (precision), emotion (persuasion power)

    4. **modelAnswer**: Combined ideal performance summary (200-300 words)
    5. **vocabUpgrades**: 8-15 specific phrase improvements from their speeches
    6. **speechFramework**: 2 alternative debate strategies as complete scripts
    7. **grammarAnalysis**: All grammar errors found
    8. **strengths**: 3-5 specific strong moments (cite actual quotes)
    9. **weaknesses**: 3-5 specific areas to improve (actionable advice)
    10. **sentiment**: e.g. "Assertive in constructive, defensive in rebuttal"

    BE THOROUGH. Cite specific quotes from the user's speeches. Output JSON only.`;

    const response = await retryOperation<GenerateContentResponse>(() => ai.models.generateContent({
        model: 'gemini-2.5-pro',
        contents: {
            parts: [
                { inlineData: { mimeType: constructiveBlob.type || 'audio/webm', data: constructiveBase64 } },
                { inlineData: { mimeType: rebuttalBlob.type || 'audio/webm', data: rebuttalBase64 } },
                { text: promptText }
            ]
        },
        config: {
            responseMimeType: "application/json",
            responseSchema: analysisSchema
        }
    }));

    const result = parseModelJson(response.text);
    
    const safeResult: AnalysisResult = {
      overallScore: result.overallScore || 0,
      subScores: result.subScores || { logic: 0, delivery: 0, structure: 0, vocabulary: 0, emotion: 0 },
      transcript: result.transcript || "Combined transcript unavailable", // Fallback if schema strictness fails
      modelAnswer: result.modelAnswer || "See round-specific answers",
      vocabUpgrades: result.vocabUpgrades || [],
      fillerWordCount: result.fillerWordCount || 0,
      structure: result.structure || { isPrep: false, feedback: "Debate analysis completed.", point: "Case", reason: "Logic", example: "Evidence", pointRestated: "Conclusion" },
      sentiment: result.sentiment || "Neutral",
      speechFramework: result.speechFramework || [],
      grammarAnalysis: result.grammarAnalysis || [],
      strengths: result.strengths || [],
      weaknesses: result.weaknesses || [],
      wpm: 0,
      improvements: [],
      debateAnalysis: result.debateAnalysis // Pass the specific debate breakdown
  };
  
  return safeResult;
};

export const translateText = async (text: string, targetLanguage: string): Promise<string> => {
    if (!text) return "";
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Translate the following text to ${targetLanguage}. Keep the tone professional and educational. Output ONLY the translated text.\n\nText: "${text}"`
        });
        return response.text?.trim() || text;
    } catch (e) {
        return text;
    }
};

export const generateTopicOutline = async (topic: string, language: string, eduLevel: EducationLevel): Promise<TopicOutline> => {
    const config = EDUCATION_CONSTRAINTS[eduLevel];
    const response = await retryOperation<GenerateContentResponse>(() => ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Generate a mindmap for: "${topic}". Level: ${config.target}. Lang: ${language}. JSON: {centralIdea: string, points: string[]}`,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: { centralIdea: { type: Type.STRING }, points: { type: Type.ARRAY, items: { type: Type.STRING } } },
                required: ["centralIdea", "points"]
            }
        }
    }));
    const parsed = parseModelJson(response.text);
    return {
        centralIdea: parsed.centralIdea || "Topic",
        points: parsed.points || ["Part 1", "Part 2", "Part 3"]
    };
};

export const createCoachChat = (result: AnalysisResult, topic: string, mode: SessionMode, language: string, eduLevel: EducationLevel) => {
  const config = EDUCATION_CONSTRAINTS[eduLevel];
  return ai.chats.create({
    model: 'gemini-2.5-flash',
    config: {
      systemInstruction: `You are an AI Speech Coach for a ${config.target}. 
      Vocabulary Constraint: Use ${config.vocabulary}.
      Language: ${language}.
      The user has a score of ${result.overallScore}. Be encouraging and use age-appropriate explanations.`
    }
  });
};

export const analyzeDrillBatch = async (recordings: { blob: Blob, prompt: string }[], type: DrillType, language: string, eduLevel: EducationLevel): Promise<DrillBatchResult> => {
    const config = EDUCATION_CONSTRAINTS[eduLevel];
    const roundResults = [];
    for (const rec of recordings) {
        try {
            const base64Audio = await blobToBase64(rec.blob);
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: {
                    parts: [
                        { inlineData: { mimeType: rec.blob.type || 'audio/webm', data: base64Audio } },
                        { text: `Analyze this ${type} drill for a ${config.target}. Prompt: ${rec.prompt}. 
                        
                        CRITICAL REQUIREMENTS:
                        1. SILENCE DETECTION: If transcript is empty or only noise, return "[No speech detected]" and score 0.
                        2. SCORE: Strictly from 1 to 10.
                        3. LOGIC ROADMAP: This should represent a SUGGESTED/IMPROVED logic flow for this prompt (a model answer's logic). It MUST NOT simply repeat what the user said. Use keywords and arrows -> (e.g. Concept -> Elaboration -> Impact).
                        4. DO NOT provide delivery tips. 
                        5. Provide vocabUpgrades (3-5 items) and exact transcript. JSON.` }
                    ]
                },
                config: {
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: Type.OBJECT,
                        properties: {
                            transcript: { type: Type.STRING },
                            score: { type: Type.INTEGER },
                            logicFeedback: { type: Type.STRING },
                            polishedVersion: { type: Type.STRING },
                            keyTransitions: { type: Type.ARRAY, items: { type: Type.STRING } },
                            vocabUpgrades: {
                                type: Type.ARRAY,
                                items: {
                                    type: Type.OBJECT,
                                    properties: {
                                        original: { type: Type.STRING },
                                        suggested: { type: Type.STRING },
                                        type: { type: Type.STRING, enum: ["vocabulary", "transition"] },
                                        tip: { type: Type.STRING }
                                    },
                                    required: ["original", "suggested", "type", "tip"]
                                }
                            }
                        },
                        required: ["transcript", "score", "logicFeedback", "polishedVersion", "keyTransitions", "vocabUpgrades"]
                    }
                }
            });
            const parsed = parseModelJson(response.text);
            roundResults.push({
                round: roundResults.length + 1,
                prompt: rec.prompt,
                transcript: parsed.transcript || "",
                score: parsed.score || 0,
                logicFeedback: parsed.logicFeedback || "",
                polishedVersion: parsed.polishedVersion || "",
                keyTransitions: parsed.keyTransitions || [],
                vocabUpgrades: parsed.vocabUpgrades || []
            });
        } catch (e) {
            console.error("Drill failed", e);
        }
    }
    return { 
        type, 
        rounds: roundResults, 
        overallImprovement: "Great effort! You're becoming much more confident.", 
        nextSteps: ["Keep practicing", "Focus on clear endings"] 
    };
};
