import {
	WebGLRenderer,
	Scene,
	DirectionalLight,
	AmbientLight,
	PerspectiveCamera,
	CylinderGeometry,
	FrontSide,
	DoubleSide,
	Mesh,
	BufferGeometry,
	MeshStandardMaterial,
	MeshBasicMaterial,
	Group,
	Euler,
	Quaternion,
	Vector3,
} from 'three';
import { GUI } from 'three/examples/jsm/libs/lil-gui.module.min.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
	Brush,
	Evaluator,
	ADDITION,
	SUBTRACTION,
	REVERSE_SUBTRACTION,
	INTERSECTION,
	DIFFERENCE,
	HOLLOW_INTERSECTION,
	HOLLOW_SUBTRACTION,
} from '..';

const params = {
	operation: SUBTRACTION,
	overlap: 0,
	rotation: 0,
	wireframe: false,
	displayBrushes: true,
};

let renderer, camera, scene, gui, outputContainer;
let controls;
let needsUpdate = true;
let csgEvaluator;
const testCases = [];

init();

function init() {

	const bgColor = 0x111111;

	outputContainer = document.getElementById( 'output' );

	// renderer setup
	renderer = new WebGLRenderer( { antialias: true } );
	renderer.setPixelRatio( window.devicePixelRatio );
	renderer.setSize( window.innerWidth, window.innerHeight );
	renderer.setClearColor( bgColor, 1 );
	document.body.appendChild( renderer.domElement );

	// scene setup
	scene = new Scene();

	// lights
	const light = new DirectionalLight( 0xffffff, 3.5 );
	light.position.set( - 1, 2, 3 );
	scene.add( light, light.target );
	scene.add( new AmbientLight( 0xb0bec5, 0.35 ) );

	// camera setup
	camera = new PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 100 );
	camera.position.set( 0, 5, 14 );
	camera.updateProjectionMatrix();

	// controls
	controls = new OrbitControls( camera, renderer.domElement );
	controls.target.set( 0, 0, 0 );
	controls.update();

	// evaluator
	csgEvaluator = new Evaluator();
	csgEvaluator.attributes = [ 'position', 'normal' ];
	csgEvaluator.useGroups = true;

	// create test cases spread along X axis
	const spacing = 4;
	const cases = buildTestCases();
	const totalWidth = ( cases.length - 1 ) * spacing;

	for ( let i = 0; i < cases.length; i ++ ) {

		const tc = cases[ i ];
		const xOffset = i * spacing - totalWidth / 2;

		const group = new Group();
		group.position.x = xOffset;
		scene.add( group );

		// brush materials
		const mat1 = new MeshStandardMaterial( {
			color: 0xffffff,
			opacity: 0.15,
			transparent: true,
			depthWrite: false,
			side: DoubleSide,
			premultipliedAlpha: true,
		} );

		const mat2 = new MeshStandardMaterial( {
			color: 0xE91E63,
			opacity: 0.15,
			transparent: true,
			depthWrite: false,
			side: DoubleSide,
			premultipliedAlpha: true,
			roughness: 0.25,
		} );

		tc.brush1.material = mat1;
		tc.brush2.material = mat2;
		group.add( tc.brush1, tc.brush2 );

		// opaque material variants for the result
		const opaque1 = mat1.clone();
		opaque1.side = FrontSide;
		opaque1.opacity = 1;
		opaque1.transparent = false;
		opaque1.depthWrite = true;

		const opaque2 = mat2.clone();
		opaque2.side = FrontSide;
		opaque2.opacity = 1;
		opaque2.transparent = false;
		opaque2.depthWrite = true;

		const materialMap = new Map();
		materialMap.set( mat1, opaque1 );
		materialMap.set( mat2, opaque2 );

		// result mesh
		const result = new Mesh( new BufferGeometry(), new MeshStandardMaterial() );
		scene.add( result );

		// wireframe overlay
		const wireframe = new Mesh( result.geometry, new MeshBasicMaterial( {
			wireframe: true,
			color: 0,
			opacity: 0.15,
			transparent: true,
		} ) );
		scene.add( wireframe );

		testCases.push( {
			label: tc.label,
			brush1: tc.brush1,
			brush2: tc.brush2,
			posStart: tc.posStart,
			posEnd: tc.posEnd,
			rotStart: tc.rotStart,
			rotEnd: tc.rotEnd,
			result,
			wireframe,
			materialMap,
		} );

	}

	// gui
	gui = new GUI();
	gui.add( params, 'operation', {
		ADDITION,
		SUBTRACTION,
		REVERSE_SUBTRACTION,
		INTERSECTION,
		DIFFERENCE,
		HOLLOW_INTERSECTION,
		HOLLOW_SUBTRACTION,
	} ).onChange( () => {

		needsUpdate = true;

	} );
	gui.add( params, 'overlap', 0, 1, 0.01 ).onChange( () => {

		needsUpdate = true;

	} );
	gui.add( params, 'rotation', 0, 1, 0.01 ).onChange( () => {

		needsUpdate = true;

	} );
	gui.add( params, 'wireframe' );
	gui.add( params, 'displayBrushes' );

	window.addEventListener( 'resize', function () {

		camera.aspect = window.innerWidth / window.innerHeight;
		camera.updateProjectionMatrix();
		renderer.setSize( window.innerWidth, window.innerHeight );

	}, false );

	render();

}

