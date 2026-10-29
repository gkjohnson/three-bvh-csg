import test from 'node:test';
import assert from 'node:assert/strict';
import { BufferGeometry, BufferAttribute, BoxGeometry, Vector3, Triangle, Matrix4 } from 'three';
import { Brush, Evaluator, CDTTriangleSplitter, ADDITION, SUBTRACTION } from '../src/index.js';
import { CutPointRegistry } from '../src/core/operations/CutPointRegistry.js';
import { collectIntersectingTriangles } from '../src/core/operations/operationsUtils.js';
import { IntersectionMap } from '../src/core/IntersectionMap.js';

const key = p => p.toArray().map( Math.fround ).join( ',' );
function brush( triangles ) {
 const geometry = new BufferGeometry();
 geometry.setAttribute( 'position', new BufferAttribute( new Float32Array( triangles.flat( 2 ) ), 3 ) );
 const result = new Brush( geometry );result.updateMatrixWorld( true );return result;
}
function triangulate( tri, map, id ) {
 const s = new CDTTriangleSplitter();s.useSharedConstraints = true;s.float32Output = true;
 s.initialize( tri );
 if ( map.boundaryEdges?.has( id ) ) { s.constrainedEdges.length = 0;for ( const e of map.boundaryEdges.get( id ) ) s.addConstraintEdge( e ); }
 for ( const e of map.getIntersectionEdges( id ) || [] ) s.addConstraintEdge( e );
 for ( const p of map.boundaryPoints?.get( id ) || [] ) s.addConstraintPoint( p );
 s.triangulate();return s.triangles.map( t => t.clone() );
}
function topology( geometry, label ) {
 const p = geometry.attributes.position, ix = geometry.index;
 const edges = new Map(), faces = new Set();
 const total = ix?.count ?? p.count;
 const start = geometry.drawRange.start, end = Math.min( total, start + geometry.drawRange.count );
 for ( let i = start; i < end; i += 3 ) {
  const v = [ 0, 1, 2 ].map( k => new Vector3().fromBufferAttribute( p, ix ? ix.getX( i + k ) : i + k ) );
  assert.ok( v.every( q => q.toArray().every( Number.isFinite ) ) );
  assert.ok( new Triangle( ...v ).getArea() > 0, 'no degenerate output facet' );
  const ks = v.map( key ), f = [ ...ks ].sort().join( '|' );
  assert.ok( ! faces.has( f ), `${ label }: no duplicate output facet` );faces.add( f );
  for ( let j = 0; j < 3; j ++ ) { const a = ks[ j ], b = ks[ ( j + 1 ) % 3 ], k = [ a, b ].sort().join( '|' );if ( ! edges.has( k ) ) edges.set( k, [] );edges.get( k ).push( a < b ? 1 : -1 ); }
 }
 for ( const refs of edges.values() ) { assert.equal( refs.length, 2, `${ label }: every edge paired` );assert.equal( refs[ 0 ] + refs[ 1 ], 0, 'opposite winding' ); }
}
test( 'disjoint operands do not allocate an operation cut registry', () => {
 const a = new Brush( new BoxGeometry() ), b = new Brush( new BoxGeometry().translate( 3, 0, 0 ) );
 a.updateMatrixWorld( true );b.updateMatrixWorld( true );a.prepareGeometry();b.prepareGeometry();
 const { cutRegistry, aIntersections, bIntersections } = collectIntersectingTriangles( a, b, true );
 assert.equal( cutRegistry, null );assert.equal( aIntersections.ids.length + bIntersections.ids.length, 0 );
 for ( const value of [ a, b ] ) { value.disposeCacheData();value.geometry.dispose(); }
} );

test( 'rotated repeated subtraction must not retain macroscopic B faces outside A', () => {
 const evaluator = new Evaluator();evaluator.attributes = [ 'position' ];evaluator.useGroups = false;evaluator.useCDTClipping = true;evaluator.consistentCutSeams = true;
 const matrix = new Matrix4().makeRotationZ( .37 ), inverse = matrix.clone().invert();
 const a = new Brush( new BoxGeometry( 2, 2, 2 ).applyMatrix4( matrix ) );
 const b = new Brush( new BoxGeometry( 2, 2, 2 ).translate( .6, .3, .2 ).applyMatrix4( matrix ) );
 a.updateMatrixWorld( true );b.updateMatrixWorld( true );
 const magnitude = Math.max( ...a.geometry.attributes.position.array.map( Math.abs ), ...b.geometry.attributes.position.array.map( Math.abs ) );
 const budget = 4 * Math.sqrt( 3 ) * 2 ** ( Math.floor( Math.log2( magnitude ) ) - 23 );
 let union, result;
 try {
  union = evaluator.evaluate( a, b, ADDITION );union.updateMatrixWorld( true );
  result = evaluator.evaluate( union, b, SUBTRACTION );
  const { geometry } = result, position = geometry.attributes.position, point = new Vector3();
  for ( let i = 0; i < geometry.drawRange.count; i ++ ) {
   point.fromBufferAttribute( position, geometry.index.getX( i ) ).applyMatrix4( inverse );
   assert.ok( Math.max( Math.abs( point.x ), Math.abs( point.y ), Math.abs( point.z ) ) <= 1 + budget, '(A union B) minus B must lie in A, within the Float32 representation budget' );
  }
 } finally {
  for ( const value of [ a, b, union, result ] ) if ( value ) { value.disposeCacheData();value.geometry.dispose(); }
  evaluator.reset();
 }
} );

