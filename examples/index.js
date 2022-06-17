import * as THREE from 'three';
import { GUI } from 'three/examples/jsm/libs/lil-gui.module.min.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
	Brush,
	Evaluator,
	ADDITION,
	SUBTRACTION,
	INTERSECTION,
	DIFFERENCE,
} from '..';

const params = {

	brush1Shape: 'box',
	brush1Complexity: 1,

	brush2Shape: 'sphere',
	brush2Complexity: 1,

	operation: SUBTRACTION,
	wireframe: false,
	displayBrushes: true,
	displayControls: true,
	shadows: true,

};

let renderer, camera, scene, gui, outputContainer;
let controls, transformControls;
let brush1, brush2;
let resultObject, wireframeResult, light;
let needsUpdate = true;
let csgEvaluator = new Evaluator();

init();
render();

function init() {

	const bgColor = 0x111111;

	outputContainer = document.getElementById( 'output' );

	// renderer setup
	renderer = new THREE.WebGLRenderer( { antialias: true } );
	renderer.setPixelRatio( window.devicePixelRatio );
	renderer.setSize( window.innerWidth, window.innerHeight );
	renderer.setClearColor( bgColor, 1 );
	renderer.shadowMap.enabled = true;
	renderer.shadowMap.type = THREE.PCFSoftShadowMap;
	renderer.outputEncoding = THREE.sRGBEncoding;
	document.body.appendChild( renderer.domElement );

	// scene setup
	scene = new THREE.Scene();
	scene.fog = new THREE.Fog( 0xffca28, 20, 60 );

	// lights
	light = new THREE.DirectionalLight( 0xffffff, 1 );
	light.position.set( - 1, 2, 3 );
	scene.add( light, light.target );
	scene.add( new THREE.AmbientLight( 0xb0bec5, 0.1 ) );

	// shadows
	const shadowCam = light.shadow.camera;
	light.castShadow = true;
	light.shadow.mapSize.setScalar( 4096 );
	light.shadow.bias = 1e-5;
	light.shadow.normalBias = 1e-2;

	shadowCam.left = shadowCam.bottom = - 2.5;
	shadowCam.right = shadowCam.top = 2.5;
	shadowCam.updateProjectionMatrix();

	// camera setup
	camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 50 );
	camera.position.set( 1, 2, 4 );
	camera.far = 100;
	camera.updateProjectionMatrix();

	// controls
	controls = new OrbitControls( camera, renderer.domElement );

	transformControls = new TransformControls( camera, renderer.domElement );
	transformControls.setSize( 0.75 );
	transformControls.addEventListener( 'dragging-changed', e => {

		controls.enabled = ! e.value;

	} );
	transformControls.addEventListener( 'objectChange', () => {

		needsUpdate = true;

	} );
	scene.add( transformControls );

	// initialize brushes
	brush1 = new Brush( new THREE.BoxBufferGeometry(), new THREE.MeshStandardMaterial() );
	brush2 = new Brush( new THREE.BoxBufferGeometry(), new THREE.MeshStandardMaterial( { color: 0xff0000 } ) );
	brush2.position.set( - 0.75, 0.75, 0 );
	brush2.scale.setScalar( 0.75 );

	// PROBLEM CASE:
	// brush2.position.set( - 0.27300968690619787, 0.5329319712626078, 0 );
	// brush2.scale.setScalar( 1 );

	updateBrush( brush1, params.brush1Shape, params.brush1Complexity );
	updateBrush( brush2, params.brush2Shape, params.brush2Complexity );

	// initialize materials
	brush1.material.opacity = 0.15;
	brush1.material.transparent = true;
	brush1.material.depthWrite = false;
	brush1.material.polygonOffset = true;
	brush1.material.polygonOffsetFactor = 2;
	brush1.material.polygonOffsetUnits = 2;

	brush2.material.opacity = 0.15;
	brush2.material.transparent = true;
	brush2.material.depthWrite = false;
	brush2.material.polygonOffset = true;
	brush2.material.polygonOffsetFactor = 2;
	brush2.material.polygonOffsetUnits = 2;

	brush1.receiveShadow = true;
	brush2.receiveShadow = true;
	transformControls.attach( brush2 );

	scene.add( brush1, brush2 );

	// add object displaying the result
	resultObject = new THREE.Mesh( new THREE.BufferGeometry(), new THREE.MeshStandardMaterial( {
		flatShading: false,
		polygonOffset: true,
		polygonOffsetUnits: 1,
		polygonOffsetFactor: 1,

	} ) );
	resultObject.castShadow = true;
	resultObject.receiveShadow = true;
	scene.add( resultObject );

	// add wireframe representation
	wireframeResult = new THREE.Mesh( new THREE.BufferGeometry(), new THREE.MeshBasicMaterial( {
		wireframe: true,
		color: 0,
		opacity: 0.15,
		transparent: true,
	} ) );
	scene.add( wireframeResult );

	gui = new GUI();
	gui.add( params, 'operation', { ADDITION, SUBTRACTION, INTERSECTION, DIFFERENCE } ).onChange( () => {

		needsUpdate = true;

	} );
	gui.add( params, 'displayBrushes' );
	gui.add( params, 'displayControls' );
	gui.add( params, 'wireframe' );
	gui.add( params, 'shadows' );

	const brush1Folder = gui.addFolder( 'brush 1' );
	brush1Folder.add( params, 'brush1Shape', [ 'sphere', 'box', 'torus', 'torus knot' ] ).name( 'shape' ).onChange( v => {

		updateBrush( brush1, v, params.brush1Complexity );

	} );
	brush1Folder.add( params, 'brush1Complexity', 0, 2 ).name( 'complexity' ).onChange( v => {

		updateBrush( brush1, params.brush1Shape, v );

	} );

	const brush2Folder = gui.addFolder( 'brush 2' );
	brush2Folder.add( params, 'brush2Shape', [ 'sphere', 'box', 'torus', 'torus knot' ] ).name( 'shape' ).onChange( v => {

		updateBrush( brush2, v, params.brush2Complexity );

	} );
	brush2Folder.add( params, 'brush2Complexity', 0, 2 ).name( 'complexity' ).onChange( v => {

		updateBrush( brush2, params.brush2Shape, v );

	} );

	window.addEventListener( 'resize', function () {

		camera.aspect = window.innerWidth / window.innerHeight;
		camera.updateProjectionMatrix();

		renderer.setSize( window.innerWidth, window.innerHeight );

	}, false );

	window.addEventListener( 'keydown', function ( e ) {

		switch ( e.code ) {

			case 'KeyW':
				transformControls.setMode( 'translate' );
				break;
			case 'KeyE':
				transformControls.setMode( 'rotate' );
				break;
			case 'KeyR':
				transformControls.setMode( 'scale' );
				break;

		}

	} );

}

