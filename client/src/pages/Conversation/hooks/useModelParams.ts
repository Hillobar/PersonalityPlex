import { useCallback, useEffect, useState } from "react";
import {useLocalStorage} from './useLocalStorage';

export const DEFAULT_TEXT_TEMPERATURE = 0.7;
export const DEFAULT_TEXT_TOPK = 25;
export const DEFAULT_AUDIO_TEMPERATURE = 0.8;
export const DEFAULT_AUDIO_TOPK = 250;
export const DEFAULT_PAD_MULT = 0;
export const DEFAULT_REPETITION_PENALTY_CONTEXT = 64;
export const DEFAULT_REPETITION_PENALTY = 2.0; 
export const DEFAULT_TEXT_PROMPT = "You enjoy having a good conversation.";
export const DEFAULT_VOICE_PROMPT = "c_c.pt";
export const DEFAULT_RANDOM_SEED = -1;

export type ModelParamsValues = {
  textTemperature: number;
  textTopk: number;
  audioTemperature: number;
  audioTopk: number;
  padMult: number;
  repetitionPenaltyContext: number,
  repetitionPenalty: number,
  textPrompt: string;
  additionalText: string;
  personalityId: string;
  voicePrompt: string;
  randomSeed: number;
};

type useModelParamsArgs = Partial<ModelParamsValues>;

