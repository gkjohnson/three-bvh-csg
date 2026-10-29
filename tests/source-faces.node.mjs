import test from 'node:test';
import assert from 'node:assert/strict';
import { BoxGeometry, Matrix4, Vector3, Triangle, BufferAttribute, MeshBasicMaterial } from 'three';
import { Brush, Evaluator, ADDITION, SUBTRACTION, REVERSE_SUBTRACTION } from '../src/index.js';
import { getSourceFaces, prepareSourceFaces, sharedSourceSupport, sourceTriangle, sourceFaceStats } from '../src/core/operations/SourceFaceProvenance.js';

function setup( groups = false ) {
 const e = new Evaluator();e.attributes = [ 'position' ];e.useGroups = groups;e.useCDTClipping = true;e.consistentCutSeams = true;
 const matrix = new Matrix4().makeRotationZ( .37 );
 const a = new Brush( new BoxGeometry( 2, 2, 2 ).applyMatrix4( matrix ) );
 const b = new Brush( new BoxGeometry( 2, 2, 2 ).translate( .6, .3, .2 ).applyMatrix4( matrix ) );
 a.updateMatrixWorld( true );b.updateMatrixWorld( true );
 return { e, a, b };
}
function triangle( g, id ) {
 return new Triangle( ...[ 0, 1, 2 ].map( k => new Vector3().fromBufferAttribute( g.attributes.position, g.index ? g.index.getX( id * 3 + k ) : id * 3 + k ) ) );
}
function check( result, roots ) {
 const faces = getSourceFaces( result.geometry );
 assert.equal( faces.length * 3, result.geometry.drawRange.count );
 for ( const [ i, face ] of faces.entries() ) {
  assert.ok( roots.has( face.source ) );
  const t = triangle( result.geometry, i ), support = sourceTriangle( face );
  assert.ok( t.getNormal( new Vector3() ).dot( support.getNormal( new Vector3() ) ) > .999999, 'orientation tracks emission, not operand slot' );
  assert.ok( support.closestPointToPoint( t.getMidpoint( new Vector3() ), new Vector3() ).distanceTo( t.getMidpoint( new Vector3() ) ) < 1e-6, 'fragment belongs to its recorded finite source triangle within representation error' );
 }
 return faces;
}

test( 'split and whole triangles retain actual source identity; box face 7 survives rounding', () => {
 const { e, a, b } = setup();const u = e.evaluate( a, b, ADDITION );
 const af = getSourceFaces( a.geometry ), bf = getSourceFaces( b.geometry );
 const faces = check( u, new Set( [ ...af, ...bf ].map( f => f.source ) ) );
 const descendants = faces.filter( f => f.source === bf[ 7 ].source );assert.ok( descendants.length > 1 );
 assert.ok( descendants.every( f => sharedSourceSupport( f, u.matrixWorld, bf[ 7 ], b.matrixWorld ) ) );
 const r = e.evaluate( u, b, SUBTRACTION );check( r, new Set( [ ...af, ...bf ].map( f => f.source ) ) );
 assert.ok( getSourceFaces( u.geometry ), 'internal SharedArrayBuffer conversion must not invalidate validated history' );
 assert.strictEqual( getSourceFaces( u.geometry )[ 0 ].source, faces[ 0 ].source );
 assert.ok( e.geometryBuilders.every( builder => builder.sourceFaces === null ), 'builder releases history after emission' );
} );

test( 'inverted subtraction, operand exchange and multiple targets preserve orientation and source order', () => {
 const { e, a, b } = setup();
 const results = e.evaluate( a, b, [ SUBTRACTION, REVERSE_SUBTRACTION, ADDITION ], [ new Brush(), new Brush(), new Brush() ] );
 const roots = new Set( [ ...getSourceFaces( a.geometry ), ...getSourceFaces( b.geometry ) ].map( f => f.source ) );
 for ( const r of results ) check( r, roots );
 assert.ok( getSourceFaces( results[ 0 ].geometry ).some( f => f.orientation === -1 ) );
 check( e.evaluate( b, a, SUBTRACTION ), roots );
} );

