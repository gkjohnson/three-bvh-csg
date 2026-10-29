import test from 'node:test';
import assert from 'node:assert/strict';
import { BoxGeometry, BufferGeometry, BufferAttribute, Matrix4, Triangle, Vector3 } from 'three';
import { Brush, Evaluator, ADDITION } from '../src/index.js';
import { IntersectionMap } from '../src/core/IntersectionMap.js';
import { getCoplanarIntersectionEdges } from '../src/core/utils/intersectionUtils.js';
import { CutPointRegistry, halfFloat32Ulp } from '../src/core/operations/CutPointRegistry.js';
import { prepareSourceFaces, getSourceFaces, sameInvertibleFrame } from '../src/core/operations/SourceFaceProvenance.js';
import { sourceSupportOverlay } from '../src/core/operations/SourceSupportOverlay.js';
import { collectIntersectingTriangles } from '../src/core/operations/operationsUtils.js';

const tri = points => new Triangle( ...points.map( p => new Vector3( ...p ) ) );
function brush( points ) {
 const geometry = new BufferGeometry();geometry.setAttribute( 'position', new BufferAttribute( new Float32Array( points.flat( 2 ) ), 3 ) );
 const b = new Brush( geometry );b.updateMatrixWorld( true );return b;
}
const square = [ [ [ 1, 1, 2 ], [ 3, 1, 2 ], [ 3, 3, 2 ] ], [ [ 1, 1, 2 ], [ 3, 3, 2 ], [ 1, 3, 2 ] ] ];
const cutters = [ [ [ 1, 2, 2 ], [ 3, 2, 2 ], [ 2, 4, 2 ] ], [ [ 1, 2, 2 ], [ 2, 0, 2 ], [ 3, 2, 2 ] ] ];
function boxes() {
 const e = new Evaluator();e.attributes = [ 'position' ];e.useGroups = false;e.useCDTClipping = true;e.consistentCutSeams = true;
 const rotation = new Matrix4().makeRotationZ( .37 );
 const a = new Brush( new BoxGeometry( 2, 2, 2 ).applyMatrix4( rotation ) );
 const b = new Brush( new BoxGeometry( 2, 2, 2 ).translate( .6, .3, .2 ).applyMatrix4( rotation ) );
 a.updateMatrixWorld( true );b.updateMatrixWorld( true );
 const u = e.evaluate( a, b, ADDITION );prepareSourceFaces( u );
 return { e, a, b, u, close() { for ( const x of [ a, b, u ] ) { x.disposeCacheData();x.geometry.dispose(); }e.reset(); } };
}

test( 'coplanar clipping reports source corners and limiting edges without changing the segments', () => {
 const a = tri( square[ 0 ] ), b = tri( cutters[ 0 ] ), ordinary = [], tagged = [], features = [];
 const n = getCoplanarIntersectionEdges( a, b, ordinary );assert.equal( getCoplanarIntersectionEdges( a, b, tagged, features ), n );
 assert.ok( n > 0 );
 for ( let i = 0; i < n; i ++ ) {
  assert.ok( ordinary[ i ].equals( tagged[ i ] ) );
  for ( const endpoint of features[ i ] ) {
   assert.ok( endpoint.some( f => f.vertex !== undefined || f.edge !== undefined ), 'no featureless face/face event' );
   for ( const f of endpoint ) for ( const value of Object.values( f ) ) assert.ok( Number.isInteger( value ) && value >= 0 && value < 3 );
  }
 }
 assert.ok( features.flat().some( p => p.some( f => f.vertex !== undefined ) ) );
 assert.ok( features.flat().some( p => p.every( f => f.edge !== undefined ) ) );
} );

