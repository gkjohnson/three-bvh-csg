import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GUI } from 'three/examples/jsm/libs/lil-gui.module.min.js';
import {
	Brush,
	Evaluator,
	HOLLOW_SUBTRACTION,
	HOLLOW_INTERSECTION,
} from '..';

let renderer, camera, scene, light, controls;
let brush1, brush2, result, gui;
let csgEvaluator = new Evaluator();
csgEvaluator.attributes = [ 'position', 'normal', 'color' ];
csgEvaluator.useGroups = false;

const params = {
	displayBrush: true,
	operation: HOLLOW_INTERSECTION,
};

init();

async function init() {

	const bgColor = 0x111111;

	// renderer setup
	renderer = new THREE.WebGLRenderer( { antialias: true } );
	renderer.setPixelRatio( window.devicePixelRatio );
	renderer.setSize( window.innerWidth, window.innerHeight );
	renderer.setClearColor( bgColor, 1 );
	renderer.shadowMap.enabled = true;
	renderer.shadowMap.type = THREE.PCFSoftShadowMap;
	document.body.appendChild( renderer.domElement );

	// scene setup
	scene = new THREE.Scene();

	// lights
	light = new THREE.DirectionalLight( 0xffffff, 3.5 );
	light.position.set( 1, 2, 1 );
	scene.add( light, new THREE.AmbientLight( 0xb0bec5, 0.35 ) );

	// shadows
	const shadowCam = light.shadow.camera;
	light.castShadow = true;
	light.shadow.mapSize.setScalar( 4096 );
	light.shadow.bias = - 1e-5;

	shadowCam.left = shadowCam.bottom = - 3.5;
	shadowCam.right = shadowCam.top = 3.5;
	shadowCam.updateProjectionMatrix();

	brush1 = new Brush(
		generateTriangleGeometry(),
		new THREE.MeshStandardMaterial( {
			vertexColors: true,
			side: THREE.DoubleSide,
			roughness: 0.2,
		} ),
	);

	brush2 = new Brush(
		new THREE.SphereGeometry(),
		new THREE.MeshBasicMaterial( {
			color: 0xffffff,
			transparent: true,
			depthWrite: false,
			opacity: 0.1,
			side: THREE.BackSide,
		} ),
	);
	brush2.scale.setScalar( 2 );
	scene.add( brush2 );

	result = new THREE.Mesh();
	scene.add( result );

	// camera setup
	camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 50 );
	camera.position.set( - 1.25, 1.5, 2.5 ).multiplyScalar( 2.5 );
	camera.far = 100;
	camera.updateProjectionMatrix();

	// controls
	controls = new OrbitControls( camera, renderer.domElement );

	// floor
	const floor = new THREE.Mesh(
		new THREE.PlaneGeometry(),
		new THREE.ShadowMaterial( {
			opacity: 0.05,
			depthWrite: false,
			transparent: true,
		} ),
	);
	floor.material.color.set( 0xE0F7FA );
	floor.rotation.x = - Math.PI / 2;
	floor.scale.setScalar( 10 );
	floor.position.y = - 3;
	floor.receiveShadow = true;
	scene.add( floor );

	gui = new GUI();
	gui.add( params, 'operation', { NONE: - 1, HOLLOW_INTERSECTION, HOLLOW_SUBTRACTION } );
	gui.add( params, 'displayBrush' );

	window.addEventListener( 'resize', function () {

		camera.aspect = window.innerWidth / window.innerHeight;
		camera.updateProjectionMatrix();

		renderer.setSize( window.innerWidth, window.innerHeight );

	}, false );

	render();

}

