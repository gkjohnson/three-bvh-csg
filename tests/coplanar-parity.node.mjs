import test from 'node:test';
import assert from 'node:assert/strict';
import { Matrix4, Vector3, Triangle } from 'three';
import { parityCases, parityCase } from './fixtures/cut-seams/parity-cases.mjs';
import { getSourceFaces } from '../src/core/operations/SourceFaceProvenance.js';

function triangles( brush ) {
 const g = brush.geometry;
 return Array.from( { length: g.drawRange.count / 3 }, ( _, i ) => [ 0, 1, 2 ].map( k => new Vector3().fromBufferAttribute( g.attributes.position, g.index.getX( 3 * i + k ) ) ) );
}
const key = t => t.map( p => p.toArray().join( ',' ) ).sort().join( '|' );
function closed( brush ) {
 const seen = new Set(), edges = new Map();let volume = 0;
 for ( const t of triangles( brush ) ) {
  assert.ok( new Triangle( ...t ).getArea() > 0 );
  assert.ok( ! seen.has( key( t ) ), 'unique actual Float32 facets' );seen.add( key( t ) );
  volume += t[ 0 ].dot( new Vector3().crossVectors( t[ 1 ], t[ 2 ] ) ) / 6;
  const points = t.map( p => p.toArray().join( ',' ) );
  for ( let i = 0; i < 3; i ++ ) {
   const a = points[ i ], b = points[ ( i + 1 ) % 3 ], k = [ a, b ].sort().join( '|' );
   if ( ! edges.has( k ) ) edges.set( k, [] );edges.get( k ).push( a < b ? 1 : -1 );
  }
 }
 for ( const directions of edges.values() ) { assert.equal( directions.length, 2 );assert.equal( directions[ 0 ] + directions[ 1 ], 0 ); }
 assert.ok( volume > 0, 'outward local winding, not double-inverted by a negative object frame' );
}

for ( const id of parityCases ) test( `coplanar material parity: ${id}`, () => {
 const f = parityCase( id );
 try {
  for ( const brush of [ f.u, f.r, f.d ] ) closed( brush );
  const toA = new Matrix4().copy( f.a.matrixWorld ).invert().multiply( f.r.matrixWorld );
  const budget = 4 * Math.sqrt( 3 ) * 2 ** -23;
  for ( const t of triangles( f.r ) ) for ( const p of t ) {
   p.applyMatrix4( toA ).applyMatrix4( f.inverse );
   assert.ok( Math.max( ...p.toArray().map( Math.abs ) ) <= 1 + budget, 'repeated difference/intersection must stay within A' );
  }
 } finally { f.close(); }
} );

test( 'actual A38/B11 witness is present in reflected U but not falsely kept in U minus B', () => {
 const f = parityCase( 'reflected-B' );
 try {
  // Fixed witness from the procedural reflected-B BoxGeometry recipe above.
  const witness = [
   [ -1.7448545694351196, -0.07404442876577377, -0.800000011920929 ],
   [ -1.1462674140930176, 0.1899709552526474, -0.800000011920929 ],
   [ -0.9197366237640381, -0.3940773010253906, -0.800000011920929 ],
  ].map( p => new Vector3( ...p ) );
  assert.equal( key( triangles( f.u )[ 38 ] ), key( witness ) );
  const face = getSourceFaces( f.u.geometry )[ 38 ];
  assert.equal( face.source.triangle, 11 );assert.equal( face.orientation, -1 );
  assert.equal( new Matrix4().fromArray( face.frame ).determinant(), -1 );
  assert.ok( ! triangles( f.r ).some( t => key( t ) === key( witness ) ) );
 } finally { f.close(); }
} );
