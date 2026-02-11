export function trimAttributes( targetGeometry, relevantAttributes ) {

	for ( const key in targetGeometry.attributes ) {

		if ( ! relevantAttributes.includes( key ) ) {

			targetGeometry.deleteAttribute( key );
			targetGeometry.dispose();

		}

	}

	return targetGeometry;

}

// writes new groups to point to the same material index in the given materials array
export function useCommonMaterials( groups, materials ) {

	const result = [];
	for ( let i = 0, l = groups.length; i < l; i ++ ) {

		const group = groups[ i ];
		const mat = materials[ group.materialIndex ];
		result.push( {
			...group,
			materialIndex: materials.indexOf( mat ),
		} );

	}

	return result;

}

// returns a new list of materials and modifies the groups in place to reference those materials
export function removeUnusedMaterials( groups, materials ) {

	const newMaterials = [];
	const indexMap = new Map();
	for ( let g = 0, lg = groups.length; g < lg; g ++ ) {

		const group = groups[ g ];
		if ( ! indexMap.has( group.materialIndex ) ) {

			indexMap.set( group.materialIndex, newMaterials.length );
			newMaterials.push( materials[ group.materialIndex ] );

		}

		group.materialIndex = indexMap.get( group.materialIndex );

	}

	return newMaterials;

}

// merges groups with common material indices in place
export function joinGroups( groups ) {

	for ( let i = 0; i < groups.length - 1; i ++ ) {

		const group = groups[ i ];
		const nextGroup = groups[ i + 1 ];
		if ( group.materialIndex === nextGroup.materialIndex ) {

			const start = group.start;
			const end = nextGroup.start + nextGroup.count;
			nextGroup.start = start;
			nextGroup.count = end - start;

			groups.splice( i, 1 );
			i --;

		}

	}

}


// Returns the list of materials used for the given set of groups
export function getMaterialList( groups, materials ) {

	let result = materials;
	if ( ! Array.isArray( materials ) ) {

		result = [];
		groups.forEach( g => {

			result[ g.materialIndex ] = materials;

		} );

	}

	return result;

}