function generateTriangleGeometry() {

	// From three.js "webgl_interactive_buffergeometry" example
	const triangles = 5000;

	let geometry = new THREE.BufferGeometry();

	const positions = new Float32Array( triangles * 3 * 3 );
	const normals = new Float32Array( triangles * 3 * 3 );
	const colors = new Float32Array( triangles * 3 * 3 );

	const color = new THREE.Color();

	const n = 800, n2 = n / 2;	// triangles spread in the cube
	const d = 120, d2 = d / 2;	// individual triangle size

	const pA = new THREE.Vector3();
	const pB = new THREE.Vector3();
	const pC = new THREE.Vector3();

	const cb = new THREE.Vector3();
	const ab = new THREE.Vector3();

	for ( let i = 0; i < positions.length; i += 9 ) {

		// positions

		const x = Math.random() * n - n2;
		const y = Math.random() * n - n2;
		const z = Math.random() * n - n2;

		const ax = x + Math.random() * d - d2;
		const ay = y + Math.random() * d - d2;
		const az = z + Math.random() * d - d2;

		const bx = x + Math.random() * d - d2;
		const by = y + Math.random() * d - d2;
		const bz = z + Math.random() * d - d2;

		const cx = x + Math.random() * d - d2;
		const cy = y + Math.random() * d - d2;
		const cz = z + Math.random() * d - d2;

		positions[ i ] = ax;
		positions[ i + 1 ] = ay;
		positions[ i + 2 ] = az;

		positions[ i + 3 ] = bx;
		positions[ i + 4 ] = by;
		positions[ i + 5 ] = bz;

		positions[ i + 6 ] = cx;
		positions[ i + 7 ] = cy;
		positions[ i + 8 ] = cz;

		// flat face normals

		pA.set( ax, ay, az );
		pB.set( bx, by, bz );
		pC.set( cx, cy, cz );

		cb.subVectors( pC, pB );
		ab.subVectors( pA, pB );
		cb.cross( ab );

		cb.normalize();

		const nx = cb.x;
		const ny = cb.y;
		const nz = cb.z;

		normals[ i ] = nx;
		normals[ i + 1 ] = ny;
		normals[ i + 2 ] = nz;

		normals[ i + 3 ] = nx;
		normals[ i + 4 ] = ny;
		normals[ i + 5 ] = nz;

		normals[ i + 6 ] = nx;
		normals[ i + 7 ] = ny;
		normals[ i + 8 ] = nz;

		// colors

		const vx = ( x / n ) + 0.5;
		const vy = ( y / n ) + 0.5;
		const vz = ( z / n ) + 0.5;

		color.setRGB( vx, vy, vz );

		colors[ i ] = color.r;
		colors[ i + 1 ] = color.g;
		colors[ i + 2 ] = color.b;

		colors[ i + 3 ] = color.r;
		colors[ i + 4 ] = color.g;
		colors[ i + 5 ] = color.b;

		colors[ i + 6 ] = color.r;
		colors[ i + 7 ] = color.g;
		colors[ i + 8 ] = color.b;

	}

	geometry.setAttribute( 'position', new THREE.BufferAttribute( positions, 3 ) );
	geometry.setAttribute( 'normal', new THREE.BufferAttribute( normals, 3 ) );
	geometry.setAttribute( 'color', new THREE.BufferAttribute( colors, 3 ) );
	geometry.scale( 0.0055, 0.0055, 0.0055 );

	return geometry;

}


function render() {

	requestAnimationFrame( render );
	brush2.position.y = 2 * Math.sin( window.performance.now() * 0.0025 * 0.5 );
	brush2.position.x = 2 * Math.sin( window.performance.now() * 0.0035 * 0.5 );
	brush2.position.z = 2 * Math.sin( window.performance.now() * 0.002 * 0.5 );
	brush2.visible = params.displayBrush;
	brush2.updateMatrixWorld( true );

	if ( params.operation === - 1 ) {

		result.geometry.dispose();
		result.geometry.copy( brush1.geometry );

	} else {

		result = csgEvaluator.evaluate( brush1, brush2, params.operation, result );
		result.castShadow = true;
		result.receiveShadow = true;

	}

	renderer.render( scene, camera );

}



