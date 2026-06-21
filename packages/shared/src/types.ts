export interface TranslationPayload {
  sequenceNumber: number;
  rawText: string;
  translatedText: string;
  timestamp: number;
}

export interface TranslationResponse {
  translated_text: string;
}
