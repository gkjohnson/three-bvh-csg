import test from 'node:test';
import assert from 'node:assert/strict';
import { Triangle, Vector3 } from 'three';
import { finiteTriangleContains } from '../src/core/utils/finiteTriangleContains.js';

// Actual A9/B36 coplanar-test bytes, neutral observer 2dQFwB, reverse/repeated.
const corners = [
 [ -0.1198001429438591, -0.7972753047943115, 1.2000000476837158 ],
 [ 1.7448545694351196, -0.07404442876577377, 1.2000000476837158 ],
 [ 1.0216237306594849, 1.7906101942062378, 1.2000000476837158 ],
];
const midpoint = [ 1.1233029867216717, -0.3151213920654583, 1.2000000476837158 ];
const tri = values => new Triangle( ...values.map( p => new Vector3( ...p ) ) );

test( 'actual reverse seed: rounded Gram test misses strictly finite interior', () => {
 const t = tri( corners ), p = new Vector3( ...midpoint );
 assert.equal( t.containsPoint( p ), false );
 assert.equal( finiteTriangleContains( t, p ), true );
 // Independent rational analysis: smallest barycentric is +4.879257310629261e-17.
 for ( const order of [ [ 0, 1, 2 ], [ 1, 2, 0 ], [ 2, 0, 1 ], [ 0, 2, 1 ] ] ) {
  for ( const reflection of [ 1, -1 ] ) {
   const transform = p => [ reflection * p[ 0 ], p[ 1 ], p[ 2 ] ];
   assert.equal( finiteTriangleContains( tri( order.map( i => transform( corners[ i ] ) ) ), new Vector3( ...transform( midpoint ) ) ), true );
  }
 }
} );

test( 'actual reverse seed: representably exterior neighbor stays outside', () => {
 const p = new Vector3( ...midpoint );p.y -= 2 ** -53;
 assert.equal( finiteTriangleContains( tri( corners ), p ), false );
 // The actual materialized sliver centroid is outside too. Source preimage
 // classification is deliberately not replaced by output-coordinate testing.
 const q = corners[ 1 ].slice();q[ 1 ] = -0.07404444366693497;
 const outputMidpoint = tri( [ corners[ 0 ], q, corners[ 1 ] ] ).getMidpoint( new Vector3() );
 assert.equal( finiteTriangleContains( tri( corners ), outputMidpoint ), false );
} );

test( 'finite edges/corners included, collinear extension and near exterior excluded', () => {
 const t = tri( [ [ 0, 0, 0 ], [ 1, 0, 0 ], [ 0, 1, 0 ] ] );
 for ( const p of [ [ 0, 0, 0 ], [ 1, 0, 0 ], [ .5, .5, 0 ], [ .5, 0, 0 ], [ .25, .25, 0 ] ] ) assert.equal( finiteTriangleContains( t, new Vector3( ...p ) ), true );
 for ( const p of [ [ -.5, 0, 0 ], [ 1 + 2 ** -52, 0, 0 ], [ .5, -Number.MIN_VALUE, 0 ], [ .5, .5 + 2 ** -53, 0 ] ] ) assert.equal( finiteTriangleContains( t, new Vector3( ...p ) ), false );
} );

test( 'thin finite triangle does not lose its domain through squared Gram cancellation', () => {
 const t = tri( [ [ 0, 0, 0 ], [ 1, 1, 0 ], [ 1, 1 + 2 ** -50, 0 ] ] );
 assert.equal( finiteTriangleContains( t, new Vector3( .75, .75 + 2 ** -52, 0 ) ), true );
 assert.equal( finiteTriangleContains( t, new Vector3( .75, .75 - 2 ** -52, 0 ) ), false );
 assert.equal( finiteTriangleContains( tri( [ [ 0, 0, 0 ], [ 1, 1, 1 ], [ 2, 2, 2 ] ] ), new Vector3( 1, 1, 1 ) ), false );
} );

test( 'orthogonal projection semantics, not an independent plane-coincidence claim', () => {
 const t = tri( [ [ 0, 0, 0 ], [ 1, 0, 1 ], [ 0, 1, 0 ] ] );
 assert.equal( finiteTriangleContains( t, new Vector3( -.75, .25, 1.25 ) ), true );
 assert.equal( finiteTriangleContains( t, new Vector3( -1.25, .25, .75 ) ), false );
 assert.throws( () => finiteTriangleContains( t, new Vector3( Infinity, 0, 0 ) ), RangeError );
} );
