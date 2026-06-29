import { CDTTriangleSplitter } from './CDTTriangleSplitter.js';
import { LegacyTriangleSplitter } from './LegacyTriangleSplitter.js';
import { OperationDebugData } from './debug/OperationDebugData.js';
import { performOperation } from './operations/operations.js';
import { Brush } from './Brush.js';
import { GeometryBuilder } from './operations/GeometryBuilder.js';
import * as GeometryUtils from './operations/GeometryUtils.js';
import { conformGeometry } from './operations/conformGeometry.js';

// Utility class for performing CSG operations
export class Evaluator {

	get useCDTClipping() {

		return this.triangleSplitter instanceof CDTTriangleSplitter;

	}

	set useCDTClipping( v ) {

		if ( v !== this.useCDTClipping ) {

			this.triangleSplitter = v ? new CDTTriangleSplitter() : new LegacyTriangleSplitter();

		}

	}

	constructor() {

		this.triangleSplitter = new LegacyTriangleSplitter();
		this.geometryBuilders = [];
		this.attributes = [ 'position', 'uv', 'normal' ];
		this.useGroups = true;
		this.consolidateGroups = true;
		this.removeUnusedMaterials = true;
		// Opt-in watertight post-process for the CDT path: weld seam vertices by position,
		// conform T-junctions and zipper seam tears into a closed 2-manifold.
		this.consolidateVertices = false;
		this.consolidateVerticesTolerance = 2e-4;
		this.conformTolerance = 2e-4;
		this.seamRegistryTolerance = 3e-4;
		// Terminal-only: collapse the straight-edge / coplanar subdivision vertices the CDT
		// accumulates each cut. Geometry-exact and watertight, but it removes vertices a
		// SUBSEQUENT boolean would need to match its new seam against — so only enable it on
		// the final result of an iterated chain, never per intermediate op.
		this.decimate = false;
		this.decimateMaxPass = 64;
		this.debug = new OperationDebugData();

	}

	getGroupRanges( geometry ) {

		const singleGroup = ! this.useGroups || geometry.groups.length === 0;
		if ( singleGroup ) {

			return [ { start: 0, count: Infinity, materialIndex: 0 } ];

		} else {

			return geometry.groups.map( group => ( { ...group } ) );

		}

	}

	evaluate( a, b, operations, targetBrushes = new Brush() ) {

		let wasArray = true;
		if ( ! Array.isArray( operations ) ) {

			operations = [ operations ];

		}

		if ( ! Array.isArray( targetBrushes ) ) {

			targetBrushes = [ targetBrushes ];
			wasArray = false;

		}

		if ( targetBrushes.length !== operations.length ) {

			throw new Error( 'Evaluator: operations and target array passed as different sizes.' );

		}

		// initialize the geometry fields
		a.prepareGeometry();
		b.prepareGeometry();

		const {
			triangleSplitter,
			geometryBuilders,
			attributes,
			useGroups,
			consolidateGroups,
			removeUnusedMaterials,
			debug,
		} = this;

		// expand the attribute data array to the necessary size
		while ( geometryBuilders.length < targetBrushes.length ) {

			geometryBuilders.push( new GeometryBuilder() );

		}

		// only the CDT splitter supports the seam-welding path
		const consolidateVertices = this.consolidateVertices && 'consolidateVertices' in triangleSplitter;
		triangleSplitter.consolidateVertices = consolidateVertices;

		// prepare the attribute data buffer information
		targetBrushes.forEach( ( brush, i ) => {

			geometryBuilders[ i ].initFromGeometry( a.geometry, attributes );
			geometryBuilders[ i ].weldSeams = consolidateVertices;
			geometryBuilders[ i ].weldTolerance = this.consolidateVerticesTolerance;
			GeometryUtils.trimAttributes( brush.geometry, attributes );

		} );

		// run the operation to fill the list of attribute data
		debug.init();
		performOperation( a, b, operations, triangleSplitter, geometryBuilders, { useGroups, seamTolerance: consolidateVertices ? this.seamRegistryTolerance : 0 } );
		debug.complete();

		// get the materials and group ranges
		const aGroups = this.getGroupRanges( a.geometry );
		const aMaterials = GeometryUtils.getMaterialList( aGroups, a.material );

		const bGroups = this.getGroupRanges( b.geometry );
		const bMaterials = GeometryUtils.getMaterialList( bGroups, b.material );
		bGroups.forEach( g => g.materialIndex += aMaterials.length );

		// get the full set of groups and materials
		const materials = [ ...aMaterials, ...bMaterials ];
		let groups = [ ...aGroups, ...bGroups ].map( ( group, index ) => ( { ...group, index } ) );

		// adjust the groups
		if ( ! useGroups ) {

			groups = [ { start: 0, count: Infinity, index: 0, materialIndex: 0 } ];

		} else if ( useGroups && consolidateGroups ) {

			// use the same material for any group thats pointing to the same material in different slots
			// so we can merge these groups later
			groups = GeometryUtils.useCommonMaterials( groups, materials );
			groups.sort( ( a, b ) => a.materialIndex - b.materialIndex );

		}

		// apply groups and attribute data to the geometry
		targetBrushes.forEach( ( brush, i ) => {

			const targetGeometry = brush.geometry;
			geometryBuilders[ i ].buildGeometry( targetGeometry, groups );

			if ( consolidateVertices ) {

				conformGeometry( targetGeometry, { weldTolerance: this.consolidateVerticesTolerance, conformTolerance: this.conformTolerance, decimate: this.decimate === true, decimateMaxPass: this.decimateMaxPass } );

			}

			// assign brush A's transform to the result so the geometry is in a stable position
			a.matrixWorld.decompose( brush.position, brush.quaternion, brush.scale );
			brush.updateMatrix();
			brush.matrixWorld.copy( a.matrixWorld );

			if ( useGroups ) {

				brush.material = materials;

				if ( consolidateGroups ) {

					GeometryUtils.joinGroups( targetGeometry.groups );

				}

				if ( removeUnusedMaterials ) {

					brush.material = GeometryUtils.removeUnusedMaterials( targetGeometry.groups, materials );

				}

			} else {

				brush.material = materials[ 0 ];

			}

		} );

		return wasArray ? targetBrushes : targetBrushes[ 0 ];

	}

	// TODO: fix
	evaluateHierarchy( root, target = new Brush() ) {

		root.updateMatrixWorld( true );

		const flatTraverse = ( obj, cb ) => {

			const children = obj.children;
			for ( let i = 0, l = children.length; i < l; i ++ ) {

				const child = children[ i ];
				if ( child.isOperationGroup ) {

					flatTraverse( child, cb );

				} else {

					cb( child );

				}

			}

		};


		const traverse = brush => {

			const children = brush.children;
			let didChange = false;
			for ( let i = 0, l = children.length; i < l; i ++ ) {

				const child = children[ i ];
				didChange = traverse( child ) || didChange;

			}

			const isDirty = brush.isDirty();
			if ( isDirty ) {

				brush.markUpdated();

			}

			if ( didChange && ! brush.isOperationGroup ) {

				let result;
				flatTraverse( brush, child => {

					if ( ! result ) {

						result = this.evaluate( brush, child, child.operation );

					} else {

						result = this.evaluate( result, child, child.operation );

					}

				} );

				brush._cachedGeometry = result.geometry;
				brush._cachedMaterials = result.material;
				return true;

			} else {

				return didChange || isDirty;

			}

		};

		traverse( root );

		target.geometry = root._cachedGeometry;
		target.material = root._cachedMaterials;

		return target;

	}

	reset() {

		this.triangleSplitter.reset();

	}

}
