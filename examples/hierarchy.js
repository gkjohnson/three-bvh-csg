import * as THREE from 'three';
import { GUI } from 'three/examples/jsm/libs/lil-gui.module.min.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
	Evaluator,
	Operation,
	OperationGroup,
	GridMaterial,
	ADDITION,
	SUBTRACTION,
} from '..';

const params = {

	snap: true,
	wireframe: false,
	displayControls: true,
	transparentBrushes: true,
	display: 'OVERLAY',

};

let renderer, camera, scene, gui, outputContainer;
let controls, transformControls;
let light;
let csgEvaluator;

let result, root, brushMat, resultGridMat, wireframeObject;

init();

async function init() {

	const bgColor = 0x111111;

	outputContainer = document.getElementById( 'output' );

	// renderer setup
	renderer = new THREE.WebGLRenderer( { antialias: true } );
	renderer.setPixelRatio( window.devicePixelRatio );
	renderer.setSize( window.innerWidth, window.innerHeight );
	renderer.setClearColor( bgColor, 1 );
	document.body.appendChild( renderer.domElement );

	// scene setup
	scene = new THREE.Scene();

	// lights
	light = new THREE.DirectionalLight( 0xffffff, 3.5 );
	light.position.set( - 1, 2, 3 );
	scene.add( light, light.target );
	scene.add( new THREE.AmbientLight( 0xb0bec5, 0.35 ) );

	// camera setup
	camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 50 );
	camera.position.set( 3, 2, 4 ).multiplyScalar( 2 );
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

	brushMat = new GridMaterial();
	brushMat.side = THREE.DoubleSide;
	brushMat.polygonOffset = true;
	brushMat.polygonOffsetFactor = 2;
	brushMat.polygonOffsetUnits = 1;
	brushMat.opacity = 0.15;
	brushMat.transparent = true;
	brushMat.depthWrite = false;
	brushMat.color.set( 0xffc400 );

	resultGridMat = brushMat.clone();
	resultGridMat.opacity = 1;
	resultGridMat.transparent = false;
	resultGridMat.depthWrite = true;
	resultGridMat.polygonOffsetFactor = 1;
	resultGridMat.polygonOffsetUnits = 1;
	resultGridMat.color.set( 0xffffff );

	wireframeObject = new THREE.Mesh( undefined, new THREE.MeshBasicMaterial( { color: 0, wireframe: true } ) );
	wireframeObject.material.color.set( 0xffc400 ).multiplyScalar( 0.1 );
	scene.add( wireframeObject );

	root = new Operation( new THREE.BoxGeometry( 10, 5, 5 ), brushMat );
	scene.add( root );

	{

		const inside = new Operation( new THREE.BoxGeometry( 9, 4.5, 4 ), brushMat );
		inside.operation = SUBTRACTION;
		root.add( inside );

	}

	{

		const hole = new Operation( new THREE.CylinderGeometry( 0.5, 0.5, 1, 20 ), brushMat );
		hole.operation = SUBTRACTION;
		hole.rotateX( Math.PI / 2 );
		hole.position.y = 0.25;

		const hole2 = new Operation( new THREE.BoxGeometry( 1, 2.5, 1 ), brushMat );
		hole2.operation = SUBTRACTION;
		hole2.position.y = - 1;

		const doorGroup = new OperationGroup();
		doorGroup.position.z = 2.2;
		doorGroup.add( hole, hole2 );
		root.add( doorGroup );
		transformControls.attach( doorGroup );

	}

	{

		const hole = new Operation( new THREE.BoxGeometry( 2, 1.75, 2 ), brushMat );
		hole.operation = SUBTRACTION;

		const frame = new Operation( new THREE.BoxGeometry( 2, 1.75, 0.2 ), brushMat );
		frame.operation = ADDITION;

		const hole2 = new Operation( new THREE.BoxGeometry( 1.9, 1.65, 2 ), brushMat );
		hole2.operation = SUBTRACTION;

		const bar1 = new Operation( new THREE.BoxGeometry( 2, 0.1, 0.1 ), brushMat );
		bar1.operation = ADDITION;

		const bar2 = new Operation( new THREE.BoxGeometry( 0.1, 2, 0.1 ), brushMat );
		bar2.operation = ADDITION;

		const windowGroup = new OperationGroup();
		windowGroup.add( hole, frame, hole2, bar1, bar2 );
		windowGroup.position.x = - 3;
		windowGroup.position.z = 2.2;
		root.add( windowGroup );

	}

	{

		const hole = new Operation( new THREE.BoxGeometry( 2, 1.75, 2 ), brushMat );
		hole.operation = SUBTRACTION;

		const frame = new Operation( new THREE.BoxGeometry( 2, 1.75, 0.2 ), brushMat );
		frame.operation = ADDITION;

		const hole2 = new Operation( new THREE.BoxGeometry( 1.9, 1.65, 2 ), brushMat );
		hole2.operation = SUBTRACTION;

		const bar1 = new Operation( new THREE.BoxGeometry( 2, 0.1, 0.1 ), brushMat );
		bar1.operation = ADDITION;

		const bar2 = new Operation( new THREE.BoxGeometry( 0.1, 2, 0.1 ), brushMat );
		bar2.operation = ADDITION;

		const windowGroup = new OperationGroup();
		windowGroup.add( hole, frame, hole2, bar1, bar2 );
		windowGroup.position.x = 3;
		windowGroup.position.z = 2.2;
		root.add( windowGroup );

	}

	// gui
	gui = new GUI();
	gui.add( params, 'wireframe' );
	gui.add( params, 'snap' );
	gui.add( params, 'displayControls' );
	gui.add( params, 'transparentBrushes' );
	gui.add( params, 'display', [ 'OVERLAY', 'BRUSHES', 'RESULT' ] );

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

	if ( params.transparentBrushes ) {

		brushMat.depthWrite = false;
		brushMat.transparent = true;
		brushMat.opacity = 0.15;

	} else {

		brushMat.depthWrite = true;
		brushMat.transparent = false;
		brushMat.opacity = 1;

	}

	if ( result ) {

		result.geometry.dispose();
		result.parent.remove( result );

	}

	result = csgEvaluator.evaluateHierarchy( root );
	result.material = resultGridMat;
	scene.add( result );

	wireframeObject.geometry = result.geometry;
	wireframeObject.visible = params.wireframe;

	const deltaTime = window.performance.now() - startTime;
	outputContainer.innerText = `${ deltaTime.toFixed( 3 ) }ms`;

	transformControls.enabled = params.displayControls;
	transformControls.visible = params.displayControls;

	result.visible = params.display !== 'BRUSHES';
	root.visible = params.display !== 'RESULT';

	renderer.render( scene, camera );

}



