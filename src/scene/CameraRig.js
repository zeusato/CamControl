/**
 * Camera Rig - Handles camera visualization and controls
 * With viewport preview frame correctly intersecting image plane
 */

import * as THREE from 'three';

export class CameraRig {
    constructor(sceneManager) {
        this.sceneManager = sceneManager;

        // Camera state
        this.state = {
            distance: 3,
            orbitH: 0,    // Horizontal orbit angle (degrees)
            orbitV: 0,    // Vertical orbit angle (degrees)
            pan: 0,       // Camera pan offset (degrees)
            tilt: 0,      // Camera tilt offset (degrees)
        };

        // Original state (from image analysis)
        this.originalState = { ...this.state };

        // Image dimensions
        this.aspectRatio = 16 / 9;
        this.imageWidth = 2;
        this.imageHeight = 2;

        // Create camera group
        this.group = new THREE.Group();

        this.createCameraModel();
        this.createFrustumLines();
        this.createViewportFrame();
        this.createOrbitPath();

        sceneManager.add('cameraRig', this.group);
    }

    createCameraModel() {
        // Camera body - more visible
        const bodyGeometry = new THREE.BoxGeometry(0.2, 0.15, 0.25);
        const bodyMaterial = new THREE.MeshStandardMaterial({
            color: 0x6366f1,
            metalness: 0.5,
            roughness: 0.3,
            emissive: 0x6366f1,
            emissiveIntensity: 0.2,
        });
        this.body = new THREE.Mesh(bodyGeometry, bodyMaterial);

        // Camera lens (cone pointing forward)
        const lensGeometry = new THREE.ConeGeometry(0.08, 0.15, 16);
        const lensMaterial = new THREE.MeshStandardMaterial({
            color: 0x111111,
            metalness: 0.9,
            roughness: 0.1,
        });
        this.lens = new THREE.Mesh(lensGeometry, lensMaterial);
        this.lens.rotation.x = -Math.PI / 2;
        this.lens.position.z = -0.2;

        // Camera pivot (for pan/tilt)
        this.cameraPivot = new THREE.Group();
        this.cameraPivot.add(this.body);
        this.cameraPivot.add(this.lens);

        // Camera arm (connects to orbit position)
        this.cameraArm = new THREE.Group();
        this.cameraArm.add(this.cameraPivot);

        this.group.add(this.cameraArm);
    }

    createFrustumLines() {
        // Create lines from camera to the corners of the viewport
        const material = new THREE.LineBasicMaterial({
            color: 0x8b5cf6,
            transparent: true,
            opacity: 0.6,
        });

        // 4 lines from camera to corners
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(4 * 2 * 3); // 4 lines, 2 points each, 3 coords
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

        this.frustumLines = new THREE.LineSegments(geometry, material);
        this.group.add(this.frustumLines);
    }

    createViewportFrame() {
        // The viewport frame shows what the camera sees on the image plane
        const material = new THREE.LineBasicMaterial({
            color: 0x22c55e, // Green for visibility
            linewidth: 2,
        });

        // Create a rectangle (5 points to close the loop)
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(5 * 3);
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

        this.viewportFrame = new THREE.Line(geometry, material);
        this.group.add(this.viewportFrame);

        // Semi-transparent plane to show the viewport area
        const planeGeometry = new THREE.PlaneGeometry(1, 1);
        const planeMaterial = new THREE.MeshBasicMaterial({
            color: 0x22c55e,
            transparent: true,
            opacity: 0.15,
            side: THREE.DoubleSide,
        });
        this.viewportPlane = new THREE.Mesh(planeGeometry, planeMaterial);
        this.group.add(this.viewportPlane);
    }

