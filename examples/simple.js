import {
	WebGLRenderer,
	PCFSoftShadowMap,
	Scene,
	DirectionalLight,
	AmbientLight,
	PerspectiveCamera,
	BoxGeometry,
	DoubleSide,
	FrontSide,
	Mesh,
	BufferGeometry,
	MeshStandardMaterial,
	MeshBasicMaterial,
	SphereGeometry,
	MathUtils,
	CylinderGeometry,
	TorusGeometry,
	TorusKnotGeometry,
	BufferAttribute,
} from 'three';
import { GUI } from 'three/examples/jsm/libs/lil-gui.module.min.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
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
	REVERSE_SUBTRACTION,
	INTERSECTION,
	DIFFERENCE,
	HOLLOW_INTERSECTION,
	HOLLOW_SUBTRACTION,
} from '..';

window.logTriangleDefinitions = logTriangleDefinitions;

const params = {

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
let brush1, brush2;
let resultObject, wireframeResult, light, originalMaterial;
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
	renderer = new WebGLRenderer( { antialias: true } );
	renderer.setPixelRatio( window.devicePixelRatio );
	renderer.setSize( window.innerWidth, window.innerHeight );
	renderer.setClearColor( bgColor, 1 );
	renderer.shadowMap.enabled = true;
	renderer.shadowMap.type = PCFSoftShadowMap;
	document.body.appendChild( renderer.domElement );

	// scene setup
	scene = new Scene();

	// lights
	light = new DirectionalLight( 0xffffff, 3.5 );
	light.position.set( - 1, 2, 3 );
	scene.add( light, light.target );
	scene.add( new AmbientLight( 0xb0bec5, 0.35 ) );

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
	camera = new PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 50 );
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

	// bunny mesh has no UVs so skip that attribute
	csgEvaluator = new Evaluator();
	csgEvaluator.attributes = [ 'position', 'normal' ];

	// initialize brushes
	brush1 = new Brush( new BoxGeometry(), new GridMaterial() );
	brush2 = new Brush( new BoxGeometry(), new GridMaterial() );
	brush2.position.set( - 0.75, 0.75, 0 );
	brush2.scale.setScalar( 0.75 );

	updateBrush( brush1, params.brush1Shape, params.brush1Complexity );
	updateBrush( brush2, params.brush2Shape, params.brush2Complexity );

	// initialize materials
	brush1.material.opacity = 0.15;
	brush1.material.transparent = true;
	brush1.material.depthWrite = false;
	brush1.material.polygonOffset = true;
	brush1.material.polygonOffsetFactor = 0.2;
	brush1.material.polygonOffsetUnits = 0.2;
	brush1.material.side = DoubleSide;
	brush1.material.premultipliedAlpha = true;

	brush2.material.opacity = 0.15;
	brush2.material.transparent = true;
	brush2.material.depthWrite = false;
	brush2.material.polygonOffset = true;
	brush2.material.polygonOffsetFactor = 0.2;
	brush2.material.polygonOffsetUnits = 0.2;
	brush2.material.side = DoubleSide;
	brush2.material.premultipliedAlpha = true;
	brush2.material.roughness = 0.25;
	brush2.material.color.set( 0xE91E63 );

	brush1.receiveShadow = true;
	brush2.receiveShadow = true;
	transformControls.attach( brush2 );

	scene.add( brush1, brush2 );

	// create material map for transparent to opaque variants
	let mat;
	mat = brush1.material.clone();
	mat.side = FrontSide;
	mat.opacity = 1;
	mat.transparent = false;
	mat.depthWrite = true;
	materialMap.set( brush1.material, mat );

	mat = brush2.material.clone();
	mat.side = FrontSide;
	mat.opacity = 1;
	mat.transparent = false;
	mat.depthWrite = true;
	materialMap.set( brush2.material, mat );

	materialMap.forEach( ( m1, m2 ) => {

		m1.enableGrid = params.gridTexture;
		m2.enableGrid = params.gridTexture;

	} );

	// add object displaying the result
	resultObject = new Mesh( new BufferGeometry(), new MeshStandardMaterial( {
		flatShading: false,
		polygonOffset: true,
		polygonOffsetUnits: 0.1,
		polygonOffsetFactor: 0.1,
	} ) );
	resultObject.castShadow = true;
	resultObject.receiveShadow = true;
	originalMaterial = resultObject.material;
	scene.add( resultObject );

	// add wireframe representation
	wireframeResult = new Mesh( resultObject.geometry, new MeshBasicMaterial( {
		wireframe: true,
		color: 0,
		opacity: 0.15,
		transparent: true,
	} ) );
	scene.add( wireframeResult );

	// helpers
	edgesHelper = new EdgesHelper();
	edgesHelper.color.set( 0xE91E63 );
	scene.add( edgesHelper );

	trisHelper = new TriangleSetHelper();
	trisHelper.color.set( 0x00BCD4 );
	scene.add( trisHelper );

	bvhHelper1 = new MeshBVHVisualizer( brush1, 20 );
	bvhHelper2 = new MeshBVHVisualizer( brush2, 20 );
	scene.add( bvhHelper1, bvhHelper2 );

	bvhHelper1.update();
	bvhHelper2.update();

	// load bunny geometry
	const gltf = await new GLTFLoader()
		.setMeshoptDecoder( MeshoptDecoder )
		.loadAsync( 'https://raw.githubusercontent.com/gkjohnson/3d-demo-data/main/models/stanford-bunny/bunny.glb' );

	bunnyGeom = gltf.scene.children[ 0 ].geometry;
	bunnyGeom.computeVertexNormals();

	// gui
	gui = new GUI();
	gui.add( params, 'operation', { ADDITION, SUBTRACTION, REVERSE_SUBTRACTION, INTERSECTION, DIFFERENCE, HOLLOW_INTERSECTION, HOLLOW_SUBTRACTION } ).onChange( v => {

		needsUpdate = true;

		if ( v === HOLLOW_INTERSECTION || v === HOLLOW_SUBTRACTION ) {

			materialMap.forEach( m => m.side = DoubleSide );

		} else {

			materialMap.forEach( m => m.side = FrontSide );

		}

	} );
	gui.add( params, 'displayBrushes' );
	gui.add( params, 'displayControls' );
	gui.add( params, 'shadows' );
	gui.add( params, 'useGroups' ).onChange( () => needsUpdate = true );
	gui.add( params, 'vertexColors' ).onChange( v => {

		brush1.material.vertexColors = v;
		brush1.material.needsUpdate = true;

		brush2.material.vertexColors = v;
		brush2.material.needsUpdate = true;

		materialMap.forEach( m => {

			m.vertexColors = v;
			m.needsUpdate = true;

		} );

		csgEvaluator.attributes = v ?
			[ 'color', 'position', 'normal' ] :
			[ 'position', 'normal' ];

		needsUpdate = true;

	} );
	gui.add( params, 'gridTexture' ).onChange( v => {

		materialMap.forEach( ( m1, m2 ) => {

			m1.enableGrid = v;
			m2.enableGrid = v;

		} );

	} );
	gui.add( params, 'flatShading' ).onChange( v => {

		brush1.material.flatShading = v;
		brush1.material.needsUpdate = true;

		brush2.material.flatShading = v;
		brush2.material.needsUpdate = true;

		materialMap.forEach( m => {

			m.flatShading = v;
			m.needsUpdate = true;

		} );

	} );

	const brush1Folder = gui.addFolder( 'brush 1' );
	brush1Folder.add( params, 'brush1Shape', [ 'sphere', 'box', 'cylinder', 'torus', 'torus knot', 'mesh' ] ).name( 'shape' ).onChange( v => {

		updateBrush( brush1, v, params.brush1Complexity );
		bvhHelper1.update();

	} );
	brush1Folder.add( params, 'brush1Complexity', 0, 2 ).name( 'complexity' ).onChange( v => {

		updateBrush( brush1, params.brush1Shape, v );
		bvhHelper1.update();

	} );
	brush1Folder.addColor( params, 'brush1Color' ).onChange( v => {

		brush1.material.color.set( v );
		materialMap.get( brush1.material ).color.set( v );

	} );

	const brush2Folder = gui.addFolder( 'brush 2' );
	brush2Folder.add( params, 'brush2Shape', [ 'sphere', 'box', 'cylinder', 'torus', 'torus knot', 'mesh' ] ).name( 'shape' ).onChange( v => {

		updateBrush( brush2, v, params.brush2Complexity );
		bvhHelper2.update();

	} );
	brush2Folder.add( params, 'brush2Complexity', 0, 2 ).name( 'complexity' ).onChange( v => {

		updateBrush( brush2, params.brush2Shape, v );
		bvhHelper2.update();

	} );
	brush2Folder.addColor( params, 'brush2Color' ).onChange( v => {

		brush2.material.color.set( v );
		materialMap.get( brush2.material ).color.set( v );

	} );

	const debugFolder = gui.addFolder( 'debug' );
	debugFolder.add( params, 'enableDebugTelemetry' ).onChange( () => needsUpdate = true );
	debugFolder.add( params, 'displayIntersectionEdges' );
	debugFolder.add( params, 'displayTriangleIntersections' );
	debugFolder.add( params, 'wireframe' );
	debugFolder.add( params, 'displayBrush1BVH' );
	debugFolder.add( params, 'displayBrush2BVH' );

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

