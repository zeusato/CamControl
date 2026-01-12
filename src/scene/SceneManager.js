/**
 * Three.js Scene Manager
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export class SceneManager {
    constructor(canvas) {
        this.canvas = canvas;
        this.scene = new THREE.Scene();
        this.objects = new Map();

        this.setupRenderer();
        this.setupCamera();
        this.setupControls();
        this.setupLights();
        this.setupHelpers();

        this.animate = this.animate.bind(this);
        this.handleResize = this.handleResize.bind(this);

        window.addEventListener('resize', this.handleResize);
        this.handleResize();
        this.animate();
    }

    setupRenderer() {
        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            antialias: true,
            alpha: true,
        });
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.setClearColor(0x0a0a0f, 1);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    }

    setupCamera() {
        const aspect = this.canvas.clientWidth / this.canvas.clientHeight;
        this.camera = new THREE.PerspectiveCamera(50, aspect, 0.1, 1000);
        this.camera.position.set(5, 3, 5);
        this.camera.lookAt(0, 0, 0);
    }

    setupControls() {
        this.controls = new OrbitControls(this.camera, this.canvas);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.minDistance = 2;
        this.controls.maxDistance = 20;
        this.controls.maxPolarAngle = Math.PI * 0.9;
    }

    setupLights() {
        // Ambient light
        const ambient = new THREE.AmbientLight(0xffffff, 0.4);
        this.scene.add(ambient);

        // Main directional light
        const directional = new THREE.DirectionalLight(0xffffff, 0.8);
        directional.position.set(5, 10, 5);
        directional.castShadow = true;
        directional.shadow.mapSize.width = 2048;
        directional.shadow.mapSize.height = 2048;
        this.scene.add(directional);

        // Fill light
        const fill = new THREE.DirectionalLight(0x6366f1, 0.3);
        fill.position.set(-5, 5, -5);
        this.scene.add(fill);
    }

    setupHelpers() {
        // Grid
        const grid = new THREE.GridHelper(10, 20, 0x303040, 0x202030);
        grid.position.y = -0.01;
        this.scene.add(grid);
        this.objects.set('grid', grid);

        // Axes helper (small, positioned at origin)
        const axes = new THREE.AxesHelper(0.5);
        axes.position.set(-4.5, 0, -4.5);
        this.scene.add(axes);
        this.objects.set('axes', axes);
    }

    handleResize() {
        const container = this.canvas.parentElement;
        const width = container.clientWidth;
        const height = container.clientHeight;

        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }

    animate() {
        requestAnimationFrame(this.animate);
        this.controls.update();
        this.renderer.render(this.scene, this.camera);
    }

    add(key, object) {
        if (this.objects.has(key)) {
            this.remove(key);
        }
        this.objects.set(key, object);
        this.scene.add(object);
    }

    remove(key) {
        const object = this.objects.get(key);
        if (object) {
            this.scene.remove(object);
            if (object.geometry) object.geometry.dispose();
            if (object.material) {
                if (Array.isArray(object.material)) {
                    object.material.forEach(m => m.dispose());
                } else {
                    object.material.dispose();
                }
            }
            this.objects.delete(key);
        }
    }

    get(key) {
        return this.objects.get(key);
    }

    dispose() {
        window.removeEventListener('resize', this.handleResize);
        this.controls.dispose();
        this.renderer.dispose();

        for (const [key] of this.objects) {
            this.remove(key);
        }
    }
}
