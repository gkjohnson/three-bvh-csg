import * as THREE from 'three';
import { GUI } from 'three/examples/jsm/libs/lil-gui.module.min.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
	Evaluator,
	logTriangleDefinitions,
	Operation,
	OperationGroup,
	GridMaterial,
	ADDITION,
	SUBTRACTION,
	INTERSECTION,
	DIFFERENCE,
} from '..';

window.logTriangleDefinitions = logTriangleDefinitions;

const params = {

	snap: true,

	brush1Shape: 'box',
	brush1Complexity: 1,
	brush1Color: '#ffffff',

	brush2Shape: 'sphere',
	brush2Complexity: 1,
	brush2Color: '#E91E63',

	operation: SUBTRACTION,
	wireframe: false,
	displayBrushes: true,
	displayControls: true,
	shadows: true,
	vertexColors: false,
	flatShading: false,
	gridTexture: false,
	useGroups: true,

	enableDebugTelemetry: true,
	displayIntersectionEdges: false,
	displayTriangleIntersections: false,
	displayBrush1BVH: false,
	displayBrush2BVH: false,

};

let renderer, camera, scene, gui, outputContainer;
let controls, transformControls;
let light;
let csgEvaluator;

let result, root, gridMat;

init();

async function init() {

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
	transformControls.addEventListener( 'objectChange', e => {

		if ( params.snap ) {

			const o = transformControls.object;
			o.position.x = Math.floor( o.position.x * 1e1 ) * 1e-1;
			o.position.y = Math.floor( o.position.y * 1e1 ) * 1e-1;
			o.position.z = Math.floor( o.position.z * 1e1 ) * 1e-1;

		}

	} );
	scene.add( transformControls );

	// bunny mesh has no UVs so skip that attribute
	csgEvaluator = new Evaluator();
	csgEvaluator.attributes = [ 'position', 'normal' ];
	csgEvaluator.useGroups = false;

	gridMat = new GridMaterial();
	gridMat.color.set( 0xffc400 ).convertSRGBToLinear();

	root = new Operation( new THREE.BoxBufferGeometry( 10, 5, 0.5 ), gridMat );

	{

		const hole = new Operation( new THREE.CylinderBufferGeometry( 0.5, 0.5, 1, 20 ), gridMat );
		hole.operation = SUBTRACTION;
		hole.rotateX( Math.PI / 2 );

		const hole2 = new Operation( new THREE.BoxBufferGeometry( 1, 3, 1 ), gridMat );
		hole2.operation = SUBTRACTION;
		hole2.position.y = - 1.5;

		const doorGroup = new OperationGroup();
		doorGroup.add( hole, hole2 );
		root.add( doorGroup );
		transformControls.attach( doorGroup );

	}

	{

		const hole = new Operation( new THREE.BoxBufferGeometry( 2, 1.75, 2 ), gridMat );
		hole.operation = SUBTRACTION;

		const frame = new Operation( new THREE.BoxBufferGeometry( 2, 1.75, 0.2 ), gridMat );
		frame.operation = ADDITION;

		const hole2 = new Operation( new THREE.BoxBufferGeometry( 1.9, 1.65, 2 ), gridMat );
		hole2.operation = SUBTRACTION;

		const bar1 = new Operation( new THREE.BoxBufferGeometry( 2, 0.1, 0.1 ), gridMat );
		bar1.operation = ADDITION;

		const bar2 = new Operation( new THREE.BoxBufferGeometry( 0.1, 2, 0.1 ), gridMat );
		bar2.operation = ADDITION;

		const windowGroup = new OperationGroup();
		windowGroup.add( hole, frame, hole2, bar1, bar2 );
		windowGroup.position.x = - 3;
		root.add( windowGroup );

	}

	{

		const hole = new Operation( new THREE.BoxBufferGeometry( 2, 1.75, 2 ), gridMat );
		hole.operation = SUBTRACTION;

		const frame = new Operation( new THREE.BoxBufferGeometry( 2, 1.75, 0.2 ), gridMat );
		frame.operation = ADDITION;

		const hole2 = new Operation( new THREE.BoxBufferGeometry( 1.9, 1.65, 2 ), gridMat );
		hole2.operation = SUBTRACTION;

		const bar1 = new Operation( new THREE.BoxBufferGeometry( 2, 0.1, 0.1 ), gridMat );
		bar1.operation = ADDITION;

		const bar2 = new Operation( new THREE.BoxBufferGeometry( 0.1, 2, 0.1 ), gridMat );
		bar2.operation = ADDITION;

		const windowGroup = new OperationGroup();
		windowGroup.add( hole, frame, hole2, bar1, bar2 );
		windowGroup.position.x = 3;
		root.add( windowGroup );

	}

	// gui
	gui = new GUI();
	gui.add( params, 'snap' );
	gui.add( params, 'displayControls' );
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

	render();

}

function render() {

	requestAnimationFrame( render );

	const startTime = window.performance.now();

	if ( result ) {

		result.geometry.dispose();
		result.parent.remove( result );

	}

	result = csgEvaluator.evaluateHierarchy( root );
	result.material = gridMat;
	scene.add( result );
	result.position.z = 5;
	scene.add( root );

	const deltaTime = window.performance.now() - startTime;
	outputContainer.innerText = `${ deltaTime.toFixed( 3 ) }ms`;


	light.castShadow = params.shadows;

	transformControls.enabled = params.displayControls;
	transformControls.visible = params.displayControls;

	renderer.render( scene, camera );

}