test( 'group reordering and material/normal/UV seams do not substitute source identity', () => {
 const { e, a, b } = setup( true );
 const materials = [ new MeshBasicMaterial(), new MeshBasicMaterial() ];
 a.material = materials;b.material = materials.slice().reverse();
 a.geometry.groups.forEach( ( g, i ) => g.materialIndex = i % 2 );b.geometry.groups.forEach( ( g, i ) => g.materialIndex = i % 2 );
 const r = e.evaluate( a, b, SUBTRACTION );
 check( r, new Set( [ ...getSourceFaces( a.geometry ), ...getSourceFaces( b.geometry ) ].map( f => f.source ) ) );
 const before = getSourceFaces( a.geometry );a.geometry.attributes.normal.setXYZ( 0, 0, 1, 0 );a.geometry.attributes.uv.setXY( 0, .3, .9 );
 assert.strictEqual( getSourceFaces( a.geometry ), before );
} );

test( 'world-frame support comparison handles common rigid/nonuniform/mirrored transforms without a distance epsilon', () => {
 const { e, a, b } = setup();const u = e.evaluate( a, b, ADDITION );
 const bf = getSourceFaces( b.geometry )[ 7 ], f = getSourceFaces( u.geometry ).find( f => f.source === bf.source );
 for ( const scale of [ new Vector3( 1, 1, 1 ), new Vector3( 2, 3, .5 ), new Vector3( -1, 2, 1 ) ] ) {
  const m = new Matrix4().makeRotationZ( .51 ).scale( scale ).setPosition( 20, -3, 4 );
  assert.ok( sharedSourceSupport( f, m, bf, m ) );
  const different = m.clone();different.elements[ 12 ] += 1e-12;
  assert.equal( sharedSourceSupport( f, m, bf, different ), false );
 }
 assert.equal( sharedSourceSupport( f, new Matrix4().makeScale( 0, 1, 1 ), bf, new Matrix4().makeScale( 0, 1, 1 ) ), false );
} );

test( 'operand-local transforms and mirrored winding are recorded in output frame', () => {
 const { e, a, b } = setup();b.scale.set( -1, 1.2, .9 );b.position.set( .1, -.2, 0 );b.updateMatrixWorld( true );
 const r = e.evaluate( a, b, ADDITION );
 check( r, new Set( [ ...getSourceFaces( a.geometry ), ...getSourceFaces( b.geometry ) ].map( f => f.source ) ) );
 const bf = getSourceFaces( b.geometry );
 for ( const f of getSourceFaces( r.geometry ) ) {
  const root = bf.find( v => v.source === f.source );
  if ( root ) assert.ok( sharedSourceSupport( f, r.matrixWorld, root, b.matrixWorld ) );
 }
} );

for ( const [ name, change ] of [
 [ 'raw position write', g => g.attributes.position.array[ 0 ] += .125 ],
 [ 'position version', g => g.attributes.position.needsUpdate = true ],
 [ 'replacement attribute', g => g.setAttribute( 'position', g.attributes.position.clone() ) ],
 [ 'replacement backing array', g => g.attributes.position.array = g.attributes.position.array.slice() ],
 [ 'raw index write', g => [ g.index.array[ 0 ], g.index.array[ 1 ] ] = [ g.index.array[ 1 ], g.index.array[ 0 ] ] ],
 [ 'replacement index', g => g.setIndex( new BufferAttribute( g.index.array.slice(), 1 ) ) ],
 [ 'draw range', g => g.setDrawRange( 3, g.index.count - 3 ) ],
 [ 'group edit', g => g.groups[ 0 ].materialIndex ++ ],
 [ 'baked transform', g => g.translate( 1, 0, 0 ) ],
 [ 'disposal', g => g.dispose() ],
] ) {
 test( `invalid metadata is not reused after ${ name }`, () => {
  const { a } = setup();const old = prepareSourceFaces( a ), tree = a.geometry.boundsTree;
  change( a.geometry );assert.equal( getSourceFaces( a.geometry ), null );
  const next = prepareSourceFaces( a );assert.notStrictEqual( next[ 0 ].source, old[ 0 ].source );
  assert.notStrictEqual( a.geometry.boundsTree, tree, 'opt-in rebuild also invalidates stale BVH/halfedges/group indices' );
 } );
}

