import { useEffect, useMemo, useRef, useState } from "react";
import {
  AnimationClip,
  AnimationMixer,
  Box3,
  BoxGeometry,
  BufferGeometry,
  CapsuleGeometry,
  CanvasTexture,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Euler,
  Group,
  Line,
  LineBasicMaterial,
  MeshBasicMaterial,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  PerspectiveCamera,
  LoopRepeat,
  LoopOnce,
  SkinnedMesh,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  TorusGeometry,
  Vector3,
} from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";

import { interpolatePlayerStreamSample } from "../replay/playerStream";
import type { Replay, Round, UtilityEntity } from "../replay/types";
import { utilityLifecycleEndTick, utilitySceneStateAtTick } from "../replay/utility";
import { normalizeWeaponName, type WeaponClass } from "../replay/weapons";
import { loadReplay3DMapAsset, type Replay3DMapAssetResult } from "../replay3d/mapAssetManifest";
import { source2PointToGltf, source2YawToGltfRadians } from "../replay3d/replay3dCoordinates";
import { disposeObjectMeshes, SHARED_3D_MODEL_RESOURCE_FLAG } from "../replay3d/resourceDisposal";
import {
  applyFreeFlyCameraRotation,
  collectCameraCollisionMeshes,
  createThreeStage,
  FREE_FLY_MOUSE_SENSITIVITY,
  frameCameraAroundMap,
  isFreeFlyKey,
  POV_REVIEW_CAMERA_FOV,
  prepareMapSceneForReview,
  replayViewForwardVector,
  resizeStage,
  syncFreeFlyAnglesFromCamera,
  TACTICAL_REVIEW_CAMERA_FOV,
  type Replay3DCameraMode,
  type ThreeStage,
  updateFreeFlyCamera,
} from "../replay3d/stageRuntime";
import styles from "./Replay3DStage.module.css";

type Replay3DStageProps = {
  currentTick: number;
  replay: Replay;
  round: Round;
  selectedPlayerId: string | null;
  onSelectPlayer: (playerId: string) => void;
};

type PlayerMarker = {
  activeAnimationKey: string | null;
  animationActions: Map<string, ReturnType<AnimationMixer["clipAction"]>>;
  animationClipCount: number;
  animationOffset: number;
  animationPeriod: number;
  candidateAnimationKey: string | null;
  candidateAnimationStartTick: number | null;
  carriedWeaponNeedsPitchOverlay: boolean;
  hasModel: boolean;
  label: string;
  labelSprite: Sprite;
  lastPosition: Vector3 | null;
  lastTick: number | null;
  mixer: AnimationMixer | null;
  model: Group | null;
  object: Group;
  playerId: string;
  selected: boolean;
  side: "CT" | "T";
  weaponObject: Object3D | null;
  weaponHasModel: boolean;
  weaponKey: string | null;
};

type PlayerPovCameraView = {
  eyePosition: Vector3;
  isScoped: boolean | null;
  pitch: number;
  playerId: string;
  recoilIndex: number | null;
  recentFireAgeSeconds: number | null;
  viewmodelFov: number | null;
  viewmodelOffsetX: number | null;
  viewmodelOffsetY: number | null;
  viewmodelOffsetZ: number | null;
  weaponKey: string | null;
  yaw: number;
  side: "CT" | "T";
  zoomLevel: number | null;
};

type PlayerReviewDimensions = {
  eyeHeight: number;
  modelHeight: number;
  radius: number;
};

type PlayerModelTemplate = {
  animations: AnimationClip[];
  group: Group;
  povHands: Group | null;
};

type PlayerModelSet = {
  ct: PlayerModelTemplate | null;
  source: string;
  t: PlayerModelTemplate | null;
};

type PlayerAnimationSet = {
  byKey: Map<string, AnimationClip>;
  source: string;
};

type WeaponModelTemplate = {
  group: Group;
  key: string;
};

type WeaponModelSet = {
  byKey: Map<string, WeaponModelTemplate>;
  source: string;
};

type PovViewmodelTemplate = {
  animations: AnimationClip[];
  group: Group;
  key: string;
};

type PovViewmodelSet = {
  arms: PovViewmodelTemplate | null;
  source: string;
  weaponsByKey: Map<string, PovViewmodelTemplate>;
};

const SUPPORTED_WEAPON_MODEL_KEYS = [
  "ak47",
  "awp",
  "m4a4",
  "m4a1silencer",
  "deagle",
  "glock18",
  "hkp2000",
  "uspsilencer",
  "elite",
  "galilar",
  "famas",
  "mp9",
  "mac10",
  "p250",
  "knife_default_ct",
  "knife_default_t",
  "hegrenade",
  "flashbang",
  "smokegrenade",
  "molotov",
  "incendiarygrenade",
  "c4",
] as const;
const SUPPORTED_WEAPON_MODEL_KEY_SET = new Set<string>(SUPPORTED_WEAPON_MODEL_KEYS);
const PLAYER_MODEL_MANIFEST_URL = "/models/players/default_agents/manifest.json";
const PLAYER_ANIMATION_MANIFEST_URL = "/models/players/default_agents/animations/manifest.json";
const WEAPON_MODEL_MANIFEST_URL = "/models/weapons/default/manifest.json";
const POV_VIEWMODEL_MANIFEST_URL = "/models/viewmodels/default/manifest.json";
const PLAYER_STANDING_HEIGHT_FROM_EYE_MULTIPLIER = 72 / 64;
const PLAYER_3D_PRESENTATION_HEIGHT_MULTIPLIER = 1.22;
const PLAYER_MODEL_FOOT_CLEARANCE = 0.045;
const PLAYER_MODEL_FOOT_ANCHOR_NAMES = new Set(["ball_l", "ball_r", "ankle_l", "ankle_r", "toe_0_l", "toe_0_r"]);
const USE_EXPORTED_POV_ARMS = true;
const POV_SHOOT_ANIMATION_WINDOW_SECONDS = 0.22;
const USED_PLAYER_LOCOMOTION_ANIMATION_KEYS = new Set([
  "knife_idle",
  "knife_run_n",
  "knife_walk_n",
  "pistol_idle",
  "pistol_run_n",
  "pistol_walk_n",
  "rifle_idle",
  "rifle_run_n",
  "rifle_walk_n",
]);

