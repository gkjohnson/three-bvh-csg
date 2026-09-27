import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GUI } from 'three/examples/jsm/libs/lil-gui.module.min.js';
import { ConvexGeometry } from 'three/examples/jsm/geometries/ConvexGeometry.js';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Brush, Evaluator, SUBTRACTION } from '..';
import { CARVE_PATH, TOOL_RADIUS, WORKPIECE_MIN, WORKPIECE_MAX } from './carvePath.js';

const SWEEP_COUNT = CARVE_PATH.length - 1;

const params = {
	useCDTClipping: true,
	displayTool: true,
	autoRotate: true,
	paused: false,
	restart: () => restart(),
};

let renderer, camera, scene, controls, outputContainer;
let workpieceGeometry, tool, toolPoints, results, resultMesh, path, step;
let minTime, maxTime, totalTime;
const clock = new THREE.Clock();
const evaluator = new Evaluator();
evaluator.attributes = [ 'position', 'normal' ];
evaluator.useGroups = false;

init();
render();

function init() {

	outputContainer = document.getElementById( 'output' );

	// renderer setup
	renderer = new THREE.WebGLRenderer( { antialias: true } );
	renderer.setPixelRatio( window.devicePixelRatio );
	renderer.setSize( window.innerWidth, window.innerHeight );
	renderer.setClearColor( 0x111111, 1 );
	document.body.appendChild( renderer.domElement );

	// scene setup
	scene = new THREE.Scene();

	// a low angle key light and hemisphere fill so the carved slopes shade distinctly
	const light = new THREE.DirectionalLight( 0xffffff, 2 );
	light.position.set( 2, 1, 1 );
	scene.add( light, new THREE.HemisphereLight( 0xffffff, 0x303040, 0.8 ) );

	// workpiece
	const bounds = new THREE.Box3( new THREE.Vector3( ...WORKPIECE_MIN ), new THREE.Vector3( ...WORKPIECE_MAX ) );
	const size = bounds.getSize( new THREE.Vector3() );
	const center = bounds.getCenter( new THREE.Vector3() );
	workpieceGeometry = new THREE.BoxGeometry( size.x, size.y, size.z ).translate( center.x, center.y, center.z );

	camera = new THREE.PerspectiveCamera( 50, window.innerWidth / window.innerHeight, 0.1, 50 );
	camera.position.set( 1.6, 1.4, 2 ).add( center );

	controls = new OrbitControls( camera, renderer.domElement );
	controls.target.copy( center );

	path = CARVE_PATH.map( p => new THREE.Vector3( ...p ) );

	// the unique vertices of a low poly sphere used to build the swept tool
	const spherePosition = mergeVertices( new THREE.IcosahedronGeometry( TOOL_RADIUS, 2 ) ).attributes.position;
	toolPoints = Array.from( { length: spherePosition.count }, ( v, i ) => new THREE.Vector3().fromBufferAttribute( spherePosition, i ) );

	tool = new Brush(
		getSweepGeometry( path[ 0 ], path[ 0 ] ),
		new THREE.MeshStandardMaterial( {
			color: 0xffc400,
			transparent: true,
			opacity: 0.25,
			depthWrite: false,
		} ),
	);
	scene.add( tool );

	// the results alternate so each operation reads the previous result
	results = [ new Brush(), new Brush() ];
	resultMesh = new THREE.Mesh( undefined, new THREE.MeshStandardMaterial( { roughness: 0.5, flatShading: true } ) );
	scene.add( resultMesh );

	// gui
	const gui = new GUI();
	gui.add( params, 'useCDTClipping' ).onChange( restart );
	gui.add( params, 'displayTool' );
	gui.add( params, 'autoRotate' );
	gui.add( params, 'paused' );
	gui.add( params, 'restart' );

	window.addEventListener( 'resize', () => {

		camera.aspect = window.innerWidth / window.innerHeight;
		camera.updateProjectionMatrix();
		renderer.setSize( window.innerWidth, window.innerHeight );

	} );

	restart();

}

// the convex hull of the tool sphere at the start and end of a move
function getSweepGeometry( start, end ) {

	const points = toolPoints.map( p => p.clone().add( start ) );
	if ( ! start.equals( end ) ) {

		points.push( ...toolPoints.map( p => p.clone().add( end ) ) );

	}

	return new ConvexGeometry( points );

}

function restart() {

	evaluator.useCDTClipping = params.useCDTClipping;
	step = 0;
	minTime = Infinity;
	maxTime = 0;
	totalTime = 0;
	results[ 0 ].geometry.dispose();
	results[ 0 ].geometry = workpieceGeometry.clone();
	updateDisplay( results[ 0 ] );

}

// sweeps the tool from the current path point to the next one
function carveStep() {

	const input = results[ step % 2 ];
	const output = results[ ( step + 1 ) % 2 ];

	tool.geometry.dispose();
	tool.geometry = getSweepGeometry( path[ step ], path[ step + 1 ] );

	const start = performance.now();
	evaluator.evaluate( input, tool, SUBTRACTION, output );
	const delta = performance.now() - start;

	minTime = Math.min( minTime, delta );
	maxTime = Math.max( maxTime, delta );
	totalTime += delta;
	step ++;

	updateDisplay( output );

}

function updateDisplay( result ) {

	// preparing the brush builds the half edge map used to check for open edges and
	// is reused by the next operation
	result.prepareGeometry();

	const { geometry } = result;
	const triangles = Math.min( geometry.index.count, geometry.drawRange.count ) / 3;
	const openEdges = geometry.halfEdges.unmatchedEdges;

	resultMesh.geometry = geometry;
	outputContainer.innerText =
		`step        : ${ step } / ${ SWEEP_COUNT }\n` +
		`triangles   : ${ triangles }\n` +
		`watertight  : ${ openEdges === 0 ? 'yes' : `no (${ openEdges } open edges)` }\n` +
		`min clip    : ${ step === 0 ? '-' : `${ minTime.toFixed( 2 ) }ms` }\n` +
		`max clip    : ${ step === 0 ? '-' : `${ maxTime.toFixed( 2 ) }ms` }\n` +
		`total clip  : ${ totalTime.toFixed( 2 ) }ms`;

}

function render() {

	requestAnimationFrame( render );

	if ( ! params.paused && step < SWEEP_COUNT ) {

		carveStep();

	}

	controls.autoRotate = params.autoRotate;
	controls.update( clock.getDelta() );

	tool.visible = params.displayTool && step < SWEEP_COUNT;
	renderer.render( scene, camera );

}
