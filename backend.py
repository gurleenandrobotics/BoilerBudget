import os
import base64
import requests
from flask import Flask, request, jsonify
from dotenv import load_dotenv

# Load environment variables from .env
load_dotenv()

app = Flask(__name__)
ELEVENLABS_API_KEY = os.getenv('ELEVENLABS_API_KEY')

if not ELEVENLABS_API_KEY:
    print("ERROR: ELEVENLABS_API_KEY not found in .env file!")

@app.route('/tts', methods=['POST'])
def text_to_speech():
    """
    Convert text to speech using ElevenLabs API
    Expected JSON body: { "text": "..." }
    """
    try:
        data = request.get_json()
        text = data.get('text', '').strip()

        if not text:
            return jsonify({'ok': False, 'error': 'No text provided'}), 400

        if not ELEVENLABS_API_KEY:
            return jsonify({'ok': False, 'error': 'API key not configured'}), 500

        # Call ElevenLabs API
        url = "https://api.elevenlabs.io/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM"  # Default voice
        headers = {
            "xi-api-key": ELEVENLABS_API_KEY,
            "Content-Type": "application/json"
        }
        payload = {
            "text": text,
            "model_id": "eleven_turbo_v2_5",  # Free tier compatible model
            "voice_settings": {
                "stability": 0.5,
                "similarity_boost": 0.75
            }
        }

        response = requests.post(url, json=payload, headers=headers)

        if response.status_code != 200:
            print(f"ElevenLabs API error: {response.status_code} - {response.text}")
            return jsonify({'ok': False, 'error': f'ElevenLabs API error: {response.status_code}'}), 500

        # Convert audio bytes to base64 data URL
        audio_data = base64.b64encode(response.content).decode('utf-8')
        audio_url = f"data:audio/mpeg;base64,{audio_data}"

        return jsonify({
            'ok': True,
            'audio': audio_url
        }), 200

    except Exception as e:
        print(f"TTS error: {str(e)}")
        return jsonify({'ok': False, 'error': str(e)}), 500

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({'status': 'ok', 'tts_configured': bool(ELEVENLABS_API_KEY)}), 200

if __name__ == '__main__':
    print("🎵 BoilerBudget TTS Backend starting on http://127.0.0.1:8000")
    print(f"API Key configured: {bool(ELEVENLABS_API_KEY)}")
    app.run(host='127.0.0.1', port=8000, debug=True)
