import * as THREE from 'three';
import { GUI } from 'three/examples/jsm/libs/lil-gui.module.min.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { MeshBVHVisualizer } from 'three-mesh-bvh';
import {
	Brush,
	Evaluator,
	EdgesHelper,
	TriangleSetHelper,
	logTriangleDefinitions,
	GridMaterial,
	ADDITION,
	SUBTRACTION,
	INTERSECTION,
	DIFFERENCE,
} from '..';

window.logTriangleDefinitions = logTriangleDefinitions;

const OPERATION = SUBTRACTION;

const params = {

	displayBrushes: true,
	wireframe: false,
	enableDebugTelemetry: true,
	displayIntersectionEdges: false,
	displayTriangleIntersections: false,
	displayBrush1BVH: false,
	displayBrush2BVH: false,

};

let renderer, camera, scene, gui, outputContainer;
let controls;
let brush1, brush2;
let resultObject, wireframeResult, light, light2, originalMaterial;
let edgesHelper, trisHelper;
let bvhHelper1, bvhHelper2;
let bunnyGeom;
let needsUpdate = true;
let csgEvaluator;

const materialMap = new Map();

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
	light = new THREE.DirectionalLight( 0xffffff, 1 );
	light.position.set( - 1, 2, 3 );

	light2 = new THREE.DirectionalLight( 0xffffff, 0.25 );
	light2.position.set( - 1, 2, 3 ).multiplyScalar( - 1 );

	scene.add( light, light2 );
	scene.add( new THREE.AmbientLight( 0xb0bec5, 0.1 ) );

	// camera setup
	camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 50 );
	camera.position.set( 1, 2, 4 );
	camera.far = 100;
	camera.updateProjectionMatrix();

	// controls
	controls = new OrbitControls( camera, renderer.domElement );

	// bunny mesh has no UVs so skip that attribute
	csgEvaluator = new Evaluator();
	csgEvaluator.attributes = [ 'position', 'normal' ];

	// initialize brushes
	brush1 = new Brush( new THREE.CylinderGeometry( 1, 1, 1, 50 ), new GridMaterial() );
	brush2 = new Brush( new THREE.CylinderGeometry( 1, 1, 1, 50 ), new GridMaterial() );
	// brush2.position.set( - 0.75, 0.75, 0 );
	// brush2.scale.setScalar( 0.75 );

	brush1.scale.set( 0.5, 5, 0.5 );
	brush2.scale.set( 0.5, 5, 0.5 );
	brush2.rotation.x = Math.PI / 2;

	// initialize materials
	brush1.material.opacity = 0.15;
	brush1.material.transparent = true;
	brush1.material.depthWrite = false;
	brush1.material.polygonOffset = true;
	brush1.material.polygonOffsetFactor = 0.2;
	brush1.material.polygonOffsetUnits = 0.2;
	brush1.material.side = THREE.DoubleSide;
	brush1.material.premultipliedAlpha = true;

	brush2.material.opacity = 0.15;
	brush2.material.transparent = true;
	brush2.material.depthWrite = false;
	brush2.material.polygonOffset = true;
	brush2.material.polygonOffsetFactor = 0.2;
	brush2.material.polygonOffsetUnits = 0.2;
	brush2.material.side = THREE.DoubleSide;
	brush2.material.premultipliedAlpha = true;
	brush2.material.roughness = 0.25;
	brush2.material.color.set( 0xE91E63 );

	scene.add( brush1, brush2 );

	// create material map for transparent to opaque variants
	let mat;
	mat = brush1.material.clone();
	mat.side = THREE.FrontSide;
	mat.opacity = 1;
	mat.transparent = false;
	mat.depthWrite = true;
	materialMap.set( brush1.material, mat );

	mat = brush2.material.clone();
	mat.side = THREE.FrontSide;
	mat.opacity = 1;
	mat.transparent = false;
	mat.depthWrite = true;
	materialMap.set( brush2.material, mat );

	materialMap.forEach( ( m1, m2 ) => {

		m1.enableGrid = false;
		m2.enableGrid = false;

	} );

	// add object displaying the result
	resultObject = new THREE.Mesh( new THREE.BufferGeometry(), new THREE.MeshStandardMaterial( {
		flatShading: false,
		polygonOffset: true,
		polygonOffsetUnits: 0.1,
		polygonOffsetFactor: 0.1,
	} ) );
	originalMaterial = resultObject.material;
	scene.add( resultObject );

	// add wireframe representation
	wireframeResult = new THREE.Mesh( resultObject.geometry, new THREE.MeshBasicMaterial( {
		wireframe: true,
		color: 0xffffff,
		opacity: 1,
		transparent: true,
	} ) );
	scene.add( wireframeResult );

	// helpers
	edgesHelper = new EdgesHelper();
	edgesHelper.color.set( 0x00ff00 );
	scene.add( edgesHelper );

	trisHelper = new TriangleSetHelper();
	trisHelper.color.set( 0x00BCD4 );
	scene.add( trisHelper );

	bvhHelper1 = new MeshBVHVisualizer( brush1, 20 );
	bvhHelper2 = new MeshBVHVisualizer( brush2, 20 );
	scene.add( bvhHelper1, bvhHelper2 );

	// load bunny geometry
	const gltf = await new GLTFLoader()
		.setMeshoptDecoder( MeshoptDecoder )
		.loadAsync( 'https://raw.githubusercontent.com/gkjohnson/3d-demo-data/main/models/stanford-bunny/bunny.glb' );

	bunnyGeom = gltf.scene.children[ 0 ].geometry;
	bunnyGeom.computeVertexNormals();

	// gui
	gui = new GUI();

	gui.add( params, 'wireframe' );
	gui.add( params, 'displayBrushes' );
	gui.add( params, 'enableDebugTelemetry' ).onChange( () => needsUpdate = true );
	gui.add( params, 'displayIntersectionEdges' );
	gui.add( params, 'displayTriangleIntersections' );
	gui.add( params, 'displayBrush1BVH' );
	gui.add( params, 'displayBrush2BVH' );

	window.addEventListener( 'resize', function () {

		camera.aspect = window.innerWidth / window.innerHeight;
		camera.updateProjectionMatrix();

		renderer.setSize( window.innerWidth, window.innerHeight );

	}, false );

	render();

}

