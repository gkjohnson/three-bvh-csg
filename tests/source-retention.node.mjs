// Run explicitly: node --expose-gc --test tests/source-retention.node.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { setImmediate } from 'node:timers/promises';
import { BoxGeometry } from 'three';
import { Brush, Evaluator, ADDITION, SUBTRACTION } from '../src/index.js';
import { getSourceFaces, sourceFaceStats } from '../src/core/operations/SourceFaceProvenance.js';

test( 'live descendant provenance does not keep old Brushes or Geometries alive across repeated operations', async () => {
 assert.equal( typeof global.gc, 'function', 'this retention test requires --expose-gc, not a skipped gate' );
 function run() {
  const evaluator = new Evaluator();evaluator.attributes = [ 'position' ];evaluator.useGroups = false;evaluator.useCDTClipping = true;evaluator.consistentCutSeams = true;
  let result = new Brush( new BoxGeometry( 2, 2, 2 ) );result.updateMatrixWorld( true );
  const refs = [], counts = [];
  for ( let i = 0; i < 8; i ++ ) {
   const b = new Brush( new BoxGeometry().translate( 4 + i, 0, 0 ) );b.updateMatrixWorld( true );
   const union = evaluator.evaluate( result, b, ADDITION );
   const next = evaluator.evaluate( union, b, SUBTRACTION );
   for ( const value of [ result, b, union ] ) { refs.push( new WeakRef( value ), new WeakRef( value.geometry ) );value.geometry.dispose(); }
   result = next;counts.push( sourceFaceStats( result.geometry ) );
  }
  return { result, evaluator, refs, counts };
 }
 const { result, evaluator, refs, counts } = run();
 // Allow weak targets to leave their creation job before requesting collection.
 for ( let i = 0; i < 8; i ++ ) { await setImmediate();global.gc(); }
 assert.equal( refs.filter( ref => ref.deref() ).length, 0, 'no source/intermediate mesh hierarchy retained' );
 assert.ok( getSourceFaces( result.geometry ).length > 0 );
 assert.ok( evaluator.geometryBuilders.every( builder => builder.sourceFaces === null ) );
 assert.ok( counts.every( c => c.sources === 12 && c.faces === 12 ), 'retained sources depend on surviving geometry, not operation history length' );
 console.log( JSON.stringify( { collectedBrushesAndGeometries: refs.length, iterations: counts.length, last: counts.at( -1 ) } ) );
 result.geometry.dispose();evaluator.reset();
} );
