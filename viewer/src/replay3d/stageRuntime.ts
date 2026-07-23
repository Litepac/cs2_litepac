import {
  ACESFilmicToneMapping,
  AmbientLight,
  Box3,
  BufferGeometry,
  Color,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
  Euler,
  Group,
  HemisphereLight,
  Line,
  LineBasicMaterial,
  Material,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  Raycaster,
  Scene,
  SphereGeometry,
  Vector3,
  WebGLRenderer,
} from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

import { disposeObjectMeshes } from "./resourceDisposal";

export type Replay3DCameraMode = "tactical" | "chase" | "pov" | "free";

export type FreeFlyState = {
  keys: Set<string>;
  lastFrameTime: number;
  pitch: number;
  yaw: number;
};

export type ThreeStage = {
  cameraUserControlled: boolean;
  camera: PerspectiveCamera;
  controls: OrbitControls;
  dispose: () => void;
  hasFramedPlayers: boolean;
  lastFramedSelectedPlayerId: string | null;
  lastRenderedTick: number | null;
  loader: GLTFLoader;
  mapCollisionMeshes: Mesh[];
  playerGroup: Group;
  cameraMode: Replay3DCameraMode;
  freeFly: FreeFlyState;
  renderer: WebGLRenderer;
  scene: Scene;
  selectedAimPoint: Mesh;
  selectedAimRay: Line;
  selectedAimTube: Mesh;
  utilityGroup: Group;
  viewRaycaster: Raycaster;
};

export const TACTICAL_REVIEW_CAMERA_FOV = 52;
export const POV_REVIEW_CAMERA_FOV = 74;
export const FREE_FLY_MOUSE_SENSITIVITY = 0.0022;

const FREE_FLY_BASE_SPEED = 8.5;
const FREE_FLY_FAST_MULTIPLIER = 3.2;
const FREE_FLY_SLOW_MULTIPLIER = 0.32;

export function createThreeStage(host: HTMLDivElement): ThreeStage {
  const scene = new Scene();
  scene.background = new Color(0xb9ad95);
  const camera = new PerspectiveCamera(TACTICAL_REVIEW_CAMERA_FOV, 1, 0.1, 4000);
  camera.position.set(0, 120, 180);
  camera.rotation.order = "YXZ";
  scene.add(camera);

  const renderer = new WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  renderer.autoClear = false;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = "srgb";
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.64;
  renderer.domElement.tabIndex = 0;
  host.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = true;
  controls.keyPanSpeed = 18;
  controls.maxPolarAngle = Math.PI * 0.58;
  controls.minDistance = 5.5;
  controls.maxDistance = 1200;
  controls.panSpeed = 0.92;
  controls.rotateSpeed = 0.62;
  controls.zoomSpeed = 1.35;

  const playerGroup = new Group();
  playerGroup.name = "canonical-replay-players";
  scene.add(playerGroup);

  const utilityGroup = new Group();
  utilityGroup.name = "canonical-replay-utility";
  scene.add(utilityGroup);

  const selectedAimRay = new Line(
    new BufferGeometry().setFromPoints([new Vector3(), new Vector3(0, 0, -1)]),
    new LineBasicMaterial({
      color: 0xfff0d6,
      depthTest: true,
      depthWrite: false,
      transparent: true,
      opacity: 0.72,
    }),
  );
  selectedAimRay.name = "selected-player-parser-aim-ray";
  selectedAimRay.frustumCulled = false;
  selectedAimRay.renderOrder = 57;
  selectedAimRay.visible = false;
  scene.add(selectedAimRay);

  const selectedAimPoint = new Mesh(
    new SphereGeometry(1, 12, 8),
    new MeshBasicMaterial({
      color: 0xfff0d6,
      depthTest: true,
      depthWrite: false,
      transparent: true,
      opacity: 0.86,
    }),
  );
  selectedAimPoint.name = "selected-player-parser-aim-point";
  selectedAimPoint.frustumCulled = false;
  selectedAimPoint.renderOrder = 58;
  selectedAimPoint.visible = false;
  scene.add(selectedAimPoint);

  const selectedAimTube = new Mesh(
    new CylinderGeometry(1, 1, 1, 8, 1, true),
    new MeshBasicMaterial({
      color: 0xfff0d6,
      depthTest: true,
      depthWrite: false,
      transparent: true,
      opacity: 0.26,
      side: DoubleSide,
    }),
  );
  selectedAimTube.name = "selected-player-parser-aim-tube";
  selectedAimTube.frustumCulled = false;
  selectedAimTube.renderOrder = 57;
  selectedAimTube.visible = false;
  scene.add(selectedAimTube);

  const ambient = new AmbientLight(0xd8d1ca, 0.52);
  const hemisphere = new HemisphereLight(0xf0dfc4, 0x272018, 0.5);
  const key = new DirectionalLight(0xffffff, 0.94);
  key.position.set(-90, 180, 80);
  scene.add(ambient, hemisphere, key);

  const stage: ThreeStage = {
    cameraUserControlled: false,
    camera,
    controls,
    dispose: () => {
      disposeObjectMeshes(scene);
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    },
    hasFramedPlayers: false,
    lastFramedSelectedPlayerId: null,
    lastRenderedTick: null,
    loader: new GLTFLoader(),
    mapCollisionMeshes: [],
    cameraMode: "tactical",
    freeFly: {
      keys: new Set(),
      lastFrameTime: performance.now(),
      pitch: 0,
      yaw: 0,
    },
    playerGroup,
    renderer,
    scene,
    selectedAimPoint,
    selectedAimRay,
    selectedAimTube,
    utilityGroup,
    viewRaycaster: new Raycaster(),
  };
  controls.addEventListener("start", () => {
    stage.cameraUserControlled = true;
  });
  syncFreeFlyAnglesFromCamera(stage);
  return stage;
}

