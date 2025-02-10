import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { FBXLoader } from "three/addons/loaders/FBXLoader.js";

// Renderer
const canvas = document.querySelector("#three-canvas");
const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
});
const params = {
    alpha: 0.8,
    alphaHash: true
};
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio > 1 ? 2 : 1);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputEncoding = THREE.sRGBEncoding; // Ensure correct lighting
renderer.physicallyCorrectLights = true; // More realistic lighting
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;

// Scene
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xD3D3D3);

// Camera Setup
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 10000);
const cameraDistance = 6;
let theta = THREE.MathUtils.degToRad(225);
let modelCenter = new THREE.Vector3(0, 1.5, 0);
scene.add(camera);

function updateCameraPosition() {
    camera.position.x = modelCenter.x + cameraDistance * Math.sin(theta);
    camera.position.y = modelCenter.y + 2;
    camera.position.z = modelCenter.z + cameraDistance * Math.cos(theta);
    camera.lookAt(modelCenter);
}
updateCameraPosition();

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.enablePan = false;
controls.target.copy(modelCenter);
controls.update();

// Lights
const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
directionalLight.position.set(8, 12, 2);
directionalLight.castShadow = true;

// ✅ Increase Shadow Quality
directionalLight.shadow.mapSize.width = 4096;  // High-resolution shadows
directionalLight.shadow.mapSize.height = 4096;
directionalLight.shadow.camera.near = 0.5;
directionalLight.shadow.camera.far = 50;
directionalLight.shadow.camera.left = -10;
directionalLight.shadow.camera.right = 10;
directionalLight.shadow.camera.top = 10;
directionalLight.shadow.camera.bottom = -10;
directionalLight.shadow.bias = -0.0005; // Reduce shadow acne

scene.add(directionalLight);


const lightTarget = new THREE.Object3D();
lightTarget.position.set(0, 0, 0);
// Load FBX Models
const modelGroup = new THREE.Group();
scene.add(modelGroup);
directionalLight.target = lightTarget;
scene.add(directionalLight.target);

const concreteMaterial = new THREE.MeshStandardMaterial({ color: 0x8a8a8a, roughness: 0.9, metalness: 0.1 });
const frameMaterial = new THREE.MeshStandardMaterial({ color: 0x60696b, roughness: 0.4, metalness: 0.3 });

function loadFBXModel(path, material) {
    const fbxLoader = new FBXLoader();
    fbxLoader.load(path, (fbx) => {
        fbx.scale.set(0.05, 0.05, 0.05);
        fbx.traverse((child) => {
            if (child.isMesh) {
                child.material = material;
                child.castShadow = false;
                child.receiveShadow = true;
            }
        });
        modelGroup.add(fbx);
        if (modelGroup.children.length === 2) {
            centerModelPivot();
            loadCSVData("models/data.csv");
        }
    });
}

loadFBXModel("models/concrete.fbx", concreteMaterial);
loadFBXModel("models/frame.fbx", frameMaterial);

function centerModelPivot() {
    const bbox = new THREE.Box3().setFromObject(modelGroup);
    const modelCenter = new THREE.Vector3();
    bbox.getCenter(modelCenter);
    modelGroup.position.sub(modelCenter);
    modelGroup.rotation.x = THREE.MathUtils.degToRad(270);
    controls.target.set(0, 0, 0);
    updateCameraPosition();
    controls.update();
}

function loadCSVData(file) {
    fetch(file)
        .then(response => response.text())
        .then(text => {
            const rows = text.trim().split("\n").map(row => row.split(","));
            const csvData = rows.slice(1).map(([x, y, size, temp]) => ({
                x: parseFloat(x) || 0,
                y: parseFloat(y) || 0,
                size: parseFloat(size) || 1,
                temp: parseFloat(temp) || 0, // Added temperature column
            }));
            projectGridMapOnFace(modelGroup, "left", csvData);
        })
        .catch(error => console.error("Error loading CSV:", error));
}