function updateBrush( brush, type, complexity ) {

	brush.geometry.dispose();
	switch ( type ) {

		case 'sphere':
			brush.geometry = new SphereGeometry(
				1,
				Math.round( MathUtils.lerp( 5, 32, complexity ) ),
				Math.round( MathUtils.lerp( 5, 16, complexity ) )
			);
			break;
		case 'box':
			const dim = Math.round( MathUtils.lerp( 1, 10, complexity ) );
			brush.geometry = new BoxGeometry( 1, 1, 1, dim, dim, dim );
			break;
		case 'cylinder':
			brush.geometry = new CylinderGeometry(
				0.5, 0.5, 1,
				Math.round( MathUtils.lerp( 5, 32, complexity ) ),
			);
			break;
		case 'torus':
			brush.geometry = new TorusGeometry(
				0.6,
				0.2,
				Math.round( MathUtils.lerp( 4, 16, complexity ) ),
				Math.round( MathUtils.lerp( 6, 30, complexity ) )
			);
			break;
		case 'torus knot':
			brush.geometry = new TorusKnotGeometry(
				0.6,
				0.2,
				Math.round( MathUtils.lerp( 16, 64, complexity ) ),
				Math.round( MathUtils.lerp( 4, 16, complexity ) ),
			);
			break;
		case 'mesh':
			brush.geometry = bunnyGeom.clone();
			break;

	}

	brush.geometry = brush.geometry.toNonIndexed();

	const position = brush.geometry.attributes.position;
	const array = new Float32Array( position.count * 3 );
	for ( let i = 0, l = array.length; i < l; i += 9 ) {

		array[ i + 0 ] = 1;
		array[ i + 1 ] = 0;
		array[ i + 2 ] = 0;

		array[ i + 3 ] = 0;
		array[ i + 4 ] = 1;
		array[ i + 5 ] = 0;

		array[ i + 6 ] = 0;
		array[ i + 7 ] = 0;
		array[ i + 8 ] = 1;

	}

	brush.geometry.setAttribute( 'color', new BufferAttribute( array, 3 ) );
	brush.prepareGeometry();
	needsUpdate = true;

}

