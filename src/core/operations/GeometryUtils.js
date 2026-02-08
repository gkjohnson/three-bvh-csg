export function trimAttributes( targetGeometry, relevantAttributes ) {

	for ( const key in targetGeometry.attributes ) {

		if ( ! relevantAttributes.includes( key ) ) {

			targetGeometry.deleteAttribute( key );
			targetGeometry.dispose();

		}

	}

	return targetGeometry;

}
