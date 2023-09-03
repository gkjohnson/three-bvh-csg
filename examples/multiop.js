import {
	WebGLRenderer,
	PCFSoftShadowMap,
	Scene,
	DirectionalLight,
	AmbientLight,
	PerspectiveCamera,
	DoubleSide,
	Mesh,
	MeshStandardMaterial,
	ShadowMaterial,
	PlaneGeometry,
	CylinderGeometry,
	IcosahedronGeometry,
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
	Brush,
	Evaluator,
	logTriangleDefinitions,
	ADDITION,
	SUBTRACTION,
	REVERSE_SUBTRACTION,
	INTERSECTION,
} from '../src';

window.logTriangleDefinitions = logTriangleDefinitions;

let renderer, camera, controls, scene;
let brush1, brush2;
let result, result2, result3, result4, light;
let csgEvaluator;
let mat1, mat2, transMat1, transMat2;

init();

async function init() {

	// const bgColor = bf360c;
	//  004d40
	const bgColor = 0x15100c;

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
	light.position.set( 0, 2, 0 );
	light.castShadow = true;
	scene.add( light, light.target );
	scene.add( new AmbientLight( 0xe65100, 0.25 ) );

	// shadows
	const shadowCam = light.shadow.camera;
	light.castShadow = true;
	light.shadow.mapSize.setScalar( 4096 );
	light.shadow.bias = 1e-5;
	light.shadow.normalBias = 1e-2;

	shadowCam.left = shadowCam.bottom = - 5;
	shadowCam.right = shadowCam.top = 5;
	shadowCam.updateProjectionMatrix();

	// camera setup
	camera = new PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 50 );
	camera.position.set( 0, 7, 6 );
	camera.far = 100;
	camera.updateProjectionMatrix();

	// controls
	controls = new OrbitControls( camera, renderer.domElement );

	// bunny mesh has no UVs so skip that attribute
	csgEvaluator = new Evaluator();
	csgEvaluator.attributes = [ 'position', 'normal' ];

	// initialize materials
	mat1 = new MeshStandardMaterial();
	mat1.side = DoubleSide;
	mat1.roughness = 0.9;
	mat1.color.set( 0xfff8e1 );

	mat2 = mat1.clone();
	mat2.color.set( 0xff9800 );

	transMat1 = mat1.clone();
	transMat1.opacity = 0.15;
	transMat1.transparent = true;
	transMat1.depthWrite = false;
	transMat1.polygonOffset = true;
	transMat1.polygonOffsetFactor = 0.2;
	transMat1.polygonOffsetUnits = 0.2;
	transMat1.premultipliedAlpha = true;

	transMat2 = transMat1.clone();
	transMat2.color.copy( mat2.color );

	// initialize brushes
	brush1 = new Brush( new IcosahedronGeometry( 1, 1 ), transMat1 );
	brush1.geometry.computeVertexNormals();
	brush1.castShadow = true;

	brush2 = new Brush( new CylinderGeometry( 0.5, 0.5, 2.5 ), transMat2 );
	brush2.castShadow = true;

	scene.add( brush1, brush2 );

	// add object displaying the result
	result = new Mesh();
	result.castShadow = true;
	result.receiveShadow = true;

	result2 = new Mesh();
	result2.castShadow = true;
	result2.receiveShadow = true;

	result3 = new Mesh();
	result3.castShadow = true;
	result3.receiveShadow = true;

	result4 = new Mesh();
	result4.castShadow = true;
	result4.receiveShadow = true;
	scene.add( result, result2, result3, result4 );

	const floor = new Mesh( new PlaneGeometry(), new ShadowMaterial( { color: 0xe65100, transparent: true, opacity: 0.075 } ) );
	// const floor = new Mesh( new PlaneGeometry(), new MeshStandardMaterial() );
	floor.rotation.x = - Math.PI / 2;
	floor.position.y = - 2;
	floor.scale.setScalar( 50 );
	floor.receiveShadow = true;
	scene.add( floor );

	window.addEventListener( 'resize', function () {

		camera.aspect = window.innerWidth / window.innerHeight;
		camera.updateProjectionMatrix();

		renderer.setSize( window.innerWidth, window.innerHeight );

	}, false );

	render();

}

function render() {

	requestAnimationFrame( render );

	const t = window.performance.now() + 9000;
	brush1.rotation.x = t * 0.0001;
	brush1.rotation.y = t * 0.00025;
	brush1.rotation.z = t * 0.0005;

	brush2.rotation.x = t * - 0.0002;
	brush2.rotation.y = t * - 0.0005;
	brush2.rotation.z = t * - 0.001;

	brush1.updateMatrixWorld();
	brush2.updateMatrixWorld();

	brush1.material = mat1;
	brush2.material = mat2;
	csgEvaluator.evaluate( brush1, brush2, [ SUBTRACTION, INTERSECTION, ADDITION, REVERSE_SUBTRACTION ], [ result, result2, result3, result4 ] );
	result.position.x = - 3.5;
	result.position.z = 3.5;

	result2.position.x = 3.5;
	result2.position.z = 3.5;

	result3.position.x = - 3.5;
	result3.position.z = - 3.5;

	result4.position.x = 3.5;
	result4.position.z = - 3.5;

	brush1.material = transMat1;
	brush2.material = transMat2;

	renderer.render( scene, camera );

}



