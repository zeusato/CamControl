# 📷 CamPrompt - Camera Prompt Generator

A web tool for generating AI camera control prompts using 3D visualization. Import an image, and the tool analyzes camera position using Gemini AI, then lets you manipulate a virtual camera to generate prompts for AI image/video generation.

![CamPrompt Preview](https://raw.githubusercontent.com/zeusato/CamControl/main/preview.png)

## ✨ Features

- **AI Image Analysis** - Automatically detects camera angle, distance, shot type from uploaded images
- **3D Visualization** - Interactive Three.js scene showing camera position and viewport
- **Camera Controls** - Orbit, zoom, pan, and tilt the virtual camera
- **Viewport Preview** - Green frame shows new camera's field of view
- **Prompt Generation** - Creates prompts for both static position and camera movement
- **Copy to Clipboard** - Quick copy buttons for generated prompts
- **Responsive Design** - Works on desktop and mobile

## 🚀 Live Demo

👉 [https://zeusato.github.io/CamControl/](https://zeusato.github.io/CamControl/)

## 🛠️ Tech Stack

- **Vite** - Build tool
- **Three.js** - 3D visualization
- **Google Gemini API** - AI image analysis & prompt generation
- **Vanilla JS** - No framework dependencies

## 📋 Usage

1. Click the ⚙️ button to enter your Gemini API key
2. Upload an image (drag & drop or click)
3. Wait for AI analysis (shows detected camera info)
4. Use sliders to adjust virtual camera position
5. Click "Generate Prompts" to create camera prompts
6. Copy prompts for use with Midjourney, DALL-E, Runway, etc.

## 🔧 Development

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build
```

## 📄 License

MIT License - feel free to use and modify!

## 🙏 Credits

Built with [Gemini API](https://ai.google.dev/) and [Three.js](https://threejs.org/)
