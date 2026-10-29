import test from 'node:test';
import assert from 'node:assert/strict';
import { halfFloat32Ulp } from '../src/core/operations/CutPointRegistry.js';

test( 'half-ULP budget is derived from the coordinate representation, including zero and binades', () => {
 assert.equal( halfFloat32Ulp( 0 ), 2 ** -150 );
 assert.equal( halfFloat32Ulp( 2 ** -149 ), 2 ** -150 );
 assert.equal( halfFloat32Ulp( 3 ), 2 ** -23 );
 assert.equal( halfFloat32Ulp( -3 ), 2 ** -23 );
 assert.equal( halfFloat32Ulp( 5 ), 2 ** -22 );
 assert.equal( halfFloat32Ulp( 4 ), 2 ** -23 ); // smaller neighboring binade
 assert.throws( () => halfFloat32Ulp( Infinity ), RangeError );
 assert.throws( () => halfFloat32Ulp( NaN ), RangeError );
} );
