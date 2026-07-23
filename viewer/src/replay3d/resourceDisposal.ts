import { Line, Mesh, Object3D, Sprite, type SpriteMaterial } from "three";

export function disposeObjectMeshes(root: Object3D) {
  root.traverse((object) => {
    if (object instanceof Mesh) {
      object.geometry.dispose();
      disposeMaterialList(object.material);
    }

    if (object instanceof Line) {
      object.geometry.dispose();
      disposeMaterialList(object.material);
    }

    if (object instanceof Sprite) {
      disposeMaterialList(object.material);
    }
  });
}

function disposeMaterialList(materialOrMaterials: Line["material"] | Mesh["material"] | SpriteMaterial) {
  const materials = Array.isArray(materialOrMaterials) ? materialOrMaterials : [materialOrMaterials];
  for (const material of materials) {
    if ("map" in material) {
      const map = material.map as { dispose?: () => void } | null;
      map?.dispose?.();
    }
    material.dispose();
  }
}