export function resizeStage(host: HTMLDivElement, stage: ThreeStage) {
  const bounds = host.getBoundingClientRect();
  const width = Math.max(1, Math.floor(bounds.width));
  const height = Math.max(1, Math.floor(bounds.height));
  stage.camera.aspect = width / height;
  stage.camera.updateProjectionMatrix();
  stage.renderer.setSize(width, height, false);
}

export function isFreeFlyKey(code: string) {
  return (
    code === "KeyW" ||
    code === "KeyA" ||
    code === "KeyS" ||
    code === "KeyD" ||
    code === "KeyQ" ||
    code === "KeyE" ||
    code === "Space" ||
    code === "ControlLeft" ||
    code === "ControlRight" ||
    code === "ShiftLeft" ||
    code === "ShiftRight" ||
    code === "AltLeft" ||
    code === "AltRight"
  );
}

export function syncFreeFlyAnglesFromCamera(stage: ThreeStage) {
  const rotation = new Euler().setFromQuaternion(stage.camera.quaternion, "YXZ");
  stage.freeFly.yaw = rotation.y;
  stage.freeFly.pitch = Math.max(-Math.PI / 2 + 0.02, Math.min(Math.PI / 2 - 0.02, rotation.x));
}

export function applyFreeFlyCameraRotation(stage: ThreeStage) {
  stage.camera.rotation.order = "YXZ";
  stage.camera.rotation.set(stage.freeFly.pitch, stage.freeFly.yaw, 0);
}