export function Replay3DStage({ currentTick, replay, round, selectedPlayerId, onSelectPlayer }: Replay3DStageProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<ThreeStage | null>(null);
  const onSelectPlayerRef = useRef(onSelectPlayer);
  const playerMarkersRef = useRef<PlayerMarker[]>([]);
  const playerMarkerByIdRef = useRef(new Map<string, PlayerMarker>());
  const [assetResult, setAssetResult] = useState<Replay3DMapAssetResult | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [playerAnimations, setPlayerAnimations] = useState<PlayerAnimationSet | null>(null);
  const [playerModels, setPlayerModels] = useState<PlayerModelSet | null>(null);
  const [povViewmodels, setPovViewmodels] = useState<PovViewmodelSet | null>(null);
  const [weaponModels, setWeaponModels] = useState<WeaponModelSet | null>(null);
  const [cameraMode, setCameraMode] = useState<Replay3DCameraMode>("tactical");
  const playerNameById = useMemo(() => new Map(replay.players.map((player) => [player.playerId, player.displayName])), [replay.players]);
  const playerSideById = useMemo(() => new Map(round.playerStreams.map((stream) => [stream.playerId, stream.side])), [round.playerStreams]);
  const roundWeaponModelKeys = useMemo(() => collectRoundWeaponModelKeys(round), [round]);
  const weaponModelPriorityKeys = useMemo(() => roundWeaponModelKeys, [roundWeaponModelKeys]);
  const povViewmodelPriorityKeys = useMemo(() => {
    const keys = [...roundWeaponModelKeys];
    for (const fallbackKey of ["glock18", "uspsilencer", "ak47", "m4a1silencer"]) {
      if (!keys.includes(fallbackKey)) {
        keys.push(fallbackKey);
      }
    }
    return keys;
  }, [roundWeaponModelKeys]);
  const assetUrl = assetResult?.available === true ? assetResult.assetUrl : null;

  useEffect(() => {
    onSelectPlayerRef.current = onSelectPlayer;
  }, [onSelectPlayer]);

  useEffect(() => {
    let cancelled = false;
    let loadedModels: PlayerModelSet | null = null;

    loadPlayerModelSet().then((models) => {
      if (cancelled) {
        disposePlayerModelSet(models);
        return;
      }

      loadedModels = models;
      setPlayerModels(models);
    });

    return () => {
      cancelled = true;
      disposePlayerModelSet(loadedModels);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    loadPlayerAnimationSet().then((animations) => {
      if (!cancelled) {
        setPlayerAnimations(animations);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let loadedModels: WeaponModelSet | null = null;

    setWeaponModels(null);
    loadWeaponModelSet({
      priorityKeys: weaponModelPriorityKeys,
      onTemplateLoaded: (models) => {
        if (cancelled) {
          return;
        }

        loadedModels = models;
        setWeaponModels({
          ...models,
          byKey: new Map(models.byKey),
        });
      },
    }).then((models) => {
      if (cancelled) {
        disposeWeaponModelSet(models);
        return;
      }

      loadedModels = models;
      setWeaponModels(models);
    });

    return () => {
      cancelled = true;
      disposeWeaponModelSet(loadedModels);
    };
  }, [weaponModelPriorityKeys]);

  useEffect(() => {
    let cancelled = false;
    let loadedViewmodels: PovViewmodelSet | null = null;

    setPovViewmodels(null);
    loadPovViewmodelSet({
      priorityKeys: povViewmodelPriorityKeys,
      onTemplateLoaded: (models) => {
        if (cancelled) {
          return;
        }

        loadedViewmodels = models;
        setPovViewmodels({
          ...models,
          weaponsByKey: new Map(models.weaponsByKey),
        });
      },
    }).then((models) => {
      if (cancelled) {
        disposePovViewmodelSet(models);
        return;
      }

      loadedViewmodels = models;
      setPovViewmodels(models);
    });

    return () => {
      cancelled = true;
      disposePovViewmodelSet(loadedViewmodels);
    };
  }, [povViewmodelPriorityKeys]);

  useEffect(() => {
    let cancelled = false;
    setAssetResult(null);
    setLoadError(null);
    setMapLoaded(false);

    loadReplay3DMapAsset(replay.map.mapId).then((result) => {
      if (!cancelled) {
        setAssetResult(result);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [replay.map.mapId]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || assetResult?.available !== true) {
      return;
    }

    let stageActive = true;
    setMapLoaded(false);
    const stage = createThreeStage(host);
    stageRef.current = stage;
    const resizeObserver = new ResizeObserver(() => resizeStage(host, stage));
    resizeObserver.observe(host);
    resizeStage(host, stage);

    let frameId = 0;
    const animate = () => {
      updateFreeFlyCamera(stage);
      stage.controls.update();
      stage.renderer.clear();
      stage.renderer.render(stage.scene, stage.camera);
      if (stage.povViewmodelGroup.visible) {
        stage.renderer.clearDepth();
        stage.renderer.render(stage.povViewmodelScene, stage.povViewmodelCamera);
      }
      frameId = window.requestAnimationFrame(animate);
    };
    frameId = window.requestAnimationFrame(animate);

    stage.loader.load(
      assetResult.assetUrl,
      (gltf) => {
        const mapScene = gltf.scene;
        if (!stageActive) {
          disposeObjectMeshes(mapScene);
          return;
        }
        mapScene.name = `${replay.map.mapId}-source2-map`;
        prepareMapSceneForReview(mapScene, stage.renderer);
        stage.mapCollisionMeshes = collectCameraCollisionMeshes(mapScene);
        stage.scene.add(mapScene);
        frameCameraAroundMap(stage, mapScene);
        stage.hasFramedPlayers = false;
        stage.lastFramedSelectedPlayerId = null;
        stage.lastRenderedTick = null;
        setMapLoaded(true);
      },
      undefined,
      (error) => {
        if (stageActive) {
          setLoadError(error instanceof Error ? error.message : String(error));
        }
      },
    );

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof HTMLCanvasElement)) {
        return;
      }
      if (stage.cameraMode === "free") {
        target.focus();
        if (document.pointerLockElement !== target) {
          void target.requestPointerLock();
        }
        stage.cameraUserControlled = true;
        return;
      }
      const selected = pickNearestPlayerMarker(stage, playerMarkersRef.current, event);
      if (selected) {
        onSelectPlayerRef.current(selected.playerId);
      }
    };
    const onMouseMove = (event: MouseEvent) => {
      if (document.pointerLockElement !== stage.renderer.domElement || stage.cameraMode !== "free") {
        return;
      }
      stage.freeFly.yaw -= event.movementX * FREE_FLY_MOUSE_SENSITIVITY;
      stage.freeFly.pitch -= event.movementY * FREE_FLY_MOUSE_SENSITIVITY;
      stage.freeFly.pitch = Math.max(-Math.PI / 2 + 0.02, Math.min(Math.PI / 2 - 0.02, stage.freeFly.pitch));
      applyFreeFlyCameraRotation(stage);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (!isFreeFlyKey(event.code)) {
        return;
      }
      stage.freeFly.keys.add(event.code);
      if (stage.cameraMode === "free") {
        event.preventDefault();
        stage.cameraUserControlled = true;
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (!isFreeFlyKey(event.code)) {
        return;
      }
      stage.freeFly.keys.delete(event.code);
      if (stage.cameraMode === "free") {
        event.preventDefault();
      }
    };
    host.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    return () => {
      stageActive = false;
      window.cancelAnimationFrame(frameId);
      host.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      stage.freeFly.keys.clear();
      if (document.pointerLockElement === stage.renderer.domElement) {
        document.exitPointerLock();
      }
      resizeObserver.disconnect();
      for (const marker of playerMarkerByIdRef.current.values()) {
        disposePlayerMarker(marker);
      }
      playerMarkerByIdRef.current.clear();
      playerMarkersRef.current = [];
      stage.dispose();
      stageRef.current = null;
    };
  }, [assetResult, assetUrl, replay.map.mapId]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || assetResult?.available !== true) {
      return;
    }

    renderPlayers3d({
      assetResult,
      currentTick,
      playerAnimations,
      playerNameById,
      playerSideById,
      povViewmodels,
      playerMarkerByIdRef,
      playerModels,
      weaponModels,
      replay,
      round,
      cameraMode,
      selectedPlayerId,
      stage,
      markerRef: playerMarkersRef,
    });
  }, [assetResult, cameraMode, currentTick, mapLoaded, playerAnimations, playerModels, playerNameById, playerSideById, povViewmodels, replay, round, selectedPlayerId, weaponModels]);

  const setCameraPreset = (mode: Replay3DCameraMode) => {
    setCameraMode(mode);
    const stage = stageRef.current;
    if (!stage) {
      return;
    }

    stage.cameraMode = mode;
    stage.cameraUserControlled = mode === "free";
    stage.controls.enabled = mode !== "pov" && mode !== "free";
    stage.freeFly.lastFrameTime = performance.now();
    if (mode !== "free") {
      stage.freeFly.keys.clear();
      stage.hasFramedPlayers = false;
      stage.lastFramedSelectedPlayerId = null;
      if (document.pointerLockElement === stage.renderer.domElement) {
        document.exitPointerLock();
      }
    } else {
      syncFreeFlyAnglesFromCamera(stage);
    }
  };

  return (
    <div className={styles.shell}>
      <div className={styles.viewport} ref={hostRef} />
      {assetResult?.available === true && mapLoaded && (cameraMode === "pov" || cameraMode === "free") ? (
        <div className={cameraMode === "pov" ? styles.reviewCrosshairPov : styles.reviewCrosshairFree} aria-hidden="true" />
      ) : null}
      {assetResult?.available === true && mapLoaded ? (
        <div className={styles.overlay}>
          <strong>3D Tactical</strong>
          <span>{assetResult.displayName ?? replay.map.displayName} rendered from exported Source 2 map assets.</span>
          <span>Players use canonical replay x/y/z/yaw/pitch/eye position. POV uses parser view and viewmodel state; the crosshair is a review reticle, not exact player config, recoil, or spread.</span>
        </div>
      ) : null}
      {assetResult?.available === true && mapLoaded ? (
        <div className={styles.cameraControls} aria-label="3D camera presets">
          <button
            className={cameraMode === "tactical" ? styles.cameraButtonActive : styles.cameraButton}
            type="button"
            onClick={() => setCameraPreset("tactical")}
          >
            Tactical
          </button>
          <button
            className={cameraMode === "chase" ? styles.cameraButtonActive : styles.cameraButton}
            type="button"
            onClick={() => setCameraPreset("chase")}
            title="Follow the selected player, or the first alive player if none is selected"
          >
            Chase
          </button>
          <button
            className={cameraMode === "pov" ? styles.cameraButtonActive : styles.cameraButton}
            type="button"
            onClick={() => setCameraPreset("pov")}
            title="Parser-backed eye position, pitch, yaw, active weapon, and viewmodel state; no exact CS2 client renderer"
          >
            POV
          </button>
          <button className={cameraMode === "free" ? styles.cameraButtonActive : styles.cameraButton} title="Click the canvas, then use mouse look, WASD, Q/E, Shift, and Alt." type="button" onClick={() => setCameraPreset("free")}>
            Free
          </button>
        </div>
      ) : null}
      {assetResult?.available === true && !mapLoaded && !loadError ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyPanel}>
            <strong>Loading 3D map</strong>
            <span>{replay.map.displayName} Source 2 asset is being loaded by Three.js.</span>
            <code>{assetResult.assetUrl}</code>
          </div>
        </div>
      ) : null}
      {assetResult?.available === false ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyPanel}>
            <strong>3D assets missing</strong>
            <span>{assetResult.reason}</span>
            <span>Expected manifest:</span>
            <code>{assetResult.manifestUrl}</code>
          </div>
        </div>
      ) : null}
      {loadError ? (
        <div className={styles.errorState}>
          <div className={styles.errorPanel}>
            <strong>3D map failed to load</strong>
            <span>{loadError}</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}

async function loadPlayerModelSet(): Promise<PlayerModelSet | null> {
  try {
    const response = await fetch(PLAYER_MODEL_MANIFEST_URL, { cache: "no-store" });
    if (!response.ok) {
      return null;
    }

    const manifest = (await response.json()) as { assetPath?: unknown; ctAssetPath?: unknown; ctSource?: unknown; source?: unknown; tAssetPath?: unknown; tSource?: unknown };
    const loader = new GLTFLoader();

    if (typeof manifest.ctAssetPath === "string" && manifest.ctAssetPath.trim() && typeof manifest.tAssetPath === "string" && manifest.tAssetPath.trim()) {
      const ctAssetUrl = normalizeRelativeUrl(PLAYER_MODEL_MANIFEST_URL, manifest.ctAssetPath);
      const tAssetUrl = normalizeRelativeUrl(PLAYER_MODEL_MANIFEST_URL, manifest.tAssetPath);
      const [ctGltf, tGltf] = await Promise.all([loader.loadAsync(ctAssetUrl), loader.loadAsync(tAssetUrl)]);
      return {
        ct: preparePlayerModelTemplate(ctGltf.scene, "ct-agent-player-model", ctGltf.animations),
        source: [manifest.ctSource, manifest.tSource].filter((value): value is string => typeof value === "string").join(" | ") || `${ctAssetUrl} | ${tAssetUrl}`,
        t: preparePlayerModelTemplate(tGltf.scene, "t-agent-player-model", tGltf.animations),
      };
    }

    if (typeof manifest.assetPath === "string" && manifest.assetPath.trim()) {
      const assetUrl = normalizeRelativeUrl(PLAYER_MODEL_MANIFEST_URL, manifest.assetPath);
      const gltf = await loader.loadAsync(assetUrl);
      const templates = extractPlayerModelTemplates(gltf.scene);
      return {
        ...templates,
        source: typeof manifest.source === "string" ? manifest.source : assetUrl,
      };
    }

    return null;
  } catch (error) {
    console.warn("DemoRead 3D player model loader failed", error);
    return null;
  }
}

function normalizeRelativeUrl(baseUrl: string, assetPath: string) {
  if (assetPath.startsWith("/")) {
    return assetPath;
  }

  const baseParts = baseUrl.split("/");
  baseParts.pop();
  return `${baseParts.join("/")}/${assetPath.replace(/^\.?\//, "")}`;
}

function extractPlayerModelTemplates(scene: Group): Pick<PlayerModelSet, "ct" | "t"> {
  let ct: PlayerModelTemplate | null = null;
  let t: PlayerModelTemplate | null = null;

  for (const child of scene.children) {
    const name = child.name.toLowerCase();
    if (name.includes("ct_team")) {
      ct = preparePlayerModelTemplate(child, "ct-player-model-proxy", []);
    } else if (name.includes("t_team")) {
      t = preparePlayerModelTemplate(child, "t-player-model-proxy", []);
    }
  }

  return { ct, t };
}

function preparePlayerModelTemplate(object: Object3D, name: string, animations: AnimationClip[]): PlayerModelTemplate {
  const povHands = preparePovHandsTemplate(object, `${name}:pov-hands`);
  const group = new Group();
  group.name = name;
  const cloned = cloneSkeleton(object);
  prunePlayerModelTemplate(cloned);
  makeObjectTransformsEditable(cloned);
  group.add(cloned);

  let bounds = new Box3().setFromObject(group);
  const size = bounds.getSize(new Vector3());
  if (size.x > size.y * 1.5 && size.x > size.z * 1.5) {
    cloned.rotation.z = Math.PI / 2;
  } else if (size.z > size.y * 1.5 && size.z > size.x * 1.5) {
    cloned.rotation.x = -Math.PI / 2;
  }

  cloned.updateMatrixWorld(true);
  bounds = new Box3().setFromObject(group);
  if (!bounds.isEmpty()) {
    const center = bounds.getCenter(new Vector3());
    cloned.position.x -= center.x;
    cloned.position.y -= bounds.min.y;
    cloned.position.z -= center.z;
  }

  group.traverse((child) => {
    if (child instanceof Mesh) {
      child.renderOrder = 53;
      child.material = preparePlayerModelMaterial(child.material);
      child.userData[SHARED_3D_MODEL_RESOURCE_FLAG] = true;
    }
  });

  return {
    animations: pickPlayerAnimationClips(animations),
    group,
    povHands,
  };
}

function preparePovHandsTemplate(object: Object3D, name: string) {
  const group = new Group();
  group.name = name;
  const cloned = cloneSkeleton(object);
  prunePovHandsTemplate(cloned);
  makeObjectTransformsEditable(cloned);
  group.add(cloned);

  let bounds = computeVisiblePlayerModelBounds(group);
  if (bounds.isEmpty()) {
    disposeObjectMeshes(group);
    return null;
  }

  const center = bounds.getCenter(new Vector3());
  cloned.position.sub(center);
  cloned.updateMatrixWorld(true);
  bounds = computeVisiblePlayerModelBounds(group);
  const size = bounds.getSize(new Vector3());
  const longestAxis = Math.max(size.x, size.y, size.z, 0.001);
  cloned.scale.multiplyScalar(1 / longestAxis);

  group.traverse((child) => {
    if (child instanceof Mesh) {
      child.renderOrder = 93;
      child.material = preparePlayerModelMaterial(child.material);
      child.userData[SHARED_3D_MODEL_RESOURCE_FLAG] = true;
    }
  });

  return group;
}

function pickPlayerAnimationClips(animations: AnimationClip[]) {
  void animations;
  return [];
}

function prunePlayerModelTemplate(object: Object3D) {
  for (const child of [...object.children]) {
    if (child instanceof Mesh && shouldPrunePlayerModelMesh(child.name)) {
      object.remove(child);
      disposeObjectMeshes(child);
      continue;
    }

    prunePlayerModelTemplate(child);
  }
}

function prunePovHandsTemplate(object: Object3D) {
  for (const child of [...object.children]) {
    if (child instanceof Mesh && !isPovHandsMesh(child.name)) {
      object.remove(child);
      disposeObjectMeshes(child);
      continue;
    }

    prunePovHandsTemplate(child);
  }
}

function isPovHandsMesh(name: string) {
  const lowerName = name.toLowerCase();
  return lowerName.includes("firstperson_default_gloves_arms") || lowerName.includes("firstperson_sleeves");
}

function shouldPrunePlayerModelMesh(name: string) {
  const lowerName = name.toLowerCase();
  return lowerName.includes("firstperson") || lowerName.includes("defusekit") || lowerName.includes("_physics") || lowerName.includes(".physics");
}

function makeObjectTransformsEditable(object: Object3D) {
  object.traverse((child) => {
    child.matrix.decompose(child.position, child.quaternion, child.scale);
    child.matrix.identity();
    child.matrixAutoUpdate = true;
  });
}

function preparePlayerModelMaterial(materialOrMaterials: Mesh["material"]) {
  const materials = Array.isArray(materialOrMaterials) ? materialOrMaterials : [materialOrMaterials];
  const prepared = materials.map((material) => {
    if (material instanceof MeshStandardMaterial) {
      const converted = new MeshBasicMaterial({
        alphaMap: material.alphaMap,
        alphaTest: material.alphaTest,
        color: 0xf0ede4,
        depthTest: true,
        depthWrite: true,
        map: material.map,
        name: material.name,
        opacity: 1,
        side: material.side,
        transparent: false,
      });
      converted.userData = material.userData;
      return converted;
    }

    return material;
  });

  return Array.isArray(materialOrMaterials) ? prepared : prepared[0];
}

function disposePlayerModelSet(models: PlayerModelSet | null) {
  if (!models) {
    return;
  }

  if (models.ct) {
    disposeObjectMeshes(models.ct.group);
    if (models.ct.povHands) {
      disposeObjectMeshes(models.ct.povHands);
    }
  }
  if (models.t) {
    disposeObjectMeshes(models.t.group);
    if (models.t.povHands) {
      disposeObjectMeshes(models.t.povHands);
    }
  }
}

async function loadPlayerAnimationSet(): Promise<PlayerAnimationSet | null> {
  try {
    const response = await fetch(PLAYER_ANIMATION_MANIFEST_URL, { cache: "no-store" });
    if (!response.ok) {
      return null;
    }

    const manifest = (await response.json()) as { animationClips?: unknown; displayName?: unknown };
    if (!manifest.animationClips || typeof manifest.animationClips !== "object" || Array.isArray(manifest.animationClips)) {
      return null;
    }

    const loader = new GLTFLoader();
    const byKey = new Map<string, AnimationClip>();
    const entries = Object.entries(manifest.animationClips).filter((entry): entry is [string, { assetPath: string }] => {
      const [key, value] = entry;
      return (
        USED_PLAYER_LOCOMOTION_ANIMATION_KEYS.has(key) &&
        key.trim().length > 0 &&
        value != null &&
        typeof value === "object" &&
        "assetPath" in value &&
        typeof value.assetPath === "string" &&
        value.assetPath.trim().length > 0
      );
    });

    await Promise.all(
      entries.map(async ([key, clipInfo]) => {
        const assetUrl = normalizeRelativeUrl(PLAYER_ANIMATION_MANIFEST_URL, clipInfo.assetPath);
        const gltf = await loader.loadAsync(assetUrl);
        const clip = gltf.animations[0];
        if (clip) {
          byKey.set(key, sanitizePlayerLocomotionClip(clip, key));
        }
      }),
    );

    return {
      byKey,
      source: typeof manifest.displayName === "string" ? manifest.displayName : PLAYER_ANIMATION_MANIFEST_URL,
    };
  } catch (error) {
    console.warn("DemoRead 3D player animation loader failed", error);
    return null;
  }
}

function sanitizePlayerLocomotionClip(clip: AnimationClip, key: string) {
  const tracks = clip.tracks.filter((track) => {
    const name = track.name.toLowerCase();
    const target = name.split(".")[0] ?? "";
    const property = name.split(".").pop() ?? "";
    if (
      target === "attachhand_l" ||
      target === "attachhand_r" ||
      target === "attachfoot_l" ||
      target === "attachfoot_r" ||
      target === "attachworld" ||
      target === "wpnaimintent" ||
      target === "wpnend" ||
      target === "wpnhand_l" ||
      target === "wpnhand_r" ||
      target === "wpntip"
    ) {
      return false;
    }

    if (property === "scale") {
      return false;
    }

    if (target === "root_motion") {
      return property === "quaternion" || property === "rotation";
    }

    return property === "quaternion" || property === "rotation";
  });
  return new AnimationClip(`cs2_${key}`, clip.duration, tracks);
}

type LoadWeaponModelSetArgs = {
  onTemplateLoaded?: (models: WeaponModelSet, key: string) => void;
  priorityKeys?: string[];
};

async function loadWeaponModelSet({ onTemplateLoaded, priorityKeys = [] }: LoadWeaponModelSetArgs = {}): Promise<WeaponModelSet | null> {
  try {
    const response = await fetch(WEAPON_MODEL_MANIFEST_URL, { cache: "no-store" });
    if (!response.ok) {
      return null;
    }

    const manifest = (await response.json()) as { source?: unknown; weaponAssetPaths?: unknown; weaponSources?: unknown };
    if (!manifest.weaponAssetPaths || typeof manifest.weaponAssetPaths !== "object" || Array.isArray(manifest.weaponAssetPaths)) {
      return null;
    }

    const loader = new GLTFLoader();
    const byKey = new Map<string, WeaponModelTemplate>();
    const requestedKeys = new Set(priorityKeys);
    const entries = Object.entries(manifest.weaponAssetPaths).filter((entry): entry is [string, string] => {
      const [key, value] = entry;
      return requestedKeys.has(key) && key.trim().length > 0 && typeof value === "string" && value.trim().length > 0;
    });
    const modelSet = {
      byKey,
      source: typeof manifest.source === "string" ? manifest.source : WEAPON_MODEL_MANIFEST_URL,
    };
    const failures: Array<{ assetUrl: string; key: string; message: string }> = [];
    await loadWeaponModelEntriesInPriorityOrder({
      entries,
      loader,
      onLoaded: (key, template) => {
        byKey.set(key, template);
        onTemplateLoaded?.(modelSet, key);
      },
      onFailed: (key, assetUrl, error) => {
        failures.push({
          assetUrl,
          key,
          message: error instanceof Error ? error.message : String(error),
        });
      },
      priorityKeys,
    });
    if (failures.length > 0) {
      console.warn("DemoRead 3D weapon model load failures", failures);
    }
    if (byKey.size === 0) {
      return null;
    }

    return modelSet;
  } catch (error) {
    console.warn("DemoRead 3D weapon model loader failed", error);
    return null;
  }
}

async function loadWeaponModelEntriesInPriorityOrder({
  entries,
  loader,
  onFailed,
  onLoaded,
  priorityKeys,
}: {
  entries: Array<[string, string]>;
  loader: GLTFLoader;
  onFailed: (key: string, assetUrl: string, error: unknown) => void;
  onLoaded: (key: string, template: WeaponModelTemplate) => void;
  priorityKeys: string[];
}) {
  const sortedEntries = sortWeaponModelEntries(entries, priorityKeys);
  const concurrency = 3;
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(concurrency, sortedEntries.length) }, async () => {
    while (nextIndex < sortedEntries.length) {
      const [key, assetPath] = sortedEntries[nextIndex];
      nextIndex += 1;
      const assetUrl = normalizeRelativeUrl(WEAPON_MODEL_MANIFEST_URL, assetPath);
      try {
        const gltf = await loader.loadAsync(assetUrl);
        onLoaded(key, prepareWeaponModelTemplate(gltf.scene, key));
      } catch (error) {
        onFailed(key, assetUrl, error);
      }
    }
  });
  await Promise.all(workers);
}

function sortWeaponModelEntries(entries: Array<[string, string]>, priorityKeys: string[]) {
  const priority = new Map(priorityKeys.map((key, index) => [key, index]));
  return [...entries].sort(([leftKey], [rightKey]) => {
    const leftPriority = priority.get(leftKey) ?? Number.MAX_SAFE_INTEGER;
    const rightPriority = priority.get(rightKey) ?? Number.MAX_SAFE_INTEGER;
    if (leftPriority !== rightPriority) {
      return leftPriority - rightPriority;
    }

    return leftKey.localeCompare(rightKey);
  });
}

function prepareWeaponModelTemplate(object: Object3D, key: string): WeaponModelTemplate {
  const group = new Group();
  group.name = `weapon-model-template:${key}`;
  const cloned = object.clone(true);
  makeObjectTransformsEditable(cloned);
  group.add(cloned);

  let bounds = new Box3().setFromObject(group);
  canonicalizeWeaponModelForward(cloned, bounds);
  cloned.updateMatrixWorld(true);
  bounds = new Box3().setFromObject(group);
  if (!bounds.isEmpty()) {
    const size = bounds.getSize(new Vector3());
    const maxDimension = Math.max(size.x, size.y, size.z, 0.001);
    const center = bounds.getCenter(new Vector3());
    cloned.position.sub(center);
    cloned.scale.multiplyScalar(1 / maxDimension);
  }

  cloned.updateMatrixWorld(true);
  bounds = new Box3().setFromObject(group);
  if (!bounds.isEmpty()) {
    const center = bounds.getCenter(new Vector3());
    cloned.position.x -= center.x;
    cloned.position.y -= center.y;
    cloned.position.z -= center.z;
  }

  group.traverse((child) => {
    if (child instanceof Mesh) {
      child.renderOrder = 54;
      child.material = prepareWeaponModelMaterial(child.material);
      child.userData[SHARED_3D_MODEL_RESOURCE_FLAG] = true;
    }
  });

  return { group, key };
}

function canonicalizeWeaponModelForward(object: Object3D, bounds: Box3) {
  if (bounds.isEmpty()) {
    return;
  }

  const size = bounds.getSize(new Vector3());
  if (size.y > size.x && size.y > size.z) {
    object.rotation.x -= Math.PI / 2;
  } else if (size.x >= size.z) {
    object.rotation.y += Math.PI / 2;
  } else {
    object.rotation.y += Math.PI;
  }
}

function prepareWeaponModelMaterial(materialOrMaterials: Mesh["material"]) {
  const materials = Array.isArray(materialOrMaterials) ? materialOrMaterials : [materialOrMaterials];
  const prepared = materials.map((material) => {
    if (material instanceof MeshStandardMaterial) {
      const converted = new MeshBasicMaterial({
        alphaMap: null,
        alphaTest: 0,
        color: 0xe7dfd2,
        depthTest: true,
        depthWrite: true,
        map: material.map,
        name: material.name,
        opacity: 1,
        side: DoubleSide,
        transparent: false,
      });
      converted.userData = material.userData;
      return converted;
    }

    if (material instanceof MeshBasicMaterial) {
      const converted = material.clone();
      converted.alphaMap = null;
      converted.alphaTest = 0;
      converted.depthTest = true;
      converted.depthWrite = true;
      converted.opacity = 1;
      converted.side = DoubleSide;
      converted.transparent = false;
      return converted;
    }

    return material;
  });

  return Array.isArray(materialOrMaterials) ? prepared : prepared[0];
}

