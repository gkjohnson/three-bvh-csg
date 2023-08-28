import * as THREE from 'three';
import { GUI } from 'three/examples/jsm/libs/lil-gui.module.min.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
	Brush,
	Evaluator,
	ADDITION,
	SUBTRACTION,
	INTERSECTION,
} from '..';

let renderer, camera, scene, controls, gui, light, wireframeResult;
init();
render();

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
	light.shadow.bias = 1e-5;
	light.shadow.normalBias = 1e-2;

	shadowCam.left = shadowCam.bottom = - 2.5;
	shadowCam.right = shadowCam.top = 2.5;
	shadowCam.updateProjectionMatrix();

	// camera setup
	camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 50 );
	camera.position.set( - 2, 1.5, 2 );
	camera.far = 100;
	camera.updateProjectionMatrix();

	// controls
	controls = new OrbitControls( camera, renderer.domElement );

	// floor
	const floor = new THREE.Mesh( new THREE.PlaneGeometry(), new THREE.ShadowMaterial( { opacity: 0.05 } ) );
	floor.material.color.set( 0xE0F7FA );
	floor.rotation.x = - Math.PI / 2;
	floor.scale.setScalar( 10 );
	floor.position.y = - 0.75;
	floor.receiveShadow = true;
	scene.add( floor );

	// materials
	const redMaterial = new THREE.MeshStandardMaterial( { roughness: 0.25 } );
	const greenMaterial = new THREE.MeshStandardMaterial( { roughness: 0.25 } );
	const blueMaterial = new THREE.MeshStandardMaterial( { roughness: 0.25 } );

	redMaterial.color.set( 0xFF1744 );
	greenMaterial.color.set( 0x76FF03 );
	blueMaterial.color.set( 0x2979FF );

	// basic pieces
	const cylinder1 = new Brush( new THREE.CylinderGeometry( 0.5, 0.5, 6, 45 ), blueMaterial );
	cylinder1.updateMatrixWorld();

	const cylinder2 = new Brush( new THREE.CylinderGeometry( 0.5, 0.5, 6, 45 ), blueMaterial );
	cylinder2.rotation.x = Math.PI / 2;
	cylinder2.updateMatrixWorld();

	const cylinder3 = new Brush( new THREE.CylinderGeometry( 0.5, 0.5, 6, 45 ), blueMaterial );
	cylinder3.rotation.z = Math.PI / 2;
	cylinder3.updateMatrixWorld();

	const sphere = new Brush( new THREE.SphereGeometry( 1, 50, 50 ), greenMaterial );
	sphere.updateMatrixWorld();

	const box = new Brush( new THREE.BoxGeometry( 1.5, 1.5, 1.5 ), redMaterial );
	box.updateMatrixWorld();

	// processing
	const evaluator = new Evaluator();
	let result;
	result = evaluator.evaluate( cylinder1, cylinder2, ADDITION );
	result = evaluator.evaluate( result, cylinder3, ADDITION );
	result = evaluator.evaluate( sphere, result, SUBTRACTION );
	result = evaluator.evaluate( box, result, INTERSECTION );

	result.castShadow = true;
	result.receiveShadow = true;
	scene.add( result );

	// add wireframe representation
	wireframeResult = new THREE.Mesh( result.geometry, new THREE.MeshBasicMaterial( {
		wireframe: true,
		color: 0,
		opacity: 0.15,
		transparent: true,
	} ) );
	wireframeResult.material.color.set( 0x001516 );
	wireframeResult.visible = false;
	scene.add( wireframeResult );

	// gui
	gui = new GUI();
	gui.add( wireframeResult, 'visible' ).name( 'wireframe' );

	window.addEventListener( 'resize', function () {

		camera.aspect = window.innerWidth / window.innerHeight;
		camera.updateProjectionMatrix();

		renderer.setSize( window.innerWidth, window.innerHeight );

	}, false );


}

function render() {

	requestAnimationFrame( render );
	renderer.render( scene, camera );

}