test( 'known vertex has one node across faces; no positional feature rediscovery and no changed source bytes', () => {
 const a = brush( square ), b = brush( cutters ), before = a.geometry.attributes.position.array.slice();
 const r = new CutPointRegistry( a, b );
 r.a.feature = r.b.feature = () => { throw Error( 'must use explicit clip incidence' ); };
 const construction = new Vector3( 1 + halfFloat32Ulp( 1 ) / 4, 1, 2 );
 const p = r.register( construction, 0, 0, true, [ { vertex: 0 }, {} ] );
 const q = r.register( construction, 1, 1, true, [ { vertex: 0 }, {} ] );
 assert.strictEqual( p, q );assert.strictEqual( p, r.a.vertices[ r.a.faces[ 0 ][ 0 ] ] );
 const am = new IntersectionMap(), bm = new IntersectionMap();r.propagate( am, bm );
 const output = r.materialize( p );assert.deepEqual( output.toArray(), [ 1, 1, 2 ] );
 assert.ok( am.boundaryPoints.get( 0 ).has( output ) && am.boundaryPoints.get( 1 ).has( output ) );
 assert.deepEqual( a.geometry.attributes.position.array, before );assert.ok( r.maxSupportOutputUlpRatio <= 1 );
} );

test( 'new edge/edge event is canonical and propagates the same output object to both edge stars', () => {
 const a = brush( square ), b = brush( cutters ), r = new CutPointRegistry( a, b );
 const p = r.register( new Vector3( 2, 2, 2 ), 0, 0, true, [ { edge: 2 }, { edge: 0 } ] );
 const q = r.register( new Vector3( 2, 2, 2 ), 1, 1, true, [ { edge: 0 }, { edge: 2 } ] );
 assert.strictEqual( p, q );
 const am = new IntersectionMap(), bm = new IntersectionMap();r.propagate( am, bm );
 const output = r.materialize( p );
 for ( const map of [ am, bm ] ) for ( const id of [ 0, 1 ] ) {
  assert.ok( map.boundaryPoints.get( id ).has( output ) );
  assert.ok( map.boundaryEdges.get( id ).some( edge => edge.start === output || edge.end === output ) );
 }
} );

test( 'support output bound is enforced, not just measured; invalid feature incidence is rejected', () => {
 const r = new CutPointRegistry( brush( square ), brush( cutters ) );
 assert.throws( () => r.register( new Vector3( 1, 1, 2 ), 0, 0, true, [ { vertex: 3 }, {} ] ), /Invalid clipping feature/ );
 assert.throws( () => r.register( new Vector3( 1, 1, 2 ), 0, 0, true, [ {}, {} ] ), /Unresolved explicit clipping/ );
 r.register( new Vector3( 1.001, 1, 2 ), 0, 0, true, [ { vertex: 0 }, {} ] );
 assert.throws( () => r.propagate( new IntersectionMap(), new IntersectionMap() ), /exceeds one Float32 ULP/ );
} );

test( 'support chart requires genuine source identity, bounded projection, and noncollapsed triangles', () => {
 const a = brush( [ [ [ 0, 0, 1 ], [ 10, 0, 1 ], [ 0, 10, 1 ] ] ] );
 const face = prepareSourceFaces( a )[ 0 ], matrix = new Matrix4();
 const x = tri( [ [ 1, 1, 1 ], [ 2, 1, 1 ], [ 1, 2, 1 ] ] ), y = x.clone();
 assert.ok( sourceSupportOverlay( x, y, face, matrix, face, matrix ) );
 const distinct = { ...face, source: { ...face.source } };
 assert.equal( sourceSupportOverlay( x, y, face, matrix, distinct, matrix ), null );
 for ( const p of [ y.a, y.b, y.c ] ) p.z += 2 ** - 20;
 assert.equal( sourceSupportOverlay( x, y, face, matrix, face, matrix ), null, 'no generous plane snap' );
 const collapsed = tri( [ [ 1, 1, 1 ], [ 2, 1, 1 ], [ 3, 1, 1 ] ] );
 assert.equal( sourceSupportOverlay( x, collapsed, face, matrix, face, matrix ), null );
} );

test( 'relative identity shortcut rejects singular, nonfinite and merely close frames', () => {
 const a = new Matrix4(), b = new Matrix4();assert.ok( sameInvertibleFrame( a, b ) );
 b.elements[ 12 ] = 1e-12;assert.equal( sameInvertibleFrame( a, b ), false );
 const singular = new Matrix4().makeScale( 0, 1, 1 );assert.equal( sameInvertibleFrame( singular, singular ), false );
 const invalid = new Matrix4();invalid.elements[ 12 ] = Infinity;assert.equal( sameInvertibleFrame( invalid, invalid ), false );
} );

