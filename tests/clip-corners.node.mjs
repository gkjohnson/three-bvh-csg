import test from 'node:test';
import assert from 'node:assert/strict';
import { Triangle, Vector3 } from 'three';
import { getCoplanarIntersectionEdges } from '../src/core/utils/intersectionUtils.js';
import { exactEndpointSide } from '../src/core/utils/exactEndpointSide.js';

const tri = a => new Triangle( ...a.map( p => new Vector3( ...p ) ) );
// Binary64 support-chart witnesses from the reflected BoxGeometry recipe in
// fixtures/cut-seams/parity-cases.mjs. No recorded application geometry.
const C = [ -1.0216237306594849, 1.7906101942062376, -0.800000011920929 ];
const P = [ 0.4148052319108907, 1.2334723432177468, 0.7406916618347168 ];
const E = [ -1.7448545694351196, -0.07404442876577377, 1.2000000476837158 ];
const Q = [ -0.9197366185747644, -0.3940772876462554, 0.31499117612838745 ];
const witnesses = [
 { a: [ P, [ P[ 0 ], P[ 1 ], C[ 2 ] ], C ], b: [ [ 0.8430309891700745, 1.067379355430603, C[ 2 ] ], [ 0.8430309891700745, 1.067379355430603, E[ 2 ] ], C ], edgeA: [ P, C ], edgeB: [ [ 0.8430309891700745, 1.067379355430603, E[ 2 ] ], C ] },
 { a: [ [ C[ 0 ], C[ 1 ], E[ 2 ] ], P, C ], b: [ [ 0.8430309891700745, 1.067379355430603, E[ 2 ] ], [ C[ 0 ], C[ 1 ], E[ 2 ] ], C ], edgeA: [ P, C ], edgeB: [ [ 0.8430309891700745, 1.067379355430603, E[ 2 ] ], C ] },
 { a: [ [ E[ 0 ], E[ 1 ], C[ 2 ] ], Q, E ], b: [ [ 0.1198001429438591, -0.7972753047943115, C[ 2 ] ], [ E[ 0 ], E[ 1 ], C[ 2 ] ], E ], edgeA: [ Q, E ], edgeB: [ [ 0.1198001429438591, -0.7972753047943115, C[ 2 ] ], E ] },
 { a: [ Q, [ Q[ 0 ], Q[ 1 ], 1 ], E ], b: [ [ 0.1198001429438591, -0.7972753047943115, E[ 2 ] ], [ 0.1198001429438591, -0.7972753047943115, C[ 2 ] ], E ], edgeA: [ Q, E ], edgeB: [ [ 0.1198001429438591, -0.7972753047943115, C[ 2 ] ], E ] },
];
const edgeKey = e => e.map( p => p.join( ',' ) ).sort().join( '|' );
for ( const [ wi, w ] of witnesses.entries() ) test( `actual reflected chart pair ${wi}: endpoint is not an inner crossing in any corner order`, () => {
 for ( const reverse of [ false, true ] ) for ( let i = 0; i < 3; i ++ ) for ( let j = 0; j < 3; j ++ ) {
  const a = w.a.slice( i ).concat( w.a.slice( 0, i ) ), b = w.b.slice( j ).concat( w.b.slice( 0, j ) );
  if ( reverse ) { a.reverse();b.reverse(); }
  const lines = [], features = [];getCoplanarIntersectionEdges( tri( a ), tri( b ), lines, features );
  for ( const pair of features.flat() ) {
   const [ fa, fb ] = pair;
   if ( fa.edge !== undefined && fb.edge !== undefined ) assert.ok(
    edgeKey( [ a[ fa.edge ], a[ ( fa.edge + 1 ) % 3 ] ] ) !== edgeKey( w.edgeA ) ||
    edgeKey( [ b[ fb.edge ], b[ ( fb.edge + 1 ) % 3 ] ] ) !== edgeKey( w.edgeB ), 'no fictitious edge/edge event at the common endpoint' );
  }
  for ( let k = 0; k < lines.length; k ++ ) for ( const [ endpoint, name ] of [ 'start', 'end' ].entries() ) {
   for ( const [ side, vertices ] of [ a, b ].entries() ) {
    const f = features[ k ][ endpoint ][ side ];
    if ( f.vertex !== undefined ) assert.deepEqual( lines[ k ][ name ].toArray(), vertices[ f.vertex ], 'copy existing corner exactly' );
   }
  }
 }
} );

test( 'near but distinct endpoints and a true near-corner crossing stay distinct', () => {
 const delta = 2 ** - 30;
 const a = tri( [ [ 0, 0, 1 ], [ 2, 0, 1 ], [ 0, 2, 1 ] ] );
 const b = tri( [ [ delta, -delta, 1 ], [ delta, 1, 1 ], [ 1, -delta, 1 ] ] );
 const lines = [], features = [];getCoplanarIntersectionEdges( a, b, lines, features );
 assert.ok( features.some( ( f, i ) => f.some( ( pair, j ) => pair.every( x => x.edge !== undefined ) && lines[ i ][ j ? 'end' : 'start' ].x === delta && lines[ i ][ j ? 'end' : 'start' ].y === 0 ) ) );
 assert.ok( lines.every( l => ! l.start.equals( a.a ) && ! l.end.equals( a.a ) ) );
} );

test( 'collinear overlap remains an interval, including reversed edges', () => {
 for ( const reverse of [ false, true ] ) {
  const a = [ [ 0, 0, 1 ], [ 2, 0, 1 ], [ 0, 2, 1 ] ], b = [ [ 0, 0, 1 ], [ 1, 0, 1 ], [ 0, 1, 1 ] ];
  if ( reverse ) b.reverse();
  const lines = [];getCoplanarIntersectionEdges( tri( a ), tri( b ), lines, [] );
  assert.ok( lines.some( l => l.start.y === 0 && l.end.y === 0 && l.distance() === 1 ) );
 }
} );

test( 'shared-endpoint side predicate distinguishes exact zero and arbitrarily small nonzero sides', () => {
 const n = new Vector3( 0, 0, 1 ), a = new Vector3( 1, 1, 0 ), b = new Vector3( 2, 2, 0 );
 assert.equal( exactEndpointSide( n, a, b, new Vector3( 3, 3, 0 ) ), 0 );
 assert.equal( exactEndpointSide( n, a, b, new Vector3( 2, 2 + 2 ** - 51, 0 ) ), 1 );
 assert.equal( exactEndpointSide( n, b, a, new Vector3( 2, 2 + 2 ** - 51, 0 ) ), -1 );
} );