function disposeWeaponModelSet(models: WeaponModelSet | null) {
  if (!models) {
    return;
  }

  for (const template of models.byKey.values()) {
    disposeObjectMeshes(template.group);
  }
}

type LoadPovViewmodelSetArgs = {
  onTemplateLoaded?: (models: PovViewmodelSet, key: string) => void;
  priorityKeys?: string[];
};

async function loadPovViewmodelSet({ onTemplateLoaded, priorityKeys = [] }: LoadPovViewmodelSetArgs = {}): Promise<PovViewmodelSet | null> {
  try {
    const response = await fetch(POV_VIEWMODEL_MANIFEST_URL, { cache: "no-store" });
    if (!response.ok) {
      return null;
    }

    const manifest = (await response.json()) as { armsAssetPath?: unknown; displayName?: unknown; weaponAssetPaths?: unknown };
    if (typeof manifest.armsAssetPath !== "string" || !manifest.armsAssetPath.trim()) {
      return null;
    }
    if (!manifest.weaponAssetPaths || typeof manifest.weaponAssetPaths !== "object" || Array.isArray(manifest.weaponAssetPaths)) {
      return null;
    }

    const loader = new GLTFLoader();
    const armsUrl = normalizeRelativeUrl(POV_VIEWMODEL_MANIFEST_URL, manifest.armsAssetPath);
    const armsGltf = await loader.loadAsync(armsUrl);
    const modelSet: PovViewmodelSet = {
      arms: preparePovViewmodelArmsTemplate(armsGltf.scene, armsGltf.animations),
      source: typeof manifest.displayName === "string" ? manifest.displayName : POV_VIEWMODEL_MANIFEST_URL,
      weaponsByKey: new Map(),
    };
    onTemplateLoaded?.(modelSet, "arms");

    const entries = Object.entries(manifest.weaponAssetPaths).filter((entry): entry is [string, string] => {
      const [key, value] = entry;
      return key.trim().length > 0 && typeof value === "string" && value.trim().length > 0;
    });
    const priorityKeySet = new Set(priorityKeys.length > 0 ? priorityKeys : ["glock18", "uspsilencer", "ak47", "knife_default_ct", "knife_default_t"]);
    const sortedEntries = sortWeaponModelEntries(entries, priorityKeys).filter(([key]) => priorityKeySet.size === 0 || priorityKeySet.has(key));
    const failures: Array<{ assetUrl: string; key: string; message: string }> = [];
    const concurrency = 2;
    let nextIndex = 0;
    const workers = Array.from({ length: Math.min(concurrency, sortedEntries.length) }, async () => {
      while (nextIndex < sortedEntries.length) {
        const [key, assetPath] = sortedEntries[nextIndex];
        nextIndex += 1;
        const assetUrl = normalizeRelativeUrl(POV_VIEWMODEL_MANIFEST_URL, assetPath);
        try {
          const gltf = await loader.loadAsync(assetUrl);
          modelSet.weaponsByKey.set(key, preparePovViewmodelWeaponTemplate(gltf.scene, key, gltf.animations));
          onTemplateLoaded?.(modelSet, key);
        } catch (error) {
          failures.push({
            assetUrl,
            key,
            message: error instanceof Error ? error.message : String(error),
          });
        }
      }
    });
    await Promise.all(workers);

    if (failures.length > 0) {
      console.warn("DemoRead 3D POV viewmodel load failures", failures);
    }

    return modelSet.arms || modelSet.weaponsByKey.size > 0 ? modelSet : null;
  } catch (error) {
    console.warn("DemoRead 3D POV viewmodel loader failed", error);
    return null;
  }
}

function preparePovViewmodelArmsTemplate(object: Object3D, animations: AnimationClip[]): PovViewmodelTemplate {
  const group = new Group();
  group.name = "pov-viewmodel-template:arms";
  const cloned = cloneSkeleton(object);
  makeObjectTransformsEditable(cloned);
  group.add(cloned);
  normalizePovViewmodelTemplate(group, cloned);
  preparePovViewmodelTemplateMeshes(group, 93);
  return { animations, group, key: "arms" };
}

function preparePovViewmodelWeaponTemplate(object: Object3D, key: string, animations: AnimationClip[]): PovViewmodelTemplate {
  const group = new Group();
  group.name = `pov-viewmodel-template:${key}`;
  const cloned = cloneSkeleton(object);
  makeObjectTransformsEditable(cloned);
  prunePovWeaponModelTemplate(cloned);
  group.add(cloned);
  canonicalizeWeaponModelForward(cloned, computeVisiblePlayerModelBounds(group));
  normalizePovViewmodelTemplate(group, cloned);
  if (typeof group.userData.povBaseScale === "number") {
    group.userData.povBaseScale *= povWeaponTargetLengthForKey(key);
  }
  group.userData.povAnimations = animations;
  preparePovViewmodelTemplateMeshes(group, 94);
  return { animations, group, key };
}

function normalizePovViewmodelTemplate(group: Group, object: Object3D) {
  object.updateWorldMatrix(true, true);
  let bounds = computeVisiblePlayerModelBounds(group);
  if (bounds.isEmpty()) {
    group.userData.povBaseScale = 1;
    return;
  }

  const center = bounds.getCenter(new Vector3());
  object.position.sub(center);
  object.updateWorldMatrix(true, true);
  bounds = computeVisiblePlayerModelBounds(group);
  const size = bounds.getSize(new Vector3());
  const longestAxis = Math.max(size.x, size.y, size.z, 0.001);
  group.userData.povBaseScale = 1 / longestAxis;
}

function preparePovViewmodelTemplateMeshes(group: Group, renderOrder: number) {
  group.traverse((child) => {
    if (child instanceof Mesh) {
      child.frustumCulled = false;
      child.renderOrder = renderOrder;
      child.material = preparePovViewmodelMaterial(child.material);
      child.userData[SHARED_3D_MODEL_RESOURCE_FLAG] = true;
    }
  });
}

function prunePovWeaponModelTemplate(object: Object3D) {
  const hasHdBody = objectHasMeshName(object, (name) => name.includes("body_hd"));
  for (const child of [...object.children]) {
    const lowerName = child.name.toLowerCase();
    if (child instanceof Mesh && (lowerName.includes("_physics") || lowerName.includes(".physics") || (hasHdBody && lowerName.includes("body_legacy")))) {
      object.remove(child);
      disposeObjectMeshes(child);
      continue;
    }

    prunePovWeaponModelTemplate(child);
  }
}

function objectHasMeshName(object: Object3D, predicate: (lowerName: string) => boolean) {
  let found = false;
  object.traverse((child) => {
    if (!found && child instanceof Mesh && predicate(child.name.toLowerCase())) {
      found = true;
    }
  });
  return found;
}

function preparePovViewmodelMaterial(materialOrMaterials: Mesh["material"]) {
  const materials = Array.isArray(materialOrMaterials) ? materialOrMaterials : [materialOrMaterials];
  const prepared = materials.map((material) => {
    if (material instanceof MeshStandardMaterial) {
      const converted = new MeshBasicMaterial({
        alphaMap: null,
        alphaTest: 0,
        color: 0xffffff,
        depthTest: true,
        depthWrite: true,
        map: material.map,
        name: material.name,
        opacity: 1,
        side: DoubleSide,
        transparent: false,
      });
      converted.userData = material.userData;
      return converted;
    }

    if (material instanceof MeshBasicMaterial) {
      const converted = material.clone();
      converted.alphaMap = null;
      converted.alphaTest = 0;
      converted.depthTest = true;
      converted.depthWrite = true;
      converted.opacity = 1;
      converted.side = DoubleSide;
      converted.transparent = false;
      return converted;
    }

    const cloned = material.clone();
    cloned.depthTest = true;
    cloned.depthWrite = true;
    cloned.opacity = 1;
    cloned.transparent = false;
    return cloned;
  });

  return Array.isArray(materialOrMaterials) ? prepared : prepared[0];
}

function disposePovViewmodelSet(models: PovViewmodelSet | null) {
  if (!models) {
    return;
  }

  if (models.arms) {
    disposeObjectMeshes(models.arms.group);
  }
  for (const template of models.weaponsByKey.values()) {
    disposeObjectMeshes(template.group);
  }
}

function renderPlayers3d({
  assetResult,
  cameraMode,
  currentTick,
  markerRef,
  playerAnimations,
  playerMarkerByIdRef,
  playerNameById,
  playerModels,
  playerSideById,
  povViewmodels,
  replay,
  round,
  selectedPlayerId,
  stage,
  weaponModels,
}: {
  assetResult: Extract<Replay3DMapAssetResult, { available: true }>;
  cameraMode: Replay3DCameraMode;
  currentTick: number;
  markerRef: React.MutableRefObject<PlayerMarker[]>;
  playerAnimations: PlayerAnimationSet | null;
  playerMarkerByIdRef: React.MutableRefObject<Map<string, PlayerMarker>>;
  playerNameById: Map<string, string>;
  playerModels: PlayerModelSet | null;
  playerSideById: Map<string, "CT" | "T" | null>;
  povViewmodels: PovViewmodelSet | null;
  replay: Replay;
  round: Round;
  selectedPlayerId: string | null;
  stage: ThreeStage;
  weaponModels: WeaponModelSet | null;
}) {
  stage.cameraMode = cameraMode;
  stage.controls.enabled = cameraMode !== "pov" && cameraMode !== "free";
  disposeObjectMeshes(stage.utilityGroup);
  stage.utilityGroup.clear();

  const playerDimensions = resolvePlayerReviewDimensions(round, currentTick, replay, assetResult.coordinateTransform);
  const playerRadius = playerDimensions.radius;
  let selectedMarker: Group | null = null;
  const aliveMarkers: Group[] = [];
  const aliveCtMarkers: Group[] = [];
  const aliveTMarkers: Group[] = [];
  const alivePlayerIds = new Set<string>();
  let selectedAimView: PlayerPovCameraView | null = null;
  let fallbackAimView: PlayerPovCameraView | null = null;
  let povCameraView: PlayerPovCameraView | null = null;
  let fallbackPovCameraView: PlayerPovCameraView | null = null;
  for (const stream of round.playerStreams) {
    if (stream.side == null) {
      continue;
    }

    const sample = interpolatePlayerStreamSample(stream, currentTick);
    if (!sample?.alive) {
      continue;
    }

    const position = source2PointToGltf(sample, assetResult.coordinateTransform);
    if (!position) {
      continue;
    }

    alivePlayerIds.add(stream.playerId);
    const label = playerNameById.get(stream.playerId) ?? stream.playerId;
    const selected = stream.playerId === selectedPlayerId;
    const modelTemplate = playerModelTemplateForSide(playerModels, stream.side);
    const weaponKey = resolveReplayWeaponModelKey({
      activeWeapon: sample.activeWeapon,
      activeWeaponClass: sample.activeWeaponClass,
      hasBomb: sample.hasBomb,
      mainWeapon: sample.mainWeapon,
      side: stream.side,
    });
    const weaponTemplate = weaponModelTemplateForKey(weaponModels, weaponKey);
    const renderedWeaponKey = weaponKey;
    const weaponHasModel = weaponTemplate != null;
    const existing = playerMarkerByIdRef.current.get(stream.playerId);
    const marker =
      existing &&
      existing.side === stream.side &&
      existing.selected === selected &&
      existing.label === label &&
      existing.hasModel === Boolean(modelTemplate) &&
      existing.animationClipCount === (modelTemplate && playerAnimations ? playerAnimations.byKey.size : 0) &&
      existing.weaponHasModel === weaponHasModel &&
      existing.weaponKey === renderedWeaponKey
        ? existing
        : replacePlayerMarker({
            coordinateScale: assetResult.coordinateTransform.scale,
            existing,
            label,
            playerAnimations,
            modelTemplate,
            playerId: stream.playerId,
            playerMarkerByIdRef,
            playerModelHeight: playerDimensions.modelHeight,
            radius: playerRadius,
            selected,
            side: stream.side,
            stage,
            weaponKey: renderedWeaponKey,
            weaponTemplate,
          });

    marker.object.position.copy(position);
    const yawRadians = source2YawToGltfRadians(sample.yaw, assetResult.coordinateTransform);
    marker.object.rotation.y = yawRadians;
    const playerPitch = isFiniteReplayNumber(sample.pitch) ? sample.pitch : null;
    const eyePosition = source2PointToGltf({ x: sample.eyeX, y: sample.eyeY, z: sample.eyeZ }, assetResult.coordinateTransform);
    if (eyePosition && isFiniteReplayNumber(sample.yaw) && isFiniteReplayNumber(sample.pitch)) {
      const view: PlayerPovCameraView = {
        eyePosition,
        isScoped: sample.isScoped,
        pitch: sample.pitch,
        playerId: stream.playerId,
        recentFireAgeSeconds: resolveRecentPovFireAgeSeconds(round, stream.playerId, currentTick, replay.match.tickRate),
        recoilIndex: sample.recoilIndex,
        side: stream.side,
        viewmodelFov: sample.viewmodelFov,
        viewmodelOffsetX: sample.viewmodelOffsetX,
        viewmodelOffsetY: sample.viewmodelOffsetY,
        viewmodelOffsetZ: sample.viewmodelOffsetZ,
        weaponKey,
        yaw: sample.yaw,
        zoomLevel: sample.zoomLevel,
      };
      if (selected) {
        selectedAimView = view;
      } else if (isBetterFallbackPovView(view, fallbackAimView)) {
        fallbackAimView = view;
      }
      if (cameraMode === "pov") {
        if (stream.playerId === selectedPlayerId) {
          povCameraView = view;
        } else if (isBetterFallbackPovView(view, fallbackPovCameraView)) {
          fallbackPovCameraView = view;
        }
      }
    }
    updatePlayerMarkerAnimation({
      activeWeaponClass: sample.activeWeaponClass,
      currentTick,
      marker,
      position,
      replay,
      weaponKey,
    });
    applyPlayerLookPitch(marker.object, playerPitch, marker.hasModel);
    applyCarriedWeaponPitch(marker.weaponObject, playerPitch, marker.carriedWeaponNeedsPitchOverlay);
    maintainPlayerModelFootClearance(marker.model, marker.object.position.y);
    updatePlayerAimPitchCue(marker.object, playerPitch, playerRadius, marker.hasModel);
    if (stream.playerId === selectedPlayerId) {
      selectedMarker = marker.object;
    }
    aliveMarkers.push(marker.object);
    if (stream.side === "CT") {
      aliveCtMarkers.push(marker.object);
    } else {
      aliveTMarkers.push(marker.object);
    }
  }

  povCameraView ??= fallbackPovCameraView;

  for (const [playerId, marker] of playerMarkerByIdRef.current) {
    if (!alivePlayerIds.has(playerId)) {
      stage.playerGroup.remove(marker.object);
      playerMarkerByIdRef.current.delete(playerId);
      disposePlayerMarker(marker);
    }
  }

  markerRef.current = [...playerMarkerByIdRef.current.values()];
  const povPlayerId = povCameraView?.playerId ?? null;
  for (const marker of markerRef.current) {
    marker.object.visible = marker.playerId !== povPlayerId;
  }
  updateSelectedPlayerAimRay(stage, selectedAimView ?? fallbackAimView, assetResult.coordinateTransform, playerRadius, cameraMode);

  const selectedFrameTargetChanged = selectedPlayerId !== stage.lastFramedSelectedPlayerId;
  const previousRenderedTick = stage.lastRenderedTick;
  const seekedSinceLastRender =
    previousRenderedTick != null && Math.abs(currentTick - previousRenderedTick) > Math.max(16, Math.round(replay.match.tickRate * 1.5));
  stage.lastRenderedTick = currentTick;
  const fallbackCameraMarkers = selectTacticalCameraCluster(aliveMarkers, aliveCtMarkers, aliveTMarkers, playerRadius);
  const chaseMarker = selectedMarker ?? fallbackCameraMarkers[0] ?? aliveMarkers[0] ?? null;
  if (cameraMode === "pov" && !povCameraView) {
    clearPovWeaponViewmodel(stage);
    if (chaseMarker) {
      frameCameraBehindSelectedPlayer(stage, chaseMarker, playerRadius);
    } else if (fallbackCameraMarkers.length > 0) {
      frameCameraAroundPlayerCluster(stage, fallbackCameraMarkers, playerRadius);
    }
  } else if (cameraMode === "pov" && povCameraView) {
    frameCameraFromPlayerView(stage, povCameraView, assetResult.coordinateTransform);
    renderPovWeaponViewmodel(stage, povCameraView, povViewmodels, weaponModels, playerModels);
    stage.hasFramedPlayers = true;
    stage.lastFramedSelectedPlayerId = selectedPlayerId ?? povCameraView.playerId;
  } else if (cameraMode === "chase" && chaseMarker) {
    clearPovWeaponViewmodel(stage);
    frameCameraBehindSelectedPlayer(stage, chaseMarker, playerRadius);
    stage.hasFramedPlayers = true;
    stage.lastFramedSelectedPlayerId = selectedPlayerId ?? chaseMarker.name;
  } else if (cameraMode === "tactical" && !stage.cameraUserControlled) {
    clearPovWeaponViewmodel(stage);
    if (!stage.hasFramedPlayers || selectedFrameTargetChanged || seekedSinceLastRender) {
      if (selectedMarker) {
        frameCameraAroundSelectedPlayer(stage, selectedMarker, playerRadius);
      } else if (fallbackCameraMarkers.length > 0) {
        frameCameraAroundPlayerCluster(stage, fallbackCameraMarkers, playerRadius);
      }
      stage.hasFramedPlayers = true;
      stage.lastFramedSelectedPlayerId = selectedPlayerId;
    }
  } else if (cameraMode !== "pov") {
    clearPovWeaponViewmodel(stage);
  }
  updatePlayerLabelVisibility(stage, markerRef.current, cameraMode);

  renderUtilities3d({
    assetResult,
    cameraMode,
    currentTick,
    playerSideById,
    round,
    stage,
    tickRate: replay.match.tickRate,
  });

  renderGunfire3d({
    assetResult,
    currentTick,
    playerRadius,
    round,
    stage,
    tickRate: replay.match.tickRate,
  });
}