function render() {

	requestAnimationFrame( render );

	const enableDebugTelemetry = params.enableDebugTelemetry;
	if ( needsUpdate ) {

		needsUpdate = false;

		brush1.updateMatrixWorld();
		brush2.updateMatrixWorld();

		bvhHelper1.update();
		bvhHelper2.update();

		const startTime = window.performance.now();
		csgEvaluator.debug.enabled = enableDebugTelemetry;
		csgEvaluator.useGroups = true;
		csgEvaluator.evaluate( brush1, brush2, OPERATION, resultObject );
		resultObject.material = resultObject.material.map( m => materialMap.get( m ) );

		const deltaTime = window.performance.now() - startTime;
		outputContainer.innerText = `${ deltaTime.toFixed( 3 ) }ms`;

		if ( enableDebugTelemetry ) {

			edgesHelper.setEdges( csgEvaluator.debug.intersectionEdges );

			trisHelper.setTriangles( [
				...csgEvaluator.debug.triangleIntersectsA.getTrianglesAsArray(),
				...csgEvaluator.debug.triangleIntersectsA.getIntersectionsAsArray()
			] );

		}

	}

	// window.CSG_DEBUG = csgEvaluator.debug;
	// if ( window.TRI !== undefined ) {

	// 	trisHelper.setTriangles( [
	// 		...csgEvaluator.debug.triangleIntersectsA.getTrianglesAsArray( window.TRI ),
	// 		...csgEvaluator.debug.triangleIntersectsA.getIntersectionsAsArray( window.TRI )
	// 	] );

	// 	logTriangleDefinitions(
	// 		...csgEvaluator.debug.triangleIntersectsA.getTrianglesAsArray( window.TRI ),
	// 		...csgEvaluator.debug.triangleIntersectsA.getIntersectionsAsArray( window.TRI )
	// 	);

	// }

	wireframeResult.visible = params.wireframe;

	edgesHelper.visible = enableDebugTelemetry && params.displayIntersectionEdges;
	trisHelper.visible = enableDebugTelemetry && params.displayTriangleIntersections;

	bvhHelper1.visible = params.displayBrush1BVH;
	bvhHelper2.visible = params.displayBrush2BVH;

	brush1.visible = params.displayBrushes;
	brush2.visible = params.displayBrushes;

	renderer.render( scene, camera );

}



