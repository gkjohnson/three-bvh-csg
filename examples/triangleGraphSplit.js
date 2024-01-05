import * as THREE from 'three';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EdgesHelper, PointsHelper, TriangleSetHelper } from '../src/index.js';
import { TriangleGraphSplitter } from '../src/core/splitter/TriangleGraphSplitter.js';

let renderer, camera, scene;
let controls, transformControls;
let planeObject, planeHelper;
let splitter, clippedTris, initialTris, pointsHelper, edgesHelper;
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
		new THREE.Vector3( - 0.35, 0.5, - 0.5 ),
		new THREE.Vector3( - 0.35, - 0.5, - 0.5 ),
		new THREE.Vector3( - 0.35, 0.5, 0.5 ),
	),
	new THREE.Triangle(
		new THREE.Vector3( - 0.35, 0.5, - 0.5 ),
		new THREE.Vector3( - 0.35, 0.5, 0.5 ),
		new THREE.Vector3( 0.35, 0.5, - 0.5 ),
	),
	new THREE.Triangle(
		new THREE.Vector3( - 0.5, 0.7, - 0.5 ),
		new THREE.Vector3( - 0.5, - 0.5, - 0.5 ),
		new THREE.Vector3( - 0.5, 0.7, 0.5 ),
	),


	// new THREE.Triangle(
	// 	new THREE.Vector3( -0.5, 0.75, 0.5 ),
	// 	new THREE.Vector3( 0.5, 0.75, 0.5 ),
	// 	new THREE.Vector3( 0.5, 0.75, -0.5 ),
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
	camera.position.set( - 1.5, 2, - 2 );
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
	pointsHelper = new PointsHelper();
	edgesHelper = new EdgesHelper();

	splitter = new TriangleGraphSplitter();

	scene.add( initialTris, clippedTris, pointsHelper, edgesHelper );

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

	if ( ! window.UPDATED ) {

		splitter.initialize( ogTris[ 0 ] );
		tris.forEach( ( t, i ) => {

			splitter.splitByTriangle( t, i === 2 );

		} );

		splitter.complete();

		window.UPDATED = true;
		window.SPLITTER = splitter;

	}

	splitter.graph.validate();

	planeHelper.visible = false;
	transformControls.visible = false;
	transformControls.enabled = false;

	// pointsHelper.setPoints( splitter.graph.points );
	// edgesHelper.setEdges( splitter.graph.edges );

	clippedTris.color.set( 0x00ff00 )
	clippedTris.setTriangles( splitter.graph.triangles );
	initialTris.setTriangles( [ ...tris ] );

	renderer.render( scene, camera );

}
