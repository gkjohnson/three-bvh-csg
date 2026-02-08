import { TriangleSplitter } from './TriangleSplitter.js';
import { OperationDebugData } from './debug/OperationDebugData.js';
import { performOperation } from './operations/operations.js';
import { Brush } from './Brush.js';
import { trimAttributes, joinGroups, getMaterialList } from './operations/GeometryUtils.js';
import { GeometryBuilder } from './operations/GeometryBuilder.js';

// Utility class for performing CSG operations
export class Evaluator {

	constructor() {

		this.triangleSplitter = new TriangleSplitter();
		this.geometryBuilders = [];
		this.attributes = [ 'position', 'uv', 'normal' ];
		this.useGroups = true;
		this.consolidateGroups = true;
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
			debug,
		} = this;

		// expand the attribute data array to the necessary size
		while ( geometryBuilders.length < targetBrushes.length ) {

			geometryBuilders.push( new GeometryBuilder() );

		}

		// prepare the attribute data buffer information
		targetBrushes.forEach( ( brush, i ) => {

			geometryBuilders[ i ].initFromGeometry( a.geometry, attributes );
			trimAttributes( brush.geometry, attributes );

		} );

		// run the operation to fill the list of attribute data
		debug.init();
		performOperation( a, b, operations, triangleSplitter, geometryBuilders, { useGroups } );
		debug.complete();

		// get the materials and group ranges
		const aGroups = this.getGroupRanges( a.geometry );
		const aMaterials = getMaterialList( aGroups, a.material );

		const bGroups = this.getGroupRanges( b.geometry );
		const bMaterials = getMaterialList( bGroups, b.material );
		bGroups.forEach( g => g.materialIndex += aMaterials.length );

		// get the full set of groups
		let groups = [ ...aGroups, ...bGroups ].map( ( group, index ) => {

			return { ...group, index };

		} );

		// generate the minimum set of materials needed for the list of groups and adjust the groups
		// if they're needed
		if ( useGroups ) {

			const allMaterials = [ ...aMaterials, ...bMaterials ];
			if ( consolidateGroups ) {

				groups = groups
					.map( group => {

						const mat = allMaterials[ group.materialIndex ];
						group.materialIndex = allMaterials.indexOf( mat );
						return group;

					} )
					.sort( ( a, b ) => {

						return a.materialIndex - b.materialIndex;

					} );

			}

			// create a map from old to new index and remove materials that aren't used
			const finalMaterials = [];
			for ( let i = 0, l = allMaterials.length; i < l; i ++ ) {

				let foundGroup = false;
				for ( let g = 0, lg = groups.length; g < lg; g ++ ) {

					const group = groups[ g ];
					if ( group.materialIndex === i ) {

						foundGroup = true;
						group.materialIndex = finalMaterials.length;

					}

				}

				if ( foundGroup ) {

					finalMaterials.push( allMaterials[ i ] );

				}

			}

			targetBrushes.forEach( tb => {

				tb.material = finalMaterials;

			} );

		} else {

			groups = [ { start: 0, count: Infinity, index: 0, materialIndex: 0 } ];
			targetBrushes.forEach( tb => {

				tb.material = aMaterials[ 0 ];

			} );

		}

		// apply groups and attribute data to the geometry
		targetBrushes.forEach( ( brush, i ) => {

			const targetGeometry = brush.geometry;
			geometryBuilders[ i ].buildGeometry( targetGeometry, groups );

			if ( consolidateGroups ) {

				joinGroups( targetGeometry.groups );

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
