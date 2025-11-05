"""
Unified FastAPI service for:
- Handling Twilio voice calls
- Running ML-based answering machine detection (AMD)
"""

from fastapi import FastAPI, Request, File, UploadFile, HTTPException
from fastapi.responses import Response, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from twilio.twiml.voice_response import VoiceResponse
import requests
import numpy as np
import io
import wave
import os
import logging
from typing import Optional

# ------------------ Logging ------------------
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ------------------ App Init ------------------
app = FastAPI(title="Twilio + AMD ML Service", version="2.1")

# Enable CORS (for frontend or external access)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ------------------ ML Model Loading ------------------
hf_model = None
hf_processor = None

def load_huggingface_model():
    """Load Hugging Face Wav2Vec model"""
    global hf_model, hf_processor
    try:
        from transformers import Wav2Vec2ForSequenceClassification, Wav2Vec2Processor
        model_name = "jakeBland/wav2vec-vm-finetune"
        # Note: Model loading is optional - service will work without it
        # Only needed for 'huggingface' AMD strategy
        hf_processor = Wav2Vec2Processor.from_pretrained(model_name)
        hf_model = Wav2Vec2ForSequenceClassification.from_pretrained(model_name)
        hf_model.eval()
        logger.info("✅ Hugging Face model loaded successfully")
    except Exception as e:
        logger.warning(f"⚠️ HuggingFace model not available: {e}")
        logger.info("ℹ️ Service will continue without HuggingFace model (Gemini strategy still works)")
        hf_model = None
        hf_processor = None

@app.on_event("startup")
async def startup_event():
    load_huggingface_model()

# ------------------ Utility ------------------
def parse_wav(audio_bytes: bytes):
    wav_file = wave.open(io.BytesIO(audio_bytes), 'rb')
    frames = wav_file.readframes(-1)
    sample_rate = wav_file.getframerate()
    n_channels = wav_file.getnchannels()
    sampwidth = wav_file.getsampwidth()
    wav_file.close()

    if sampwidth == 1:
        dtype = np.uint8
        audio_data = np.frombuffer(frames, dtype=dtype).astype(np.float32)
        audio_data = (audio_data - 128) / 128.0
    elif sampwidth == 2:
        dtype = np.int16
        audio_data = np.frombuffer(frames, dtype=dtype).astype(np.float32)
        audio_data = audio_data / 32768.0
    else:
        raise ValueError(f"Unsupported sample width: {sampwidth}")

    if n_channels == 2:
        audio_data = audio_data[::2]

    return audio_data, sample_rate

