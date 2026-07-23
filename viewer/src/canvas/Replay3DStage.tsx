import { useEffect, useMemo, useRef, useState } from "react";
import {
  Box3,
  BufferGeometry,
  CapsuleGeometry,
  CanvasTexture,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  Line,
  LineBasicMaterial,
  MeshBasicMaterial,
  Mesh,
  PerspectiveCamera,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  TorusGeometry,
  Vector3,
} from "three";

import { interpolatePlayerStreamSample } from "../replay/playerStream";
import type { Replay, Round, UtilityEntity } from "../replay/types";
import { utilityLifecycleEndTick, utilitySceneStateAtTick } from "../replay/utility";
import { normalizeWeaponName } from "../replay/weapons";
import { loadReplay3DMapAsset, type Replay3DMapAssetResult } from "../replay3d/mapAssetManifest";
import { source2PointToGltf, source2YawToGltfRadians } from "../replay3d/replay3dCoordinates";
import { disposeObjectMeshes } from "../replay3d/resourceDisposal";
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
  label: string;
  labelSprite: Sprite;
  object: Group;
  playerId: string;
  selected: boolean;
  side: "CT" | "T";
};

type PlayerPovCameraView = {
  eyePosition: Vector3;
  isScoped: boolean | null;
  pitch: number;
  playerId: string;
  side: "CT" | "T";
  yaw: number;
  zoomLevel: number | null;
};

type PlayerReviewDimensions = {
  eyeHeight: number;
  radius: number;
};

export function Replay3DStage({ currentTick, replay, round, selectedPlayerId, onSelectPlayer }: Replay3DStageProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<ThreeStage | null>(null);
  const onSelectPlayerRef = useRef(onSelectPlayer);
  const playerMarkersRef = useRef<PlayerMarker[]>([]);
  const playerMarkerByIdRef = useRef(new Map<string, PlayerMarker>());
  const [assetResult, setAssetResult] = useState<Replay3DMapAssetResult | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [cameraMode, setCameraMode] = useState<Replay3DCameraMode>("tactical");
  const playerNameById = useMemo(() => new Map(replay.players.map((player) => [player.playerId, player.displayName])), [replay.players]);
  const playerSideById = useMemo(() => new Map(round.playerStreams.map((stream) => [stream.playerId, stream.side])), [round.playerStreams]);
  const assetUrl = assetResult?.available === true ? assetResult.assetUrl : null;

  useEffect(() => {
    onSelectPlayerRef.current = onSelectPlayer;
  }, [onSelectPlayer]);

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
      playerNameById,
      playerSideById,
      playerMarkerByIdRef,
      replay,
      round,
      cameraMode,
      selectedPlayerId,
      stage,
      markerRef: playerMarkersRef,
    });
  }, [assetResult, cameraMode, currentTick, mapLoaded, playerNameById, playerSideById, replay, round, selectedPlayerId]);

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
          <span>Players use canonical replay x/y/z/yaw/pitch/eye position. POV and aim cues are parser-backed review aids; the crosshair is not exact player config, recoil, or spread.</span>
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
            title="Parser-backed eye position, pitch, and yaw with a neutral review reticle"
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