const square = [ [ [ 0, 0, 0 ], [ 2, 0, 0 ], [ 2, 2, 0 ] ], [ [ 0, 0, 0 ], [ 2, 2, 0 ], [ 0, 2, 0 ] ] ];
const cutter = [ [ [ 1, -1, -1 ], [ 1, 2, -1 ], [ 1, 2, 2 ] ] ];

test( 'one source-edge/face event has one canonical object across adjacent triangle pairs', () => {
 const a = brush( square ), b = brush( cutter ), registry = new CutPointRegistry( a, b );
 const p = registry.register( new Vector3( 1, 1, 0 ), 0, 0 );
 const q = registry.register( new Vector3( 1 + Number.EPSILON, 1, 0 ), 1, 0 );
 assert.strictEqual( p, q );assert.equal( registry.points.size, 1 );
 assert.strictEqual( registry.materialize( p ), registry.materialize( q ) );
 assert.notStrictEqual( new CutPointRegistry( a, b ).register( new Vector3( 1, 1, 0 ), 0, 0 ), p, 'operation lifetime is independent' );
} );

test( 'a cut reaches the adjacent source face before whole-face output, without an intersection entry there', () => {
 const a = brush( square ), b = brush( cutter ), registry = new CutPointRegistry( a, b );
 registry.register( new Vector3( 1, 1, 0 ), 0, 0 );
 const am = new IntersectionMap(), bm = new IntersectionMap();am.add( 0, 0 );bm.add( 0, 0 );registry.propagate( am, bm );
 assert.ok( am.ids.includes( 1 ) );assert.deepEqual( am.intersectionSet.get( 1 ), [] );
 const subdivisions = square.map( ( t, id ) => {
  const tris = triangulate( new Triangle( ...t.map( p => new Vector3( ...p ) ) ), am, id );
  return new Set( tris.flatMap( t => [ t.a, t.b, t.c ] ).filter( p => p.x === p.y ).map( key ) );
 } );
 assert.deepEqual( subdivisions[ 0 ], subdivisions[ 1 ] );assert.ok( subdivisions[ 0 ].has( '1,1,0' ) );
} );

test( 'near but separate source edges do not share canonical identity or adjacency', () => {
 const offset = 1e-6;
 const shifted = square.map( t => t.map( p => [ p[ 0 ], p[ 1 ], offset ] ) );
 const a = brush( [ ...square, ...shifted ] ), b = brush( cutter ), registry = new CutPointRegistry( a, b );
 const p = registry.register( new Vector3( 1, 1, 0 ), 0, 0 );
 const am = new IntersectionMap(), bm = new IntersectionMap();registry.propagate( am, bm );
 assert.ok( ! am.ids.includes( 2 ) && ! am.ids.includes( 3 ) );
 const q = registry.register( new Vector3( 1, 1, Math.fround( offset ) ), 2, 0 );
 assert.notStrictEqual( p, q );assert.notEqual( key( p ), key( q ) );
} );


for ( const [ name, rotation, translation, scale ] of [
 [ 'ordinary', 0, 0, 1 ], [ 'rotation', .37, 0, 1 ], [ 'translation', 0, 10000, 1 ], [ 'small', 0, 0, .001 ], [ 'large', 0, 0, 1000 ],
] ) {
 test( `closed oriented Float32 box booleans and repeated operation: ${ name }`, () => {
  const evaluator = new Evaluator();evaluator.attributes = [ 'position' ];evaluator.useGroups = false;evaluator.useCDTClipping = true;evaluator.consistentCutSeams = process.env.CSG_SHARED !== '0';
  const transform = new Matrix4().makeRotationZ( rotation ).scale( new Vector3( scale, scale, scale ) );transform.setPosition( translation, -translation, translation );
  const a = new Brush( new BoxGeometry( 2, 2, 2 ).applyMatrix4( transform ) );
  const b = new Brush( new BoxGeometry( 2, 2, 2 ).translate( .6, .3, .2 ).applyMatrix4( transform ) );a.updateMatrixWorld( true );b.updateMatrixWorld( true );
  const union = evaluator.evaluate( a, b, ADDITION );union.updateMatrixWorld( true );topology( union.geometry, 'union' );
  const result = evaluator.evaluate( union, b, SUBTRACTION );topology( result.geometry, 'repeated subtraction' );
  for ( const brush of [ a, b, union, result ] ) { brush.disposeCacheData();brush.geometry.dispose(); }evaluator.reset();
 } );
}
