import test from 'node:test';
import assert from 'node:assert/strict';
import { BoxGeometry, Matrix4, Vector3 } from 'three';
import { Brush, Evaluator, ADDITION, SUBTRACTION } from '../src/index.js';
import { prepareSourceFaces } from '../src/core/operations/SourceFaceProvenance.js';
import { collectIntersectingTriangles } from '../src/core/operations/operationsUtils.js';

function fixture() {
 const e = new Evaluator();e.attributes = [ 'position' ];e.useGroups = false;e.useCDTClipping = true;e.consistentCutSeams = true;
 const rotation = new Matrix4().makeRotationZ( .37 );
 const a = new Brush( new BoxGeometry( 2, 2, 2 ).applyMatrix4( rotation ) ), b = new Brush( new BoxGeometry( 2, 2, 2 ).translate( .6, .3, .2 ).applyMatrix4( rotation ) );
 return { e, a, b, inverse: rotation.clone().invert() };
}
function withinA( result, inverse ) {
 const g = result.geometry, p = new Vector3(), budget = 4 * Math.sqrt( 3 ) * 2 ** - 23;
 for ( let i = 0; i < g.drawRange.count; i ++ ) {
  p.fromBufferAttribute( g.attributes.position, g.index.getX( i ) ).applyMatrix4( inverse );
  assert.ok( Math.max( Math.abs( p.x ), Math.abs( p.y ), Math.abs( p.z ) ) <= 1 + budget );
 }
}
for ( const scale of [ [ 1, 1, 1 ], [ 2, .75, 1.5 ], [ -1, 2, .5 ] ] ) test( `equal object frames preserve support decisions exactly: ${ scale }`, () => {
 const { e, a, b, inverse } = fixture();let u, r;
 try {
  for ( const x of [ a, b ] ) { x.rotation.z = .23;x.position.set( 3, -4, 2 );x.scale.fromArray( scale );x.updateMatrixWorld( true ); }
  u = e.evaluate( a, b, ADDITION );prepareSourceFaces( u );
  const { supportStats, cutRegistry } = collectIntersectingTriangles( u, b, true );
  assert.ok( supportStats.pairs > 0, 'do not lose lineage through inverse(M) * M noise' );assert.equal( cutRegistry.unresolved, 0 );
  r = e.evaluate( u, b, SUBTRACTION );withinA( r, inverse );
 } finally { for ( const x of [ a, b, u, r ] ) if ( x ) { x.disposeCacheData();x.geometry.dispose(); }e.reset(); }
} );

// Check the intermediate output too: a later Boolean can hide an earlier defect.
test( 'a second subtraction of the same B must not create a duplicate facet', () => {
 const { e, a, b } = fixture();let u, first, second;
 try {
  a.updateMatrixWorld( true );b.updateMatrixWorld( true );
  u = e.evaluate( a, b, ADDITION );first = e.evaluate( u, b, SUBTRACTION );second = e.evaluate( first, b, SUBTRACTION );
  const g = second.geometry, seen = new Set();
  for ( let i = 0; i < g.drawRange.count; i += 3 ) {
   const key = [ 0, 1, 2 ].map( k => new Vector3().fromBufferAttribute( g.attributes.position, g.index.getX( i + k ) ).toArray().join( ',' ) ).sort().join( '|' );
   assert.ok( ! seen.has( key ), 'actual Float32 intermediate must have no duplicate facets' );seen.add( key );
  }
 } finally { for ( const x of [ a, b, u, first, second ] ) if ( x ) { x.disposeCacheData();x.geometry.dispose(); }e.reset(); }
} );

// Independently mirrored operands must preserve the bounded support construction.
// This is an ordinary passing regression, not an expected throw or repair.
test( 'independently reflected B repetition must remain bounded and equivalent, without throwing', () => {
 const { e, a, b, inverse } = fixture();let u, r;
 try {
  b.scale.x = -1;a.updateMatrixWorld( true );b.updateMatrixWorld( true );
  u = e.evaluate( a, b, ADDITION );r = e.evaluate( u, b, SUBTRACTION );withinA( r, inverse );
 } finally { for ( const x of [ a, b, u, r ] ) if ( x ) { x.disposeCacheData();x.geometry.dispose(); }e.reset(); }
} );