function updateBrush( brush, type, complexity ) {

	brush.geometry.dispose();
	switch ( type ) {

		case 'sphere':
			brush.geometry = new THREE.SphereBufferGeometry(
				1,
				Math.round( THREE.MathUtils.lerp( 5, 32, complexity ) ),
				Math.round( THREE.MathUtils.lerp( 5, 16, complexity ) )
			);
			break;
		case 'box':
			brush.geometry = new THREE.BoxBufferGeometry( 1, 1, 1 );
			break;
		case 'torus':
			brush.geometry = new THREE.TorusBufferGeometry(
				0.6,
				0.2,
				Math.round( THREE.MathUtils.lerp( 4, 16, complexity ) ),
				Math.round( THREE.MathUtils.lerp( 6, 30, complexity ) )
			);
			break;
		case 'torus knot':
			brush.geometry = new THREE.TorusKnotBufferGeometry(
				0.6,
				0.2,
				Math.round( THREE.MathUtils.lerp( 16, 64, complexity ) ),
				Math.round( THREE.MathUtils.lerp( 4, 16, complexity ) ),
			);
			break;

	}

	needsUpdate = true;

}

function render() {

	requestAnimationFrame( render );

	brush1.prepareGeometry();
	brush2.prepareGeometry();
	brush1.updateMatrixWorld();
	brush2.updateMatrixWorld();

	if ( needsUpdate ) {

		needsUpdate = false;

		const startTime = window.performance.now();
		resultObject.geometry.dispose();
		resultObject.geometry = csgEvaluator.evaluate( brush1, brush2, params.operation );

		wireframeResult.geometry.dispose();
		wireframeResult.geometry = resultObject.geometry;

		const deltaTime = window.performance.now() - startTime;
		outputContainer.innerText = `${ deltaTime.toFixed( 3 ) }ms`;

	}

	wireframeResult.visible = params.wireframe;
	brush1.visible = params.displayBrushes;
	brush2.visible = params.displayBrushes;

	light.castShadow = params.shadows;

	transformControls.enabled = params.displayControls;
	transformControls.visible = params.displayControls;

	renderer.render( scene, camera );

}



