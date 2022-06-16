import * as THREE from 'three';
import { GUI } from 'three/examples/jsm/libs/lil-gui.module.min.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Brush, EdgesHelper, TriangleSetHelper, ADDITION, SUBTRACTION, INTERSECTION, DIFFERENCE, performOperation } from '..';

const params = {

	operation: SUBTRACTION,
	triHelper: true,
	edgeHelper: true,

};

let renderer, camera, scene, gui, outputContainer;
let controls, transformControls;
let object1, object2;
let resultObject;
let edgesHelper, triHelper;
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
	renderer.outputEncoding = THREE.sRGBEncoding;
	document.body.appendChild( renderer.domElement );

	// scene setup
	scene = new THREE.Scene();
	scene.fog = new THREE.Fog( 0xffca28, 20, 60 );

	const light = new THREE.DirectionalLight( 0xffffff, 1 );
	light.position.set( - 1, 2, 3 );
	scene.add( light );
	scene.add( new THREE.AmbientLight( 0xb0bec5, 0.1 ) );

	// camera setup
	camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 50 );
	camera.position.set( 1, 2, 4 );
	camera.far = 100;
	camera.updateProjectionMatrix();

	controls = new OrbitControls( camera, renderer.domElement );

	transformControls = new TransformControls( camera, renderer.domElement );

	transformControls.addEventListener( 'dragging-changed', e => {

		controls.enabled = ! e.value;

	} );
	transformControls.addEventListener( 'objectChange', () => {

		needsUpdate = true;

	} );

	scene.add( transformControls );

	object1 = new Brush( new THREE.BoxBufferGeometry( 1, 1, 1 ), new THREE.MeshStandardMaterial( { flatShading: true } ) );
	object2 = new Brush( new THREE.BoxBufferGeometry( 1, 1, 1 ), new THREE.MeshStandardMaterial( { color: 0xff0000, flatShading: true } ) );

	object1.geometry.clearGroups()
	object2.geometry.clearGroups()
	object2.position.set( 0.28418117189178715, 0.31608825629673476, - 0.0804028657467819 );

	scene.add( object1, object2 );
	transformControls.attach( object2 );

	resultObject = new THREE.Mesh( new THREE.BufferGeometry(), new THREE.MeshStandardMaterial( { flatShading: true } ) );
	scene.add( resultObject );

	edgesHelper = new EdgesHelper();
	edgesHelper.color.set( 0xff0000 );
	scene.add( edgesHelper );

	triHelper = new TriangleSetHelper();
	triHelper.color.set( 0x0000ff );
	scene.add( triHelper );

	gui = new GUI();
	gui.add( params, 'operation', { ADDITION, SUBTRACTION, INTERSECTION, DIFFERENCE } ).onChange( () => {

		needsUpdate = true;

	} );
	gui.add( params, 'triHelper' );
	gui.add( params, 'edgeHelper' );

	window.addEventListener( 'resize', function () {

		camera.aspect = window.innerWidth / window.innerHeight;
		camera.updateProjectionMatrix();

		renderer.setSize( window.innerWidth, window.innerHeight );

	}, false );

}

function render() {

	requestAnimationFrame( render );

	object1.prepareGeometry();
	object2.prepareGeometry();
	object1.updateMatrixWorld();
	object2.updateMatrixWorld();

	resultObject.position.y = - 4;

	if ( needsUpdate ) {

		const startTime = window.performance.now();
		resultObject.geometry.dispose();
		resultObject.geometry = performOperation( object1, object2, params.operation );
		const deltaTime = window.performance.now() - startTime;

		outputContainer.innerText = `${ deltaTime.toFixed( 3 ) }ms`;
		needsUpdate = false;

	}

	edgesHelper.setEdges( window.EDGES );
	edgesHelper.position.y = - 4;
	edgesHelper.visible = params.edgeHelper;

	triHelper.setTriangles( [ window.SET[ 4 ].tri, ...window.SET[ 4 ].intersects ] );
	triHelper.position.y = - 4;
	triHelper.visible = params.triHelper;

	renderer.render( scene, camera );

}
