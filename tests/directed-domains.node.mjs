import test from 'node:test';
import assert from 'node:assert/strict';
import { BoxGeometry, Matrix4, Vector3, Triangle, Line3 } from 'three';
import { Brush, Evaluator, ADDITION, SUBTRACTION, CDTTriangleSplitter } from '../src/index.js';
import { directedDomain } from '../src/core/utils/directedDomain.js';
import { prepareSourceFaces } from '../src/core/operations/SourceFaceProvenance.js';
import { collectIntersectingTriangles } from '../src/core/operations/operationsUtils.js';

const point = p => new Vector3( ...p, 0 );
const edges = p => p.map( ( a, i ) => new Line3( point( a ), point( p[ ( i + 1 ) % p.length ] ) ) );
// Binary Float32 boundary witnesses from the rotated BoxGeometry history below.
// Zero-length consecutive segments are omitted (zero winding exactly).
const C = [ -0.45484820008277893, 0.8961657881736755 ];
const P = [ -0.45484817028045654, 0.8961657881736755 ];
const S = [ 0.6785271763801575, 0.3962744474411011 ];
const Q = [ 0.9684889316558838, 0.2683826982975006 ];
const D = [ 0.6430349946022034, 1.1074773073196411 ];
const V = [ -0.1198001429438591, -0.7972753047943115 ];

test( 'actual R2 C/P/S cell belongs to A27, not the backtracking A30 domain', () => {
 const points = [ C, P, S ], cells = [ [ 0, 1, 2 ] ];
 assert.deepEqual( directedDomain( cells, points, edges( [ V, Q, S, P, C ] ) ), cells );
 assert.deepEqual( directedDomain( cells, points, edges( [ Q, D, P, C, P, S ] ) ), [] );
} );

test( 'a closed internal constraint remains filled, and splitter reset drops boundary roles', () => {
 const splitter = new CDTTriangleSplitter();splitter.useSharedConstraints = true;splitter.float32Output = true;
 const base = new Triangle( point( [ 0, 0 ] ), point( [ 8, 0 ] ), point( [ 0, 8 ] ) );
 splitter.initialize( base );
 for ( const edge of edges( [ [ 1, 1 ], [ 2, 1 ], [ 1, 2 ] ] ) ) splitter.addConstraintEdge( edge );
 splitter.triangulate();
 assert.equal( splitter.triangles.reduce( ( sum, t ) => sum + t.getArea(), 0 ), 32 );
 assert.ok( splitter.triangles.some( t => t.getMidpoint( new Vector3() ).equals( point( [ 4 / 3, 4 / 3 ] ) ) ) );
 splitter.reset();assert.equal( splitter.boundaryEdges.length, 0 );
} );

function fixture() {
 const e = new Evaluator();e.attributes = [ 'position' ];e.useGroups = false;e.useCDTClipping = true;e.consistentCutSeams = true;
 const rotation = new Matrix4().makeRotationZ( .37 );
 const a = new Brush( new BoxGeometry( 2, 2, 2 ).applyMatrix4( rotation ) );
 const b = new Brush( new BoxGeometry( 2, 2, 2 ).translate( .6, .3, .2 ).applyMatrix4( rotation ) );
 a.updateMatrixWorld( true );b.updateMatrixWorld( true );
 return { e, a, b };
}
function closed( g ) {
 const seen = new Set(), incidence = new Map();
 for ( let i = 0; i < g.drawRange.count; i += 3 ) {
  const points = [ 0, 1, 2 ].map( k => new Vector3().fromBufferAttribute( g.attributes.position, g.index.getX( i + k ) ) );
  assert.ok( new Triangle( ...points ).getArea() > 0 );
  const keys = points.map( p => p.toArray().join( ',' ) ), face = keys.slice().sort().join( '|' );
  assert.ok( ! seen.has( face ), 'no duplicate anywhere in the complete intermediate' );seen.add( face );
  for ( let k = 0; k < 3; k ++ ) {
   const a = keys[ k ], b = keys[ ( k + 1 ) % 3 ], key = [ a, b ].sort().join( '|' );
   if ( ! incidence.has( key ) ) incidence.set( key, [] );incidence.get( key ).push( a < b ? 1 : -1 );
  }
 }
 for ( const directions of incidence.values() ) { assert.equal( directions.length, 2, 'no boundary or overused edge in the whole cluster' );assert.equal( directions[ 0 ] + directions[ 1 ], 0 ); }
}

test( 'original Float32 history: every U/R1/R2/R3/D intermediate is closed, oriented and unique', () => {
 const { e, a, b } = fixture(), owned = [ a, b ];
 try {
  let r = e.evaluate( a, b, ADDITION );owned.push( r );closed( r.geometry );
  for ( let i = 0; i < 3; i ++ ) { r = e.evaluate( r, b, SUBTRACTION );owned.push( r );closed( r.geometry ); }
  r = e.evaluate( a, b, SUBTRACTION );owned.push( r );closed( r.geometry );
 } finally { for ( const x of owned ) { x.disposeCacheData();x.geometry.dispose(); }e.reset(); }
} );

test( 'R2 canonical current-edge partitions reverse exactly at neighbors after contraction', () => {
 const { e, a, b } = fixture(), owned = [ a, b ];
 try {
  const u = e.evaluate( a, b, ADDITION );owned.push( u );
  const r = e.evaluate( u, b, SUBTRACTION );owned.push( r );prepareSourceFaces( r );
  const { cutRegistry: registry } = collectIntersectingTriangles( r, b, true );
  for ( const topology of [ registry.a, registry.b ] ) for ( const [ key, partition ] of topology.partitions ) {
   const { nodes, faces } = partition;
   assert.deepEqual( faces, topology.edges.get( key ).faces );
   for ( let i = 1; i < nodes.length; i ++ ) assert.ok( nodes[ i - 1 ].parameter <= nodes[ i ].parameter );
   for ( const node of nodes ) assert.strictEqual( node.output, registry.materialize( node.point ) );
   if ( faces.length === 2 ) {
    const [ low, high ] = key.split( '_' ).map( Number );
    const direction = face => { const ids = topology.faces[ face ], i = ids.indexOf( low );return ids[ ( i + 1 ) % 3 ] === high ? 1 : -1; };
    assert.equal( direction( faces[ 0 ] ) + direction( faces[ 1 ] ), 0 );
   }
  }
  assert.ok( registry.a.partitions.has( '8_11' ) && registry.a.partitions.has( '8_13' ) && registry.a.partitions.has( '8_10' ) );
 } finally { for ( const x of owned ) { x.disposeCacheData();x.geometry.dispose(); }e.reset(); }
} );
