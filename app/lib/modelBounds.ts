import { Box3, BufferGeometry, Group, Mesh, Object3D, Vector3 } from 'three';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { millimetresToPlateUnits, type PlateDimensions } from '@shared/units';

export interface ParsedModel {
  object: Object3D;
  /** Size in millimetres, sorted so the tallest side is "height" only if the model says so. */
  size: { x: number; y: number; z: number };
  dimensions: PlateDimensions;
}

/** Reads an STL or OBJ file and measures its bounding box. Works without any graphics card. */
export async function parseModelFile(file: File): Promise<ParsedModel> {
  const name = file.name.toLowerCase();
  let object: Object3D;
  if (name.endsWith('.stl')) {
    const geometry: BufferGeometry = new STLLoader().parse(await file.arrayBuffer());
    geometry.computeVertexNormals();
    object = new Mesh(geometry);
  } else if (name.endsWith('.obj')) {
    object = new OBJLoader().parse(await file.text());
  } else {
    throw new Error('Please choose an .stl or .obj file');
  }
  const box = new Box3().setFromObject(object);
  if (box.isEmpty()) throw new Error('That file has no 3D shape in it');
  const size = box.getSize(new Vector3());
  /* Models are usually printed lying on the XY plane with Z pointing up. */
  const dimensions = millimetresToPlateUnits(size.x, size.y, size.z);
  const group = new Group();
  group.add(object);
  return { object: group, size: { x: size.x, y: size.y, z: size.z }, dimensions };
}