export function updateFreeFlyCamera(stage: ThreeStage) {
  const now = performance.now();
  const deltaSeconds = Math.min(0.05, Math.max(0, (now - stage.freeFly.lastFrameTime) / 1000));
  stage.freeFly.lastFrameTime = now;
  if (stage.cameraMode !== "free") {
    return;
  }

  applyFreeFlyCameraRotation(stage);
  const keys = stage.freeFly.keys;
  const localDirection = new Vector3(
    (keys.has("KeyD") ? 1 : 0) - (keys.has("KeyA") ? 1 : 0),
    (keys.has("KeyE") || keys.has("Space") ? 1 : 0) - (keys.has("KeyQ") || keys.has("ControlLeft") || keys.has("ControlRight") ? 1 : 0),
    (keys.has("KeyS") ? 1 : 0) - (keys.has("KeyW") ? 1 : 0),
  );
  if (localDirection.lengthSq() <= 0) {
    return;
  }

  localDirection.normalize();
  const speedMultiplier = keys.has("ShiftLeft") || keys.has("ShiftRight")
    ? FREE_FLY_FAST_MULTIPLIER
    : keys.has("AltLeft") || keys.has("AltRight")
      ? FREE_FLY_SLOW_MULTIPLIER
      : 1;
  const distance = FREE_FLY_BASE_SPEED * speedMultiplier * deltaSeconds;
  stage.camera.translateX(localDirection.x * distance);
  stage.camera.translateZ(localDirection.z * distance);
  stage.camera.position.y += localDirection.y * distance;
  stage.controls.target.copy(stage.camera.position.clone().add(replayViewForwardVector(stage.freeFly.yaw, stage.freeFly.pitch).multiplyScalar(10)));
}

export function frameCameraAroundMap(stage: ThreeStage, mapScene: Group) {
  const bounds = new Box3().setFromObject(mapScene);
  if (bounds.isEmpty()) {
    return;
  }

  const center = bounds.getCenter(new Vector3());
  const size = bounds.getSize(new Vector3());
  const radius = Math.max(size.x, size.y, size.z, 1);
  stage.controls.target.copy(center);
  stage.camera.position.set(center.x - radius * 0.45, center.y + radius * 0.52, center.z + radius * 0.52);
  stage.camera.fov = TACTICAL_REVIEW_CAMERA_FOV;
  stage.camera.near = Math.max(0.1, radius / 4000);
  stage.camera.far = Math.max(4000, radius * 5);
  stage.camera.updateProjectionMatrix();
}

export function prepareMapSceneForReview(mapScene: Group, renderer: WebGLRenderer) {
  const materialCache = new WeakMap<MeshStandardMaterial, MeshBasicMaterial>();
  const maxAnisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());

  mapScene.traverse((object) => {
    if (!(object instanceof Mesh)) {
      return;
    }

    const materials = Array.isArray(object.material) ? object.material : [object.material];
    if (materials.some(isSourceToolMaterial) || materials.some(isDecorativeMapFoliageMaterial)) {
      object.visible = false;
      return;
    }

    object.material = Array.isArray(object.material)
      ? object.material.map((material) => prepareMapMaterialForReview(material, materialCache, maxAnisotropy))
      : prepareMapMaterialForReview(object.material, materialCache, maxAnisotropy);
  });
}

export function collectCameraCollisionMeshes(mapScene: Group) {
  const meshes: Mesh[] = [];
  mapScene.updateWorldMatrix(true, true);
  mapScene.traverse((object) => {
    if (!(object instanceof Mesh) || !object.visible || !object.geometry) {
      return;
    }

    const materials = Array.isArray(object.material) ? object.material : [object.material];
    if (materials.length > 0 && materials.every(isLowOpacityCameraMaterial)) {
      return;
    }

    meshes.push(object);
  });
  return meshes;
}

export function replayViewForwardVector(yawRadians: number, pitchRadians: number) {
  const horizontal = Math.cos(pitchRadians);
  return new Vector3(Math.sin(yawRadians) * horizontal, -Math.sin(pitchRadians), Math.cos(yawRadians) * horizontal).normalize();
}

function isLowOpacityCameraMaterial(material: Material) {
  return material.transparent && material.opacity <= 0.16;
}

