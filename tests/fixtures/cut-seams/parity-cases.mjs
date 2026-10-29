// Original rotated Float32 boxes, with explicit additional OBJECT-frame controls.
// Shared public fixture for the Node regression tests; no external model data.
import { BoxGeometry, Matrix4 } from 'three';
import { Brush, Evaluator, ADDITION, SUBTRACTION, REVERSE_SUBTRACTION, INTERSECTION } from '../../../src/index.js';

export const parityCases = [
 'reflected-B', 'reflected-A', 'reflected-B-swap-union',
 'reflected-B-reverse-operation', 'reflected-B-common-nonuniform',
 'common-reflection', 'reflected-B-inverted-surfaces',
];

export function parityCase( id, capture = () => {} ) {

 const e = new Evaluator();e.attributes = [ 'position' ];e.useGroups = false;e.useCDTClipping = true;e.consistentCutSeams = true;
 const owned = new Set(), own = b => { owned.add( b );return b; };
 const rotation = new Matrix4().makeRotationZ( .37 );
 const a = own( new Brush( new BoxGeometry( 2, 2, 2 ).applyMatrix4( rotation ) ) );
 const b = own( new Brush( new BoxGeometry( 2, 2, 2 ).translate( .6, .3, .2 ).applyMatrix4( rotation ) ) );
 if ( id.startsWith( 'reflected-B' ) ) b.scale.x = -1;
 if ( id === 'reflected-A' ) a.scale.x = -1;
 if ( id === 'common-reflection' ) { a.scale.x = -1;b.scale.x = -1; }
 if ( id === 'reflected-B-common-nonuniform' ) { a.scale.set( 2, .75, 1.5 );b.scale.set( -2, .75, 1.5 ); }
 a.updateMatrixWorld( true );b.updateMatrixWorld( true );
 const close = () => { for ( const x of owned ) { x.disposeCacheData();x.geometry.dispose(); }e.reset(); };
 const evaluate = ( name, ...args ) => { const r = own( e.evaluate( ...args ) );capture( name, r );return r; };
 try {
  capture( 'input-A', a );capture( 'input-B', b );
  let u, r, d;
  if ( id === 'reflected-B-inverted-surfaces' ) {
   u = evaluate( 'intermediate', a, b, SUBTRACTION );
   r = evaluate( 'repeated', a, u, SUBTRACTION );
   d = evaluate( 'direct', a, b, INTERSECTION );
  } else {
   u = id === 'reflected-B-swap-union' ? evaluate( 'intermediate', b, a, ADDITION ) : evaluate( 'intermediate', a, b, ADDITION );
   r = id === 'reflected-B-reverse-operation' ? evaluate( 'repeated', b, u, REVERSE_SUBTRACTION ) : evaluate( 'repeated', u, b, SUBTRACTION );
   d = evaluate( 'direct', a, b, SUBTRACTION );
  }
  return { e, a, b, u, r, d, inverse: rotation.clone().invert(), close };
 } catch ( error ) { close();throw error; }

}
