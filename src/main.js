/**
 * Camera Prompt Generator - Main Application
 */

import './style.css';
import { SceneManager } from './scene/SceneManager.js';
import { CameraRig } from './scene/CameraRig.js';
import { ImagePlane } from './scene/ImagePlane.js';
import { saveApiKey, getApiKey } from './services/storage.js';
import { analyzeImage, generatePositionPrompt, generateMovementPrompt, resetAIClient } from './services/gemini.js';

class App {
  constructor() {
    this.sceneManager = null;
    this.cameraRig = null;
    this.imagePlane = null;
    this.imageData = null;
    this.isAnalyzed = false;

    this.init();
  }

  async init() {
    // Initialize Three.js scene
    const canvas = document.getElementById('three-canvas');
    this.sceneManager = new SceneManager(canvas);
    this.imagePlane = new ImagePlane(this.sceneManager);
    this.cameraRig = new CameraRig(this.sceneManager);
    this.cameraRig.setVisible(false);

    // Setup UI event listeners
    this.setupApiKeyUI();
    this.setupImageUpload();
    this.setupCameraControls();
    this.setupOutputPanel();
    this.setupMobileNav();
  }

  // ================== Settings Modal ==================
  setupApiKeyUI() {
    const settingsBtn = document.getElementById('settings-btn');
    const modal = document.getElementById('settings-modal');
    const closeBtn = document.getElementById('close-modal');
    const cancelBtn = document.getElementById('cancel-modal');
    const input = document.getElementById('api-key-input');
    const toggleBtn = document.getElementById('toggle-api-key');
    const saveBtn = document.getElementById('save-api-key');
    const apiStatus = document.getElementById('api-status');

    // Open modal
    settingsBtn.addEventListener('click', async () => {
      modal.style.display = 'flex';
      // Check if API key exists
      const existingKey = await getApiKey();
      if (existingKey) {
        input.value = '••••••••••••••••';
        input.dataset.hasKey = 'true';
        apiStatus.className = 'api-status connected';
        apiStatus.innerHTML = '✅ API Key is configured';
      } else {
        input.value = '';
        input.dataset.hasKey = 'false';
        apiStatus.className = 'api-status disconnected';
        apiStatus.innerHTML = '⚠️ No API Key configured';
      }
    });

    // Close modal
    const closeModal = () => {
      modal.style.display = 'none';
      input.type = 'password';
      toggleBtn.textContent = '👁️';
    };

    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);

