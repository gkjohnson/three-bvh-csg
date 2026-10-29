// Hand-constructed local cells only; no imported model or recorded coordinates.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Vector3, Line3, Triangle, BoxGeometry } from 'three';
import { ExtendedTriangle } from 'three-mesh-bvh';
import { Brush, ADDITION } from '../src/index.js';
import { anchorInteriorClassificationCell } from '../src/core/utils/anchorInteriorClassificationCell.js';
import { getHitSide, getOperationAction, BACK_SIDE, SKIP_TRI } from '../src/core/operations/operationsUtils.js';

function cell() {
 const base = new ExtendedTriangle( new Vector3( 0, 0, 0 ), new Vector3( 4, 0, 0 ), new Vector3( 0, 4, 0 ) );
 const boundary = [ new Line3( base.a, base.b ), new Line3( base.b, base.c ), new Line3( base.c, base.a ) ];
 const sources = [ base.a.clone(), base.b.clone(), new Vector3( 1, 1, 0 ) ];
 const points = [ new Vector3( 0, 2, 0 ), new Vector3( 1, 2, 0 ), new Vector3( 1, 1, 0 ) ];
 const normal = base.getNormal( new Vector3() );
 return { base, boundary, sources, points, normal };
}
const run = c => anchorInteriorClassificationCell( c.base, c.boundary, c.sources, c.points, c.normal );
const numbers = points => points.map( p => p.toArray() );

test( 'synthetic folded interior cell anchors only its two exact current corners', () => {
 const c = cell(), oldPoints = numbers( c.points ), oldSources = numbers( c.sources );
 const anchored = run( c );
 assert.notStrictEqual( anchored, c.points );
 assert.deepEqual( numbers( anchored ), [ c.base.a.toArray(), c.base.b.toArray(), c.points[ 2 ].toArray() ] );
 assert.deepEqual( numbers( c.points ), oldPoints );assert.deepEqual( numbers( c.sources ), oldSources );
 assert.ok( new Triangle( ...anchored ).getNormal( new Vector3() ).dot( c.normal ) > 0 );
} );

test( 'synthetic positive and zero-oriented classification cells stay unchanged', () => {
 for ( const points of [ [ [ 0, 0, 0 ], [ 4, 0, 0 ], [ 1, 1, 0 ] ], [ [ 0, 0, 0 ], [ 1, 1, 0 ], [ 1, 1, 0 ] ] ] ) {
  const c = cell();c.points = points.map( p => new Vector3( ...p ) );
  assert.strictEqual( run( c ), c.points );
 }
} );

test( 'synthetic boundary node and subdivided source edge are not eligible', () => {
 const boundaryNode = cell(), q = new Vector3( 0, 1, 0 );
 boundaryNode.sources[ 2 ] = q;boundaryNode.points[ 2 ] = q.clone();
 boundaryNode.boundary = [ new Line3( boundaryNode.base.a, boundaryNode.base.b ), new Line3( boundaryNode.base.b, boundaryNode.base.c ), new Line3( boundaryNode.base.c, q ), new Line3( q, boundaryNode.base.a ) ];
 assert.strictEqual( run( boundaryNode ), boundaryNode.points );
 const splitEdge = cell(), midpoint = new Vector3( 2, 0, 0 );
 splitEdge.boundary.splice( 0, 1, new Line3( splitEdge.base.a, midpoint ), new Line3( midpoint, splitEdge.base.b ) );
 assert.strictEqual( run( splitEdge ), splitEdge.points );
} );

test( 'synthetic nonincident corner and exterior cut do not authorize anchoring', () => {
 const nonincident = cell();nonincident.sources[ 0 ].x = 2 ** - 30;
 assert.strictEqual( run( nonincident ), nonincident.points );
 const exterior = cell();exterior.sources[ 2 ].set( 3, 3, 0 );
 assert.strictEqual( run( exterior ), exterior.points );
} );

test( 'synthetic anchored cell inside a surrounding solid is still discarded', () => {
 const c = cell(), other = new Brush( new BoxGeometry( 20, 20, 20 ) );
 other.updateMatrixWorld( true );other.prepareGeometry();
 try {
  const side = getHitSide( new Triangle( ...run( c ) ), other.geometry.boundsTree, null, c.normal );
  assert.equal( side, BACK_SIDE );assert.equal( getOperationAction( ADDITION, side, true ), SKIP_TRI );
 } finally { other.disposeCacheData();other.geometry.dispose(); }
} );
