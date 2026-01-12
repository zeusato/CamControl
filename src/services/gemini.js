/**
 * Gemini API service for image analysis and prompt generation
 * Using @google/genai SDK
 */

import { GoogleGenAI } from '@google/genai';
import { getApiKey } from './storage.js';

const MODEL_ID = 'gemini-3-flash-preview';

let aiClient = null;

/**
 * Get or initialize the Gemini AI client
 */
async function getAIClient() {
    const apiKey = await getApiKey();

    if (!apiKey) {
        throw new Error('API key not configured. Please enter your Gemini API key.');
    }

    if (!aiClient) {
        aiClient = new GoogleGenAI({ apiKey });
    }

    return aiClient;
}

/**
 * Reset the AI client (call when API key changes)
 */
export function resetAIClient() {
    aiClient = null;
}

/**
 * Analyze an image to extract camera information
 * @param {string} imageBase64 - Base64 encoded image data (data URL format)
 * @returns {Promise<Object>} Camera information
 */
export async function analyzeImage(imageBase64) {
    const ai = await getAIClient();

    const prompt = `Analyze this image and determine the camera settings and position used to capture it. 
  
Please provide a detailed analysis in JSON format with the following structure:
{
  "distance": <estimated distance from camera to main subject in meters, as a number>,
  "focalLength": <estimated focal length in mm, as a number>,
  "pitch": <camera vertical angle in degrees, negative = looking down, positive = looking up>,
  "yaw": <camera horizontal angle in degrees, 0 = straight, negative = left, positive = right>,
  "roll": <camera roll/tilt in degrees>,
  "height": <camera height from ground in meters>,
  "shotType": "<type of shot: extreme close-up, close-up, medium close-up, medium shot, medium long shot, long shot, extreme long shot>",
  "angle": "<camera angle name: eye level, low angle, high angle, bird's eye, worm's eye, dutch angle>",
  "lens": "<lens type: wide, normal, telephoto, macro>",
  "description": "<detailed description of the camera position, angle, and framing in natural language>"
}

Respond ONLY with the JSON object, no additional text.`;

    // Extract base64 data and mime type
    const matches = imageBase64.match(/^data:(.+);base64,(.+)$/);
    if (!matches) {
        throw new Error('Invalid image data format');
    }

    const mimeType = matches[1];
    const base64Data = matches[2];

    try {
        const response = await ai.models.generateContent({
            model: MODEL_ID,
            contents: [
                {
                    role: 'user',
                    parts: [
                        {
                            inlineData: {
                                mimeType: mimeType,
                                data: base64Data,
                            },
                        },
                        { text: prompt },
                    ],
                },
            ],
            config: {
                temperature: 0.7,
                topK: 40,
                topP: 0.95,
                maxOutputTokens: 2048,
            },
        });

        const text = response.text || '';

        // Clean response and parse JSON
        const jsonStr = text.replace(/```json\n?|\n?```/g, '').trim();
        return JSON.parse(jsonStr);
    } catch (e) {
        console.error('Failed to analyze image:', e);

        // Check if it's a parsing error vs API error
        if (e.message?.includes('API key')) {
            throw e;
        }

        // Return default values on parse failure
        return {
            distance: 3,
            focalLength: 50,
            pitch: 0,
            yaw: 0,
            roll: 0,
            height: 1.6,
            shotType: 'medium shot',
            angle: 'eye level',
            lens: 'normal',
            description: 'Unable to analyze camera position',
        };
    }
}

/**
 * Generate a prompt describing a camera at a specific position
 * @param {Object} cameraState - Current camera state
 * @returns {Promise<string>} Camera position prompt
 */
export async function generatePositionPrompt(cameraState) {
    const ai = await getAIClient();

    const prompt = `You are an expert cinematographer helping to create prompts for AI image/video generation.

Based on the following camera parameters, write a concise prompt describing the camera position and framing for AI image generation:

IMPORTANT: The camera ALWAYS points toward the subject at the center. Pan and tilt values only indicate slight off-center adjustments.

Camera Parameters:
- Distance from subject: ${cameraState.distance.toFixed(2)} meters
- Horizontal orbit angle: ${cameraState.orbitH.toFixed(1)}° (0 = directly in front, positive = camera moved to the right of subject, negative = left)
- Vertical orbit angle: ${cameraState.orbitV.toFixed(1)}° (0 = eye level, positive = camera above looking down, negative = below looking up)
- Camera pan offset: ${cameraState.pan.toFixed(1)}° (slight horizontal look offset from subject center)
- Camera tilt offset: ${cameraState.tilt.toFixed(1)}° (slight vertical look offset from subject center)
- Original shot type: ${cameraState.originalShotType || 'medium shot'}
- Original angle: ${cameraState.originalAngle || 'eye level'}

Write a natural language prompt (2-3 sentences) that describes:
1. The camera position relative to the subject (e.g., "camera positioned to the right of subject", "low angle shot from below")
2. The camera angle and framing
3. Any notable perspective effects

The prompt should be suitable for use with AI image generation tools like Midjourney, DALL-E, or Stable Diffusion.

Respond with ONLY the prompt text, no explanations.`;

    const response = await ai.models.generateContent({
        model: MODEL_ID,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 1024,
        },
    });

    return response.text || '';
}

/**
 * Generate a prompt describing camera movement from one position to another
 * @param {Object} fromState - Starting camera state
 * @param {Object} toState - Ending camera state
 * @returns {Promise<string>} Camera movement prompt
 */
export async function generateMovementPrompt(fromState, toState) {
    const ai = await getAIClient();

    const prompt = `You are an expert cinematographer helping to create prompts for AI video generation.

Describe a camera movement from the starting position to the ending position.

IMPORTANT: The camera ALWAYS remains pointed at the subject throughout the movement. This is an orbit/arc movement around the subject, not a pan.

STARTING POSITION:
- Distance from subject: ${fromState.distance.toFixed(2)} meters
- Horizontal position: ${fromState.orbitH.toFixed(1)}° (0 = front, positive = right side, negative = left side)
- Vertical position: ${fromState.orbitV.toFixed(1)}° (0 = eye level, positive = above, negative = below)
- Look offset (pan): ${fromState.pan.toFixed(1)}°
- Look offset (tilt): ${fromState.tilt.toFixed(1)}°

ENDING POSITION:
- Distance from subject: ${toState.distance.toFixed(2)} meters
- Horizontal position: ${toState.orbitH.toFixed(1)}°
- Vertical position: ${toState.orbitV.toFixed(1)}°
- Look offset (pan): ${toState.pan.toFixed(1)}°
- Look offset (tilt): ${toState.tilt.toFixed(1)}°

Write a natural language prompt (2-4 sentences) that describes:
1. The starting camera position
2. The movement type (e.g., orbit/arc around subject, dolly in/out, crane up/down)
3. The ending camera position
4. The visual/cinematic effect this creates

The prompt should be suitable for use with AI video generation tools like Runway, Pika, or Sora.

Respond with ONLY the prompt text, no explanations.`;

    const response = await ai.models.generateContent({
        model: MODEL_ID,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 1024,
        },
    });

    return response.text || '';
}