    createOrbitPath() {
        // Create a circle showing the orbit path at current distance
        const segments = 64;
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array((segments + 1) * 3);

        for (let i = 0; i <= segments; i++) {
            const theta = (i / segments) * Math.PI * 2;
            positions[i * 3] = Math.cos(theta);
            positions[i * 3 + 1] = 0;
            positions[i * 3 + 2] = Math.sin(theta);
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

        const material = new THREE.LineBasicMaterial({
            color: 0x6366f1,
            transparent: true,
            opacity: 0.3,
        });

        this.orbitPath = new THREE.Line(geometry, material);
        this.group.add(this.orbitPath);
    }

    setAspectRatio(ratio) {
        this.aspectRatio = ratio;
        this.updateViewportFrame();
    }

    setImageSize(width, height) {
        this.imageWidth = width;
        this.imageHeight = height;
        this.updateViewportFrame();
    }

    setInitialState(cameraInfo) {
        // Set initial state from image analysis
        this.state = {
            distance: cameraInfo.distance || 3,
            orbitH: cameraInfo.yaw || 0,
            orbitV: cameraInfo.pitch || 0,
            pan: 0,
            tilt: 0,
        };

        // Store original state
        this.originalState = { ...this.state };
        this.originalShotType = cameraInfo.shotType;
        this.originalAngle = cameraInfo.angle;

        this.updatePosition();
    }

    updateState(newState) {
        Object.assign(this.state, newState);
        this.updatePosition();
    }

    updatePosition() {
        const { distance, orbitH, orbitV, pan, tilt } = this.state;

        // Convert degrees to radians
        const theta = THREE.MathUtils.degToRad(orbitH);
        const phi = THREE.MathUtils.degToRad(orbitV);

        // Calculate position on sphere (spherical to cartesian)
        // Camera orbits around origin where image is placed
        const x = distance * Math.cos(phi) * Math.sin(theta);
        const y = distance * Math.sin(phi);
        const z = distance * Math.cos(phi) * Math.cos(theta);

        this.cameraArm.position.set(x, y, z);

        // Camera ALWAYS looks at origin (subject) by default
        this.cameraArm.lookAt(0, 0, 0);

        // Apply pan/tilt offsets (camera looks slightly off-center)
        this.cameraPivot.rotation.y = THREE.MathUtils.degToRad(pan);
        this.cameraPivot.rotation.x = THREE.MathUtils.degToRad(tilt);

        // Update orbit path scale
        this.orbitPath.scale.setScalar(distance);

        // Update viewport frame
        this.updateViewportFrame();

        // Update frustum lines
        this.updateFrustumLines();
    }

    updateViewportFrame() {
        const { distance, orbitH, orbitV, pan, tilt } = this.state;

        // Camera position
        const theta = THREE.MathUtils.degToRad(orbitH);
        const phi = THREE.MathUtils.degToRad(orbitV);
        const camX = distance * Math.cos(phi) * Math.sin(theta);
        const camY = distance * Math.sin(phi);
        const camZ = distance * Math.cos(phi) * Math.cos(theta);
        const camPos = new THREE.Vector3(camX, camY, camZ);

        // Camera look direction (towards origin, then apply pan/tilt)
        const lookDir = new THREE.Vector3(-camX, -camY, -camZ).normalize();

        // Apply pan/tilt rotation to look direction
        const panRad = THREE.MathUtils.degToRad(pan);
        const tiltRad = THREE.MathUtils.degToRad(tilt);

        // Create a basis for the camera
        const forward = lookDir.clone();
        const worldUp = new THREE.Vector3(0, 1, 0);
        const right = new THREE.Vector3().crossVectors(forward, worldUp).normalize();
        const up = new THREE.Vector3().crossVectors(right, forward).normalize();

        // Rotate forward direction by pan (around up) and tilt (around right)
        const panQuat = new THREE.Quaternion().setFromAxisAngle(up, panRad);
        const tiltQuat = new THREE.Quaternion().setFromAxisAngle(right, tiltRad);
        forward.applyQuaternion(panQuat).applyQuaternion(tiltQuat);

        // Image plane is at z=0, but we need to handle camera on either side
        // Calculate intersection of camera ray with z=0 plane
        const planeZ = 0;

        // For viewport, we need to find where the camera's view cone intersects the image plane
        // Using a reasonable FOV calculation
        const fov = 50;
        const halfFovRad = THREE.MathUtils.degToRad(fov / 2);

        // Distance from camera to image plane along the camera's forward direction
        // Project camera position onto the plane normal (z-axis)
        const distToPlane = Math.abs(camZ);

        if (distToPlane < 0.1) {
            // Camera too close to or at the image plane
            this.viewportFrame.visible = false;
            this.viewportPlane.visible = false;
            return;
        }

        this.viewportFrame.visible = true;
        this.viewportPlane.visible = true;

        // Calculate viewport size at the image plane
        // At the initial position, viewport should match image size
        // FOV determines how much of the scene the camera sees
        const baseViewHeight = 2 * Math.tan(halfFovRad) * distToPlane;
        const baseViewWidth = baseViewHeight * this.aspectRatio;

        // Scale factor to make default viewport match image (plus small margin)
        const marginFactor = 1.1; // 10% larger than image for visibility
        const scaleToMatchImage = (this.imageHeight * marginFactor) / baseViewHeight;

        // Apply scale but cap it so viewport doesn't get too small when zoomed out
        const minScale = 0.5;
        const maxScale = 2.0;
        const viewScale = Math.max(minScale, Math.min(maxScale, scaleToMatchImage));

        // Final viewport dimensions
        const viewHeight = baseViewHeight * viewScale;
        const viewWidth = viewHeight * this.aspectRatio;

        // Calculate center position of viewport on the image plane
        // When camera moves, the center shifts based on the camera position and look direction
        // Project the center ray to z=0
        const centerX = camX + (forward.x / forward.z) * (-camZ);
        const centerY = camY + (forward.y / forward.z) * (-camZ);

        // Clamp center to reasonable bounds
        const maxOffset = this.imageWidth;
        const clampedCenterX = Math.max(-maxOffset, Math.min(maxOffset, isNaN(centerX) ? 0 : centerX));
        const clampedCenterY = Math.max(-maxOffset, Math.min(maxOffset, isNaN(centerY) ? 0 : centerY));

        // Half dimensions
        const hw = viewWidth / 2;
        const hh = viewHeight / 2;

        // Viewport frame position on the image plane
        // Offset slightly in front or behind depending on camera position
        const frameZ = camZ > 0 ? 0.01 : -0.01;

        // Update viewport frame corners
        const positions = this.viewportFrame.geometry.attributes.position.array;
        positions[0] = clampedCenterX - hw; positions[1] = clampedCenterY - hh; positions[2] = frameZ;
        positions[3] = clampedCenterX + hw; positions[4] = clampedCenterY - hh; positions[5] = frameZ;
        positions[6] = clampedCenterX + hw; positions[7] = clampedCenterY + hh; positions[8] = frameZ;
        positions[9] = clampedCenterX - hw; positions[10] = clampedCenterY + hh; positions[11] = frameZ;
        positions[12] = clampedCenterX - hw; positions[13] = clampedCenterY - hh; positions[14] = frameZ;

        this.viewportFrame.geometry.attributes.position.needsUpdate = true;

        // Update viewport plane
        this.viewportPlane.scale.set(viewWidth, viewHeight, 1);
        this.viewportPlane.position.set(clampedCenterX, clampedCenterY, frameZ);
        // Flip the plane if camera is behind
        this.viewportPlane.rotation.y = camZ > 0 ? 0 : Math.PI;
    }

    updateFrustumLines() {
        const { distance, orbitH, orbitV } = this.state;

        // Camera position
        const theta = THREE.MathUtils.degToRad(orbitH);
        const phi = THREE.MathUtils.degToRad(orbitV);
        const camX = distance * Math.cos(phi) * Math.sin(theta);
        const camY = distance * Math.sin(phi);
        const camZ = distance * Math.cos(phi) * Math.cos(theta);

        // Get viewport frame corners
        const framePos = this.viewportFrame.geometry.attributes.position.array;
        const positions = this.frustumLines.geometry.attributes.position.array;

        // Line from camera to each corner
        for (let i = 0; i < 4; i++) {
            const idx = i * 6;
            // Start point (camera)
            positions[idx] = camX;
            positions[idx + 1] = camY;
            positions[idx + 2] = camZ;
            // End point (corner)
            positions[idx + 3] = framePos[i * 3];
            positions[idx + 4] = framePos[i * 3 + 1];
            positions[idx + 5] = framePos[i * 3 + 2];
        }

        this.frustumLines.geometry.attributes.position.needsUpdate = true;
    }

    resetToOriginal() {
        this.state = { ...this.originalState };
        this.updatePosition();
    }

    getState() {
        return {
            ...this.state,
            originalShotType: this.originalShotType,
            originalAngle: this.originalAngle,
        };
    }

    getOriginalState() {
        return {
            ...this.originalState,
            originalShotType: this.originalShotType,
            originalAngle: this.originalAngle,
        };
    }

    setVisible(visible) {
        this.group.visible = visible;
    }

    dispose() {
        this.sceneManager.remove('cameraRig');
    }
}
