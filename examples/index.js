import * as THREE from 'three';
import { GUI } from 'three/examples/jsm/libs/lil-gui.module.min.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
	Brush,
	performOperation,
	ADDITION,
	SUBTRACTION,
	INTERSECTION,
	DIFFERENCE,
} from '..';

const params = {

	brush1Shape: 'box',
	brush2Shape: 'sphere',
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

	updateBrush( brush1, params.brush1Shape );
	updateBrush( brush2, params.brush2Shape );

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
	gui.add( params, 'brush1Shape', [ 'sphere', 'box', 'torus', 'torus knot' ] ).onChange( v => {

		console.log( v );
		updateBrush( brush1, v );

	} );
	gui.add( params, 'brush2Shape', [ 'sphere', 'box', 'torus', 'torus knot' ] ).onChange( v => {

		updateBrush( brush2, v );

	} );
	gui.add( params, 'operation', { ADDITION, SUBTRACTION, INTERSECTION, DIFFERENCE } ).onChange( () => {

		needsUpdate = true;

	} );
	gui.add( params, 'displayBrushes' );
	gui.add( params, 'displayControls' );
	gui.add( params, 'wireframe' );
	gui.add( params, 'shadows' );

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

function updateBrush( brush, type ) {

	brush.geometry.dispose();
	switch ( type ) {

		case 'sphere':
			brush.geometry = new THREE.SphereBufferGeometry();
			break;
		case 'box':
			brush.geometry = new THREE.BoxBufferGeometry();
			break;
		case 'torus':
			brush.geometry = new THREE.TorusBufferGeometry( 0.6, 0.2, 16, 30 );
			break;
		case 'torus knot':
			brush.geometry = new THREE.TorusKnotBufferGeometry( 0.6, 0.2, 64, 16 );
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

		const startTime = window.performance.now();
		resultObject.geometry.dispose();
		resultObject.geometry = performOperation( brush1, brush2, params.operation );
		const deltaTime = window.performance.now() - startTime;

		wireframeResult.geometry.dispose();
		wireframeResult.geometry = resultObject.geometry;

		outputContainer.innerText = `${ deltaTime.toFixed( 3 ) }ms`;
		needsUpdate = false;

	}

	wireframeResult.visible = params.wireframe;
	brush1.visible = params.displayBrushes;
	brush2.visible = params.displayBrushes;

	light.castShadow = params.shadows;

	transformControls.enabled = params.displayControls;
	transformControls.visible = params.displayControls;

	renderer.render( scene, camera );

}