    // Close on overlay click
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal.style.display === 'flex') {
        closeModal();
      }
    });

    // Toggle visibility
    toggleBtn.addEventListener('click', () => {
      if (input.type === 'password') {
        input.type = 'text';
        toggleBtn.textContent = '🙈';
      } else {
        input.type = 'password';
        toggleBtn.textContent = '👁️';
      }
    });

    // Save API key
    saveBtn.addEventListener('click', async () => {
      const key = input.value.trim();
      if (key && key !== '••••••••••••••••') {
        try {
          await saveApiKey(key);
          resetAIClient(); // Reset client to use new key
          input.value = '••••••••••••••••';
          input.dataset.hasKey = 'true';
          apiStatus.className = 'api-status connected';
          apiStatus.innerHTML = '✅ API Key saved successfully!';
          this.showToast('API key saved!', 'success');

          // Close modal after short delay
          setTimeout(closeModal, 1000);
        } catch (e) {
          this.showToast('Failed to save API key', 'error');
        }
      } else if (!input.dataset.hasKey || input.dataset.hasKey === 'false') {
        this.showToast('Please enter an API key', 'error');
      }
    });

    // Clear placeholder on focus
    input.addEventListener('focus', () => {
      if (input.dataset.hasKey === 'true') {
        input.value = '';
      }
    });
  }

  // ================== Image Upload ==================
  setupImageUpload() {
    const uploadArea = document.getElementById('upload-area');
    const fileInput = document.getElementById('file-input');
    const imagePreview = document.getElementById('image-preview');
    const previewImg = document.getElementById('preview-img');
    const removeBtn = document.getElementById('remove-image');

    // Click to upload
    uploadArea.addEventListener('click', () => {
      fileInput.click();
    });

    // Drag and drop
    uploadArea.addEventListener('dragover', (e) => {
      e.preventDefault();
      uploadArea.classList.add('dragover');
    });

    uploadArea.addEventListener('dragleave', () => {
      uploadArea.classList.remove('dragover');
    });

    uploadArea.addEventListener('drop', (e) => {
      e.preventDefault();
      uploadArea.classList.remove('dragover');
      const file = e.dataTransfer.files[0];
      if (file && file.type.startsWith('image/')) {
        this.handleImageFile(file);
      }
    });

    // File input change
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        this.handleImageFile(file);
      }
    });

    // Remove image
    removeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.clearImage();
    });
  }

  async handleImageFile(file) {
    const reader = new FileReader();

    reader.onload = async (e) => {
      const imageDataUrl = e.target.result;
      this.imageData = imageDataUrl;

      // Show preview
      document.getElementById('preview-img').src = imageDataUrl;
      document.getElementById('upload-area').style.display = 'none';
      document.getElementById('image-preview').style.display = 'block';

      // Load into 3D scene
      try {
        const aspectRatio = await this.imagePlane.loadImage(imageDataUrl);
        this.cameraRig.setAspectRatio(aspectRatio);

        // Pass image size to camera rig for viewport frame
        const size = this.imagePlane.getSize();
        this.cameraRig.setImageSize(size.width, size.height);

        // Analyze image
        await this.analyzeImageWithAI();
      } catch (error) {
        console.error('Failed to load image:', error);
        this.showToast('Failed to load image', 'error');
      }
    };

    reader.readAsDataURL(file);
  }

  async analyzeImageWithAI() {
    this.showLoading('Analyzing image with AI...');

    try {
      const cameraInfo = await analyzeImage(this.imageData);

      // Update camera info display
      this.displayCameraInfo(cameraInfo);

      // Initialize camera rig with analyzed data
      this.cameraRig.setInitialState(cameraInfo);
      this.cameraRig.setVisible(true);

      // Update UI state
      this.isAnalyzed = true;
      this.updateControlsFromState();

      // Show controls section
      document.getElementById('camera-info-section').style.display = 'block';
      document.getElementById('controls-section').style.display = 'block';
      document.getElementById('generate-btn').disabled = false;

      // Hide overlays
      this.hideLoading();
      document.getElementById('viewport-overlay').style.display = 'none';

      this.showToast('Image analyzed successfully!', 'success');
    } catch (error) {
      console.error('Failed to analyze image:', error);
      this.hideLoading();
      this.showToast(error.message || 'Failed to analyze image', 'error');
    }
  }

  displayCameraInfo(info) {
    const container = document.getElementById('camera-info');
    container.innerHTML = `
      <div class="info-item">
        <div class="label">Shot Type</div>
        <div class="value">${info.shotType || 'N/A'}</div>
      </div>
      <div class="info-item">
        <div class="label">Angle</div>
        <div class="value">${info.angle || 'N/A'}</div>
      </div>
      <div class="info-item">
        <div class="label">Distance</div>
        <div class="value">${info.distance?.toFixed(1) || 'N/A'}m</div>
      </div>
      <div class="info-item">
        <div class="label">Focal Length</div>
        <div class="value">${info.focalLength || 'N/A'}mm</div>
      </div>
      <div class="info-item">
        <div class="label">Lens</div>
        <div class="value">${info.lens || 'N/A'}</div>
      </div>
      <div class="info-item">
        <div class="label">Height</div>
        <div class="value">${info.height?.toFixed(1) || 'N/A'}m</div>
      </div>
    `;
  }

  clearImage() {
    this.imageData = null;
    this.isAnalyzed = false;

    // Reset UI
    document.getElementById('upload-area').style.display = 'block';
    document.getElementById('image-preview').style.display = 'none';
    document.getElementById('camera-info-section').style.display = 'none';
    document.getElementById('controls-section').style.display = 'none';
    document.getElementById('generate-btn').disabled = true;
    document.getElementById('viewport-overlay').style.display = 'flex';

    // Clear 3D scene
    this.imagePlane.dispose();
    this.cameraRig.setVisible(false);

    // Clear outputs
    document.getElementById('position-prompt').innerHTML = '<p class="placeholder-text">Generate a prompt to see the camera position description...</p>';
    document.getElementById('movement-prompt').innerHTML = '<p class="placeholder-text">Generate a prompt to see the camera movement description...</p>';
    document.getElementById('copy-position').disabled = true;
    document.getElementById('copy-movement').disabled = true;
  }

  // ================== Camera Controls ==================
  setupCameraControls() {
    const distanceSlider = document.getElementById('distance-slider');
    const orbitHSlider = document.getElementById('orbit-h-slider');
    const orbitVSlider = document.getElementById('orbit-v-slider');
    const panSlider = document.getElementById('pan-slider');
    const tiltSlider = document.getElementById('tilt-slider');
    const resetBtn = document.getElementById('reset-camera');

    // Distance
    distanceSlider.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value);
      document.getElementById('distance-value').textContent = value.toFixed(1);
      this.cameraRig.updateState({ distance: value });
    });

    // Orbit Horizontal
    orbitHSlider.addEventListener('input', (e) => {
      const value = parseInt(e.target.value);
      document.getElementById('orbit-h-value').textContent = `${value}°`;
      this.cameraRig.updateState({ orbitH: value });
    });

    // Orbit Vertical
    orbitVSlider.addEventListener('input', (e) => {
      const value = parseInt(e.target.value);
      document.getElementById('orbit-v-value').textContent = `${value}°`;
      this.cameraRig.updateState({ orbitV: value });
    });

    // Pan
    panSlider.addEventListener('input', (e) => {
      const value = parseInt(e.target.value);
      document.getElementById('pan-value').textContent = `${value}°`;
      this.cameraRig.updateState({ pan: value });
    });

    // Tilt
    tiltSlider.addEventListener('input', (e) => {
      const value = parseInt(e.target.value);
      document.getElementById('tilt-value').textContent = `${value}°`;
      this.cameraRig.updateState({ tilt: value });
    });

    // Reset
    resetBtn.addEventListener('click', () => {
      this.cameraRig.resetToOriginal();
      this.updateControlsFromState();
    });

    // Generate button
    document.getElementById('generate-btn').addEventListener('click', () => {
      this.generatePrompts();
    });
  }

  updateControlsFromState() {
    const state = this.cameraRig.getState();

    document.getElementById('distance-slider').value = state.distance;
    document.getElementById('distance-value').textContent = state.distance.toFixed(1);

    document.getElementById('orbit-h-slider').value = state.orbitH;
    document.getElementById('orbit-h-value').textContent = `${state.orbitH.toFixed(0)}°`;

    document.getElementById('orbit-v-slider').value = state.orbitV;
    document.getElementById('orbit-v-value').textContent = `${state.orbitV.toFixed(0)}°`;

    document.getElementById('pan-slider').value = state.pan;
    document.getElementById('pan-value').textContent = `${state.pan}°`;

    document.getElementById('tilt-slider').value = state.tilt;
    document.getElementById('tilt-value').textContent = `${state.tilt}°`;
  }

  // ================== Prompt Generation ==================
  async generatePrompts() {
    if (!this.isAnalyzed) return;

    this.showLoading('Generating prompts...');

    try {
      const currentState = this.cameraRig.getState();
      const originalState = this.cameraRig.getOriginalState();

      // Generate both prompts in parallel
      const [positionPrompt, movementPrompt] = await Promise.all([
        generatePositionPrompt(currentState),
        generateMovementPrompt(originalState, currentState),
      ]);

      // Display results
      document.getElementById('position-prompt').textContent = positionPrompt;
      document.getElementById('movement-prompt').textContent = movementPrompt;

      // Enable copy buttons
      document.getElementById('copy-position').disabled = false;
      document.getElementById('copy-movement').disabled = false;

      this.hideLoading();
      this.showToast('Prompts generated!', 'success');
    } catch (error) {
      console.error('Failed to generate prompts:', error);
      this.hideLoading();
      this.showToast(error.message || 'Failed to generate prompts', 'error');
    }
  }

  // ================== Output Panel ==================
  setupOutputPanel() {
    const copyPositionBtn = document.getElementById('copy-position');
    const copyMovementBtn = document.getElementById('copy-movement');

    copyPositionBtn.addEventListener('click', () => {
      const text = document.getElementById('position-prompt').textContent;
      this.copyToClipboard(text, copyPositionBtn);
    });

    copyMovementBtn.addEventListener('click', () => {
      const text = document.getElementById('movement-prompt').textContent;
      this.copyToClipboard(text, copyMovementBtn);
    });
  }

  async copyToClipboard(text, button) {
    try {
      await navigator.clipboard.writeText(text);
      button.classList.add('copied');
      button.textContent = '✓ Copied';

      setTimeout(() => {
        button.classList.remove('copied');
        button.textContent = '📋 Copy';
      }, 2000);
    } catch (e) {
      this.showToast('Failed to copy', 'error');
    }
  }

  // ================== Mobile Navigation ==================
  setupMobileNav() {
    const mobileNav = document.getElementById('mobile-nav');
    const sidebar = document.getElementById('sidebar');
    const viewport = document.querySelector('.viewport');
    const outputPanel = document.getElementById('output-panel');
    const buttons = mobileNav.querySelectorAll('.mobile-nav-btn');

    buttons.forEach(btn => {
      btn.addEventListener('click', () => {
        const panel = btn.dataset.panel;

        // Update active button
        buttons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // Hide all panels
        sidebar.classList.remove('active');
        outputPanel.classList.remove('active');
        viewport.classList.remove('hidden');

        // Show selected panel
        if (panel === 'sidebar') {
          sidebar.classList.add('active');
          viewport.classList.add('hidden');
        } else if (panel === 'output') {
          outputPanel.classList.add('active');
          viewport.classList.add('hidden');
        }

        // Trigger resize for Three.js
        window.dispatchEvent(new Event('resize'));
      });
    });
  }

  // ================== Utilities ==================
  showLoading(message) {
    document.getElementById('loading-text').textContent = message;
    document.getElementById('loading-overlay').style.display = 'flex';
  }

  hideLoading() {
    document.getElementById('loading-overlay').style.display = 'none';
  }

  showToast(message, type = 'info') {
    // Create toast element
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed;
      bottom: 80px;
      left: 50%;
      transform: translateX(-50%);
      background: ${type === 'success' ? '#22c55e' : type === 'error' ? '#ef4444' : '#6366f1'};
      color: white;
      padding: 12px 24px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      z-index: 1000;
      animation: slideUp 0.3s ease;
    `;

    document.body.appendChild(toast);

    // Add animation keyframes if not exists
    if (!document.getElementById('toast-styles')) {
      const style = document.createElement('style');
      style.id = 'toast-styles';
      style.textContent = `
        @keyframes slideUp {
          from { opacity: 0; transform: translateX(-50%) translateY(20px); }
          to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `;
      document.head.appendChild(style);
    }

    // Remove after 3s
    setTimeout(() => {
      toast.style.animation = 'slideUp 0.3s ease reverse';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }
}

// Initialize app
new App();