function buildTestCases() {

	const cases = [];

	// 1. Shared face, axis-aligned: two boxes stacked with a shared face
	{

		const posStart = new Vector3( 0, 2, 0 );
		const rotStart = new Quaternion();
		const brush1 = new Brush( new CylinderGeometry( 1, 1, 2, 20 ) );
		const brush2 = new Brush( new CylinderGeometry( 1, 1, 2, 20 ) );
		brush2.position.copy( posStart );
		cases.push( {
			label: 'axis-aligned',
			brush1,
			brush2,
			posStart,
			posEnd: new Vector3( 0, 0, 0 ),
			rotStart,
			rotEnd: rotStart.clone(),
		} );

	}

	// 2. Shared face, rotated: same setup but rotated to a non-axis-aligned orientation
	{

		const q = new Quaternion().setFromEuler( new Euler( 0.7, 0.4, 0.3 ) );
		const posStart = new Vector3( 0, 2, 0 ).applyQuaternion( q );
		const rotStart = q.clone();
		const brush1 = new Brush( new CylinderGeometry( 1, 1, 2, 20 ) );
		const brush2 = new Brush( new CylinderGeometry( 1, 1, 2, 20 ) );
		brush1.quaternion.copy( q );
		brush2.quaternion.copy( q );
		brush2.position.copy( posStart );
		cases.push( {
			label: 'rotated',
			brush1,
			brush2,
			posStart,
			posEnd: new Vector3( 0, 0, 0 ),
			rotStart,
			rotEnd: rotStart.clone(),
		} );

	}

	// 3. Partial overlap: small box centered on one face of a large box
	{

		const posStart = new Vector3( 0, 1.5, 0 );
		const rotStart = new Quaternion();
		const brush1 = new Brush( new CylinderGeometry( 1, 1, 2, 20 ) );
		const brush2 = new Brush( new CylinderGeometry( 0.5, 0.5, 1, 20 ) );
		brush2.position.copy( posStart );
		cases.push( {
			label: 'partial overlap',
			brush1,
			brush2,
			posStart,
			posEnd: new Vector3( 0, 0, 0 ),
			rotStart,
			rotEnd: rotStart.clone(),
		} );

	}

	// 4. Epsilon offset: shared face with a tiny gap
	{

		const posStart = new Vector3( 0, 2 + 1e-7, 0 );
		const rotStart = new Quaternion();
		const brush1 = new Brush( new CylinderGeometry( 1, 1, 2, 20 ) );
		const brush2 = new Brush( new CylinderGeometry( 1, 1, 2, 20 ) );
		brush2.position.copy( posStart );
		cases.push( {
			label: 'epsilon offset',
			brush1,
			brush2,
			posStart,
			posEnd: new Vector3( 0, 1e-7, 0 ),
			rotStart,
			rotEnd: rotStart.clone(),
		} );

	}

	// 5. Rotated brush2: brush2 rotated 45deg around Y, touching brush1's top face
	{

		const posStart = new Vector3( 0, 2, 0 );
		const rotStart = new Quaternion().setFromEuler( new Euler( 0, Math.PI / 4, 0 ) );
		const rotEnd = new Quaternion().setFromAxisAngle( new Vector3( 0, 1, 0 ), 3 * Math.PI / 4 );
		const brush1 = new Brush( new CylinderGeometry( 1, 1, 2, 20 ) );
		const brush2 = new Brush( new CylinderGeometry( 1, 1, 2, 20 ) );
		brush2.quaternion.copy( rotStart );
		brush2.position.copy( posStart );
		cases.push( {
			label: 'rotated 45',
			brush1,
			brush2,
			posStart,
			posEnd: new Vector3( 1, 2, 1 ),
			rotStart,
			rotEnd,
		} );

	}

	// 6. Scale mismatch: large box + small box sharing a face
	{

		const posStart = new Vector3( 0, 1.75, 0 );
		const rotStart = new Quaternion();
		const brush1 = new Brush( new CylinderGeometry( 1.5, 1.5, 3, 20 ) );
		const brush2 = new Brush( new CylinderGeometry( 0.25, 0.25, 0.5, 20 ) );
		brush2.position.copy( posStart );
		cases.push( {
			label: 'scale mismatch',
			brush1,
			brush2,
			posStart,
			posEnd: new Vector3( 0, 0, 0 ),
			rotStart,
			rotEnd: rotStart.clone(),
		} );

	}

	return cases;

}

function render() {

	requestAnimationFrame( render );

	if ( needsUpdate ) {

		needsUpdate = false;
		scene.updateMatrixWorld( true );
		for ( let i = 0; i < testCases.length; i ++ ) {

			const tc = testCases[ i ];
			const t0 = window.performance.now();

			tc.brush2.position.lerpVectors( tc.posStart, tc.posEnd, params.overlap );
			tc.brush2.quaternion.slerpQuaternions( tc.rotStart, tc.rotEnd, params.rotation );

			// force parent group matrices to propagate before CSG evaluation
			tc.brush1.updateMatrixWorld( true );
			tc.brush2.updateMatrixWorld( true );

			csgEvaluator.evaluate( tc.brush1, tc.brush2, params.operation, tc.result );
			tc.result.material = tc.result.material.map( m => tc.materialMap.get( m ) );

		}

	}

	for ( const tc of testCases ) {

		tc.brush1.visible = params.displayBrushes;
		tc.brush2.visible = params.displayBrushes;
		tc.wireframe.visible = params.wireframe;

	}

	renderer.render( scene, camera );

}
