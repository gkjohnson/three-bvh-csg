import * as THREE from 'three';
import { GUI } from 'three/examples/jsm/libs/lil-gui.module.min.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
	Brush,
	Evaluator,
	SUBTRACTION,
	HalfEdgeHelper,
} from '..';

const params = {

	useSymmetricalClipping: false,
	displayWireframe: false,
	displayBrushes: false,
	displayHalfEdges: false,

};

let renderer, camera, scene, controls, gui, outputContainer;
let brush1, brush2, result, wireframeResult;
let halfEdgeHelper;
let evaluator;
let needsUpdate = true;

init();

async function init() {

	// renderer setup
	renderer = new THREE.WebGLRenderer( { antialias: true } );
	renderer.setPixelRatio( window.devicePixelRatio );
	renderer.setSize( window.innerWidth, window.innerHeight );
	renderer.setClearColor( 0x263238 );
	renderer.shadowMap.enabled = true;
	renderer.shadowMap.type = THREE.PCFSoftShadowMap;
	renderer.outputColorSpace = THREE.SRGBColorSpace;
	document.body.appendChild( renderer.domElement );

	// scene setup
	scene = new THREE.Scene();

	// lights
	const light = new THREE.DirectionalLight( 0xffffff, 1 );
	light.position.set( 1, 2, 4 );
	scene.add( light );
	scene.add( new THREE.AmbientLight( 0xffffff, 0.4 ) );

	// camera setup
	camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 50 );
	camera.position.set( 1, 2, 4 );
	camera.far = 100;
	camera.updateProjectionMatrix();

	// controls
	controls = new OrbitControls( camera, renderer.domElement );

	// evaluator setup
	evaluator = new Evaluator();
	evaluator.attributes = [ 'position', 'normal' ];

	// create brushes
	brush1 = new Brush( new THREE.BoxGeometry( 2, 2, 2 ) );
	brush1.material = new THREE.MeshStandardMaterial( { color: 0xff6b6b, transparent: true, opacity: 0.5 } );
	brush1.position.set( - 0.5, 0, 0 );
	brush1.updateMatrixWorld();
	scene.add( brush1 );

	brush2 = new Brush( new THREE.SphereGeometry( 1.25, 32, 16 ) );
	brush2.material = new THREE.MeshStandardMaterial( { color: 0x4ecdc4, transparent: true, opacity: 0.5 } );
	brush2.position.set( 0.5, 0, 0 );
	brush2.updateMatrixWorld();
	scene.add( brush2 );

	// result objects
	result = new THREE.Mesh();
	result.material = new THREE.MeshStandardMaterial( { color: 0xfeca57 } );
	scene.add( result );

	wireframeResult = new THREE.Mesh();
	wireframeResult.material = new THREE.MeshBasicMaterial( { wireframe: true, color: 0x000000 } );
	scene.add( wireframeResult );

	// half edge helper
	halfEdgeHelper = new HalfEdgeHelper();
	scene.add( halfEdgeHelper );

	// gui setup
	gui = new GUI();
	gui.add( params, 'useSymmetricalClipping' ).name( 'Use Symmetrical Clipping' ).onChange( () => {

		needsUpdate = true;

	} );
	gui.add( params, 'displayWireframe' ).name( 'Show Wireframe' );
	gui.add( params, 'displayBrushes' ).name( 'Show Brushes' );
	gui.add( params, 'displayHalfEdges' ).name( 'Show Half Edges' ).onChange( () => {

		needsUpdate = true;

	} );

	// output container
	outputContainer = document.createElement( 'div' );
	outputContainer.style.position = 'absolute';
	outputContainer.style.top = '10px';
	outputContainer.style.left = '10px';
	outputContainer.style.color = 'white';
	outputContainer.style.fontFamily = 'monospace';
	outputContainer.style.fontSize = '14px';
	outputContainer.style.background = 'rgba(0,0,0,0.5)';
	outputContainer.style.padding = '10px';
	outputContainer.style.borderRadius = '5px';
	document.body.appendChild( outputContainer );

	window.addEventListener( 'resize', function () {

		camera.aspect = window.innerWidth / window.innerHeight;
		camera.updateProjectionMatrix();

		renderer.setSize( window.innerWidth, window.innerHeight );

	}, false );

	render();

}

function performCSG() {

	const startTime = window.performance.now();

	// Configure the evaluator
	evaluator.useSymmetricalClipping = params.useSymmetricalClipping;

	// Perform the operation
	const csgResult = evaluator.evaluate( brush1, brush2, SUBTRACTION );

	// Update result geometry
	if ( result.geometry ) {

		result.geometry.dispose();

	}

	result.geometry = csgResult.geometry;
	wireframeResult.geometry = csgResult.geometry;

	// Update half edge helper if needed
	if ( params.displayHalfEdges ) {

		halfEdgeHelper.updateFrom( csgResult.geometry );

	}

	const deltaTime = window.performance.now() - startTime;

	// Update output information
	const positionCount = csgResult.geometry.attributes.position.count;
	const triangleCount = positionCount / 3;
	const mode = params.useSymmetricalClipping ? 'PolygonSplitter' : 'TriangleSplitter';
	
	outputContainer.innerHTML = `
		<div><strong>${mode}</strong></div>
		<div>Time: ${deltaTime.toFixed(2)}ms</div>
		<div>Triangles: ${triangleCount}</div>
		<div>Vertices: ${positionCount}</div>
	`;

}

function render() {

	requestAnimationFrame( render );

	if ( needsUpdate ) {

		needsUpdate = false;
		performCSG();

	}

	// Update visibility
	wireframeResult.visible = params.displayWireframe;
	brush1.visible = params.displayBrushes;
	brush2.visible = params.displayBrushes;
	halfEdgeHelper.visible = params.displayHalfEdges;

	renderer.render( scene, camera );

}