function renderPlayers3d({
  assetResult,
  cameraMode,
  currentTick,
  markerRef,
  playerMarkerByIdRef,
  playerNameById,
  playerSideById,
  replay,
  round,
  selectedPlayerId,
  stage,
}: {
  assetResult: Extract<Replay3DMapAssetResult, { available: true }>;
  cameraMode: Replay3DCameraMode;
  currentTick: number;
  markerRef: React.MutableRefObject<PlayerMarker[]>;
  playerMarkerByIdRef: React.MutableRefObject<Map<string, PlayerMarker>>;
  playerNameById: Map<string, string>;
  playerSideById: Map<string, "CT" | "T" | null>;
  replay: Replay;
  round: Round;
  selectedPlayerId: string | null;
  stage: ThreeStage;
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
    const existing = playerMarkerByIdRef.current.get(stream.playerId);
    const marker =
      existing && existing.side === stream.side && existing.selected === selected && existing.label === label
        ? existing
        : replacePlayerMarker({
            existing,
            label,
            playerId: stream.playerId,
            playerMarkerByIdRef,
            radius: playerRadius,
            selected,
            side: stream.side,
            stage,
          });

    marker.object.position.copy(position);
    marker.object.rotation.y = source2YawToGltfRadians(sample.yaw, assetResult.coordinateTransform);
    const playerPitch = isFiniteReplayNumber(sample.pitch) ? sample.pitch : null;
    const eyePosition = source2PointToGltf(
      { x: sample.eyeX, y: sample.eyeY, z: sample.eyeZ },
      assetResult.coordinateTransform,
    );
    if (eyePosition && isFiniteReplayNumber(sample.yaw) && isFiniteReplayNumber(sample.pitch)) {
      const view: PlayerPovCameraView = {
        eyePosition,
        isScoped: sample.isScoped,
        pitch: sample.pitch,
        playerId: stream.playerId,
        side: stream.side,
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

    updatePlayerAimPitchCue(marker.object, playerPitch, playerRadius);
    if (selected) {
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
  updateSelectedPlayerAimRay(
    stage,
    selectedAimView ?? fallbackAimView,
    assetResult.coordinateTransform,
    playerRadius,
    cameraMode,
  );

  const selectedFrameTargetChanged = selectedPlayerId !== stage.lastFramedSelectedPlayerId;
  const previousRenderedTick = stage.lastRenderedTick;
  const seekedSinceLastRender =
    previousRenderedTick != null &&
    Math.abs(currentTick - previousRenderedTick) > Math.max(16, Math.round(replay.match.tickRate * 1.5));
  stage.lastRenderedTick = currentTick;
  const fallbackCameraMarkers = selectTacticalCameraCluster(aliveMarkers, aliveCtMarkers, aliveTMarkers, playerRadius);
  const chaseMarker = selectedMarker ?? fallbackCameraMarkers[0] ?? aliveMarkers[0] ?? null;

  if (cameraMode === "pov" && !povCameraView) {
    if (chaseMarker) {
      frameCameraBehindSelectedPlayer(stage, chaseMarker, playerRadius);
    } else if (fallbackCameraMarkers.length > 0) {
      frameCameraAroundPlayerCluster(stage, fallbackCameraMarkers, playerRadius);
    }
  } else if (cameraMode === "pov" && povCameraView) {
    frameCameraFromPlayerView(stage, povCameraView, assetResult.coordinateTransform);
    stage.hasFramedPlayers = true;
    stage.lastFramedSelectedPlayerId = selectedPlayerId ?? povCameraView.playerId;
  } else if (cameraMode === "chase" && chaseMarker) {
    frameCameraBehindSelectedPlayer(stage, chaseMarker, playerRadius);
    stage.hasFramedPlayers = true;
    stage.lastFramedSelectedPlayerId = selectedPlayerId ?? chaseMarker.name;
  } else if (cameraMode === "tactical" && !stage.cameraUserControlled) {
    if (!stage.hasFramedPlayers || selectedFrameTargetChanged || seekedSinceLastRender) {
      if (selectedMarker) {
        frameCameraAroundSelectedPlayer(stage, selectedMarker, playerRadius);
      } else if (fallbackCameraMarkers.length > 0) {
        frameCameraAroundPlayerCluster(stage, fallbackCameraMarkers, playerRadius);
      }
      stage.hasFramedPlayers = true;
      stage.lastFramedSelectedPlayerId = selectedPlayerId;
    }
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

function replacePlayerMarker({
  existing,
  label,
  playerId,
  playerMarkerByIdRef,
  radius,
  selected,
  side,
  stage,
}: {
  existing: PlayerMarker | undefined;
  label: string;
  playerId: string;
  playerMarkerByIdRef: React.MutableRefObject<Map<string, PlayerMarker>>;
  radius: number;
  selected: boolean;
  side: "CT" | "T";
  stage: ThreeStage;
}) {
  if (existing) {
    stage.playerGroup.remove(existing.object);
    disposePlayerMarker(existing);
  }

  const created = createPlayerMarker({ label, playerId, radius, selected, side });
  stage.playerGroup.add(created.object);
  const marker: PlayerMarker = {
    label,
    labelSprite: created.labelSprite,
    object: created.object,
    playerId,
    selected,
    side,
  };
  playerMarkerByIdRef.current.set(playerId, marker);
  return marker;
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

function disposePlayerMarker(marker: PlayerMarker) {
  disposeObjectMeshes(marker.object);
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

function isFiniteReplayNumber(value: number | null): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isBetterFallbackPovView(candidate: PlayerPovCameraView, existing: PlayerPovCameraView | null) {
  return existing == null || Math.abs(candidate.pitch) < Math.abs(existing.pitch);
}

function updatePlayerAimPitchCue(playerObject: Group, pitch: number | null, radius: number) {
  const cue = playerObject.children.find((child) => child.name.startsWith("player-pitch-cue:"));
  if (!(cue instanceof Line) || !(cue.geometry instanceof BufferGeometry)) {
    return;
  }

  if (!isFiniteReplayNumber(pitch)) {
    cue.visible = false;
    return;
  }

  const clampedPitch = Math.max(-65, Math.min(65, pitch));
  const pitchRadians = (clampedPitch * Math.PI) / 180;
  const start = new Vector3(0, radius * 1.58, -radius * 0.08);
  const length = radius * 1.75;
  const end = new Vector3(0, start.y - Math.sin(pitchRadians) * length, start.z - Math.cos(pitchRadians) * length);
  cue.geometry.setFromPoints([start, end]);
  cue.visible = true;
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

function stableHash(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
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
  label,
  playerId,
  radius,
  selected,
  side,
}: {
  label: string;
  playerId: string;
  radius: number;
  selected: boolean;
  side: "CT" | "T";
}) {
  const color = playerColor3d(side);
  const group = new Group();
  group.name = `player:${playerId}:${label}`;
  group.renderOrder = 50;

  const shadow = new Mesh(
    new CapsuleGeometry(radius * 0.37, radius * 0.9, 5, 12),
    new MeshBasicMaterial({
      color: 0x030405,
      depthTest: false,
      depthWrite: false,
      transparent: true,
      opacity: selected ? 0.76 : 0.58,
    }),
  );
  shadow.name = `player-shadow-body:${playerId}`;
  shadow.position.y = radius * 0.86;
  shadow.renderOrder = 51;
  group.add(shadow);

  const body = new Mesh(
    new CapsuleGeometry(radius * 0.32, radius * 1.04, 5, 12),
    new MeshBasicMaterial({
      color,
      depthTest: false,
      depthWrite: false,
      transparent: true,
      opacity: selected ? 0.98 : 0.86,
    }),
  );
  body.name = `player-tactical-body:${playerId}`;
  body.position.y = radius * 0.94;
  body.renderOrder = 52;
  group.add(body);

  const head = new Mesh(
    new SphereGeometry(radius * 0.25, 14, 10),
    new MeshBasicMaterial({
      color: selected ? 0xfff0ea : color,
      depthTest: false,
      depthWrite: false,
      transparent: true,
      opacity: selected ? 1 : 0.92,
    }),
  );
  head.name = `player-head:${playerId}`;
  head.position.y = radius * 1.58;
  head.renderOrder = 53;
  group.add(head);

  const pitchCue = new Line(
    new BufferGeometry().setFromPoints([
      new Vector3(0, radius * 1.58, -radius * 0.08),
      new Vector3(0, radius * 1.58, -radius * 1.83),
    ]),
    new LineBasicMaterial({
      color: selected ? 0xfff0ea : color,
      depthTest: false,
      depthWrite: false,
      transparent: true,
      opacity: selected ? 0.92 : 0.62,
    }),
  );
  pitchCue.name = `player-pitch-cue:${playerId}`;
  pitchCue.renderOrder = 55;
  pitchCue.visible = false;
  group.add(pitchCue);

  const ring = new Mesh(
    new TorusGeometry(radius * (selected ? 0.56 : 0.46), radius * 0.032, 8, 34),
    new MeshBasicMaterial({
      color: selected ? 0xfff0ea : color,
      depthTest: true,
      depthWrite: false,
      transparent: true,
      opacity: selected ? 0.76 : 0.46,
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

  if (selected) {
    const selectedColumn = new Line(
      new BufferGeometry().setFromPoints([new Vector3(0, radius * 0.08, 0), new Vector3(0, radius * 2.42, 0)]),
      new LineBasicMaterial({
        color: 0xfff0ea,
        depthTest: false,
        depthWrite: false,
        transparent: true,
        opacity: 0.28,
      }),
    );
    selectedColumn.name = `player-selected-column:${playerId}`;
    selectedColumn.renderOrder = 56;
    group.add(selectedColumn);
  }

  const labelSprite = createPlayerLabelSprite(label, side, radius, selected);
  labelSprite.position.set(0, radius * 2.18, 0);
  group.add(labelSprite);
  return { labelSprite, object: group };
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
  const radius = Math.max(fallbackRadius, Math.min(1.13, Math.max(0.98, eyeHeight * 0.63)));
  return { eyeHeight, radius };
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

function createPlayerLabelSprite(label: string, side: "CT" | "T", radius: number, selected: boolean) {
  const canvas = document.createElement("canvas");
  canvas.width = 280;
  canvas.height = 66;
  const context = canvas.getContext("2d");
  if (context) {
    const accent = side === "CT" ? "#4fb3ff" : "#ffb14f";
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "rgba(4, 5, 6, 0.78)";
    context.strokeStyle = selected ? "rgba(255, 240, 234, 0.9)" : accent;
    context.lineWidth = selected ? 5 : 3;
    context.beginPath();
    context.roundRect(8, 9, 264, 42, 6);
    context.fill();
    context.stroke();
    context.fillStyle = selected ? "#fff0ea" : "rgba(255, 240, 234, 0.86)";
    context.font = "800 22px Inter, Arial, sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(label.slice(0, 14), 140, 30, 236);
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
  const width = radius * 3.8;
  const height = radius * 0.9;
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
