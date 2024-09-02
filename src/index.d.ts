import { BufferGeometry, Group, InstancedMesh, Line3, LineSegments, Mesh, MeshPhongMaterial, Plane, Triangle, Vector3 } from 'three';

export class Brush extends Mesh {

  isBrush: boolean;
  markUpdated(): void;
  isDirty(): boolean;
  prepareGeometry(): void;
  disposeCacheData(): void;

}

export class TypedAttributeData {

  groupAttributes: Object[];
  groupCount: number;

  getType( name: String ): string;
  getTotalLength( name: String ): number;
  getGroupSet( index?: number ): Object;
  getGroupAttrArray( name: string, index?: number ): Array<number>;
  initializeArray( name: string, type: string ): void;
  clear(): void;
  delete( key: string ): void;
  reset(): void;

}

export enum CSGOperation{}
export const ADDITION: CSGOperation;
export const SUBTRACTION: CSGOperation;
export const REVERSE_SUBTRACTION: CSGOperation;
export const INTERSECTION: CSGOperation;
export const DIFFERENCE: CSGOperation;
export const HOLLOW_SUBTRACTION: CSGOperation;
export const HOLLOW_INTERSECTION: CSGOperation;

export class Evaluator {

  attributes: String[];
  useGroups: boolean;
  consolidateMaterials: boolean;
  debug: OperationDebugData;

  evaluate( a: Brush, b: Brush, operation: CSGOperation, targetBrush?: Brush ): Brush;
  evaluate( a: Brush, b: Brush, operations: CSGOperation[], targetBrushes: Brush[] ): Brush[];

  evaluateHierarchy( root: Operation, target?: Brush ): Brush;

}

export class Operation extends Brush {

  isOperation: boolean;
  operation: CSGOperation;
  markUpdated(): void;
  isDirty(): boolean;
  insertBefore( brush: Brush ): void;
  insertAfter( brush: Brush ): void;

}

export class OperationGroup extends Group {

  isOperatioinGroup: boolean;
  markUpdated(): void;
  isDirty(): boolean;

}

export class CullableTriangle extends Triangle {

  initFrom( other: Triangle ): void;
  updateSide( plane: Plane, triangle: Triangle, coplanarIndex: number ): void;

}

export class TrianglePool {

  getTriangle(): Triangle;
  clear(): void;
  reset(): void;

}

export class TriangleSplitter {

  trianglePool: TrianglePool;
  triangles: Triangle[];
  normal: Vector3;

  initialize( tri: Triangle ): void;
  splitByTriangle( triangle: Triangle ): void;
  splitByPlane( plane: Plane, triangle: Triangle, coplanarIndex: number ): void;
  reset(): void;

}

export class HalfEdgeMap {

  constructor( geometry?: BufferGeometry );
  getSiblingTriangleIndex( triIndex: number, edgeIndex: number ): number;
  getSiblingEdgeIndex( triIndex: number, edgeIndex: number ): number;
  updateFrom( geomtry: BufferGeometry ): void;

}

export class GridMaterial extends MeshPhongMaterial {

  enableGrid: boolean;

}

export function getTriangleDefinitions( ...triangles: Triangle[] ): String[];

export function logTriangleDefinitions( ...triangles: Triangle[] ): void;

export function generateRandomTriangleColors( geometry: BufferGeometry ): void;

export class TriangleSetHelper extends Group {

  constructor( triangles?: Triangle[] );

  setTriangles( triangles: Triangle[] ): void;

}

export class EdgesHelper extends LineSegments {

  constructor( edges?: Line3[] );

  setEdges( edges: Line3[] ): void;

}

export class TriangleIntersectData {

  intersects: Object;
  triangle: Triangle;

  constructor( tri: Triangle );
  addTriangle( index: number, tri: Triangle ): void;
  getIntersectArray(): Array<Triangle>;

}

export class TriangleIntersectionSets {

  addTriangleIntersection( ia: number, tribA: Triangle, ib: number, triB: Triangle ): void;
  getTrianglesAsArray( id?: number ): Array<Triangle>;
  getTriangleIndices(): Array<number>;
  getIntersectionIndices( id: number ): void;
  getIntersectionsAsArray( id?: number, id2?: number ): Array<Triangle>;

}

export class OperationDebugData {

  intersectionEdges: Line3[];
  enabled: boolean;

  addIntersectingTriangles( ia: number, triA: Triangle, ib: number, triB: Triangle ): void;
  addEdge( edge: Line3 ): void;
  reset(): void;

}

export class PointsHelper extends InstancedMesh {

  constructor( count?: number, points?: Vector3[] );

  setPoints( points: Vector3 ): void;

}

export class HalfEdgeHelper extends EdgesHelper {

  constructor( geometry?: BufferGeometry, halfEdges?: HalfEdgeMap );
  setHalfEdges( geometry: BufferGeometry, halfEdges: HalfEdgeMap ): void;

}

export function computeMeshVolume( mesh : Mesh | BufferGeometry ) : Number;