# ------------------ ML Prediction Endpoint ------------------
@app.post("/api/predict")
async def predict_huggingface(file: UploadFile = File(...)):
    if hf_model is None or hf_processor is None:
        raise HTTPException(status_code=503, detail="Model not loaded")

    try:
        audio_bytes = await file.read()
        audio_data, sample_rate = parse_wav(audio_bytes)

        if sample_rate != 16000:
            from scipy import signal
            audio_data = signal.resample(audio_data, int(len(audio_data) * 16000 / sample_rate))

        inputs = hf_processor(audio_data, sampling_rate=16000, return_tensors="pt", padding=True)

        import torch
        with torch.no_grad():
            logits = hf_model(**inputs).logits
            predicted_ids = torch.argmax(logits, dim=-1)
            transcription = hf_processor.batch_decode(predicted_ids)[0].lower()

        # Calculate confidence from logits using softmax
        import torch.nn.functional as F
        probs = F.softmax(logits, dim=-1)[0]
        confidence = float(torch.max(probs).item())
        
        # Get predicted class (0 = voicemail, 1 = human typically)
        predicted_class = int(predicted_ids[0].item())
        
        # Simple rule: voicemail greetings often contain "please", "leave", or "message"
        # Also check model prediction if available
        if any(word in transcription for word in ["please", "leave", "message", "voicemail"]):
            label = "voicemail"
            # Boost confidence if transcription matches
            confidence = max(confidence, 0.85)
        else:
            label = "human"
            # Use model prediction if high confidence
            if predicted_class == 1 and confidence > 0.7:
                label = "human"
            elif predicted_class == 0 and confidence > 0.7:
                label = "voicemail"

        return JSONResponse({
            "label": label,
            "confidence": confidence,
            "transcription": transcription
        })

    except Exception as e:
        logger.error(f"Prediction error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ------------------ Twilio Voice Webhooks ------------------
@app.post("/voice")
async def handle_incoming_call(request: Request):
    response = VoiceResponse()
    response.say("Hello! Please leave a short message after the beep.")
    response.record(
        max_length=10,
        play_beep=True,
        action="/process_recording",
        method="POST"
    )
    response.say("Thank you. Goodbye!")
    return Response(content=str(response), media_type="text/xml")

@app.post("/process_recording")
async def process_recording(request: Request):
    form = await request.form()
    recording_url = form.get("RecordingUrl")
    logger.info(f"🎙️ New recording received: {recording_url}")

    if not recording_url:
        return Response("<Response><Say>No recording URL provided.</Say></Response>", media_type="text/xml")

    try:
        audio_data = requests.get(recording_url + ".wav", timeout=10)
        audio_data.raise_for_status()
    except Exception as e:
        logger.error(f"Recording download failed: {e}")
        return Response("<Response><Say>Could not download recording.</Say></Response>", media_type="text/xml")

    try:
        files = {"file": ("recording.wav", audio_data.content, "audio/wav")}
        r = requests.post("http://localhost:8000/api/predict", files=files, timeout=30)
        result = r.json()
        label = result.get("label", "unknown")
    except Exception as e:
        logger.error(f"Prediction request failed: {e}")
        label = "error"

    response = VoiceResponse()
    if label == "human":
        response.say("The system detected a human voice.")
    elif label == "voicemail":
        response.say("The system detected a voicemail greeting.")
    else:
        response.say("Sorry, we could not classify the recording.")
    response.hangup()
    return Response(content=str(response), media_type="text/xml")

# ------------------ Gemini AMD Endpoint ------------------
@app.post("/api/gemini/predict")
async def predict_gemini(file: UploadFile = File(...)):
    """Use Google Gemini 2.5 Flash Live API for multimodal audio analysis"""
    gemini_api_key = os.getenv("GEMINI_API_KEY")
    
    if not gemini_api_key:
        raise HTTPException(
            status_code=503, 
            detail="Gemini API key not configured. Set GEMINI_API_KEY environment variable."
        )
    
    try:
        import google.generativeai as genai
        import base64
        
        # Configure Gemini
        genai.configure(api_key=gemini_api_key)
        
        # Read audio file
        audio_bytes = await file.read()
        
        # Convert to base64 for Gemini API
        audio_base64 = base64.b64encode(audio_bytes).decode('utf-8')
        audio_mime_type = "audio/wav"
        
        # Initialize Gemini model (using flash for speed)
        model = genai.GenerativeModel('gemini-2.0-flash-exp')
        
        # Create prompt for AMD detection
        prompt = """Analyze this audio clip and determine if it's a human speaking or an answering machine/voicemail greeting.
        
        Answer in JSON format:
        {
            "label": "human" or "voicemail",
            "confidence": 0.0-1.0,
            "reasoning": "brief explanation"
        }
        
        Indicators of voicemail:
        - Formal greeting patterns
        - Phrases like "please leave a message", "after the beep", "at the tone"
        - Robotic or recorded voice quality
        - Long pauses before speaking
        
        Indicators of human:
        - Natural speech patterns
        - Casual greetings ("hello?", "hi", "yeah")
        - Background noise or interruptions
        - Immediate response"""
        
        # For noisy audio, use a more robust prompt
        fallback_prompt = """Analyze this audio. If quality is poor or unclear, default to "human" with lower confidence.
        Return JSON: {"label": "human"|"voicemail", "confidence": 0.0-1.0, "reasoning": "..."}"""
        
        try:
            # Try with audio file upload (Gemini supports file uploads)
            audio_file = genai.upload_file(
                data=audio_bytes,
                mime_type=audio_mime_type
            )
            
            # Generate content with multimodal input
            response = model.generate_content([prompt, audio_file])
            
            # Parse response
            response_text = response.text.strip()
            
            # Try to extract JSON from response
            import json
            import re
            
            # Look for JSON in the response
            json_match = re.search(r'\{[^}]+\}', response_text)
            if json_match:
                result = json.loads(json_match.group())
            else:
                # Fallback: parse text response
                label = "human"
                confidence = 0.5
                if "voicemail" in response_text.lower() or "machine" in response_text.lower():
                    label = "voicemail"
                    confidence = 0.75
                elif "human" in response_text.lower():
                    confidence = 0.80
                
                result = {
                    "label": label,
                    "confidence": confidence,
                    "reasoning": response_text
                }
            
            # Clean up uploaded file
            genai.delete_file(audio_file.name)
            
        except Exception as e:
            logger.warning(f"Gemini API error, using fallback: {e}")
            # Fallback: use text-only analysis if audio fails
            response = model.generate_content([fallback_prompt, f"Audio file: {len(audio_bytes)} bytes, {audio_mime_type}"])
            result = {
                "label": "human",
                "confidence": 0.5,
                "reasoning": "Fallback due to API error: " + str(e)
            }
        
        # Map to expected format
        label = result.get("label", "human").lower()
        if label not in ["human", "voicemail"]:
            label = "human"  # Default to human
        
        return JSONResponse({
            "label": label,
            "confidence": float(result.get("confidence", 0.5)),
            "rawData": result
        })
        
    except Exception as e:
        logger.error(f"Gemini prediction error: {e}")
        raise HTTPException(status_code=500, detail=f"Gemini API error: {str(e)}")

# ------------------ Root ------------------
@app.get("/")
async def root():
    return {"status": "Twilio + ML AMD service running ✅"}

# ------------------ Run ------------------
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