function playerModelTemplateForSide(models: PlayerModelSet | null, side: "CT" | "T") {
  if (!models) {
    return null;
  }

  return side === "CT" ? models.ct : models.t;
}

function weaponModelTemplateForKey(models: WeaponModelSet | null, key: string | null) {
  if (!models || !key) {
    return null;
  }

  return models.byKey.get(key) ?? null;
}

function replacePlayerMarker({
  coordinateScale,
  existing,
  label,
  playerAnimations,
  modelTemplate,
  playerId,
  playerMarkerByIdRef,
  playerModelHeight,
  radius,
  selected,
  side,
  stage,
  weaponKey,
  weaponTemplate,
}: {
  coordinateScale: number;
  existing: PlayerMarker | undefined;
  label: string;
  playerAnimations: PlayerAnimationSet | null;
  modelTemplate: PlayerModelTemplate | null;
  playerId: string;
  playerMarkerByIdRef: React.MutableRefObject<Map<string, PlayerMarker>>;
  playerModelHeight: number;
  radius: number;
  selected: boolean;
  side: "CT" | "T";
  stage: ThreeStage;
  weaponKey: string | null;
  weaponTemplate: WeaponModelTemplate | null;
}) {
  if (existing) {
    stage.playerGroup.remove(existing.object);
    disposePlayerMarker(existing);
  }

  const created = createPlayerMarker({
    coordinateScale,
    label,
    playerAnimations,
    modelTemplate,
    playerId,
    playerModelHeight,
    radius,
    selected,
    side,
    weaponKey,
    weaponTemplate,
  });
  stage.playerGroup.add(created.object);
  const marker: PlayerMarker = {
    activeAnimationKey: null,
    animationActions: created.animationActions,
    animationClipCount: created.animationClipCount,
    animationOffset: stableAnimationOffset(playerId),
    animationPeriod: created.animationPeriod,
    candidateAnimationKey: null,
    candidateAnimationStartTick: null,
    carriedWeaponNeedsPitchOverlay: created.carriedWeaponNeedsPitchOverlay,
    hasModel: Boolean(modelTemplate),
    label,
    labelSprite: created.labelSprite,
    lastPosition: null,
    lastTick: null,
    mixer: created.mixer,
    model: created.model,
    object: created.object,
    playerId,
    selected,
    side,
    weaponObject: created.weaponObject,
    weaponHasModel: Boolean(weaponTemplate),
    weaponKey,
  };
  playerMarkerByIdRef.current.set(playerId, marker);
  return marker;
}

function stableAnimationOffset(value: string) {
  return (stableHash(value) % 900) / 300;
}

function stableHash(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function updatePlayerMarkerAnimation({
  activeWeaponClass,
  currentTick,
  marker,
  position,
  replay,
  weaponKey,
}: {
  activeWeaponClass: WeaponClass | null;
  currentTick: number;
  marker: PlayerMarker;
  position: Vector3;
  replay: Replay;
  weaponKey: string | null;
}) {
  const tickRate = Math.max(1, replay.match.tickRate);
  const animationTime = currentTick / tickRate + marker.animationOffset;
  let motion: "idle" | "run" | "walk" = "idle";

  if (marker.lastPosition && marker.lastTick != null) {
    const elapsedTicks = currentTick - marker.lastTick;
    if (elapsedTicks > 0 && elapsedTicks <= tickRate * 2) {
      const elapsedSeconds = elapsedTicks / tickRate;
      const delta = position.clone().sub(marker.lastPosition);
      const horizontalSpeed = Math.hypot(delta.x, delta.z) / Math.max(0.001, elapsedSeconds);
      if (horizontalSpeed > 0.45) {
        motion = horizontalSpeed > 2.35 ? "run" : "walk";
      }
    }
  }

  const family = playerAnimationFamily(activeWeaponClass, weaponKey);
  const requestedKey = motion === "idle" ? `${family}_idle` : `${family}_${motion}_n`;
  const fallbackKey = motion === "idle" ? "pistol_idle" : `${family}_${motion}_n`;
  const requestedAnimationKey = marker.animationActions.has(requestedKey) ? requestedKey : marker.animationActions.has(fallbackKey) ? fallbackKey : null;
  const animationKey = stabilizePlayerAnimationKey(marker, requestedAnimationKey, currentTick, tickRate);
  setPlayerAnimationAction(marker, animationKey, animationTime);
  marker.lastPosition = position.clone();
  marker.lastTick = currentTick;
}

function stabilizePlayerAnimationKey(marker: PlayerMarker, requestedKey: string | null, currentTick: number, tickRate: number) {
  if (!requestedKey || !marker.activeAnimationKey || requestedKey === marker.activeAnimationKey) {
    marker.candidateAnimationKey = null;
    marker.candidateAnimationStartTick = null;
    return requestedKey;
  }

  if (marker.candidateAnimationKey !== requestedKey) {
    marker.candidateAnimationKey = requestedKey;
    marker.candidateAnimationStartTick = currentTick;
    return marker.activeAnimationKey;
  }

  const candidateTicks = currentTick - (marker.candidateAnimationStartTick ?? currentTick);
  if (candidateTicks < Math.max(3, Math.round(tickRate * 0.14))) {
    return marker.activeAnimationKey;
  }

  marker.candidateAnimationKey = null;
  marker.candidateAnimationStartTick = null;
  return requestedKey;
}

function playerAnimationFamily(activeWeaponClass: WeaponClass | null, weaponKey: string | null) {
  if (activeWeaponClass === "knife" || weaponKey?.startsWith("knife")) {
    return "knife";
  }

  if (
    activeWeaponClass === "pistol" ||
    weaponKey === "deagle" ||
    weaponKey === "elite" ||
    weaponKey === "glock18" ||
    weaponKey === "hkp2000" ||
    weaponKey === "p250" ||
    weaponKey === "uspsilencer"
  ) {
    return "pistol";
  }

  return "rifle";
}

function setPlayerAnimationAction(marker: PlayerMarker, animationKey: string | null, animationTime: number) {
  if (!marker.mixer || !animationKey) {
    marker.activeAnimationKey = null;
    return;
  }

  const action = marker.animationActions.get(animationKey);
  if (!action) {
    marker.activeAnimationKey = null;
    return;
  }

  if (marker.activeAnimationKey !== animationKey) {
    const previousAction = marker.activeAnimationKey ? marker.animationActions.get(marker.activeAnimationKey) : null;
    previousAction?.stop();
    action.reset();
    action.enabled = true;
    action.setEffectiveWeight(1);
    action.play();
    marker.activeAnimationKey = animationKey;
  }

  const duration = action.getClip().duration;
  marker.mixer.setTime(duration > 0 ? animationTime % duration : animationTime);
}

function updatePlayerLabelVisibility(stage: ThreeStage, markers: PlayerMarker[], cameraMode: Replay3DCameraMode) {
  for (const marker of markers) {
    const ring = marker.object.children.find((child) => child.name.startsWith("player-ground-ring:"));
    if (ring) {
      ring.visible = cameraMode !== "pov";
    }
    if (cameraMode === "pov") {
      marker.labelSprite.visible = false;
    }
  }
  if (cameraMode === "pov") {
    return;
  }

  const viewport = stage.renderer.domElement.getBoundingClientRect();
  const viewportWidth = Math.max(1, viewport.width);
  const viewportHeight = Math.max(1, viewport.height);
  const occupiedRects: Array<{ bottom: number; left: number; right: number; top: number }> = [];
  const sortedMarkers = [...markers].sort((left, right) => Number(right.selected) - Number(left.selected));

  for (const marker of sortedMarkers) {
    const labelWorldPosition = marker.labelSprite.getWorldPosition(new Vector3());
    scalePlayerLabelForCamera(marker, stage.camera, labelWorldPosition);
    const screenPosition = labelWorldPosition.project(stage.camera);
    if (screenPosition.z < -1 || screenPosition.z > 1) {
      marker.labelSprite.visible = false;
      continue;
    }

    const centerX = (screenPosition.x * 0.5 + 0.5) * viewportWidth;
    const centerY = (-screenPosition.y * 0.5 + 0.5) * viewportHeight;
    const labelScaleFactor = typeof marker.labelSprite.userData.reviewScaleFactor === "number" ? marker.labelSprite.userData.reviewScaleFactor : 1;
    const halfWidth = (marker.selected ? 54 : 42) * labelScaleFactor;
    const halfHeight = (marker.selected ? 14 : 11) * labelScaleFactor;
    const rect = {
      bottom: centerY + halfHeight,
      left: centerX - halfWidth,
      right: centerX + halfWidth,
      top: centerY - halfHeight,
    };
    const overlaps = occupiedRects.some((occupied) => rect.left < occupied.right && rect.right > occupied.left && rect.top < occupied.bottom && rect.bottom > occupied.top);
    const cameraDistance = stage.camera.position.distanceTo(labelWorldPosition);
    const distantNonSelected = !marker.selected && cameraDistance > 58;
    marker.labelSprite.visible = !distantNonSelected && (marker.selected || !overlaps);
    if (marker.labelSprite.visible) {
      occupiedRects.push(rect);
    }
  }
}

function scalePlayerLabelForCamera(marker: PlayerMarker, camera: PerspectiveCamera, labelWorldPosition: Vector3) {
  const baseWidth = typeof marker.labelSprite.userData.baseWidth === "number" ? marker.labelSprite.userData.baseWidth : marker.labelSprite.scale.x;
  const baseHeight = typeof marker.labelSprite.userData.baseHeight === "number" ? marker.labelSprite.userData.baseHeight : marker.labelSprite.scale.y;
  const distance = camera.position.distanceTo(labelWorldPosition);
  const factor = Math.max(marker.selected ? 0.78 : 0.58, Math.min(marker.selected ? 1.28 : 0.9, distance * 0.024));
  marker.labelSprite.scale.set(baseWidth * factor, baseHeight * factor, 1);
  marker.labelSprite.userData.reviewScaleFactor = factor;
}

function collectRoundWeaponModelKeys(round: Round) {
  const keys = new Set<string>();
  for (const stream of round.playerStreams) {
    if (!stream.side) {
      continue;
    }

    keys.add(stream.side === "CT" ? "knife_default_ct" : "knife_default_t");
    const sampleCount = Math.max(stream.activeWeapon.length, stream.activeWeaponClass.length, stream.mainWeapon.length, stream.hasBomb.length);
    for (let index = 0; index < sampleCount; index += 1) {
      const key = resolveReplayWeaponModelKey({
        activeWeapon: stream.activeWeapon[index] ?? null,
        activeWeaponClass: stream.activeWeaponClass[index] ?? null,
        hasBomb: Boolean(stream.hasBomb[index]),
        mainWeapon: stream.mainWeapon[index] ?? null,
        side: stream.side,
      });
      if (key && SUPPORTED_WEAPON_MODEL_KEY_SET.has(key)) {
        keys.add(key);
      }
      if (keys.size >= SUPPORTED_WEAPON_MODEL_KEYS.length) {
        return [...keys];
      }
    }
  }

  return [...keys];
}

function resolveCurrentPovWeaponModelKey(round: Round, currentTick: number, selectedPlayerId: string | null) {
  const selectedStream = selectedPlayerId ? round.playerStreams.find((stream) => stream.playerId === selectedPlayerId) : null;
  const candidateStreams = selectedStream ? [selectedStream] : round.playerStreams;
  for (const stream of candidateStreams) {
    if (!stream.side) {
      continue;
    }

    const sample = interpolatePlayerStreamSample(stream, currentTick);
    if (!sample?.alive) {
      continue;
    }

    const key = resolveReplayWeaponModelKey({
      activeWeapon: sample.activeWeapon,
      activeWeaponClass: sample.activeWeaponClass,
      hasBomb: sample.hasBomb,
      mainWeapon: sample.mainWeapon,
      side: stream.side,
    });
    if (key && SUPPORTED_WEAPON_MODEL_KEY_SET.has(key)) {
      return key;
    }
  }

  return null;
}

function resolveReplayWeaponModelKey({
  activeWeapon,
  activeWeaponClass,
  hasBomb,
  mainWeapon,
  side,
}: {
  activeWeapon: string | null;
  activeWeaponClass: WeaponClass | null;
  hasBomb: boolean;
  mainWeapon: string | null;
  side: "CT" | "T";
}) {
  if (activeWeaponClass === "knife") {
    return side === "CT" ? "knife_default_ct" : "knife_default_t";
  }

  const activeKey = normalizeReplayWeaponModelName(activeWeapon);
  if (activeKey) {
    return activeKey;
  }

  const mainKey = normalizeReplayWeaponModelName(mainWeapon);
  if (mainKey) {
    return mainKey;
  }

  if (hasBomb && side === "T") {
    return "c4";
  }

  return null;
}

function normalizeReplayWeaponModelName(weaponName: string | null) {
  const normalized = normalizeWeaponName(weaponName);
  if (!normalized) {
    return null;
  }

  const aliases: Record<string, string> = {
    ak: "ak47",
    ak47: "ak47",
    awp: "awp",
    c4: "c4",
    deagle: "deagle",
    dualberettas: "elite",
    elite: "elite",
    famas: "famas",
    flashbang: "flashbang",
    galil: "galilar",
    galilar: "galilar",
    glock: "glock18",
    glock18: "glock18",
    hegrenade: "hegrenade",
    hkp2000: "hkp2000",
    incgrenade: "incendiarygrenade",
    incendiarygrenade: "incendiarygrenade",
    m4a1s: "m4a1silencer",
    m4a1silencer: "m4a1silencer",
    m4a4: "m4a4",
    mac10: "mac10",
    molotov: "molotov",
    mp9: "mp9",
    p250: "p250",
    p2000: "hkp2000",
    smokegrenade: "smokegrenade",
    usp: "uspsilencer",
    usps: "uspsilencer",
    uspsilencer: "uspsilencer",
  };

  return aliases[normalized] ?? null;
}

function disposePlayerMarker(marker: PlayerMarker) {
  disposeObjectMeshes(marker.object, { disposeSharedModelResources: false });
  marker.object.clear();
}

function frameCameraAroundSelectedPlayer(stage: ThreeStage, selectedMarker: Group, playerRadius: number) {
  const target = selectedMarker.getWorldPosition(new Vector3());
  target.y += playerRadius * 0.9;
  const desiredPosition = new Vector3(target.x - playerRadius * 10, target.y + playerRadius * 36, target.z + playerRadius * 14);

  stage.controls.target.copy(target);
  stage.camera.position.copy(applyCloseCameraClearance(desiredPosition, target, playerRadius, 8.5));
  stage.camera.fov = TACTICAL_REVIEW_CAMERA_FOV;
  stage.camera.near = 0.05;
  stage.camera.far = Math.max(stage.camera.far, 4000);
  stage.camera.updateProjectionMatrix();
}

function frameCameraBehindSelectedPlayer(stage: ThreeStage, selectedMarker: Group, playerRadius: number) {
  const playerPosition = selectedMarker.getWorldPosition(new Vector3());
  const forward = replayYawForwardVectorFromRadians(selectedMarker.rotation.y);
  const shoulder = new Vector3(forward.z, 0, -forward.x).normalize();
  const target = playerPosition.clone().add(forward.clone().multiplyScalar(playerRadius * 2.35));
  target.y += playerRadius * 1.42;

  const chaseCandidates = [
    playerPosition
      .clone()
      .add(forward.clone().multiplyScalar(-playerRadius * 5.6))
      .add(shoulder.clone().multiplyScalar(playerRadius * 1.55))
      .setY(playerPosition.y + playerRadius * 3.6),
    playerPosition
      .clone()
      .add(forward.clone().multiplyScalar(-playerRadius * 6.4))
      .add(shoulder.clone().multiplyScalar(playerRadius * 0.45))
      .setY(playerPosition.y + playerRadius * 4.4),
    playerPosition
      .clone()
      .add(forward.clone().multiplyScalar(-playerRadius * 4.4))
      .add(shoulder.clone().multiplyScalar(playerRadius * 1.2))
      .setY(playerPosition.y + playerRadius * 2.8),
    playerPosition
      .clone()
      .add(forward.clone().multiplyScalar(-playerRadius * 5.8))
      .add(shoulder.clone().multiplyScalar(-playerRadius * 1.35))
      .setY(playerPosition.y + playerRadius * 3.9),
  ];

  stage.controls.target.copy(target);
  stage.camera.position.copy(resolveReviewCameraPosition(stage, chaseCandidates, target, playerRadius, 2.35));
  stage.camera.fov = TACTICAL_REVIEW_CAMERA_FOV;
  stage.camera.near = 0.03;
  stage.camera.far = Math.max(stage.camera.far, 4000);
  stage.camera.updateProjectionMatrix();
}

function frameCameraFromPlayerView(
  stage: ThreeStage,
  view: PlayerPovCameraView,
  transform: Extract<Replay3DMapAssetResult, { available: true }>["coordinateTransform"],
) {
  const yawRadians = source2YawToGltfRadians(view.yaw, transform);
  const pitchRadians = (view.pitch * Math.PI) / 180;
  const forward = replayViewForwardVector(yawRadians, pitchRadians);
  const cameraPosition = view.eyePosition.clone().addScaledVector(forward, 0.08);
  const target = cameraPosition.clone().add(forward.multiplyScalar(32));

  stage.controls.target.copy(target);
  stage.camera.position.copy(cameraPosition);
  stage.camera.lookAt(target);
  stage.camera.fov = resolvePovReviewCameraFov(view);
  stage.camera.near = 0.015;
  stage.camera.far = Math.max(stage.camera.far, 4000);
  stage.camera.updateProjectionMatrix();
  stage.povViewmodelCamera.fov = view.viewmodelFov && view.viewmodelFov > 0 ? Math.max(54, Math.min(82, view.viewmodelFov)) : POV_REVIEW_CAMERA_FOV;
  stage.povViewmodelCamera.updateProjectionMatrix();
}

function updateSelectedPlayerAimRay(
  stage: ThreeStage,
  view: PlayerPovCameraView | null,
  transform: Extract<Replay3DMapAssetResult, { available: true }>["coordinateTransform"],
  playerRadius: number,
  cameraMode: Replay3DCameraMode,
) {
  const ray = stage.selectedAimRay;
  const point = stage.selectedAimPoint;
  const tube = stage.selectedAimTube;
  if (!view || cameraMode === "pov") {
    ray.visible = false;
    point.visible = false;
    tube.visible = false;
    return;
  }

  const yawRadians = source2YawToGltfRadians(view.yaw, transform);
  const pitchRadians = (Math.max(-65, Math.min(65, view.pitch)) * Math.PI) / 180;
  const forward = replayViewForwardVector(yawRadians, pitchRadians);
  const start = view.eyePosition.clone().addScaledVector(forward, playerRadius * 0.42);
  const maxLength = playerRadius * 36;
  let length = maxLength;

  stage.viewRaycaster.set(start, forward);
  stage.viewRaycaster.near = playerRadius * 0.15;
  stage.viewRaycaster.far = maxLength;
  const hit = stage.viewRaycaster.intersectObjects(stage.mapCollisionMeshes, false).find((intersection) => intersection.object.visible);
  if (hit && Number.isFinite(hit.distance)) {
    length = Math.max(playerRadius * 2.2, Math.min(maxLength, hit.distance));
  }

  const end = start.clone().addScaledVector(forward, length);
  const midpoint = start.clone().add(end).multiplyScalar(0.5);
  const geometry = ray.geometry;
  const positions = geometry.getAttribute("position");
  positions.setXYZ(0, start.x, start.y, start.z);
  positions.setXYZ(1, end.x, end.y, end.z);
  positions.needsUpdate = true;
  geometry.computeBoundingSphere();

  const material = ray.material;
  const color = view.side === "CT" ? 0xaedfff : 0xffcf7a;
  if (material instanceof LineBasicMaterial) {
    material.color.set(color);
    material.opacity = cameraMode === "free" ? 0.78 : 0.62;
  }
  const pointMaterial = point.material;
  if (pointMaterial instanceof MeshBasicMaterial) {
    pointMaterial.color.set(color);
    pointMaterial.opacity = cameraMode === "free" ? 0.88 : 0.72;
  }
  const tubeMaterial = tube.material;
  if (tubeMaterial instanceof MeshBasicMaterial) {
    tubeMaterial.color.set(color);
    tubeMaterial.opacity = cameraMode === "free" ? 0.3 : 0.22;
  }
  tube.position.copy(midpoint);
  tube.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), forward);
  tube.scale.set(playerRadius * (cameraMode === "free" ? 0.038 : 0.032), length, playerRadius * (cameraMode === "free" ? 0.038 : 0.032));
  tube.visible = true;
  point.position.copy(end);
  point.scale.setScalar(playerRadius * (cameraMode === "free" ? 0.14 : 0.12));
  point.visible = true;
  ray.visible = true;
}

