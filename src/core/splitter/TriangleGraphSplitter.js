import { Triangle, Matrix4, Line3, Plane, Vector3 } from 'three';
import { getTriangleLineIntersection } from './utils.js';
import { EdgeGraph } from './EdgeGraph.js';

const EPSILON = 1e-10;

const _norm = new Vector3();
const _right = new Vector3();
const _up = new Vector3();

const _hitPoint = new Vector3();

const _result = new Line3();
const _edge = new Line3();

const _triangleVertices = new Array( 3 );

export class TriangleGraphSplitter {

	get triangles() {

		return this.graph.triangles;

	}

	constructor() {

		this.graph = new EdgeGraph();
		this.coplanarTriangleUsed = false;

		this.initialTri = new Triangle();
		this.plane = new Plane();
		this.frame = new Matrix4();
		this.invFrame = new Matrix4();

	}

	initialize( tri ) {

		this.reset();

		const { initialTri, graph, plane } = this;

		tri.getNormal( _norm );
		_right.subVectors( tri.a, tri.b ).normalize();
		_up.crossVectors( _norm, _right );

		tri.getPlane( plane );

		initialTri.copy( tri );
		graph.initialize( initialTri );

	}

	reset() {

		this.graph.reset();
		this.coplanarTriangleUsed = false;

	}

	splitByTriangle( tri ) {

		const { plane, invFrame, initialTri, graph } = this;

		const planePoints = [];
		let coplanarPoints = 0;

		_triangleVertices[ 0 ] = tri.a;
		_triangleVertices[ 1 ] = tri.b;
		_triangleVertices[ 2 ] = tri.c;

		// find the points on the plane surface
		for ( let i = 0; i < 3; i ++ ) {

			const ni = ( i + 1 ) % 3;
			const p0 = _triangleVertices[ i ];
			const p1 = _triangleVertices[ ni ];
			const d0 = Math.abs( plane.distanceToPoint( p0 ) );

			if ( d0 < EPSILON ) {

				coplanarPoints ++;

			}

			_edge.start.copy( p0 );
			_edge.end.copy( p1 );

			if ( ! plane.intersectLine( _edge, _hitPoint ) || _hitPoint.distanceTo( p1 ) < EPSILON ) {

				// add buffer for the start point
				if ( d0 < EPSILON ) {

					_hitPoint.copy( p0 );

				} else {

					continue;

				}

			}

			// TODO: use a pool for these points?
			planePoints.push( _hitPoint.clone() );

		}

		planePoints.forEach( p => {

			plane.projectPoint( p, p );

		} );

		// find the edges that intersect with the triangle itself
		if ( coplanarPoints === 3 ) {

			this.coplanarTriangleUsed = true;
			for ( let i = 0; i < 3; i ++ ) {

				const ni = ( i + 1 ) % 3;
				_edge.start.copy( planePoints[ i ] );
				_edge.end.copy( planePoints[ ni ] );

				if ( getTriangleLineIntersection( _edge, initialTri, _result ) ) {

					graph.insertEdge( _result );

				}

			}

		} else if ( planePoints.length >= 2 ) {

			_edge.start.copy( planePoints[ 0 ] );
			_edge.end.copy( planePoints[ 1 ] );

			if ( getTriangleLineIntersection( _edge, initialTri, _result ) ) {

				graph.insertEdge( _result );

			}

		} else {

			// we only touch at a single vertex so do nothing

		}

	}

	complete() {

		const issues = this.graph.validate();
		if ( issues.length ) {

			issues.forEach( msg => console.warn( msg ) );

		}

	}

}
