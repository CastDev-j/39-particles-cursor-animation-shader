import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import * as THREE from "three";
import { Timer } from "three/examples/jsm/Addons.js";
import particlesVertexShader from "./shaders/particles/vertex.glsl";
import particlesFragmentShader from "./shaders/particles/fragment.glsl";

/**
 * Set up scene
 */

const scene = new THREE.Scene();

/**
 * Set up loaders
 */

const textureLoader = new THREE.TextureLoader();

/**
 * Set up canvas
 */

const canvas = document.getElementById("canvas") as HTMLCanvasElement;

/**
 * Sizes
 */
const sizes = {
  width: window.innerWidth,
  height: window.innerHeight,
  pixelRatio: Math.min(window.devicePixelRatio, 2),
};

/**
 * Camera
 */

// Base camera
const camera = new THREE.PerspectiveCamera(
  25,
  sizes.width / sizes.height,
  0.1,
  100
);
camera.position.set(0, 0, 28);
scene.add(camera);

// Controls
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.enablePan = false;

/**
 * Renderer
 */

const renderer = new THREE.WebGLRenderer({
  canvas: canvas,
  antialias: true,
});
renderer.setSize(sizes.width, sizes.height);
renderer.setPixelRatio(sizes.pixelRatio);
renderer.setClearColor("#171717");

/**
 * Displacement
 */

const displacement = {
  canvas: null as HTMLCanvasElement | null,
  context: null as CanvasRenderingContext2D | null,
  glowImage: new Image(),
  interactivePlane: new THREE.Mesh(
    new THREE.PlaneGeometry(10, 10),
    new THREE.MeshBasicMaterial({
      color: "red",
      transparent: true,
      side: THREE.DoubleSide,
      opacity: 0.0,
    })
  ),
  raycaster: new THREE.Raycaster(),
  screenCursor: new THREE.Vector2(9999, 9999),
  canvasCursor: new THREE.Vector2(9999, 9999),
  canvasCursorPrevious: new THREE.Vector2(9999, 9999),
  texture: null as THREE.CanvasTexture | null,
};

// 2D canvas
displacement.canvas = document.createElement("canvas");
displacement.canvas.width = 128;
displacement.canvas.height = 128;

displacement.canvas.classList.add("displacement-canvas");

// 2D context

displacement.context = displacement.canvas.getContext("2d")!;
displacement.context.fillRect(
  0,
  0,
  displacement.canvas.width,
  displacement.canvas.height
);

// Glow image
displacement.glowImage.src = "/glow.png";

document.body.appendChild(displacement.canvas);

// Interactive plane

scene.add(displacement.interactivePlane);

// Raycaster

// Screen cursor

window.addEventListener("pointermove", (e) => {
  // Update screen cursor position and clamp between -1 and 1
  displacement.screenCursor.x = Math.max(
    -1,
    Math.min(1, (e.clientX / sizes.width) * 2 - 1)
  );
  displacement.screenCursor.y = Math.max(
    -1,
    Math.min(1, (-e.clientY / sizes.height) * 2 + 1)
  );
});

// Texture
displacement.texture = new THREE.CanvasTexture(displacement.canvas);

/**
 * Particles
 */
const particlesGeometry = new THREE.PlaneGeometry(10, 10, 128, 128);
particlesGeometry.setIndex(null);
particlesGeometry.deleteAttribute("normal");

const intensityArray = new Float32Array(
  particlesGeometry.attributes.position.count
);

const anglesArray = new Float32Array(
  particlesGeometry.attributes.position.count
);

for (let i = 0; i < intensityArray.length; i++) {
  intensityArray[i] = Math.random();
  anglesArray[i] = Math.random() * Math.PI * 2;
}

particlesGeometry.setAttribute(
  "aIntensity",
  new THREE.BufferAttribute(intensityArray, 1)
);

particlesGeometry.setAttribute(
  "aAngle",
  new THREE.BufferAttribute(anglesArray, 1)
);

const particlesMaterial = new THREE.ShaderMaterial({
  vertexShader: particlesVertexShader,
  fragmentShader: particlesFragmentShader,
  uniforms: {
    uPictureTexture: new THREE.Uniform(textureLoader.load("/picture-4.png")),
    uResolution: new THREE.Uniform(
      new THREE.Vector2(
        sizes.width * sizes.pixelRatio,
        sizes.height * sizes.pixelRatio
      )
    ),
    uDisplacementTexture: new THREE.Uniform(displacement.texture),
  },
});
const particles = new THREE.Points(particlesGeometry, particlesMaterial);
scene.add(particles);

/**
 * Animation loop
 */

const timer = new Timer();

const tick = () => {
  timer.update();
  // const elapsedTime = timer.getElapsed();
  const deltaTime = timer.getDelta();

  // update controls to enable damping
  controls.update();

  // animations
  displacement.raycaster.setFromCamera(displacement.screenCursor, camera);

  const intersects = displacement.raycaster.intersectObject(
    displacement.interactivePlane
  );

  if (intersects.length) {
    const uv = intersects[0].uv!;

    displacement.canvasCursor.x = uv.x * displacement.canvas!.width;
    displacement.canvasCursor.y = (1 - uv.y) * displacement.canvas!.height;
  }

  /**
   * Displacement
   */

  if (displacement.context) {
    displacement.context.globalCompositeOperation = "source-over";
    displacement.context.globalAlpha = 0.02;

    displacement.context.fillRect(
      0,
      0,
      displacement.canvas!.width,
      displacement.canvas!.height
    );

    // Speed alpha
    const cursorDistance = displacement.canvasCursorPrevious.distanceTo(
      displacement.canvasCursor
    );
    displacement.canvasCursorPrevious.copy(displacement.canvasCursor);

    const speedAlpha = Math.min(cursorDistance * 0.1, 1);

    const glowSize = displacement.canvas!.width * 0.2;
    displacement.context.globalCompositeOperation = "lighten";
    displacement.context.globalAlpha = speedAlpha;

    displacement.context.drawImage(
      displacement.glowImage,
      displacement.canvasCursor.x - glowSize / 2,
      displacement.canvasCursor.y - glowSize / 2,
      glowSize,
      glowSize
    );

    displacement.texture!.needsUpdate = true;
  }

  // render
  renderer.render(scene, camera);

  // request next frame
  window.requestAnimationFrame(tick);
};

tick();

/**
 * Handle window resize
 */

function handleResize() {
  const visualViewport = window.visualViewport!;
  const width = visualViewport.width;
  const height = visualViewport.height;

  canvas.width = width;
  canvas.height = height;

  sizes.width = width;
  sizes.height = height;
  sizes.pixelRatio = Math.min(window.devicePixelRatio, 2);

  camera.aspect = width / height;
  camera.updateProjectionMatrix();

  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
}

/**
 * Usar el evento 'resize' de visualViewport para móviles
 */

if (window.visualViewport) {
  window.visualViewport.addEventListener("resize", handleResize);
} else {
  window.addEventListener("resize", handleResize);
}