function replayYawForwardVectorFromRadians(yawRadians: number) {
  return new Vector3(Math.sin(yawRadians), 0, Math.cos(yawRadians)).normalize();
}

function resolvePovReviewCameraFov(view: PlayerPovCameraView) {
  if (!view.isScoped) {
    return POV_REVIEW_CAMERA_FOV;
  }

  const zoomLevel = view.zoomLevel ?? 1;
  if (zoomLevel >= 2) {
    return 18;
  }

  return 38;
}

function resolveRecentPovFireAgeSeconds(round: Round, playerId: string, currentTick: number, tickRate: number) {
  const windowTicks = Math.max(2, Math.round(Math.max(1, tickRate) * POV_SHOOT_ANIMATION_WINDOW_SECONDS));
  for (let index = round.fireEvents.length - 1; index >= 0; index -= 1) {
    const event = round.fireEvents[index];
    if (event.tick > currentTick) {
      continue;
    }
    const ageTicks = currentTick - event.tick;
    if (ageTicks > windowTicks) {
      return null;
    }
    if (event.playerId === playerId && isGunfireWeapon3d(event.weaponName)) {
      return ageTicks / Math.max(1, tickRate);
    }
  }

  return null;
}

function renderPovWeaponViewmodel(
  stage: ThreeStage,
  view: PlayerPovCameraView,
  povViewmodels: PovViewmodelSet | null,
  weaponModels: WeaponModelSet | null,
  playerModels: PlayerModelSet | null,
) {
  const weaponKey = view.weaponKey;
  const povWeaponTemplate = povViewmodelWeaponTemplateForKey(povViewmodels, weaponKey);
  const worldWeaponTemplate = weaponModelTemplateForKey(weaponModels, weaponKey);
  const weaponTemplate = povWeaponTemplate?.group ?? worldWeaponTemplate?.group ?? null;
  const armsTemplate = USE_EXPORTED_POV_ARMS ? povViewmodels?.arms ?? null : null;
  const handsTemplate = povHandsTemplateForSide(playerModels, view.side);
  const hasModel = weaponTemplate != null;
  const hasArms = armsTemplate != null;
  const hasPlayerModelHands = !hasArms && handsTemplate != null;
  if (!weaponKey || !weaponTemplate) {
    clearPovWeaponViewmodel(stage);
    return;
  }

  const viewmodelSource = povWeaponTemplate ? "viewmodel" : "world-model";
  const viewmodelKey = `${view.side}:${weaponKey}:${viewmodelSource}:${hasArms ? "arms" : hasPlayerModelHands ? "hands" : "no-hands"}`;
  if (stage.povViewmodelKey !== viewmodelKey || stage.povViewmodelHasModel !== hasModel) {
    clearPovWeaponViewmodel(stage);
    if (armsTemplate) {
      stage.povViewmodelGroup.add(createPovArmsModelView(armsTemplate.group));
    } else if (handsTemplate) {
      stage.povViewmodelGroup.add(createPovHandsModelView(handsTemplate, view.side));
    }
    const weapon = createPovWeaponModelView(weaponTemplate, weaponKey, viewmodelSource);
    disableFrustumCulling(weapon);
    stage.povViewmodelGroup.add(weapon);
    stage.povViewmodelKey = viewmodelKey;
    stage.povViewmodelHasModel = hasModel;
  }

  const weapon = stage.povViewmodelGroup.children.find((child) => child.name.startsWith("pov-weapon-")) ?? null;
  if (weapon) {
    positionPovWeaponViewmodel(weapon, view, weaponKey);
  }
  const handLayers = stage.povViewmodelGroup.children.filter((child) => child.name.startsWith("pov-hands-"));
  for (const hands of handLayers) {
    positionPovHandsViewmodel(hands, view, weaponKey);
  }
  stage.povViewmodelGroup.visible = true;
}

function povViewmodelWeaponTemplateForKey(models: PovViewmodelSet | null, key: string | null) {
  if (!models || !key) {
    return null;
  }

  return models.weaponsByKey.get(key) ?? null;
}

function povHandsTemplateForSide(playerModels: PlayerModelSet | null, side: "CT" | "T") {
  const template = side === "CT" ? playerModels?.ct : playerModels?.t;
  return template?.povHands ?? null;
}

function clearPovWeaponViewmodel(stage: ThreeStage) {
  if (stage.povViewmodelGroup.children.length > 0) {
    disposeObjectMeshes(stage.povViewmodelGroup);
    stage.povViewmodelGroup.clear();
  }
  stage.povViewmodelGroup.visible = false;
  stage.povViewmodelKey = null;
  stage.povViewmodelHasModel = false;
}

function disableFrustumCulling(object: Object3D) {
  object.frustumCulled = false;
  object.traverse((child) => {
    child.frustumCulled = false;
  });
}

function createPovWeaponModelView(modelTemplate: Group, weaponKey: string, source: "viewmodel" | "world-model") {
  const container = new Group();
  container.name = `pov-weapon-${source}:${weaponKey}`;
  const weapon = source === "viewmodel" ? cloneSkeleton(modelTemplate) as Group : modelTemplate.clone(true);
  weapon.name = `pov-weapon-mesh:${weaponKey}`;
  weapon.traverse((child) => {
    if (child instanceof Mesh) {
      child.frustumCulled = false;
      child.userData[SHARED_3D_MODEL_RESOURCE_FLAG] = false;
      child.renderOrder = 94;
      child.material = clonePovWeaponMaterial(child.material);
    }
  });
  container.add(weapon);
  if (source === "viewmodel") {
    container.userData.povBaseScale = modelTemplate.userData.povBaseScale;
  } else {
    normalizePovWeaponModel(container, weapon, weaponKey);
  }
  container.userData.povSource = source;
  if (source === "viewmodel") {
    const animations = Array.isArray(modelTemplate.userData.povAnimations) ? modelTemplate.userData.povAnimations as AnimationClip[] : [];
    preparePovWeaponAnimation(container, weapon, animations);
  }
  return container;
}

function preparePovWeaponAnimation(container: Group, weapon: Object3D, animations: AnimationClip[]) {
  const shootClip = animations.find((clip) => clip.name.toLowerCase() === "shoot") ?? null;
  const idleClip = animations.find((clip) => {
    const name = clip.name.toLowerCase();
    return name === "dropped" || name === "idle";
  }) ?? null;
  if (!shootClip && !idleClip) {
    return;
  }

  const mixer = new AnimationMixer(weapon);
  container.userData.povAnimationMixer = mixer;
  if (shootClip) {
    container.userData.povShootAction = mixer.clipAction(shootClip);
  }
  if (idleClip) {
    container.userData.povIdleAction = mixer.clipAction(idleClip);
  }
}

function createPovArmsModelView(modelTemplate: Group) {
  const container = new Group();
  container.name = "pov-hands-viewmodel-arms";
  const arms = cloneSkeleton(modelTemplate) as Group;
  arms.name = "pov-hands-viewmodel-arms-mesh";
  arms.traverse((child) => {
    if (child instanceof Mesh) {
      child.frustumCulled = false;
      child.userData[SHARED_3D_MODEL_RESOURCE_FLAG] = false;
      child.renderOrder = 93;
      child.material = clonePovWeaponMaterial(child.material);
    }
  });
  container.add(arms);
  container.userData.povBaseScale = modelTemplate.userData.povBaseScale;
  container.userData.povSource = "viewmodel-arms";
  disableFrustumCulling(container);
  return container;
}

function createPovHandsModelView(modelTemplate: Group, side: "CT" | "T") {
  const container = new Group();
  container.name = `pov-hands-model:${side.toLowerCase()}`;
  const hands = cloneSkeleton(modelTemplate) as Group;
  hands.name = `pov-hands-mesh:${side.toLowerCase()}`;
  hands.traverse((child) => {
    if (child instanceof Mesh) {
      child.frustumCulled = false;
      child.userData[SHARED_3D_MODEL_RESOURCE_FLAG] = false;
      child.renderOrder = 93;
      child.material = clonePovWeaponMaterial(child.material);
    }
  });
  container.add(hands);
  container.userData.povBaseScale = 1.08;
  disableFrustumCulling(container);
  return container;
}

function normalizePovWeaponModel(container: Group, weapon: Group, weaponKey: string) {
  weapon.updateMatrixWorld(true);
  const bounds = new Box3().setFromObject(weapon);
  if (bounds.isEmpty()) {
    container.userData.povBaseScale = 1;
    return;
  }

  const size = bounds.getSize(new Vector3());
  const longestAxis = Math.max(size.x, size.y, size.z);
  if (!Number.isFinite(longestAxis) || longestAxis <= 0) {
    container.userData.povBaseScale = 1;
    return;
  }

  const center = bounds.getCenter(new Vector3());
  weapon.position.sub(center);
  container.userData.povBaseScale = povWeaponTargetLengthForKey(weaponKey) / longestAxis;
}

function clonePovWeaponMaterial(materialOrMaterials: Mesh["material"]) {
  const materials = Array.isArray(materialOrMaterials) ? materialOrMaterials : [materialOrMaterials];
  const cloned = materials.map((material) => {
    const copy = material.clone();
    if (copy instanceof MeshBasicMaterial || copy instanceof MeshStandardMaterial) {
      copy.alphaMap = null;
      copy.alphaTest = 0;
      copy.side = DoubleSide;
    }
    copy.depthTest = true;
    copy.depthWrite = true;
    copy.transparent = false;
    copy.opacity = 1;
    return copy;
  });
  return Array.isArray(materialOrMaterials) ? cloned : cloned[0];
}

function positionPovWeaponViewmodel(weapon: Object3D, view: PlayerPovCameraView, weaponKey: string) {
  const viewmodelX = view.viewmodelOffsetX ?? 2.5;
  const viewmodelY = view.viewmodelOffsetY ?? 0;
  const viewmodelZ = view.viewmodelOffsetZ ?? -1.5;
  void view.recoilIndex;
  const fovScale = view.viewmodelFov && view.viewmodelFov > 0 ? Math.max(0.86, Math.min(1.12, 68 / view.viewmodelFov)) : 1;
  const baseScale = typeof weapon.userData.povBaseScale === "number" && Number.isFinite(weapon.userData.povBaseScale)
    ? weapon.userData.povBaseScale
    : 1;
  const isViewmodel = weapon.userData.povSource === "viewmodel";
  const pitchRadians = ((Math.max(-65, Math.min(65, view.pitch)) * Math.PI) / 180) * 0.08;
  const baseX = weaponKey.startsWith("knife") ? 0.2 : isThrowableWeaponKey(weaponKey) ? 0.26 : isPistolWeaponKey(weaponKey) ? 0.25 : 0.32;
  const baseY = weaponKey.startsWith("knife") ? -0.18 : isThrowableWeaponKey(weaponKey) ? -0.34 : isPistolWeaponKey(weaponKey) ? -0.2 : -0.24;
  const baseZ = weaponKey.startsWith("knife") ? -0.72 : isThrowableWeaponKey(weaponKey) ? -0.74 : isPistolWeaponKey(weaponKey) ? -0.84 : -0.94;

  weapon.position.set(baseX + viewmodelX * 0.01, baseY + viewmodelZ * 0.01, baseZ - viewmodelY * 0.01);
  weapon.rotation.copy(povWeaponRotationForKey(weaponKey));
  weapon.rotation.x += pitchRadians;
  weapon.scale.setScalar(baseScale * fovScale * (isViewmodel ? 0.72 : povWeaponScaleForKey(weaponKey)));
  updatePovWeaponAnimation(weapon, view);
}

function updatePovWeaponAnimation(weapon: Object3D, view: PlayerPovCameraView) {
  const mixer = weapon.userData.povAnimationMixer;
  if (!(mixer instanceof AnimationMixer)) {
    return;
  }

  const shootAction = weapon.userData.povShootAction;
  const idleAction = weapon.userData.povIdleAction;
  mixer.stopAllAction();
  if (view.recentFireAgeSeconds != null && shootAction) {
    shootAction.reset();
    shootAction.setLoop(LoopOnce, 1);
    shootAction.clampWhenFinished = true;
    shootAction.play();
    mixer.setTime(Math.min(shootAction.getClip().duration, view.recentFireAgeSeconds));
    return;
  }

  if (idleAction) {
    idleAction.reset();
    idleAction.setLoop(LoopRepeat, Infinity);
    idleAction.play();
    mixer.setTime(0);
  }
}

function positionPovHandsViewmodel(hands: Object3D, view: PlayerPovCameraView, weaponKey: string) {
  const viewmodelX = view.viewmodelOffsetX ?? 2.5;
  const viewmodelY = view.viewmodelOffsetY ?? 0;
  const viewmodelZ = view.viewmodelOffsetZ ?? -1.5;
  const fovScale = view.viewmodelFov && view.viewmodelFov > 0 ? Math.max(0.86, Math.min(1.12, 68 / view.viewmodelFov)) : 1;
  const baseScale = typeof hands.userData.povBaseScale === "number" && Number.isFinite(hands.userData.povBaseScale)
    ? hands.userData.povBaseScale
    : 0.86;
  const lowerForGrenade = isThrowableWeaponKey(weaponKey) ? -0.01 : 0;
  const pitchRadians = ((Math.max(-65, Math.min(65, view.pitch)) * Math.PI) / 180) * 0.08;
  if (hands.userData.povSource === "viewmodel-arms") {
    hands.position.set(0.28 + viewmodelX * 0.01, -0.76 + lowerForGrenade + viewmodelZ * 0.01, -1.02 - viewmodelY * 0.01);
    hands.rotation.set(-0.18 + pitchRadians, -0.18, -0.04);
    hands.scale.setScalar(baseScale * fovScale * 0.24);
    return;
  }

  hands.position.set(0.32 + viewmodelX * 0.01, -0.7 + lowerForGrenade + viewmodelZ * 0.01, -0.98 - viewmodelY * 0.01);
  hands.rotation.set(-0.18 + pitchRadians, -0.18, -0.05);
  hands.scale.setScalar(baseScale * fovScale * 0.22);
}

