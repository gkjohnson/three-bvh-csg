import test from 'node:test';
import assert from 'node:assert/strict';
import { BufferGeometry, BufferAttribute } from 'three';
import { Brush } from '../src/index.js';
const { collectIntersectingTriangles } = await import( process.env.CSG_COLLECTOR || new URL( '../src/core/operations/operationsUtils.js', import.meta.url ) );

function brush( points ) {
 const g = new BufferGeometry();g.setAttribute( 'position', new BufferAttribute( new Float32Array( points.flat() ), 3 ) );
 const b = new Brush( g );b.updateMatrixWorld( true );b.prepareGeometry();return b;
}

for ( const z of [ 2, 10000 ] ) {
 test( `coplanar shared-edge contact never emits the BVH placeholder origin, z=${ z }`, () => {
  const a = brush( [ [ 0, 0, z ], [ 1, 0, z ], [ 0, 1, z ] ] );
  const b = brush( [ [ 1, 0, z ], [ 1, 1, z ], [ 0, 1, z ] ] );
  const { aIntersections, bIntersections } = collectIntersectingTriangles( a, b, true );
  for ( const map of [ aIntersections, bIntersections ] ) {
   const edges = map.getIntersectionEdges( 0 );assert.ok( edges && edges.size > 0 );
   for ( const e of edges ) for ( const p of [ e.start, e.end ] ) {
    assert.equal( p.z, z );assert.equal( p.x + p.y, 1 );
   }
  }
  for ( const v of [ a, b ] ) { v.disposeCacheData();v.geometry.dispose(); }
 } );
}

test( 'coplanar vertex-only contact requires no invented zero-length segment at the origin', () => {
 const a = brush( [ [ 0, 0, 2 ], [ 1, 0, 2 ], [ 0, 1, 2 ] ] );
 const b = brush( [ [ 1, 0, 2 ], [ 2, 0, 2 ], [ 1, -1, 2 ] ] );
 const { aIntersections, bIntersections } = collectIntersectingTriangles( a, b, true );
 assert.equal( aIntersections.ids.length + bIntersections.ids.length, 0 );
 for ( const v of [ a, b ] ) { v.disposeCacheData();v.geometry.dispose(); }
} );