function prepareMapMaterialForReview(material: Material, materialCache: WeakMap<MeshStandardMaterial, MeshBasicMaterial>, maxAnisotropy: number) {
  if (!(material instanceof MeshStandardMaterial)) {
    return material;
  }

  const cached = materialCache.get(material);
  if (cached) {
    return cached;
  }

  const prepared = new MeshBasicMaterial({
    alphaMap: material.alphaMap,
    alphaTest: material.alphaTest,
    color: resolveMapMaterialTint(material),
    map: material.map,
    name: material.name,
    opacity: material.opacity,
    side: DoubleSide,
    transparent: material.transparent || material.opacity < 1 || material.alphaMap != null,
    vertexColors: material.vertexColors,
  });
  prepared.depthTest = material.depthTest;
  prepared.depthWrite = material.depthWrite;
  prepared.polygonOffset = material.polygonOffset;
  prepared.polygonOffsetFactor = material.polygonOffsetFactor;
  prepared.polygonOffsetUnits = material.polygonOffsetUnits;
  prepared.userData = material.userData;
  if (prepared.map) {
    prepared.map.anisotropy = maxAnisotropy;
    prepared.map.needsUpdate = true;
  }
  materialCache.set(material, prepared);
  return prepared;
}

function resolveMapMaterialTint(material: MeshStandardMaterial) {
  const signature = `${material.name} ${getVmatName(material)}`.toLowerCase();

  if (signature.includes("materials/decals")) {
    return 0xf2eadb;
  }

  if (signature.includes("foliage") || signature.includes("tree") || signature.includes("palm") || signature.includes("plant")) {
    return 0x7f8a61;
  }

  if (signature.includes("glass") || signature.includes("window")) {
    return 0x99abb2;
  }

  if (signature.includes("blue")) {
    return 0xa5b5b4;
  }

  if (signature.includes("salmon")) {
    return 0xc79779;
  }

  if (signature.includes("brick")) {
    return 0xae8067;
  }

  if (signature.includes("wood") || signature.includes("crate") || signature.includes("door")) {
    return 0x9b7652;
  }

  if (signature.includes("metal") || signature.includes("rail") || signature.includes("fence") || signature.includes("gate")) {
    return 0x8b8e8b;
  }

  if (signature.includes("concrete") || signature.includes("stone") || signature.includes("tile") || signature.includes("ground")) {
    return 0xa09a8b;
  }

  if (
    signature.includes("plaster") ||
    signature.includes("base") ||
    signature.includes("mirage") ||
    signature.includes("sand") ||
    signature.includes("top")
  ) {
    return 0xc7ad86;
  }

  return 0xb8aa91;
}

function isSourceToolMaterial(material: Mesh["material"]) {
  if (Array.isArray(material)) {
    return material.some(isSourceToolMaterial);
  }

  const materialName = material.name.toLowerCase();
  const vmatName = getVmatName(material).toLowerCase();
  return vmatName.startsWith("materials/tools/") || materialName.startsWith("toolsblocklight") || materialName.startsWith("toolssolidblocklight");
}

function isDecorativeMapFoliageMaterial(material: Mesh["material"]) {
  if (Array.isArray(material)) {
    return material.some(isDecorativeMapFoliageMaterial);
  }

  const signature = `${material.name} ${getVmatName(material)}`.toLowerCase();
  const shaderName = getVmatShaderName(material).toLowerCase();
  return (
    shaderName.includes("csgo_foliage") ||
    signature.includes("props_foliage") ||
    signature.includes("tarp_a") ||
    signature.includes("trees_branches") ||
    signature.includes("trees_barks") ||
    signature.includes("palm_trunk") ||
    signature.includes("urban_palm") ||
    signature.includes("mall_trees")
  );
}

function getVmatName(material: Mesh["material"]) {
  if (Array.isArray(material)) {
    return "";
  }

  const userData = material.userData as { vmat?: { Name?: unknown } };
  return typeof userData.vmat?.Name === "string" ? userData.vmat.Name : "";
}

function getVmatShaderName(material: Mesh["material"]) {
  if (Array.isArray(material)) {
    return "";
  }

  const userData = material.userData as { vmat?: { ShaderName?: unknown } };
  return typeof userData.vmat?.ShaderName === "string" ? userData.vmat.ShaderName : "";
}