function povWeaponRotationForKey(weaponKey: string) {
  if (weaponKey.startsWith("knife")) {
    return new Euler(-0.18, 0.2, -0.42);
  }

  if (isThrowableWeaponKey(weaponKey)) {
    return new Euler(-0.1, 0.16, -0.12);
  }

  if (isPistolWeaponKey(weaponKey)) {
    return new Euler(-0.03, 0.28, -0.06);
  }

  return new Euler(-0.04, 0.14, -0.08);
}

function povWeaponScaleForKey(weaponKey: string) {
  if (isPistolWeaponKey(weaponKey)) {
    return 0.96;
  }

  if (isThrowableWeaponKey(weaponKey)) {
    return 0.62;
  }

  if (weaponKey.startsWith("knife")) {
    return 0.54;
  }

  if (weaponKey === "c4") {
    return 0.72;
  }

  return 1;
}

function povWeaponTargetLengthForKey(weaponKey: string) {
  if (isPistolWeaponKey(weaponKey)) {
    return 0.38;
  }

  if (weaponKey.startsWith("knife")) {
    return 0.34;
  }

  if (isThrowableWeaponKey(weaponKey)) {
    return 0.26;
  }

  if (weaponKey === "c4") {
    return 0.42;
  }

  if (weaponKey === "awp") {
    return 0.5;
  }

  return 0.46;
}

function isFiniteReplayNumber(value: number | null): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isBetterFallbackPovView(candidate: PlayerPovCameraView, existing: PlayerPovCameraView | null) {
  return existing == null || Math.abs(candidate.pitch) < Math.abs(existing.pitch);
}

function updatePlayerAimPitchCue(playerObject: Group, pitch: number | null, radius: number, hasModel: boolean) {
  const cue = playerObject.getObjectByName(`player-pitch-cue:${playerObject.name.split(":")[1] ?? ""}`) ?? playerObject.children.find((child) => child.name.startsWith("player-pitch-cue:"));
  if (!(cue instanceof Line) || !(cue.geometry instanceof BufferGeometry)) {
    return;
  }

  if (!isFiniteReplayNumber(pitch)) {
    cue.visible = false;
    return;
  }

  const clampedPitch = Math.max(-65, Math.min(65, pitch));
  const pitchRadians = (clampedPitch * Math.PI) / 180;
  const material = cue.material;
  if (material instanceof LineBasicMaterial && hasModel) {
    const selected = cue.userData.demoReadSelectedPlayer === true;
    material.opacity = Math.abs(clampedPitch) > 2 ? (selected ? 0.48 : 0.3) : (selected ? 0.22 : 0.12);
  }
  const length = radius * (hasModel ? 1.55 : 1.45);
  const start = new Vector3(0, radius * (hasModel ? 1.36 : 1.38), -radius * (hasModel ? 0.42 : 0.08));
  const end = new Vector3(0, start.y - Math.sin(pitchRadians) * length, start.z - Math.cos(pitchRadians) * length);
  cue.geometry.setFromPoints([start, end]);
  cue.visible = true;
}

function applyPlayerLookPitch(playerObject: Group, pitch: number | null, hasModel: boolean) {
  if (!hasModel || !isFiniteReplayNumber(pitch)) {
    return;
  }

  const clampedPitch = Math.max(-65, Math.min(65, pitch));
  const pitchRadians = (clampedPitch * Math.PI) / 180;
  applyBonePitchOverlay(playerObject, "spine_3", "x", pitchRadians * 0.42);
  applyBonePitchOverlay(playerObject, "neck_0", "x", pitchRadians * 0.62);
  applyBonePitchOverlay(playerObject, "head_0", "x", pitchRadians * 0.86);
  applyBonePitchOverlay(playerObject, "scap_aimup", "x", pitchRadians * 0.96);
  applyBonePitchOverlay(playerObject, "wpnpivot", "x", pitchRadians * 1.28);
  applyBonePitchOverlay(playerObject, "wpn", "x", pitchRadians * 1.28);
  applyBonePitchOverlay(playerObject, "arm_upper_r", "x", pitchRadians * 0.72);
  applyBonePitchOverlay(playerObject, "arm_upper_l", "x", pitchRadians * 0.58);
  applyBonePitchOverlay(playerObject, "arm_lower_r", "x", pitchRadians * 0.48);
  applyBonePitchOverlay(playerObject, "arm_lower_l", "x", pitchRadians * 0.4);
  applyBonePitchOverlay(playerObject, "spine_3", "z", pitchRadians * 0.22);
  applyBonePitchOverlay(playerObject, "neck_0", "z", pitchRadians * 0.32);
  applyBonePitchOverlay(playerObject, "head_0", "z", pitchRadians * 0.42);
  applyBonePitchOverlay(playerObject, "wpnpivot", "z", pitchRadians * 0.88);
  applyBonePitchOverlay(playerObject, "wpn", "z", pitchRadians * 0.88);
}

function applyCarriedWeaponPitch(weapon: Object3D | null, pitch: number | null, needsPitchOverlay: boolean) {
  if (!weapon || !needsPitchOverlay || !isFiniteReplayNumber(pitch)) {
    return;
  }

  const clampedPitch = Math.max(-65, Math.min(65, pitch));
  const pitchRadians = (clampedPitch * Math.PI) / 180;
  if (typeof weapon.userData.demoReadBaseRotationX !== "number") {
    weapon.userData.demoReadBaseRotationX = weapon.rotation.x;
  }
  if (typeof weapon.userData.demoReadBaseRotationZ !== "number") {
    weapon.userData.demoReadBaseRotationZ = weapon.rotation.z;
  }
  weapon.rotation.x = weapon.userData.demoReadBaseRotationX + pitchRadians * 1.2;
  weapon.rotation.z = weapon.userData.demoReadBaseRotationZ + pitchRadians * 0.38;
}

function applyBonePitchOverlay(root: Object3D, lowerName: string, axis: "x" | "y" | "z", pitchRadians: number) {
  const bone = findObjectByName(root, (name) => name === lowerName || name.endsWith(`\\${lowerName}`));
  if (!bone) {
    return;
  }
  const baseKey = `demoReadBasePitchRotation${axis.toUpperCase()}`;
  if (typeof bone.userData[baseKey] !== "number") {
    bone.userData[baseKey] = bone.rotation[axis];
  }
  bone.rotation[axis] = bone.userData[baseKey] + pitchRadians;
}

function applyCloseCameraClearance(position: Vector3, target: Vector3, playerRadius: number, minClearanceMultiplier: number) {
  const safePosition = position.clone();
  const minimumY = target.y + playerRadius * minClearanceMultiplier;
  if (safePosition.y < minimumY) {
    safePosition.y = minimumY;
  }
  return safePosition;
}

function resolveReviewCameraPosition(stage: ThreeStage, candidates: Vector3[], target: Vector3, playerRadius: number, minClearanceMultiplier: number) {
  let bestBlockedCandidate: { distanceToBlock: number; position: Vector3 } | null = null;

  for (const candidate of candidates) {
    const position = applyCloseCameraClearance(candidate, target, playerRadius, minClearanceMultiplier);
    const distanceToBlock = cameraOcclusionDistance(stage, target, position, playerRadius);
    if (distanceToBlock == null) {
      return position;
    }

    if (!bestBlockedCandidate || distanceToBlock > bestBlockedCandidate.distanceToBlock) {
      bestBlockedCandidate = { distanceToBlock, position };
    }
  }

  if (!bestBlockedCandidate) {
    return applyCloseCameraClearance(candidates[0] ?? target, target, playerRadius, minClearanceMultiplier);
  }

  const direction = bestBlockedCandidate.position.clone().sub(target);
  const distance = direction.length();
  if (distance <= playerRadius * 1.5) {
    return bestBlockedCandidate.position;
  }

  direction.normalize();
  const adjustedDistance = Math.max(playerRadius * 3.25, Math.min(distance, bestBlockedCandidate.distanceToBlock - playerRadius * 0.85));
  const adjusted = target.clone().addScaledVector(direction, adjustedDistance);
  return applyCloseCameraClearance(adjusted, target, playerRadius, minClearanceMultiplier);
}

function cameraOcclusionDistance(stage: ThreeStage, from: Vector3, to: Vector3, playerRadius: number) {
  if (stage.mapCollisionMeshes.length === 0) {
    return null;
  }

  const direction = to.clone().sub(from);
  const distance = direction.length();
  if (distance <= playerRadius * 2) {
    return null;
  }

  direction.normalize();
  const near = playerRadius * 0.72;
  const far = distance - playerRadius * 0.72;
  if (far <= near) {
    return null;
  }

  stage.viewRaycaster.set(from, direction);
  stage.viewRaycaster.near = near;
  stage.viewRaycaster.far = far;
  const hit = stage.viewRaycaster.intersectObjects(stage.mapCollisionMeshes, false).find((intersection) => intersection.object.visible);
  return hit?.distance ?? null;
}

function selectTacticalCameraCluster(allMarkers: Group[], ctMarkers: Group[], tMarkers: Group[], playerRadius: number) {
  if (allMarkers.length === 0) {
    return [];
  }

  const allSpan = markerClusterSpan(allMarkers);
  if (allSpan <= playerRadius * 42 || ctMarkers.length === 0 || tMarkers.length === 0) {
    return allMarkers;
  }

  const ctSpan = markerClusterSpan(ctMarkers);
  const tSpan = markerClusterSpan(tMarkers);
  return ctSpan <= tSpan ? ctMarkers : tMarkers;
}

function markerClusterSpan(markers: Group[]) {
  const bounds = new Box3();
  for (const marker of markers) {
    bounds.expandByPoint(marker.getWorldPosition(new Vector3()));
  }
  if (bounds.isEmpty()) {
    return 0;
  }

  const size = bounds.getSize(new Vector3());
  return Math.max(size.x, size.z);
}

function frameCameraAroundPlayerCluster(stage: ThreeStage, markers: Group[], playerRadius: number) {
  const bounds = new Box3();
  for (const marker of markers) {
    bounds.expandByPoint(marker.getWorldPosition(new Vector3()));
  }
  if (bounds.isEmpty()) {
    return;
  }

  const target = bounds.getCenter(new Vector3());
  const size = bounds.getSize(new Vector3());
  const span = Math.max(size.x, size.z, playerRadius * 12);
  target.y += playerRadius * 0.85;
  const desiredPosition = new Vector3(target.x - span * 0.28, target.y + span * 1.48 + playerRadius * 4.5, target.z + span * 0.38);

  stage.controls.target.copy(target);
  stage.camera.position.copy(desiredPosition);
  stage.camera.fov = TACTICAL_REVIEW_CAMERA_FOV;
  stage.camera.near = 0.05;
  stage.camera.far = Math.max(stage.camera.far, 4000);
  stage.camera.updateProjectionMatrix();
}

function renderUtilities3d({
  assetResult,
  cameraMode,
  currentTick,
  playerSideById,
  round,
  stage,
  tickRate,
}: {
  assetResult: Extract<Replay3DMapAssetResult, { available: true }>;
  cameraMode: Replay3DCameraMode;
  currentTick: number;
  playerSideById: Map<string, "CT" | "T" | null>;
  round: Round;
  stage: ThreeStage;
  tickRate: number;
}) {
  for (const utility of round.utilityEntities) {
    if (currentTick < utility.startTick) {
      continue;
    }

    const points = utilityTrajectoryPoints3d(utility, currentTick, assetResult.coordinateTransform);
    if (points.length < 1) {
      continue;
    }

    const throwerSide = utility.throwerPlayerId ? playerSideById.get(utility.throwerPlayerId) ?? null : null;
    const color = utilityColor3d(utility.kind, throwerSide);
    const sceneState = utilitySceneStateAtTick(utility, currentTick, tickRate);
    if (cameraMode === "tactical" && points.length >= 2) {
      const geometry = new BufferGeometry().setFromPoints(points);
      const line = new Line(
        geometry,
        new LineBasicMaterial({
          color,
          depthTest: false,
          depthWrite: false,
          transparent: true,
          opacity: utilityTrailOpacity3d(utility),
        }),
      );
      line.name = `utility-trajectory:${utility.utilityId}`;
      line.renderOrder = 42;
      stage.utilityGroup.add(line);
    }

    const endpoint = points[points.length - 1];
    if (utility.kind === "smoke" && isSmokeActive3d(utility, currentTick, tickRate)) {
      addSmokeVolume3d(stage.utilityGroup, utility, endpoint);
      continue;
    }

    if (sceneState?.phase === "active" && (utility.kind === "molotov" || utility.kind === "incendiary")) {
      addFireVolume3d(stage.utilityGroup, utility, currentTick, assetResult.coordinateTransform, endpoint);
      continue;
    }

    if (sceneState?.phase === "burst" && (utility.kind === "hegrenade" || utility.kind === "flashbang")) {
      addUtilityBurst3d(stage.utilityGroup, utility, endpoint);
      continue;
    }

    const markerRadius = utilityEndpointRadius3d(utility);
    const marker = new Mesh(
      new SphereGeometry(markerRadius, 12, 8),
      new MeshBasicMaterial({
        color,
        depthTest: false,
        depthWrite: false,
        transparent: true,
        opacity: 0.9,
      }),
    );
    marker.name = `utility-endpoint:${utility.utilityId}:${utility.kind}`;
    marker.position.copy(endpoint);
    marker.renderOrder = 43;
    stage.utilityGroup.add(marker);
  }
}

function renderGunfire3d({
  assetResult,
  currentTick,
  playerRadius,
  round,
  stage,
  tickRate,
}: {
  assetResult: Extract<Replay3DMapAssetResult, { available: true }>;
  currentTick: number;
  playerRadius: number;
  round: Round;
  stage: ThreeStage;
  tickRate: number;
}) {
  const visibleWindowTicks = Math.max(4, Math.round(Math.max(1, tickRate) * 0.16));
  const fireEvents = round.fireEvents
    .filter((event) => event.tick <= currentTick && currentTick - event.tick <= visibleWindowTicks && isGunfireWeapon3d(event.weaponName))
    .slice(-28);

  for (const event of fireEvents) {
    if (!event.playerId) {
      continue;
    }

    const stream = round.playerStreams.find((candidate) => candidate.playerId === event.playerId);
    if (!stream) {
      continue;
    }

    const sample = interpolatePlayerStreamSample(stream, event.tick) ?? interpolatePlayerStreamSample(stream, currentTick);
    if (!sample?.alive) {
      continue;
    }

    const playerPosition = source2PointToGltf(sample, assetResult.coordinateTransform) ?? source2PointToGltf(event, assetResult.coordinateTransform);
    if (!playerPosition) {
      continue;
    }

    const yawRadians = source2YawToGltfRadians(sample.yaw, assetResult.coordinateTransform);
    const age = Math.max(0, currentTick - event.tick);
    const opacity = Math.max(0.12, 1 - age / Math.max(1, visibleWindowTicks));
    addGunfireCue3d(stage.utilityGroup, playerPosition, yawRadians, playerRadius, opacity, event.weaponName);
  }
}

function isGunfireWeapon3d(weaponName: string) {
  const normalized = normalizeWeaponName(weaponName);
  if (!normalized) {
    return false;
  }

  return !(
    normalized.includes("grenade") ||
    normalized === "flashbang" ||
    normalized === "molotov" ||
    normalized === "incgrenade" ||
    normalized === "incendiarygrenade" ||
    normalized === "smokegrenade" ||
    normalized === "decoy" ||
    normalized === "knife" ||
    normalized === "c4"
  );
}

function addGunfireCue3d(utilityGroup: Group, playerPosition: Vector3, yawRadians: number, playerRadius: number, opacity: number, weaponName: string) {
  const forward = new Vector3(Math.sin(yawRadians), 0, Math.cos(yawRadians));
  const muzzle = playerPosition.clone().addScaledVector(forward, playerRadius * 0.72);
  muzzle.y += playerRadius * 1.22;
  const tracerEnd = muzzle.clone().addScaledVector(forward, playerRadius * gunfireTracerLength(weaponName));

  const tracer = new Line(
    new BufferGeometry().setFromPoints([muzzle, tracerEnd]),
    new LineBasicMaterial({
      color: 0xffe4a3,
      depthTest: false,
      depthWrite: false,
      transparent: true,
      opacity: Math.min(0.86, opacity * 0.78),
    }),
  );
  tracer.name = `fire-event-tracer:${weaponName}`;
  tracer.renderOrder = 61;
  utilityGroup.add(tracer);

  const flash = new Mesh(
    new SphereGeometry(playerRadius * 0.18, 12, 8),
    new MeshBasicMaterial({
      color: 0xfff1bd,
      depthTest: false,
      depthWrite: false,
      transparent: true,
      opacity: Math.min(0.9, opacity * 0.82),
    }),
  );
  flash.name = `fire-event-muzzle:${weaponName}`;
  flash.position.copy(muzzle);
  flash.scale.set(1.55, 0.78, 1.55);
  flash.renderOrder = 62;
  utilityGroup.add(flash);
}

function gunfireTracerLength(weaponName: string) {
  const normalized = normalizeWeaponName(weaponName);
  if (normalized === "awp" || normalized === "ssg08" || normalized?.includes("scar") || normalized?.includes("g3sg1")) {
    return 8.5;
  }

  if (normalized === "deagle") {
    return 6.6;
  }

  return 5.4;
}

function isSmokeActive3d(utility: UtilityEntity, currentTick: number, tickRate: number) {
  const activeStartTick = utility.detonateTick ?? utility.phaseEvents.find((event) => event.type === "detonate")?.tick ?? null;
  if (activeStartTick == null || currentTick < activeStartTick) {
    return false;
  }

  const expectedEndTick = activeStartTick + Math.max(1, tickRate) * 20;
  const endTick = Math.max(utility.endTick ?? activeStartTick, expectedEndTick);
  return currentTick <= endTick;
}

