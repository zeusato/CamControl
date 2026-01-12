/**
 * Image Plane - Displays uploaded image in 3D scene
 * With front/back indicators
 */

import * as THREE from 'three';

export class ImagePlane {
    constructor(sceneManager) {
        this.sceneManager = sceneManager;
        this.mesh = null;
        this.group = null;
        this.aspectRatio = 1;
    }

    async loadImage(imageDataUrl) {
        return new Promise((resolve, reject) => {
            const loader = new THREE.TextureLoader();
            loader.load(
                imageDataUrl,
                (texture) => {
                    texture.colorSpace = THREE.SRGBColorSpace;

                    // Get image dimensions for aspect ratio
                    const image = texture.image;
                    this.aspectRatio = image.width / image.height;

                    // Remove existing
                    if (this.group) {
                        this.sceneManager.remove('imagePlane');
                        this.dispose();
                    }

                    // Create group for plane + labels
                    this.group = new THREE.Group();

                    // Create plane with correct aspect ratio
                    const height = 2;
                    const width = height * this.aspectRatio;

                    const geometry = new THREE.PlaneGeometry(width, height);
                    const material = new THREE.MeshStandardMaterial({
                        map: texture,
                        side: THREE.FrontSide, // Only show texture on front
                    });

                    this.mesh = new THREE.Mesh(geometry, material);
                    this.mesh.receiveShadow = true;
                    this.group.add(this.mesh);

                    // Create back side with different color
                    const backGeometry = new THREE.PlaneGeometry(width, height);
                    const backMaterial = new THREE.MeshStandardMaterial({
                        color: 0x1a1a2e,
                        side: THREE.FrontSide,
                    });
                    this.backMesh = new THREE.Mesh(backGeometry, backMaterial);
                    this.backMesh.rotation.y = Math.PI; // Face the other way
                    this.backMesh.position.z = -0.001; // Slightly behind
                    this.group.add(this.backMesh);

                    // Add FRONT indicator
                    this.createFrontIndicator(width, height);

                    // Add BACK indicator
                    this.createBackIndicator(width, height);

                    // Add edge frame to distinguish front from back
                    this.createEdgeFrame(width, height);

                    this.sceneManager.add('imagePlane', this.group);

                    resolve(this.aspectRatio);
                },
                undefined,
                (error) => {
                    reject(error);
                }
            );
        });
    }

    createFrontIndicator(width, height) {
        // Create a "FRONT" label using a small colored bar at the bottom
        const indicatorGeom = new THREE.PlaneGeometry(width * 0.3, 0.08);
        const indicatorMat = new THREE.MeshBasicMaterial({
            color: 0x22c55e, // Green
            side: THREE.FrontSide,
        });
        const indicator = new THREE.Mesh(indicatorGeom, indicatorMat);
        indicator.position.set(0, -height / 2 - 0.06, 0.002);
        this.group.add(indicator);

        // Add arrow pointing at the image
        const arrowShape = new THREE.Shape();
        arrowShape.moveTo(0, 0);
        arrowShape.lineTo(-0.05, -0.08);
        arrowShape.lineTo(0.05, -0.08);
        arrowShape.closePath();

        const arrowGeom = new THREE.ShapeGeometry(arrowShape);
        const arrowMat = new THREE.MeshBasicMaterial({
            color: 0x22c55e,
            side: THREE.FrontSide,
        });
        const arrow = new THREE.Mesh(arrowGeom, arrowMat);
        arrow.position.set(0, -height / 2 + 0.02, 0.002);
        arrow.rotation.z = Math.PI;
        this.group.add(arrow);
    }

    createBackIndicator(width, height) {
        // Create a "BACK" indicator on the back side
        const indicatorGeom = new THREE.PlaneGeometry(width * 0.3, 0.08);
        const indicatorMat = new THREE.MeshBasicMaterial({
            color: 0xef4444, // Red
            side: THREE.FrontSide,
        });
        const indicator = new THREE.Mesh(indicatorGeom, indicatorMat);
        indicator.position.set(0, -height / 2 - 0.06, -0.002);
        indicator.rotation.y = Math.PI; // Face the back
        this.group.add(indicator);

        // X mark for back
        const xSize = 0.04;
        const xGeom = new THREE.BufferGeometry();
        const xPositions = new Float32Array([
            -xSize, -xSize, -0.003,
            xSize, xSize, -0.003,
            -xSize, xSize, -0.003,
            xSize, -xSize, -0.003,
        ]);
        xGeom.setAttribute('position', new THREE.BufferAttribute(xPositions, 3));
        const xMat = new THREE.LineBasicMaterial({ color: 0xef4444 });
        const xMark = new THREE.LineSegments(xGeom, xMat);
        xMark.position.set(0, -height / 2 - 0.06, 0);
        this.group.add(xMark);
    }

    createEdgeFrame(width, height) {
        // Create a colored edge frame to help identify orientation
        const hw = width / 2;
        const hh = height / 2;
        const depth = 0.02;

        // Front edge (green) - at top
        const frontEdgeGeom = new THREE.BoxGeometry(width, 0.03, depth);
        const frontEdgeMat = new THREE.MeshBasicMaterial({ color: 0x22c55e });
        const frontEdge = new THREE.Mesh(frontEdgeGeom, frontEdgeMat);
        frontEdge.position.set(0, hh + 0.015, 0.01);
        this.group.add(frontEdge);

        // Back edge (red) - at top but on back
        const backEdgeGeom = new THREE.BoxGeometry(width, 0.03, depth);
        const backEdgeMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
        const backEdge = new THREE.Mesh(backEdgeGeom, backEdgeMat);
        backEdge.position.set(0, hh + 0.015, -0.01);
        this.group.add(backEdge);

        // Side edges (gradient from green to red)
        const leftEdgeGeom = new THREE.BoxGeometry(0.03, height + 0.06, depth);
        const leftEdgeMat = new THREE.MeshBasicMaterial({ color: 0x6366f1 }); // Purple
        const leftEdge = new THREE.Mesh(leftEdgeGeom, leftEdgeMat);
        leftEdge.position.set(-hw - 0.015, 0, 0);
        this.group.add(leftEdge);

        const rightEdge = new THREE.Mesh(leftEdgeGeom, leftEdgeMat);
        rightEdge.position.set(hw + 0.015, 0, 0);
        this.group.add(rightEdge);
    }

    getAspectRatio() {
        return this.aspectRatio;
    }

    getSize() {
        if (this.mesh) {
            const geo = this.mesh.geometry;
            return {
                width: geo.parameters.width,
                height: geo.parameters.height,
            };
        }
        return { width: 2, height: 2 };
    }

    setVisible(visible) {
        if (this.group) {
            this.group.visible = visible;
        }
    }

    dispose() {
        if (this.group) {
            // Dispose all children
            this.group.traverse((child) => {
                if (child.geometry) child.geometry.dispose();
                if (child.material) {
                    if (Array.isArray(child.material)) {
                        child.material.forEach(m => m.dispose());
                    } else {
                        child.material.dispose();
                    }
                }
            });
            this.sceneManager.remove('imagePlane');
            this.group = null;
            this.mesh = null;
        }
    }
}
