import { Triangle, Matrix4, Line3, Plane, Vector3 } from 'three';
import { getIntersectedLine, transformToFrame } from './utils';

const EPSILON = 1e-10;

export class TriangleGraph {

	constructor() {

		this.points = [];
		this.connections = [];
		this.triangles = [];

		this.initialTri = new Triangle();
		this.plane = new Plane();
		this.frame = new Matrix4();
		this.invFrame = new Matrix4();

	}

	initialize( tri ) {

		this.reset();

		const norm = new Vector3();
		const right = new Vector3();
		const up = new Vector3();

		tri.getNormal( norm );
		right.subVectors( tri.a, tri.b ).normalize();
		up.crossVectors( norm, right );

		const { frame, invFrame, initialTri, points } = this;
		frame.makeBasis( right, up, norm ).setPosition( tri.a );
		invFrame.copy( frame ).invert();

		initialTri.copy( tri );
		transformToFrame( initialTri, frame );

		points.push(
			tri.a.clone(),
			tri.b.clone(),
			tri.c.clone(),
		);

	}

	reset() {

		// TODO: use a pool of objects here
		this.points = [];
		this.connections = [];
		this.triangles = [];

	}

	splitBy( tri ) {

		const { plane, frame, initialTri } = this;

		tri = tri.clone();
		transformToFrame( tri, frame );

		const line = new Line3();
		const hitPoint = new Vector3();
		const arr = [ tri.a, tri.b, tri.c ];
		const points = [];
		let coplanarPoints = 0;

		for ( let i = 0; i < 3; i ++ ) {

			const ni = ( i + 1 ) % 3;
			const p0 = arr[ i ];
			const p1 = arr[ ni ];
			const d0 = plane.distanceToPoint( p0 );

			if ( d0 < EPSILON ) {

				coplanarPoints ++;

			}

			line.start.copy( p0 );
			line.end.copy( p1 );

			if ( ! plane.intersectLine( line, hitPoint ) || hitPoint.distanceTo( p1 ) < EPSILON ) {

				if ( d0 < EPSILON ) {

					hitPoint.copy( p0 );

				} else {

					continue;

				}

			}

			points.push( hitPoint.clone() );

		}

		const edges = [];
		if ( coplanarPoints === 3 ) {

			for ( let i = 0; i < 3; i ++ ) {

				const ni = ( i + 1 ) % 3;
				const p0 = arr[ i ];
				const p1 = arr[ ni ];

				const c0 = initialTri.containsPoint( p0 );
				const c1 = initialTri.containsPoint( p1 );
				if ( c0 && c1 ) {

					const line = new Line3();
					line.start.copy( p0 );
					line.end.copy( p1 );
					edges.push( line );

				} else {

					const result = new Line3();
					const edge = new Line3();
					edge.start.copy( p0 );
					edge.end.copy( p1 );
					if ( getIntersectedLine( edge, initialTri, result ) ) {

						edges.push( result.clone() );

					}

				}

			}

		} else {

			const result = new Line3();
			const edge = new Line3();
			edge.start.copy( points[ 0 ] );
			edge.end.copy( points[ 1 ] );
			if ( getIntersectedLine( edge, initialTri, result ) ) {

				edges.push( result.clone() );

			}

		}

		// deduplicate and add edges
		for ( let i = 0, l = edges.length; i < l; i ++ ) {

			const edge = edges[ i ];
			let startIndex = this.findClosestPointIndex( edge.start );
			if ( startIndex === null ) {

				startIndex = points.length;
				points.push( edge.start.clone() );

			}

			let endIndex = this.findClosestPointIndex( edge.start );
			if ( endIndex === null ) {

				endIndex = points.length;
				points.push( edge.end.clone() );

			}

		}

		// TODO: insert edges
		// - detect crossings with other edges and swap them to insert
		// - possibly need to store triangles to swap



		// TODO
		// - find intersection edge
		// - transform tri or intersection edge into og tri frame w/ z up
		// - which triangles the points line up on (or which edges they may lie on) to split and insert
		// 	  - possibly split the main triangle edges
		// - triangulate the points
		// - swap so the required edges are present
		// - confirm on edges cross??
		// OR
		// - just clip into separate shapes? Use earcut to triangulate?

	}

	findClosestPointIndex( p ) {

		const points = this.points;
		let closestIndex = null;
		let closestDist = Infinity;
		for ( let i = 0, l = points.length; i < l; i ++ ) {

			const d = p.distanceTo( points[ i ] );
			if ( d < EPSILON && d < closestDist ) {

				closestIndex = i;
				closestDist = d;

			}

		}

		return closestIndex;

	}

	forEachTriangle( cb ) {


	}

}
