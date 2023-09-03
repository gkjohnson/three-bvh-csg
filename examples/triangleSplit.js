import * as THREE from 'three';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TriangleSplitter, TriangleSetHelper } from '..';

let renderer, camera, scene;
let controls, transformControls;
let planeObject, planeHelper;
let splitter, clippedTris, initialTris;
let plane = new THREE.Plane();
let _vec = new THREE.Vector3();

const ogTris = [
	new THREE.Triangle(
		new THREE.Vector3( - 0.25, 1.25, 0.25 ),
		new THREE.Vector3( - 0.25, 0.25, 0.25 ),
		new THREE.Vector3( - 1.25, 1.25, 0.25 ),
	)
];

const tris = [
	new THREE.Triangle(
		new THREE.Vector3( - 0.5, 0.5, - 0.5 ),
		new THREE.Vector3( - 0.5, - 0.5, - 0.5 ),
		new THREE.Vector3( - 0.5, 0.5, 0.5 ),
	),
	new THREE.Triangle(
		new THREE.Vector3( - 0.5, 0.5, - 0.5 ),
		new THREE.Vector3( - 0.5, 0.5, 0.5 ),
		new THREE.Vector3( 0.5, 0.5, - 0.5 ),
	),
	// new THREE.Triangle(
	// 	new THREE.Vector3( -0.5, 0.5, 0.5 ),
	// 	new THREE.Vector3( 0.5, 0.5, 0.5 ),
	// 	new THREE.Vector3( 0.5, 0.5, -0.5 ),
	// ),
];

init();
render();

function init() {

	const bgColor = 0x111111;

	// renderer setup
	renderer = new THREE.WebGLRenderer( { antialias: true } );
	renderer.setPixelRatio( window.devicePixelRatio );
	renderer.setSize( window.innerWidth, window.innerHeight );
	renderer.setClearColor( bgColor, 1 );
	document.body.appendChild( renderer.domElement );

	// scene setup
	scene = new THREE.Scene();
	scene.fog = new THREE.Fog( 0xffca28, 20, 60 );

	const light = new THREE.DirectionalLight( 0xffffff, 3.5 );
	light.position.set( - 1, 2, 3 );
	scene.add( light );
	scene.add( new THREE.AmbientLight( 0xb0bec5, 0.35 ) );

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
	scene.add( transformControls );

	planeObject = new THREE.Object3D();
	transformControls.attach( planeObject );
	scene.add( planeObject );
	planeObject.position.z = 0.5;
	planeObject.rotation.y = Math.PI / 2;

	planeHelper = new THREE.PlaneHelper( plane );
	scene.add( planeHelper );

	initialTris = new TriangleSetHelper();
	clippedTris = new TriangleSetHelper();

	splitter = new TriangleSplitter();

	scene.add( initialTris, clippedTris );

	window.addEventListener( 'resize', function () {

		camera.aspect = window.innerWidth / window.innerHeight;
		camera.updateProjectionMatrix();

		renderer.setSize( window.innerWidth, window.innerHeight );

	}, false );

}

function render() {

	requestAnimationFrame( render );

	_vec.set( 0, 0, 1 ).transformDirection( planeObject.matrixWorld );
	plane.setFromNormalAndCoplanarPoint( _vec, planeObject.position );

	splitter.initialize( ogTris );
	tris.forEach( t => {

		splitter.splitByTriangle( t );

	} );

	planeHelper.visible = false;
	transformControls.visible = false;
	transformControls.enabled = false;

	clippedTris.setTriangles( splitter.triangles );
	initialTris.setTriangles( [ ...ogTris, ...tris ] );

	renderer.render( scene, camera );

}