function addSmokeVolume3d(utilityGroup: Group, utility: UtilityEntity, center: Vector3) {
  const baseRadius = 4.35;
  const groundHaze = new Mesh(
    new CylinderGeometry(baseRadius * 1.05, baseRadius * 1.34, 0.12, 32),
    new MeshBasicMaterial({
      color: 0xb9c0bc,
      depthTest: true,
      depthWrite: false,
      side: DoubleSide,
      transparent: true,
      opacity: 0.14,
    }),
  );
  groundHaze.name = `utility-smoke-ground-haze:${utility.utilityId}`;
  groundHaze.position.set(center.x, center.y + 0.1, center.z);
  groundHaze.renderOrder = 45;
  utilityGroup.add(groundHaze);

  const core = new Mesh(
    new SphereGeometry(baseRadius * 0.9, 16, 10),
    new MeshBasicMaterial({
      color: 0xcfd4cf,
      depthTest: true,
      depthWrite: false,
      transparent: true,
      opacity: 0.18,
    }),
  );
  core.name = `utility-smoke-core:${utility.utilityId}`;
  core.position.set(center.x, center.y + baseRadius * 0.62, center.z);
  core.scale.set(1.1, 0.78, 1.1);
  core.renderOrder = 45;
  utilityGroup.add(core);

  for (let index = 0; index < 30; index += 1) {
    const angle = stableUnit(`${utility.utilityId}:smoke-angle:${index}`) * Math.PI * 2;
    const layer = index % 5;
    const distanceScale = layer === 0 ? 0.22 : layer === 1 ? 0.48 : layer === 2 ? 0.72 : 0.92;
    const distance = baseRadius * distanceScale * stableUnit(`${utility.utilityId}:smoke-distance:${index}`);
    const height = baseRadius * (0.18 + layer * 0.1 + stableUnit(`${utility.utilityId}:smoke-height:${index}`) * 0.58);
    const puffRadius = baseRadius * (0.28 + stableUnit(`${utility.utilityId}:smoke-radius:${index}`) * 0.24);
    const puff = new Mesh(
      new SphereGeometry(puffRadius, 10, 7),
      new MeshBasicMaterial({
        color: layer <= 1 ? 0xe4e7e1 : layer === 2 ? 0xcfd5d0 : 0xaeb8b4,
        depthTest: true,
        depthWrite: false,
        transparent: true,
        opacity: layer <= 1 ? 0.22 : 0.18,
      }),
    );
    puff.name = `utility-smoke-volume:${utility.utilityId}:${index}`;
    puff.position.set(center.x + Math.cos(angle) * distance, center.y + height, center.z + Math.sin(angle) * distance);
    puff.scale.set(1.24, 0.82 + layer * 0.03, 1.12);
    puff.renderOrder = 46;
    utilityGroup.add(puff);
  }
}

function addFireVolume3d(
  utilityGroup: Group,
  utility: UtilityEntity,
  currentTick: number,
  transform: Extract<Replay3DMapAssetResult, { available: true }>["coordinateTransform"],
  fallbackCenter: Vector3,
) {
  const footprint = [...(utility.fireFootprint ?? [])].reverse().find((sample) => sample.tick <= currentTick) ?? null;
  const cells = footprint ? fireFootprintPoints3d(footprint, transform).slice(0, 42) : [fallbackCenter];
  for (let index = 0; index < cells.length; index += 1) {
    const point = cells[index];
    const patchRadius = 0.72 + 0.22 * stableUnit(`${utility.utilityId}:fire-patch:${index}`);
    const patch = new Mesh(
      new CylinderGeometry(patchRadius, patchRadius * 1.08, 0.06, 18),
      new MeshBasicMaterial({
        color: 0x5a180d,
        depthTest: true,
        depthWrite: false,
        side: DoubleSide,
        transparent: true,
        opacity: 0.48,
      }),
    );
    patch.name = `utility-fire-footprint:${utility.utilityId}:${index}`;
    patch.position.set(point.x, point.y + 0.08, point.z);
    patch.renderOrder = 46;
    utilityGroup.add(patch);

    const flameHeight = 1.05 + 0.62 * stableUnit(`${utility.utilityId}:fire-height:${index}`);
    const flame = new Mesh(
      new ConeGeometry(0.34 + 0.18 * stableUnit(`${utility.utilityId}:fire-radius:${index}`), flameHeight, 10),
      new MeshBasicMaterial({
        color: index % 3 === 0 ? 0xffd36a : index % 3 === 1 ? 0xff8a2f : 0xff4b24,
        depthTest: true,
        depthWrite: false,
        transparent: true,
        opacity: 0.72,
      }),
    );
    flame.name = `utility-fire-flame:${utility.utilityId}:${index}`;
    flame.position.set(point.x, point.y + flameHeight * 0.48, point.z);
    flame.rotation.y = stableUnit(`${utility.utilityId}:fire-rotation:${index}`) * Math.PI * 2;
    flame.renderOrder = 47;
    utilityGroup.add(flame);

    if (index % 3 === 0) {
      const glow = new Mesh(
        new SphereGeometry(0.55 + 0.18 * stableUnit(`${utility.utilityId}:fire-glow:${index}`), 10, 8),
        new MeshBasicMaterial({
          color: 0xffb04d,
          depthTest: true,
          depthWrite: false,
          transparent: true,
          opacity: 0.34,
        }),
      );
      glow.name = `utility-fire-glow:${utility.utilityId}:${index}`;
      glow.position.set(point.x, point.y + 0.42, point.z);
      glow.scale.y = 0.56;
      glow.renderOrder = 48;
      utilityGroup.add(glow);
    }

    if (index % 4 === 0) {
      const smoke = new Mesh(
        new SphereGeometry(0.42 + 0.18 * stableUnit(`${utility.utilityId}:fire-smoke:${index}`), 10, 8),
        new MeshBasicMaterial({
          color: 0x2a2723,
          depthTest: true,
          depthWrite: false,
          transparent: true,
          opacity: 0.24,
        }),
      );
      smoke.name = `utility-fire-smoke:${utility.utilityId}:${index}`;
      smoke.position.set(point.x, point.y + flameHeight * 0.92, point.z);
      smoke.scale.set(1.28, 0.72, 1.12);
      smoke.renderOrder = 49;
      utilityGroup.add(smoke);
    }
  }
}

function addUtilityBurst3d(utilityGroup: Group, utility: UtilityEntity, center: Vector3) {
  const color = utility.kind === "flashbang" ? 0xfff2b6 : 0xff7768;
  const burst = new Mesh(
    new SphereGeometry(utility.kind === "flashbang" ? 1.45 : 1.1, 16, 10),
    new MeshBasicMaterial({
      color,
      depthTest: false,
      depthWrite: false,
      transparent: true,
      opacity: utility.kind === "flashbang" ? 0.48 : 0.38,
    }),
  );
  burst.name = `utility-burst:${utility.utilityId}:${utility.kind}`;
  burst.position.copy(center);
  burst.renderOrder = 48;
  utilityGroup.add(burst);
}

function fireFootprintPoints3d(
  footprint: NonNullable<UtilityEntity["fireFootprint"]>[number],
  transform: Extract<Replay3DMapAssetResult, { available: true }>["coordinateTransform"],
) {
  const count = Math.min(footprint.x.length, footprint.y.length, footprint.z.length);
  const points: Vector3[] = [];
  for (let index = 0; index < count; index += 1) {
    const point = source2PointToGltf(
      {
        x: footprint.x[index],
        y: footprint.y[index],
        z: footprint.z[index],
      },
      transform,
    );
    if (point) {
      points.push(point);
    }
  }
  return points;
}

function stableUnit(value: string) {
  return (stableHash(value) % 1000) / 1000;
}

function utilityTrajectoryPoints3d(
  utility: UtilityEntity,
  currentTick: number,
  transform: Extract<Replay3DMapAssetResult, { available: true }>["coordinateTransform"],
) {
  const endTick = Math.min(currentTick, utilityLifecycleEndTick(utility));
  const sampleInterval = Math.max(1, utility.trajectory.sampleIntervalTicks || 1);
  const sampleCount = Math.min(utility.trajectory.x.length, utility.trajectory.y.length, utility.trajectory.z.length);
  const points: Vector3[] = [];
  const sampleStride = utility.kind === "flashbang" || utility.kind === "hegrenade" ? 2 : 1;

  for (let index = 0; index < sampleCount; index += sampleStride) {
    const sampleTick = utility.trajectory.sampleOriginTick + index * sampleInterval;
    if (sampleTick > endTick) {
      break;
    }

    const point = source2PointToGltf(
      {
        x: utility.trajectory.x[index],
        y: utility.trajectory.y[index],
        z: utility.trajectory.z[index],
      },
      transform,
    );
    if (point) {
      pushDistinctPoint3d(points, point);
    }
  }

  const terminalPoint = [...utility.phaseEvents]
    .filter((event) => event.tick <= endTick)
    .sort((left, right) => right.tick - left.tick)
    .map((event) => source2PointToGltf(event, transform))
    .find((point): point is Vector3 => point != null);
  if (terminalPoint) {
    pushDistinctPoint3d(points, terminalPoint);
  }

  return points;
}

function pushDistinctPoint3d(points: Vector3[], point: Vector3) {
  const last = points[points.length - 1];
  if (last && last.distanceTo(point) < 0.05) {
    return;
  }

  points.push(point);
}

function utilityColor3d(kind: UtilityEntity["kind"], side: "CT" | "T" | null) {
  if (kind === "smoke") {
    return side === "CT" ? 0x9fd6ff : side === "T" ? 0xffc67a : 0xcfd8de;
  }

  if (kind === "flashbang") {
    return 0xfff1a8;
  }

  if (kind === "hegrenade") {
    return 0xff756d;
  }

  if (kind === "molotov" || kind === "incendiary") {
    return 0xffa84f;
  }

  return side === "CT" ? 0x72bfff : side === "T" ? 0xffb14f : 0xd5c7ff;
}

function utilityTrailOpacity3d(utility: UtilityEntity) {
  if (utility.kind === "flashbang" || utility.kind === "hegrenade") {
    return 0.46;
  }

  return 0.64;
}

function utilityEndpointRadius3d(utility: UtilityEntity) {
  if (utility.kind === "smoke" || utility.kind === "molotov" || utility.kind === "incendiary") {
    return 0.42;
  }

  return 0.32;
}

function createPlayerMarker({
  coordinateScale,
  label,
  playerAnimations,
  modelTemplate,
  playerId,
  playerModelHeight,
  radius,
  selected,
  side,
  weaponKey,
  weaponTemplate,
}: {
  coordinateScale: number;
  label: string;
  playerAnimations: PlayerAnimationSet | null;
  modelTemplate: PlayerModelTemplate | null;
  playerId: string;
  playerModelHeight: number;
  radius: number;
  selected: boolean;
  side: "CT" | "T";
  weaponKey: string | null;
  weaponTemplate: WeaponModelTemplate | null;
}) {
  const color = playerColor3d(side);
  const group = new Group();
  group.name = `player:${playerId}:${label}`;
  group.renderOrder = 50;
  const hasModel = modelTemplate != null;

  let model: Group | null = null;
  let animationActions = new Map<string, ReturnType<AnimationMixer["clipAction"]>>();
  let animationClipCount = 0;
  let animationPeriod = 0;
  let mixer: AnimationMixer | null = null;
  if (modelTemplate) {
    model = clonePlayerModelProxy(modelTemplate.group, playerId, playerModelHeight);
    group.add(model);
    const playerAnimation = createPlayerModelMixer(model, playerAnimations);
    animationActions = playerAnimation.actions;
    animationClipCount = playerAnimation.clipCount;
    animationPeriod = playerAnimation.period;
    mixer = playerAnimation.mixer;
  } else {
    const shadow = new Mesh(
      new CapsuleGeometry(radius * 0.36, radius * 0.98, 5, 12),
      new MeshBasicMaterial({
        color: 0x030405,
        depthTest: false,
        depthWrite: false,
        transparent: true,
        opacity: selected ? 0.72 : 0.54,
      }),
    );
    shadow.name = `player-shadow-body:${playerId}`;
    shadow.position.y = radius * 0.82;
    shadow.renderOrder = 51;
    group.add(shadow);

    const body = new Mesh(
      new CapsuleGeometry(radius * 0.32, radius * 1.12, 5, 12),
      new MeshBasicMaterial({
        color,
        depthTest: false,
        depthWrite: false,
        transparent: true,
        opacity: selected ? 0.96 : 0.84,
      }),
    );
    body.name = `player-tactical-body:${playerId}`;
    body.position.y = radius * 0.96;
    body.renderOrder = 52;
    group.add(body);

    const head = new Mesh(
      new SphereGeometry(radius * 0.25, 14, 10),
      new MeshBasicMaterial({
        color: selected ? 0xfff0ea : color,
        depthTest: false,
        depthWrite: false,
        transparent: true,
        opacity: selected ? 0.98 : 0.9,
      }),
    );
    head.name = `player-head:${playerId}`;
    head.position.y = radius * 1.88;
    head.renderOrder = 53;
    group.add(head);

  }

  let weaponObject: Object3D | null = null;
  let carriedWeaponNeedsPitchOverlay = false;
  if (weaponKey && weaponTemplate) {
    const weapon = cloneWeaponModelProxy(weaponTemplate.group, playerId, weaponKey, radius, hasModel);
    if (model && weapon instanceof Group && shouldUseSkeletalWeaponSocket() && attachWeaponToPlayerModel(model, weapon, weaponKey, radius)) {
      weaponObject = weapon;
      carriedWeaponNeedsPitchOverlay = false;
    } else {
      const weaponPitchPivot = new Group();
      weaponPitchPivot.name = `weapon-pitch-pivot:${playerId}:${weaponKey}`;
      weaponPitchPivot.position.set(0, radius * (hasModel ? 1.26 : 1.16), 0);
      weapon.position.sub(weaponPitchPivot.position);
      weaponPitchPivot.add(weapon);
      weaponObject = weaponPitchPivot;
      carriedWeaponNeedsPitchOverlay = true;
      group.add(weaponPitchPivot);
    }
  }

  if (!hasModel) {
    const aimCue = new Line(
      new BufferGeometry().setFromPoints([new Vector3(0, radius * 0.72, -radius * 0.1), new Vector3(0, radius * 0.72, -radius * 1.8)]),
      new LineBasicMaterial({
        color: selected ? 0xfff0ea : color,
        depthTest: false,
        depthWrite: false,
        transparent: true,
        opacity: selected ? 0.95 : 0.7,
      }),
    );
    aimCue.name = `player-yaw-cue:${playerId}`;
    aimCue.renderOrder = 55;
    group.add(aimCue);
  }

  const pitchCue = new Line(
    new BufferGeometry().setFromPoints([new Vector3(0, radius * 1.34, -radius * 0.1), new Vector3(0, radius * 1.34, -radius * 1.18)]),
    new LineBasicMaterial({
      color: selected ? 0xfff0ea : color,
      depthTest: true,
      depthWrite: false,
      transparent: true,
      opacity: hasModel ? (selected ? 0.46 : 0.24) : selected ? 0.56 : 0.32,
    }),
  );
  pitchCue.name = `player-pitch-cue:${playerId}`;
  pitchCue.renderOrder = 55;
  pitchCue.visible = false;
  pitchCue.userData.demoReadSelectedPlayer = selected;
  group.add(pitchCue);

  const ring = new Mesh(
    new TorusGeometry(radius * (hasModel ? (selected ? 0.38 : 0.3) : selected ? 0.56 : 0.46), radius * (hasModel ? 0.014 : 0.032), 8, 34),
    new MeshBasicMaterial({
      color: selected ? 0xfff0ea : color,
      depthTest: true,
      depthWrite: false,
      transparent: true,
      opacity: hasModel ? (selected ? 0.3 : 0.055) : selected ? 0.76 : 0.46,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    }),
  );
  ring.name = `player-ground-ring:${playerId}`;
  ring.rotation.x = Math.PI / 2;
  ring.position.y = radius * 0.035;
  ring.renderOrder = 50;
  group.add(ring);

  const selectedColumn = selected && !hasModel
    ? new Line(
        new BufferGeometry().setFromPoints([new Vector3(0, radius * 0.08, 0), new Vector3(0, radius * 2.55, 0)]),
        new LineBasicMaterial({
          color: 0xfff0ea,
          depthTest: false,
          depthWrite: false,
          transparent: true,
          opacity: 0.34,
        }),
      )
    : null;
  if (selectedColumn) {
    selectedColumn.name = `player-selected-column:${playerId}`;
    selectedColumn.renderOrder = 56;
    group.add(selectedColumn);
  }

  const labelSprite = createPlayerLabelSprite(label, side, radius, selected, hasModel);
  const labelOffset = playerLabelOffset(playerId, radius, hasModel);
  labelSprite.position.set(labelOffset.x, hasModel ? radius * 1.9 + labelOffset.y : radius * 2.24 + labelOffset.y, labelOffset.z);
  group.add(labelSprite);

  return { animationActions, animationClipCount, animationPeriod, carriedWeaponNeedsPitchOverlay, labelSprite, mixer, model, object: group, weaponObject };
}

function playerLabelOffset(playerId: string, radius: number, hasModel: boolean) {
  if (!hasModel) {
    return new Vector3(0, 0, 0);
  }

  const lane = stableHash(playerId) % 3;
  return new Vector3(0, radius * (lane * 0.1), 0);
}