function projectGridMapOnFace(model, face, csvData) {
    const bbox = new THREE.Box3().setFromObject(model);
    const size = bbox.getSize(new THREE.Vector3());
    const center = bbox.getCenter(new THREE.Vector3());

    let position, rotation, faceWidth, faceHeight;
    const inset = 0.8;

    switch (face) {
        case "top":
            position = new THREE.Vector3(center.x, bbox.max.y + 0.01, center.z);
            rotation = new THREE.Euler(-Math.PI / 2, 0, 0);
            faceWidth = size.x * inset;
            faceHeight = size.z * inset;
            break;
        case "bottom":
            position = new THREE.Vector3(center.x, bbox.min.y - 0.01, center.z);
            rotation = new THREE.Euler(Math.PI / 2, 0, 0);
            faceWidth = size.x * inset;
            faceHeight = size.z * inset;
            break;
        case "front":
            position = new THREE.Vector3(center.x, center.y, bbox.max.z + 0.01);
            rotation = new THREE.Euler(0, 0, 0);
            faceWidth = size.x * inset;
            faceHeight = size.y * inset;
            break;
        case "back":
            position = new THREE.Vector3(center.x, center.y, bbox.min.z - 0.01);
            rotation = new THREE.Euler(0, Math.PI, 0);
            faceWidth = size.x * inset;
            faceHeight = size.y * inset;
            break;
        case "left":
            position = new THREE.Vector3(bbox.min.x - 0.01, center.y, center.z);
            rotation = new THREE.Euler(0, -Math.PI / 2, 0);
            faceWidth = size.z * inset;
            faceHeight = size.y * inset;
            break;
        case "right":
            position = new THREE.Vector3(bbox.max.x + 0.01, center.y, center.z);
            rotation = new THREE.Euler(0, Math.PI / 2, 0);
            faceWidth = size.z * inset;
            faceHeight = size.y * inset;
            break;
        default:
            console.error("Invalid face specified.");
            return;
    }

    // Normalize CSV data
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    csvData.forEach(({ x, y }) => {
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
    });

    const csvWidth = maxX - minX;
    const csvHeight = maxY - minY;

    const scaleX = faceWidth / csvWidth;
    const scaleY = faceHeight / csvHeight;
    const minSize = Math.min(...csvData.map(d => d.size));
    const maxSize = Math.max(...csvData.map(d => d.size));
    const minTemp = Math.min(...csvData.map(d => d.temp));
    const maxTemp = Math.max(...csvData.map(d => d.temp));

    const minColor = new THREE.Color("#7ac74f"); // Light Blue (Min Size)
    const maxColor = new THREE.Color("#e87461"); // Pink-Red (Max Size)
    // Create the grid group
    const gridGroup = new THREE.Group();
    csvData.forEach(({ x, y, size, temp }) => {
        const normalizedSize = (size - minSize) / (maxSize - minSize);
    const normalizedTemp = (temp - minTemp) / (maxTemp - minTemp); // Normalize "temp" between 0 and 1
    const color = minColor.clone().lerp(maxColor, normalizedSize); 

    // Cylinder settings
    const radius = (size / 100) * Math.min(scaleX, scaleY); // Scaled to face size
    const cylinderHeight = 0.1 + normalizedTemp * 0.6; // Extrude height based on temp

    const geometry = new THREE.CylinderGeometry(radius, radius, cylinderHeight, 32);
    const material = new THREE.MeshPhysicalMaterial({
        color: color,  // Subtle tint color
        metalness: 0.1,  // Slight metallic reflection
        roughness: 0.2,  // Smooth but not completely reflective
        transmission: 0.9,  // High transparency for a glass-like effect
        thickness: 0.5,  // Controls the depth of refraction
        ior: 1.5,  // Index of refraction for realistic glass
        clearcoat: 1.0,  // Extra shine
        clearcoatRoughness: 0.1,  // Slightly smooth clearcoat
        opacity: params.alpha,  // Use provided transparency setting
        side: THREE.DoubleSide,  // Ensure it's visible from both sides
    });
    

    const cylinder = new THREE.Mesh(geometry, material);
    cylinder.castShadow = true;  // ✅ Allow cylinders to cast shadows
    cylinder.receiveShadow = false;
    // ✅ Rotate based on the face direction
    switch (face) {
        case "top":
            cylinder.rotation.x = Math.PI / 2; 
            // Rotate 90° on X-axis
            break;
        case "bottom":
            cylinder.rotation.x = -Math.PI / 2; // Rotate -90° on X-axis
            break;
        case "front":
            cylinder.rotation.x = -Math.PI / 2; // No rotation needed
            break;
        case "back":
            cylinder.rotation.x = Math.PI / 2; // Rotate 180° to face the correct direction
            break;
        case "left":
            cylinder.rotation.x = -Math.PI / 2; // Rotate -90° on Z-axis
            
            break;
        case "right":
            cylinder.rotation.x = Math.PI / 2;
            // Rotate 90° on Z-axis
            break;
    }
    
    // Correct positioning on the selected face
    cylinder.position.set(
        (x - minX) * scaleX - faceWidth / 2,  // X position within face
        (y - minY) * scaleY - faceHeight / 2, // Y position within face
        0                   // Lift cylinder so it sits correctly on the face
    );

    gridGroup.add(cylinder);
    });

    gridGroup.position.copy(position);
    gridGroup.rotation.copy(rotation);
    scene.add(gridGroup);
}

function draw() {
    controls.update();
    renderer.render(scene, camera);
    requestAnimationFrame(draw);
}

function setSize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

window.addEventListener("resize", setSize);
draw();
