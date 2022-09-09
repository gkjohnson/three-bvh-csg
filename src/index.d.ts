import { BufferGeometry, EdgesGeometry, Group, InstancedMesh, LineSegments, Mesh, MeshPhongMaterial, Plane, Triangle, Vector3 } from 'three';

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
  getGroupArray( name: string, index?: number ): Array; // return Array ???
  initializeArray( name: string, type: string ): void;
  clear(): void;
  delete( key: string ): void;
  reset(): void;

}

export enum OperationStrategy{} // Is the name correct?
export const ADDITION: OperationStrategy;
export const SUBTRACTION: OperationStrategy;
export const DIFFERENCE: OperationStrategy;
export const INTERSECTION: OperationStrategy;

export class Evaluator {

  triangleSplitter: TriangleSplitter;
  attributeData: TypedAttributeData;
  attributes: String[];
  useGroups: boolean;
  debug: OperationDebugData;

  evaluate( a: Brush, b: Brush, operation: OperationStrategy, targetBrush?: Brush ): Brush;

  evaluateHierarchy( root: Brush, target?: Brush ): Brush; // Root is Brush type??

}

export class Operation extends Brush {

  isOperation: boolean;
  // operation
  markUpdated(): void;
  isDirty(): boolean;
  insertBefore( brush: Brush );
  insertAfter( brush: Brush );

}

export class OperationGroup extends Group {

  isOperatioinGroup: boolean;
  markUpdated(): void;
  isDirty(): boolean;

}

export class CullableTriangle extends Triangle {

  initFrom( other: Triangle );
  updateSide( plane: Plane, triangle: Triangle, coplanarIndex: number );

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

  initialize( tri: Triangle );
  splitByTriangle( triangle: Triangle );
  splitByPlane( plane: Plane, triangle: Triangle, coplanarIndex: number );
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

  setTriangles( triangles: Triangle[] );

}

export class EdgesHelper extends LineSegments {

  constructor( edges?: EdgesGeometry );

  setEdges( edges: EdgesGeometry ): void;

}

export class TriangleIntersectData {

  intersects: Object;
  triangle: Triangle;

  constructor( tri: Triangle );
  addTriangle( index: number, tri: Triangle ): void;
  getIntersectArray(): Array;

}

export class TriangleIntersectionSets {

  addTriangleIntersection( ia: number, tribA: Triangle, ib: number, triB: Triangle ): void;
  getTrianglesAsArray( id?: number ): Array;
  getTriangleIndices(): Array;
  getIntersectionIndices( id: number );
  getIntersectionsAsArray( id?: number, id2: number ): Array;

}

export class OperationDebugData {

  intersectionEdges: EdgesGeometry[];

  addIntersectingTriangles( ia: number, triA: Triangle, ib: number, triB: Triangle ): void;
  addEdge( edge: EdgesGeometry ): void;
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