export const useModelParams = (params?:useModelParamsArgs) => {

  const [textTemperature, setTextTemperatureBase] = useState(params?.textTemperature || DEFAULT_TEXT_TEMPERATURE);
  const [textTopk, setTextTopkBase]= useState(params?.textTopk || DEFAULT_TEXT_TOPK);
  const [audioTemperature, setAudioTemperatureBase] = useState(params?.audioTemperature || DEFAULT_AUDIO_TEMPERATURE);
  const [audioTopk, setAudioTopkBase] = useState(params?.audioTopk || DEFAULT_AUDIO_TOPK);
  const [padMult, setPadMultBase] = useState(params?.padMult || DEFAULT_PAD_MULT);
  const [repetitionPenalty, setRepetitionPenaltyBase] = useState(params?.repetitionPenalty || DEFAULT_REPETITION_PENALTY);
  const [repetitionPenaltyContext, setRepetitionPenaltyContextBase] = useState(params?.repetitionPenaltyContext || DEFAULT_REPETITION_PENALTY_CONTEXT);
  const [textPrompt, setTextPromptBase] = useState(params?.textPrompt || DEFAULT_TEXT_PROMPT);
  const [additionalText, setAdditionalTextBase] = useState(params?.additionalText || "");
  const [personalityId, setPersonalityIdBase] = useState(params?.personalityId || "");
  const [voicePrompt, setVoicePromptBase] = useState(params?.voicePrompt || DEFAULT_VOICE_PROMPT);
  const [randomSeed, setRandomSeedBase] = useLocalStorage('randomSeed', params?.randomSeed || DEFAULT_RANDOM_SEED);

  // Sync internal state when parent props change (e.g. Queue → Conversation)
  useEffect(() => { if (params?.textPrompt !== undefined) setTextPromptBase(params.textPrompt); }, [params?.textPrompt]);
  useEffect(() => { if (params?.additionalText !== undefined) setAdditionalTextBase(params.additionalText); }, [params?.additionalText]);
  useEffect(() => { if (params?.personalityId !== undefined) setPersonalityIdBase(params.personalityId); }, [params?.personalityId]);
  useEffect(() => { if (params?.voicePrompt !== undefined) setVoicePromptBase(params.voicePrompt); }, [params?.voicePrompt]);
  useEffect(() => { if (params?.textTemperature !== undefined) setTextTemperatureBase(params.textTemperature); }, [params?.textTemperature]);
  useEffect(() => { if (params?.textTopk !== undefined) setTextTopkBase(params.textTopk); }, [params?.textTopk]);
  useEffect(() => { if (params?.audioTemperature !== undefined) setAudioTemperatureBase(params.audioTemperature); }, [params?.audioTemperature]);
  useEffect(() => { if (params?.audioTopk !== undefined) setAudioTopkBase(params.audioTopk); }, [params?.audioTopk]);

  const resetParams = useCallback(() => {
    setTextTemperatureBase(DEFAULT_TEXT_TEMPERATURE);
    setTextTopkBase(DEFAULT_TEXT_TOPK);
    setAudioTemperatureBase(DEFAULT_AUDIO_TEMPERATURE);
    setAudioTopkBase(DEFAULT_AUDIO_TOPK);
    setPadMultBase(DEFAULT_PAD_MULT);
    setRepetitionPenalty(DEFAULT_REPETITION_PENALTY);
    setRepetitionPenaltyContext(DEFAULT_REPETITION_PENALTY_CONTEXT);
  }, [
    setTextTemperatureBase,
    setTextTopkBase,
    setAudioTemperatureBase,
    setAudioTopkBase,
    setPadMultBase,
    setRepetitionPenaltyBase,
    setRepetitionPenaltyContextBase,
  ]);

  const setParams = useCallback((params: ModelParamsValues) => {
    setTextTemperatureBase(params.textTemperature);
    setTextTopkBase(params.textTopk);
    setAudioTemperatureBase(params.audioTemperature);
    setAudioTopkBase(params.audioTopk);
    setPadMultBase(params.padMult);
    setRepetitionPenaltyBase(params.repetitionPenalty);
    setRepetitionPenaltyContextBase(params.repetitionPenaltyContext);
    setTextPromptBase(params.textPrompt);
    setAdditionalTextBase(params.additionalText);
    setPersonalityIdBase(params.personalityId);
    setVoicePromptBase(params.voicePrompt);
    setRandomSeedBase(params.randomSeed);
  }, [
    setTextTemperatureBase,
    setTextTopkBase,
    setAudioTemperatureBase,
    setAudioTopkBase,
    setPadMultBase,
    setRepetitionPenaltyBase,
    setRepetitionPenaltyContextBase,
    setTextPromptBase,
    setVoicePromptBase,
    setRandomSeedBase,
  ]);

  const setTextTemperature = useCallback((value: number) => {
    if(value <= 1.2 || value >= 0.2) {
      setTextTemperatureBase(value);
    }
  }, []);
  const setTextTopk = useCallback((value: number) => {
    if(value <= 500 || value >= 10) {
      setTextTopkBase(value);
    }
  }, []);
  const setAudioTemperature = useCallback((value: number) => {
    if(value <= 1.2 || value >= 0.2) {
      setAudioTemperatureBase(value);
    }
  }, []);
  const setAudioTopk = useCallback((value: number) => {
    if(value <= 500 || value >= 10) {
      setAudioTopkBase(value);
    }
  }, []);
  const setPadMult = useCallback((value: number) => {
    if(value <= 4 || value >= -4) {
      setPadMultBase(value);
    }
  }, []);
  const setRepetitionPenalty = useCallback((value: number) => {
    if(value <= 2.0 || value >= 1.0) {
      setRepetitionPenaltyBase(value);
    }
  }, []);
  const setRepetitionPenaltyContext = useCallback((value: number) => {
    if(value <= 200|| value >= 0) {
      setRepetitionPenaltyContextBase(value);
    }
  }, []);
  const setTextPrompt = useCallback((value: string) => {
    setTextPromptBase(value);
  }, []);
  const setAdditionalText = useCallback((value: string) => {
    setAdditionalTextBase(value);
  }, []);
  const setPersonalityId = useCallback((value: string) => {
    setPersonalityIdBase(value);
  }, []);
  const setVoicePrompt = useCallback((value: string) => {
    setVoicePromptBase(value);
  }, []);
  const setRandomSeed = useCallback((value: number) => {
    setRandomSeedBase(value);
  }, []);

  return {
    textTemperature,
    textTopk,
    audioTemperature,
    audioTopk,
    padMult,
    repetitionPenalty,
    repetitionPenaltyContext,
    setTextTemperature,
    setTextTopk,
    setAudioTemperature,
    setAudioTopk,
    setPadMult,
    setRepetitionPenalty,
    setRepetitionPenaltyContext,
    setTextPrompt,
    textPrompt,
    setAdditionalText,
    additionalText,
    setPersonalityId,
    personalityId,
    setVoicePrompt,
    voicePrompt,
    resetParams,
    setParams,
    randomSeed,
    setRandomSeed,
  }
}