test( 'same supporting source is not a finite-overlap predicate', () => {
 const a = brush( [ [ [ 0, 0, 1 ], [ 10, 0, 1 ], [ 0, 10, 1 ] ] ] );
 const face = prepareSourceFaces( a )[ 0 ], matrix = new Matrix4();
 const x = tri( [ [ 1, 1, 1 ], [ 2, 1, 1 ], [ 1, 2, 1 ] ] ), y = tri( [ [ 4, 1, 1 ], [ 5, 1, 1 ], [ 4, 2, 1 ] ] );
 const support = sourceSupportOverlay( x, y, face, matrix, face, matrix );assert.ok( support );
 assert.equal( getCoplanarIntersectionEdges( support.a, support.b, [], [] ), 0 );
} );

test( 'all 32 former box face/face registrations are existing vertices by clip provenance; all incidences share output', () => {
 const fixture = boxes(), { u, b } = fixture;
 const oldRegister = CutPointRegistry.prototype.register, witnessed = [];
 CutPointRegistry.prototype.register = function( point, ia, ib, coplanar, features ) {
  if ( features && this.a.feature( ia, point ).face !== undefined && this.b.feature( ib, point ).face !== undefined ) witnessed.push( features );
  return oldRegister.call( this, point, ia, ib, coplanar, features );
 };
 let result;
 try { result = collectIntersectingTriangles( u, b, true ); } finally { CutPointRegistry.prototype.register = oldRegister;fixture.close(); }
 const { cutRegistry: r, supportStats: s, aIntersections: am, bIntersections: bm } = result;
 assert.equal( witnessed.length, 32 );assert.ok( witnessed.every( f => f[ 0 ].vertex !== undefined ) );
 assert.equal( r.unresolved, 0 );assert.ok( s.pairs > 0 );assert.ok( s.maxHalfUlpRatio <= 1 && r.maxSupportOutputUlpRatio <= 1 );
 for ( const [ topology, map ] of [ [ r.a, am ], [ r.b, bm ] ] ) for ( const [ id, points ] of topology.cuts ) for ( const p of points ) {
  assert.ok( map.boundaryPoints.get( id ).has( r.materialize( p ) ) );
 }
} );

for ( const [ name, edit ] of [
 [ 'different transform', f => { f.b.position.x += 1e-12;f.b.updateMatrixWorld( true ); } ],
 [ 'geometry clone', f => { f.b.geometry = f.b.geometry.clone();prepareSourceFaces( f.b ); } ],
 [ 'unversioned position edit', f => { f.b.geometry.attributes.position.array[ 0 ] += .125;prepareSourceFaces( f.b ); } ],
 [ 'version-only edit', f => { f.b.geometry.attributes.position.needsUpdate = true;prepareSourceFaces( f.b ); } ],
] ) test( `no source-support override after ${ name }`, () => {
 const f = boxes();edit( f );try { assert.equal( collectIntersectingTriangles( f.u, f.b, true ).supportStats.pairs, 0 ); } finally { f.close(); }
} );

test( 'coplanar support classification uses the same projected finite triangle as the collector on either side', () => {
 const f = boxes();try {
  const { aIntersections: am, bIntersections: bm } = collectIntersectingTriangles( f.u, f.b, true );
  const faces = getSourceFaces( f.u.geometry ), roots = getSourceFaces( f.b.geometry );
  for ( const [ ia, pairs ] of am.supportCoplanars ) for ( const [ ib, p ] of pairs ) {
   assert.strictEqual( faces[ ia ].source, roots[ ib ].source );
   assert.strictEqual( p.plane, bm.supportCoplanars.get( ib ).get( ia ).plane );
   for ( const corner of [ p.triangle.a, p.triangle.b, p.triangle.c ] ) assert.ok( Math.abs( p.plane.distanceToPoint( corner ) ) < 1e-14 );
  }
 } finally { f.close(); }
} );
