import test from 'node:test';
import assert from 'node:assert/strict';
import { Triangle, Vector3 } from 'three';
import { isFloat32TriangleDegenerate as degenerate } from '../src/core/utils/isFloat32TriangleDegenerate.js';
const triangle = points => new Triangle( ...points.map( p => new Vector3( ...p ) ) );

// Independent binary64 integer reference, not the Float32 decoding under test.
const view = new DataView( new ArrayBuffer( 8 ) );
function integer64( x ) {
 view.setFloat64( 0, x );const b = view.getBigUint64( 0 ), e = Number( b >> 52n & 2047n );
 return ( b >> 63n ? -1n : 1n ) * ( ( b & 0xfffffffffffffn ) | ( e ? 0x10000000000000n : 0n ) ) << BigInt( e ? e - 1 : 0 );
}
function reference( points ) {
 const [ a, b, c ] = points.map( p => p.map( integer64 ) ),u = b.map( ( x, i ) => x - a[ i ] ),v = c.map( ( x, i ) => x - a[ i ] );
 return [ 0, 1, 2 ].every( k => u[ k ] * v[ ( k + 1 ) % 3 ] === u[ ( k + 1 ) % 3 ] * v[ k ] );
}


test( 'short edges, tiny angles, subnormals and maximal Float32 ranges are not zero area', () => {
 const max = ( 2 - 2 ** -23 ) * 2 ** 127, tiny = 2 ** -149;
 for ( const points of [
  [[0,0,0],[tiny,0,0],[0,tiny,0]],
  [[-max,0,0],[max,0,0],[0,tiny,0]],
  [[0,0,0],[1,0,0],[1,2**-100,0]],
  [[2**100,2**100,0],[0,0,0],[1,2,0]], // Double cross product cancels to zero.
  [[1,1,1],[1+2**-23,1,1],[1,1+2**-23,1]],
 ] ) { assert.equal( reference( points ), false );assert.equal( degenerate( triangle( points ) ), false ); }
} );

test( 'exact collinearity and repeated corners remain degenerate, including signed zero', () => {
 for ( const points of [
  [[0,0,0],[-0,0,-0],[1,2,3]],
  [[0,0,0],[1,2,3],[2,4,6]],
  [[2**100,2**100,2**100],[0,0,0],[1,1,1]],
  [[0,0,0],[2**-149,2**-149,0],[2**-148,2**-148,0]],
 ] ) { assert.equal( reference( points ), true );assert.equal( degenerate( triangle( points ) ), true ); }
} );

test( 'nonfinite or non-Float32 coordinates are rejected, not rounded or repaired', () => {
 for ( const value of [ NaN, Infinity, -Infinity, 0.1, 2 ** -150, 2 ** 128 ] ) {
  assert.throws( () => degenerate( triangle( [[value,0,0],[0,1,0],[0,0,1]] ) ), RangeError );
 }
} );

test( 'filtered predicate agrees with independent exact arithmetic across Float32 exponent ranges', () => {
 let state = 0x6c8e9cf5;const next = () => ( state = ( Math.imul( state, 1664525 ) + 1013904223 ) >>> 0 );
 const u = new Uint32Array( 1 ),f = new Float32Array( u.buffer );
 const value = () => { do { u[ 0 ] = next(); } while ( ! Number.isFinite( f[ 0 ] ) );return f[ 0 ]; };
 for ( let i = 0; i < 3000; i ++ ) {
  const p = Array.from( { length: 3 }, () => Array.from( { length: 3 }, value ) );
  if ( i % 3 === 0 ) p[ 2 ] = p[ 0 ].slice();
  if ( i % 3 === 1 ) { const x = [value(),value(),value()];for ( let j = 0; j < 3; j ++ ) p[ j ] = [x[j],x[j],x[j]]; }
  assert.equal( degenerate( triangle( p ) ), reference( p ), JSON.stringify( p ) );
 }
} );
