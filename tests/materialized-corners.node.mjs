import test from 'node:test';
import assert from 'node:assert/strict';
import { BufferGeometry, BufferAttribute, Vector3, Line3 } from 'three';
import { Brush } from '../src/index.js';
import { CutPointRegistry } from '../src/core/operations/CutPointRegistry.js';
import { collectIntersectingTriangles } from '../src/core/operations/operationsUtils.js';
import { parityCase } from './fixtures/cut-seams/parity-cases.mjs';

// Second-operation witnesses from the procedural reflected-B inverted box
// history below. Q is a distinct construction event; only its output equals C.
const Q = [ -0.9197365993493496, -0.3940773104949483, 1 ];
const C = [ -0.9197366237640381, -0.3940773010253906, 1 ];
const P = [ C[ 0 ], -0.394077330827713, 1 ];
const F = [ -0.5707119107246399, -1.2939428091049194, 1 ];
const T = [ -0.282779335975647, -0.6411295533180237, 1 ];
const S = [ C[ 0 ], C[ 1 ], 0.31499117612838745 ];
const distant = [ [ 100, 0, 0 ], [ 100, 1, 0 ], [ 100, 0, 1 ] ];
function brush( faces ) {
 const geometry = new BufferGeometry();
 geometry.setAttribute( 'position', new BufferAttribute( Float32Array.from( faces.flat( 2 ) ), 3 ) );
 const b = new Brush( geometry );b.updateMatrixWorld( true );return b;
}
function close( brushes ) { for ( const b of brushes ) { b.disposeCacheData();b.geometry.dispose(); } }

test( 'actual Q already rounds to C: another edge projection must not manufacture P', () => {
 assert.deepEqual( Q.map( Math.fround ), C );
 const projection = new Line3( new Vector3( ...F ), new Vector3( ...C ) ).closestPointToPoint( new Vector3( ...Q ), true, new Vector3() );
 assert.deepEqual( projection.toArray().map( Math.fround ), P );
 // Both operand positions, cyclic corner orders, and reversed face winding.
 for ( const side of [ 'a', 'b' ] ) for ( const order of [ [ 0, 1, 2 ], [ 1, 2, 0 ], [ 2, 0, 1 ], [ 0, 2, 1 ] ] ) {
  const faces = [ [ C, F, T ], [ F, C, S ] ].map( f => order.map( i => f[ i ] ) );
  const bs = side === 'a' ? [ brush( faces ), brush( [ distant ] ) ] : [ brush( [ distant ] ), brush( faces ) ];
  try {
   const r = new CutPointRegistry( ...bs ), p = new Vector3( ...Q );
   for ( let i = 0; i < 2; i ++ ) r[ side ].addToStar( { face: i }, p );
   const output = r.materialize( p );
   assert.ok( ! r[ side ].vertices.includes( p ), 'do not identify distinct construction events' );
   r.resolveRoundingCollapses();
   assert.strictEqual( r.materialize( p ), output );
   assert.deepEqual( output.toArray(), C );
   assert.deepEqual( p.toArray(), Q, 'retain the construction preimage' );
   assert.strictEqual( output.sourcePoint, p );
  } finally { close( bs ); }
 }
} );

test( 'a later opposite-operand corner protects an earlier edge-band candidate', () => {
 // Q is near the line F-C but C is NOT a corner of this first face.
 // The opposite incident face supplies the proof of existing corner output.
 const bs = [ brush( [ [ F, C.map( ( x, k ) => 2 * x - F[ k ] ), T ] ] ), brush( [ [ C, F, T ] ] ) ];
 try {
  const r = new CutPointRegistry( ...bs ), p = new Vector3( ...Q );
  r.a.addToStar( { face: 0 }, p );r.b.addToStar( { face: 0 }, p );
  const output = r.materialize( p );r.resolveRoundingCollapses();
  assert.deepEqual( output.toArray(), C );
 } finally { close( bs ); }
} );


test( 'actual inverted history retains separate Q/C preimages and common corner output', () => {
 const f = parityCase( 'reflected-B-inverted-surfaces' );
 try {
  const { cutRegistry: r, bIntersections } = collectIntersectingTriangles( f.a, f.u, true );
  const p = r.points.get( 'ae5_7|be25_27' ), corner = r.b.vertices[ 27 ];
  assert.deepEqual( p.toArray(), Q );assert.deepEqual( corner.toArray(), C );
  assert.notStrictEqual( p, corner );
  assert.deepEqual( r.materialize( p ).toArray(), C );
  assert.deepEqual( r.materialize( corner ).toArray(), C );
  assert.ok( r.supportPreimages.get( p ).length >= 2 );
  assert.ok( r.maxSupportOutputUlpRatio <= 1 );
  const boundary = bIntersections.boundaryEdges.get( 55 );
  assert.deepEqual( boundary.map( e => [ e.start.toArray(), e.end.toArray() ] ), [ [ S, C ], [ C, T ], [ T, S ] ] );
 } finally { f.close(); }
} );
