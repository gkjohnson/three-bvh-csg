import test from 'node:test';
import assert from 'node:assert/strict';
import { BoxGeometry, BufferAttribute } from 'three';
import { Brush, Evaluator, SUBTRACTION } from '../src/index.js';

function brushes( float64 = false ) {
 const a = new Brush( new BoxGeometry() ), b = new Brush( new BoxGeometry() );
 if ( float64 ) a.geometry.setAttribute( 'position', new BufferAttribute( Float64Array.from( a.geometry.attributes.position.array ), 3 ) );
 b.position.x = .25;
 a.updateMatrixWorld( true ); b.updateMatrixWorld( true );
 return [ a, b ];
}

function dispose( operands, evaluator ) {
 for ( const brush of operands ) { brush.disposeCacheData(); brush.geometry.dispose(); }
 evaluator.reset();
}

test( 'consistent cut seams remains an explicit opt-in with a legacy default', () => {
 const evaluator = new Evaluator();
 assert.equal( evaluator.consistentCutSeams, false );
 assert.equal( evaluator.useCDTClipping, false );
 evaluator.useCDTClipping = true;
 assert.equal( evaluator.consistentCutSeams, false, 'selecting CDT alone must not activate provenance' );
} );

test( 'consistent cut seams rejects the unsupported legacy splitter rather than silently switching it', () => {
 const evaluator = new Evaluator(), operands = brushes();
 evaluator.consistentCutSeams = true;
 try {
  assert.throws( () => evaluator.evaluate( ...operands, SUBTRACTION ), /requires the constrained CDT splitter/ );
  assert.equal( evaluator.useCDTClipping, false );
 } finally { dispose( operands, evaluator ); }
} );

test( 'consistent cut seams rejects Float64 positions rather than silently quantizing input buffers', () => {
 const evaluator = new Evaluator(), operands = brushes( true );
 evaluator.useCDTClipping = true;
 evaluator.consistentCutSeams = true;
 const original = Buffer.from( operands[ 0 ].geometry.attributes.position.array.buffer ).toString( 'hex' );
 try {
  assert.throws( () => evaluator.evaluate( ...operands, SUBTRACTION ), /requires Float32 position attributes/ );
  assert.ok( operands[ 0 ].geometry.attributes.position.array instanceof Float64Array );
  assert.equal( Buffer.from( operands[ 0 ].geometry.attributes.position.array.buffer ).toString( 'hex' ), original );
 } finally { dispose( operands, evaluator ); }
} );
