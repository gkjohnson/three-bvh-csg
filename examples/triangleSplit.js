import * as THREE from 'three';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TriangleSplitter, TriangleSetHelper } from '..';

let renderer, camera, scene;
let controls, transformControls;
let planeObject, planeHelper;
let splitter, clippedTris;
let plane = new THREE.Plane();
let _vec = new THREE.Vector3();

const tri = new THREE.Triangle(
	new THREE.Vector3(0.5,-0.5,-0.5),
	new THREE.Vector3(-0.5,-0.5,-0.5),
	new THREE.Vector3(-0.5,0.5,-0.5),
);

const tris = [
	// new THREE.Triangle(
	// 	new THREE.Vector3(-0.21581882810821285,-0.18391174370326524,-0.5804028657467819),
	// 	new THREE.Vector3(-0.21581882810821285,-0.18391174370326524,0.4195971342532181),
	// 	new THREE.Vector3(-0.21581882810821285,0.8160882562967348,0.4195971342532181),
	// ),
	new THREE.Triangle(
		new THREE.Vector3(-0.21581882810821285,0.8160882562967348,-0.5804028657467819),
		new THREE.Vector3(-0.21581882810821285,-0.18391174370326524,-0.5804028657467819),
		new THREE.Vector3(-0.21581882810821285,0.8160882562967348,0.4195971342532181),
	),
	new THREE.Triangle(
		new THREE.Vector3(-0.21581882810821285,-0.18391174370326524,-0.5804028657467819),
		new THREE.Vector3(0.7841811718917872,-0.18391174370326524,-0.5804028657467819),
		new THREE.Vector3(0.7841811718917872,-0.18391174370326524,0.4195971342532181),
	),
	new THREE.Triangle(
		new THREE.Vector3(-0.21581882810821285,-0.18391174370326524,0.4195971342532181),
		new THREE.Vector3(-0.21581882810821285,-0.18391174370326524,-0.5804028657467819),
		new THREE.Vector3(0.7841811718917872,-0.18391174370326524,0.4195971342532181),
	),
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
	// scene.add( transformControls );

	planeObject = new THREE.Object3D();
	transformControls.attach( planeObject );
	scene.add( planeObject );
	planeObject.position.z = 0.5;
	planeObject.rotation.y = Math.PI / 2;

	planeHelper = new THREE.PlaneHelper( plane );
	// scene.add( planeHelper );

	clippedTris = new TriangleSetHelper();
	splitter = new TriangleSplitter();

	scene.add( new TriangleSetHelper( [ tri, ...tris ] ), clippedTris );

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

	clipper.initialize( tri );
	// clipper.clipByPlane( plane );
	tris.forEach( t => {

		t.getPlane( plane );
		clipper.clipByPlane( plane );

	} );

	// console.log( clipper.triangles.length );
	// console.log( clipper.triangles.map( t => t.getArea() ) );


	clippedTris.setTriangles( clipper.triangles );

	clippedTris.position.y = - 2;

	renderer.render( scene, camera );

}