function clonePlayerModelProxy(modelTemplate: Group, playerId: string, playerModelHeight: number) {
  const model = cloneSkeleton(modelTemplate) as Group;
  model.name = `player-model-proxy:${playerId}`;
  model.scale.setScalar(resolvePlayerWorldModelScale(model, playerModelHeight));
  alignPlayerModelFeetToGround(model);
  model.traverse((child) => {
    if (child instanceof Mesh) {
      child.renderOrder = 53;
    }
  });
  return model;
}

function alignPlayerModelFeetToGround(model: Group) {
  const bounds = computeVisiblePlayerModelBounds(model);
  if (bounds.isEmpty()) {
    return;
  }

  const targetFloorClearance = PLAYER_MODEL_FOOT_CLEARANCE;
  model.position.y += targetFloorClearance - bounds.min.y;
}

function maintainPlayerModelFootClearance(model: Group | null, anchorY: number) {
  if (!model) {
    return;
  }

  const footAnchors = playerModelFootAnchors(model);
  if (footAnchors.length === 0) {
    return;
  }

  model.parent?.updateMatrixWorld(true);
  model.updateWorldMatrix(true, true);
  let minFootY = Number.POSITIVE_INFINITY;
  const worldPosition = new Vector3();
  for (const anchor of footAnchors) {
    anchor.getWorldPosition(worldPosition);
    if (worldPosition.y < minFootY) {
      minFootY = worldPosition.y;
    }
  }

  if (!Number.isFinite(minFootY)) {
    return;
  }
  const targetWorldFloor = anchorY + PLAYER_MODEL_FOOT_CLEARANCE;
  const deltaY = targetWorldFloor - minFootY;
  if (Math.abs(deltaY) > 0.002) {
    model.position.y += deltaY;
  }
}

function playerModelFootAnchors(model: Group) {
  const cached = model.userData.demoReadFootAnchors;
  if (Array.isArray(cached)) {
    return cached as Object3D[];
  }

  const anchors: Object3D[] = [];
  model.traverse((child) => {
    const lowerName = child.name.toLowerCase();
    const leafName = lowerName.split("\\").pop() ?? lowerName;
    if (PLAYER_MODEL_FOOT_ANCHOR_NAMES.has(leafName)) {
      anchors.push(child);
    }
  });
  model.userData.demoReadFootAnchors = anchors;
  return anchors;
}

function computeVisiblePlayerModelBounds(model: Group) {
  model.updateMatrixWorld(true);
  const bounds = new Box3();
  let hasBounds = false;

  model.traverse((child) => {
    if (!(child instanceof Mesh)) {
      return;
    }

    if (child instanceof SkinnedMesh) {
      child.computeBoundingBox();
      if (child.boundingBox) {
        bounds.union(child.boundingBox.clone().applyMatrix4(child.matrixWorld));
        hasBounds = true;
      }
      return;
    }

    if (!child.geometry.boundingBox) {
      child.geometry.computeBoundingBox();
    }

    if (child.geometry.boundingBox) {
      bounds.union(child.geometry.boundingBox.clone().applyMatrix4(child.matrixWorld));
      hasBounds = true;
    }
  });

  return hasBounds ? bounds : new Box3().setFromObject(model);
}

function cloneWeaponModelProxy(modelTemplate: Group, playerId: string, weaponKey: string, radius: number, hasPlayerModel: boolean) {
  const weapon = modelTemplate.clone(true);
  weapon.name = `weapon-model:${playerId}:${weaponKey}`;
  weapon.rotation.copy(carriedWeaponRotation(weaponKey));
  normalizeCarriedWeaponModel(weapon, carriedWeaponTargetLength(weaponKey, radius, hasPlayerModel));
  weapon.position.copy(carriedWeaponPosition(weaponKey, radius, hasPlayerModel));
  weapon.traverse((child) => {
    if (child instanceof Mesh) {
      child.renderOrder = 54;
    }
  });
  return weapon;
}

function carriedWeaponPosition(weaponKey: string, radius: number, hasPlayerModel: boolean) {
  const height = hasPlayerModel ? 1.38 : 1.2;
  if (weaponKey.startsWith("knife")) {
    return new Vector3(radius * 0.42, radius * 1.18, -radius * 0.78);
  }

  if (isThrowableWeaponKey(weaponKey)) {
    return new Vector3(radius * 0.34, radius * 1.28, -radius * 0.68);
  }

  if (isPistolWeaponKey(weaponKey)) {
    return new Vector3(radius * 0.38, radius * height, -radius * 0.86);
  }

  return new Vector3(radius * 0.42, radius * height, -radius * 1.02);
}

function carriedWeaponRotation(weaponKey: string) {
  if (weaponKey.startsWith("knife")) {
    return new Euler(-0.18, -0.16, -0.22);
  }

  if (isThrowableWeaponKey(weaponKey)) {
    return new Euler(-0.12, -0.1, -0.12);
  }

  if (isPistolWeaponKey(weaponKey)) {
    return new Euler(-0.06, -0.08, -0.1);
  }

  return new Euler(-0.08, -0.06, -0.08);
}

function normalizeCarriedWeaponModel(weapon: Group, targetLength: number) {
  weapon.updateMatrixWorld(true);
  const bounds = new Box3().setFromObject(weapon);
  if (bounds.isEmpty()) {
    return;
  }

  const size = bounds.getSize(new Vector3());
  const longestAxis = Math.max(size.x, size.y, size.z);
  if (!Number.isFinite(longestAxis) || longestAxis <= 0) {
    return;
  }

  const center = bounds.getCenter(new Vector3());
  weapon.position.sub(center);
  weapon.scale.setScalar(targetLength / longestAxis);
}

function carriedWeaponTargetLength(weaponKey: string, radius: number, hasPlayerModel: boolean) {
  const bodyScale = hasPlayerModel ? 1 : 1.15;
  if (isPistolWeaponKey(weaponKey)) {
    return radius * 0.58 * bodyScale;
  }

  if (weaponKey.startsWith("knife")) {
    return radius * 0.44 * bodyScale;
  }

  if (isThrowableWeaponKey(weaponKey)) {
    return radius * 0.5 * bodyScale;
  }

  if (weaponKey === "c4") {
    return radius * 0.42 * bodyScale;
  }

  if (weaponKey === "awp") {
    return radius * 0.74 * bodyScale;
  }

  return radius * 0.62 * bodyScale;
}

function shouldUseSkeletalWeaponSocket() {
  return true;
}

function attachWeaponToPlayerModel(model: Group, weapon: Group, weaponKey: string, radius: number) {
  const attachment = findPlayerWeaponAttachment(model);
  if (!attachment) {
    return false;
  }

  attachment.add(weapon);
  weapon.position.copy(weaponAttachmentPosition(weaponKey, attachment.name));
  weapon.rotation.copy(weaponAttachmentRotation(weaponKey, attachment.name));
  weapon.scale.setScalar(weaponAttachmentScale(weaponKey, attachment.name));
  fitAttachedWeaponWorldLength(weapon, carriedWeaponTargetLength(weaponKey, radius, true));
  return true;
}

function fitAttachedWeaponWorldLength(weapon: Group, targetLength: number) {
  weapon.updateWorldMatrix(true, true);
  const bounds = new Box3().setFromObject(weapon);
  if (bounds.isEmpty()) {
    return;
  }

  const size = bounds.getSize(new Vector3());
  const longestAxis = Math.max(size.x, size.y, size.z);
  if (!Number.isFinite(longestAxis) || longestAxis <= 0) {
    return;
  }

  weapon.scale.multiplyScalar(targetLength / longestAxis);
}

function findPlayerWeaponAttachment(model: Group) {
  const wpn = findObjectByName(model, (name) => name === "wpn" || name.endsWith("\\wpn"));
  const wpnPivot = findObjectByName(model, (name) => name === "wpnpivot" || name.endsWith("\\wpnpivot"));
  const rightHand = findObjectByName(model, (name) => name === "hand_r" || name.endsWith("\\hand_r"));
  return wpn ?? wpnPivot ?? rightHand;
}

function findObjectByName(root: Object3D, predicate: (lowerName: string) => boolean): Object3D | null {
  const stack = [root];
  while (stack.length > 0) {
    const object = stack.pop();
    if (!object) {
      continue;
    }
    if (predicate(object.name.toLowerCase())) {
      return object;
    }
    stack.push(...object.children);
  }

  return null;
}

function weaponAttachmentPosition(weaponKey: string, attachmentName: string) {
  if (attachmentName.toLowerCase().includes("wpn")) {
    return new Vector3(0, 0, 0.14);
  }

  if (weaponKey.startsWith("knife")) {
    return new Vector3(1.35, -0.42, 0.1);
  }

  if (isThrowableWeaponKey(weaponKey)) {
    return new Vector3(1.0, -0.38, 0.04);
  }

  if (isPistolWeaponKey(weaponKey)) {
    return new Vector3(1.34, -0.5, -0.44);
  }

  return new Vector3(1.68, -0.64, -0.54);
}

function weaponAttachmentRotation(weaponKey: string, attachmentName: string) {
  if (attachmentName.toLowerCase().includes("wpn")) {
    return new Euler(0.02, -0.08, 0);
  }

  if (weaponKey.startsWith("knife")) {
    return new Euler(0.36, 0.18, -0.42);
  }

  if (isThrowableWeaponKey(weaponKey)) {
    return new Euler(0.16, 0.14, -0.18);
  }

  if (isPistolWeaponKey(weaponKey)) {
    return new Euler(-0.06, 0.16, -0.2);
  }

  return new Euler(-0.1, 0.14, -0.18);
}

function weaponAttachmentScale(weaponKey: string, attachmentName: string) {
  if (attachmentName.toLowerCase().includes("wpn")) {
    return 1.4 * weaponScaleForKey(weaponKey);
  }

  const base = weaponKey === "c4"
    ? 34
    : isThrowableWeaponKey(weaponKey)
      ? 38
      : weaponKey.startsWith("knife")
        ? 42
        : isPistolWeaponKey(weaponKey)
          ? 50
          : weaponKey === "awp"
            ? 58
            : 52;
  return base * weaponScaleForKey(weaponKey);
}

function weaponScaleForKey(weaponKey: string) {
  if (weaponKey === "awp") {
    return 1.15;
  }

  if (isThrowableWeaponKey(weaponKey)) {
    return 0.44;
  }

  if (weaponKey.startsWith("knife")) {
    return 0.42;
  }

  if (weaponKey === "c4") {
    return 0.58;
  }

  if (
    weaponKey === "deagle" ||
    weaponKey === "elite" ||
    weaponKey === "glock18" ||
    weaponKey === "hkp2000" ||
    weaponKey === "uspsilencer" ||
    weaponKey === "p250"
  ) {
    return 0.62;
  }

  if (weaponKey === "mac10" || weaponKey === "mp9") {
    return 0.82;
  }

  return 0.98;
}

function isPistolWeaponKey(weaponKey: string) {
  return (
    weaponKey === "deagle" ||
    weaponKey === "elite" ||
    weaponKey === "glock18" ||
    weaponKey === "hkp2000" ||
    weaponKey === "p250" ||
    weaponKey === "uspsilencer"
  );
}

function isThrowableWeaponKey(weaponKey: string) {
  return weaponKey.includes("grenade") || weaponKey === "flashbang" || weaponKey === "molotov" || weaponKey === "incendiarygrenade";
}

function createPlayerModelMixer(model: Group, animations: PlayerAnimationSet | null) {
  if (!animations || animations.byKey.size === 0) {
    return { actions: new Map<string, ReturnType<AnimationMixer["clipAction"]>>(), clipCount: 0, mixer: null, period: 0 };
  }

  const mixer = new AnimationMixer(model);
  const actions = new Map<string, ReturnType<AnimationMixer["clipAction"]>>();
  let longestPeriod = 0;
  for (const [key, clip] of animations.byKey) {
    const action = mixer.clipAction(clip);
    action.enabled = false;
    action.setLoop(LoopRepeat, Infinity);
    actions.set(key, action);
    longestPeriod = Math.max(longestPeriod, clip.duration);
  }

  return { actions, clipCount: actions.size, mixer, period: longestPeriod };
}

function playerColor3d(side: "CT" | "T") {
  return side === "CT" ? 0x4fb3ff : 0xffb14f;
}

function resolvePlayerReviewDimensions(
  round: Round,
  currentTick: number,
  replay: Replay,
  transform: Extract<Replay3DMapAssetResult, { available: true }>["coordinateTransform"],
): PlayerReviewDimensions {
  const fallbackRadius = resolvePlayerMarkerRadius(replay, transform.scale);
  const fallbackEyeHeight = Math.max(1.48, fallbackRadius * 1.72);
  const eyeHeights: number[] = [];

  for (const stream of round.playerStreams) {
    const sample = interpolatePlayerStreamSample(stream, currentTick);
    if (!sample?.alive) {
      continue;
    }

    const position = source2PointToGltf(sample, transform);
    const eye = source2PointToGltf({ x: sample.eyeX, y: sample.eyeY, z: sample.eyeZ }, transform);
    if (!position || !eye) {
      continue;
    }

    const eyeHeight = eye.y - position.y;
    if (Number.isFinite(eyeHeight) && eyeHeight > 0.9 && eyeHeight < 2.4) {
      eyeHeights.push(eyeHeight);
    }
  }

  const eyeHeight = eyeHeights.length > 0 ? median(eyeHeights) : fallbackEyeHeight;
  const modelHeight = Math.max(2.16, Math.min(2.45, eyeHeight * PLAYER_STANDING_HEIGHT_FROM_EYE_MULTIPLIER * PLAYER_3D_PRESENTATION_HEIGHT_MULTIPLIER));
  const radius = Math.max(fallbackRadius, modelHeight * 0.46);
  return { eyeHeight, modelHeight, radius };
}

function median(values: number[]) {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)];
}

function resolvePlayerMarkerRadius(replay: Replay, coordinateScale: number) {
  if (coordinateScale >= 0.5) {
    return 28;
  }

  const { worldXMax, worldXMin, worldYMax, worldYMin } = replay.map.coordinateSystem;
  const worldSpan = Math.max(Math.abs(worldXMax - worldXMin), Math.abs(worldYMax - worldYMin), 1);
  return Math.max(0.72, Math.min(1.08, worldSpan * coordinateScale * 0.0062));
}

function resolvePlayerWorldModelScale(model: Group, playerModelHeight: number) {
  model.updateMatrixWorld(true);
  const bounds = new Box3().setFromObject(model);
  if (bounds.isEmpty()) {
    return 1;
  }

  const currentHeight = bounds.max.y - bounds.min.y;
  if (!Number.isFinite(currentHeight) || currentHeight <= 0) {
    return 1;
  }

  return playerModelHeight / currentHeight;
}

function createPlayerLabelSprite(label: string, side: "CT" | "T", radius: number, selected: boolean, compact: boolean) {
  const canvas = document.createElement("canvas");
  canvas.width = compact ? 220 : 280;
  canvas.height = compact ? 50 : 66;
  const context = canvas.getContext("2d");
  if (context) {
    const accent = side === "CT" ? "#4fb3ff" : "#ffb14f";
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = compact ? "rgba(4, 5, 6, 0.74)" : "rgba(4, 5, 6, 0.78)";
    context.strokeStyle = selected ? "rgba(255, 240, 234, 0.9)" : accent;
    context.lineWidth = compact ? (selected ? 4 : 2) : selected ? 5 : 3;
    context.beginPath();
    context.roundRect(8, compact ? 7 : 9, compact ? 204 : 264, compact ? 34 : 42, compact ? 5 : 6);
    context.fill();
    context.stroke();
    context.fillStyle = selected ? "#fff0ea" : "rgba(255, 240, 234, 0.86)";
    context.font = `${compact ? "900 18px" : "800 22px"} Inter, Arial, sans-serif`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(label.slice(0, compact ? 12 : 14), compact ? 110 : 140, compact ? 25 : 30, compact ? 180 : 236);
  }

  const texture = new CanvasTexture(canvas);
  const material = new SpriteMaterial({
    map: texture,
    depthTest: false,
    depthWrite: false,
    transparent: true,
  });
  const sprite = new Sprite(material);
  sprite.name = `player-label:${label}`;
  sprite.renderOrder = 57;
  material.opacity = selected ? 0.92 : 0.68;
  const width = radius * (compact ? (selected ? 1.55 : 1.32) : 3.8);
  const height = radius * (compact ? (selected ? 0.36 : 0.31) : 0.9);
  sprite.scale.set(width, height, 1);
  sprite.userData.baseWidth = width;
  sprite.userData.baseHeight = height;
  sprite.userData.reviewScaleFactor = 1;
  return sprite;
}

function pickNearestPlayerMarker(stage: ThreeStage, markers: PlayerMarker[], event: PointerEvent) {
  const bounds = stage.renderer.domElement.getBoundingClientRect();
  const pointer = new Vector3(
    ((event.clientX - bounds.left) / Math.max(1, bounds.width)) * 2 - 1,
    -(((event.clientY - bounds.top) / Math.max(1, bounds.height)) * 2 - 1),
    0.5,
  );
  pointer.unproject(stage.camera);

  let best: PlayerMarker | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const marker of markers) {
    const screen = marker.object.getWorldPosition(new Vector3()).project(stage.camera);
    const dx = screen.x - (((event.clientX - bounds.left) / Math.max(1, bounds.width)) * 2 - 1);
    const dy = screen.y - -(((event.clientY - bounds.top) / Math.max(1, bounds.height)) * 2 - 1);
    const distance = Math.hypot(dx, dy);
    if (distance < bestDistance) {
      best = marker;
      bestDistance = distance;
    }
  }

  return bestDistance < 0.105 ? best : null;
}