function render() {

	requestAnimationFrame( render );

	brush2.scale.x = Math.max( brush2.scale.x, 0.01 );
	brush2.scale.y = Math.max( brush2.scale.y, 0.01 );
	brush2.scale.z = Math.max( brush2.scale.z, 0.01 );

	const enableDebugTelemetry = params.enableDebugTelemetry;
	if ( needsUpdate ) {

		needsUpdate = false;

		brush1.updateMatrixWorld();
		brush2.updateMatrixWorld();

		const startTime = window.performance.now();
		csgEvaluator.debug.enabled = enableDebugTelemetry;
		csgEvaluator.useGroups = params.useGroups;
		csgEvaluator.evaluate( brush1, brush2, params.operation, resultObject );

		if ( params.useGroups ) {

			resultObject.material = resultObject.material.map( m => materialMap.get( m ) );

		} else {

			resultObject.material = originalMaterial;

		}

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

	// 	const v = Object.keys( csgEvaluator.debug.triangleIntersectsA.data )[ window.TRI ];
	// 	const _matrix = new Matrix4();
	// 	_matrix
	// 		.copy( brush2.matrixWorld )
	// 		.invert()
	// 		.multiply( brush1.matrixWorld );


	// 	// This is the space that clipping happens in
	// 	const tris = [
	// 		...csgEvaluator.debug.triangleIntersectsA.getTrianglesAsArray( v ),
	// 		...csgEvaluator.debug.triangleIntersectsA.getIntersectionsAsArray( v ),
	// 	].map( t => {

	// 		t = t.clone();
	// 		t.a.applyMatrix4( _matrix );
	// 		t.b.applyMatrix4( _matrix );
	// 		t.c.applyMatrix4( _matrix );
	// 		return t;

	// 	} );

	// 	trisHelper.setTriangles( [ ...tris ] );
	// 	logTriangleDefinitions( ...tris );

	// }

	wireframeResult.visible = params.wireframe;
	brush1.visible = params.displayBrushes;
	brush2.visible = params.displayBrushes;

	light.castShadow = params.shadows;

	transformControls.enabled = params.displayControls;
	transformControls.visible = params.displayControls;

	edgesHelper.visible = enableDebugTelemetry && params.displayIntersectionEdges;
	trisHelper.visible = enableDebugTelemetry && params.displayTriangleIntersections;

	bvhHelper1.visible = params.displayBrush1BVH;
	bvhHelper2.visible = params.displayBrush2BVH;

	renderer.render( scene, camera );

}