test( 'object reuse, shared-geometry clone, geometry clone and independent nearby surface are distinguished', () => {
 const { e, a, b } = setup();const r = e.evaluate( a, b, ADDITION ), previous = getSourceFaces( r.geometry );
 const clone = r.clone();assert.strictEqual( getSourceFaces( clone.geometry ), previous );
 const copiedGeometry = r.geometry.clone();assert.equal( getSourceFaces( copiedGeometry ), null );
 const copied = new Brush( copiedGeometry );const fresh = prepareSourceFaces( copied );
 assert.notStrictEqual( fresh[ 0 ].source, previous[ 0 ].source );
 const near = new Brush( b.geometry.clone().translate( 1e-6, 0, 0 ) );const nearFaces = prepareSourceFaces( near );
 assert.equal( sharedSourceSupport( getSourceFaces( b.geometry )[ 0 ], b.matrixWorld, nearFaces[ 0 ], near.matrixWorld ), false );
 e.evaluate( a, b, SUBTRACTION, r );assert.notStrictEqual( getSourceFaces( r.geometry ), previous );
 check( r, new Set( [ ...getSourceFaces( a.geometry ), ...getSourceFaces( b.geometry ) ].map( f => f.source ) ) );
} );

test( 'cache eviction retains history; source disposal does not invalidate descendants or retain parents', () => {
 const { e, a, b } = setup();const r = e.evaluate( a, b, ADDITION );const faces = getSourceFaces( r.geometry );
 prepareSourceFaces( r );const tree = r.geometry.boundsTree;
 r.disposeCacheData();assert.ok( getSourceFaces( r.geometry ) );
 const restored = prepareSourceFaces( r );assert.strictEqual( restored[ 0 ].source, faces[ 0 ].source );
 assert.notStrictEqual( r.geometry.boundsTree, tree );
 a.geometry.dispose();b.geometry.dispose();assert.strictEqual( getSourceFaces( r.geometry ), restored );
 for ( const f of faces ) {
  assert.deepEqual( Object.keys( f ).sort(), [ 'frame', 'orientation', 'source' ] );
  assert.deepEqual( Object.keys( f.source ).sort(), [ 'points', 'triangle' ] );
  assert.ok( Object.isFrozen( f ) && Object.isFrozen( f.source ) && Object.isFrozen( f.source.points ) && Object.isFrozen( f.frame ) );
 }
 assert.ok( sourceFaceStats( r.geometry ).snapshotBytes > 0 );
 r.geometry.dispose();assert.equal( getSourceFaces( r.geometry ), null );
} );

test( 'disabled path neither creates nor leaves old output provenance', () => {
 const { e, a, b } = setup();const r = e.evaluate( a, b, ADDITION );e.consistentCutSeams = false;
 e.evaluate( a, b, SUBTRACTION, r );assert.equal( getSourceFaces( r.geometry ), null );
 const fresh = setup();fresh.e.consistentCutSeams = false;fresh.e.evaluate( fresh.a, fresh.b, ADDITION );
 assert.equal( getSourceFaces( fresh.a.geometry ), null );
} );

test( 'failed target emission releases builder provenance and evaluator remains reusable', () => {
 const { e, a, b } = setup();e.evaluate( a, b, ADDITION );
 const builder = e.geometryBuilders[ 0 ], build = builder.buildGeometry;
 builder.buildGeometry = () => { throw new Error( 'injected output failure' ); };
 assert.throws( () => e.evaluate( a, b, SUBTRACTION ), /injected output failure/ );
 assert.equal( builder.sourceFaces, null );builder.buildGeometry = build;
 assert.ok( getSourceFaces( e.evaluate( a, b, ADDITION ).geometry ) );
} );

test( 'repeated emissions flatten history rather than linking previous meshes', () => {
 const { e, a, b } = setup();let r = e.evaluate( a, b, ADDITION );
 const sources = new Set( getSourceFaces( r.geometry ).map( f => f.source ) );
 // Disjoint union exercises whole emission without compounding the known red overlap.
 const distant = new Brush( new BoxGeometry().translate( 10, 0, 0 ) );distant.updateMatrixWorld( true );
 r = e.evaluate( r, distant, ADDITION );
 const allowed = new Set( [ ...sources, ...getSourceFaces( distant.geometry ).map( f => f.source ) ] );
 for ( let i = 0; i < 5; i ++ ) {
  const next = e.evaluate( r, distant, SUBTRACTION );r.geometry.dispose();r = next;
  assert.ok( getSourceFaces( r.geometry ).every( f => allowed.has( f.source ) ) );
 }
 assert.ok( e.geometryBuilders.every( builder => builder.sourceFaces === null ) );
} );
